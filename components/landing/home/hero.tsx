import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CommandChip } from "./client";
import { installCommand, VERCEL_OSS_URL } from "./data";
import { enter, FOCUS, PRESS, PRIMARY_BUTTON } from "./styles";

export function Hero() {
  return (
    <header className="flex flex-col items-center pt-16 pb-12 text-center md:pt-24 md:pb-16">
      <Link
        className={cn(
          "home-enter group mb-7 inline-flex h-8 items-center gap-2.5 rounded-full border border-black/[0.08] bg-white py-1 pr-3 pl-1 text-[13px] text-black/70 hover:border-black/15 hover:text-black dark:border-white/[0.1] dark:bg-black dark:text-white/70 dark:hover:border-white/20 dark:hover:text-white",
          PRESS,
          FOCUS
        )}
        href="/docs/mcp"
        style={enter(0)}
      >
        <span className="rounded-full bg-black px-2 py-0.5 font-medium text-[11px] text-white tracking-wide dark:bg-white dark:text-black">
          MCP
        </span>
        Install with Claude Code, Cursor or Codex
        <ArrowRightIcon
          aria-hidden
          className="size-3.5 opacity-50 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
        />
      </Link>

      <h1
        className="home-enter text-balance font-semibold text-[clamp(38px,6.4vw,64px)] text-black leading-[1.04] tracking-[-0.045em] dark:text-white"
        style={enter(1)}
      >
        Components that feel right.
        <span className="block text-black/45 dark:text-white/45">
          Install in one line, or one prompt.
        </span>
      </h1>

      <p
        className="home-enter mt-6 max-w-[540px] text-pretty text-[17px] text-black/60 leading-relaxed dark:text-white/60"
        style={enter(2)}
      >
        Open-source React components built with Tailwind CSS and Motion.
        Everything below is live, so try it before you install it.
      </p>

      <div
        className="home-enter mt-9 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center"
        style={enter(3)}
      >
        <Link
          className={cn(
            PRIMARY_BUTTON,
            "h-11 justify-center px-6",
            PRESS,
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
        style={enter(4)}
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
