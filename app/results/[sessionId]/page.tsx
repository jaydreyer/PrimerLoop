import Link from "next/link";
import { createSupabaseUserServer } from "../../../lib/supabaseUserServer";

type ResultsPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { sessionId } = await params;
  const supabase = await createSupabaseUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: 20 }}>
        <h1>Results</h1>
        <p style={{ color: "#9f1d1d" }}>Please sign in to view your quiz results.</p>
      </main>
    );
  }

  const { data: submission } = await supabase
    .from("quiz_submissions")
    .select("id, score_total, score_max, percent, results, created_at")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      score_total: number;
      score_max: number;
      percent: number;
      results: Array<{
        questionId: string;
        type: "mcq" | "short";
        score: number;
        feedback: string;
        status: "graded" | "needs_review";
        strengths?: string[];
        gaps?: string[];
      }>;
      created_at: string;
    }>();

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
        <h1 style={{ marginTop: 0 }}>Results</h1>
        <p style={{ color: "#555" }}>Session: {sessionId}</p>

        {submission ? (
          <>
            <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 14,
                marginBottom: 16,
                background: "#fafafa",
              }}
            >
              <p style={{ margin: 0, fontWeight: 600 }}>Quiz Summary</p>
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                Score: {submission.score_total.toFixed(1)} / {submission.score_max} ({submission.percent}%)
              </p>
            </section>

            <section style={{ display: "grid", gap: 10 }}>
              {submission.results.map((result) => (
                <div
                  key={result.questionId}
                  style={{
                    border: "1px solid #ececec",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {result.questionId} · {result.type.toUpperCase()}
                  </p>
                  <p style={{ margin: "6px 0 0", color: "#444" }}>{result.feedback}</p>
                  <p style={{ margin: "6px 0 0", color: "#666", fontSize: 14 }}>
                    Score: {result.score} · Status: {result.status}
                  </p>
                  {result.strengths && result.strengths.length > 0 ? (
                    <p style={{ margin: "6px 0 0", color: "#256029", fontSize: 14 }}>
                      Strengths: {result.strengths.join(" • ")}
                    </p>
                  ) : null}
                  {result.gaps && result.gaps.length > 0 ? (
                    <p style={{ margin: "6px 0 0", color: "#9f1d1d", fontSize: 14 }}>
                      Gaps: {result.gaps.join(" • ")}
                    </p>
                  ) : null}
                </div>
              ))}
            </section>
          </>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <p style={{ color: "#555", margin: 0 }}>
              No quiz attempt found yet for this session. Submit the quiz to see results.
            </p>
            <div>
              <Link
                href={`/quiz/${sessionId}`}
                style={{
                  display: "inline-block",
                  textDecoration: "none",
                  background: "#111",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "10px 14px",
                }}
              >
                Back to quiz
              </Link>
            </div>
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <Link
            href="/today"
            style={{
              display: "inline-block",
              textDecoration: "none",
              background: "#111",
              color: "#fff",
              borderRadius: 10,
              padding: "10px 14px",
            }}
          >
            Back to today
          </Link>
        </div>
      </article>
    </main>
  );
}
