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
  needsReset?: boolean;
};

type TodayResponse = {
  session: TodaySession | null;
  error?: string;
};

type SettingsResponse = {
  settings: {
    subjectId: string;
    dailyMinutes: number;
  } | null;
  error?: string;
};

type StartResponse = {
  sessionId?: string;
  error?: string;
};

export default function TodayPage() {
  const router = useRouter();
  const [session, setSession] = useState<TodaySession | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [selectedSubjectSlug, setSelectedSubjectSlug] = useState("ai-llm-systems");
  const [dailyMinutes, setDailyMinutes] = useState(15);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadToday(signal?: AbortSignal) {
    setLoading(true);
    setError(null);

    try {
      const settingsResponse = await fetch("/api/settings", { cache: "no-store", signal });
      const settingsBody = (await settingsResponse.json()) as SettingsResponse;
      if (!settingsResponse.ok) {
        throw new Error(settingsBody.error ?? "Unable to load settings");
      }

      setIsNewUser(!settingsBody.settings);
      if (settingsBody.settings) {
        setDailyMinutes(settingsBody.settings.dailyMinutes);
      }

      const response = await fetch("/api/session/today", { cache: "no-store", signal });
      const body = (await response.json()) as TodayResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Unable to load today's session");
      }

      setSession(body.session ?? null);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    loadToday(controller.signal);
    return () => {
      controller.abort();
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

  async function saveSettingsAndStart() {
    setStarting(true);
    setError(null);

    try {
      const settingsResponse = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subjectSlug: selectedSubjectSlug,
          dailyMinutes,
        }),
      });
      const settingsBody = (await settingsResponse.json()) as SettingsResponse;
      if (!settingsResponse.ok) {
        throw new Error(settingsBody.error ?? "Unable to save settings");
      }

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

  async function resetToday() {
    setResetting(true);
    setError(null);

    try {
      const response = await fetch("/api/session/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to reset today's session");
      }

      await loadToday();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setResetting(false);
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

      {!loading && error ? <Alert variant="error">{error}</Alert> : null}

      {!loading && !error && session ? (
        <Card className="space-y-4">
          <Badge variant="muted">Today&apos;s Concept</Badge>
          {session.needsReset ? (
            <>
              <p className="m-0 text-sm text-slate-700">
                Today&apos;s session data looks incomplete. Reset and we&apos;ll start a clean session.
              </p>
              <div>
                <Button type="button" onClick={resetToday} disabled={resetting}>
                  {resetting ? "Resetting..." : "Reset today"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold leading-snug sm:text-2xl">{session.conceptName ?? "Lesson"}</h2>
              <div>
                <Button href={`/lesson/${session.sessionId}`}>Continue</Button>
              </div>
            </>
          )}
        </Card>
      ) : null}

      {!loading && !error && !session && isNewUser ? (
        <Card className="space-y-4">
          <Badge variant="muted">First run setup</Badge>
          <p className="m-0 text-sm text-slate-700">Pick your starting settings, then begin today&apos;s lesson.</p>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-800">Subject</span>
            <select
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              value={selectedSubjectSlug}
              onChange={(event) => setSelectedSubjectSlug(event.target.value)}
            >
              <option value="ai-llm-systems">AI &amp; LLM Systems</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-800">Daily minutes</span>
            <select
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              value={dailyMinutes}
              onChange={(event) => setDailyMinutes(Number(event.target.value))}
            >
              {[10, 11, 12, 13, 14, 15].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes}
                </option>
              ))}
            </select>
          </label>

          <Button type="button" onClick={saveSettingsAndStart} disabled={starting}>
            {starting ? "Starting..." : "Save and start"}
          </Button>
        </Card>
      ) : null}

      {!loading && !error && !session && !isNewUser ? (
        <Button type="button" onClick={startSession} disabled={starting}>
          {starting ? "Starting..." : "Start today's session"}
        </Button>
      ) : null}
    </main>
  );
}
