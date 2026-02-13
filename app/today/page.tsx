"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Container } from "../../components/ui/Container";
import { Pill } from "../../components/ui/Pill";

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

function trackLabel(track: string | null): string {
  if (!track) return "FOUNDATIONS";
  return track.toUpperCase();
}

function statusTone(status: ConceptStatus): string {
  if (status === "Mastered") return "text-emerald-300";
  if (status === "In Review") return "text-amber-300";
  if (status === "Locked") return "text-[var(--muted2)]";
  return "text-[var(--text)]";
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
    <Container className="space-y-8 pt-8 pb-12">
      <header className="space-y-2">
        <h1 className="text-[40px] font-semibold leading-tight tracking-tight text-[var(--text)]">Today</h1>
        <p className="text-base leading-6 text-[var(--muted)]">Your focused daily learning session.</p>
      </header>

      {loading ? (
        <Card variant="panel">
          <p className="m-0 text-sm text-[var(--muted)]">Loading your dashboard...</p>
        </Card>
      ) : null}

      {!loading && error ? <Alert variant="error">{error}</Alert> : null}

      {!loading ? (
        <Card variant="hero" className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-medium text-[var(--muted)]">Training Focus</p>
            <h2 className="text-2xl font-semibold leading-tight text-[var(--text)] sm:text-[28px]">
              {session?.conceptName ?? "No session yet"}
            </h2>
            <p className="text-sm leading-6 text-[var(--muted)]">
              {trackLabel(session?.track ?? null)} · {session?.status ?? "Available"} · Mastery {session?.masteryLevel ?? 0}/4
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--muted2)]">Session steps</p>
            <p className="text-sm leading-6 text-[var(--muted2)]">
              <span className="font-medium text-[var(--accent)]">Lesson</span>
              <span className="mx-2">—</span>
              <span>Quiz</span>
              <span className="mx-2">—</span>
              <span>Notebook</span>
              <span className="mx-2">—</span>
              <span>Done</span>
            </p>
          </div>

          {session?.needsReset ? (
            <Button type="button" onClick={resetToday} disabled={resetting}>
              {resetting ? "Resetting..." : "Reset today"}
            </Button>
          ) : session ? (
            <Button href={`/lesson/${session.sessionId}`}>Continue</Button>
          ) : (
            <Button type="button" onClick={startSession} disabled={starting}>
              {starting ? "Starting..." : "Start today's training"}
            </Button>
          )}

          <button
            type="button"
            className="w-fit text-sm font-medium text-[var(--muted)] hover:text-[var(--text)]"
            onClick={() => setDrawerOpen(true)}
          >
            Browse curriculum
          </button>
        </Card>
      ) : null}

      <Card variant="panel">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted2)]">Streak</p>
            <p className="text-xl font-semibold leading-tight text-[var(--text)]">{snapshot.streak ?? "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted2)]">Sessions</p>
            <p className="text-xl font-semibold leading-tight text-[var(--text)]">{snapshot.sessionsCompleted}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted2)]">Avg mastery</p>
            <p className="text-xl font-semibold leading-tight text-[var(--text)]">{snapshot.avgMastery ?? "—"}</p>
          </div>
        </div>
      </Card>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close concept drawer"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--surface-1)] p-4 sm:bottom-auto sm:left-auto sm:right-0 sm:top-0 sm:h-full sm:w-[420px] sm:rounded-none sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-[var(--text)]">Browse curriculum</h3>
              <button
                type="button"
                className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
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
              <section key={group.key} className="mb-6 space-y-2">
                <h4 className="text-sm font-medium text-[var(--muted)]">{group.label}</h4>
                <div className="grid gap-3">
                  {group.items.length === 0 ? (
                    <p className="text-xs text-[var(--muted2)]">No concepts.</p>
                  ) : (
                    group.items.map((concept) => {
                      const selectable = concept.status === "Available" || concept.status === "Mastered";
                      return (
                        <button
                          key={concept.conceptId}
                          type="button"
                          disabled={!selectable || settingConcept === concept.conceptId}
                          onClick={() => setConcept(concept.conceptId)}
                          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-left disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <p className="text-base font-medium leading-6 text-[var(--text)]">{concept.title}</p>
                            <Pill variant="status" className={statusTone(concept.status)}>
                              {concept.status}
                            </Pill>
                          </div>
                          <p className="text-sm text-[var(--muted)]">
                            {trackLabel(concept.track)} · Mastery {concept.masteryLevel}/4
                          </p>
                          {concept.status === "Locked" && concept.prerequisiteTitles.length > 0 ? (
                            <p className="mt-1 text-sm text-[var(--muted2)]">
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
    </Container>
  );
}
