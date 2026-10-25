"use client";

import { CheckIcon, MinusIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CopyIconSwap, useCopy } from "../home/client";
import { installCommand, VERCEL_OSS_URL } from "../home/data";
import type { Part } from "../home/parts";
import {
  CELL,
  EASE_COLORS,
  FOCUS,
  GRID,
  INK,
  LEAF,
  LINE,
  MONO,
  SOFT,
} from "../home/styles";
import {
  BUTTON,
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

const STRIP = ["slide-to-confirm", "ai-model-selector", "undo-button"];
const ANATOMY = "slide-to-confirm";

/**
 * C: The comparison page. Written for people searching for free shadcn
 * components: what Kokonut UI is, how it compares with the other ways to get
 * an animated component, and what one install actually gives you.
 */
export function ProposalC({ parts }: { parts: Part[] }) {
  const byName = new Map(parts.map((p) => [p.name, p]));
  const count = parts.length;
  const anatomy = byName.get(ANATOMY);
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-8 pb-32 sm:px-6 md:pt-12">
      <section
        aria-labelledby="hero"
        className={cn("grid grid-cols-1 border", GRID, LINE)}
      >
        <div
          className={cn(
            "grid grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-12 lg:p-12",
            CELL
          )}
        >
          <div className="flex flex-col gap-6 lg:col-span-8">
            <h1
              className={cn(
                "home-enter max-w-[680px] text-balance font-semibold text-5xl tracking-tighter sm:text-6xl lg:text-7xl",
                INK
              )}
              id="hero"
            >
              Free animated components <br className="hidden sm:block" />
              for shadcn/ui
            </h1>
            <p
              className={cn(
                "home-enter max-w-[680px] text-pretty text-lg",
                SOFT
              )}
            >
              Kokonut UI is a shadcn registry of {count} React components built
              with Tailwind CSS v4 and Motion. They install as source you own,
              with one command or one prompt.
            </p>
          </div>
          <div className="home-enter flex flex-col justify-end gap-4 lg:col-span-4">
            <InstallCta name={ANATOMY} />
            <p className={cn("text-sm", SOFT)}>
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
          </div>
        </div>
        <div className={cn("grid grid-cols-1 md:grid-cols-3", GRID)}>
          {STRIP.map((name) => {
            const p = byName.get(name);
            return p ? (
              <figure className={cn("flex flex-col", CELL)} key={name}>
                <div className="flex items-baseline justify-between gap-4 px-4 pt-4">
                  <span
                    className={cn(
                      MONO,
                      "shrink-0 whitespace-nowrap font-medium text-xs",
                      LEAF
                    )}
                  >
                    {p.code}
                  </span>
                  <span className={cn(META, "truncate")}>
                    {DEMOS[name as DemoName].hint}
                  </span>
                </div>
                <Demo className="h-48 md:h-72" name={name} />
                <figcaption className="px-4 pb-4">
                  <Link
                    className={cn(
                      "rounded-sm font-medium text-base underline-offset-4 hover:underline",
                      INK,
                      FOCUS
                    )}
                    href={p.url}
                  >
                    {p.title}
                  </Link>
                </figcaption>
              </figure>
            ) : null;
          })}
        </div>
      </section>

      <Comparison />
      <Tagline
        lines={[
          "A component you install once",
          "and then read, edit and keep.",
        ]}
      />
      {anatomy ? <Anatomy part={anatomy} /> : null}
      <Library byName={byName} count={count} />
      <Proof />
      <Faq />
      <FinalCta
        action={<InstallCta name={ANATOMY} />}
        body="Paste it into your terminal. The file lands in components/kokonutui with its packages installed."
        title="Add your first component in one command"
      />
    </div>
  );
}

/** The primary action: copy a real install command. */
function InstallCta({ name }: { name: string }) {
  const { copied, copy } = useCopy();
  const command = installCommand(name);
  return (
    <div className={cn("flex flex-col border", LINE)}>
      <code className={cn("wrap-anywhere px-3 py-3 text-sm", MONO, INK)}>
        <span className="text-black/35 dark:text-white/35">$ </span>
        {command}
      </code>
      <button
        className={cn(BUTTON, "w-full justify-center")}
        onClick={() => copy(command)}
        type="button"
      >
        <CopyIconSwap className="size-4" copied={copied} />
        {copied ? "Copied" : "Copy install command"}
      </button>
    </div>
  );
}

interface Cell {
  text: string;
  yes?: boolean;
}

const COLUMNS = ["Kokonut UI", "A packaged npm kit", "Writing it yourself"];

