import Link from "next/link";
import type { ReactNode } from "react";

type ButtonVariant = "primary" | "secondary";

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
    "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
    "w-full sm:w-auto",
    variant === "primary" && "bg-slate-900 text-white hover:bg-slate-700",
    variant === "secondary" && "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100",
    disabled && "cursor-not-allowed bg-slate-400 hover:bg-slate-400",
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
