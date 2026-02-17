/** @vitest-environment node */

const { createSupabaseUserServerMock } = vi.hoisted(() => ({
  createSupabaseUserServerMock: vi.fn(),
}));

vi.mock("../../../../lib/supabaseUserServer", () => ({
  createSupabaseUserServer: createSupabaseUserServerMock,
}));

import { POST } from "./route";

type MaybeResult<T> = { data: T | null; error: { message: string } | null };

function buildSupabase(config: {
  user: { id: string } | null;
  session?: MaybeResult<{ id: string; status: "active" | "completed" | "abandoned" }>;
  submission?: MaybeResult<{ id: string }>;
  updateError?: { message: string } | null;
}) {
  const session = config.session ?? { data: null, error: null };
  const submission = config.submission ?? { data: null, error: null };
  const updateError = config.updateError ?? null;

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
          maybeSingle: vi.fn(async () => session),
        };

        const updateChain = {
          eq: vi.fn(() => updateChain),
          then: (resolve: (value: unknown) => unknown) => resolve({ error: updateError }),
        };

        return {
          select: vi.fn(() => selectChain),
          update: vi.fn(() => updateChain),
        };
      }

      if (table === "quiz_submissions") {
        const chain = {
          eq: vi.fn(() => chain),
          order: vi.fn(() => chain),
          limit: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => submission),
        };
        return { select: vi.fn(() => chain) };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function makeRequest(body?: unknown) {
  return new Request("http://localhost/api/session/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : "{}",
  });
}

describe("POST /api/session/complete", () => {
  beforeEach(() => {
    createSupabaseUserServerMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    createSupabaseUserServerMock.mockResolvedValue(buildSupabase({ user: null }));

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 404 when no active session exists", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase({
        user: { id: "user-1" },
        session: { data: null, error: null },
      }),
    );

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatch(/No active session found/);
  });

  it("returns 400 when quiz submission is missing", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase({
        user: { id: "user-1" },
        session: { data: { id: "session-1", status: "active" }, error: null },
        submission: { data: null, error: null },
      }),
    );

    const response = await POST(makeRequest({ sessionId: "9ee7b406-f3c1-427d-acf4-c908c206f4af" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/before quiz submission/);
  });

  it("returns completed status when session is already completed", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase({
        user: { id: "user-1" },
        session: { data: { id: "session-1", status: "completed" }, error: null },
      }),
    );

    const response = await POST(makeRequest({ sessionId: "9ee7b406-f3c1-427d-acf4-c908c206f4af" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      sessionId: "session-1",
      status: "completed",
      alreadyCompleted: true,
    });
  });

  it("completes active session when quiz submission exists", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase({
        user: { id: "user-1" },
        session: { data: { id: "session-1", status: "active" }, error: null },
        submission: { data: { id: "submission-1" }, error: null },
      }),
    );

    const response = await POST(makeRequest({ sessionId: "9ee7b406-f3c1-427d-acf4-c908c206f4af" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sessionId).toBe("session-1");
    expect(body.status).toBe("completed");
    expect(typeof body.completedAt).toBe("string");
  });
});
