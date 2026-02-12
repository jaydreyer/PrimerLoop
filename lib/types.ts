export type Difficulty = "beginner" | "intermediate" | "advanced";

export type MasteryLevel = 0 | 1 | 2 | 3;

// Track is intentionally open-ended to support future domains.
export type Track = string;

export type TrackWeight = {
  track: Track;
  weight: number;
};

export type Concept = {
  id: string;
  subjectId: string;
  title: string;
  slug: string;
  difficulty: Difficulty;
  track: Track;
  prerequisiteIds: string[];
};

export type UserConceptState = {
  userId: string;
  conceptId: string;
  masteryLevel: MasteryLevel;
  nextDueAt: Date | null;
  seenCount: number;
  updatedAt: Date;
};

export type UserSettings = {
  userId: string;
  subjectId: string;
  dailyMinutes: number;
};

export type QuestionAllocation = {
  conceptId: string;
  questionCount: number;
  kind: "new" | "review";
};

export type DailySessionPlan = {
  date: string;
  newConceptId: string | null;
  reviewConceptIds: string[];
  allocations: QuestionAllocation[];
  totalQuestions: number;
};

export type SessionPlannerConfig = {
  minQuestions: number;
  maxQuestions: number;
  targetQuestions: number;
  maxReviewConcepts: number;
  trackWeights: TrackWeight[];
};

export const DEFAULT_TRACK_WEIGHTS: TrackWeight[] = [
  { track: "LLM_APP", weight: 0.7 },
  { track: "CORE_TECH", weight: 0.3 },
];

export const DEFAULT_SESSION_CONFIG: SessionPlannerConfig = {
  minQuestions: 6,
  maxQuestions: 10,
  targetQuestions: 8,
  maxReviewConcepts: 2,
  trackWeights: DEFAULT_TRACK_WEIGHTS,
};
