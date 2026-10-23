"use client";

import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { Suspense, useState } from "react";
import { cn } from "@/lib/utils";
import { CoverActions, CoverMeta, PlateFoot } from "./catalog";
import { HERO_IDS, type HeroId } from "./hero-ids";
import { Fit, LIVE, LiveFallback } from "./live";
import type { Part } from "./parts";
import {
  CELL,
  EASE_COLORS,
  enter,
  FOCUS,
  FOCUS_INSET,
  GRID,
  INK,
  LEAF,
  LINE,
  META,
  MONO,
  SOFT,
} from "./styles";

/*
 * Hero prototypes that lead with the AI components. Each one keeps the
 * catalog's language (hairline grid, square corners, live parts at their own
 * size) and only changes what the cover shows first.
 */

const BROWSE = "attract-button";
const META_LABELS = [
  "Kokonut UI",
  "Components for AI apps",
  "React, Tailwind CSS, Motion",
  "Free and open source",
];

interface HeroProps {
  parts: Part[];
}

function useParts(parts: Part[]) {
  const byName = new Map(parts.map((p) => [p.name, p]));
  const pick = (names: string[]) =>
    names
      .map((name) => byName.get(name))
      .filter((p): p is Part => Boolean(p && LIVE[p.name]));
  return {
    byName,
    pick,
    aiCount: parts.filter((p) => p.code.startsWith("AI")).length,
  };
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label="Kokonut UI"
      className={cn("grid grid-cols-1 border", GRID, LINE)}
    >
      {children}
    </section>
  );
}

function Headline({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h1
      // Size comes in through className, so leading goes after it: a font
      // size class would otherwise drop it in cn().
      className={cn(
        "home-enter font-semibold",
        INK,
        className,
        "leading-[0.9] tracking-[-0.06em]"
      )}
      style={enter(0)}
    >
      {children}
    </h1>
  );
}

function Lede({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "home-enter max-w-[520px] text-pretty text-[17px] leading-relaxed",
        SOFT,
        className
      )}
      style={enter(1)}
    >
      {children}
    </p>
  );
}

/** One live AI part in a cell: code and hint on top, name and install below. */
function Tile({
  part,
  label,
  height,
  className,
}: {
  part: Part;
  /** Replaces the code in the corner, e.g. a step name. */
  label?: string;
  height: string;
  className?: string;
}) {
  const { Component: Demo, hint } = LIVE[part.name];
  return (
    <figure
      className={cn("home-enter flex flex-col", CELL, className)}
      style={enter(1)}
    >
      <TileHead code={part.code} hint={hint} label={label} />
      <div className={cn("relative flex-1", height)}>
        <Fit className="px-5 py-4">
          <Suspense fallback={<LiveFallback />}>
            <Demo />
          </Suspense>
        </Fit>
      </div>
      <PlateFoot part={part} />
    </figure>
  );
}

function TileHead({
  code,
  hint,
  label,
}: {
  code: string;
  hint: string;
  label?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 pt-3.5">
      <span className="flex shrink-0 items-baseline gap-2">
        <span className={cn(MONO, "font-medium text-[12px]", LEAF)}>
          {code}
        </span>
        {label ? (
          <span className={cn(MONO, "text-[12px]", INK)}>{label}</span>
        ) : null}
      </span>
      <span className={cn(META, "truncate")}>{hint}</span>
    </div>
  );
}

/* A. Switcher ----------------------------------------------------------- */

const SWITCH = [
  { name: "ai-tool-approval", label: "Approve" },
  { name: "ai-diff-review", label: "Review" },
  { name: "ai-context-meter", label: "Context" },
  { name: "ai-model-selector", label: "Model" },
  { name: "ai-citations", label: "Cite" },
];

/**
 * The current cover, with the featured plate turned into a small switcher
 * over five AI parts. The headline stays the brand line.
 */
