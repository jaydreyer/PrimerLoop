"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 20 }}>
      <h1 style={{ marginBottom: 8 }}>Today</h1>
      <p style={{ marginTop: 0, color: "#444" }}>Your focused daily learning session.</p>

      {loading ? (
        <section
          style={{
            border: "1px solid #e6e6e6",
            borderRadius: 12,
            padding: 16,
            background: "#fff",
          }}
        >
          <p style={{ margin: 0 }}>Loading your session...</p>
        </section>
      ) : null}

      {!loading && error ? (
        <section
          style={{
            border: "1px solid #f2caca",
            borderRadius: 12,
            padding: 16,
            background: "#fff7f7",
            marginBottom: 12,
          }}
        >
          <p style={{ margin: 0, color: "#9f1d1d" }}>{error}</p>
        </section>
      ) : null}

      {!loading && !error && session ? (
        <section
          style={{
            border: "1px solid #e6e6e6",
            borderRadius: 12,
            padding: 16,
            background: "#fff",
          }}
        >
          <p style={{ margin: 0, color: "#666", fontSize: 14 }}>Today&apos;s Concept</p>
          <h2 style={{ marginTop: 8, marginBottom: 16, fontSize: 20 }}>
            {session.conceptName ?? "Concept will appear once content is generated"}
          </h2>
          <Link
            href={`/lesson/${session.sessionId}`}
            style={{
              display: "inline-block",
              background: "#111",
              color: "#fff",
              padding: "10px 14px",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            Continue
          </Link>
        </section>
      ) : null}

      {!loading && !error && !session ? (
        <button
          type="button"
          onClick={startSession}
          disabled={starting}
          style={{
            border: 0,
            background: starting ? "#6b7280" : "#111",
            color: "#fff",
            padding: "12px 16px",
            borderRadius: 10,
            cursor: starting ? "not-allowed" : "pointer",
            fontSize: 15,
          }}
        >
          {starting ? "Starting..." : "Start today's session"}
        </button>
      ) : null}
    </main>
  );
}
