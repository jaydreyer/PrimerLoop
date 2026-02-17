"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { Alert } from "../../../components/ui/Alert";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";

type QuizQuestion = {
  id: string;
  type: "mcq" | "short";
  prompt: string;
  choices?: string[];
  answer?: string;
  rubric?: string;
};

type QuizContent = {
  title: string;
  questions: QuizQuestion[];
};

type QuizAnswerResult = {
  questionId: string;
  type: "mcq" | "short";
  score: number;
  feedback: string;
  status: "graded" | "needs_review";
};

type QuizSubmitResponse = {
  attemptId: string;
  sessionId: string;
  totals: {
    total: number;
    scoreTotal: number;
    maxScore: number;
    percentage: number;
  };
  perQuestionResults: QuizAnswerResult[];
};

type QuizClientProps = {
  sessionId: string;
  conceptTitle: string;
  quiz: QuizContent;
};

export default function QuizClient({ sessionId, conceptTitle, quiz }: QuizClientProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialAnswerMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const question of quiz.questions) {
      map[question.id] = "";
    }
    return map;
  }, [quiz.questions]);

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...initialAnswerMap, ...prev, [questionId]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        sessionId,
        answers: quiz.questions.map((question) => ({
          questionId: question.id,
          value: answers[question.id] ?? "",
        })),
      };

      const response = await fetch("/api/quiz/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as QuizSubmitResponse & { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to submit quiz");
      }

      const completionResponse = await fetch("/api/session/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!completionResponse.ok) {
        // Keep results reachable even if completion finalize fails; avoids duplicate quiz submits.
        console.error("Session completion failed", await completionResponse.text());
      }

      const encoded = encodeURIComponent(
        JSON.stringify({
          attemptId: body.attemptId,
          totals: body.totals,
          perQuestionResults: body.perQuestionResults,
          conceptTitle,
          quizTitle: quiz.title,
        }),
      );
      router.push(`/results/${sessionId}?result=${encoded}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSubmitting(false);
    }
  }

  return (
    <main className="space-y-4">
      <Card className="space-y-5">
        <div className="space-y-2">
          <Badge variant="muted">{conceptTitle}</Badge>
          <h1 className="text-2xl font-semibold leading-snug sm:text-3xl">{quiz.title}</h1>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6">
          {quiz.questions.map((question, index) => (
            <section key={question.id} className="space-y-3">
              <h2 className="text-base font-semibold leading-relaxed text-slate-900 sm:text-lg">
                {index + 1}. {question.prompt}
              </h2>

              {question.type === "mcq" && question.choices ? (
                <div className="grid gap-2">
                  {question.choices.map((choice) => (
                    <label
                      key={choice}
                      className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={choice}
                        checked={(answers[question.id] ?? "") === choice}
                        onChange={(event) => setAnswer(question.id, event.target.value)}
                        className="mt-0.5 h-4 w-4 border-slate-300 text-slate-900"
                      />
                      <span>{choice}</span>
                    </label>
                  ))}
                </div>
              ) : null}

              {question.type === "short" ? (
                <textarea
                  name={question.id}
                  value={answers[question.id] ?? ""}
                  onChange={(event) => setAnswer(question.id, event.target.value)}
                  rows={4}
                  className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none ring-slate-900/20 transition focus:ring sm:text-base"
                />
              ) : null}
            </section>
          ))}

          {error ? <Alert variant="error">{error}</Alert> : null}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit quiz"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
