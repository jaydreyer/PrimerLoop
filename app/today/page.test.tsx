import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import TodayPage from "./page";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("TodayPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    pushMock.mockReset();
  });

  it("renders Unauthorized error state when today API returns 401", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Unauthorized" }),
    } as Response);

    render(<TodayPage />);

    expect(await screen.findByText("Unauthorized")).toBeInTheDocument();
  });

  it("auto-starts a session when none exists", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session: null,
          concepts: [],
          snapshot: { streak: null, sessionsCompleted: 0, avgMastery: null },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: "new-session" }),
      } as Response);

    render(<TodayPage />);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/lesson/new-session");
    });
  }, 15000);

  it("renders current focus and continue action when active session exists", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        session: {
          sessionId: "abc123",
          conceptId: "concept-1",
          conceptName: "Transformers",
          track: "LLM_APP",
          status: "Available",
          masteryLevel: 2,
          needsReset: false,
        },
        concepts: [
          {
            conceptId: "concept-1",
            title: "Transformers",
            track: "LLM_APP",
            status: "Available",
            masteryLevel: 2,
            unlocked: true,
            mastered: false,
            prerequisiteTitles: [],
          },
        ],
        snapshot: { streak: null, sessionsCompleted: 4, avgMastery: 1.5 },
      }),
    } as Response));

    render(<TodayPage />);

    expect(await screen.findByText("Transformers")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/lesson/abc123");
    expect(screen.getByText("Sessions")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("opens drawer and blocks locked concept selection", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        session: {
          sessionId: "abc123",
          conceptId: "concept-1",
          conceptName: "Transformers",
          track: "LLM_APP",
          status: "Available",
          masteryLevel: 2,
          needsReset: false,
        },
        concepts: [
          {
            conceptId: "concept-locked",
            title: "Agent Loops",
            track: "LLM_APP",
            status: "Locked",
            masteryLevel: 0,
            unlocked: false,
            mastered: false,
            prerequisiteTitles: ["Tool Calling Basics"],
          },
        ],
        snapshot: { streak: null, sessionsCompleted: 4, avgMastery: 1.5 },
      }),
    } as Response));

    render(<TodayPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Browse curriculum" }));
    expect(await screen.findByText("Requires: Tool Calling Basics")).toBeInTheDocument();

    const lockedButton = screen.getByRole("button", { name: /Agent Loops/i });
    expect(lockedButton).toBeDisabled();
    const setConceptCalls = fetchSpy.mock.calls.filter((call) => call[0] === "/api/session/set-concept");
    expect(setConceptCalls).toHaveLength(0);
  });
});