const ROWS: { label: string; cells: [Cell, Cell, Cell] }[] = [
  {
    label: "Where the code lives",
    cells: [
      { yes: true, text: "In your repo, one file per component" },
      { text: "In node_modules" },
      { yes: true, text: "In your repo" },
    ],
  },
  {
    label: "Getting it in",
    cells: [
      { yes: true, text: "One command or one prompt" },
      { yes: true, text: "npm install, then imports" },
      { text: "A few days per component" },
    ],
  },
  {
    label: "Your AI agent can find it",
    cells: [
      { yes: true, text: "Through the shadcn MCP server" },
      { text: "From the docs, if it reads them" },
      { text: "Not until it exists" },
    ],
  },
  {
    label: "Changing how it looks",
    cells: [
      { yes: true, text: "Edit the Tailwind classes" },
      { text: "Theme props and overrides" },
      { yes: true, text: "Anything" },
    ],
  },
  {
    label: "Motion",
    cells: [
      { yes: true, text: "Tuned per component" },
      { text: "Whatever the kit ships" },
      { text: "Up to you" },
    ],
  },
  {
    label: "Updates",
    cells: [
      { yes: true, text: "Run add again and review the diff" },
      { yes: true, text: "Bump the version" },
      { text: "You maintain it" },
    ],
  },
  {
    label: "Cost",
    cells: [
      { yes: true, text: "Free, MIT licensed" },
      { text: "Free or paid" },
      { text: "Your time" },
    ],
  },
];

function Comparison() {
  return (
    <section aria-labelledby="compare" className="pt-24 md:pt-32">
      <SectionHead
        aside="Three ways to get an animated component into a shadcn/ui app, side by side."
        id="compare"
        title="Kokonut UI compared"
      />
      <div className={cn("overflow-x-auto border", LINE)}>
        <table className="table w-full min-w-[720px] max-w-none table-fixed border-collapse whitespace-normal text-left">
          <thead>
            <tr className={cn("border-b", LINE)}>
              <th className="w-1/4 p-4" scope="col">
                <span className="sr-only">Question</span>
              </th>
              {COLUMNS.map((c, i) => (
                <th
                  className={cn(
                    "border-l p-4 font-semibold text-base",
                    LINE,
                    i === 0 ? INK : SOFT
                  )}
                  key={c}
                  scope="col"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr
                className={cn("border-b last:border-b-0", LINE)}
                key={row.label}
              >
                <th
                  className={cn("p-4 align-top font-medium text-sm", INK)}
                  scope="row"
                >
                  {row.label}
                </th>
                {row.cells.map((cell, i) => (
                  <td
                    className={cn(
                      "border-l p-4 align-top text-sm",
                      LINE,
                      i === 0 && "bg-black/[0.02] dark:bg-white/[0.03]"
                    )}
                    key={COLUMNS[i]}
                  >
                    <span className="flex items-start gap-2">
                      {cell.yes ? (
                        <CheckIcon
                          aria-label="Yes"
                          className={cn("mt-0.5 size-4 shrink-0", LEAF)}
                        />
                      ) : (
                        <MinusIcon
                          aria-label="Partly or no"
                          className="mt-0.5 size-4 shrink-0 text-black/30 dark:text-white/30"
                        />
                      )}
                      <span className={i === 0 ? INK : SOFT}>{cell.text}</span>
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** What one install really gives you, read from the registry entry. */
function Anatomy({ part }: { part: Part }) {
  const rows = [
    { label: "Command", value: installCommand(part.name) },
    { label: "Files written", value: part.files.join("\n") },
    {
      label: "Packages installed",
      value: part.dependencies.length
        ? part.dependencies.join(", ")
        : "None beyond React",
    },
    {
      label: "shadcn/ui primitives",
      value: part.registryDependencies.length
        ? part.registryDependencies.join(", ")
        : "None",
    },
    { label: "Docs", value: `kokonutui.com${part.url}` },
  ];
  return (
    <section aria-labelledby="anatomy">
      <SectionHead
        aside="Everything below is read from the registry entry the CLI uses."
        id="anatomy"
        title={`What one install gives you: ${part.title}`}
      />
      <div
        className={cn("grid grid-cols-1 border lg:grid-cols-12", GRID, LINE)}
      >
        <Demo className={cn("h-96 lg:col-span-6", CELL)} name={part.name} />
        <dl className={cn("grid grid-cols-1 lg:col-span-6", GRID)}>
          {rows.map((r) => (
            <div
              className={cn("grid grid-cols-1 gap-2 p-4 sm:grid-cols-3", CELL)}
              key={r.label}
            >
              <dt className={META}>{r.label}</dt>
              <dd
                className={cn(
                  "wrap-anywhere whitespace-pre-line text-sm sm:col-span-2",
                  MONO,
                  INK
                )}
              >
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Library({
  byName,
  count,
}: {
  byName: Map<string, Part>;
  count: number;
}) {
  return (
    <section aria-labelledby="library" className="pt-24 md:pt-32">
      <SectionHead
        aside={
          <>
            {count} components in all.{" "}
            <Link
              className={cn(
                "rounded-sm underline underline-offset-4",
                INK,
                FOCUS
              )}
              href="/docs"
            >
              Browse the docs
            </Link>
            .
          </>
        }
        id="library"
        title="What is in the library"
      />
      <div className={cn("grid grid-cols-1 border md:grid-cols-3", GRID, LINE)}>
        {USE_CASES.map((u) => (
          <div className={cn("flex flex-col gap-4 p-6", CELL)} key={u.title}>
            <h3 className={cn("font-semibold text-xl tracking-tight", INK)}>
              {u.title}
            </h3>
            <p className={cn("text-pretty text-base", SOFT)}>{u.body}</p>
            <div className="mt-auto pt-2">
              <PartLinks byName={byName} names={u.names} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
