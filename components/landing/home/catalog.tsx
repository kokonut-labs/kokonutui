"use client";

import { useSearchContext } from "fumadocs-ui/contexts/search";
import { ArrowUpRightIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type ComponentType, type ReactNode, Suspense, useState } from "react";
import { HoverLink } from "@/components/hover-link";
import CommandButton from "@/components/kokonutui/command-button";
import SlideTextButton from "@/components/kokonutui/slide-text-button";
import { componentPrompt, SETUP_PROMPT } from "@/lib/agents";
import {
  PRO_SHOWCASE,
  PRO_SHOWCASE_PAGE,
  PRO_STATS,
  showcaseStill,
  showcaseUrl,
} from "@/lib/pro-showcase";
import { PRO_TEMPLATE_LIST, PRO_TEMPLATES_PAGE } from "@/lib/pro-templates";
import { cn } from "@/lib/utils";
import {
  AGENTS,
  type AgentId,
  AgentSession,
  AgentTabs,
  runPrompt,
} from "./agents";
import { AgentIcon, Avatar, CopyIconSwap, useCopy } from "./client";
import { CopyLine } from "./controls";
import {
  GITHUB_URL,
  installCommand,
  mcpCommand,
  POSTS,
  PRO_INCLUDED,
  PRO_LANDING_URL,
  PRO_PRICE,
  PRO_STILLS,
  V0_THREAD,
  VERCEL_OSS_URL,
  VIDEO_ID,
} from "./data";
import { Fit, LIVE, LiveFallback, useNearViewport } from "./live";
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
import { VideoCard } from "./video";

/**
 * One order told in three live parts, left to right: pay in the chat, the
 * receipt prints, the courier arrives. The agent session above installs
 * exactly these.
 */
const ORDER = [
  { name: "ai-checkout", label: "Pay", room: "min-h-[460px]" },
  { name: "receipt-printer", label: "Receipt", room: "min-h-[460px]" },
  { name: "ai-order-status", label: "Track", room: "min-h-[460px]" },
];

/** Rows of one app screen each, every row mixing AI and UI parts. */
const SCREENS = [
  {
    id: "trip",
    title: "A trip",
    line: "The assistant finds the hotel, you pick the nights, the pass keeps itself current.",
    names: ["ai-tool-calls", "stay-picker", "boarding-pass"],
    room: "h-[480px]",
  },
  {
    id: "money",
    title: "Money",
    line: "See where it went, hand a double charge to a person, send what you owe.",
    names: ["spending-ring", "ai-handoff", "amount-pad"],
    room: "h-[460px]",
  },
  {
    id: "work",
    title: "Work",
    line: "Find a time for both calendars, send the draft, watch the number move.",
    names: ["ai-schedule", "ai-send", "metric-card"],
    room: "h-[480px]",
  },
];

/** What to ask once a project is set up: an AI part and a UI part together. */
const MIXED_PROMPT =
  "Add a chat input with a model picker and a slide-to-pay button from @kokonutui";

/** Files the site serves for agents, linked so people can read them too. */
const READS = [
  { path: "/setup.md", line: "Setup steps, written for an agent" },
  { path: "/llms.txt", line: "Every docs page, one line each" },
  { path: "/r/registry.json", line: "The registry the shadcn CLI reads" },
  {
    path: "/docs/ai/ai-checkout.md",
    line: "Any docs page as Markdown, source included",
  },
];

type PickParts = (names: string[]) => Part[];

export function Catalog({
  parts,
  className,
}: {
  parts: Part[];
  className?: string;
}) {
  const byName = new Map(parts.map((p) => [p.name, p]));
  const pick: PickParts = (names) =>
    names
      .map((name) => byName.get(name))
      .filter((p): p is Part => Boolean(p && LIVE[p.name]));
  const steps = ORDER.flatMap((step) => {
    const part = pick([step.name])[0];
    return part ? [{ ...step, part }] : [];
  });

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1280px] px-4 pt-8 pb-32 sm:px-6 md:pt-12",
        className
      )}
    >
      <Cover count={parts.length} steps={steps} />
      <Screens pick={pick} />
      <Agents />
      <Index parts={parts} />
      <References />
      <Supplement />
    </div>
  );
}

/* Cover ---------------------------------------------------------------- */

