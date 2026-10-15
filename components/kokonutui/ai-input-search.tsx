"use client";

/**
 * @author: @kokonutui
 * @description: AI Input Search
 * @version: 3.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ArrowUp, ChevronDown, Search, Telescope } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_OUT_CSS = "ease-[cubic-bezier(0.23,1,0.32,1)]";
const WWW = /^www\./;

export type SearchMode = "quick" | "research";

export interface SearchSource {
  /** e.g. "developer.mozilla.org" */
  domain: string;
  title: string;
}

export interface AIInputSearchProps {
  placeholder?: string;
  /** Placeholder while Research mode is on. */
  researchPlaceholder?: string;
  defaultMode?: SearchMode;
  /**
   * Runs the search. Call `onSource` for each source as it is read, and
   * resolve when the answer is ready; `signal` aborts on Stop. Without it,
   * the component plays a pretend search so the demo feels alive.
   */
  onSearch?: (
    query: string,
    options: {
      mode: SearchMode;
      signal: AbortSignal;
      onSource: (source: SearchSource) => void;
    }
  ) => Promise<void> | void;
  className?: string;
}

type Phase = "idle" | "searching" | "reading" | "writing" | "done" | "stopped";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "",
  searching: "Searching the web",
  reading: "Reading sources",
  writing: "Writing the answer",
  done: "",
  stopped: "Stopped",
};

const MODES: { id: SearchMode; label: string; icon: typeof Search }[] = [
  { id: "quick", label: "Quick", icon: Search },
  { id: "research", label: "Research", icon: Telescope },
];

const DEMO_SOURCES: SearchSource[] = [
  { domain: "developer.mozilla.org", title: "429 Too Many Requests" },
  { domain: "cloudflare.com", title: "What is rate limiting?" },
  {
    domain: "github.com",
    title: "upstash/ratelimit: serverless rate limiting",
  },
  { domain: "vercel.com", title: "Rate limiting at the edge" },
  { domain: "stripe.com", title: "Scaling your API with rate limiters" },
  { domain: "redis.io", title: "Rate limiting with sorted sets" },
  { domain: "ietf.org", title: "RateLimit header fields for HTTP" },
  { domain: "stackoverflow.com", title: "Token bucket vs sliding window" },
  { domain: "aws.amazon.com", title: "Throttling requests in API Gateway" },
  { domain: "nginx.org", title: "Module ngx_http_limit_req_module" },
  { domain: "arxiv.org", title: "Fair queuing for multi-tenant APIs" },
  { domain: "martinfowler.com", title: "Circuit breaker" },
];

const DEMO_COUNT: Record<SearchMode, number> = { quick: 5, research: 12 };
const DEMO_STEP_MS: Record<SearchMode, number> = { quick: 260, research: 200 };
const STACK_MAX = 5;

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new DOMException("Stopped", "AbortError"));
    });
  });

