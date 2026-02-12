import {
  DEFAULT_SESSION_CONFIG,
  type Concept,
  type DailySessionPlan,
  type SessionPlannerConfig,
  type UserConceptState,
  type UserSettings,
} from "./types";

export const UNLOCK_MASTERY_THRESHOLD = 3;
export const MASTERED_MASTERY_THRESHOLD = 4;

type PlannerInput = {
  concepts: Concept[];
  states: UserConceptState[];
  userSettings: UserSettings;
  date?: Date;
  config?: Partial<SessionPlannerConfig>;
};

export type CurriculumConcept = {
  id: string;
  prerequisiteIds: string[];
  createdAt?: string | null;
};

export type CurriculumMastery = {
  conceptId: string;
  masteryScore: number;
  nextReviewAt: string | null;
};

export type CurriculumSelection = {
  conceptId: string;
  source: "due_review" | "fallback" | "new_concept";
};

function mergeConfig(config?: Partial<SessionPlannerConfig>): SessionPlannerConfig {
  return { ...DEFAULT_SESSION_CONFIG, ...config };
}

function chooseTrackByWeight(date: Date, config: SessionPlannerConfig): string | null {
  const total = config.trackWeights.reduce((sum, item) => sum + item.weight, 0);
  if (!total) return null;

  const daySeed = Number(date.toISOString().slice(0, 10).replace(/-/g, ""));
  const pick = (daySeed % 1000) / 1000;

  let running = 0;
  for (const item of config.trackWeights) {
    running += item.weight / total;
    if (pick <= running) return item.track;
  }

  return config.trackWeights[config.trackWeights.length - 1]?.track ?? null;
}

function prerequisitesSatisfied(concept: Concept, stateByConceptId: Map<string, UserConceptState>): boolean {
  return concept.prerequisiteIds.every((id) => {
    const state = stateByConceptId.get(id);
    return !!state && state.masteryLevel >= UNLOCK_MASTERY_THRESHOLD;
  });
}

function sortByCurriculumOrder<T extends { id: string; prerequisiteIds: string[] }>(concepts: T[]): T[] {
  const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));
  const originalIndex = new Map(concepts.map((concept, index) => [concept.id, index]));
  const indegree = new Map<string, number>();
  const outbound = new Map<string, string[]>();

  for (const concept of concepts) {
    indegree.set(concept.id, 0);
    outbound.set(concept.id, []);
  }

  for (const concept of concepts) {
    for (const prerequisiteId of concept.prerequisiteIds) {
      if (!conceptById.has(prerequisiteId)) continue;
      indegree.set(concept.id, (indegree.get(concept.id) ?? 0) + 1);
      outbound.get(prerequisiteId)?.push(concept.id);
    }
  }

  const zeroQueue = concepts
    .filter((concept) => (indegree.get(concept.id) ?? 0) === 0)
    .sort((a, b) => (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0))
    .map((concept) => concept.id);

  const sortedIds: string[] = [];

  while (zeroQueue.length > 0) {
    const conceptId = zeroQueue.shift();
    if (!conceptId) break;
    sortedIds.push(conceptId);

    const neighbors = [...(outbound.get(conceptId) ?? [])].sort(
      (a, b) => (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0),
    );
    for (const nextId of neighbors) {
      const nextDegree = (indegree.get(nextId) ?? 0) - 1;
      indegree.set(nextId, nextDegree);
      if (nextDegree === 0) {
        zeroQueue.push(nextId);
        zeroQueue.sort((a, b) => (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0));
      }
    }
  }

  // If there is a cycle/bad data, preserve deterministic fallback based on input order.
  if (sortedIds.length !== concepts.length) {
    const sortedSet = new Set(sortedIds);
    const remaining = concepts
      .filter((concept) => !sortedSet.has(concept.id))
      .sort((a, b) => (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0))
      .map((concept) => concept.id);
    sortedIds.push(...remaining);
  }

  return sortedIds.map((id) => conceptById.get(id)).filter((concept): concept is T => Boolean(concept));
}

export function isUnlockedByPrerequisites(
  concept: { prerequisiteIds: string[] },
  masteryByConceptId: ReadonlyMap<string, number>,
): boolean {
  if (concept.prerequisiteIds.length === 0) return true;
  return concept.prerequisiteIds.every((prerequisiteId) => {
    const score = masteryByConceptId.get(prerequisiteId);
    return typeof score === "number" && score >= UNLOCK_MASTERY_THRESHOLD;
  });
}

