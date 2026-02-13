/** @vitest-environment node */

const { createSupabaseUserServerMock } = vi.hoisted(() => ({
  createSupabaseUserServerMock: vi.fn(),
}));

vi.mock("../../../../lib/supabaseUserServer", () => ({
  createSupabaseUserServer: createSupabaseUserServerMock,
}));

import { POST } from "./route";

const LOCKED_CONCEPT_ID = "11111111-1111-4111-8111-111111111111";
const MASTERED_CONCEPT_ID = "22222222-2222-4222-8222-222222222222";
const PREREQ_CONCEPT_ID = "33333333-3333-4333-8333-333333333333";

function makeRequest(conceptId: string) {
  return new Request("http://localhost/api/session/set-concept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ conceptId }),
  });
}

function buildSupabase(config: {
  user: { id: string } | null;
  selectedConcept?: { id: string; subject_id: string; difficulty: "beginner" | "intermediate" | "advanced" | null } | null;
  masteryRows?: Array<{ concept_id: string; mastery_score: number; next_review_at: string | null }>;
}) {
  const selectedConcept =
    config.selectedConcept ?? { id: LOCKED_CONCEPT_ID, subject_id: "subject-1", difficulty: "beginner" as const };
  const masteryRows = config.masteryRows ?? [];
  const updateSession = vi.fn(async () => ({ error: null }));
  const upsertSessionConcept = vi.fn(async () => ({ error: null }));

  return {
    __updateSession: updateSession,
    __upsertSessionConcept: upsertSessionConcept,
    auth: {
      getUser: vi.fn(async () => ({ data: { user: config.user } })),
    },
    from: vi.fn((table: string) => {
      if (table === "concepts") {
        const byIdChain = {
          eq: vi.fn(() => byIdChain),
          maybeSingle: vi.fn(async () => ({ data: selectedConcept, error: null })),
        };
        const subjectChain = {
          eq: vi.fn(() => subjectChain),
          order: vi.fn(() => subjectChain),
          then: (resolve: (value: unknown) => unknown) =>
            resolve({
              data: [
                {
                  id: LOCKED_CONCEPT_ID,
                  title: "Locked",
                  track: "LLM_APP",
                  created_at: "2026-01-01T00:00:00.000Z",
                },
                {
                  id: MASTERED_CONCEPT_ID,
                  title: "Mastered",
                  track: "LLM_APP",
                  created_at: "2026-01-02T00:00:00.000Z",
                },
                {
                  id: PREREQ_CONCEPT_ID,
                  title: "Prereq",
                  track: "LLM_APP",
                  created_at: "2025-12-01T00:00:00.000Z",
                },
              ],
              error: null,
            }),
        };
        return {
          select: vi.fn((columns?: string) => {
            if (columns?.includes("difficulty")) {
              return byIdChain;
            }
            return subjectChain;
          }),
        };
      }

      if (table === "user_settings") {
        const chain = {
          eq: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => ({ data: { subject_id: "subject-1" }, error: null })),
        };
        return { select: vi.fn(() => chain) };
      }

      if (table === "subjects") {
        const chain = {
          order: vi.fn(() => chain),
          limit: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => ({ data: { id: "subject-1" }, error: null })),
        };
        return { select: vi.fn(() => chain) };
      }

      if (table === "concept_prerequisites") {
        const chain = {
          in: vi.fn(async () => ({
            data: [{ concept_id: LOCKED_CONCEPT_ID, prerequisite_concept_id: PREREQ_CONCEPT_ID }],
            error: null,
          })),
        };
        return { select: vi.fn(() => chain) };
      }

      if (table === "user_concept_mastery") {
        const chain = {
          eq: vi.fn(() => chain),
          then: (resolve: (value: unknown) => unknown) => resolve({ data: masteryRows, error: null }),
        };
        return { select: vi.fn(() => chain) };
      }

      if (table === "sessions") {
        const selectChain = {
          eq: vi.fn(() => selectChain),
          order: vi.fn(() => selectChain),
          limit: vi.fn(() => selectChain),
          maybeSingle: vi.fn(async () => ({ data: { id: "session-1" }, error: null })),
        };
        return {
          select: vi.fn(() => selectChain),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: updateSession,
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id: "session-created" }, error: null })),
            })),
          })),
        };
      }

      if (table === "session_concepts") {
        return {
          upsert: upsertSessionConcept,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe("POST /api/session/set-concept", () => {
  beforeEach(() => {
    createSupabaseUserServerMock.mockReset();
  });

  it("rejects locked concept selection", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase({
        user: { id: "user-1" },
        selectedConcept: { id: LOCKED_CONCEPT_ID, subject_id: "subject-1", difficulty: "beginner" },
        masteryRows: [],
      }),
    );

    const response = await POST(makeRequest(LOCKED_CONCEPT_ID));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toMatch(/locked/i);
  });

  it("allows mastered concept selection", async () => {
    const supabase = buildSupabase({
      user: { id: "user-1" },
      selectedConcept: { id: MASTERED_CONCEPT_ID, subject_id: "subject-1", difficulty: "beginner" },
      masteryRows: [{ concept_id: MASTERED_CONCEPT_ID, mastery_score: 4, next_review_at: null }],
    });
    createSupabaseUserServerMock.mockResolvedValue(supabase);

    const response = await POST(makeRequest(MASTERED_CONCEPT_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sessionId).toBe("session-1");
    expect(supabase.__updateSession).toHaveBeenCalled();
    expect(supabase.__upsertSessionConcept).toHaveBeenCalled();
  });
});
