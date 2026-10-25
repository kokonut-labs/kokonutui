"use client";

import { ArrowRightIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useId, useState } from "react";
import { cn } from "@/lib/utils";
import { CopyLine } from "../home/controls";
import { installCommand, mcpCommand, VERCEL_OSS_URL } from "../home/data";
import type { Part } from "../home/parts";
import {
  CELL,
  EASE_COLORS,
  FOCUS,
  FOCUS_INSET,
  GRID,
  INK,
  LEAF,
  LINE,
  MONO,
  SOFT,
} from "../home/styles";
import {
  BrowseButton,
  DEMOS,
  Demo,
  type DemoName,
  Faq,
  FinalCta,
  META,
  PartLinks,
  Proof,
  SectionHead,
  Tagline,
  USE_CASES,
} from "./shared";

const FIRST = "ai-tool-approval";

/**
 * B: Find a component. A minimal page for people who arrive knowing what
 * they need: the hero is a working search over the whole library, with the
 * selected component running beside the results.
 */
export function ProposalB({ parts }: { parts: Part[] }) {
  const byName = new Map(parts.map((p) => [p.name, p]));
  const count = parts.length;
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-8 pb-32 sm:px-6 md:pt-12">
      <header className="flex flex-col gap-6 pb-8 md:flex-row md:items-end md:justify-between">
        <div className="flex max-w-[680px] flex-col gap-4">
          <h1
            className={cn(
              "home-enter text-balance font-semibold text-5xl tracking-tighter sm:text-6xl",
              INK
            )}
          >
            Find the component <br className="hidden sm:block" />
            your screen is missing
          </h1>
          <p className={cn("home-enter text-pretty text-lg", SOFT)}>
            Search {count} free React components for shadcn/ui by name or by
            what you are building. The one you pick runs right here.
          </p>
        </div>
        <p className={cn("home-enter shrink-0 text-sm", SOFT)}>
          MIT licensed ·{" "}
          <a
            className={cn(
              "rounded-sm underline decoration-black/20 underline-offset-4 hover:decoration-black dark:decoration-white/25 dark:hover:decoration-white",
              INK,
              EASE_COLORS,
              FOCUS
            )}
            href={VERCEL_OSS_URL}
            rel="noreferrer"
            target="_blank"
          >
            Backed by Vercel OSS
          </a>
        </p>
      </header>
      <Finder parts={parts} />
      <Tagline
        lines={[
          "Every component runs before you install it.",
          "None of them is a screenshot.",
        ]}
      />
      <UseCases byName={byName} />
      <Install />
      <Proof />
      <Faq />
      <FinalCta
        action={<BrowseButton count={count} />}
        body="Every component has its own page with a live demo, its props and the one command that installs it."
        title="Find the component your screen is missing"
      />
    </div>
  );
}

function matches(p: Part, q: string) {
  return `${p.title} ${p.category} ${p.description ?? ""} ${p.name}`
    .toLowerCase()
    .includes(q);
}

