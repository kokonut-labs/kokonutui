"use client";

import {
  BookOpenIcon,
  BotIcon,
  BracesIcon,
  FileTextIcon,
  type LucideIcon,
  MessageSquareTextIcon,
  PlugIcon,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import Link from "next/link";
import {
  memo,
  type ReactNode,
  type SVGProps,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ActionSearchBar from "@/components/kokonutui/action-search-bar";
import AI_Voice from "@/components/kokonutui/ai-voice";
import TeamSelector from "@/components/kokonutui/team-selector";
import { cn } from "@/lib/utils";
import { CommandChip, Reveal } from "./client";
import {
  installCommand,
  MCP_CLIENTS,
  type McpClient,
  mcpCommand,
  REGISTRY_ENTRY,
} from "./data";
import { ClaudeMark, CursorMark, OpenAIMark, VSCodeMark } from "./logos";
import { FOCUS, PRESS } from "./styles";

export function Agents() {
  return (
    <section className="scroll-mt-28 pt-28 md:pt-36" id="agents">
      <Reveal>
        <div className="relative isolate overflow-hidden rounded-3xl border border-black/[0.07] bg-[#fcfdfc] p-5 sm:p-8 lg:p-12 dark:border-white/[0.08] dark:bg-white/[0.015]">
          {/* Two soft lights: the registry's green, and a warm one from the
              agent's side. Color for the section, kept behind the content. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-56 -left-40 -z-10 size-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(59,180,75,0.16),transparent)] dark:bg-[radial-gradient(closest-side,rgba(59,180,75,0.13),transparent)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-48 -bottom-64 -z-10 size-[720px] rounded-full bg-[radial-gradient(closest-side,rgba(217,119,87,0.12),transparent)] dark:bg-[radial-gradient(closest-side,rgba(217,119,87,0.1),transparent)]"
          />

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-12">
            <div className="min-w-0">
              <p className="mb-5 inline-flex h-7 items-center gap-1.5 rounded-full bg-[#3BB44B]/10 pr-3 pl-2 font-medium text-[#1f7a2c] text-[12px] dark:bg-[#3BB44B]/15 dark:text-[#6bd679]">
                <BotIcon aria-hidden className="size-3.5" />
                For agents
              </p>
              <h2 className="text-balance font-semibold text-[32px] text-black leading-[1.1] tracking-[-0.035em] sm:text-[40px] dark:text-white">
                Just ask your agent.
              </h2>
              <p className="mt-4 max-w-[460px] text-pretty text-[16px] text-black/60 leading-relaxed dark:text-white/60">
                KokonutUI is a shadcn registry. Any agent with the shadcn MCP
                server can find a component and install it, with its
                dependencies, as code you own.
              </p>

              <ol className="mt-9 flex flex-col">
                <Step icon={BracesIcon} title="Add the registry">
                  <p className="mb-2.5 text-[14px] text-black/55 dark:text-white/55">
                    One line in components.json, under{" "}
                    <code className="font-mono text-[13px] text-black/75 dark:text-white/75">
                      registries
                    </code>
                    .
                  </p>
                  <CommandChip
                    className="text-[12px]"
                    command={REGISTRY_ENTRY}
                    label="the registry entry for components.json"
                    prefix={null}
                  />
                </Step>
                <Step icon={PlugIcon} title="Connect your editor">
                  <McpSetup />
                </Step>
                <Step
                  icon={MessageSquareTextIcon}
                  last
                  title="Ask in plain words"
                >
                  <p className="inline-block rounded-2xl rounded-tl-md bg-black/[0.045] px-4 py-2.5 text-[14px] text-black/80 dark:bg-white/[0.07] dark:text-white/85">
                    Add @kokonutui/particle-button to my project
                  </p>
                </Step>
              </ol>

              <nav
                aria-label="Agent resources"
                className="mt-9 flex flex-wrap items-center gap-2"
              >
                <ResourceLink href="/docs/mcp" icon={BookOpenIcon}>
                  MCP guide
                </ResourceLink>
                <ResourceLink href="/llms.txt" icon={FileTextIcon} mono>
                  llms.txt
                </ResourceLink>
                <ResourceLink href="/r/registry.json" icon={BracesIcon} mono>
                  registry.json
                </ResourceLink>
              </nav>
            </div>
            <div className="min-w-0">
              <Demo />
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/** A setup step: an icon on a rail, so the three read as one path. */
function Step({
  icon: Icon,
  title,
  last,
  children,
}: {
  icon: LucideIcon;
  title: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <li className={cn("relative flex gap-4", !last && "pb-8")}>
      {last ? null : (
        <span
          aria-hidden
          className="absolute top-11 bottom-2 left-[17.5px] w-px bg-gradient-to-b from-[#3BB44B]/45 to-black/[0.08] dark:to-white/[0.1]"
        />
      )}
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#2a9d3c] shadow-[0_0_0_1px_rgba(59,180,75,0.28),0_2px_6px_-2px_rgba(59,180,75,0.25)] dark:bg-[#0c160d] dark:text-[#6bd679] dark:shadow-[0_0_0_1px_rgba(59,180,75,0.35)]">
        <Icon aria-hidden className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="flex h-9 items-center font-medium text-[15px] text-black dark:text-white">
          {title}
        </h3>
        <div className="mt-1">{children}</div>
      </div>
    </li>
  );
}

function ResourceLink({
  href,
  icon: Icon,
  mono,
  children,
}: {
  href: string;
  icon: LucideIcon;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/70 px-3 text-[13px] text-black/70 hover:border-black/15 hover:text-black dark:border-white/[0.1] dark:bg-white/[0.03] dark:text-white/70 dark:hover:border-white/20 dark:hover:text-white",
        mono && "font-mono text-[12px]",
        PRESS,
        FOCUS
      )}
      href={href}
    >
      <Icon aria-hidden className="size-3.5 text-black/45 dark:text-white/45" />
      {children}
    </Link>
  );
}

// Each editor's mark takes its own color once picked.
const CLIENT_MARKS: Record<
  McpClient,
  { Mark: (props: SVGProps<SVGSVGElement>) => ReactNode; color: string }
> = {
  claude: { Mark: ClaudeMark, color: "text-[#D97757]" },
  cursor: { Mark: CursorMark, color: "text-black dark:text-white" },
  vscode: { Mark: VSCodeMark, color: "text-[#0078D4] dark:text-[#3EA2FF]" },
  codex: { Mark: OpenAIMark, color: "text-black dark:text-white" },
};

/** Editor picker and the matching `mcp init` command. */
function McpSetup() {
  const [client, setClient] = useState<McpClient>("claude");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);
  const active = MCP_CLIENTS.findIndex((c) => c.id === client);

  const placeHighlight = useCallback(() => {
    const el = tabRefs.current[active];
    const highlight = highlightRef.current;
    if (el && highlight) {
      highlight.style.width = `${el.offsetWidth}px`;
      highlight.style.transform = `translateX(${el.offsetLeft}px)`;
    }
  }, [active]);

  useLayoutEffect(() => {
    placeHighlight();
  }, [placeHighlight]);

  useEffect(() => {
    // Fonts can load after the first measure; re-place once they have.
    document.fonts?.ready.then(placeHighlight);
    window.addEventListener("resize", placeHighlight);
    return () => window.removeEventListener("resize", placeHighlight);
  }, [placeHighlight]);

  useEffect(() => {
    // Don't animate the highlight into its first position.
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <fieldset className="relative m-0 flex w-full min-w-0 rounded-lg border-0 bg-black/[0.045] p-1 sm:w-fit dark:bg-white/[0.06]">
        <legend className="sr-only">Your editor</legend>
        <span
          aria-hidden
          className={cn(
            "absolute top-1 left-0 h-8 rounded-md bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] dark:bg-white/[0.12] dark:shadow-none",
            ready &&
              "transition-[transform,width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
          )}
          ref={highlightRef}
        />
        {MCP_CLIENTS.map((c, i) => {
          const { Mark, color } = CLIENT_MARKS[c.id];
          const selected = c.id === client;
          return (
            <button
              aria-pressed={selected}
              className={cn(
                "relative inline-flex h-8 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 font-medium text-[13px] transition-[color,scale] duration-150 ease-out active:scale-[0.97] sm:flex-none",
                selected
                  ? "text-black dark:text-white"
                  : "text-black/55 hover:text-black/80 dark:text-white/55 dark:hover:text-white/80",
                FOCUS
              )}
              key={c.id}
              onClick={() => setClient(c.id)}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
            >
              <Mark
                className={cn(
                  "size-3.5 shrink-0 transition-colors duration-150",
                  selected && color
                )}
              />
              {/* Marks alone where four labels don't fit (phones, and the
                  two-column layout before it gets wide); screen readers
                  always get the label. */}
              <span className="max-sm:sr-only lg:max-xl:sr-only">
                {c.label}
              </span>
            </button>
          );
        })}
      </fieldset>
      {/* Clients get compared back and forth, so the command swaps instantly. */}
      <CommandChip className="text-[12px]" command={mcpCommand(client)} />
    </div>
  );
}

interface Scenario {
  name: string;
  prompt: string;
  files: string[];
  hint: string;
  render: () => ReactNode;
}

// File lists match each component's registry entry: the shadcn primitives it
// depends on, then its own files.
const SCENARIOS: Scenario[] = [
  {
    name: "team-selector",
    prompt: "Let people pick their team size on the signup page",
    files: ["components/kokonutui/team-selector.tsx"],
    hint: "Use − and + to change it",
    render: () => <TeamSelector />,
  },
  {
    name: "action-search-bar",
    prompt: "Add a command search to the dashboard header",
    files: [
      "components/ui/input.tsx",
      "components/kokonutui/action-search-bar.tsx",
      "hooks/use-debounce.ts",
    ],
    hint: "Click into it and type",
    render: () => (
      <div className="w-full max-w-[380px] self-start">
        <ActionSearchBar />
      </div>
    ),
  },
  {
    name: "ai-voice",
    prompt: "Add a voice input button to the assistant",
    files: ["components/kokonutui/ai-voice.tsx"],
    hint: "Click the mic",
    render: () => <AI_Voice />,
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

  push("agent", `I'll add ${s.name} from the @kokonutui registry.`, 420);
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

  return { lines, installedAt, total: t + HOLD_MS };
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

/**
 * A scripted agent session: the prompt types out, the shadcn CLI runs, and the
 * real component appears underneath, ready to use.
 */
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

  // Pause reasons, each an edge case people never notice: the demo holds
  // while you play with an installed component, while the tab is hidden, and
  // while the demo is scrolled out of view. Touch has no hover and iOS doesn't
  // focus tapped buttons, so a tap inside counts until the next tap outside.
  const [pointerInside, setPointerInside] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const [touched, setTouched] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const playing = (pointerInside || focusInside || touched) && snap.installed;
  const paused = playing || hidden || offscreen;

  const rootRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLElement>(null);
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
    if (!touched) {
      return;
    }
    const onPointerDown = (e: PointerEvent) => {
      if (!previewRef.current?.contains(e.target as Node)) {
        setTouched(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [touched]);

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
      <div className="flex h-10 items-center gap-3 border-white/[0.08] border-b px-4">
        <span aria-hidden className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-white/[0.14]" />
          <span className="size-2.5 rounded-full bg-white/[0.14]" />
          <span className="size-2.5 rounded-full bg-white/[0.14]" />
        </span>
        <span className="font-mono text-[12px] text-white/55">~/my-app</span>
        <span className="ml-auto inline-flex items-center gap-2 text-[12px] text-white/60">
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-[#3BB44B] shadow-[0_0_0_3px_rgba(59,180,75,0.18),0_0_10px_rgba(59,180,75,0.7)]"
          />
          <span>
            <span className="max-sm:hidden">shadcn </span>MCP connected
          </span>
        </span>
      </div>
      {/* Tabs double as the timeline: the active one fills as it plays. */}
      <fieldset className="m-0 flex min-w-0 border-0 border-white/[0.08] border-b p-0">
        <legend className="sr-only">Demo scenarios</legend>
        {SCENARIOS.map((s, i) => (
          <button
            aria-pressed={i === index}
            className={cn(
              "relative flex h-10 min-w-0 flex-1 items-center justify-center px-3 font-mono text-[12px] outline-none transition-[color,background-color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-inset active:bg-white/[0.08] sm:flex-none sm:justify-start sm:px-4",
              i === index
                ? "bg-white/[0.04] text-white"
                : "text-white/55 hover:text-white/75"
            )}
            key={s.name}
            onClick={() => go(i)}
            type="button"
          >
            <span className="truncate">{s.name}.tsx</span>
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-px origin-left bg-[#3BB44B] motion-reduce:hidden"
              ref={(el) => {
                progressRefs.current[i] = el;
              }}
              // Inline, not `scale-x-0`: Tailwind's class sets the `scale`
              // property, which would multiply the transform written below.
              style={{ transform: "scaleX(0)" }}
            />
          </button>
        ))}
      </fieldset>

      <div
        className="h-[284px] overflow-hidden px-5 py-4 font-mono text-[12.5px] leading-[1.75] sm:h-[248px] sm:text-[13px]"
        ref={transcriptRef}
      >
        <p className="text-white">
          <span className="mr-2 text-[#3BB44B]">›</span>
          {scenario.prompt.slice(0, snap.chars)}
          {typing ? (
            <span className="home-caret ml-px inline-block h-[1.1em] w-[7px] translate-y-[3px] bg-white/80" />
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
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") {
            setTouched(true);
          }
        }}
        onPointerEnter={() => setPointerInside(true)}
        onPointerLeave={() => setPointerInside(false)}
        ref={previewRef}
      >
        <div className="flex h-9 items-center justify-between border-black/[0.06] border-b px-4 text-[12px] dark:border-white/[0.06]">
          <span className="inline-flex items-center gap-2 text-black/55 dark:text-white/55">
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full transition-colors duration-200",
                snap.installed
                  ? "bg-[#2CD242] dark:bg-[#3BB44B]"
                  : "bg-black/15 dark:bg-white/20"
              )}
            />
            Preview
          </span>
          <span className="text-black/55 dark:text-white/55">
            {previewStatus(snap.installed, playing, scenario.hint)}
          </span>
        </div>
        <div className="flex h-[320px] items-center justify-center overflow-hidden p-6">
          {snap.installed ? (
            <Preview key={scenario.name} scenario={scenario} />
          ) : (
            <span className="font-mono text-[12px] text-black/45 dark:text-white/45">
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
  return (
    <div className="home-materialize flex size-full items-center justify-center">
      {scenario.render()}
    </div>
  );
});

function TranscriptLine({ line }: { line: Line }) {
  if (line.kind === "agent") {
    return (
      <p className="home-line text-white/85">
        <span className="mr-2 text-[#3BB44B]">●</span>
        {line.text}
      </p>
    );
  }
  if (line.kind === "cmd") {
    return (
      <p className="home-line truncate pl-4 text-white/55">
        <span className="mr-2 text-white/30">$</span>
        {line.text}
      </p>
    );
  }
  if (line.kind === "ok") {
    return (
      <p className="home-line pl-4 text-white/70">
        <span className="mr-2 text-[#3BB44B]">✔</span>
        {line.text}
      </p>
    );
  }
  return <p className="home-line truncate pl-10 text-white/50">{line.text}</p>;
}
