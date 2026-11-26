"use client";

import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useRef,
} from "react";
import {
  Agents,
  HeroActions,
  Index,
  PlateFoot,
  References,
  SectionHead,
  Supplement,
} from "@/components/landing/home/catalog";
import { Fit } from "@/components/landing/home/live";
import type { Part } from "@/components/landing/home/parts";
import {
  CELL,
  enter,
  GRID,
  INK,
  LEAF,
  LINE,
  META,
  MONO,
  SOFT,
} from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";
import { PartDemo, pickParts } from "./demo";

/*
 * 3. Compare. Each job is shown twice in the same spot: the default a
 * shadcn/ui app would ship, and the Kokonut component for it. Drag the line
 * (or focus it and use the arrow keys) to wipe from one to the other. Both
 * sides are live; the line clips them, so you can use whichever you see.
 */

/** The plain versions, drawn the way shadcn/ui's defaults look. */
const PLAIN_BUTTON =
  "inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 font-medium text-sm text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900";
const PLAIN_FIELD =
  "h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50";
const PLAIN_CARD =
  "rounded-lg border border-zinc-200 bg-white p-5 text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50";

interface Job {
  name: string;
  title: string;
  line: string;
  plainLabel: string;
  plain: ReactNode;
}

const PAY: Job = {
  name: "slide-to-confirm",
  title: "Pay for the order",
  line: "A button pays on a stray tap. A slide asks for intent and shows it.",
  plainLabel: "Button",
  plain: (
    <button className={PLAIN_BUTTON} type="button">
      Pay $48.00
    </button>
  ),
};

const ASK: Job = {
  name: "ai-input-search",
  title: "Ask the assistant",
  line: "Tools a slash away, files dropped in, the send button where your thumb is.",
  plainLabel: "Textarea + Button",
  plain: (
    <div className="flex w-[440px] flex-col gap-2">
      <textarea
        className={cn(PLAIN_FIELD, "h-24 resize-none py-2")}
        placeholder="Ask anything…"
      />
      <button className={cn(PLAIN_BUTTON, "self-end")} type="button">
        Send
      </button>
    </div>
  ),
};

const JOBS: Job[] = [
  PAY,
  {
    name: "stay-picker",
    title: "Pick the nights",
    line: "Two date fields can't show a range, prices or what's sold out.",
    plainLabel: "Two date inputs",
    plain: (
      <div className="flex w-[320px] flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
          Check-in
          <input className={PLAIN_FIELD} type="date" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
          Check-out
          <input className={PLAIN_FIELD} type="date" />
        </label>
        <button className={PLAIN_BUTTON} type="button">
          Reserve
        </button>
      </div>
    ),
  },
  {
    name: "metric-card",
    title: "Show the number",
    line: "A static figure answers one question. Scrub it and it answers the next.",
    plainLabel: "Card",
    plain: (
      <div className={cn(PLAIN_CARD, "w-[340px]")}>
        <p className="text-sm text-zinc-500">Revenue</p>
        <p className="mt-1 font-semibold text-3xl">$51,612</p>
        <p className="mt-1 text-sm text-zinc-500">+6.8% vs previous 30 days</p>
      </div>
    ),
  },
  {
    name: "ai-order-status",
    title: "Track the delivery",
    line: "A status line says where it is. A map says how long you've got.",
    plainLabel: "Card",
    plain: (
      <div className={cn(PLAIN_CARD, "w-[340px]")}>
        <p className="text-sm text-zinc-500">Order #4821</p>
        <p className="mt-1 font-medium">Out for delivery</p>
        <p className="mt-1 text-sm text-zinc-500">Arriving around 2:14 pm</p>
      </div>
    ),
  },
];

