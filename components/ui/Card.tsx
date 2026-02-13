import type { ReactNode } from "react";

function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type CardProps = {
  children: ReactNode;
  variant?: "hero" | "panel" | "primary" | "secondary";
  className?: string;
};

export function Card({ children, variant = "panel", className }: CardProps) {
  const resolvedVariant = variant === "primary" ? "hero" : variant === "secondary" ? "panel" : variant;

  return (
    <section
      className={classNames(
        "rounded-2xl border border-[var(--border)] p-6",
        resolvedVariant === "hero" && "bg-[var(--surface-1)] shadow-[0_8px_24px_rgba(0,0,0,0.16)]",
        resolvedVariant === "panel" && "bg-[var(--surface-2)] shadow-none",
        className,
      )}
    >
      {children}
    </section>
  );
}
