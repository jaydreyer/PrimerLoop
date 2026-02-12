"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

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
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 20 }}>
      <article
        style={{
          border: "1px solid #e7e7e7",
          borderRadius: 14,
          padding: 20,
          background: "#fff",
        }}
      >
        <p style={{ margin: 0, color: "#666", fontSize: 14 }}>{conceptTitle}</p>
        <h1 style={{ marginTop: 8 }}>{quiz.title}</h1>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18 }}>
          {quiz.questions.map((question, index) => (
            <section key={question.id}>
              <h2 style={{ fontSize: 18, marginBottom: 8 }}>
                {index + 1}. {question.prompt}
              </h2>

              {question.type === "mcq" && question.choices ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {question.choices.map((choice) => (
                    <label
                      key={choice}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        border: "1px solid #ddd",
                        borderRadius: 8,
                        padding: "8px 10px",
                      }}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={choice}
                        checked={(answers[question.id] ?? "") === choice}
                        onChange={(event) => setAnswer(question.id, event.target.value)}
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
                  style={{
                    width: "100%",
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: 10,
                    resize: "vertical",
                  }}
                />
              ) : null}
            </section>
          ))}

          {error ? <p style={{ color: "#9f1d1d", margin: 0 }}>{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "fit-content",
              border: 0,
              borderRadius: 10,
              background: submitting ? "#6b7280" : "#111",
              color: "#fff",
              padding: "10px 16px",
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Submitting..." : "Submit quiz"}
          </button>
        </form>
      </article>
    </main>
  );
}
