import type { ReactNode } from "react";
import { AppNav } from "../components/AppNav";
import "./globals.css";

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto min-h-screen w-full max-w-3xl px-4 py-4 sm:px-6 sm:py-8">
          <AppNav />
          <div>{children}</div>
        </div>
      </body>
    </html>
  );
}
