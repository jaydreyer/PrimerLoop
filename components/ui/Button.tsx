import Link from "next/link";
import type { ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type CommonProps = {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
};

type ButtonProps = CommonProps & {
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  disabled?: boolean;
  href?: never;
};

type LinkButtonProps = CommonProps & {
  href: string;
  type?: never;
  onClick?: never;
  disabled?: never;
};

function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function baseClasses(variant: ButtonVariant, disabled = false): string {
  return classNames(
    "inline-flex h-12 w-full items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors sm:w-auto",
    variant === "primary" &&
      "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
    variant === "secondary" &&
      "border border-[var(--border)] bg-transparent text-[var(--text)] hover:bg-white/5 dark:hover:bg-white/[0.04]",
    variant === "ghost" && "bg-transparent text-[var(--muted)] hover:text-[var(--text)]",
    disabled && "cursor-not-allowed opacity-60 hover:bg-inherit hover:text-inherit",
  );
}

export function Button(props: ButtonProps | LinkButtonProps) {
  const variant = props.variant ?? "primary";

  if ("href" in props && typeof props.href === "string") {
    return (
      <Link href={props.href} className={classNames(baseClasses(variant), props.className)}>
        {props.children}
      </Link>
    );
  }

  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      className={classNames(baseClasses(variant, props.disabled), props.className)}
    >
      {props.children}
    </button>
  );
}
