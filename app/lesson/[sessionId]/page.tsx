import { headers } from "next/headers";
import { Alert } from "../../../components/ui/Alert";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";

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
      <main className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Lesson</h1>
        <Alert variant="error">{errorBody.error ?? "Unable to load lesson"}</Alert>
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
    <main className="space-y-4">
      <Card className="space-y-5">
        <div className="space-y-2">
          <Badge variant="muted">{payload.concept.name}</Badge>
          <h1 className="text-2xl font-semibold leading-snug sm:text-3xl">{payload.lesson.title}</h1>
        </div>

        {payload.lesson.sections.map((section) => (
          <section key={section.heading} className="space-y-2">
            <h2 className="text-lg font-semibold sm:text-xl">{section.heading}</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 sm:text-base">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </section>
        ))}

        <section className="space-y-2">
          <h2 className="text-lg font-semibold sm:text-xl">Key Takeaways</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 sm:text-base">
            {payload.lesson.key_takeaways.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <div className="pt-1">
          <Button href={`/quiz/${sessionId}`}>Go to quiz</Button>
        </div>
      </Card>
    </main>
  );
}
