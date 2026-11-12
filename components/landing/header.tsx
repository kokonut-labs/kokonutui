import { cacheLife, cacheTag } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import GithubIcon from "@/components/icons/github-icon";
import XIcon from "@/components/icons/x-icon";
import { siteConfig } from "@/config/site";
import { PRO_TEMPLATES_PAGE } from "@/lib/pro-templates";
import { ThemeToggle } from "@/lib/theme-toggle";
import { HeaderPro } from "./header-pro";

function formatNumber(value: number) {
  return Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

async function getGithubStars(): Promise<string | null> {
  "use cache";
  cacheLife("days");
  cacheTag("github-stars");

  try {
    const res = await fetch(
      "https://api.github.com/repos/kokonut-labs/kokonutui"
    );
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { stargazers_count?: number };
    if (typeof data.stargazers_count !== "number") {
      return null;
    }
    return formatNumber(data.stargazers_count);
  } catch {
    return null;
  }
}

function StarCountSkeleton() {
  return (
    <span
      aria-hidden
      className="inline-block h-[1em] w-7 animate-pulse rounded bg-zinc-200/70 dark:bg-zinc-800/70"
    />
  );
}

async function GithubStars() {
  const stars = await getGithubStars();
  if (stars === null) {
    return null;
  }
  return (
    <span className="font-light text-black tracking-tight hover:text-zinc-900 dark:text-white dark:hover:text-zinc-100">
      {stars}
    </span>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 right-0 left-0 z-50">
      <div className="w-full bg-white dark:bg-black">
        <div className="flex w-full flex-col items-center justify-center">
          <HeaderPro />
          <div className="relative flex w-full items-center justify-between px-6 py-3.5">
            <div className="relative z-10 mx-auto flex w-full max-w-[1400px] items-center justify-between gap-2">
              <div className="flex items-center gap-3 sm:gap-6">
                <Link
                  aria-label="Kokonut UI home"
                  className="flex shrink-0 items-center gap-2"
                  href="/"
                >
                  <Image alt="" height={28} src="/logo.svg" width={28} />
                  <span className="hidden font-semibold text-lg sm:block">
                    Kokonut UI
                  </span>
                </Link>
                <span aria-hidden className="text-zinc-300 dark:text-zinc-700">
                  |
                </span>
                <nav
                  aria-label="Main"
                  className="hidden items-center gap-0.5 md:flex"
                >
                  <Link
                    className="flex items-center gap-1 rounded-lg px-3 py-1 font-medium text-[15px] text-black/80 tracking-tighter transition-colors duration-200 hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/5"
                    href="/docs"
                  >
                    Components
                  </Link>
                  <Link
                    className="flex items-center gap-1 rounded-lg px-3 py-1 font-medium text-[15px] text-black/80 tracking-tighter transition-colors duration-200 hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/5"
                    href="/docs/ai"
                  >
                    AI
                  </Link>
                  <Link
                    className="flex items-center gap-1 rounded-lg px-3 py-1 font-medium text-[15px] text-black/80 tracking-tighter transition-colors duration-200 hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/5"
                    href="/docs/agents"
                  >
                    Agents
                  </Link>
                  <Link
                    className="flex items-center gap-1 rounded-lg px-3 py-1 font-medium text-[15px] text-black/80 tracking-tighter transition-colors duration-200 hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/5"
                    href="/docs/changelog"
                  >
                    Changelog
                  </Link>
                  <Link
                    className="flex items-center gap-1 rounded-lg px-3 py-1 font-medium text-[15px] text-black/80 tracking-tighter transition-colors duration-200 hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/5"
                    href={PRO_TEMPLATES_PAGE}
                  >
                    Templates
                  </Link>
                </nav>
              </div>

              <div className="hidden items-center gap-3 md:flex">
                <Link
                  className="group relative inline-flex items-center gap-2 rounded-md border border-transparent px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                  href={siteConfig.links.github}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <div className="relative flex w-full items-center gap-2">
                    <GithubIcon className="h-4 w-4 text-black dark:text-white" />
                    <span className="sr-only">GitHub</span>
                    <Suspense fallback={<StarCountSkeleton />}>
                      <GithubStars />
                    </Suspense>
                  </div>
                </Link>
                <Link
                  aria-label="Kokonut UI on X"
                  className="group relative inline-flex items-center gap-2 rounded-md border border-transparent px-2 py-2 text-sm text-zinc-600 transition-colors hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                  href="https://x.com/dorianbaffier"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <XIcon className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                </Link>
                <span aria-hidden className="text-zinc-300 dark:text-zinc-700">
                  |
                </span>
                <ThemeToggle />
              </div>

              <nav
                aria-label="Main"
                className="flex items-center gap-1 md:hidden"
              >
                <Link
                  className="rounded-md border border-transparent px-2.5 py-1.5 text-sm text-zinc-600 transition-colors hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                  href="/docs"
                >
                  Components
                </Link>
                <Link
                  className="rounded-md border border-transparent px-2.5 py-1.5 text-sm text-zinc-600 transition-colors hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                  href={PRO_TEMPLATES_PAGE}
                >
                  Templates
                </Link>
                <ThemeToggle />
              </nav>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
