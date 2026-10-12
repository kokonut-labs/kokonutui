"use client";

import { ArrowRightIcon, ArrowUpRightIcon, CheckIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import Link from "next/link";
import {
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Anthropic from "@/components/icons/anthropic";
import OpenAI from "@/components/icons/open-ai";
import V0 from "@/components/icons/v0";
import AIPrompt from "@/components/kokonutui/ai-prompt";
import AppleActivityCard from "@/components/kokonutui/apple-activity-card";
import HoldButton from "@/components/kokonutui/hold-button";
import { CursorDark } from "@/components/ui/svgs/cursor-dark";
import { cn } from "@/lib/utils";
import {
  type Category,
  installCommand,
  MCP_COMMAND,
  PRO_URL,
  QUOTES,
  type VariantProps,
} from "./data";
import { CopyIconSwap, enter, Monogram, PRESS, useCopy } from "./shared";

// Direction: explanation. The hero is a scripted demo of the actual workflow
// (ask an agent, it runs the shadcn CLI, the component appears) so the page
// shows how KokonutUI works instead of describing it.

interface Scenario {
  name: string;
  prompt: string;
  files: string[];
  hint: string;
  render: () => ReactNode;
}

// File lists match each component's registry entry (its own files plus the
// shadcn primitives it depends on).
const SCENARIOS: Scenario[] = [
  {
    name: "hold-button",
    prompt: "Add a hold-to-delete button to the danger zone",
    files: ["components/ui/button.tsx", "components/kokonutui/hold-button.tsx"],
    hint: "Press and hold it",
    render: () => <HoldButton holdDuration={2000} />,
  },
  {
    name: "ai-prompt",
    prompt: "Our chat page needs a prompt box with a model picker",
    files: [
      "components/ui/textarea.tsx",
      "components/ui/button.tsx",
      "components/ui/dropdown-menu.tsx",
      "components/kokonutui/ai-prompt.tsx",
      "hooks/use-auto-resize-textarea.ts",
      "components/icons/anthropic.tsx",
      "components/icons/anthropic-dark.tsx",
    ],
    hint: "Type, then press Enter",
    render: () => <AIPrompt className="w-full max-w-[420px]" />,
  },
  {
    name: "apple-activity-card",
    prompt: "Show today's move, exercise and stand goals as rings",
    files: ["components/kokonutui/apple-activity-card.tsx"],
    hint: "Rings fill as it mounts",
    render: () => <AppleActivityCard className="p-0" title="Today" />,
  },
];

const VISIBLE_FILES = 3;

// Timeline, in ms. Typing is the slowest beat because it's the part people
// read; the CLI lines land quickly, like a real install.
const CHAR_MS = 24;
const TYPE_START = 350;
const HOLD_MS = 5200;

type LineKind = "agent" | "cmd" | "ok" | "file";

interface Line {
  at: number;
  kind: LineKind;
  text: string;
}

interface Timeline {
  typeEnd: number;
  lines: Line[];
  installedAt: number;
  total: number;
}

function buildTimeline(s: Scenario): Timeline {
  const typeEnd = TYPE_START + s.prompt.length * CHAR_MS;
  const lines: Line[] = [];
  let t = typeEnd + 320;
  const push = (kind: LineKind, text: string, gap: number) => {
    lines.push({ at: t, kind, text });
    t += gap;
  };

  push("agent", "I'll add it from the KokonutUI registry.", 420);
  push("cmd", installCommand(s.name), 650);
  push("ok", "Checking registry.", 360);
  push("ok", "Installing dependencies.", 520);
  push(
    "ok",
    `Created ${s.files.length} ${s.files.length === 1 ? "file" : "files"}:`,
    90
  );
  for (const file of s.files.slice(0, VISIBLE_FILES)) {
    push("file", `- ${file}`, 80);
  }
  if (s.files.length > VISIBLE_FILES) {
    push("file", `  and ${s.files.length - VISIBLE_FILES} more`, 80);
  }
  const installedAt = t;
  t += 380;
  push("agent", `Done. It's in components/kokonutui/${s.name}.tsx.`, 0);

  return { typeEnd, lines, installedAt, total: t + HOLD_MS };
}

interface Snapshot {
  chars: number;
  lines: number;
  installed: boolean;
}

function snapshotAt(timeline: Timeline, prompt: string, ms: number): Snapshot {
  const chars = Math.max(
    0,
    Math.min(prompt.length, Math.floor((ms - TYPE_START) / CHAR_MS))
  );
  const lines = timeline.lines.filter((l) => l.at <= ms).length;
  return { chars, lines, installed: ms >= timeline.installedAt };
}

const DONE: Snapshot = {
  chars: Number.POSITIVE_INFINITY,
  lines: 99,
  installed: true,
};

export function TerminalVariant({ categories, total }: VariantProps) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-40 sm:px-6">
      <Hero total={total} />
      <Clients />
      <WaysIn />
      <Registry categories={categories} total={total} />
      <Voices />
      <ProPanel />
    </div>
  );
}

