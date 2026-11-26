"use client";

import Image from "next/image";
import Link from "next/link";
import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { CopyLine } from "@/components/landing/home/controls";
import { GITHUB_URL, mcpCommand } from "@/components/landing/home/data";
import { Fit } from "@/components/landing/home/live";
import type { Part } from "@/components/landing/home/parts";
import {
  EASE_COLORS,
  enter,
  FOCUS,
  INK,
  LEAF,
  META,
  MONO,
  SOFT,
} from "@/components/landing/home/styles";
import { SETUP_PROMPT } from "@/lib/agents";
import { cn } from "@/lib/utils";
import { PartDemo } from "./demo";
import { InstallBar } from "./install";
import { matchParts } from "./match";

// The homepage is a conversation with the catalog: describe a screen, get
// the component running in the reply, and the line that adds it with the
// CLI or your agent. Matching runs in the browser; nothing is sent anywhere.

const DEMO_ASK = "Something to pay without leaving the chat";

const SUGGESTIONS = [
  "A date picker for a hotel stay",
  "Show what my agent is doing",
  "Track a delivery on a map",
  "A toast when a change is saved",
  "Budget chart for a finance app",
  "Set it up with Claude Code",
];

const SETUP = /(set ?up|install|mcp|claude|codex|cursor|copilot|my agent)/;
const CATALOG =
  /(everything|all components|all of them|catalog|what do you have|list)/;

type Answer =
  | { kind: "part"; part: Part; more: Part[] }
  | { kind: "setup" }
  | { kind: "catalog" }
  | { kind: "none" };

interface Turn {
  id: number;
  ask: string;
  answer: Answer;
}

function answer(parts: Part[], ask: string): Answer {
  const q = ask.toLowerCase();
  const found = matchParts(parts, ask, 4);
  const named = found[0] && q.includes(found[0].title.toLowerCase());
  if (SETUP.test(q) && !named) {
    return { kind: "setup" };
  }
  if (CATALOG.test(q) && !named) {
    return { kind: "catalog" };
  }
  const [part, ...more] = found;
  return part ? { kind: "part", part, more } : { kind: "none" };
}

/** Short parts get a short stage, so a button isn't lost in a big box. */
const STAGE: Record<string, string> = {
  buttons: "h-[260px]",
  texts: "h-[260px]",
  backgrounds: "h-[400px]",
};

/** Words arrive one after another, from a blur, like a reply being written. */
function Words({ text, className }: { text: string; className?: string }) {
  const words = text
    .split(" ")
    .map((word, i) => ({ word, id: `${i}:${word}` }));
  return (
    <p className={className}>
      {words.map(({ word, id }, i) => (
        <span
          className="ask-word"
          key={id}
          style={{ "--i": i } as CSSProperties}
        >
          {word}{" "}
        </span>
      ))}
    </p>
  );
}

/** When the words have landed, in ms: the next block starts then. */
const after = (text: string) => Math.min(text.split(" ").length * 18, 540) + 80;

