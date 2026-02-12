/** @vitest-environment node */

const { createSupabaseUserServerMock } = vi.hoisted(() => ({
  createSupabaseUserServerMock: vi.fn(),
}));

vi.mock("../../../../lib/supabaseUserServer", () => ({
  createSupabaseUserServer: createSupabaseUserServerMock,
}));

import { GET } from "./route";

type MaybeSingleResult = { data: { id: string } | null; error: { message: string } | null };

function buildSupabase(user: { id: string } | null, maybeSingleResult?: MaybeSingleResult) {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
    },
    from: vi.fn(() => {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        order: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => maybeSingleResult),
      };
      return chain;
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
      buildSupabase({ id: "user-1" }, { data: { id: "session-1" }, error: null }),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.session.sessionId).toBe("session-1");
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
});