async function demoSearch(
  mode: SearchMode,
  signal: AbortSignal,
  onSource: (source: SearchSource) => void
) {
  await wait(500, signal);
  for (const source of DEMO_SOURCES.slice(0, DEMO_COUNT[mode])) {
    await wait(DEMO_STEP_MS[mode], signal);
    onSource(source);
  }
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** A neutral letter tile per site, so the trace needs no favicon service. */
function Monogram({ domain, ring }: { domain: string; ring?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full bg-white font-medium text-[10px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200",
        ring
          ? "ring-2 ring-zinc-100 dark:ring-zinc-800"
          : "ring-1 ring-black/10 dark:ring-white/10"
      )}
    >
      {domain.replace(WWW, "").charAt(0).toUpperCase()}
    </span>
  );
}

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: SearchMode;
  onChange: (mode: SearchMode) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = MODES.findIndex((m) => m.id === mode);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const next = (index + 1) % MODES.length;
    refs.current[next]?.focus();
    onChange(MODES[next].id);
  };

  return (
    <div
      aria-label="Search mode"
      className="relative grid grid-cols-2 rounded-full bg-black/[0.04] p-0.5 dark:bg-white/[0.06]"
      role="radiogroup"
    >
      {/* One thumb that slides, rather than two backgrounds that swap. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-black/5 dark:bg-zinc-700 dark:ring-white/10",
          "transition-[translate] duration-200 motion-reduce:transition-none",
          EASE_OUT_CSS,
          index === 1 ? "translate-x-full" : "translate-x-0"
        )}
      />
      {MODES.map(({ id, label, icon: Icon }, i) => {
        const selected = id === mode;
        return (
          // biome-ignore lint/a11y/useSemanticElements: a pill switch with a sliding thumb doesn't fit a native radio input
          <button
            aria-checked={selected}
            className={cn(
              "relative flex h-7 items-center justify-center gap-1.5 rounded-full px-3 text-xs outline-hidden",
              "transition-colors duration-150",
              EASE_OUT_CSS,
              "focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/30",
              selected
                ? "text-black dark:text-white"
                : "text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
            )}
            key={id}
            onClick={() => onChange(id)}
            onKeyDown={onKeyDown}
            ref={(node) => {
              refs.current[i] = node;
            }}
            role="radio"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            <Icon aria-hidden="true" className="size-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function SourceStack({ sources }: { sources: SearchSource[] }) {
  const shown = sources.slice(-STACK_MAX);
  if (shown.length === 0) {
    return (
      <span className="size-5 shrink-0 rounded-full border border-black/15 border-dashed dark:border-white/20" />
    );
  }
  // Sites stack up as they are read; the newest lands at the end.
  return (
    <span className="flex shrink-0 items-center">
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map((source, i) => (
          <motion.span
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            className={cn(i > 0 && "-ml-1")}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            initial={{ opacity: 0, x: -6, filter: "blur(2px)" }}
            key={source.domain}
            layout="position"
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <Monogram domain={source.domain} ring />
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}

function SourceList({ id, sources }: { id: string; sources: SearchSource[] }) {
  return (
    <motion.div
      animate={{ height: "auto", opacity: 1 }}
      className="overflow-hidden"
      exit={{ height: 0, opacity: 0 }}
      id={id}
      initial={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: EASE_OUT }}
    >
      <ol className="max-h-56 overflow-y-auto px-1.5 pb-1.5">
        {sources.map((source, i) => (
          <motion.li
            animate={{ opacity: 1, y: 0 }}
            className="flex h-8 items-center gap-2.5 rounded-lg px-1.5 text-xs"
            initial={{ opacity: 0, y: 4 }}
            key={source.domain}
            // A short cascade, capped so a long list doesn't drag.
            transition={{
              duration: 0.18,
              ease: EASE_OUT,
              delay: Math.min(i, 8) * 0.025,
            }}
          >
            <span className="w-4 shrink-0 text-right text-[11px] text-black/30 tabular-nums dark:text-white/30">
              {i + 1}
            </span>
            <Monogram domain={source.domain} />
            <span className="min-w-0 flex-1 truncate text-black/80 dark:text-white/80">
              {source.title}
            </span>
            <span className="hidden shrink-0 text-black/40 sm:block dark:text-white/40">
              {source.domain}
            </span>
          </motion.li>
        ))}
      </ol>
    </motion.div>
  );
}

const traceLabel = (phase: Phase, count: number) => {
  if (phase !== "done" && phase !== "stopped") {
    return PHASE_LABEL[phase];
  }
  const noun = count === 1 ? "source" : "sources";
  return `${phase === "stopped" ? "Stopped after" : "Read"} ${count} ${noun}`;
};

/** Under the box: what the search is doing now, then what it read. */
function Trace({
  phase,
  sources,
  elapsed,
  expanded,
  onToggle,
  listId,
}: {
  phase: Phase;
  sources: SearchSource[];
  elapsed: number;
  expanded: boolean;
  onToggle: () => void;
  listId: string;
}) {
  const finished = phase === "done" || phase === "stopped";
  const canOpen = finished && sources.length > 0;
  const label = traceLabel(phase, sources.length);

  return (
    <div>
      <button
        aria-controls={listId}
        aria-expanded={expanded}
        className={cn(
          "flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs outline-hidden",
          "transition-colors duration-150",
          EASE_OUT_CSS,
          "focus-visible:ring-2 focus-visible:ring-black/15 dark:focus-visible:ring-white/20",
          canOpen
            ? "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
            : "cursor-default"
        )}
        disabled={!canOpen}
        onClick={onToggle}
        type="button"
      >
        <SourceStack sources={sources} />
        <span className="relative min-w-0 flex-1">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ opacity: 1, filter: "blur(0px)" }}
              className={cn(
                "block truncate",
                finished
                  ? "text-black/70 dark:text-white/70"
                  : "text-black/50 dark:text-white/50"
              )}
              exit={{ opacity: 0, filter: "blur(2px)" }}
              initial={{ opacity: 0, filter: "blur(2px)" }}
              key={label}
              transition={{ duration: 0.15, ease: EASE_OUT }}
            >
              {label}
              {phase === "reading" && (
                <span className="text-black/35 tabular-nums dark:text-white/35">
                  {" "}
                  · {sources.length}
                </span>
              )}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="shrink-0 text-black/35 tabular-nums dark:text-white/35">
          {seconds(elapsed)}
        </span>
        {canOpen && (
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-3.5 shrink-0 text-black/40 transition-transform duration-200 dark:text-white/40",
              EASE_OUT_CSS,
              expanded && "rotate-180"
            )}
          />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && <SourceList id={listId} sources={sources} />}
      </AnimatePresence>
    </div>
  );
}