function Chip({
  children,
  onClick,
}: {
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "h-8 rounded-full border border-black/[0.1] px-3 text-[13px] text-black/70 hover:border-black/25 hover:text-black dark:border-white/[0.12] dark:text-white/70 dark:hover:border-white/30 dark:hover:text-white",
        EASE_COLORS,
        FOCUS
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function PartReply({
  part,
  more,
  onAsk,
}: {
  part: Part;
  more: Part[];
  onAsk: (text: string) => void;
}) {
  const text = `${part.title}. ${part.description ?? ""}`.trim();
  const wait = after(text);
  return (
    <>
      <Words className={cn("text-[16px] leading-[1.6]", INK)} text={text} />
      <div
        className={cn(
          "home-enter relative mt-4 overflow-hidden rounded-[18px] bg-[#f4f4f3] dark:bg-[#0e0e0e]",
          STAGE[part.categorySlug] ?? "h-[480px]"
        )}
        style={enter(0, wait)}
      >
        <Fit className="p-6">
          <PartDemo part={part} />
        </Fit>
      </div>
      <div
        className="home-enter mt-4 flex flex-col gap-4"
        style={enter(1, wait)}
      >
        <p className={cn(META, "flex flex-wrap gap-x-3 gap-y-1")}>
          <span className={LEAF}>{part.code}</span>
          <span>{part.category}</span>
          {part.dependencies.length ? (
            <span>{part.dependencies.join(", ")}</span>
          ) : null}
          <Link
            className={cn("underline-offset-4 hover:underline", INK, FOCUS)}
            href={part.url}
          >
            Docs ↗
          </Link>
        </p>
        <InstallBar defaultWay="claude" names={[part.name]} />
        {more.length ? (
          <div className="flex flex-col gap-2">
            <span className={META}>Also close</span>
            <div className="flex flex-wrap gap-1.5">
              {more.map((p) => (
                <Chip key={p.name} onClick={() => onAsk(p.title)}>
                  {p.title}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

const SETUP_TEXT =
  "Paste this into Claude Code, Codex, Cursor or any agent. It adds the registry, the MCP server and a rules file. After that, every component is one sentence away.";

function SetupReply() {
  const wait = after(SETUP_TEXT);
  return (
    <>
      <Words
        className={cn("text-[16px] leading-[1.6]", INK)}
        text={SETUP_TEXT}
      />
      <div
        className="home-enter mt-4 flex flex-col gap-4 rounded-[18px] bg-[#f4f4f3] p-5 dark:bg-[#0e0e0e]"
        style={enter(0, wait)}
      >
        <CopyLine
          className={cn("text-[13px]", INK)}
          label="setup prompt"
          prefix="›"
          value={SETUP_PROMPT}
        />
        <div className="flex flex-col gap-1.5">
          <span className={META}>Or only the MCP server</span>
          {(["claude", "codex", "cursor", "vscode"] as const).map((client) => (
            <CopyLine
              className={SOFT}
              key={client}
              prefix="$"
              value={mcpCommand(client)}
            />
          ))}
        </div>
      </div>
      <Link
        className={cn(
          "home-enter mt-3 inline-block text-[13px] underline-offset-4 hover:underline",
          INK,
          FOCUS
        )}
        href="/docs/agents"
        style={enter(1, wait)}
      >
        The agents guide ↗
      </Link>
    </>
  );
}

function CatalogReply({
  parts,
  onAsk,
}: {
  parts: Part[];
  onAsk: (text: string) => void;
}) {
  const groups = [...new Set(parts.map((p) => p.category))].map((title) => ({
    title,
    items: parts.filter((p) => p.category === title),
  }));
  const text = `${parts.length} components in ${groups.length} groups. Pick one and it runs here.`;
  const wait = after(text);
  return (
    <>
      <Words className={cn("text-[16px] leading-[1.6]", INK)} text={text} />
      <div className="mt-4 flex flex-col gap-5">
        {groups.map((group, i) => (
          <div
            className="home-enter flex flex-col gap-2"
            key={group.title}
            style={enter(i, wait)}
          >
            <span className={META}>
              {group.title} · {group.items.length}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {group.items.slice(0, 8).map((p) => (
                <Chip key={p.name} onClick={() => onAsk(p.title)}>
                  {p.title}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const NONE_TEXT =
  "Nothing in the catalog fits that yet. Try other words, or ask for it on GitHub.";

function NoneReply({ onAsk }: { onAsk: (text: string) => void }) {
  const wait = after(NONE_TEXT);
  return (
    <>
      <Words
        className={cn("text-[16px] leading-[1.6]", INK)}
        text={NONE_TEXT}
      />
      <div
        className="home-enter mt-3 flex flex-wrap gap-1.5"
        style={enter(0, wait)}
      >
        {SUGGESTIONS.slice(0, 3).map((s) => (
          <Chip key={s} onClick={() => onAsk(s)}>
            {s}
          </Chip>
        ))}
        <a
          className={cn(
            "inline-flex h-8 items-center px-2 text-[13px] underline-offset-4 hover:underline",
            INK,
            FOCUS
          )}
          href={`${GITHUB_URL}/issues/new`}
          rel="noopener"
          target="_blank"
        >
          Open an issue ↗
        </a>
      </div>
    </>
  );
}

function Reply({
  turn,
  parts,
  onAsk,
}: {
  turn: Turn;
  parts: Part[];
  onAsk: (text: string) => void;
}) {
  const { answer: a } = turn;
  return (
    <article
      className="flex scroll-mt-[120px] flex-col gap-5"
      id={`ask-${turn.id}`}
    >
      <p className="ask-sent max-w-[85%] self-end rounded-[20px] bg-black px-4 py-2.5 text-[15px] text-white leading-[1.5] dark:bg-white dark:text-black">
        {turn.ask}
      </p>
      <div className="flex gap-3">
        <Image
          alt=""
          className="mt-1 size-5 shrink-0 dark:invert"
          height={20}
          src="/logo.svg"
          width={20}
        />
        <div className="min-w-0 flex-1">
          {a.kind === "part" ? (
            <PartReply more={a.more} onAsk={onAsk} part={a.part} />
          ) : null}
          {a.kind === "setup" ? <SetupReply /> : null}
          {a.kind === "catalog" ? (
            <CatalogReply onAsk={onAsk} parts={parts} />
          ) : null}
          {a.kind === "none" ? <NoneReply onAsk={onAsk} /> : null}
        </div>
      </div>
    </article>
  );
}

export function Ask({ parts }: { parts: Part[] }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");
  const nextId = useRef(0);
  const timers = useRef<number[]>([]);
  const playing = useRef(false);

  const stopDemo = useCallback(() => {
    for (const t of timers.current) {
      window.clearTimeout(t);
    }
    timers.current = [];
    if (playing.current) {
      playing.current = false;
      setDraft("");
    }
  }, []);

  const send = useCallback(
    (text: string, scroll = true) => {
      const ask = text.trim();
      if (!ask) {
        return;
      }
      const id = nextId.current++;
      const a = answer(parts, ask);
      setTurns((t) => [...t, { id, ask, answer: a }]);
      setDraft("");
      setStatus(a.kind === "part" ? `Showing ${a.part.title}` : "Answered");
      if (scroll) {
        const reduce = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;
        requestAnimationFrame(() =>
          document
            .getElementById(`ask-${id}`)
            ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" })
        );
      }
    },
    [parts]
  );

  const ask = useCallback(
    (text: string) => {
      stopDemo();
      send(text);
    },
    [send, stopDemo]
  );

  // The first answer plays on its own, so the page shows what it does before
  // anyone types: the ask is typed into the composer, then sent.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      send(DEMO_ASK, false);
      return;
    }
    playing.current = true;
    const later = (fn: () => void, ms: number) => {
      timers.current.push(window.setTimeout(fn, ms));
    };
    const typeFrom = (i: number) => {
      if (i > DEMO_ASK.length) {
        later(() => {
          playing.current = false;
          send(DEMO_ASK, false);
        }, 260);
        return;
      }
      setDraft(DEMO_ASK.slice(0, i));
      later(() => typeFrom(i + 1), 28);
    };
    later(() => typeFrom(1), 700);
    return () => {
      for (const t of timers.current) {
        window.clearTimeout(t);
      }
      timers.current = [];
    };
  }, [send]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (playing.current) {
      return;
    }
    ask(draft);
  };

  return (
    <section className="mx-auto flex min-h-[calc(100svh-150px)] w-full max-w-[760px] flex-col px-4 sm:px-6">
      <header className="home-enter pt-14 pb-10 sm:pt-24" style={enter(0)}>
        <p className={cn(META, "mb-6")}>
          Kokonut UI · {parts.length} components · Free and open source
        </p>
        <h1
          className={cn(
            "font-semibold text-[44px] leading-[1] tracking-[-0.035em] sm:text-[68px]",
            INK
          )}
        >
          What are you building?
        </h1>
        <p
          className={cn("mt-5 max-w-[560px] text-[17px] leading-[1.55]", SOFT)}
        >
          Describe the screen. The reply is the component, running, with the
          line that adds it through shadcn, Claude Code, Codex, Cursor or any
          agent.
        </p>
        <div className="mt-7 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <Chip key={s} onClick={() => ask(s)}>
              {s}
            </Chip>
          ))}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-12 pb-10">
        {turns.map((turn) => (
          <Reply key={turn.id} onAsk={ask} parts={parts} turn={turn} />
        ))}
      </div>
      <p aria-live="polite" className="sr-only">
        {status}
      </p>

      <form
        className="sticky bottom-0 z-10 bg-white pt-2 pb-4 dark:bg-black"
        onSubmit={onSubmit}
      >
        <div
          className={cn(
            "flex items-center gap-2 rounded-[22px] border border-black/[0.14] bg-white p-1.5 pl-4 focus-within:border-black/35 dark:border-white/[0.16] dark:bg-[#0a0a0a] dark:focus-within:border-white/40",
            EASE_COLORS
          )}
        >
          <label className="sr-only" htmlFor="ask-input">
            Describe what you are building
          </label>
          <input
            autoComplete="off"
            className={cn(
              "h-9 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-black/40 dark:placeholder:text-white/40",
              INK
            )}
            id="ask-input"
            onChange={(e) => setDraft(e.target.value)}
            onFocus={stopDemo}
            onPointerDown={stopDemo}
            placeholder="A seat picker for a cinema…"
            value={draft}
          />
          <button
            aria-label="Send"
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full bg-black text-white disabled:bg-black/15 dark:bg-white dark:text-black dark:disabled:bg-white/20",
              EASE_COLORS,
              FOCUS
            )}
            disabled={!draft.trim()}
            type="submit"
          >
            <svg
              aria-hidden="true"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              viewBox="0 0 16 16"
            >
              <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
            </svg>
          </button>
        </div>
        <p className={cn(MONO, "mt-2 text-center text-[11px]", SOFT)}>
          Answers come from the catalog, in your browser. Nothing is sent
          anywhere.
        </p>
      </form>
    </section>
  );
}
