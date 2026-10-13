"use client";

import { ArrowDownIcon, ArrowUpRightIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type ReactNode, Suspense, useState } from "react";
import {
  Avatar,
  CopyIconSwap,
  useCopy,
} from "@/components/landing/home/client";
import {
  GITHUB_URL,
  installCommand,
  type McpClient,
  mcpCommand,
  POSTS,
  PRO_TEMPLATES,
  PRO_TEMPLATES_URL,
  PRO_URL,
  REGISTRY_ENTRY,
  V0_THREAD,
  VERCEL_OSS_URL,
  VIDEO_ID,
} from "@/components/landing/home/data";
import {
  EASE_COLORS,
  enter,
  FOCUS,
  FOCUS_INSET,
} from "@/components/landing/home/styles";
import { VideoCard } from "@/components/landing/home/video";
import { cn } from "@/lib/utils";
import type { Part, PrototypeProps } from "./data";
import { Fit, LIVE, LiveFallback } from "./live";
import { ClientPicker, CopyLine } from "./shared";

// The catalog is drawn with rules, not cards: cells share one hairline, the
// corners are square, and type does the decorating.
const MONO = "font-(family-name:--font-proto-mono)";
const LINE = "border-black/[0.13] dark:border-white/[0.14]";
const GRID = "gap-px bg-black/[0.13] dark:bg-white/[0.14]";
const CELL = "bg-white dark:bg-black";
const META = cn(MONO, "text-[11.5px] text-black/50 dark:text-white/50");
const INK = "text-black dark:text-white";
const SOFT = "text-black/60 dark:text-white/60";
/** The one color in the catalog: Kokonut's leaf, for the codes. */
const LEAF = "text-[#1FA834] dark:text-[#3BB44B]";

const FEATURED = "hold-button";
/** The featured part, asked for the way you'd ask a colleague. */
const AGENT_PROMPT =
  "Add @kokonutui/hold-button to the danger zone in settings";
const PLATES = [
  "ai-prompt",
  "apple-activity-card",
  "particle-button",
  "currency-transfer",
  "smooth-tab",
  "team-selector",
  "card-flip",
  "file-upload",
  "dynamic-text",
];

export function CatalogVariant({ parts }: PrototypeProps) {
  const byName = new Map(parts.map((p) => [p.name, p]));
  const featured = byName.get(FEATURED);
  const plates = PLATES.map((name) => byName.get(name)).filter((p): p is Part =>
    Boolean(p && LIVE[p.name])
  );

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-8 pb-32 sm:px-6 md:pt-12">
      <Cover featured={featured} />
      <Plates plates={plates} />
      <Index parts={parts} />
      <Ordering />
      <References />
      <Supplement />
    </div>
  );
}

/* Cover ---------------------------------------------------------------- */

