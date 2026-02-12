/** @vitest-environment node */

const { createSupabaseUserServerMock } = vi.hoisted(() => ({
  createSupabaseUserServerMock: vi.fn(),
}));

vi.mock("../../../../lib/supabaseUserServer", () => ({
  createSupabaseUserServer: createSupabaseUserServerMock,
}));

import { GET } from "./route";

type SessionResult = {
  data: { id: string; concept_id: string | null; subject_id: string | null; difficulty: string | null } | null;
  error: { message: string } | null;
};

function buildSupabase(
  user: { id: string } | null,
  sessionResult?: SessionResult,
  conceptResult?: { data: { title: string } | null; error: { message: string } | null },
) {
  const resolvedSession = sessionResult ?? { data: null, error: null };
  const resolvedConcept = conceptResult ?? { data: { title: "Transformers" }, error: null };

  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
    },
    from: vi.fn((table: string) => {
      if (table === "sessions") {
        const chain = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          order: vi.fn(() => chain),
          limit: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => resolvedSession),
        };
        return chain;
      }

      if (table === "concepts") {
        const chain = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => resolvedConcept),
        };
        return chain;
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
    createSupabaseUserServerMock.mockResolvedValue(buildSupabase(null));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns null session when user has no active session", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase({ id: "user-1" }, { data: null, error: null }),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.session).toBeNull();
  });

  it("returns active session details", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase(
        { id: "user-1" },
        {
          data: {
            id: "session-1",
            concept_id: "concept-1",
            subject_id: "subject-1",
            difficulty: "beginner",
          },
          error: null,
        },
        { data: { title: "Tokens & Context" }, error: null },
      ),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.session.sessionId).toBe("session-1");
    expect(body.session.conceptName).toBe("Tokens & Context");
    expect(body.session.needsReset).toBe(false);
  });

  it("returns 500 when database query fails", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase({ id: "user-1" }, { data: null, error: { message: "db failure" } }),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("db failure");
  });

  it("returns reset-needed session when metadata is incomplete", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase(
        { id: "user-1" },
        {
          data: {
            id: "session-1",
            concept_id: null,
            subject_id: "subject-1",
            difficulty: "beginner",
          },
          error: null,
        },
      ),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.session.needsReset).toBe(true);
  });
});
