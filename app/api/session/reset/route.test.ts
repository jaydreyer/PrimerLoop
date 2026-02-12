/** @vitest-environment node */

const { createSupabaseUserServerMock } = vi.hoisted(() => ({
  createSupabaseUserServerMock: vi.fn(),
}));

vi.mock("../../../../lib/supabaseUserServer", () => ({
  createSupabaseUserServer: createSupabaseUserServerMock,
}));

import { POST } from "./route";

function buildSupabase(config: { user: { id: string } | null; deleteError?: { message: string } | null }) {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: config.user } })),
    },
    from: vi.fn((table: string) => {
      if (table !== "sessions") {
        throw new Error(`Unexpected table: ${table}`);
      }
      const chain = {
        delete: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        then: (resolve: (value: unknown) => unknown) => resolve({ error: config.deleteError ?? null }),
      };
      return chain;
    }),
  };
}

describe("POST /api/session/reset", () => {
  beforeEach(() => {
    createSupabaseUserServerMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    createSupabaseUserServerMock.mockResolvedValue(buildSupabase({ user: null }));
    const response = await POST();
    expect(response.status).toBe(401);
  });

  it("deletes today's active session for user", async () => {
    createSupabaseUserServerMock.mockResolvedValue(buildSupabase({ user: { id: "user-1" } }));
    const response = await POST();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