interface FlowStep {
  label: string;
  part: Part;
  /** Height that shows the part at its own size; the row takes the tallest. */
  room: string;
}

/**
 * In bands: the meta row, the headline across the full width, then the
 * pitch and the ways in beside the agent session, then the order it installs,
 * live.
 */
function Cover({ steps, count }: { steps: FlowStep[]; count: number }) {
  return (
    <section
      aria-label="Kokonut UI"
      className={cn("grid grid-cols-1 border", GRID, LINE)}
    >
      <div className={cn("grid grid-cols-2 md:grid-cols-4", GRID)}>
        {[
          "Kokonut UI",
          "UI and AI components",
          "React, Tailwind CSS, Motion",
        ].map((label, i) => (
          <p
            className={cn(
              "home-enter flex h-10 items-center px-4",
              CELL,
              i === 0
                ? "font-medium text-[11.5px] text-black dark:text-white"
                : META
            )}
            key={label}
            style={enter(0)}
          >
            {label}
          </p>
        ))}
        <VercelMeta />
      </div>

      <div className={cn("px-5 pt-8 pb-6 sm:px-8 sm:pt-12 lg:px-10", CELL)}>
        <h1
          className={cn(
            "home-enter font-semibold text-[clamp(40px,12.5vw,52px)] leading-[0.9] tracking-[-0.06em] sm:text-[clamp(52px,7.8vw,112px)]",
            INK
          )}
          style={enter(0)}
        >
          {/* The space keeps the words apart for crawlers and screen readers. */}
          UI and AI components <br />
          that feel right.
        </h1>
      </div>

      <div className={cn("grid grid-cols-1 lg:grid-cols-12", GRID)}>
        <div
          className={cn(
            "flex flex-col justify-between gap-8 p-5 sm:p-8 lg:col-span-7 lg:px-10 lg:py-9",
            CELL
          )}
        >
          <p
            className="home-enter max-w-[640px] text-pretty text-[19px] leading-[1.45] tracking-[-0.01em] sm:text-[22px]"
            style={enter(1)}
          >
            <span className={INK}>
              Open-source React components for the chat and the app around it,
              made to sit on the same screen.
            </span>{" "}
            <span className={SOFT}>
              Install them with the shadcn CLI, or ask your agent to.
            </span>
          </p>
          <HeroActions count={count} />
        </div>
        <AgentSession
          className="lg:col-span-5"
          parts={steps.map((step) => step.part)}
        />
      </div>

      <div className={cn("grid grid-cols-1 lg:grid-cols-3", GRID)}>
        {steps.map((step, i) => (
          <FlowPlate
            key={step.part.name}
            label={`${i + 1}. ${step.label}`}
            part={step.part}
            room={step.room}
          />
        ))}
      </div>
    </section>
  );
}

/** Vercel's open-source program, which backs the project; the meta row's last cell. */
function VercelMeta() {
  return (
    <a
      className={cn(
        "home-enter group flex h-10 items-center justify-between gap-3 px-4",
        CELL,
        META,
        "hover:text-black dark:hover:text-white",
        EASE_COLORS,
        FOCUS_INSET
      )}
      href={VERCEL_OSS_URL}
      rel="noreferrer"
      style={enter(0)}
      target="_blank"
    >
      <span>
        <span className="hidden sm:inline">Backed by </span>Vercel OSS
      </span>
      <svg
        aria-hidden="true"
        className="size-3"
        fill="currentColor"
        viewBox="0 0 76 65"
      >
        <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
      </svg>
    </a>
  );
}

/**
 * The two ways into the library, each drawn with a Kokonut button: Slide Text
 * Button opens the docs, Command Button opens search (and answers ⌘K).
 */
function HeroActions({ count }: { count: number }) {
  const { setOpenSearch } = useSearchContext();
  return (
    <div
      className="home-enter flex flex-wrap items-center gap-3"
      style={enter(2)}
    >
      <SlideTextButton
        animateIn={false}
        className="rounded-full px-5 text-[15px] tracking-[-0.01em] active:scale-100 md:min-w-0"
        hoverText="Open the docs"
        href="/docs"
        text={`Browse ${count} components`}
      />
      {/* data-search-intent: pointing at it starts loading the search code. */}
      <span className="contents" data-search-intent>
        <CommandButton
          className="rounded-full border-black/[0.13] bg-white pl-4 text-black/70 hover:border-black/30 hover:bg-white hover:text-black dark:border-white/[0.14] dark:bg-black dark:text-white/70 dark:hover:border-white/35 dark:hover:bg-black dark:hover:text-white"
          onClick={() => setOpenSearch(true)}
        >
          Search
        </CommandButton>
      </span>
    </div>
  );
}

