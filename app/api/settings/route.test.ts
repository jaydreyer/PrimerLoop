/** @vitest-environment node */

const { createSupabaseUserServerMock } = vi.hoisted(() => ({
  createSupabaseUserServerMock: vi.fn(),
}));

vi.mock("../../../lib/supabaseUserServer", () => ({
  createSupabaseUserServer: createSupabaseUserServerMock,
}));

import { GET, POST } from "./route";

function makePostRequest(body: string) {
  return new Request("http://localhost/api/settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

function buildSupabase(config: {
  user: { id: string } | null;
  currentSettings?: { data: { subject_id: string; daily_minutes: number } | null; error: { message: string } | null };
  subjectBySlug?: { data: { id: string } | null; error: { message: string } | null };
  firstSubject?: { data: { id: string } | null; error: { message: string } | null };
  upsertError?: { message: string } | null;
}) {
  const currentSettings = config.currentSettings ?? { data: null, error: null };
  const subjectBySlug = config.subjectBySlug ?? { data: { id: "subject-1" }, error: null };
  const firstSubject = config.firstSubject ?? { data: { id: "subject-1" }, error: null };
  const upsert = vi.fn(async () => ({ error: config.upsertError ?? null }));

  return {
    __upsert: upsert,
    auth: {
      getUser: vi.fn(async () => ({ data: { user: config.user } })),
    },
    from: vi.fn((table: string) => {
      if (table === "user_settings") {
        const chain = {
          eq: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => currentSettings),
        };
        return {
          select: vi.fn(() => chain),
          upsert,
        };
      }

      if (table === "subjects") {
        const slugChain = {
          eq: vi.fn(() => slugChain),
          maybeSingle: vi.fn(async () => subjectBySlug),
        };
        const firstChain = {
          order: vi.fn(() => firstChain),
          limit: vi.fn(() => firstChain),
          maybeSingle: vi.fn(async () => firstSubject),
        };
        return {
          select: vi.fn(() => ({
            ...slugChain,
            ...firstChain,
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe("GET /api/settings", () => {
  beforeEach(() => {
    createSupabaseUserServerMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    createSupabaseUserServerMock.mockResolvedValue(buildSupabase({ user: null }));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns settings when row exists", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase({
        user: { id: "user-1" },
        currentSettings: {
          data: { subject_id: "subject-1", daily_minutes: 15 },
          error: null,
        },
      }),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings).toEqual({ subjectId: "subject-1", dailyMinutes: 15 });
  });
});

describe("POST /api/settings", () => {
  beforeEach(() => {
    createSupabaseUserServerMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    createSupabaseUserServerMock.mockResolvedValue(buildSupabase({ user: null }));
    const response = await POST(makePostRequest("{}"));
    expect(response.status).toBe(401);
  });

  it("upserts settings for authenticated user", async () => {
    const supabase = buildSupabase({
      user: { id: "user-1" },
      subjectBySlug: { data: { id: "subject-99" }, error: null },
    });
    createSupabaseUserServerMock.mockResolvedValue(supabase);

    const response = await POST(
      makePostRequest(
        JSON.stringify({
          subjectSlug: "ai-llm-systems",
          dailyMinutes: 15,
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings).toEqual({ subjectId: "subject-99", dailyMinutes: 15 });
    expect(supabase.__upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        subject_id: "subject-99",
        daily_minutes: 15,
      }),
      { onConflict: "user_id" },
    );
  });
});