function SendStopButton({
  running,
  canSubmit,
  onSubmit,
  onStop,
}: {
  running: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onStop: () => void;
}) {
  // Same button, two faces: send crossfades into stop.
  const face = cn(
    "absolute inset-0 flex items-center justify-center transition-[opacity,filter] duration-200",
    EASE_OUT_CSS
  );
  return (
    <button
      aria-label={running ? "Stop search" : "Search"}
      className={cn(
        "relative size-8 shrink-0 rounded-full",
        "transition-[background-color,color] duration-150",
        EASE_OUT_CSS,
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/30",
        running || canSubmit
          ? "bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/85"
          : "bg-black/5 text-black/30 dark:bg-white/10 dark:text-white/30"
      )}
      disabled={!(running || canSubmit)}
      onClick={running ? onStop : onSubmit}
      type="button"
    >
      <span
        aria-hidden="true"
        className={cn(face, running ? "opacity-0 blur-[2px]" : "opacity-100")}
      >
        <ArrowUp className="size-4" strokeWidth={2.25} />
      </span>
      <span
        aria-hidden="true"
        className={cn(face, running ? "opacity-100" : "opacity-0 blur-[2px]")}
      >
        <span className="size-2.5 rounded-[2px] bg-current" />
      </span>
    </button>
  );
}