function Hero({ total }: { total: number }) {
  return (
    <header className="grid grid-cols-1 items-center gap-12 pt-14 pb-8 md:pt-20 lg:grid-cols-12 lg:gap-10">
      <div className="min-w-0 lg:col-span-5">
        <p
          className="proto-enter mb-5 font-mono text-[12px] text-black/50 dark:text-white/50"
          style={enter(0)}
        >
          @kokonutui · shadcn registry
        </p>
        <h1
          className="proto-enter text-balance font-semibold text-[40px] text-black leading-[1.04] tracking-[-0.035em] sm:text-[52px] dark:text-white"
          style={enter(1)}
        >
          Describe it.
          <span className="block text-black/35 dark:text-white/40">
            Your agent installs it.
          </span>
        </h1>
        <p
          className="proto-enter mt-5 max-w-[460px] text-pretty text-[17px] text-black/60 leading-relaxed dark:text-white/60"
          style={enter(2)}
        >
          All {total} KokonutUI components live in a shadcn registry that Claude
          Code, Cursor, VS Code and Codex can read. Ask for what you need and
          get plain React and Tailwind CSS you own.
        </p>
        <div
          className="proto-enter mt-8 flex max-w-[460px] flex-col gap-3"
          style={enter(3)}
        >
          <CommandChip command={MCP_COMMAND} />
          <Link
            className="group inline-flex items-center gap-1.5 self-start font-medium text-[14px] text-black/70 hover:text-black dark:text-white/70 dark:hover:text-white"
            href="/docs"
          >
            Or browse all {total} components
            <ArrowRightIcon
              aria-hidden
              className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </div>
      <div className="proto-enter min-w-0 lg:col-span-7" style={enter(4)}>
        <Demo />
      </div>
    </header>
  );
}

