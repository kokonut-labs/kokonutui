import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CommandChip } from "./client";
import { installCommand, VERCEL_OSS_URL } from "./data";
import { EASE_COLORS, enter, FOCUS, PRIMARY_BUTTON } from "./styles";

export function Hero() {
  return (
    <header className="flex flex-col items-center pt-20 pb-14 text-center md:pt-28 md:pb-20">
      <h1
        className="home-enter text-balance font-semibold text-[clamp(40px,7vw,72px)] text-black leading-[1.02] tracking-[-0.045em] dark:text-white"
        style={enter(0)}
      >
        Components that feel right.
      </h1>

      <p
        className="home-enter mt-6 max-w-[620px] text-balance text-[18px] text-black/60 leading-relaxed dark:text-white/60"
        style={enter(1)}
      >
        Free, open-source React components built with Tailwind CSS and Motion.
        Try them here, then install with one command or one prompt.
      </p>

      <div
        className="home-enter mt-9 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center"
        style={enter(2)}
      >
        <Link
          className={cn(
            PRIMARY_BUTTON,
            "h-11 justify-center px-6",
            EASE_COLORS,
            FOCUS
          )}
          href="/docs"
        >
          Browse components
          <ArrowRightIcon aria-hidden className="size-4" />
        </Link>
        {/* The "one line", ready to copy. */}
        <CommandChip
          className="min-h-11 sm:w-auto"
          command={installCommand("particle-button")}
        />
      </div>

      <a
        className={cn(
          "home-enter mt-7 inline-flex items-center gap-1.5 rounded-sm text-[13px] text-black/55 underline-offset-4 hover:text-black hover:underline dark:text-white/55 dark:hover:text-white",
          FOCUS
        )}
        href={VERCEL_OSS_URL}
        rel="noreferrer"
        style={enter(3)}
        target="_blank"
      >
        Part of the
        <svg
          aria-hidden="true"
          className="size-2.5"
          fill="currentColor"
          viewBox="0 0 76 65"
        >
          <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
        </svg>
        Vercel OSS Program
      </a>
    </header>
  );
}
