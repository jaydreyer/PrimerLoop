import { chooseSessionConcept } from "./sessionSelection";

describe("chooseSessionConcept", () => {
  it("prefers due review concepts first", () => {
    const picked = chooseSessionConcept(
      {
        dueReviews: [
          { conceptId: "c2", nextReviewAt: "2026-02-11T00:00:00.000Z" },
          { conceptId: "c1", nextReviewAt: "2026-02-10T00:00:00.000Z" },
        ],
        newConcepts: [{ conceptId: "n1", createdAt: "2026-01-01T00:00:00.000Z", difficulty: "beginner" }],
        fallbackConcepts: [{ conceptId: "f1", masteryScore: 0.1, nextReviewAt: null }],
      },
      new Date("2026-02-12T00:00:00.000Z"),
    );

    expect(picked).toEqual({ conceptId: "c1", source: "due_review" });
  });

  it("picks oldest unseen concept when no due review exists", () => {
    const picked = chooseSessionConcept(
      {
        dueReviews: [{ conceptId: "c-future", nextReviewAt: "2026-02-13T00:00:00.000Z" }],
        newConcepts: [
          { conceptId: "n2", createdAt: "2026-01-03T00:00:00.000Z", difficulty: "beginner" },
          { conceptId: "n1", createdAt: "2026-01-01T00:00:00.000Z", difficulty: "intermediate" },
        ],
        fallbackConcepts: [{ conceptId: "f1", masteryScore: 0.1, nextReviewAt: null }],
      },
      new Date("2026-02-12T00:00:00.000Z"),
    );

    expect(picked).toEqual({ conceptId: "n1", source: "new_concept" });
  });

  it("falls back to lowest mastery, then earliest next_review_at with nulls first", () => {
    const picked = chooseSessionConcept(
      {
        dueReviews: [],
        newConcepts: [],
        fallbackConcepts: [
          { conceptId: "f2", masteryScore: 0.2, nextReviewAt: "2026-02-20T00:00:00.000Z" },
          { conceptId: "f1", masteryScore: 0.1, nextReviewAt: "2026-02-19T00:00:00.000Z" },
          { conceptId: "f0", masteryScore: 0.1, nextReviewAt: null },
        ],
      },
      new Date("2026-02-12T00:00:00.000Z"),
    );

    expect(picked).toEqual({ conceptId: "f0", source: "fallback" });
  });
});
