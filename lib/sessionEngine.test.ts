import {
  buildDailySessionPlan,
  chooseUnlockedConceptForToday,
  isUnlockedByPrerequisites,
  UNLOCK_MASTERY_THRESHOLD,
} from "./sessionEngine";
import type { Concept, UserConceptState, UserSettings } from "./types";

function concept(input: Partial<Concept> & Pick<Concept, "id" | "subjectId" | "title" | "slug">): Concept {
  return {
    difficulty: "beginner",
    track: "LLM_APP",
    prerequisiteIds: [],
    ...input,
  };
}

describe("buildDailySessionPlan curriculum ordering", () => {
  it("prefers prerequisite-first order for unseen concepts", () => {
    const subjectId = "subject-1";
    const concepts: Concept[] = [
      concept({
        id: "sampling",
        subjectId,
        title: "Sampling & Generation Behavior",
        slug: "sampling-generation",
        prerequisiteIds: ["tokens"],
      }),
      concept({
        id: "tokens",
        subjectId,
        title: "Tokens & Context",
        slug: "tokens-context",
      }),
    ];

    const settings: UserSettings = {
      userId: "user-1",
      subjectId,
      dailyMinutes: 12,
    };

    const emptyStates: UserConceptState[] = [];
    const plan = buildDailySessionPlan({
      concepts,
      states: emptyStates,
      userSettings: settings,
      date: new Date("2026-02-12T00:00:00.000Z"),
    });

    expect(plan.newConceptId).toBe("tokens");
  });
});

describe("chooseUnlockedConceptForToday", () => {
  it("never selects a locked concept", () => {
    const selected = chooseUnlockedConceptForToday(
      [
        { id: "locked", prerequisiteIds: ["prereq"], createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "open", prerequisiteIds: [], createdAt: "2026-01-02T00:00:00.000Z" },
      ],
      [],
      new Date("2026-02-12T00:00:00.000Z"),
    );

    expect(selected?.conceptId).toBe("open");
    expect(selected?.conceptId).not.toBe("locked");
  });

  it("unlocks once prerequisite mastery reaches threshold", () => {
    const concept = { id: "next", prerequisiteIds: ["base"], createdAt: "2026-01-02T00:00:00.000Z" };
    const locked = isUnlockedByPrerequisites(concept, new Map([["base", UNLOCK_MASTERY_THRESHOLD - 0.01]]));
    const unlocked = isUnlockedByPrerequisites(concept, new Map([["base", UNLOCK_MASTERY_THRESHOLD]]));

    expect(locked).toBe(false);
    expect(unlocked).toBe(true);
  });
});
