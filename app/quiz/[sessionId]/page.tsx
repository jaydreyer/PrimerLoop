import { headers } from "next/headers";
import QuizClient from "./QuizClient";

type QuizPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function QuizPage({ params }: QuizPageProps) {
  const { sessionId } = await params;
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const baseUrl = host ? `${protocol}://${host}` : "http://127.0.0.1:3001";

  const response = await fetch(`${baseUrl}/api/quiz/${sessionId}`, {
    cache: "no-store",
    headers: {
      cookie: headerStore.get("cookie") ?? "",
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({ error: "Unable to load quiz" }))) as {
      error?: string;
    };
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: 20 }}>
        <h1>Quiz</h1>
        <p style={{ color: "#9f1d1d" }}>{body.error ?? "Unable to load quiz"}</p>
      </main>
    );
  }

  const payload = (await response.json()) as {
    sessionId: string;
    concept: { id: string; title: string };
    quiz: {
      title: string;
      questions: Array<{
        id: string;
        type: "mcq" | "short";
        prompt: string;
        choices?: string[];
        answer?: string;
        rubric?: string;
      }>;
    };
  };

  return <QuizClient sessionId={payload.sessionId} conceptTitle={payload.concept.title} quiz={payload.quiz} />;
}
