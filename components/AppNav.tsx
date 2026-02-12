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
    <nav className="mb-6 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
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
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100",
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
