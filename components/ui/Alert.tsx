import type { ReactNode } from "react";

type AlertVariant = "info" | "error";

type AlertProps = {
  children: ReactNode;
  variant?: AlertVariant;
  className?: string;
};

function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Alert({ children, variant = "info", className }: AlertProps) {
  return (
    <div
      className={classNames(
        "rounded-xl border px-4 py-3 text-sm",
        variant === "info" && "border-sky-200 bg-sky-50 text-sky-900",
        variant === "error" && "border-rose-200 bg-rose-50 text-rose-900",
        className,
      )}
    >
      {children}
    </div>
  );
}
