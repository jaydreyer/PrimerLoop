"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/today", label: "Today" },
  { href: "/notebook", label: "Notebook" },
  { href: "/progress", label: "Progress" },
  { href: "/settings", label: "Settings" },
];

function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/80 p-1.5 shadow-none backdrop-blur">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {NAV_LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={classNames(
                  "block rounded-xl px-3 py-2 text-center text-sm font-medium transition-colors",
                  active
                    ? "bg-[var(--surface-1)] text-[var(--text)]"
                    : "text-[var(--muted2)] hover:bg-white/[0.03] hover:text-[var(--muted)]",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
