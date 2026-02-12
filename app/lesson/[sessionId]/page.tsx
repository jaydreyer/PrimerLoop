import Link from "next/link";
import { headers } from "next/headers";

type LessonPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function LessonPage({ params }: LessonPageProps) {
  const { sessionId } = await params;
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const baseUrl = host ? `${protocol}://${host}` : "http://127.0.0.1:3001";

  const response = await fetch(`${baseUrl}/api/session/${sessionId}`, {
    cache: "no-store",
    headers: {
      cookie: headerStore.get("cookie") ?? "",
    },
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({ error: "Unable to load lesson" }))) as {
      error?: string;
    };
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: 20 }}>
        <h1>Lesson</h1>
        <p style={{ color: "#9f1d1d" }}>{errorBody.error ?? "Unable to load lesson"}</p>
      </main>
    );
  }

  const payload = (await response.json()) as {
    concept: { name: string };
    lesson: {
      title: string;
      sections: Array<{ heading: string; bullets: string[] }>;
      key_takeaways: string[];
    };
  };

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
        <p style={{ margin: 0, color: "#555", fontSize: 14 }}>{payload.concept.name}</p>
        <h1 style={{ marginTop: 8 }}>{payload.lesson.title}</h1>

        {payload.lesson.sections.map((section) => (
          <section key={section.heading} style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>{section.heading}</h2>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {section.bullets.map((bullet) => (
                <li key={bullet} style={{ marginBottom: 6 }}>
                  {bullet}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Key Takeaways</h2>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {payload.lesson.key_takeaways.map((item) => (
              <li key={item} style={{ marginBottom: 6 }}>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <div style={{ marginTop: 22 }}>
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
            Go to quiz
          </Link>
        </div>
      </article>
    </main>
  );
}
