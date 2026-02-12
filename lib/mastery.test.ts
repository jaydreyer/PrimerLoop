import { blendedMasteryScore, nextReviewAtFromPercent } from "./mastery";

describe("mastery helpers", () => {
  it("computes blended mastery deterministically", () => {
    expect(blendedMasteryScore(0.8, 50)).toBe(0.71);
    expect(blendedMasteryScore(0.2, 90)).toBe(0.41);
  });

  it("computes next review intervals from percentage thresholds", () => {
    const now = new Date("2026-02-12T00:00:00.000Z");

    expect(nextReviewAtFromPercent(90, now).toISOString()).toBe("2026-02-26T00:00:00.000Z");
    expect(nextReviewAtFromPercent(70, now).toISOString()).toBe("2026-02-19T00:00:00.000Z");
    expect(nextReviewAtFromPercent(50, now).toISOString()).toBe("2026-02-15T00:00:00.000Z");
    expect(nextReviewAtFromPercent(49.99, now).toISOString()).toBe("2026-02-13T00:00:00.000Z");
  });
});
