"use client";

import "./globals.css";
import { ArrowRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  CELL,
  EASE_COLORS,
  FOCUS,
  INK,
  LEAF,
  LINE,
  META,
  MONO,
  SOFT,
} from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";

const ROW = cn(
  "group flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium text-[15px] hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
  INK,
  CELL,
  EASE_COLORS,
  FOCUS
);

const ARROW =
  "size-4 text-black/40 group-hover:text-black dark:text-white/40 dark:group-hover:text-white";

/** The theme the visitor had, read by hand: the theme provider is gone here. */
function prefersDark() {
  try {
    const stored = window.localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      return stored === "dark";
    }
  } catch {
    // Storage is blocked; go by the system.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Shown when the root layout itself fails, so it brings its own html and
 * body. It looks like the 404 page and keeps the error's message to the
 * console: visitors get a way forward and a reference to quote.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(prefersDark());
  }, []);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html className={dark ? "dark" : undefined} lang="en">
      <body className="antialiased">
        <main className="flex min-h-dvh items-center justify-center bg-white px-4 dark:bg-black">
          <div className={cn("w-full max-w-md border", LINE)}>
            <div className={cn("flex flex-col gap-3 p-6", CELL)}>
              <p className="flex items-baseline justify-between gap-4">
                <span className={cn(MONO, "font-medium text-[12px]", LEAF)}>
                  500
                </span>
                <span className={META}>
                  {error.digest ? `Ref ${error.digest}` : "Unexpected error"}
                </span>
              </p>
              <h1
                className={cn("font-semibold text-3xl tracking-[-0.03em]", INK)}
              >
                This page broke.
              </h1>
              <p className={cn("text-[15px] leading-relaxed", SOFT)}>
                Something failed while loading it. Trying again usually works.
              </p>
            </div>
            <nav aria-label="Where to go" className={cn("border-t", LINE)}>
              <button
                className={cn(ROW, "border-b", LINE)}
                onClick={() => reset()}
                type="button"
              >
                Try again
                <ArrowRightIcon aria-hidden className={ARROW} />
              </button>
              {/* A full page load on purpose: the app that crashed is the one
                  that would handle a client-side navigation. */}
              <a className={ROW} href="/">
                Back to the homepage
                <ArrowRightIcon aria-hidden className={ARROW} />
              </a>
            </nav>
          </div>
        </main>
      </body>
    </html>
  );
}
