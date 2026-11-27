"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { AGENTS } from "@/components/landing/home/agents";
import { Catalog, HeroActions } from "@/components/landing/home/catalog";
import { CopyIconSwap, useCopy } from "@/components/landing/home/client";
import { installCommand } from "@/components/landing/home/data";
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
import { cn } from "@/lib/utils";

/** What people ask their agent for, and the part that answers it. */
const ASKS = [
  { ask: "let people pay without leaving the chat", name: "ai-checkout" },
  { ask: "show what the agent is doing, step by step", name: "ai-tool-calls" },
  {
    ask: "a button you slide to confirm the payment",
    name: "slide-to-confirm",
  },
  { ask: "ask me before it runs a command", name: "ai-tool-approval" },
  {
    ask: "print a receipt once the order goes through",
    name: "receipt-printer",
  },
  { ask: "where's my order, live", name: "ai-order-status" },
  { ask: "a chat input with a model picker", name: "ai-prompt" },
  { ask: "pick the nights for a hotel stay", name: "stay-picker" },
  { ask: "toasts that follow the request", name: "promise-toast" },
  { ask: "hand the chat over to a person", name: "ai-handoff" },
  { ask: "a boarding pass that keeps itself current", name: "boarding-pass" },
  { ask: "let people choose their seat", name: "seat-map" },
  { ask: "find a time that works for both calendars", name: "ai-schedule" },
  { ask: "a keypad for sending money", name: "amount-pad" },
  { ask: "show what the assistant remembers", name: "ai-memory" },
  { ask: "delete, with a way to undo it", name: "undo-button" },
  { ask: "where the budget went this month", name: "spending-ring" },
  { ask: "talk to it instead of typing", name: "ai-voice" },
  { ask: "drop files into the conversation", name: "file-upload" },
];

/** Rows on each side of the one in focus; the outer ones fade to nothing. */
const REACH = 7;
const ROW = 44;
/** How long a row stays in focus before the next one comes up. */
const DWELL = 2600;

const at = (step: number) =>
  ASKS[((step % ASKS.length) + ASKS.length) % ASKS.length];

/** How a row reads at a distance from the focus: clear, then gone. */
function rowStyle(d: number): CSSProperties {
  const far = Math.abs(d);
  return {
    transform: `translateY(${d * ROW - ROW / 2}px)`,
    opacity: [1, 0.6, 0.42, 0.3, 0.2, 0.12, 0.05, 0][far] ?? 0,
    filter: far < 2 ? "none" : `blur(${(far - 1) * 0.7}px)`,
  };
}

export function Prompts({ parts }: { parts: Part[] }) {
  return (
    <Catalog cover={<PromptsCover count={parts.length} />} parts={parts} />
  );
}

/**
 * The headline and the install line on the left; on the right, what people
 * ask their agent, one ask after another, each landing on the part that
 * answers it. The install line follows the ask in focus.
 */
