/** @vitest-environment node */

const {
  createSupabaseUserServerMock,
  generateNotebookEntryContentMock,
  getCachedLessonMock,
  generateLessonContentMock,
} = vi.hoisted(() => ({
  createSupabaseUserServerMock: vi.fn(),
  generateNotebookEntryContentMock: vi.fn(),
  getCachedLessonMock: vi.fn(),
  generateLessonContentMock: vi.fn(),
}));

vi.mock("../../../../lib/supabaseUserServer", () => ({
  createSupabaseUserServer: createSupabaseUserServerMock,
}));

vi.mock("../../../../lib/llm", async () => {
  const { z } = await import("zod");
  return {
    LessonContentSchema: z.object({
      title: z.string(),
      sections: z.array(z.object({ heading: z.string(), bullets: z.array(z.string()) })),
      key_takeaways: z.array(z.string()),
    }),
    getCachedLesson: getCachedLessonMock,
    generateNotebookEntryContent: generateNotebookEntryContentMock,
    generateLessonContent: generateLessonContentMock,
  };
});

import { NotebookEntrySchema } from "../../../../lib/notebook";
import { GET } from "./route";

type MaybeSingle<T> = { data: T | null; error: { message: string } | null };

function buildSupabase(config: {
  user: { id: string } | null;
  existingEntry?: MaybeSingle<{ content: unknown }>;
  concept?: MaybeSingle<{
    id: string;
    title: string;
    slug: string;
    subject_id: string;
    difficulty: "beginner" | "intermediate" | "advanced" | null;
  }>;
  latestQuiz?: MaybeSingle<{ percent: number; results: unknown; created_at: string }>;
}) {
  const existingEntry = config.existingEntry ?? { data: null, error: null };
  const concept =
    config.concept ??
    {
      data: {
        id: "concept-1",
        title: "Transformers",
        slug: "transformers",
        subject_id: "subject-1",
        difficulty: "beginner" as const,
      },
      error: null,
    };
  const latestQuiz = config.latestQuiz ?? { data: null, error: null };

  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: config.user } })),
    },
    from: vi.fn((table: string) => {
      if (table === "user_notebook_entries") {
        const upsert = vi.fn(async () => ({ error: null }));
        const chain = {
          eq: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => existingEntry),
        };
        return {
          select: vi.fn(() => chain),
          upsert,
        };
      }

      if (table === "concepts") {
        const chain = {
          eq: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => concept),
        };
        return { select: vi.fn(() => chain) };
      }

      if (table === "quiz_submissions") {
        const chain = {
          eq: vi.fn(() => chain),
          order: vi.fn(() => chain),
          limit: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => latestQuiz),
        };
        return { select: vi.fn(() => chain) };
      }

      if (table === "subjects") {
        const chain = {
          eq: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => ({ data: { name: "AI & LLM Systems" }, error: null })),
        };
        return { select: vi.fn(() => chain) };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe("NotebookEntrySchema", () => {
  it("validates notebook entry shape", () => {
    const parsed = NotebookEntrySchema.safeParse({
      conceptTitle: "Transformers",
      summary: "Two sentence summary.",
      definition: "One sentence definition.",
      whyItMatters: ["a", "b", "c"],
      commonPitfalls: ["a", "b", "c"],
      microExample: "A short example.",
      flashcards: [
        { q: "Q1", a: "A1" },
        { q: "Q2", a: "A2" },
        { q: "Q3", a: "A3" },
      ],
      tags: ["t1", "t2", "t3"],
    });

    expect(parsed.success).toBe(true);
  });
});

describe("GET /api/notebook/[conceptId]", () => {
  beforeEach(() => {
    createSupabaseUserServerMock.mockReset();
    generateNotebookEntryContentMock.mockReset();
    getCachedLessonMock.mockReset();
    generateLessonContentMock.mockReset();
  });

  it("returns existing notebook entry when present", async () => {
    const entry = {
      conceptTitle: "Transformers",
      summary: "Summary",
      definition: "Definition",
      whyItMatters: ["a", "b", "c"],
      commonPitfalls: ["a", "b", "c"],
      microExample: "Example",
      flashcards: [
        { q: "Q1", a: "A1" },
        { q: "Q2", a: "A2" },
        { q: "Q3", a: "A3" },
      ],
      tags: ["x", "y", "z"],
    };

    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase({
        user: { id: "user-1" },
        existingEntry: { data: { content: entry }, error: null },
      }),
    );

    const response = await GET(new Request("http://localhost/api/notebook/concept-1"), {
      params: Promise.resolve({ conceptId: "concept-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.cached).toBe(true);
    expect(body.entry.conceptTitle).toBe("Transformers");
    expect(generateNotebookEntryContentMock).not.toHaveBeenCalled();
  });

  it("generates and stores notebook entry when missing", async () => {
    const lesson = {
      title: "Lesson",
      sections: [{ heading: "h", bullets: ["b1"] }],
      key_takeaways: ["k1"],
    };
    const entry = {
      conceptTitle: "Transformers",
      summary: "Summary",
      definition: "Definition",
      whyItMatters: ["a", "b", "c"],
      commonPitfalls: ["a", "b", "c"],
      microExample: "Example",
      flashcards: [
        { q: "Q1", a: "A1" },
        { q: "Q2", a: "A2" },
        { q: "Q3", a: "A3" },
      ],
      tags: ["x", "y", "z"],
    };

    const supabase = buildSupabase({
      user: { id: "user-1" },
      existingEntry: { data: null, error: null },
    });
    createSupabaseUserServerMock.mockResolvedValue(supabase);
    getCachedLessonMock.mockResolvedValue(lesson);
    generateNotebookEntryContentMock.mockResolvedValue(entry);

    const response = await GET(new Request("http://localhost/api/notebook/concept-1"), {
      params: Promise.resolve({ conceptId: "concept-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.cached).toBe(false);
    expect(body.entry.conceptTitle).toBe("Transformers");
    expect(generateNotebookEntryContentMock).toHaveBeenCalled();

    const userNotebookTables = supabase.from.mock.results
      .map((entry) => entry.value)
      .filter((value: { upsert?: ReturnType<typeof vi.fn> }) => Boolean(value?.upsert));
    const upsertCalls = userNotebookTables.flatMap(
      (table: { upsert?: ReturnType<typeof vi.fn> }) => table.upsert?.mock.calls ?? [],
    );

    expect(upsertCalls).toContainEqual([
      expect.objectContaining({
        user_id: "user-1",
        subject_id: "subject-1",
        concept_id: "concept-1",
        version: 1,
      }),
      { onConflict: "user_id,concept_id,version" },
    ]);
  });
});
