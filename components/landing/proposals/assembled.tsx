"use client";

import { useState } from "react";
import {
  AGENTS,
  type AgentId,
  AgentTabs,
  runPrompt,
} from "@/components/landing/home/agents";
import {
  Agents,
  HeroActions,
  Index,
  PlateCopy,
  References,
  SectionHead,
  Supplement,
} from "@/components/landing/home/catalog";
import {
  AgentIcon,
  CopyIconSwap,
  useCopy,
} from "@/components/landing/home/client";
import { CopyLine } from "@/components/landing/home/controls";
import { installCommand } from "@/components/landing/home/data";
import { Fit } from "@/components/landing/home/live";
import type { Part } from "@/components/landing/home/parts";
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
} from "@/components/landing/home/styles";
import { componentPrompt } from "@/lib/agents";
import { cn } from "@/lib/utils";
import { PartDemo, pickParts } from "./demo";

/*
 * 1. Assembled. The cover is one app screen, a trip booked end to end, built
 * only from Kokonut parts and running live. "Show the parts" outlines each
 * one with its code and install command; below, the screen's bill of
 * materials, and the one prompt that builds it.
 */

/** The screen, cell by cell: where each part sits and the room it gets. */
const SCREEN = [
  { name: "ai-tool-calls", cell: "lg:col-span-4", room: "h-[440px]" },
  { name: "stay-picker", cell: "lg:col-span-4", room: "h-[440px]" },
  { name: "boarding-pass", cell: "lg:col-span-4", room: "h-[440px]" },
  { name: "ai-input-search", cell: "lg:col-span-5", room: "h-[260px]" },
  { name: "slide-to-confirm", cell: "lg:col-span-4", room: "h-[260px]" },
  { name: "location-picker", cell: "lg:col-span-3", room: "h-[260px]" },
];

const TERMINAL_AGENTS = AGENTS.filter((a) => a.id !== "vscode");

export function Assembled({ parts }: { parts: Part[] }) {
  const [inspect, setInspect] = useState(false);
  const screen = pickParts(
    parts,
    SCREEN.map((s) => s.name)
  );
  const cells = SCREEN.flatMap((s) => {
    const part = screen.find((p) => p.name === s.name);
    return part ? [{ ...s, part }] : [];
  });
  const ai = screen.filter((p) => p.categorySlug === "ai").length;

  return (
    <>
      <section
        aria-label="Kokonut UI"
        className={cn("grid grid-cols-1 border", GRID, LINE)}
      >
        <div className={cn("grid grid-cols-1 lg:grid-cols-12", GRID)}>
          <div
            className={cn(
              "flex items-end p-5 pt-8 sm:p-8 sm:pt-12 lg:col-span-8 lg:p-10",
              CELL
            )}
          >
            <h1
              className={cn(
                "home-enter text-balance font-semibold text-[clamp(38px,11vw,48px)] leading-[0.92] tracking-[-0.055em] sm:text-[clamp(44px,5vw,68px)]",
                INK
              )}
              style={enter(0)}
            >
              Every part of this screen is a component.
            </h1>
          </div>
          <div
            className={cn(
              "flex flex-col justify-end gap-6 p-5 sm:p-8 lg:col-span-4 lg:px-8 lg:py-10",
              CELL
            )}
          >
            <p
              className={cn(
                "home-enter text-pretty text-[17px] leading-relaxed",
                SOFT
              )}
              style={enter(1)}
            >
              <span className={INK}>
                Open-source React components for AI chat and the app around it.
              </span>{" "}
              Try the screen below, then take it apart: each piece installs on
              its own with the shadcn CLI, or your agent builds the lot.
            </p>
            <HeroActions count={parts.length} />
          </div>
        </div>

        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5",
            CELL
          )}
        >
          <p className={META}>
            A trip, booked in one screen · {screen.length} parts, {ai} AI and{" "}
            {screen.length - ai} UI
          </p>
          <InspectSwitch checked={inspect} onChange={setInspect} />
        </div>

        <div className={cn("grid grid-cols-1 lg:grid-cols-12", GRID)}>
          {cells.map((c, i) => (
            <Piece
              className={c.cell}
              index={i}
              inspect={inspect}
              key={c.part.name}
              part={c.part}
              room={c.room}
            />
          ))}
        </div>
      </section>

      <Materials parts={screen} />
      <Agents number="02" />
      <Index number="03" parts={parts} />
      <References number="04" />
      <Supplement number="05" />
    </>
  );
}

/**
 * "Show the parts". Toggled now and then, so the knob moves (150ms, strong
 * ease-out) to say which way it went; the labels it reveals fade in.
 */
function InspectSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      aria-pressed={checked}
      className={cn(
        "group inline-flex items-center gap-2.5 font-medium text-[13px]",
        checked ? INK : SOFT,
        "hover:text-black dark:hover:text-white",
        EASE_COLORS,
        FOCUS
      )}
      onClick={() => onChange(!checked)}
      type="button"
    >
      Show the parts
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-[18px] w-[30px] items-center rounded-full border",
          checked
            ? "border-[#15852A] bg-[#15852A] dark:border-[#3BB44B] dark:bg-[#3BB44B]"
            : "border-black/20 bg-black/[0.06] dark:border-white/25 dark:bg-white/[0.08]",
          EASE_COLORS
        )}
      >
        <span
          className={cn(
            "absolute left-[2px] size-3 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition-[translate] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
            checked && "translate-x-3"
          )}
        />
      </span>
    </button>
  );
}

/**
 * One part of the screen, live, with no plate around it. Its label (code,
 * name, install) shows while you point at it, everywhere once "Show the
 * parts" is on, and always on touch screens, which can't point.
 */
