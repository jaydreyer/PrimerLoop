import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import NotebookPage from "./page";

const { createSupabaseUserServerMock } = vi.hoisted(() => ({
  createSupabaseUserServerMock: vi.fn(),
}));

vi.mock("../../lib/supabaseUserServer", () => ({
  createSupabaseUserServer: createSupabaseUserServerMock,
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

type MasteryRow = {
  concept_id: string;
  mastery_score: number;
  next_review_at: string | null;
};

type SessionRow = {
  concept_id: string | null;
};

type ConceptRow = {
  id: string;
  title: string;
};

function buildSupabase(config: {
  user: { id: string } | null;
  masteryRows?: MasteryRow[];
  sessionRows?: SessionRow[];
  concepts?: ConceptRow[];
}) {
  const masteryRows = config.masteryRows ?? [];
  const sessionRows = config.sessionRows ?? [];
  const concepts = config.concepts ?? [];

  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: config.user } })),
    },
    from: vi.fn((table: string) => {
      if (table === "user_concept_mastery") {
        const chain = {
          eq: vi.fn(async () => ({ data: masteryRows })),
        };
        return { select: vi.fn(() => chain) };
      }

      if (table === "sessions") {
        const chain = {
          eq: vi.fn(() => chain),
          not: vi.fn(async () => ({ data: sessionRows })),
        };
        return { select: vi.fn(() => chain) };
      }

      if (table === "concepts") {
        const chain = {
          in: vi.fn(() => chain),
          order: vi.fn(async () => ({ data: concepts })),
        };
        return { select: vi.fn(() => chain) };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe("NotebookPage", () => {
  beforeEach(() => {
    createSupabaseUserServerMock.mockReset();
  });

  it("renders sign-in prompt when unauthenticated", async () => {
    createSupabaseUserServerMock.mockResolvedValue(buildSupabase({ user: null }));

    render(await NotebookPage());

    expect(screen.getByRole("heading", { name: "Notebook" })).toBeInTheDocument();
    expect(screen.getByText("Please sign in to view your notebook.")).toBeInTheDocument();
  });

  it("renders empty state when no concepts are available", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase({
        user: { id: "user-1" },
        masteryRows: [],
        sessionRows: [],
      }),
    );

    render(await NotebookPage());

    expect(
      screen.getByText("No notebook concepts yet. Complete a session to generate your first note."),
    ).toBeInTheDocument();
  });

  it("renders merged concept list with links", async () => {
    createSupabaseUserServerMock.mockResolvedValue(
      buildSupabase({
        user: { id: "user-1" },
        masteryRows: [
          {
            concept_id: "concept-1",
            mastery_score: 0.82,
            next_review_at: "2026-02-15T00:00:00.000Z",
          },
        ],
        sessionRows: [{ concept_id: "concept-1" }, { concept_id: "concept-2" }],
        concepts: [
          { id: "concept-2", title: "Attention Basics" },
          { id: "concept-1", title: "Transformers" },
        ],
      }),
    );

    render(await NotebookPage());

    expect(screen.getByRole("heading", { name: "Attention Basics" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Transformers" })).toBeInTheDocument();

    const links = screen.getAllByRole("link", { name: "Open note" });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/notebook/concept-2");
    expect(links[1]).toHaveAttribute("href", "/notebook/concept-1");

    expect(screen.getByText("Mastery: 0.82")).toBeInTheDocument();
  });
});
