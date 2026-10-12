import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { GITHUB_URL, VERCEL_OSS_URL } from "./data";
import {
  enter,
  FOCUS,
  PRESS,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from "./styles";

export function Hero() {
  return (
    <header className="pt-14 pb-10 md:pt-20 md:pb-12">
      <Link
        className={cn(
          "home-enter group mb-6 inline-flex h-8 items-center gap-2.5 rounded-full border border-black/[0.08] bg-white py-1 pr-3 pl-1 text-[13px] text-black/70 hover:border-black/15 hover:text-black dark:border-white/[0.1] dark:bg-black dark:text-white/70 dark:hover:border-white/20 dark:hover:text-white",
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
        className="home-enter text-balance font-semibold text-[clamp(40px,7vw,64px)] text-black leading-[1.02] tracking-[-0.04em] dark:text-white"
        style={enter(1)}
      >
        Try it here.{" "}
        <span className="text-black/45 dark:text-white/40">Ship it there.</span>
      </h1>

      <p
        className="home-enter mt-5 max-w-[560px] text-pretty text-[17px] text-black/60 leading-relaxed dark:text-white/60"
        style={enter(2)}
      >
        Open-source React components built with Tailwind CSS and Motion. Every
        tile below is the real component: press it, type in it, drop a file on
        it. Then copy one line, or ask your agent to.
      </p>

      <div
        className="home-enter mt-8 flex flex-wrap items-center gap-x-6 gap-y-4"
        style={enter(3)}
      >
        <div className="flex items-center gap-2">
          <Link className={cn(PRIMARY_BUTTON, PRESS, FOCUS)} href="/docs">
            Browse components
            <ArrowRightIcon aria-hidden className="size-4" />
          </Link>
          <Link
            className={cn(SECONDARY_BUTTON, PRESS, FOCUS)}
            href={GITHUB_URL}
            rel="noreferrer"
            target="_blank"
          >
            <GitHubMark />
            GitHub
          </Link>
        </div>
        <p className="flex items-center gap-2 text-[13px] text-black/55 dark:text-white/55">
          <span>MIT licensed</span>
          <span aria-hidden>·</span>
          <a
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm underline-offset-4 hover:text-black hover:underline dark:hover:text-white",
              FOCUS
            )}
            href={VERCEL_OSS_URL}
            rel="noreferrer"
            target="_blank"
          >
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
        </p>
      </div>
    </header>
  );
}

function GitHubMark() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