function Piece({
  part,
  room,
  className,
  inspect,
  index,
}: {
  part: Part;
  room: string;
  className: string;
  inspect: boolean;
  index: number;
}) {
  const shown = inspect
    ? "opacity-100 translate-y-0"
    : "opacity-0 -translate-y-1 motion-reduce:translate-y-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100";
  return (
    <figure
      aria-label={part.title}
      className={cn("home-enter group relative", CELL, room, className)}
      style={enter(2, index * 40)}
    >
      <Fit className="px-5 py-5">
        <PartDemo part={part} />
      </Fit>
      {/* Exits a touch faster than it enters, so sweeping across the screen
          never leaves a trail of labels. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 ring-1 ring-[#15852A]/70 ring-inset transition-opacity duration-100 ease-out group-hover:duration-150 dark:ring-[#3BB44B]/70",
          inspect ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      />
      <figcaption
        className={cn(
          "absolute top-2 left-2 z-10 flex items-center gap-2 border bg-white py-1 pr-1 pl-2 dark:bg-black",
          LINE,
          "transition-[opacity,translate] duration-100 ease-out group-hover:duration-150",
          shown
        )}
      >
        <span className={cn(MONO, "font-medium text-[11.5px]", LEAF)}>
          {part.code}
        </span>
        <span className={cn("font-medium text-[12.5px]", INK)}>
          {part.title}
        </span>
        <InstallChip name={part.name} />
      </figcaption>
    </figure>
  );
}

function InstallChip({ name }: { name: string }) {
  const { copied, copy } = useCopy();
  return (
    <button
      aria-label={copied ? "Copied" : `Copy the install command for ${name}`}
      className={cn(
        "inline-flex h-6 items-center gap-1 px-1.5 text-[11px] text-black/55 hover:bg-black/[0.05] hover:text-black dark:text-white/55 dark:hover:bg-white/[0.08] dark:hover:text-white",
        MONO,
        EASE_COLORS,
        FOCUS_INSET
      )}
      onClick={() => copy(installCommand(name))}
      title={installCommand(name)}
      type="button"
    >
      <CopyIconSwap className="size-3" copied={copied} />
      {copied ? "Copied" : "Install"}
    </button>
  );
}

/**
 * What the screen is made of: each part with its packages and files, then
 * the one prompt that builds the whole screen in your agent.
 */
function Materials({ parts }: { parts: Part[] }) {
  const [id, setId] = useState<AgentId>("claude");
  const agent = TERMINAL_AGENTS.find((a) => a.id === id) ?? TERMINAL_AGENTS[0];
  const prompt = `Build a trip booking screen with ${parts
    .map((p) => `@kokonutui/${p.name}`)
    .join(", ")}`;
  const deps = [...new Set(parts.flatMap((p) => p.dependencies))];

  return (
    <section aria-labelledby="materials" className="pt-24 md:pt-32">
      <SectionHead
        aside="The screen above, taken apart. Every row is one file you own, with the packages it needs. Install them one by one, or hand your agent the list."
        id="materials"
        number="01"
        title="What it's made of"
      />
      <div className={cn("grid grid-cols-1 border", GRID, LINE)}>
        <div
          className={cn(
            "hidden grid-cols-[72px_1.4fr_1fr_1.4fr_auto] gap-4 px-4 py-2.5 md:grid",
            CELL,
            META
          )}
        >
          <span>Code</span>
          <span>Component</span>
          <span>Kind</span>
          <span>Packages</span>
          <span className="w-[150px]" />
        </div>
        {parts.map((part) => (
          <div
            className={cn(
              "grid grid-cols-[56px_1fr] items-center gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[72px_1.4fr_1fr_1.4fr_auto]",
              CELL
            )}
            key={part.name}
          >
            <span className={cn(MONO, "font-medium text-[12px]", LEAF)}>
              {part.code}
            </span>
            <span className={cn("font-medium text-[15px]", INK)}>
              {part.title}
            </span>
            <span
              className={cn(
                "col-start-2 text-[13.5px] md:col-start-auto",
                SOFT
              )}
            >
              {part.categorySlug === "ai" ? "AI" : `UI · ${part.category}`}
            </span>
            <span
              className={cn(
                MONO,
                "col-start-2 truncate text-[12px] md:col-start-auto",
                SOFT
              )}
            >
              {part.dependencies.join(", ") || "no extra packages"}
            </span>
            <span className="col-start-2 md:col-start-auto">
              <PlateFootActions part={part} />
            </span>
          </div>
        ))}
        <div className={cn("grid grid-cols-1 lg:grid-cols-12", GRID)}>
          <div className={cn("flex flex-col gap-3 p-5 lg:col-span-8", CELL)}>
            <AgentTabs
              agents={TERMINAL_AGENTS}
              className={cn(
                "grid w-full grid-cols-2 border sm:w-fit sm:grid-cols-4",
                GRID,
                LINE
              )}
              itemClassName="h-9 justify-center px-3 text-[12.5px]"
              onChange={setId}
              value={id}
            />
            <CopyLine
              className={cn("text-[13px]", INK)}
              label="prompt"
              prefix={agent.cli ? "$" : "›"}
              value={runPrompt(agent, prompt)}
            />
          </div>
          <div
            className={cn(
              "flex flex-col justify-center gap-1 p-5 lg:col-span-4",
              CELL
            )}
          >
            <p className={META}>Everything it installs</p>
            <p className={cn("text-[14px]", INK)}>
              {parts.length} files, {deps.length} packages:{" "}
              <span className={cn(MONO, "text-[12.5px]", SOFT)}>
                {deps.join(", ")}
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The plate's Agent and Copy buttons, on their own. */
function PlateFootActions({ part }: { part: Part }) {
  return (
    <span className="flex gap-1.5 md:justify-end">
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
  );
}
