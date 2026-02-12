import { NextResponse } from "next/server";
import {
  generateQuizContent,
  getCachedQuiz,
  QuizContentSchema,
  type QuizContent,
} from "../../../../lib/llm";
import { requireAdminApiKey } from "../../../../lib/env.server";
import { createSupabaseUserServer } from "../../../../lib/supabaseUserServer";
import type { SessionRow } from "../../../../lib/types";

type RouteParams = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const supabase = await createSupabaseUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
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
          "Session metadata missing (subject_id, concept_id, or difficulty). Backfill sessions or seed subjects/concepts before loading quizzes.",
      },
      { status: 500 },
    );
  }

  const { data: concept, error: conceptError } = await supabase
    .from("concepts")
    .select("id, title")
    .eq("id", session.concept_id)
    .maybeSingle<{ id: string; title: string }>();

  if (conceptError || !concept) {
    return NextResponse.json({ error: conceptError?.message ?? "Concept not found" }, { status: 500 });
  }

  const { data: subject } = await supabase
    .from("subjects")
    .select("name")
    .eq("id", session.subject_id)
    .maybeSingle<{ name: string }>();

  const quizVersion = 1;
  let quiz: QuizContent | null = null;
  const cachedQuiz = await getCachedQuiz(
    session.subject_id,
    session.concept_id,
    session.difficulty,
    quizVersion,
  );

  if (cachedQuiz) {
    const parsedCached = QuizContentSchema.safeParse(cachedQuiz);
    if (parsedCached.success) {
      quiz = parsedCached.data;
    }
  }

  if (quiz) {
    return NextResponse.json(
      {
        sessionId: session.id,
        concept: { id: concept.id, title: concept.title },
        quiz,
        cached: true,
      },
      { status: 200 },
    );
  }

  const generatedQuiz = await generateQuizContent({
    conceptName: concept.title,
    difficulty: session.difficulty,
    subjectName: subject?.name ?? "Current Subject",
  });
  const parsedGenerated = QuizContentSchema.safeParse(generatedQuiz);

  if (!parsedGenerated.success) {
    return NextResponse.json({ error: "Generated quiz did not match schema" }, { status: 500 });
  }

  const adminApiKey = requireAdminApiKey();
  const cacheWriteResponse = await fetch(new URL("/api/admin/cache/quiz", request.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-api-key": adminApiKey,
    },
    body: JSON.stringify({
      subjectId: session.subject_id,
      conceptId: session.concept_id,
      difficulty: session.difficulty,
      version: quizVersion,
      content: parsedGenerated.data,
    }),
    cache: "no-store",
  });

  if (!cacheWriteResponse.ok) {
    const errorText = await cacheWriteResponse.text();
    return NextResponse.json(
      { error: `Failed to store quiz cache: ${errorText || cacheWriteResponse.statusText}` },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      sessionId: session.id,
      concept: { id: concept.id, title: concept.title },
      quiz: parsedGenerated.data,
      cached: false,
    },
    { status: 200 },
  );
}
