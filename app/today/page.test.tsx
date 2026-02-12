import { fireEvent, render, screen } from "@testing-library/react";
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

  it("renders Unauthorized error state when settings API returns 401", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Unauthorized" }),
    } as Response);

    render(<TodayPage />);

    expect(await screen.findByText("Unauthorized")).toBeInTheDocument();
  });

  it("renders continue card when active session exists", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ settings: { subjectId: "subject-1", dailyMinutes: 12 } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session: { sessionId: "abc123", conceptName: "Transformers", needsReset: false } }),
      } as Response);

    render(<TodayPage />);

    const continueLink = await screen.findByRole("link", { name: "Continue" });
    expect(continueLink).toHaveAttribute("href", "/lesson/abc123");
  });

  it("shows onboarding when settings are missing", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ settings: null }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session: null }),
      } as Response);

    render(<TodayPage />);

    expect(await screen.findByText("First run setup")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save and start" })).toBeInTheDocument();
  });

  it("renders start button when returning user has no active session", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ settings: { subjectId: "subject-1", dailyMinutes: 12 } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session: null }),
      } as Response);

    render(<TodayPage />);

    const startButton = await screen.findByRole("button", { name: "Start today's session" });
    expect(startButton).toBeInTheDocument();
  });

  it("starts a new session and redirects after start click", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ settings: { subjectId: "subject-1", dailyMinutes: 12 } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session: null }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: "new-session" }),
      } as Response);

    render(<TodayPage />);

    const startButton = await screen.findByRole("button", { name: "Start today's session" });
    fireEvent.click(startButton);

    expect(await screen.findByRole("button", { name: "Starting..." })).toBeInTheDocument();
    expect(pushMock).toHaveBeenCalledWith("/lesson/new-session");
  });

  it("saves onboarding settings then starts session", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ settings: null }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session: null }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ settings: { subjectId: "subject-1", dailyMinutes: 15 } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: "onboarding-session" }),
      } as Response);

    render(<TodayPage />);

    const onboardingButton = await screen.findByRole("button", { name: "Save and start" });
    fireEvent.click(onboardingButton);

    expect(await screen.findByRole("button", { name: "Starting..." })).toBeInTheDocument();
    expect(pushMock).toHaveBeenCalledWith("/lesson/onboarding-session");
  });

  it("shows reset flow for incomplete active session", async () => {
    const fetchSpy = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ settings: { subjectId: "subject-1", dailyMinutes: 12 } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session: { sessionId: "broken", conceptName: null, needsReset: true } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ settings: { subjectId: "subject-1", dailyMinutes: 12 } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session: null }),
      } as Response);

    render(<TodayPage />);

    const resetButton = await screen.findByRole("button", { name: "Reset today" });
    fireEvent.click(resetButton);

    await screen.findByRole("button", { name: "Start today's session" });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/session/reset",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
