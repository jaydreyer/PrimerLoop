import type { ReactNode } from "react";

type PillVariant = "neutral" | "status";

type PillProps = {
  children: ReactNode;
  variant?: PillVariant;
  className?: string;
};

function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Pill({ children, variant = "neutral", className }: PillProps) {
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium",
        variant === "neutral" && "bg-[var(--surface-2)] text-[var(--muted)]",
        variant === "status" && "bg-transparent text-[var(--text)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
