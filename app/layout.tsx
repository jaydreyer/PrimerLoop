import type { ReactNode } from "react";
import { AppNav } from "../components/AppNav";
import "./globals.css";

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  const themeInitScript = `
    (function () {
      try {
        var stored = localStorage.getItem("theme");
        var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        var theme = stored === "light" || stored === "dark" ? stored : (prefersDark ? "dark" : "light");
        var root = document.documentElement;
        root.classList.toggle("dark", theme === "dark");
        root.classList.toggle("light", theme === "light");
      } catch (_) {}
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen">
        <div className="mx-auto min-h-screen w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-8">
          <AppNav />
          <div>{children}</div>
        </div>
      </body>
    </html>
  );
}