export default function AI_Input_Search({
  placeholder = "Ask anything",
  researchPlaceholder = "Research a topic in depth",
  defaultMode = "quick",
  onSearch,
  className,
}: AIInputSearchProps) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<SearchMode>(defaultMode);
  const [phase, setPhase] = useState<Phase>("idle");
  const [sources, setSources] = useState<SearchSource[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listId = useId();
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 52,
    maxHeight: 200,
  });

  const running =
    phase === "searching" || phase === "reading" || phase === "writing";

  useEffect(() => () => abortRef.current?.abort(), []);

  // The clock ticks only while a search runs, from zero each time.
  useEffect(() => {
    if (!running) {
      return;
    }
    const start = performance.now();
    const timer = setInterval(() => setElapsed(performance.now() - start), 100);
    return () => clearInterval(timer);
  }, [running]);

  const submit = async () => {
    const query = value.trim();
    if (!query || running) {
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setValue("");
    adjustHeight(true);
    setSources([]);
    setElapsed(0);
    setExpanded(false);
    setPhase("searching");
    const onSource = (source: SearchSource) => {
      if (controller.signal.aborted) {
        return;
      }
      setPhase("reading");
      setSources((current) => [
        ...current.filter((s) => s.domain !== source.domain),
        source,
      ]);
    };
    try {
      await (onSearch
        ? onSearch(query, { mode, signal: controller.signal, onSource })
        : demoSearch(mode, controller.signal, onSource));
      if (!onSearch) {
        setPhase("writing");
        await wait(700, controller.signal);
      }
      if (!controller.signal.aborted) {
        setPhase("done");
      }
    } catch {
      // Stopped: `stop` has already set the phase.
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("stopped");
    textareaRef.current?.focus();
  };

  // Mouse convenience: clicking the box around the field focuses it. Clicks
  // on the controls keep their own behaviour.
  const handleContainerClick = (target: EventTarget) => {
    if (target instanceof Element && target.closest("button")) {
      return;
    }
    textareaRef.current?.focus();
  };

  const canSubmit = value.trim().length > 0 && !running;

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("w-full py-4", className)}>
        <div className="mx-auto w-full max-w-xl rounded-[22px] bg-zinc-100 p-1 dark:bg-zinc-800">
          {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents lint/a11y/noNoninteractiveElementInteractions: pointer-only shortcut; the textarea and buttons inside are keyboard reachable */}
          <div
            className={cn(
              "relative flex w-full cursor-text flex-col rounded-[18px] bg-white text-left ring-1 ring-black/[0.06] dark:bg-zinc-900 dark:ring-white/10",
              "shadow-[0_1px_2px_rgb(0_0_0/0.04),0_6px_20px_-10px_rgb(0_0_0/0.12)]",
              "transition-shadow duration-150 has-[textarea:focus-visible]:ring-black/20 dark:has-[textarea:focus-visible]:ring-white/25"
            )}
            onClick={(e) => handleContainerClick(e.target)}
          >
            <Textarea
              aria-label="Search"
              className="min-h-[52px] w-full resize-none rounded-none border-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] text-black leading-relaxed placeholder:text-black/35 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent dark:text-white dark:placeholder:text-white/35"
              onChange={(e) => {
                setValue(e.target.value);
                adjustHeight();
              }}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) {
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                } else if (e.key === "Escape" && running) {
                  e.preventDefault();
                  stop();
                }
              }}
              placeholder={
                mode === "research" ? researchPlaceholder : placeholder
              }
              ref={textareaRef}
              value={value}
            />

            <div className="flex items-center gap-2 px-2.5 pt-1 pb-2.5">
              <ModeSwitch mode={mode} onChange={setMode} />
              <div className="flex-1" />
              <span className="hidden text-[11px] text-black/35 tabular-nums sm:block dark:text-white/35">
                {mode === "research" ? "~12 sources" : "~5 sources"}
              </span>
              <SendStopButton
                canSubmit={canSubmit}
                onStop={stop}
                onSubmit={submit}
                running={running}
              />
            </div>
          </div>

          <output aria-live="polite" className="sr-only">
            {phase === "done" && `Done. Read ${sources.length} sources.`}
            {phase === "stopped" && "Search stopped."}
            {phase === "searching" && "Searching."}
          </output>

          <AnimatePresence initial={false}>
            {phase !== "idle" && (
              <motion.div
                animate={{ height: "auto", opacity: 1 }}
                className="overflow-hidden"
                exit={{ height: 0, opacity: 0 }}
                initial={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                <div className="pt-1">
                  <Trace
                    elapsed={elapsed}
                    expanded={expanded}
                    listId={listId}
                    onToggle={() => setExpanded((open) => !open)}
                    phase={phase}
                    sources={sources}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
