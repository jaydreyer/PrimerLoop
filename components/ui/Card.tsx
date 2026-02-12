import type { ReactNode } from "react";

function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return (
    <section
      className={classNames(
        "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}