export function Compare({ parts }: { parts: Part[] }) {
  const [ask] = pickParts(parts, [ASK.name]);
  const jobs = JOBS.flatMap((job) => {
    const [part] = pickParts(parts, [job.name]);
    return part ? [{ job, part }] : [];
  });

  return (
    <>
      <section
        aria-label="Kokonut UI"
        className={cn("grid grid-cols-1 border", GRID, LINE)}
      >
        <div className={cn("grid grid-cols-1 lg:grid-cols-12", GRID)}>
          <div
            className={cn(
              "flex flex-col justify-between gap-10 p-5 pt-8 sm:p-8 sm:pt-12 lg:col-span-5 lg:p-10",
              CELL
            )}
          >
            <h1
              className={cn(
                "home-enter font-semibold text-[clamp(38px,11vw,48px)] leading-[0.92] tracking-[-0.055em] sm:text-[clamp(48px,5vw,68px)]",
                INK
              )}
              style={enter(0)}
            >
              The default works. <br />
              This feels right.
            </h1>
            <div className="flex flex-col gap-6">
              <p
                className={cn(
                  "home-enter text-pretty text-[17px] leading-relaxed",
                  SOFT
                )}
                style={enter(1)}
              >
                <span className={INK}>
                  Open-source React components for AI chat and the app around
                  it, each one a step past the default.
                </span>{" "}
                Drag the line to see the difference. Install with the shadcn
                CLI, or ask your agent.
              </p>
              <HeroActions count={parts.length} />
            </div>
          </div>
          {ask ? (
            <div className="lg:col-span-7">
              <JobPlate hero job={ASK} part={ask} />
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="jobs" className="pt-24 md:pt-32">
        <SectionHead
          aside="Every row is a job an app does all day. On the left, what you'd ship by default; on the right, the component. Drag the line between them."
          id="jobs"
          number="01"
          title="Same job, better feel"
        />
        <div
          className={cn("grid grid-cols-1 border lg:grid-cols-2", GRID, LINE)}
        >
          {jobs.map(({ job, part }) => (
            <JobPlate job={job} key={part.name} part={part} />
          ))}
        </div>
      </section>

      <Agents number="02" />
      <Index number="03" parts={parts} />
      <References number="04" />
      <Supplement number="05" />
    </>
  );
}

function JobPlate({
  job,
  part,
  hero = false,
}: {
  job: Job;
  part: Part;
  hero?: boolean;
}) {
  return (
    <figure
      className={cn("home-enter flex flex-col", CELL)}
      style={hero ? enter(2) : undefined}
    >
      <div className="flex flex-col gap-0.5 px-4 pt-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <span className={cn("font-medium text-[15px]", INK)}>{job.title}</span>
        <span className={cn("text-[13px]", SOFT)}>{job.line}</span>
      </div>
      <Wipe
        kokonut={<PartDemo part={part} />}
        part={part}
        plain={job.plain}
        plainLabel={job.plainLabel}
        room={hero ? "h-[380px] sm:h-[480px]" : "h-[400px]"}
      />
      <PlateFoot part={part} />
    </figure>
  );
}

/**
 * Two live versions in one box, split by a line you drag. The line moves
 * with the pointer, no easing: anything between the hand and the line feels
 * like lag. Styles are written straight to the layers, so dragging never
 * re-renders the components underneath.
 */
function Wipe({
  plain,
  plainLabel,
  kokonut,
  part,
  room,
}: {
  plain: ReactNode;
  plainLabel: string;
  kokonut: ReactNode;
  part: Part;
  room: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const range = useRef<HTMLInputElement>(null);

  const place = useCallback((percent: number) => {
    const p = Math.min(100, Math.max(0, percent));
    if (left.current) {
      left.current.style.clipPath = `inset(0 ${100 - p}% 0 0)`;
    }
    if (right.current) {
      right.current.style.clipPath = `inset(0 0 0 ${p}%)`;
    }
    if (line.current) {
      line.current.style.left = `${p}%`;
    }
    if (range.current && Number(range.current.value) !== Math.round(p)) {
      range.current.value = String(Math.round(p));
    }
  }, []);

  const fromPointer = (e: ReactPointerEvent) => {
    const rect = box.current?.getBoundingClientRect();
    if (rect) {
      place(((e.clientX - rect.left) / rect.width) * 100);
    }
  };

  return (
    <div className={cn("relative overflow-hidden", room)} ref={box}>
      <div
        className="absolute inset-0 bg-black/[0.025] dark:bg-white/[0.03]"
        ref={left}
        style={{ clipPath: "inset(0 50% 0 0)" }}
      >
        <Fit className="px-6 py-6">{plain}</Fit>
      </div>
      <div
        className="absolute inset-0"
        ref={right}
        style={{ clipPath: "inset(0 0 0 50%)" }}
      >
        <Fit className="px-6 py-6">{kokonut}</Fit>
      </div>

      <span
        className={cn("pointer-events-none absolute top-3 left-4 z-10", META)}
      >
        shadcn/ui<span className="hidden sm:inline"> · {plainLabel}</span>
      </span>
      <span
        className={cn(
          "pointer-events-none absolute top-3 right-4 z-10 flex gap-2",
          META
        )}
      >
        <span className={cn(MONO, "font-medium", LEAF)}>{part.code}</span>
        Kokonut UI
      </span>

      {/* The keyboard way in: a real range input, read out as a slider, with
          its focus ring drawn on the handle. */}
      <input
        aria-label={`Wipe between the default and ${part.title}`}
        className="peer sr-only"
        defaultValue={50}
        max={100}
        min={0}
        onChange={(e) => place(Number(e.currentTarget.value))}
        ref={range}
        step={5}
        type="range"
      />
      <div
        className="absolute inset-y-0 z-20 w-px -translate-x-1/2 bg-black/35 peer-focus-visible:bg-black dark:bg-white/40 dark:peer-focus-visible:bg-white"
        ref={line}
        style={{ left: "50%" }}
      >
        <div
          aria-hidden
          className={cn(
            "absolute top-1/2 left-1/2 flex h-10 w-7 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-full border bg-white text-black/60 shadow-[0_1px_3px_rgba(0,0,0,0.12)] hover:text-black dark:bg-black dark:text-white/60 dark:hover:text-white",
            LINE,
            "transition-colors duration-150 ease-out"
          )}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            fromPointer(e);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              fromPointer(e);
            }
          }}
        >
          <svg
            aria-hidden="true"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
            viewBox="0 0 16 16"
          >
            <path d="M6 4 2 8l4 4M10 4l4 4-4 4" />
          </svg>
        </div>
      </div>
    </div>
  );
}