/** One step of the cover's order: a live part under its step name. */
function FlowPlate({
  part,
  label,
  room,
}: Pick<FlowStep, "part" | "room"> & { label: string }) {
  const { Component: Demo, hint } = LIVE[part.name];
  return (
    <figure className={cn("home-enter flex flex-col", CELL)} style={enter(1)}>
      <div className="flex items-baseline justify-between gap-4 px-4 pt-3.5">
        <span className="flex shrink-0 items-baseline gap-2">
          <span className={cn(MONO, "font-medium text-[12px]", LEAF)}>
            {part.code}
          </span>
          <span className={cn(MONO, "text-[12px]", INK)}>{label}</span>
        </span>
        <span className={cn(META, "truncate")}>{hint}</span>
      </div>
      <div className={cn("relative flex-1", room)}>
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

/* Screens -------------------------------------------------------------- */

/** Rows of one app screen each, AI and UI parts side by side. */
function Screens({ pick }: { pick: PickParts }) {
  return (
    <section aria-labelledby="screens" className="pt-24 md:pt-32">
      <SectionHead
        aside="Each row is one screen of a real app: the assistant's part and the controls around it, live and installable on their own."
        id="screens"
        number="01"
        title="AI and UI, together"
      />
      <div className={cn("grid grid-cols-1 border", GRID, LINE)}>
        {SCREENS.map((screen) => {
          const row = pick(screen.names);
          return (
            <section
              aria-labelledby={`screen-${screen.id}`}
              className={cn("grid grid-cols-1", GRID)}
              key={screen.id}
            >
              <div
                className={cn(
                  "flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6",
                  CELL
                )}
              >
                <p className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                  <span
                    className={cn("shrink-0 font-medium text-[17px]", INK)}
                    id={`screen-${screen.id}`}
                  >
                    {screen.title}
                  </span>
                  <span className={cn("text-[14px]", SOFT)}>{screen.line}</span>
                </p>
                <span className={cn(META, "shrink-0")}>
                  {row.map((p) => p.code).join(" + ")}
                </span>
              </div>
              <div className={cn("grid grid-cols-1 lg:grid-cols-3", GRID)}>
                {row.map((part) => (
                  <Plate key={part.name} part={part} room={screen.room} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

/* Agents --------------------------------------------------------------- */

/**
 * Pick your agent, get its three lines: the setup prompt, the MCP server (or
 * the index, for agents without one) and a first thing to ask for.
 */
export function Agents({ number = "02" }: { number?: string }) {
  const [id, setId] = useState<AgentId>("claude");
  const agent = AGENTS.find((a) => a.id === id) ?? AGENTS[0];
  const steps = [
    {
      title: "Set it up with one prompt",
      note: "It reads the steps at /setup.md: registry, MCP server and rules.",
      line: (
        <CopyLine
          className={cn("text-[13px]", INK)}
          label="setup prompt"
          prefix="›"
          value={SETUP_PROMPT}
        />
      ),
    },
    id === "any"
      ? {
          title: "Or point it at the index",
          note: "Every page as Markdown, for agents without an MCP client.",
          line: (
            <CopyLine
              className={cn("text-[13px]", INK)}
              value="https://kokonutui.com/llms.txt"
            />
          ),
        }
      : {
          title: "Connect the shadcn MCP server",
          note: `So ${agent.label} can browse the registry and install from it.`,
          line: (
            <CopyLine
              className={cn("text-[13px]", INK)}
              prefix="$"
              value={mcpCommand(id)}
            />
          ),
        },
    {
      title: "Then ask in plain words",
      note: "AI parts and UI parts come from the same registry.",
      line: (
        <CopyLine
          className={cn("text-[13px]", INK)}
          label="prompt"
          prefix={agent.cli ? "$" : "›"}
          value={runPrompt(agent, MIXED_PROMPT)}
        />
      ),
    },
  ];

  return (
    <section aria-labelledby="agents" className="pt-24 md:pt-32">
      <SectionHead
        aside="Kokonut UI is a shadcn registry with an MCP server, a setup file and Markdown for every page, so the agent you already use can find a component and install it for you."
        id="agents"
        number={number}
        title="Works with agents"
      />
      <div className={cn("grid grid-cols-1 border", GRID, LINE)}>
        <AgentTabs
          className={cn("grid grid-cols-2 sm:grid-cols-5", GRID)}
          itemClassName="h-14 justify-start gap-2.5 px-4 text-[15px] last:col-span-2 sm:h-[72px] sm:last:col-span-1 [&_svg]:size-5"
          onChange={setId}
          value={id}
        />
        <div className={cn("grid grid-cols-1 lg:grid-cols-12", GRID)}>
          <ol className={cn("grid grid-cols-1 lg:col-span-8", GRID)}>
            {steps.map((step, i) => (
              <li
                className={cn("flex gap-4 p-5 sm:gap-6 sm:p-6", CELL)}
                key={step.title}
              >
                <span className={cn(MONO, "font-medium text-[12px]", LEAF)}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <p className="flex flex-col gap-0.5">
                    <span className={cn("font-medium text-[15px]", INK)}>
                      {step.title}
                    </span>
                    <span className={cn("text-[13.5px] leading-snug", SOFT)}>
                      {step.note}
                    </span>
                  </p>
                  {step.line}
                </div>
              </li>
            ))}
          </ol>
          <div
            className={cn(
              "flex flex-col justify-between gap-8 p-5 sm:p-6 lg:col-span-4",
              CELL
            )}
          >
            <div className="flex flex-col gap-1">
              <p className={META}>Rules go in</p>
              <p className={cn(MONO, "text-[15px]", INK)}>{agent.rules}</p>
              <p className={cn("text-[13.5px] leading-snug", SOFT)}>
                So {id === "any" ? "your agent" : agent.label} keeps using the
                registry, the cn helper and the @/ paths.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <p className={META}>What it reads</p>
              <ul className={cn("flex flex-col border-t", LINE)}>
                {READS.map((r) => (
                  <li
                    className={cn("border-b last:border-b-0", LINE)}
                    key={r.path}
                  >
                    <a
                      className={cn(
                        "group flex flex-col gap-0.5 py-2",
                        FOCUS_INSET
                      )}
                      href={r.path}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span
                        className={cn(
                          MONO,
                          "text-[12.5px] underline-offset-4 group-hover:underline",
                          INK
                        )}
                      >
                        {r.path}
                      </span>
                      <span className={cn("text-[13px]", SOFT)}>{r.line}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <Link
                className={cn(
                  "mt-1 w-fit text-[13px] underline decoration-black/25 underline-offset-4 hover:decoration-black dark:decoration-white/25 dark:hover:decoration-white",
                  SOFT,
                  EASE_COLORS,
                  FOCUS
                )}
                href="/docs/agents"
              >
                The full agents guide
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Plates --------------------------------------------------------------- */

function Plate({
  part,
  room,
}: {
  part: Part /** The demo's box; plates in a row share one height. */;
  room: string;
}) {
  const { Component: Demo, hint } = LIVE[part.name];
  const { ref, near } = useNearViewport<HTMLDivElement>();
  const demo = near ? (
    <Suspense fallback={<LiveFallback />}>
      <Demo />
    </Suspense>
  ) : null;
  return (
    <figure className={cn("flex flex-col", CELL)}>
      <PlateHead code={part.code} note={hint} />
      {/* Big parts are shown reduced to fit the row's height. */}
      <div className={cn("relative", room)} ref={ref}>
        <Fit className="px-6 py-4">{demo}</Fit>
      </div>
      <PlateFoot part={part} />
    </figure>
  );
}

function PlateHead({ code, note }: { code: string; note: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 pt-3.5">
      <span className={cn(MONO, "shrink-0 font-medium text-[12px]", LEAF)}>
        {code}
      </span>
      <span className={cn(META, "truncate")}>{note}</span>
    </div>
  );
}

export function PlateFoot({ part }: { part: Part }) {
  const spec = part.dependencies.length
    ? part.dependencies.join(", ")
    : "no extra packages";
  return (
    <figcaption className="flex items-end justify-between gap-4 px-4 pb-3.5">
      <span className="flex min-w-0 flex-col gap-0.5">
        <HoverLink
          className={cn(
            "w-fit rounded-sm font-medium text-[15px] tracking-[-0.01em] underline-offset-4 hover:underline",
            INK,
            FOCUS
          )}
          href={part.url}
        >
          {part.title}
        </HoverLink>
        <span className={cn(META, "truncate")}>{spec}</span>
      </span>
      <span className="flex shrink-0 gap-1.5">
        <PlateCopy
          icon={AgentIcon}
          label="Agent"
          target={`prompt for your agent to add ${part.name}`}
          value={componentPrompt(part.name)}
        />
        <PlateCopy
          label="Copy"
          target={`install command for ${part.name}`}
          value={installCommand(part.name)}
        />
      </span>
    </figcaption>
  );
}

export function PlateCopy({
  label,
  target,
  value,
  icon,
}: {
  label: string;
  target: string;
  value: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  const { copied, copy } = useCopy();
  return (
    <button
      aria-label={copied ? "Copied" : `Copy the ${target}`}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 border px-2 text-[11.5px] text-black/60 hover:border-black/30 hover:text-black active:bg-black/[0.04] dark:text-white/60 dark:active:bg-white/[0.06] dark:hover:border-white/35 dark:hover:text-white",
        MONO,
        LINE,
        EASE_COLORS,
        FOCUS
      )}
      onClick={() => copy(value)}
      title={value}
      type="button"
    >
      <CopyIconSwap className="size-3" copied={copied} icon={icon} />
      <span className="inline-block w-[6ch] text-left">
        {copied ? "Copied" : label}
      </span>
    </button>
  );
}

export function SectionHead({
  id,
  number,
  title,
  aside,
}: {
  id: string;
  number: string;
  title: string;
  aside?: ReactNode;
}) {
  // Aligned to the plate grid: title over the first column, notes over the
  // last.
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 border-t pt-4 pb-6 sm:grid-cols-2 md:pb-8 lg:grid-cols-3",
        LINE
      )}
    >
      <div className="flex flex-col gap-5">
        <p className={META}>{number}</p>
        <h2
          className={cn(
            "font-semibold text-[36px] leading-none tracking-[-0.045em] md:text-[48px]",
            INK
          )}
          id={id}
        >
          {title}
        </h2>
      </div>
      {aside ? (
        <p
          className={cn(
            "max-w-[400px] self-end text-pretty text-[15px] leading-relaxed lg:col-start-3",
            SOFT
          )}
        >
          {aside}
        </p>
      ) : null}
    </div>
  );
}

/* Index ---------------------------------------------------------------- */

export function Index({
  parts,
  number = "03",
}: {
  parts: Part[];
  number?: string;
}) {
  const groups = new Map<string, Part[]>();
  for (const p of parts) {
    groups.set(p.category, [...(groups.get(p.category) ?? []), p]);
  }

  return (
    <section
      aria-labelledby="all-components-title"
      className="scroll-mt-24 pt-24 md:pt-32"
      id="all-components"
    >
      <SectionHead
        aside="Every Kokonut UI component by category, from AI chat inputs to text effects. Each name opens its docs page."
        id="all-components-title"
        number={number}
        title="All components"
      />
      <div
        className={cn(
          "grid grid-cols-1 border sm:grid-cols-2 lg:grid-cols-4",
          GRID,
          LINE
        )}
      >
        {[...groups.entries()].map(([category, items]) => (
          <div className={cn("flex flex-col p-4 pb-3", CELL)} key={category}>
            <h3
              className={cn(
                "mb-3 flex items-baseline justify-between font-medium text-[15px]",
                INK
              )}
            >
              <HoverLink
                className={cn(
                  "underline-offset-4 hover:underline",
                  FOCUS_INSET
                )}
                href={`/docs/${items[0]?.categorySlug}`}
              >
                {category}
              </HoverLink>
              <span className={META}>{items[0]?.code.slice(0, 2)}</span>
            </h3>
            <ul className="flex flex-col">
              {items.map((p) => (
                <li key={p.name}>
                  <HoverLink
                    className={cn(
                      "group/row -mx-2 flex items-baseline gap-3 rounded-sm px-2 py-[5px] text-[14px] text-black/70 hover:bg-black/[0.03] hover:text-black dark:text-white/70 dark:hover:bg-white/[0.05] dark:hover:text-white",
                      EASE_COLORS,
                      FOCUS_INSET
                    )}
                    href={p.url}
                  >
                    <span
                      className={cn(
                        MONO,
                        "w-[5ch] shrink-0 text-[11.5px] text-black/55 transition-colors duration-150 ease-out group-hover/row:text-[#15852A] dark:text-white/50 dark:group-hover/row:text-[#3BB44B]"
                      )}
                    >
                      {p.code}
                    </span>
                    <span className="truncate">{p.title}</span>
                    {p.isNew || p.updated ? (
                      <span
                        className={cn(
                          MONO,
                          "ml-auto shrink-0 text-[11px]",
                          LEAF
                        )}
                      >
                        {p.isNew ? "New" : "Updated"}
                      </span>
                    ) : null}
                  </HoverLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <a
          className={cn(
            "group flex flex-col justify-between gap-6 p-4",
            CELL,
            "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
            EASE_COLORS,
            FOCUS_INSET
          )}
          href={GITHUB_URL}
          rel="noreferrer"
          target="_blank"
        >
          <span className={cn("font-medium text-[15px]", INK)}>
            Something missing?
          </span>
          <span className={cn("text-[14px] leading-relaxed", SOFT)}>
            The library grows in the open. Ask for a component, or send one, on
            GitHub.
          </span>
          <ArrowUpRightIcon
            aria-hidden
            className="size-4 text-black/40 transition-colors duration-150 ease-out group-hover:text-black dark:text-white/40 dark:group-hover:text-white"
          />
        </a>
      </div>
    </section>
  );
}

/* References ------------------------------------------------------------ */

export function References({ number = "04" }: { number?: string }) {
  const { post, reply } = V0_THREAD;
  return (
    <section
      aria-labelledby="references"
      className="scroll-mt-24 pt-24 md:pt-32"
      id="testimonials"
    >
      <SectionHead
        aside="What developers said when they found it, including the person behind shadcn/ui."
        id="references"
        number={number}
        title="What developers say"
      />
      <div
        className={cn("grid grid-cols-1 border lg:grid-cols-12", GRID, LINE)}
      >
        <a
          className={cn(
            "group flex min-h-[340px] flex-col justify-between gap-8 p-5 sm:p-8 lg:col-span-7",
            CELL,
            "hover:bg-black/[0.015] dark:hover:bg-white/[0.02]",
            EASE_COLORS,
            FOCUS_INSET
          )}
          href={post.href}
          rel="noreferrer"
          target="_blank"
        >
          <span className="flex items-center justify-between gap-4">
            <span className={META}>
              Re: “{post.text}” · {post.date}
            </span>
            <ArrowUpRightIcon
              aria-hidden
              className="size-4 shrink-0 text-black/35 transition-colors duration-150 ease-out group-hover:text-black dark:text-white/35 dark:group-hover:text-white"
            />
          </span>
          <span
            className={cn(
              "font-semibold text-[clamp(52px,17vw,72px)] leading-[0.85] tracking-[-0.065em] sm:text-[clamp(72px,12vw,148px)]",
              INK
            )}
          >
            {reply.text}
          </span>
          <span className="flex items-center gap-3">
            <Avatar name={reply.name} size={32} src={reply.avatar} />
            <span className="text-[14px]">
              <span className={cn("font-medium", INK)}>shadcn</span>
              <span className={SOFT}>, creator of shadcn/ui</span>
            </span>
          </span>
        </a>
        <div className={cn("grid grid-cols-1 lg:col-span-5", GRID)}>
          <VideoCard
            className="aspect-video w-full rounded-none dark:shadow-none"
            id={VIDEO_ID}
          />
          {POSTS.slice(0, 2).map((p) => (
            <Quote key={p.handle} post={p} />
          ))}
        </div>
        {POSTS.slice(2).map((p) => (
          <div className={cn("lg:col-span-4", CELL)} key={p.handle}>
            <Quote post={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Quote({ post }: { post: (typeof POSTS)[number] }) {
  return (
    <figure className={cn("flex h-full flex-col gap-4 p-5", CELL)}>
      <blockquote
        className={cn("text-pretty text-[15px] leading-relaxed", INK)}
      >
        “{post.text}”
      </blockquote>
      <figcaption className="mt-auto flex items-center gap-2.5">
        <Avatar name={post.name} size={24} src={post.avatar} />
        <span className="text-[13px]">
          <span className={INK}>{post.name}</span>
          <span className={cn(META, "ml-2")}>@{post.handle}</span>
        </span>
      </figcaption>
    </figure>
  );
}

/* Supplement (Pro) ------------------------------------------------------ */

const PRO_RED = "text-[#FF2D55]";
const PRO_PAID = PRO_PRICE.list - PRO_PRICE.off;
const RECEIPT_ROW =
  "flex items-baseline justify-between border-b py-2 tabular-nums";

/** Pro's stills fade out at the bottom, the way kokonutui.pro draws them. */
const STILL_FADE = {
  maskImage: "linear-gradient(to bottom, #000 60%, transparent 98%)",
  WebkitMaskImage: "linear-gradient(to bottom, #000 60%, transparent 98%)",
};

const SHOWCASE_ITEMS = new Map(
  PRO_SHOWCASE.flatMap((group) =>
    group.items.map((item) => [item.name, { ...item, group: group.title }])
  )
);

export function Supplement({ number = "05" }: { number?: string }) {
  const stills = PRO_STILLS.map((name) => SHOWCASE_ITEMS.get(name)).filter(
    (item) => item !== undefined
  );
  const templates = PRO_TEMPLATE_LIST.filter((t) => t.poster).slice(0, 3);

  return (
    <section aria-labelledby="supplement" className="pt-24 md:pt-32">
      <SectionHead
        aside="The paid half of the catalog: heroes, app screens, pricing, AI parts and full website templates, on the same stack and installed the same way."
        id="supplement"
        number={number}
        title="Kokonut UI Pro"
      />
      <div className={cn("grid grid-cols-1 border", GRID, LINE)}>
        <dl className={cn("grid grid-cols-3", GRID)}>
          {PRO_STATS.map((stat) => (
            <div
              className={cn(
                "flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-3",
                CELL
              )}
              key={stat.label}
            >
              <dd
                className={cn(
                  MONO,
                  "order-first text-[20px] tabular-nums tracking-[-0.02em]",
                  INK
                )}
              >
                {stat.value}
              </dd>
              <dt className={META}>{stat.label}</dt>
            </div>
          ))}
        </dl>

        <div className={cn("grid grid-cols-1 lg:grid-cols-12", GRID)}>
          <ProOffer />
          <ul className={cn("grid grid-cols-2 lg:col-span-8", GRID)}>
            {stills.map((item, i) => (
              <li className={CELL} key={item.name}>
                <a
                  className={cn(
                    "group flex h-full flex-col",
                    CELL,
                    "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
                    EASE_COLORS,
                    FOCUS_INSET
                  )}
                  href={showcaseUrl(item, "landing")}
                  rel="noopener"
                  target="_blank"
                >
                  <span className="flex items-baseline justify-between gap-3 px-4 pt-3.5">
                    <span
                      className={cn(MONO, "font-medium text-[12px]", PRO_RED)}
                    >
                      PR-{String(i + 1).padStart(2, "0")}
                    </span>
                    <span className={META}>{item.group}</span>
                  </span>
                  <span
                    className="relative mx-4 mt-3 block aspect-[16/11] overflow-clip"
                    style={STILL_FADE}
                  >
                    <Image
                      alt={`${item.title}, a Kokonut UI Pro component`}
                      className="object-cover object-top dark:hidden"
                      fill
                      sizes="(min-width: 1024px) 400px, 50vw"
                      src={showcaseStill(item.name, "light")}
                      unoptimized
                    />
                    <Image
                      alt=""
                      className="hidden object-cover object-top dark:block"
                      fill
                      sizes="(min-width: 1024px) 400px, 50vw"
                      src={showcaseStill(item.name, "dark")}
                      unoptimized
                    />
                  </span>
                  <span className="flex flex-col gap-1 px-4 pt-1 pb-4">
                    <span
                      className={cn(
                        "font-medium text-[14px] underline-offset-4 group-hover:underline sm:text-[15px]",
                        INK
                      )}
                    >
                      {item.title}
                    </span>
                    <span
                      className={cn(
                        "hidden text-[13px] leading-snug sm:block",
                        SOFT
                      )}
                    >
                      {item.line}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className={cn("grid grid-cols-1 md:grid-cols-3", GRID)}>
          {templates.map((t) => (
            <a
              className={cn(
                "group flex flex-col",
                CELL,
                "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
                EASE_COLORS,
                FOCUS_INSET
              )}
              href={`${PRO_TEMPLATES_PAGE}#${t.slug}`}
              key={t.slug}
            >
              <span className="flex items-baseline justify-between px-4 pt-3.5">
                <span className={META}>Template · {t.category}</span>
                <span className={cn(META, "tabular-nums")}>
                  ${t.price} alone, or in Pro
                </span>
              </span>
              <span className="block p-4">
                <span className="block overflow-hidden border border-black/[0.08] dark:border-white/[0.1]">
                  <Image
                    alt={`${t.name} website template`}
                    className="aspect-[16/10] w-full object-cover object-top"
                    height={800}
                    sizes="(min-width: 768px) 400px, 100vw"
                    src={t.poster ?? ""}
                    width={1280}
                  />
                </span>
              </span>
              <span className="flex flex-col gap-0.5 px-4 pb-4">
                <span
                  className={cn(
                    "font-medium text-[15px] underline-offset-4 group-hover:underline",
                    INK
                  )}
                >
                  {t.name}
                </span>
                <span className={cn("text-[13px] leading-snug", SOFT)}>
                  {t.blurb}
                </span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The price as checkout shows it, what it covers, and the way in. */
function ProOffer() {
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-8 p-5 sm:p-6 lg:col-span-4",
        CELL
      )}
    >
      <div className="flex flex-col gap-4">
        <p className={cn("font-medium text-[14px]", INK)}>
          One payment, everything included
        </p>
        <p
          className={cn(
            "font-semibold text-[72px] tabular-nums leading-[0.85] tracking-[-0.06em] md:text-[88px]",
            INK
          )}
        >
          ${PRO_PAID}
        </p>
        <dl className={cn("flex flex-col border-t text-[13.5px]", LINE)}>
          <div className={cn(RECEIPT_ROW, LINE, SOFT)}>
            <dt>Lifetime access</dt>
            <dd>${PRO_PRICE.list}</dd>
          </div>
          <div className={cn(RECEIPT_ROW, LINE, PRO_RED)}>
            <dt className={cn(MONO, "text-[12.5px]")}>
              {PRO_PRICE.code} · {PRO_PRICE.percent}% off
            </dt>
            <dd>−${PRO_PRICE.off}</dd>
          </div>
          <div className={cn(RECEIPT_ROW, "border-b-0 font-medium", INK)}>
            <dt>You pay, once</dt>
            <dd>${PRO_PAID}</dd>
          </div>
        </dl>
        <ul className={cn("flex flex-col border-t", LINE)}>
          {PRO_INCLUDED.map((line) => (
            <li
              className={cn(
                "border-b py-2 text-[13.5px] last:border-b-0",
                LINE,
                SOFT
              )}
              key={line}
            >
              {line}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col items-start gap-3">
        <a
          className={cn(
            "inline-flex h-10 w-full items-center justify-between gap-2 bg-black px-4 font-medium text-[14px] text-white hover:bg-black/85 active:bg-black/75 dark:bg-white dark:text-black dark:active:bg-white/75 dark:hover:bg-white/85",
            EASE_COLORS,
            FOCUS
          )}
          href={PRO_LANDING_URL}
          rel="noopener"
          target="_blank"
        >
          Get Kokonut UI Pro
          <ArrowUpRightIcon aria-hidden className="size-4" />
        </a>
        <Link
          className={cn(
            "text-[13px] underline decoration-black/25 underline-offset-4 hover:decoration-black dark:decoration-white/25 dark:hover:decoration-white",
            SOFT,
            EASE_COLORS,
            FOCUS
          )}
          href={PRO_SHOWCASE_PAGE}
        >
          See Pro components in the docs
        </Link>
      </div>
    </div>
  );
}