function Cover({ featured }: { featured?: Part }) {
  return (
    <section
      aria-label="Kokonut UI"
      className={cn("grid grid-cols-1 border", GRID, LINE)}
    >
      <div className={cn("grid grid-cols-2 md:grid-cols-4", GRID)}>
        {[
          "Kokonut UI",
          "Component catalog",
          "React, Tailwind CSS, Motion",
          "Free and open source",
        ].map((label, i) => (
          <p
            className={cn(
              "home-enter flex h-10 items-center px-4",
              CELL,
              META,
              i === 0 && "font-medium text-black dark:text-white"
            )}
            key={label}
            style={enter(i)}
          >
            {label}
          </p>
        ))}
      </div>

      <div className={cn("grid grid-cols-1 lg:grid-cols-12", GRID)}>
        <div
          className={cn(
            "flex flex-col justify-between gap-10 p-5 sm:p-8 lg:col-span-8 lg:p-10",
            CELL
          )}
        >
          <h1
            className={cn(
              "home-enter font-semibold text-[clamp(52px,9vw,124px)] leading-[0.9] tracking-[-0.06em]",
              INK
            )}
            style={enter(4)}
          >
            Components
            <br />
            that feel right.
          </h1>
          <p
            className={cn(
              "home-enter max-w-[520px] text-pretty text-[17px] leading-relaxed",
              SOFT
            )}
            style={enter(5)}
          >
            A catalog of React components built with Tailwind CSS and Motion.
            Every part on this page is live: try it, then install it with one
            command or one prompt.
          </p>
        </div>
        {featured ? <FeaturedPlate part={featured} /> : null}
      </div>

      <div className={cn("grid grid-cols-1 md:grid-cols-12", GRID)}>
        <div
          className={cn(
            "home-enter flex flex-col gap-3 p-5 sm:p-6 md:col-span-7",
            CELL
          )}
          style={enter(7)}
        >
          <p className={META}>Ask your agent</p>
          <PromptLine prompt={AGENT_PROMPT} />
        </div>
        <ConnectEditor />
        <Link
          className={cn(
            "home-enter group flex items-center justify-between gap-4 p-5 sm:p-6 md:col-span-5 md:col-start-8 md:row-start-1",
            CELL,
            "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
            EASE_COLORS,
            FOCUS_INSET
          )}
          href="#index"
          style={enter(9)}
        >
          <span className="flex flex-col gap-1">
            <span className={META}>Contents</span>
            <span className={cn("font-medium text-[17px]", INK)}>
              Browse the index
            </span>
          </span>
          <ArrowDownIcon
            aria-hidden
            className="size-5 text-black/40 transition-colors duration-150 ease-out group-hover:text-black dark:text-white/40 dark:group-hover:text-white"
          />
        </Link>
        <a
          className={cn(
            "home-enter group flex items-center justify-between gap-4 p-5 sm:p-6 md:col-span-5 md:col-start-8 md:row-start-2",
            CELL,
            "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
            EASE_COLORS,
            FOCUS_INSET
          )}
          href={VERCEL_OSS_URL}
          rel="noreferrer"
          style={enter(10)}
          target="_blank"
        >
          <span className="flex flex-col gap-1">
            <span className={META}>Backed by</span>
            <span className={cn("font-medium text-[17px]", INK)}>
              Vercel OSS
            </span>
          </span>
          <svg
            aria-hidden="true"
            className="size-4 text-black/40 transition-colors duration-150 ease-out group-hover:text-black dark:text-white/40 dark:group-hover:text-white"
            fill="currentColor"
            viewBox="0 0 76 65"
          >
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
          </svg>
        </a>
      </div>
    </section>
  );
}

function FeaturedPlate({ part }: { part: Part }) {
  const Demo = LIVE[part.name].Component;
  return (
    <figure
      className={cn(
        "home-enter flex min-h-[360px] flex-col lg:col-span-4",
        CELL
      )}
      style={enter(6)}
    >
      <PlateHead code={part.code} note={LIVE[part.name].hint} />
      <div className="relative min-h-[260px] flex-1">
        <Fit className="p-6">
          <Suspense fallback={<LiveFallback />}>
            <Demo />
          </Suspense>
        </Fit>
      </div>
      <PlateFoot part={part} />
    </figure>
  );
}

/** What you'd type into Claude Code, Cursor or Codex to get the featured part. */
function PromptLine({ prompt }: { prompt: string }) {
  const { copied, copy } = useCopy();
  return (
    <button
      aria-label={copied ? "Copied" : `Copy the prompt: ${prompt}`}
      className={cn(
        "group flex min-w-0 items-start gap-3 text-left text-[clamp(14px,1.5vw,17px)] leading-snug",
        MONO,
        INK,
        FOCUS
      )}
      onClick={() => copy(prompt)}
      type="button"
    >
      <span aria-hidden className={LEAF}>
        &rsaquo;
      </span>
      <span className="min-w-0 flex-1 text-pretty">{prompt}</span>
      <CopyIconSwap
        className="mt-0.5 size-4 text-black/40 group-hover:text-black dark:text-white/40 dark:group-hover:text-white"
        copied={copied}
      />
    </button>
  );
}

/** One command connects the editor to the registry over the shadcn MCP server. */
function ConnectEditor() {
  const [client, setClient] = useState<McpClient>("claude");
  return (
    <div
      className={cn(
        "home-enter flex flex-col gap-3 p-5 sm:p-6 md:col-span-7 md:row-start-2",
        CELL
      )}
      style={enter(8)}
    >
      <p className="flex items-baseline justify-between gap-4">
        <span className={META}>Connect your editor once</span>
        <span className={cn(MONO, "text-[11.5px]", LEAF)}>shadcn MCP</span>
      </p>
      <ClientPicker
        className={cn(
          "grid grid-cols-2 border sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4",
          GRID,
          LINE
        )}
        itemClassName={cn("h-9 justify-start px-3", CELL)}
        onChange={setClient}
        selectedClassName="bg-[#f4f4f4] dark:bg-[#161616]"
        value={client}
      />
      <CopyLine
        className={cn("text-[13px]", INK)}
        prefix="$"
        value={mcpCommand(client)}
      />
    </div>
  );
}

/* Plates --------------------------------------------------------------- */

