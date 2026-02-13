/** @vitest-environment node */

const { createSupabaseUserServerMock } = vi.hoisted(() => ({
  createSupabaseUserServerMock: vi.fn(),
}));

vi.mock("../../../../lib/supabaseUserServer", () => ({
  createSupabaseUserServer: createSupabaseUserServerMock,
}));

import { GET } from "./route";

type SessionRow = {
  id: string;
  concept_id: string | null;
  subject_id: string | null;
  difficulty: string | null;
};

function buildSupabase(config: {
  user: { id: string } | null;
  session?: { data: SessionRow | null; error: { message: string } | null };
}) {
  const session = config.session ?? { data: null, error: null };

  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: config.user } })),
    },
    from: vi.fn((table: string) => {
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

      if (table === "concepts") {
        const chain = {
          eq: vi.fn(() => chain),
          order: vi.fn(() => chain),
          then: (resolve: (value: unknown) => unknown) =>
            resolve({
              data: [
                { id: "concept-1", title: "Tokens & Context", track: "LLM_APP", created_at: "2026-01-01T00:00:00.000Z" },
              ],
              error: null,
            }),
        };
        return { select: vi.fn(() => chain) };
      }

      if (table === "concept_prerequisites") {
        const chain = {
          in: vi.fn(async () => ({ data: [], error: null })),
        };
        return { select: vi.fn(() => chain) };
      }

      if (table === "user_concept_mastery") {
        const chain = {
          eq: vi.fn(() => chain),
          then: (resolve: (value: unknown) => unknown) =>
            resolve({ data: [{ concept_id: "concept-1", mastery_score: 2, next_review_at: null }], error: null }),
        };
        return { select: vi.fn(() => chain) };
      }

      if (table === "sessions") {
        const selectChain = {
          eq: vi.fn(() => selectChain),
          order: vi.fn(() => selectChain),
          limit: vi.fn(() => selectChain),
          maybeSingle: vi.fn(async () => session),
        };
        return {
          select: vi.fn((_columns?: string, options?: { head?: boolean; count?: string }) => {
            if (options?.head) {
              return {
                eq: vi.fn(() => ({ eq: vi.fn(async () => ({ count: 5 })) })),
              };
            }
            return selectChain;
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe("GET /api/session/today", () => {
  beforeEach(() => {
    createSupabaseUserServerMock.mockReset();
  });

  it("returns 401 without auth cookie/session", async () => {
    createSupabaseUserServerMock.mockResolvedValue(buildSupabase({ user: null }));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns null session when user has no active session", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase({ user: { id: "user-1" }, session: { data: null, error: null } }),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.session).toBeNull();
    expect(body.snapshot.sessionsCompleted).toBe(5);
  });

  it("returns active session details", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase({
        user: { id: "user-1" },
        session: {
          data: { id: "session-1", concept_id: "concept-1", subject_id: "subject-1", difficulty: "beginner" },
          error: null,
        },
      }),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.session.sessionId).toBe("session-1");
    expect(body.session.conceptName).toBe("Tokens & Context");
  });

  it("returns reset-needed session when metadata is incomplete", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase({
        user: { id: "user-1" },
        session: {
          data: { id: "session-1", concept_id: null, subject_id: "subject-1", difficulty: "beginner" },
          error: null,
        },
      }),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.session.needsReset).toBe(true);
  });
});