function Demo() {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const scenario = SCENARIOS[index];
  const timeline = useMemo(() => buildTimeline(scenario), [scenario]);
  const [snap, setSnap] = useState<Snapshot>({
    chars: 0,
    lines: 0,
    installed: false,
  });

  // Pause reasons. Each one is an edge case people never notice: the demo
  // holds while you play with an installed component, while the tab is
  // hidden, and while the hero is scrolled out of view.
  const [pointerInside, setPointerInside] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const playing = (pointerInside || focusInside) && snap.installed;
  const paused = playing || hidden || offscreen;

  const rootRef = useRef<HTMLDivElement>(null);
  const progressRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const elapsed = useRef(0);

  const go = useCallback((i: number) => {
    elapsed.current = 0;
    setIndex(i);
  }, []);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) =>
      setOffscreen(!entry.isIntersecting)
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Progress bars are written straight to the DOM every frame; only the
  // transcript goes through React, and only when a visible line changes.
  const paintProgress = useCallback(() => {
    progressRefs.current.forEach((bar, i) => {
      if (!bar) {
        return;
      }
      let p = 0;
      if (i < index) {
        p = 1;
      } else if (i === index) {
        p = Math.min(1, elapsed.current / timeline.total);
      }
      bar.style.transform = `scaleX(${p})`;
    });
  }, [index, timeline]);

  useLayoutEffect(() => {
    if (reduceMotion) {
      setSnap(DONE);
      return;
    }
    setSnap(snapshotAt(timeline, scenario.prompt, elapsed.current));
    paintProgress();
  }, [reduceMotion, timeline, scenario, paintProgress]);

  useEffect(() => {
    if (reduceMotion || paused) {
      return;
    }
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      elapsed.current += now - last;
      last = now;
      if (elapsed.current >= timeline.total) {
        go((index + 1) % SCENARIOS.length);
        return;
      }
      const next = snapshotAt(timeline, scenario.prompt, elapsed.current);
      setSnap((prev) =>
        prev.chars === next.chars &&
        prev.lines === next.lines &&
        prev.installed === next.installed
          ? prev
          : next
      );
      paintProgress();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion, paused, timeline, scenario, index, go, paintProgress]);

  const typing = snap.chars < scenario.prompt.length;

  // Long transcripts (or narrow screens) scroll like a real terminal: the
  // newest line stays in view.
  const transcriptRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = transcriptRef.current;
    if (el && snap.lines >= 0) {
      el.scrollTop = el.scrollHeight;
    }
  }, [snap.lines]);

  return (
    <div
      className="overflow-hidden rounded-2xl bg-[#0a0a0a] shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_24px_48px_-16px_rgba(0,0,0,0.25)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_24px_48px_-16px_rgba(0,0,0,0.8)]"
      ref={rootRef}
    >
      {/* Tabs double as the timeline: the active one fills as it plays. */}
      <div
        aria-label="Demo scenarios"
        className="flex border-white/[0.08] border-b"
        role="tablist"
      >
        {SCENARIOS.map((s, i) => (
          <button
            aria-selected={i === index}
            className={cn(
              "relative flex h-10 min-w-0 flex-1 items-center justify-center px-3 font-mono text-[12px] transition-colors duration-150 ease-out sm:flex-none sm:justify-start sm:px-4",
              i === index
                ? "bg-white/[0.04] text-white"
                : "text-white/45 hover:text-white/75"
            )}
            key={s.name}
            onClick={() => go(i)}
            role="tab"
            type="button"
          >
            <span className="truncate">{s.name}.tsx</span>
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-[#3BB44B] motion-reduce:hidden"
              ref={(el) => {
                progressRefs.current[i] = el;
              }}
            />
          </button>
        ))}
      </div>

      <div
        className="h-[288px] overflow-hidden px-5 py-4 font-mono text-[12.5px] leading-[1.75] sm:text-[13px]"
        ref={transcriptRef}
      >
        <p className="text-white">
          <span className="mr-2 text-[#3BB44B]">›</span>
          {scenario.prompt.slice(0, snap.chars)}
          {typing ? (
            <span className="proto-caret ml-px inline-block h-[1.1em] w-[7px] translate-y-[3px] bg-white/80" />
          ) : null}
        </p>
        {timeline.lines.slice(0, snap.lines).map((line) => (
          <TranscriptLine key={`${scenario.name}-${line.at}`} line={line} />
        ))}
      </div>

      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: pointer and focus only pause the demo; the component inside is what you interact with */}
      <section
        aria-label={`Live preview of ${scenario.name}`}
        className="relative border-white/[0.08] border-t bg-white dark:bg-[#050505]"
        onBlur={(e) => {
          // Typing in the preview keeps it paused even after the pointer
          // leaves; only focus moving out of the preview releases it.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setFocusInside(false);
          }
        }}
        onFocus={() => setFocusInside(true)}
        onPointerEnter={() => setPointerInside(true)}
        onPointerLeave={() => setPointerInside(false)}
      >
        <div className="flex h-9 items-center justify-between border-black/[0.06] border-b px-4 text-[12px] dark:border-white/[0.06]">
          <span className="text-black/45 dark:text-white/45">Preview</span>
          <span className="text-black/45 dark:text-white/45">
            {previewStatus(snap.installed, playing, scenario.hint)}
          </span>
        </div>
        <div className="flex h-[300px] items-center justify-center overflow-hidden p-6">
          {snap.installed ? (
            <Preview key={scenario.name} scenario={scenario} />
          ) : (
            <span className="font-mono text-[12px] text-black/30 dark:text-white/30">
              {installCommand(scenario.name)}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

function previewStatus(installed: boolean, playing: boolean, hint: string) {
  if (!installed) {
    return "Waiting for install…";
  }
  return playing ? "Paused while you play" : hint;
}

const Preview = memo(function Preview({ scenario }: { scenario: Scenario }) {
  return <div className="proto-materialize">{scenario.render()}</div>;
});

function TranscriptLine({ line }: { line: Line }) {
  if (line.kind === "agent") {
    return (
      <p className="proto-line text-white/85">
        <span className="mr-2 text-[#3BB44B]">●</span>
        {line.text}
      </p>
    );
  }
  if (line.kind === "cmd") {
    return (
      <p className="proto-line truncate pl-4 text-white/55">
        <span className="mr-2 text-white/30">$</span>
        {line.text}
      </p>
    );
  }
  if (line.kind === "ok") {
    return (
      <p className="proto-line pl-4 text-white/70">
        <span className="mr-2 text-[#3BB44B]">✔</span>
        {line.text}
      </p>
    );
  }
  return <p className="proto-line truncate pl-10 text-white/45">{line.text}</p>;
}

function CommandChip({ command }: { command: string }) {
  const { copied, copy } = useCopy();
  return (
    <button
      aria-label={copied ? "Copied" : `Copy ${command}`}
      className={cn(
        "flex h-12 w-full min-w-0 items-center gap-3 rounded-xl bg-black px-4 text-left font-mono text-[13px] text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90",
        PRESS
      )}
      onClick={() => copy(command)}
      type="button"
    >
      <span aria-hidden className="opacity-40">
        $
      </span>
      <span className="min-w-0 flex-1 truncate">{command}</span>
      <CopyIconSwap className="opacity-60" copied={copied} />
    </button>
  );
}

const CLIENTS: { name: string; icon?: ReactNode }[] = [
  { name: "Claude Code", icon: <Anthropic className="size-4 fill-current" /> },
  {
    name: "Cursor",
    icon: <CursorDark className="size-4 fill-current" />,
  },
  { name: "Codex", icon: <OpenAI className="size-4 fill-current" /> },
  { name: "VS Code" },
  {
    name: "v0",
    icon: <V0 className="size-5 [&_path]:fill-current" />,
  },
];

function Clients() {
  return (
    <section className="flex flex-col items-start gap-4 border-black/[0.07] border-y py-6 md:flex-row md:items-center md:justify-between dark:border-white/[0.08]">
      <p className="text-[14px] text-black/50 dark:text-white/50">
        Works with the tools you already use
      </p>
      <ul className="flex flex-wrap items-center gap-x-7 gap-y-3 text-black/70 dark:text-white/70">
        {CLIENTS.map((client) => (
          <li
            className="inline-flex items-center gap-2 font-medium text-[14px]"
            key={client.name}
          >
            {client.icon}
            {client.name}
          </li>
        ))}
      </ul>
    </section>
  );
}

const WAYS = [
  {
    id: "cli",
    label: "CLI",
    command: installCommand("hold-button"),
    body: "Adds the component's source and its dependencies to your project. It's your code from then on.",
  },
  {
    id: "mcp",
    label: "MCP",
    command: MCP_COMMAND,
    body: "Gives Claude Code, Cursor, VS Code or Codex the whole registry, so they can search it, read dependencies and install for you.",
  },
  {
    id: "markdown",
    label: "Markdown",
    command: "curl https://kokonutui.com/docs/buttons/hold-button.md",
    body: "Every docs page has a Markdown twin with the install command and full source, and /llms.txt lists them all.",
  },
] as const;

function WaysIn() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);
  const way = WAYS[active];

  useLayoutEffect(() => {
    const el = tabRefs.current[active];
    const highlight = highlightRef.current;
    if (el && highlight) {
      highlight.style.width = `${el.offsetWidth}px`;
      highlight.style.transform = `translateX(${el.offsetLeft}px)`;
    }
  }, [active]);

  useEffect(() => {
    // Don't animate the highlight into its first position.
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section className="grid grid-cols-1 gap-10 pt-28 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <h2 className="font-semibold text-[32px] text-black leading-tight tracking-[-0.03em] dark:text-white">
          Three ways in
        </h2>
        <p className="mt-3 max-w-[340px] text-[15px] text-black/55 leading-relaxed dark:text-white/55">
          Pick whichever fits how you work. They all read the same registry.
        </p>
      </div>
      <div className="min-w-0 lg:col-span-8">
        <div
          className="relative mb-4 inline-flex rounded-lg bg-black/[0.04] p-1 dark:bg-white/[0.06]"
          role="tablist"
        >
          <span
            aria-hidden
            className={cn(
              "absolute top-1 left-0 h-8 rounded-md bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] dark:bg-white/[0.12] dark:shadow-none",
              ready &&
                "transition-[transform,width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
            )}
            ref={highlightRef}
          />
          {WAYS.map((w, i) => (
            <button
              aria-selected={i === active}
              className={cn(
                "relative h-8 px-4 font-medium text-[13px] transition-colors duration-150",
                i === active
                  ? "text-black dark:text-white"
                  : "text-black/50 hover:text-black/80 dark:text-white/50 dark:hover:text-white/80"
              )}
              key={w.id}
              onClick={() => setActive(i)}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              type="button"
            >
              {w.label}
            </button>
          ))}
        </div>
        {/* Tabs get clicked back and forth, so the panel swaps instantly. */}
        <div role="tabpanel">
          <WayCommand command={way.command} key={way.id} />
          <p className="mt-4 max-w-[560px] text-[15px] text-black/60 leading-relaxed dark:text-white/60">
            {way.body}
          </p>
        </div>
      </div>
    </section>
  );
}

function WayCommand({ command }: { command: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl bg-[#0a0a0a] px-5 py-4 font-mono text-[13px] text-white/85 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]">
      <span aria-hidden className="text-white/30">
        $
      </span>
      <span className="min-w-0 flex-1 truncate">{command}</span>
      <button
        aria-label={copied ? "Copied" : `Copy ${command}`}
        className={cn(
          "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white",
          PRESS
        )}
        onClick={() => copy(command)}
        type="button"
      >
        <CopyIconSwap copied={copied} />
      </button>
    </div>
  );
}

function Registry({
  categories,
  total,
}: {
  categories: Category[];
  total: number;
}) {
  return (
    <section className="pt-28">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-semibold text-[32px] text-black tracking-[-0.03em] dark:text-white">
            One registry, {total} components
          </h2>
          <p className="mt-3 text-[15px] text-black/55 dark:text-white/55">
            Everything your agent can see, grouped the way the docs are.
          </p>
        </div>
        <a
          className="group inline-flex items-center gap-1.5 font-mono text-[13px] text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
          href="/r/registry.json"
        >
          /r/registry.json
          <ArrowUpRightIcon
            aria-hidden
            className="size-3.5 transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </a>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 rounded-2xl border border-black/[0.07] p-6 font-mono text-[13px] sm:grid-cols-3 md:p-8 lg:grid-cols-4 dark:border-white/[0.08]">
        {categories.map((category) => (
          <div key={category.slug}>
            <p className="mb-2 text-black dark:text-white">
              {category.slug}/
              <span className="ml-2 text-black/35 dark:text-white/35">
                {category.items.length}
              </span>
            </p>
            <ul className="flex flex-col gap-1">
              {category.items.map((item) => (
                <li className="truncate" key={item.url}>
                  <Link
                    className="text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white"
                    href={item.url}
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Voices() {
  return (
    <section className="scroll-mt-28 pt-28" id="testimonials">
      <h2 className="mb-8 font-semibold text-[32px] text-black tracking-[-0.03em] dark:text-white">
        From the timeline
      </h2>
      <div className="grid gap-px overflow-hidden rounded-2xl bg-black/[0.07] sm:grid-cols-2 lg:grid-cols-3 dark:bg-white/[0.08]">
        {QUOTES.map((quote) => (
          <a
            className="flex flex-col gap-4 bg-white p-6 transition-colors duration-150 hover:bg-black/[0.015] dark:bg-black dark:hover:bg-white/[0.03]"
            href={`https://x.com/${quote.handle}`}
            key={quote.handle}
            rel="noreferrer"
            target="_blank"
          >
            <p className="flex-1 text-pretty text-[15px] text-black/75 leading-relaxed dark:text-white/75">
              {quote.text}
            </p>
            <span className="flex items-center gap-2.5">
              <Monogram className="size-7 text-[12px]" name={quote.name} />
              <span className="text-[13px] text-black dark:text-white">
                {quote.name}
              </span>
              <span className="font-mono text-[12px] text-black/40 dark:text-white/40">
                @{quote.handle}
              </span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function ProPanel() {
  return (
    <section className="pt-28">
      <div className="grid gap-8 overflow-hidden rounded-2xl bg-[#0a0a0a] p-8 md:grid-cols-2 md:items-center md:p-12 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]">
        <div>
          <p className="mb-3 font-mono text-[#FF2D55] text-[12px]">
            kokonutui.pro
          </p>
          <h2 className="font-semibold text-[32px] text-white leading-tight tracking-[-0.03em]">
            Ship whole pages, not just parts.
          </h2>
          <p className="mt-3 max-w-[420px] text-[15px] text-white/60 leading-relaxed">
            Kokonut UI Pro adds premium components and complete templates that
            work with Claude Code, Cursor and more.
          </p>
        </div>
        <ul className="flex flex-col gap-3 text-[14px] text-white/75 md:items-end">
          {[
            "Premium components",
            "Complete website templates",
            "Works with Claude Code and Cursor",
          ].map((item) => (
            <li className="inline-flex items-center gap-2" key={item}>
              <CheckIcon aria-hidden className="size-4 text-[#FF2D55]" />
              {item}
            </li>
          ))}
          <li className="mt-3">
            <a
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-lg bg-white px-5 font-medium text-[14px] text-black hover:bg-white/90",
                PRESS
              )}
              href={PRO_URL}
              rel="noreferrer"
              target="_blank"
            >
              Explore Pro
              <ArrowUpRightIcon aria-hidden className="size-4" />
            </a>
          </li>
        </ul>
      </div>
    </section>
  );
}