function Plates({ plates }: { plates: Part[] }) {
  return (
    <section aria-labelledby="plates" className="pt-24 md:pt-32">
      <SectionHead
        aside="Selected parts, running live. Each one installs as a single file you own."
        id="plates"
        number="01"
        title="Plates"
      />
      <div
        className={cn(
          "grid grid-cols-1 border sm:grid-cols-2 lg:grid-cols-3",
          GRID,
          LINE
        )}
      >
        {plates.map((part) => (
          <Plate key={part.name} part={part} />
        ))}
      </div>
    </section>
  );
}

function Plate({ part }: { part: Part }) {
  const entry = LIVE[part.name];
  const Demo = entry.Component;
  return (
    <figure className={cn("flex flex-col", CELL)}>
      <PlateHead code={part.code} note={entry.hint} />
      {/* Every plate is the same size; big parts are shown reduced. */}
      <div className="relative h-[300px]">
        <Fit className="px-6 py-4">
          <Suspense fallback={<LiveFallback />}>
            <Demo />
          </Suspense>
        </Fit>
      </div>
      <PlateFoot part={part} />
    </figure>
  );
}

function PlateHead({ code, note }: { code: string; note: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 pt-3.5">
      <span className={cn(MONO, "font-medium text-[12px]", LEAF)}>{code}</span>
      <span className={cn(META, "truncate")}>{note}</span>
    </div>
  );
}

function PlateFoot({ part }: { part: Part }) {
  const { copied, copy } = useCopy();
  const spec = part.dependencies.length
    ? part.dependencies.join(", ")
    : "no extra packages";
  return (
    <figcaption className="flex items-end justify-between gap-4 px-4 pb-3.5">
      <span className="flex min-w-0 flex-col gap-0.5">
        <Link
          className={cn(
            "w-fit rounded-sm font-medium text-[15px] tracking-[-0.01em] underline-offset-4 hover:underline",
            INK,
            FOCUS
          )}
          href={part.url}
        >
          {part.title}
        </Link>
        <span className={cn(META, "truncate")}>{spec}</span>
      </span>
      <button
        aria-label={copied ? "Copied" : `Copy install command for ${part.name}`}
        className={cn(
          "inline-flex h-7 shrink-0 items-center gap-1.5 border px-2 text-[11.5px] text-black/60 hover:border-black/30 hover:text-black active:bg-black/[0.04] dark:text-white/60 dark:active:bg-white/[0.06] dark:hover:border-white/35 dark:hover:text-white",
          MONO,
          LINE,
          EASE_COLORS,
          FOCUS
        )}
        onClick={() => copy(installCommand(part.name))}
        title={installCommand(part.name)}
        type="button"
      >
        <CopyIconSwap className="size-3" copied={copied} />
        <span className="inline-block w-[6ch] text-left">
          {copied ? "Copied" : "Copy"}
        </span>
      </button>
    </figcaption>
  );
}

