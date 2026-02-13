import type { ReactNode } from "react";

type BadgeVariant = "default" | "neutral" | "success" | "warning" | "muted";

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const resolvedVariant = variant === "default" ? "neutral" : variant;

  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        resolvedVariant === "neutral" &&
          "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
        resolvedVariant === "success" &&
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
        resolvedVariant === "warning" &&
          "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
        resolvedVariant === "muted" &&
          "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-700",
        className,
      )}
    >
      {children}
    </span>
  );
}
