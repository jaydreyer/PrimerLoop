import type { Difficulty } from "./types";

export type DueReviewCandidate = {
  conceptId: string;
  nextReviewAt: string | null;
};

export type NewConceptCandidate = {
  conceptId: string;
  createdAt: string | null;
  difficulty: Difficulty | null;
};

export type FallbackCandidate = {
  conceptId: string;
  masteryScore: number;
  nextReviewAt: string | null;
};

export type SessionConceptSelection = {
  conceptId: string;
  source: "due_review" | "new_concept" | "fallback";
};

function toMillis(value: string | null): number {
  if (!value) return Number.NaN;
  return new Date(value).getTime();
}

export function chooseSessionConcept(
  input: {
    dueReviews: DueReviewCandidate[];
    newConcepts: NewConceptCandidate[];
    fallbackConcepts: FallbackCandidate[];
  },
  now = new Date(),
): SessionConceptSelection | null {
  const nowMs = now.getTime();
  const due = [...input.dueReviews]
    .filter((item) => {
      const ts = toMillis(item.nextReviewAt);
      return Number.isFinite(ts) && ts <= nowMs;
    })
    .sort((a, b) => toMillis(a.nextReviewAt) - toMillis(b.nextReviewAt));

  if (due.length > 0) {
    return { conceptId: due[0].conceptId, source: "due_review" };
  }

  const unseen = [...input.newConcepts].sort((a, b) => {
    const aTime = toMillis(a.createdAt);
    const bTime = toMillis(b.createdAt);
    if (!Number.isFinite(aTime) && !Number.isFinite(bTime)) return 0;
    if (!Number.isFinite(aTime)) return 1;
    if (!Number.isFinite(bTime)) return -1;
    return aTime - bTime;
  });

  if (unseen.length > 0) {
    return { conceptId: unseen[0].conceptId, source: "new_concept" };
  }

  const fallback = [...input.fallbackConcepts].sort((a, b) => {
    if (a.masteryScore !== b.masteryScore) {
      return a.masteryScore - b.masteryScore;
    }

    const aTime = toMillis(a.nextReviewAt);
    const bTime = toMillis(b.nextReviewAt);
    const aNull = !Number.isFinite(aTime);
    const bNull = !Number.isFinite(bTime);
    if (aNull && !bNull) return -1;
    if (!aNull && bNull) return 1;
    if (aNull && bNull) return 0;
    return aTime - bTime;
  });

  if (fallback.length > 0) {
    return { conceptId: fallback[0].conceptId, source: "fallback" };
  }

  return null;
}
