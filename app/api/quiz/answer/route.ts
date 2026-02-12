import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseUserServer } from "../../../../lib/supabaseUserServer";
import { clampScore, getCachedQuiz, gradeShortAnswer, QuizContentSchema } from "../../../../lib/llm";
import { blendedMasteryScore, nextReviewAtFromPercent } from "../../../../lib/mastery";
import type { SessionRow } from "../../../../lib/types";

const quizAnswerBodySchema = z
  .object({
    sessionId: z.string().uuid(),
    answers: z
      .array(
        z.object({
          questionId: z.string().min(1),
          value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
        }),
      )
      .min(1),
  })
  .strict();

export async function POST(request: Request) {
  const supabase = await createSupabaseUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = quizAnswerBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { sessionId, answers } = parsed.data;
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, user_id, subject_id, concept_id, difficulty")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle<SessionRow>();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (!session.subject_id || !session.concept_id || !session.difficulty) {
    return NextResponse.json(
      {
        error:
          "Session metadata missing (subject_id, concept_id, or difficulty). Backfill sessions or seed subjects/concepts before grading quiz.",
      },
      { status: 500 },
    );
  }

  const cachedQuiz = await getCachedQuiz(session.subject_id, session.concept_id, session.difficulty, 1);
  const parsedQuiz = QuizContentSchema.safeParse(cachedQuiz);
  if (!parsedQuiz.success) {
    return NextResponse.json({ error: "Quiz not available for grading" }, { status: 500 });
  }

  const answerMap = new Map(answers.map((item) => [item.questionId, String(item.value ?? "")]));
  const perQuestionResults = await Promise.all(parsedQuiz.data.questions.map(async (question) => {
    const submitted = answerMap.get(question.id) ?? "";
    if (question.type === "mcq") {
      const answerByText = (question.answer ?? "").trim();
      const answerByIndex =
        typeof question.correctIndex === "number" && question.choices?.[question.correctIndex]
          ? question.choices[question.correctIndex]
          : "";
      const expected = answerByText || answerByIndex;
      const isCorrect =
        expected.length > 0 &&
        (submitted.trim() === expected || submitted.trim() === String(question.correctIndex ?? ""));
      return {
        questionId: question.id,
        type: "mcq" as const,
        submitted,
        expected,
        score: isCorrect ? 1 : 0,
        feedback: isCorrect ? "Correct." : "Not quite. Review this concept and try again.",
        strengths: isCorrect ? ["Correct option selected."] : [],
        gaps: isCorrect ? [] : ["Review concept notes and retry."],
        status: "graded" as const,
      };
    }

    const shortGrade = await gradeShortAnswer({
      conceptTitle: "Current Concept",
      questionPrompt: question.prompt,
      rubric: question.rubric ?? "Assess conceptual correctness and clarity.",
      userAnswer: submitted,
    });

    return {
      questionId: question.id,
      type: "short" as const,
      submitted,
      score: clampScore(shortGrade.score),
      feedback: shortGrade.feedback,
      strengths: shortGrade.strengths,
      gaps: shortGrade.gaps,
      status: "graded" as const,
    };
  }));

  const scored = perQuestionResults.reduce((sum, item) => sum + item.score, 0);
  const maxScore = parsedQuiz.data.questions.length;
  const percentage = maxScore ? Number(((scored / maxScore) * 100).toFixed(2)) : 0;

  const { data: insertedSubmission, error: insertError } = await supabase
    .from("quiz_submissions")
    .insert({
      session_id: session.id,
      user_id: user.id,
      subject_id: session.subject_id,
      concept_id: session.concept_id,
      score_total: scored,
      score_max: maxScore,
      percent: percentage,
      answers: parsed.data.answers,
      results: perQuestionResults,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !insertedSubmission) {
    return NextResponse.json(
      {
        error:
          "Failed to persist quiz submission. Ensure quiz_submissions schema includes session_id, user_id, subject_id, concept_id, score_total, score_max, percent, answers, and results.",
      },
      { status: 500 },
    );
  }

  const now = new Date();
  const nextReviewAt = nextReviewAtFromPercent(percentage, now).toISOString();
  const { data: existingMastery, error: existingMasteryError } = await supabase
    .from("user_concept_mastery")
    .select("mastery_score, review_count")
    .eq("user_id", user.id)
    .eq("subject_id", session.subject_id)
    .eq("concept_id", session.concept_id)
    .maybeSingle<{ mastery_score: number; review_count: number }>();

  if (existingMasteryError) {
    return NextResponse.json({ error: existingMasteryError.message }, { status: 500 });
  }

  if (existingMastery) {
    const { error: updateMasteryError } = await supabase
      .from("user_concept_mastery")
      .update({
        mastery_score: blendedMasteryScore(existingMastery.mastery_score, percentage),
        review_count: existingMastery.review_count + 1,
        last_attempt_at: now.toISOString(),
        next_review_at: nextReviewAt,
      })
      .eq("user_id", user.id)
      .eq("subject_id", session.subject_id)
      .eq("concept_id", session.concept_id);

    if (updateMasteryError) {
      return NextResponse.json({ error: updateMasteryError.message }, { status: 500 });
    }
  } else {
    const { error: insertMasteryError } = await supabase.from("user_concept_mastery").insert({
      user_id: user.id,
      subject_id: session.subject_id,
      concept_id: session.concept_id,
      mastery_score: Number((percentage / 100).toFixed(4)),
      review_count: 1,
      last_attempt_at: now.toISOString(),
      next_review_at: nextReviewAt,
    });

    if (insertMasteryError) {
      return NextResponse.json({ error: insertMasteryError.message }, { status: 500 });
    }
  }

  return NextResponse.json(
    {
      attemptId: insertedSubmission.id,
      sessionId: session.id,
      totals: {
        total: parsedQuiz.data.questions.length,
        scoreTotal: scored,
        maxScore,
        percentage,
      },
      perQuestionResults,
    },
    { status: 200 },
  );
}