function PromptsCover({ count }: { count: number }) {
  const [step, setStep] = useState(0);
  const [held, setHeld] = useState(false);
  const current = at(step);

  useEffect(() => {
    if (held || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const id = window.setInterval(() => {
      if (!document.hidden) {
        setStep((s) => s + 1);
      }
    }, DWELL);
    return () => window.clearInterval(id);
  }, [held]);

  const hold = {
    onBlur: () => setHeld(false),
    onFocus: () => setHeld(true),
    onPointerEnter: () => setHeld(true),
    onPointerLeave: () => setHeld(false),
  };

  return (
    <section
      aria-label="Kokonut UI"
      className={cn("grid grid-cols-1 border lg:grid-cols-12", GRID, LINE)}
    >
      <div
        className={cn(
          "flex flex-col justify-center gap-7 p-5 sm:p-8 lg:col-span-6 lg:px-10 lg:py-16",
          CELL
        )}
      >
        <p className={cn("home-enter", META)} style={enter(0)}>
          Kokonut UI · {count} components · Free and open source
        </p>
        <h1
          className={cn(
            "home-enter text-balance font-semibold text-[clamp(40px,11vw,52px)] leading-[0.95] tracking-[-0.055em] sm:text-[clamp(52px,5.4vw,72px)]",
            INK
          )}
          style={enter(0)}
        >
          UI and AI components that feel right.
        </h1>
        <p
          className="home-enter max-w-[520px] text-pretty text-[18px] leading-[1.45] tracking-[-0.01em] sm:text-[20px]"
          style={enter(1)}
        >
          <span className={INK}>
            Open-source React components for the chat and the app around it.
          </span>{" "}
          <span className={SOFT}>
            Ask your agent for what you're building, or add them yourself.
          </span>
        </p>
        <div className="home-enter" style={enter(1)} {...hold}>
          <InstallLine name={current.name} />
        </div>
        <HeroActions count={count} />
      </div>

      <div
        className={cn("relative flex flex-col lg:col-span-6", CELL)}
        {...hold}
      >
        <div className="flex h-10 items-center justify-between gap-4 px-5 sm:px-8">
          <p className={META}>Ask your agent</p>
          <p className="flex items-center gap-2.5">
            <span className="sr-only">
              Works with Claude Code, Codex, Cursor and any agent
            </span>
            {AGENTS.filter((a) => a.id !== "vscode").map(
              ({ id, Mark, color }) => (
                <Mark className={cn("size-3.5", color)} key={id} />
              )
            )}
          </p>
        </div>
        <Reel onPick={setStep} step={step} />
      </div>
    </section>
  );
}

/** The command for the ask in focus; the part's name changes in place. */
function InstallLine({ name }: { name: string }) {
  const { copied, copy } = useCopy();
  const value = installCommand(name);
  return (
    <button
      aria-label={copied ? "Copied" : `Copy ${value}`}
      className={cn(
        "group flex min-h-12 w-full max-w-[560px] items-start gap-2.5 rounded-[10px] border bg-black/[0.025] px-4 py-3 text-left font-mono text-[13px] leading-[1.5] hover:border-black/25 sm:items-center sm:py-0 dark:bg-white/[0.04] dark:hover:border-white/30",
        LINE,
        EASE_COLORS,
        FOCUS
      )}
      onClick={() => copy(value)}
      type="button"
    >
      <span aria-hidden="true" className="text-black/35 dark:text-white/35">
        $
      </span>
      <span className="min-w-0 flex-1 sm:truncate">
        <span className={INK}>npx shadcn@latest add </span>
        <span className="text-black/55 dark:text-white/55">@kokonutui/</span>
        <span className={cn("prompt-name inline-block", LEAF)} key={name}>
          {name}
        </span>
      </span>
      <CopyIconSwap
        className="text-black/45 group-hover:text-black/70 dark:text-white/45 dark:group-hover:text-white/70"
        copied={copied}
      />
    </button>
  );
}

/**
 * The asks, stacked around the one in focus. Each row keeps its place in
 * the DOM while it moves, so a step glides every row up together and the
 * blur and fade follow the distance. Click any row to bring it into focus.
 */
function Reel({ step, onPick }: { step: number; onPick: (s: number) => void }) {
  const rows: number[] = [];
  for (let i = step - REACH; i <= step + REACH; i++) {
    rows.push(i);
  }
  return (
    <div className="prompt-reel relative h-[360px] overflow-hidden sm:h-[420px] lg:h-auto lg:min-h-[460px] lg:flex-1">
      <ol className="absolute inset-x-0 top-1/2">
        {rows.map((i) => {
          const d = i - step;
          const { ask, name } = at(i);
          return (
            <li
              aria-current={d === 0 ? "true" : undefined}
              className="prompt-row absolute inset-x-0 top-0"
              key={i}
              style={rowStyle(d)}
            >
              <button
                className={cn(
                  "flex w-full items-center justify-end gap-3 px-5 text-left sm:px-8",
                  MONO,
                  "text-[12.5px] sm:text-[13.5px]",
                  FOCUS_INSET
                )}
                onClick={() => onPick(i)}
                style={{ height: ROW }}
                tabIndex={Math.abs(d) <= 2 ? 0 : -1}
                type="button"
              >
                <span
                  className={cn(
                    "min-w-0 truncate",
                    d === 0 ? INK : "text-black/70 dark:text-white/70"
                  )}
                >
                  <span className="text-black/35 dark:text-white/35">› </span>
                  {ask}
                </span>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-black/30 dark:text-white/30"
                >
                  →
                </span>
                <span className={cn("shrink-0", LEAF)}>/{name}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
