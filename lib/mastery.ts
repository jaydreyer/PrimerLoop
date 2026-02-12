import type { MasteryLevel } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

const INTERVAL_DAYS: Record<MasteryLevel, number> = {
  0: 0,
  1: 2,
  2: 5,
  3: 14,
};

export function clampMastery(level: number): MasteryLevel {
  if (level <= 0) return 0;
  if (level >= 3) return 3;
  return level as MasteryLevel;
}

export function nextDueAt(level: MasteryLevel, from = new Date()): Date | null {
  const days = INTERVAL_DAYS[level];
  if (!days) return null;
  return new Date(from.getTime() + days * DAY_MS);
}

export function updateMasteryLevel(current: MasteryLevel, scoreRatio: number): MasteryLevel {
  // Unseen concepts become learning once attempted.
  if (current === 0) return 1;

  if (scoreRatio >= 0.8) return clampMastery(current + 1);
  if (scoreRatio < 0.5) return clampMastery(current - 1);
  return current;
}

export function applyQuizResult(current: MasteryLevel, scoreRatio: number, now = new Date()): {
  masteryLevel: MasteryLevel;
  dueAt: Date | null;
} {
  const masteryLevel = updateMasteryLevel(current, scoreRatio);
  const dueAt = nextDueAt(masteryLevel, now);
  return { masteryLevel, dueAt };
}
