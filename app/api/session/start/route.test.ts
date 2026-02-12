/** @vitest-environment node */

const { createSupabaseUserServerMock } = vi.hoisted(() => ({
  createSupabaseUserServerMock: vi.fn(),
}));

vi.mock("../../../../lib/supabaseUserServer", () => ({
  createSupabaseUserServer: createSupabaseUserServerMock,
}));

import { POST } from "./route";

type QueryResult = { data: { id: string } | null; error: { message: string } | null };
type CreateResult = { data: { id: string } | null; error: { message: string } | null };

function buildSupabase(user: { id: string } | null, queryResult?: QueryResult, createResult?: CreateResult) {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
    },
    from: vi.fn(() => {
      const queryChain = {
        eq: vi.fn(() => queryChain),
        order: vi.fn(() => queryChain),
        limit: vi.fn(() => queryChain),
        maybeSingle: vi.fn(async () => queryResult),
      };

      return {
        select: vi.fn(() => queryChain),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => createResult),
          })),
        })),
      };
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

  it("returns 401 without auth cookie/session", async () => {
    createSupabaseUserServerMock.mockResolvedValue(buildSupabase(null));

    const response = await POST(makeRequest("{}"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid JSON body", async () => {
    createSupabaseUserServerMock.mockResolvedValue(buildSupabase({ id: "user-1" }));

    const response = await POST(makeRequest("{"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns existing session when present", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase({ id: "user-1" }, { data: { id: "session-existing" }, error: null }),
    );

    const response = await POST(makeRequest("{}"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sessionId).toBe("session-existing");
    expect(body.existing).toBe(true);
  });

  it("creates a new session when none exists", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase(
        { id: "user-1" },
        { data: null, error: null },
        { data: { id: "session-new" }, error: null },
      ),
    );

    const response = await POST(makeRequest("{}"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sessionId).toBe("session-new");
    expect(body.existing).toBe(false);
  });

  it("returns 500 when create query fails", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase(
        { id: "user-1" },
        { data: null, error: null },
        { data: null, error: { message: "insert failure" } },
      ),
    );

    const response = await POST(makeRequest("{}"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("insert failure");
  });
});