export function chooseUnlockedConceptForToday(
  concepts: CurriculumConcept[],
  masteryRows: CurriculumMastery[],
  now = new Date(),
): CurriculumSelection | null {
  const orderedConcepts = sortByCurriculumOrder(concepts);
  const orderedIndexById = new Map(orderedConcepts.map((concept, idx) => [concept.id, idx]));
  const masteryByConceptId = new Map(masteryRows.map((row) => [row.conceptId, row.masteryScore]));
  const masteryRowByConceptId = new Map(masteryRows.map((row) => [row.conceptId, row]));
  const unlockedConcepts = orderedConcepts.filter((concept) =>
    isUnlockedByPrerequisites(concept, masteryByConceptId),
  );

  if (unlockedConcepts.length === 0) {
    return null;
  }

  const nowMs = now.getTime();
  const dueReviews = unlockedConcepts
    .map((concept) => ({ concept, mastery: masteryRowByConceptId.get(concept.id) ?? null }))
    .filter((entry) => {
      const nextReviewAt = entry.mastery?.nextReviewAt;
      if (!nextReviewAt) return false;
      const ts = new Date(nextReviewAt).getTime();
      return Number.isFinite(ts) && ts <= nowMs;
    })
    .sort((a, b) => {
      const aTs = new Date(a.mastery?.nextReviewAt ?? "").getTime();
      const bTs = new Date(b.mastery?.nextReviewAt ?? "").getTime();
      if (aTs !== bTs) return aTs - bTs;

      const aScore = a.mastery?.masteryScore ?? Number.POSITIVE_INFINITY;
      const bScore = b.mastery?.masteryScore ?? Number.POSITIVE_INFINITY;
      if (aScore !== bScore) return aScore - bScore;

      return (orderedIndexById.get(a.concept.id) ?? 0) - (orderedIndexById.get(b.concept.id) ?? 0);
    });

  if (dueReviews.length > 0) {
    return { conceptId: dueReviews[0].concept.id, source: "due_review" };
  }

  const unlockedSeen = unlockedConcepts
    .map((concept) => ({ concept, mastery: masteryRowByConceptId.get(concept.id) ?? null }))
    .filter((entry) => entry.mastery !== null)
    .sort((a, b) => {
      const aScore = a.mastery?.masteryScore ?? Number.POSITIVE_INFINITY;
      const bScore = b.mastery?.masteryScore ?? Number.POSITIVE_INFINITY;
      if (aScore !== bScore) return aScore - bScore;

      const aTs = a.mastery?.nextReviewAt ? new Date(a.mastery.nextReviewAt).getTime() : Number.NaN;
      const bTs = b.mastery?.nextReviewAt ? new Date(b.mastery.nextReviewAt).getTime() : Number.NaN;
      const aFinite = Number.isFinite(aTs);
      const bFinite = Number.isFinite(bTs);
      if (aFinite && bFinite && aTs !== bTs) return aTs - bTs;
      if (aFinite !== bFinite) return aFinite ? 1 : -1;

      return (orderedIndexById.get(a.concept.id) ?? 0) - (orderedIndexById.get(b.concept.id) ?? 0);
    });

  if (unlockedSeen.length > 0) {
    return { conceptId: unlockedSeen[0].concept.id, source: "fallback" };
  }

  const unlockedUnseen = unlockedConcepts.filter((concept) => !masteryByConceptId.has(concept.id));
  if (unlockedUnseen.length > 0) {
    return { conceptId: unlockedUnseen[0].id, source: "new_concept" };
  }

  return null;
}

export function buildDailySessionPlan(input: PlannerInput): DailySessionPlan {
  const date = input.date ?? new Date();
  const config = mergeConfig(input.config);
  const stateByConceptId = new Map(input.states.map((s) => [s.conceptId, s]));
  const subjectConcepts = sortByCurriculumOrder(
    input.concepts.filter((c) => c.subjectId === input.userSettings.subjectId),
  );
  const subjectConceptIds = new Set(subjectConcepts.map((c) => c.id));

  const dueReviews = input.states
    .filter((s) => s.masteryLevel > 0 && s.nextDueAt && s.nextDueAt <= date)
    .filter((s) => subjectConceptIds.has(s.conceptId))
    .sort((a, b) => {
      const aTime = a.nextDueAt ? a.nextDueAt.getTime() : 0;
      const bTime = b.nextDueAt ? b.nextDueAt.getTime() : 0;
      return aTime - bTime;
    })
    .slice(0, config.maxReviewConcepts)
    .map((s) => s.conceptId);

  const unseenEligible = subjectConcepts.filter((c) => {
    const state = stateByConceptId.get(c.id);
    const unseen = !state || state.masteryLevel === 0;
    return unseen && prerequisitesSatisfied(c, stateByConceptId);
  });

  const preferredTrack = chooseTrackByWeight(date, config);
  const newConcept =
    unseenEligible.find((c) => c.track === preferredTrack) ?? unseenEligible[0] ?? null;

  const totalQuestions = Math.max(config.minQuestions, Math.min(config.targetQuestions, config.maxQuestions));
  const allocations: DailySessionPlan["allocations"] = [];

  if (newConcept) {
    const newCount = Math.max(4, totalQuestions - dueReviews.length * 2);
    allocations.push({ conceptId: newConcept.id, questionCount: newCount, kind: "new" });

    const remaining = totalQuestions - newCount;
    if (remaining > 0 && dueReviews.length > 0) {
      const perReview = Math.max(1, Math.floor(remaining / dueReviews.length));
      for (const conceptId of dueReviews) {
        allocations.push({ conceptId, questionCount: perReview, kind: "review" });
      }
    }
  } else {
    const perReview = dueReviews.length ? Math.max(1, Math.floor(totalQuestions / dueReviews.length)) : 0;
    for (const conceptId of dueReviews) {
      allocations.push({ conceptId, questionCount: perReview, kind: "review" });
    }
  }

  return {
    date: date.toISOString().slice(0, 10),
    newConceptId: newConcept?.id ?? null,
    reviewConceptIds: dueReviews,
    allocations,
    totalQuestions,
  };
}