export function HeroSwitcher({ parts }: HeroProps) {
  const { byName, aiCount } = useParts(parts);
  const items = SWITCH.filter((s) => byName.has(s.name));
  const [active, setActive] = useState(items[0]?.name ?? "");
  const part = byName.get(active);
  const entry = part ? LIVE[part.name] : undefined;

  return (
    <Frame>
      <CoverMeta labels={META_LABELS} />
      <div className={cn("grid grid-cols-1 lg:grid-cols-12", GRID)}>
        <div
          className={cn(
            "flex flex-col justify-between gap-10 p-5 sm:p-8 lg:col-span-7 lg:p-10",
            CELL
          )}
        >
          <Headline className="text-[clamp(52px,7.4vw,104px)]">
            Components <br />
            that feel right.
          </Headline>
          <Lede>
            Open-source React components for the apps people build with AI now:
            tool calls to approve, diffs to review, context to keep an eye on.{" "}
            {aiCount} AI components, all live on this page, each one install
            away.
          </Lede>
        </div>
        <figure
          className={cn(
            "home-enter flex min-h-[460px] flex-col lg:col-span-5",
            CELL
          )}
          style={enter(1)}
        >
          <div
            aria-label="AI components"
            className={cn("grid grid-cols-5 border-b", GRID, LINE)}
            role="tablist"
          >
            {items.map((item) => {
              const selected = item.name === active;
              return (
                <button
                  aria-selected={selected}
                  className={cn(
                    MONO,
                    "h-9 px-2 text-[11.5px]",
                    CELL,
                    selected
                      ? "bg-[#f4f4f4] text-black dark:bg-[#161616] dark:text-white"
                      : "text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white",
                    EASE_COLORS,
                    FOCUS_INSET
                  )}
                  key={item.name}
                  onClick={() => setActive(item.name)}
                  role="tab"
                  type="button"
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          {part && entry ? (
            <>
              <TileHead code={part.code} hint={entry.hint} />
              <div className="relative min-h-[320px] flex-1" role="tabpanel">
                <Fit className="px-6 py-5">
                  <Suspense fallback={<LiveFallback />}>
                    <entry.Component key={part.name} />
                  </Suspense>
                </Fit>
              </div>
              <PlateFoot part={part} />
            </>
          ) : null}
        </figure>
      </div>
      <CoverActions
        browse={byName.get(BROWSE)}
        count={parts.length}
        prompt={`Add @kokonutui/${active} to my chat screen`}
      />
    </Frame>
  );
}

/* B. Agent flow --------------------------------------------------------- */

const FLOW = [
  { name: "ai-input-search", label: "Ask" },
  { name: "ai-tool-approval", label: "Approve" },
  { name: "ai-diff-review", label: "Review" },
];

/**
 * One agent turn told in three live parts, left to right: ask, approve the
 * tool call, review the change.
 */
export function HeroFlow({ parts }: HeroProps) {
  const { byName } = useParts(parts);
  const steps = FLOW.flatMap((s) => {
    const part = byName.get(s.name);
    return part && LIVE[part.name] ? [{ ...s, part }] : [];
  });

  return (
    <Frame>
      <CoverMeta labels={META_LABELS} />
      <div className={cn("grid grid-cols-1 lg:grid-cols-12", GRID)}>
        <div className={cn("p-5 sm:p-8 lg:col-span-8 lg:p-10", CELL)}>
          <Headline className="text-[clamp(48px,8vw,112px)]">
            AI components <br />
            that feel right.
          </Headline>
        </div>
        <div
          className={cn(
            "flex items-end p-5 sm:p-8 lg:col-span-4 lg:p-10",
            CELL
          )}
        >
          <Lede>
            Everything around the model: the input, the tool call that needs a
            yes, the diff that needs a look. Open source, built with Tailwind
            CSS and Motion, and yours to edit.
          </Lede>
        </div>
      </div>
      <div className={cn("grid grid-cols-1 md:grid-cols-3", GRID)}>
        {steps.map((s, i) => (
          <Tile
            height="min-h-[340px]"
            key={s.name}
            label={`${i + 1}. ${s.label}`}
            part={s.part}
          />
        ))}
      </div>
      <CoverActions
        browse={byName.get(BROWSE)}
        count={parts.length}
        prompt="Add @kokonutui/ai-tool-approval to my agent's chat"
      />
    </Frame>
  );
}

/* C. Prompt first ------------------------------------------------------- */

const MORE_AI = [
  "ai-tool-approval",
  "ai-diff-review",
  "ai-context-meter",
  "ai-model-selector",
  "ai-citations",
  "ai-message-queue",
  "ai-inline-edit",
  "ai-agent-lanes",
];

/**
 * A quiet, centered cover: the headline, then the search input at full size
 * as the one thing to try, then the rest of the AI shelf as an index.
 */
export function HeroPrompt({ parts }: HeroProps) {
  const { byName } = useParts(parts);
  const search = byName.get("ai-input-search");
  const more = MORE_AI.flatMap((name) => {
    const p = byName.get(name);
    return p ? [p] : [];
  });
  const entry = search ? LIVE[search.name] : undefined;

  return (
    <Frame>
      <CoverMeta labels={META_LABELS} />
      <div
        className={cn(
          "flex flex-col items-center gap-8 px-5 pt-14 pb-10 text-center sm:px-8 md:pt-20",
          CELL
        )}
      >
        <Headline className="text-[clamp(44px,7vw,96px)]">
          Components <br />
          for AI apps.
        </Headline>
        <Lede className="text-balance text-center">
          The input, the answer and everything an agent asks of the person in
          between. Open-source React parts, live on this page. Try the one
          below.
        </Lede>
        {search && entry ? (
          <div
            className="home-enter flex w-full max-w-[600px] flex-col gap-3 pt-4"
            style={enter(2)}
          >
            <p className="flex items-baseline justify-between gap-4 px-1">
              <span className={cn(MONO, "font-medium text-[12px]", LEAF)}>
                {search.code}
              </span>
              <span className={META}>{entry.hint}</span>
            </p>
            {/* Tall enough for the tool menu to open without being cut. */}
            <div className="relative h-[300px] text-left">
              <Fit className="items-start">
                <Suspense fallback={<LiveFallback />}>
                  <entry.Component />
                </Suspense>
              </Fit>
            </div>
          </div>
        ) : null}
      </div>
      <div className={cn("grid grid-cols-2 md:grid-cols-4", GRID)}>
        {more.map((p) => (
          <Link
            className={cn(
              "group flex flex-col gap-1 p-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
              CELL,
              EASE_COLORS,
              FOCUS_INSET
            )}
            href={p.url}
            key={p.name}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className={cn(MONO, "font-medium text-[11.5px]", LEAF)}>
                {p.code}
              </span>
              <ArrowUpRightIcon
                aria-hidden
                className="size-3.5 text-black/30 group-hover:text-black dark:text-white/30 dark:group-hover:text-white"
              />
            </span>
            <span
              className={cn("font-medium text-[15px] tracking-[-0.01em]", INK)}
            >
              {p.title}
            </span>
            <span className={cn(META, "truncate")}>{LIVE[p.name]?.hint}</span>
          </Link>
        ))}
      </div>
      <CoverActions
        browse={byName.get(BROWSE)}
        count={parts.length}
        prompt="Add @kokonutui/ai-input-search to my search page"
      />
    </Frame>
  );
}

/* D. Desk --------------------------------------------------------------- */

/**
 * A working desk: the writing surface with inline edit takes the big cell,
 * citations and tool approval sit beside it, all live at their own size.
 */
export function HeroDesk({ parts }: HeroProps) {
  const { byName, pick } = useParts(parts);
  const [edit, cite, approve] = pick([
    "ai-inline-edit",
    "ai-citations",
    "ai-tool-approval",
  ]);

  return (
    <Frame>
      <CoverMeta labels={META_LABELS} />
      <div className={cn("grid grid-cols-1 lg:grid-cols-12", GRID)}>
        <div className={cn("p-5 sm:p-8 lg:col-span-7 lg:p-10", CELL)}>
          <Headline className="text-[clamp(48px,7.6vw,104px)]">
            Components <br />
            that feel right.
          </Headline>
        </div>
        <div
          className={cn(
            "flex flex-col justify-end gap-5 p-5 sm:p-8 lg:col-span-5 lg:p-10",
            CELL
          )}
        >
          <Lede>
            Select a sentence and ask for a rewrite. Hover a source. Approve a
            command. These are the AI components, running, and each installs as
            a single file you own.
          </Lede>
          <Link
            className={cn(
              META,
              "group inline-flex w-fit items-center gap-1.5 rounded-sm hover:text-black dark:hover:text-white",
              EASE_COLORS,
              FOCUS
            )}
            href="/docs/ai/ai-input-search"
          >
            All AI components
            <ArrowUpRightIcon aria-hidden className="size-3" />
          </Link>
        </div>
      </div>
      <div className={cn("grid grid-cols-1 lg:grid-cols-12", GRID)}>
        {edit ? (
          <Tile
            className="lg:col-span-7 lg:row-span-2"
            height="min-h-[420px] lg:min-h-[560px]"
            part={edit}
          />
        ) : null}
        {cite ? (
          <Tile className="lg:col-span-5" height="min-h-[260px]" part={cite} />
        ) : null}
        {approve ? (
          <Tile
            className="lg:col-span-5"
            height="min-h-[260px]"
            part={approve}
          />
        ) : null}
      </div>
      <CoverActions
        browse={byName.get(BROWSE)}
        count={parts.length}
        prompt="Add @kokonutui/ai-inline-edit to my editor"
      />
    </Frame>
  );
}

const HEROES = {
  a: { title: "Switcher", Hero: HeroSwitcher },
  b: { title: "Agent flow", Hero: HeroFlow },
  c: { title: "Prompt first", Hero: HeroPrompt },
  d: { title: "Desk", Hero: HeroDesk },
} as const;

/** A prototype hero with a plain switcher above it, for comparing them. */
export function HeroPrototype({ id, parts }: { id: HeroId; parts: Part[] }) {
  const { Hero } = HEROES[id];
  return (
    <>
      <nav
        aria-label="Hero prototypes"
        className={cn(
          "mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-2",
          META
        )}
      >
        <span>Hero prototypes</span>
        <Link className="hover:text-black dark:hover:text-white" href="/">
          Current
        </Link>
        {HERO_IDS.map((key) => (
          <Link
            aria-current={key === id ? "page" : undefined}
            className={cn(
              "hover:text-black dark:hover:text-white",
              key === id &&
                "text-black underline underline-offset-4 dark:text-white"
            )}
            href={`/hero/${key}`}
            key={key}
          >
            {key.toUpperCase()}. {HEROES[key].title}
          </Link>
        ))}
      </nav>
      <Hero parts={parts} />
    </>
  );
}
