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

  it("renders Unauthorized error state when session API returns 401", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Unauthorized" }),
    } as Response);

    render(<TodayPage />);

    expect(await screen.findByText("Unauthorized")).toBeInTheDocument();
  });

  it("renders continue card when active session exists", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session: { sessionId: "abc123", conceptName: "Transformers" } }),
    } as Response);

    render(<TodayPage />);

    const continueLink = await screen.findByRole("link", { name: "Continue" });
    expect(continueLink).toHaveAttribute("href", "/lesson/abc123");
  });

  it("renders start button when no active session exists", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
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
});
