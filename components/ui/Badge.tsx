import type { ReactNode } from "react";

type BadgeVariant = "default" | "muted";

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        variant === "default" && "bg-slate-900 text-white",
        variant === "muted" && "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
        className,
      )}
    >
      {children}
    </span>
  );
}