function Finder({ parts }: { parts: Part[] }) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>("AI");
  const [selected, setSelected] = useState(FIRST);
  const deferred = useDeferredValue(query.trim().toLowerCase());

  const categories = [...new Set(parts.map((p) => p.category))];
  const results = parts.filter(
    (p) =>
      (category === null || p.category === category) &&
      (deferred === "" || matches(p, deferred))
  );
  const part = parts.find((p) => p.name === selected) ?? results[0];
  const isLive = part ? part.name in DEMOS : false;

  return (
    <section
      aria-label="Search components"
      className={cn(
        "home-enter grid grid-cols-1 border lg:grid-cols-12",
        GRID,
        LINE
      )}
      id="find"
    >
      <div className={cn("flex min-w-0 flex-col lg:col-span-5", CELL)}>
        <label
          className={cn(
            "flex items-center gap-3 border-b px-4 focus-within:bg-black/[0.02] dark:focus-within:bg-white/[0.03]",
            LINE,
            EASE_COLORS
          )}
          htmlFor={inputId}
        >
          <SearchIcon
            aria-hidden
            className="size-4 shrink-0 text-black/40 dark:text-white/40"
          />
          <span className="sr-only">Search components</span>
          <input
            autoComplete="off"
            className={cn(
              "h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-black/40 dark:placeholder:text-white/40",
              INK
            )}
            id={inputId}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try “confirm”, “chart” or “AI”"
            type="search"
            value={query}
          />
          <span className={META}>{results.length}</span>
        </label>
        <fieldset
          className={cn(
            "m-0 flex min-w-0 flex-wrap gap-2 border-0 border-b p-4",
            LINE
          )}
        >
          <legend className="sr-only">Category</legend>
          {[null, ...categories].map((c) => (
            <button
              aria-pressed={category === c}
              className={cn(
                "h-8 border px-3 text-sm",
                category === c
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-black/[0.13] text-black/60 hover:border-black/30 hover:text-black dark:border-white/[0.14] dark:text-white/60 dark:hover:border-white/35 dark:hover:text-white",
                EASE_COLORS,
                FOCUS
              )}
              key={c ?? "all"}
              onClick={() => setCategory(c)}
              type="button"
            >
              {c ?? "All"}
            </button>
          ))}
        </fieldset>
        <ul
          aria-label="Results"
          className="h-96 overflow-y-auto overscroll-contain p-2 lg:h-[464px]"
        >
          {results.length === 0 ? (
            <li className={cn("flex flex-col gap-2 p-4 text-sm", SOFT)}>
              <span className={INK}>Nothing matches “{query}”.</span>
              Try a broader word, or ask for it on GitHub.
            </li>
          ) : null}
          {results.map((p) => {
            const on = part?.name === p.name;
            return (
              <li key={p.name}>
                <button
                  aria-pressed={on}
                  className={cn(
                    "flex w-full items-baseline gap-3 px-2 py-2 text-left text-sm",
                    on
                      ? "bg-black/[0.05] text-black dark:bg-white/[0.08] dark:text-white"
                      : "text-black/70 hover:bg-black/[0.03] hover:text-black dark:text-white/70 dark:hover:bg-white/[0.05] dark:hover:text-white",
                    EASE_COLORS,
                    FOCUS_INSET
                  )}
                  onClick={() => setSelected(p.name)}
                  type="button"
                >
                  <span
                    className={cn(
                      MONO,
                      "w-12 shrink-0 text-xs",
                      on ? LEAF : "text-black/35 dark:text-white/35"
                    )}
                  >
                    {p.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  <span className={cn(META, "hidden shrink-0 sm:inline")}>
                    {p.category}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {part ? (
        <figure className={cn("flex min-w-0 flex-col lg:col-span-7", CELL)}>
          <div className="flex items-baseline justify-between gap-4 px-4 pt-4">
            <span
              className={cn(
                MONO,
                "shrink-0 whitespace-nowrap font-medium text-xs",
                LEAF
              )}
            >
              {part.code}
            </span>
            <span className={cn(META, "truncate")}>
              {isLive ? DEMOS[part.name as DemoName].hint : part.category}
            </span>
          </div>
          {isLive ? (
            <Demo
              className="h-96 lg:h-[440px]"
              key={part.name}
              name={part.name}
            />
          ) : (
            <div className="flex h-96 flex-col items-center justify-center gap-4 p-8 text-center lg:h-[440px]">
              <p className={cn("max-w-[400px] text-pretty text-base", SOFT)}>
                {part.description}
              </p>
              <Link
                className={cn(
                  "inline-flex items-center gap-2 rounded-sm text-sm underline-offset-4 hover:underline",
                  INK,
                  FOCUS
                )}
                href={part.url}
              >
                Try it on its page
                <ArrowRightIcon aria-hidden className="size-4" />
              </Link>
            </div>
          )}
          <figcaption
            className={cn(
              "flex flex-col gap-4 border-t p-4 sm:flex-row sm:items-end sm:justify-between",
              LINE
            )}
          >
            <span className="flex min-w-0 flex-col gap-1">
              <Link
                className={cn(
                  "w-fit rounded-sm font-semibold text-xl tracking-tight underline-offset-4 hover:underline",
                  INK,
                  FOCUS
                )}
                href={part.url}
              >
                {part.title}
              </Link>
              <span className={cn(META, "truncate")}>
                {part.dependencies.length
                  ? part.dependencies.join(", ")
                  : "no extra packages"}
              </span>
            </span>
            <CopyLine
              className={cn("text-sm sm:max-w-[360px]", INK)}
              prefix="$"
              value={installCommand(part.name)}
            />
          </figcaption>
        </figure>
      ) : null}
    </section>
  );
}

function UseCases({ byName }: { byName: Map<string, Part> }) {
  return (
    <section aria-labelledby="use-cases">
      <SectionHead
        aside="Start from the screen you are building. Each name opens a live demo."
        id="use-cases"
        title="Components by use case"
      />
      <ul className={cn("grid grid-cols-1 border", GRID, LINE)}>
        {USE_CASES.map((u) => (
          <li
            className={cn(
              "grid grid-cols-1 gap-4 p-6 md:grid-cols-12 md:gap-8",
              CELL
            )}
            key={u.title}
          >
            <h3
              className={cn(
                "font-semibold text-xl tracking-tight md:col-span-4",
                INK
              )}
            >
              {u.title}
            </h3>
            <p className={cn("text-pretty text-base md:col-span-4", SOFT)}>
              {u.body}
            </p>
            <div className="md:col-span-4">
              <PartLinks byName={byName} names={u.names} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Install() {
  return (
    <section aria-labelledby="install" className="pt-24 md:pt-32">
      <SectionHead
        aside="Kokonut UI is a shadcn registry. Components arrive as source, with their packages installed."
        id="install"
        title="How it works"
      />
      <ol className={cn("grid grid-cols-1 border md:grid-cols-3", GRID, LINE)}>
        {[
          {
            title: "Find it",
            body: "Search above or browse the docs. Every component runs live on its page.",
            prefix: "→",
            value: "kokonutui.com/docs",
          },
          {
            title: "Connect your editor once",
            body: "Claude Code, Cursor, VS Code and Codex install components through the shadcn MCP server.",
            prefix: "$",
            value: mcpCommand("claude"),
          },
          {
            title: "Ask for it, or run one command",
            body: "The file lands in components/kokonutui, ready to edit.",
            prefix: "$",
            value: installCommand("slide-to-confirm"),
          },
        ].map((s, i) => (
          <li
            className={cn("flex min-h-64 flex-col gap-4 p-6", CELL)}
            key={s.title}
          >
            <span
              className={cn(
                MONO,
                "shrink-0 whitespace-nowrap font-medium text-xs",
                LEAF
              )}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className={cn("font-semibold text-xl tracking-tight", INK)}>
              {s.title}
            </h3>
            <p className={cn("text-pretty text-base", SOFT)}>{s.body}</p>
            <CopyLine
              className={cn("mt-auto text-sm", INK)}
              prefix={s.prefix}
              value={s.value}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
