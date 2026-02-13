"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

type ConceptStatus = "Locked" | "Available" | "In Review" | "Mastered";

type TodaySession = {
  sessionId: string;
  conceptId: string | null;
  conceptName: string | null;
  track: string | null;
  status: ConceptStatus | null;
  masteryLevel: number;
  needsReset: boolean;
};

type TodayConceptOption = {
  conceptId: string;
  title: string;
  track: string;
  status: ConceptStatus;
  masteryLevel: number;
  unlocked: boolean;
  mastered: boolean;
  prerequisiteTitles: string[];
};

type TodayResponse = {
  session: TodaySession | null;
  concepts: TodayConceptOption[];
  snapshot: {
    streak: number | null;
    sessionsCompleted: number;
    avgMastery: number | null;
  };
  error?: string;
};

type StartResponse = {
  sessionId?: string;
  error?: string;
};

type SetConceptResponse = {
  sessionId?: string;
  error?: string;
};

function statusClasses(status: ConceptStatus | null): string {
  if (status === "Locked") return "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
  if (status === "Available") return "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-300 dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-700";
  if (status === "In Review") return "bg-neutral-300 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100";
  if (status === "Mastered") return "bg-neutral-900 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900";
  return "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
}

function trackLabel(track: string | null): string {
  if (!track) return "FOUNDATIONS";
  return track.toUpperCase();
}

export default function TodayPage() {
  const router = useRouter();
  const autoStartAttemptedRef = useRef(false);

  const [todayData, setTodayData] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [settingConcept, setSettingConcept] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSession = useCallback(async () => {
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
  }, [router]);

  const loadToday = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/session/today", { cache: "no-store", signal });
      const body = (await response.json()) as TodayResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Unable to load today's session");
      }

      setTodayData(body);

      if (!body.session && !autoStartAttemptedRef.current) {
        autoStartAttemptedRef.current = true;
        await startSession();
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [startSession]);

  useEffect(() => {
    const controller = new AbortController();
    loadToday(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadToday]);

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

  async function setConcept(conceptId: string) {
    setSettingConcept(conceptId);
    setError(null);

    try {
      const response = await fetch("/api/session/set-concept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conceptId }),
      });
      const body = (await response.json()) as SetConceptResponse;
      if (!response.ok || !body.sessionId) {
        throw new Error(body.error ?? "Unable to set concept");
      }

      setDrawerOpen(false);
      router.push(`/lesson/${body.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSettingConcept(null);
    }
  }

  const session = todayData?.session ?? null;
  const concepts = todayData?.concepts ?? [];
  const snapshot = todayData?.snapshot ?? { streak: null, sessionsCompleted: 0, avgMastery: null };

  const grouped = {
    available: concepts.filter((concept) => concept.status === "Available"),
    review: concepts.filter((concept) => concept.status === "In Review"),
    mastered: concepts.filter((concept) => concept.status === "Mastered"),
    locked: concepts.filter((concept) => concept.status === "Locked"),
  };

  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-6 bg-neutral-50 px-4 py-8 sm:space-y-8 sm:py-10 dark:bg-neutral-950">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-100">Today</h1>
        <p className="max-w-prose text-sm text-neutral-600 sm:text-base dark:text-neutral-400">
          Your focused daily learning session.
        </p>
      </header>

      {loading ? (
        <Card className="rounded-2xl border-neutral-200 bg-white/80 p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
          <p className="m-0 text-sm text-neutral-700 dark:text-neutral-300">Loading your dashboard...</p>
        </Card>
      ) : null}

      {!loading && error ? <Alert variant="error">{error}</Alert> : null}

      {!loading ? (
        <Card className="space-y-5 rounded-2xl border-neutral-200 bg-neutral-100/70 p-6 shadow-md sm:p-8 dark:border-neutral-800 dark:bg-neutral-900/80">
          <div className="space-y-3">
            <Badge variant="muted">Training Focus</Badge>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">A short session designed to build real understanding.</p>
            <h2 className="text-2xl font-semibold leading-snug text-neutral-900 sm:text-3xl dark:text-neutral-100">
              {session?.conceptName ?? "No session yet"}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">{trackLabel(session?.track ?? null)}</Badge>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses(session?.status ?? null)}`}
              >
                {session?.status ?? "Available"}
              </span>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">Mastery: {session?.masteryLevel ?? 0} / 4</span>
            </div>
          </div>

          {session?.needsReset ? (
            <Button type="button" onClick={resetToday} disabled={resetting} className="w-full sm:w-auto">
              {resetting ? "Resetting..." : "Reset today"}
            </Button>
          ) : session ? (
            <Button href={`/lesson/${session.sessionId}`} className="w-full sm:w-auto">
              Continue
            </Button>
          ) : (
            <Button type="button" onClick={startSession} disabled={starting} className="w-full sm:w-auto">
              {starting ? "Starting..." : "Start today's training"}
            </Button>
          )}

          <button
            type="button"
            className="text-left text-sm font-medium text-neutral-600 underline underline-offset-2 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            onClick={() => setDrawerOpen(true)}
          >
            Browse curriculum
          </button>
        </Card>
      ) : null}

      {!loading ? (
        <Card className="space-y-4 rounded-2xl border-neutral-200 bg-white/70 p-5 shadow-sm sm:p-6 dark:border-neutral-800 dark:bg-neutral-900/60">
          <Badge variant="muted">Progress Snapshot</Badge>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Streak</p>
              <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{snapshot.streak ?? "—"}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Consecutive training days</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Sessions</p>
              <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{snapshot.sessionsCompleted}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Completed sessions</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Avg mastery</p>
              <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{snapshot.avgMastery ?? "—"}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Across current curriculum</p>
            </div>
          </div>
        </Card>
      ) : null}

      {drawerOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close concept drawer"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border border-neutral-200 bg-neutral-50 p-4 shadow-xl dark:border-neutral-800 dark:bg-neutral-900 sm:bottom-auto sm:left-auto sm:right-0 sm:top-0 sm:h-full sm:w-[420px] sm:rounded-none">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Browse curriculum</h3>
              <button
                type="button"
                className="text-sm text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                onClick={() => setDrawerOpen(false)}
              >
                Close
              </button>
            </div>

            {[
              { key: "available", label: "Available", items: grouped.available },
              { key: "review", label: "In Review", items: grouped.review },
              { key: "mastered", label: "Mastered", items: grouped.mastered },
              { key: "locked", label: "Locked", items: grouped.locked },
            ].map((group) => (
              <section key={group.key} className="mb-4 space-y-2">
                <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{group.label}</h4>
                <div className="grid gap-2">
                  {group.items.length === 0 ? (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">No concepts.</p>
                  ) : (
                    group.items.map((concept) => {
                      const selectable = concept.status === "Available" || concept.status === "Mastered";
                      return (
                        <button
                          key={concept.conceptId}
                          type="button"
                          disabled={!selectable || settingConcept === concept.conceptId}
                          onClick={() => setConcept(concept.conceptId)}
                          className="w-full rounded-xl border border-neutral-200 bg-white p-3 text-left shadow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900"
                        >
                          <div className="mb-1 flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{concept.title}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClasses(concept.status)}`}>
                              {concept.status}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-600 dark:text-neutral-400">
                            {trackLabel(concept.track)} · Mastery {concept.masteryLevel}/4
                          </p>
                          {concept.status === "Locked" && concept.prerequisiteTitles.length > 0 ? (
                            <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                              Requires: {concept.prerequisiteTitles.join(", ")}
                            </p>
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>
              </section>
            ))}
          </aside>
        </div>
      ) : null}
    </main>
  );
}
