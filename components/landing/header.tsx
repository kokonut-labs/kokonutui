import { cacheLife, cacheTag } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import { Link as ViewTransitionsLink } from "next-view-transitions";
import { Suspense } from "react";
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
    <div className="sticky top-0 right-0 left-0 z-50">
      <div className="w-full bg-white dark:bg-black">
        <div className="flex w-full flex-col items-center justify-center">
          <HeaderPro />
          <div className="relative flex w-full items-center justify-between px-6 py-3.5 transition-all duration-300 ease-in-out">
            <div className="relative z-10 mx-auto flex w-full max-w-[1400px] items-center justify-between gap-2">
              <div className="flex items-center gap-6">
                <Link className="flex items-center gap-2" href="/">
                  <Image alt="logo" height={28} src="/logo.svg" width={28} />
                  <span className="hidden font-semibold text-lg sm:block">
                    Kokonut UI
                  </span>
                </Link>
                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                <div className="hidden items-center gap-0.5 sm:flex">
                  <ViewTransitionsLink
                    className="flex items-center gap-1 rounded-lg px-3 py-1 font-medium text-[15px] text-black/80 tracking-tighter transition-all duration-200 hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/5"
                    href="/docs/components/action-search-bar"
                  >
                    Components
                  </ViewTransitionsLink>
                  <Link
                    className="flex items-center gap-1 rounded-lg px-3 py-1 font-medium text-[15px] text-black/80 tracking-tighter transition-all duration-200 hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/5"
                    href="https://kokonutui.pro/templates?utm_source=kokonutui.com&utm_medium=header"
                    target="_blank"
                  >
                    Templates
                  </Link>
                  <ViewTransitionsLink
                    className="flex items-center gap-1 rounded-lg px-3 py-1 font-medium text-[15px] text-black/80 tracking-tighter transition-all duration-200 hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/5"
                    href="/#testimonials"
                  >
                    Testimonials
                  </ViewTransitionsLink>
                </div>
              </div>

              <div className="hidden items-center gap-3 sm:flex">
                <Link
                  className="group relative inline-flex items-center gap-2 rounded-md border border-transparent px-3 py-1.5 text-sm text-zinc-600 transition-all hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                  href="https://github.com/kokonut-labs/kokonutui"
                  target="_blank"
                >
                  <div className="relative flex w-full items-center gap-2">
                    <svg
                      className="h-4 w-4 text-black dark:text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <title>Github</title>
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                    <Suspense fallback={<StarCountSkeleton />}>
                      <GithubStars />
                    </Suspense>
                  </div>
                </Link>
                <Link
                  className="group relative inline-flex items-center gap-2 rounded-md border border-transparent px-2 py-2 text-sm text-zinc-600 transition-all hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                  href="https://x.com/dorianbaffier"
                  target="_blank"
                >
                  <svg
                    className="h-4 w-4 text-zinc-600 dark:text-zinc-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <title>X</title>
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </Link>
                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                <ThemeToggle />
              </div>

              <div className="flex items-center gap-4 sm:hidden">
                <ViewTransitionsLink
                  className="rounded-md border border-transparent px-3 py-1.5 text-sm text-zinc-600 transition-all hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                  href="/docs/components/action-search-bar"
                >
                  Components
                </ViewTransitionsLink>
                <ViewTransitionsLink
                  className="rounded-md border border-transparent px-3 py-1.5 text-sm text-zinc-600 transition-all hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                  href="https://kokonutui.pro/templates?utm_source=kokonutui.com&utm_medium=header"
                  target="_blank"
                >
                  Templates
                </ViewTransitionsLink>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
