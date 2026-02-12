"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

type TodaySession = {
  sessionId: string;
  conceptName: string | null;
};

type TodayResponse = {
  session: TodaySession | null;
  error?: string;
};

type StartResponse = {
  sessionId?: string;
  error?: string;
};

export default function TodayPage() {
  const router = useRouter();
  const [session, setSession] = useState<TodaySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadToday() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/session/today", { cache: "no-store" });
        const body = (await response.json()) as TodayResponse;

        if (!response.ok) {
          throw new Error(body.error ?? "Unable to load today's session");
        }

        if (active) {
          setSession(body.session ?? null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadToday();
    return () => {
      active = false;
    };
  }, []);

  async function startSession() {
    setStarting(true);
    setError(null);

    try {
      const response = await fetch("/api/session/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const body = (await response.json()) as StartResponse;

      if (!response.ok || !body.sessionId) {
        throw new Error(body.error ?? "Unable to start today's session");
      }

      router.push(`/lesson/${body.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStarting(false);
    }
  }

  return (
    <main className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Today</h1>
        <p className="max-w-prose text-sm text-slate-600 sm:text-base">
          Your focused daily learning session.
        </p>
      </header>

      {loading ? (
        <Card>
          <p className="m-0 text-sm text-slate-700">Loading your session...</p>
        </Card>
      ) : null}

      {!loading && error ? (
        <Alert variant="error">{error}</Alert>
      ) : null}

      {!loading && !error && session ? (
        <Card className="space-y-4">
          <Badge variant="muted">Today&apos;s Concept</Badge>
          <h2 className="text-xl font-semibold leading-snug sm:text-2xl">
            {session.conceptName ?? "Concept will appear once content is generated"}
          </h2>
          <div>
            <Button href={`/lesson/${session.sessionId}`}>Continue</Button>
          </div>
        </Card>
      ) : null}

      {!loading && !error && !session ? (
        <Button type="button" onClick={startSession} disabled={starting}>
          {starting ? "Starting..." : "Start today's session"}
        </Button>
      ) : null}
    </main>
  );
}
