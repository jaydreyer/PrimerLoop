"use client";

import { useEffect, useState } from "react";
import { Alert } from "../../../components/ui/Alert";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";

type NotebookEntryResponse = {
  conceptId: string;
  entry: {
    conceptTitle: string;
    summary: string;
    definition: string;
    whyItMatters: string[];
    commonPitfalls: string[];
    microExample: string;
    flashcards: Array<{ q: string; a: string }>;
    tags: string[];
  } | null;
  cached: boolean;
  error?: string;
};

type NotebookConceptClientProps = {
  conceptId: string;
};

export default function NotebookConceptClient({ conceptId }: NotebookConceptClientProps) {
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState<NotebookEntryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadNotebookEntry() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/notebook/${conceptId}`, {
          method: "GET",
          cache: "no-store",
        });
        const responseBody = (await response.json()) as NotebookEntryResponse;

        if (!response.ok || !responseBody.entry) {
          throw new Error(responseBody.error ?? "Unable to load notebook entry.");
        }

        if (active) {
          setBody(responseBody);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load notebook entry.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadNotebookEntry();
    return () => {
      active = false;
    };
  }, [conceptId]);

  if (loading) {
    return (
      <main className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Concept Note</h1>
        <Card>
          <p className="m-0 text-sm text-slate-700">Loading notebook entry...</p>
        </Card>
      </main>
    );
  }

  if (error || !body?.entry) {
    return (
      <main className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Concept Note</h1>
        <Alert variant="error">{error ?? "Unable to load notebook entry."}</Alert>
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <Card className="space-y-5">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold leading-snug sm:text-3xl">{body.entry.conceptTitle}</h1>
          <Badge variant="muted">{body.cached ? "Loaded from notebook cache" : "Generated now"}</Badge>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold sm:text-xl">Summary</h2>
          <p className="max-w-prose text-sm text-slate-700 sm:text-base">{body.entry.summary}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold sm:text-xl">Definition</h2>
          <p className="max-w-prose text-sm text-slate-700 sm:text-base">{body.entry.definition}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold sm:text-xl">Why It Matters</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 sm:text-base">
            {body.entry.whyItMatters.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold sm:text-xl">Common Pitfalls</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 sm:text-base">
            {body.entry.commonPitfalls.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold sm:text-xl">Micro Example</h2>
          <p className="max-w-prose text-sm text-slate-700 sm:text-base">{body.entry.microExample}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold sm:text-xl">Flashcards</h2>
          <div className="grid gap-2 sm:gap-3">
            {body.entry.flashcards.map((card, idx) => (
              <div key={`${card.q}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1 text-sm font-semibold text-slate-900">Q: {card.q}</p>
                <p className="text-sm text-slate-700">A: {card.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold sm:text-xl">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {body.entry.tags.map((tag) => (
              <Badge key={tag} variant="muted">
                {tag}
              </Badge>
            ))}
          </div>
        </section>

        <div className="pt-1">
          <Button href="/notebook">Back to notebook</Button>
        </div>
      </Card>
    </main>
  );
}
