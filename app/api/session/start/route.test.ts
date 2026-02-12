/** @vitest-environment node */

const { createSupabaseUserServerMock } = vi.hoisted(() => ({
  createSupabaseUserServerMock: vi.fn(),
}));

vi.mock("../../../../lib/supabaseUserServer", () => ({
  createSupabaseUserServer: createSupabaseUserServerMock,
}));

import { POST } from "./route";

type MaybeResult<T> = { data: T | null; error: { message: string } | null };

type StartRouteMockConfig = {
  user: { id: string } | null;
  existingSession?: MaybeResult<{ id: string }>;
  userSettings?: MaybeResult<{ subject_id: string }>;
  defaultSubject?: MaybeResult<{ id: string }>;
  firstConcept?: MaybeResult<{ id: string; difficulty: "beginner" | "intermediate" | "advanced" }>;
  createdSession?: MaybeResult<{ id: string }>;
};

function buildSupabase(config: StartRouteMockConfig) {
  const existingSession =
    config.existingSession ?? ({ data: null, error: null } satisfies MaybeResult<{ id: string }>);
  const userSettings =
    config.userSettings ?? ({ data: null, error: null } satisfies MaybeResult<{ subject_id: string }>);
  const defaultSubject =
    config.defaultSubject ?? ({ data: null, error: null } satisfies MaybeResult<{ id: string }>);
  const firstConcept =
    config.firstConcept ??
    ({ data: null, error: null } satisfies MaybeResult<{ id: string; difficulty: "beginner" }>);
  const createdSession =
    config.createdSession ?? ({ data: { id: "session-new" }, error: null } satisfies MaybeResult<{ id: string }>);

  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: config.user } })),
    },
    from: vi.fn((table: string) => {
      if (table === "sessions") {
        const selectChain = {
          eq: vi.fn(() => selectChain),
          order: vi.fn(() => selectChain),
          limit: vi.fn(() => selectChain),
          maybeSingle: vi.fn(async () => existingSession),
        };

        return {
          select: vi.fn(() => selectChain),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => createdSession),
            })),
          })),
        };
      }

      if (table === "user_settings") {
        const chain = {
          eq: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => userSettings),
        };
        return { select: vi.fn(() => chain) };
      }

      if (table === "subjects") {
        const chain = {
          eq: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => defaultSubject),
        };
        return { select: vi.fn(() => chain) };
      }

      if (table === "concepts") {
        const chain = {
          eq: vi.fn(() => chain),
          order: vi.fn(() => chain),
          limit: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => firstConcept),
        };
        return { select: vi.fn(() => chain) };
      }

      if (table === "session_concepts") {
        return {
          upsert: vi.fn(async () => ({ error: null })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function makeRequest(body: string) {
  return new Request("http://localhost/api/session/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("POST /api/session/start", () => {
  beforeEach(() => {
    createSupabaseUserServerMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    createSupabaseUserServerMock.mockResolvedValue(buildSupabase({ user: null }));

    const response = await POST(makeRequest("{}"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid JSON body", async () => {
    createSupabaseUserServerMock.mockResolvedValue(buildSupabase({ user: { id: "user-1" } }));

    const response = await POST(makeRequest("{"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns existing session when already active", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase({
        user: { id: "user-1" },
        existingSession: { data: { id: "session-existing" }, error: null },
      }),
    );

    const response = await POST(makeRequest("{}"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ sessionId: "session-existing", existing: true });
  });

  it("returns 500 when subject/concept metadata is unavailable", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase({
        user: { id: "user-1" },
        existingSession: { data: null, error: null },
        userSettings: { data: null, error: null },
        defaultSubject: { data: null, error: null },
      }),
    );

    const response = await POST(makeRequest("{}"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toMatch(/Session metadata missing/);
  });

  it("creates a new session when none exists and metadata is available", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase({
        user: { id: "user-1" },
        existingSession: { data: null, error: null },
        userSettings: { data: { subject_id: "subject-1" }, error: null },
        firstConcept: { data: { id: "concept-1", difficulty: "beginner" }, error: null },
        createdSession: { data: { id: "session-new" }, error: null },
      }),
    );

    const response = await POST(makeRequest("{}"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ sessionId: "session-new", existing: false });
  });

  it("returns 500 when session insert fails", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase({
        user: { id: "user-1" },
        existingSession: { data: null, error: null },
        userSettings: { data: { subject_id: "subject-1" }, error: null },
        firstConcept: { data: { id: "concept-1", difficulty: "beginner" }, error: null },
        createdSession: { data: null, error: { message: "insert failure" } },
      }),
    );

    const response = await POST(makeRequest("{}"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("insert failure");
  });
});