function SectionHead({
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

function Index({ parts }: { parts: Part[] }) {
  const groups = new Map<string, Part[]>();
  for (const p of parts) {
    groups.set(p.category, [...(groups.get(p.category) ?? []), p]);
  }

  return (
    <section aria-labelledby="index" className="scroll-mt-24 pt-24 md:pt-32">
      <SectionHead
        aside="Every part, by section. Codes match the plates; each name opens its page in the docs."
        id="index"
        number="02"
        title="Index"
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
              {category}
              <span className={META}>{items[0]?.code.slice(0, 2)}</span>
            </h3>
            <ul className="flex flex-col">
              {items.map((p) => (
                <li key={p.name}>
                  <Link
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
                        "w-[5ch] shrink-0 text-[11.5px] text-black/35 transition-colors duration-150 ease-out group-hover/row:text-[#1FA834] dark:text-white/35 dark:group-hover/row:text-[#3BB44B]"
                      )}
                    >
                      {p.code}
                    </span>
                    <span className="truncate">{p.title}</span>
                  </Link>
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
            The catalog grows in the open. Ask for a part, or send one, on
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

/* Ordering -------------------------------------------------------------- */

function Ordering() {
  return (
    <section aria-labelledby="ordering" className="pt-24 md:pt-32">
      <SectionHead
        aside="Kokonut UI is a shadcn registry, so every part arrives as source in your repo, with its dependencies installed."
        id="ordering"
        number="03"
        title="Three ways in"
      />
      <ol className={cn("grid grid-cols-1 border md:grid-cols-3", GRID, LINE)}>
        <Method code="A" title="Agent">
          <p className={cn("text-[14px] leading-relaxed", SOFT)}>
            Name a part, or describe what you need. Your agent finds it in the
            registry and installs it with its dependencies.
          </p>
          <CopyLine
            className={cn("mt-auto", INK)}
            label="prompt"
            prefix="›"
            value="Add an AI chat input with a model picker to the home page"
          />
        </Method>
        <Method code="B" title="Command line">
          <p className={cn("text-[14px] leading-relaxed", SOFT)}>
            Name the part. The shadcn CLI writes the file and installs what it
            needs.
          </p>
          <CopyLine
            className={cn("mt-auto", INK)}
            prefix="$"
            value={installCommand("particle-button")}
          />
        </Method>
        <Method code="C" title="Registry">
          <p className={cn("text-[14px] leading-relaxed", SOFT)}>
            Add the namespace to components.json once, then use the short names
            everywhere.
          </p>
          <CopyLine
            className={cn("mt-auto", INK)}
            label="registry entry"
            value={REGISTRY_ENTRY}
          />
        </Method>
      </ol>
    </section>
  );
}

function Method({
  code,
  title,
  children,
}: {
  code: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className={cn("flex min-h-[260px] flex-col gap-4 p-5 sm:p-6", CELL)}>
      <p className="flex items-baseline justify-between">
        <span className={cn("font-medium text-[17px]", INK)}>{title}</span>
        <span className={cn(MONO, "font-medium text-[12px]", LEAF)}>
          {code}
        </span>
      </p>
      {children}
    </li>
  );
}

/* References ------------------------------------------------------------ */

function References() {
  const { post, reply } = V0_THREAD;
  return (
    <section aria-labelledby="references" className="pt-24 md:pt-32">
      <SectionHead
        aside="What developers said when they found it, including the person behind shadcn/ui."
        id="references"
        number="04"
        title="References"
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
              "font-semibold text-[clamp(72px,12vw,148px)] leading-[0.85] tracking-[-0.065em]",
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

function Supplement() {
  return (
    <section aria-labelledby="supplement" className="pt-24 md:pt-32">
      <SectionHead
        aside="Complete pages and premium sections, on the same stack and to the same standard."
        id="supplement"
        number="05"
        title="Supplement: Pro"
      />
      <div className={cn("grid grid-cols-1 border md:grid-cols-3", GRID, LINE)}>
        {PRO_TEMPLATES.map((t, i) => (
          <a
            className={cn("group flex flex-col", CELL, FOCUS_INSET)}
            href={PRO_TEMPLATES_URL}
            key={t.name}
            rel="noreferrer"
            target="_blank"
          >
            <span className="flex items-baseline justify-between px-4 pt-3.5">
              <span
                className={cn(MONO, "font-medium text-[#FF2D55] text-[12px]")}
              >
                PR-{String(i + 1).padStart(2, "0")}
              </span>
              <span className={META}>Template</span>
            </span>
            <span className="block p-4">
              <span className="block overflow-hidden border border-black/[0.08] dark:border-white/[0.1]">
                <Image
                  alt={`${t.name} template`}
                  className="aspect-[16/10] w-full object-cover object-top"
                  height={t.height}
                  sizes="(min-width: 768px) 400px, 100vw"
                  src={t.image}
                  width={t.width}
                />
              </span>
            </span>
            <span className="flex items-end justify-between gap-4 px-4 pb-3.5">
              <span className="flex flex-col gap-0.5">
                <span
                  className={cn(
                    "font-medium text-[15px] underline-offset-4 group-hover:underline",
                    INK
                  )}
                >
                  {t.name}
                </span>
                <span className={META}>{t.blurb}</span>
              </span>
            </span>
          </a>
        ))}
      </div>
      <div
        className={cn(
          "flex flex-col gap-4 border-x border-b p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6",
          LINE
        )}
      >
        <p className={cn("text-[15px]", SOFT)}>
          Pro adds full website templates and sections built with Next.js,
          Tailwind CSS, Motion and shadcn/ui.
        </p>
        <a
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-2 bg-black px-5 font-medium text-[14px] text-white hover:bg-black/85 active:bg-black/75 dark:bg-white dark:text-black dark:active:bg-white/75 dark:hover:bg-white/85",
            EASE_COLORS,
            FOCUS
          )}
          href={PRO_URL}
          rel="noreferrer"
          target="_blank"
        >
          Explore Pro
          <ArrowUpRightIcon aria-hidden className="size-4" />
        </a>
      </div>
    </section>
  );
}
