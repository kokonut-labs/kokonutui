"use client";

/**
 * @author: @kokonutui
 * @description: AI Tool Approval
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  ChevronRight,
  FilePen,
  Globe,
  Send,
  SquareTerminal,
  Wrench,
} from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

/**
 * The same states the AI SDK gives a tool part, so a part can be passed
 * straight through: `approval-requested` asks, `approval-responded` runs,
 * and the `output-*` states are the result.
 */
export type ToolCallState =
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-denied"
  | "output-error";

export interface ToolCall {
  id: string;
  /** The tool's name, such as `bash` or `write_file`. Picks the icon. */
  tool: string;
  /** What the agent wants to do, in plain words: "Run a command". */
  title: string;
  /** A command or text shows as code; an object shows as fields. */
  input: string | Record<string, string | number | boolean>;
  /** Why the agent wants this, shown under the input. */
  reason?: string;
  /** Destructive calls need a press and hold, and are never auto-approved. */
  destructive?: boolean;
  state: ToolCallState;
  /** Output lines, streamed while running and kept once done. */
  output?: string[];
  icon?: ReactNode;
}

interface AIToolApprovalProps {
  /**
   * The conversation's tool calls, oldest first. When omitted, a demo run
   * plays with three calls to approve.
   */
  calls?: ToolCall[];
  /**
   * Called when the user allows or denies a call. `always` is true when they
   * chose to stop asking for this tool.
   */
  onRespond?: (id: string, approved: boolean, always: boolean) => void;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const HOLD_MS = 900;

const DEMO_CALLS: Omit<ToolCall, "state">[] = [
  {
    id: "test",
    tool: "bash",
    title: "Run a command",
    input: "bun test --filter checkout",
    reason: "Check the checkout tests before changing the form.",
    output: [
      "bun test v1.3.0",
      "checkout/cart.test.ts  ✓ 6 passed",
      "checkout/form.test.ts  ✗ 1 failed",
      "7 tests, 1 failure (412ms)",
    ],
  },
  {
    id: "edit",
    tool: "write_file",
    title: "Edit a file",
    input: {
      path: "app/checkout/form.tsx",
      changes: "+4 −2",
    },
    reason: "Validate the postcode before submitting.",
    output: ["Wrote app/checkout/form.tsx (+4 −2)"],
  },
  {
    id: "clean",
    tool: "bash",
    title: "Run a command",
    input: "rm -rf .next && bun run build",
    reason: "Clear the stale build cache, then rebuild.",
    destructive: true,
    output: [
      "removed .next",
      "▲ Next.js 16.2.10",
      "Creating an optimized production build",
      "✓ Compiled in 8.4s",
    ],
  },
];

const OUTPUT_TICK_MS = 380;

const TERMINAL_TOOL = /bash|shell|terminal|exec|command/;
const FILE_TOOL = /write|edit|file|patch/;
const WEB_TOOL = /fetch|web|browse|http|search/;
const SEND_TOOL = /mail|send|message|post/;

/**
 * Plays DEMO_CALLS: each waits for a decision, then streams its output. Tools
 * the user always allows skip the question, unless the call is destructive.
 */
function useDemoCalls(enabled: boolean) {
  const [calls, setCalls] = useState<ToolCall[]>(() =>
    DEMO_CALLS.slice(0, 1).map((call) => ({
      ...call,
      state: "approval-requested",
      output: [],
    }))
  );
  const alwaysRef = useRef(new Set<string>());
  // The short pause after a denial, so Replay or unmount can cancel it.
  const denyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearDenyTimer = useCallback(() => {
    if (denyTimer.current) {
      clearTimeout(denyTimer.current);
      denyTimer.current = null;
    }
  }, []);
  useEffect(() => clearDenyTimer, [clearDenyTimer]);

  const update = useCallback((id: string, patch: Partial<ToolCall>) => {
    setCalls((list) =>
      list.map((call) => (call.id === id ? { ...call, ...patch } : call))
    );
  }, []);

  const next = useCallback(() => {
    setCalls((list) => {
      const source = DEMO_CALLS[list.length];
      if (!source) {
        return list;
      }
      const auto = alwaysRef.current.has(source.tool) && !source.destructive;
      return [
        ...list,
        {
          ...source,
          state: auto ? "approval-responded" : "approval-requested",
          output: [],
        },
      ];
    });
  }, []);

  // Streams the output of whichever call is running, then moves on.
  const running = calls.find((call) => call.state === "approval-responded");
  useEffect(() => {
    if (!(enabled && running)) {
      return;
    }
    const lines = DEMO_CALLS.find((call) => call.id === running.id)?.output;
    const shown = running.output?.length ?? 0;
    const id = setTimeout(() => {
      if (lines && shown < lines.length) {
        update(running.id, { output: lines.slice(0, shown + 1) });
        return;
      }
      update(running.id, { state: "output-available" });
      next();
    }, OUTPUT_TICK_MS);
    return () => clearTimeout(id);
  }, [enabled, running, update, next]);

  const respond = useCallback(
    (id: string, approved: boolean, always: boolean) => {
      const call = DEMO_CALLS.find((item) => item.id === id);
      if (always && call) {
        alwaysRef.current.add(call.tool);
      }
      update(id, { state: approved ? "approval-responded" : "output-denied" });
      if (!approved) {
        clearDenyTimer();
        denyTimer.current = setTimeout(next, 240);
      }
    },
    [update, next, clearDenyTimer]
  );

  const reset = useCallback(() => {
    clearDenyTimer();
    alwaysRef.current.clear();
    setCalls(
      DEMO_CALLS.slice(0, 1).map((call) => ({
        ...call,
        state: "approval-requested",
        output: [],
      }))
    );
  }, [clearDenyTimer]);

  return { calls, respond, reset };
}

function ToolIcon({ call }: { call: ToolCall }) {
  if (call.icon) {
    return <>{call.icon}</>;
  }
  const name = call.tool.toLowerCase();
  const className = "size-4";
  if (TERMINAL_TOOL.test(name)) {
    return <SquareTerminal aria-hidden="true" className={className} />;
  }
  if (FILE_TOOL.test(name)) {
    return <FilePen aria-hidden="true" className={className} />;
  }
  if (WEB_TOOL.test(name)) {
    return <Globe aria-hidden="true" className={className} />;
  }
  if (SEND_TOOL.test(name)) {
    return <Send aria-hidden="true" className={className} />;
  }
  return <Wrench aria-hidden="true" className={className} />;
}

const inputSummary = (input: ToolCall["input"]) =>
  typeof input === "string" ? input : Object.values(input)[0]?.toString();

function ToolInput({ input }: { input: ToolCall["input"] }) {
  if (typeof input === "string") {
    return (
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-zinc-50 px-3 py-2.5 font-mono text-[13px] text-zinc-900 leading-relaxed ring-1 ring-black/5 dark:bg-white/5 dark:text-zinc-100 dark:ring-white/10">
        <span aria-hidden="true" className="select-none text-zinc-400">
          ${" "}
        </span>
        {input}
      </pre>
    );
  }
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg bg-zinc-50 px-3 py-2.5 text-[13px] ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10">
      {Object.entries(input).map(([key, value]) => (
        <div className="contents" key={key}>
          <dt className="text-zinc-500 dark:text-zinc-400">{key}</dt>
          <dd className="min-w-0 truncate font-mono text-zinc-900 dark:text-zinc-100">
            {String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Allow for destructive calls. The red fill wipes across while held and
 * runs back quickly when let go early, so a slip never confirms.
 */
function HoldToAllow({ onConfirm }: { onConfirm: () => void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    // A key and a pointer can both start a hold; keep only one timer.
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setHolding(true);
    timer.current = setTimeout(() => {
      setHolding(false);
      onConfirm();
    }, HOLD_MS);
  };
  const stop = () => {
    setHolding(false);
    if (timer.current) {
      clearTimeout(timer.current);
    }
  };
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    []
  );

  const label = "Hold to allow";
  return (
    <button
      aria-label="Allow. Press and hold to confirm"
      className="relative h-8 select-none overflow-hidden rounded-lg bg-red-50 px-3 font-medium text-red-700 text-sm outline-hidden ring-1 ring-red-600/15 focus-visible:ring-2 focus-visible:ring-red-500 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20"
      onBlur={stop}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if ((event.key === " " || event.key === "Enter") && !event.repeat) {
          event.preventDefault();
          start();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") {
          stop();
        }
      }}
      onPointerCancel={stop}
      onPointerDown={(event) => {
        // A right click or a pen's barrel button is not a hold.
        if (event.button === 0) {
          start();
        }
      }}
      onPointerLeave={stop}
      onPointerUp={stop}
      type="button"
    >
      {label}
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center bg-red-600 text-white"
        style={{
          clipPath: holding ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
          transition: holding
            ? `clip-path ${HOLD_MS}ms linear`
            : "clip-path 200ms cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        {label}
      </span>
    </button>
  );
}

function ApprovalCard({
  call,
  onRespond,
}: {
  call: ToolCall;
  onRespond: (approved: boolean, always: boolean) => void;
}) {
  const [always, setAlways] = useState(false);
  const alwaysId = useId();
  const titleId = useId();

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Escape bubbles up from the card's own buttons and checkbox
    <section
      aria-labelledby={titleId}
      className="rounded-xl bg-white p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] outline-hidden ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
      data-call-id={call.id}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onRespond(false, false);
        }
      }}
      // Focus target when the previous card is decided from the keyboard.
      tabIndex={-1}
    >
      <header className="mb-2.5 flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
          <ToolIcon call={call} />
        </span>
        <h3
          className="font-medium text-sm text-zinc-900 dark:text-zinc-100"
          id={titleId}
        >
          {call.title}
        </h3>
        <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
          {call.tool}
        </span>
        {call.destructive && (
          <span className="ml-auto rounded-md bg-red-50 px-1.5 py-0.5 font-medium text-[11px] text-red-600 dark:bg-red-500/10 dark:text-red-400">
            Destructive
          </span>
        )}
      </header>
      <ToolInput input={call.input} />
      {call.reason && (
        <p className="mt-2 text-xs text-zinc-500 leading-relaxed dark:text-zinc-400">
          {call.reason}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {call.destructive ? (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            Asks every time
          </span>
        ) : (
          <label
            className="flex cursor-pointer select-none items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400"
            htmlFor={alwaysId}
          >
            <input
              checked={always}
              className="size-3.5 cursor-pointer accent-zinc-900 dark:accent-zinc-100"
              id={alwaysId}
              onChange={(event) => setAlways(event.target.checked)}
              type="checkbox"
            />
            Don't ask again for <code className="font-mono">{call.tool}</code>
          </label>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            className="h-8 rounded-lg px-3 text-sm text-zinc-600 outline-hidden transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={() => onRespond(false, false)}
            type="button"
          >
            Deny
          </button>
          {call.destructive ? (
            <HoldToAllow onConfirm={() => onRespond(true, false)} />
          ) : (
            <button
              className="h-8 rounded-lg bg-zinc-900 px-3 font-medium text-sm text-white outline-hidden transition-colors duration-150 hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400/60 focus-visible:ring-offset-1 dark:bg-white dark:text-zinc-900 dark:focus-visible:ring-offset-zinc-900 dark:hover:bg-zinc-200"
              onClick={() => onRespond(true, always)}
              type="button"
            >
              Allow
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function StatusIcon({ state }: { state: ToolCallState }) {
  if (state === "approval-responded") {
    return (
      <svg
        aria-hidden="true"
        className="size-3.5 motion-safe:animate-spin"
        fill="none"
        style={{ animationDuration: "0.8s" }}
        viewBox="0 0 16 16"
      >
        <circle
          className="stroke-zinc-200 dark:stroke-zinc-700"
          cx="8"
          cy="8"
          r="6.25"
          strokeWidth="1.5"
        />
        <path
          className="stroke-zinc-700 dark:stroke-zinc-200"
          d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
      </svg>
    );
  }
  if (state === "output-available") {
    return (
      <svg
        aria-hidden="true"
        className="size-3.5 text-zinc-700 dark:text-zinc-200"
        fill="none"
        viewBox="0 0 16 16"
      >
        <motion.path
          animate={{ pathLength: 1 }}
          d="M3.5 8.5 6.5 11.5 12.5 4.5"
          initial={{ pathLength: 0 }}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.75"
          transition={{ duration: 0.3, ease: EASE_OUT }}
        />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "size-3.5",
        state === "output-error" ? "text-red-500" : "text-zinc-400"
      )}
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="M4.5 4.5l7 7m0-7-7 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

/** What the trace line says, as [while running, once done]. */
function verbsFor(tool: string): [string, string] {
  const name = tool.toLowerCase();
  if (TERMINAL_TOOL.test(name)) {
    return ["Running", "Ran"];
  }
  if (FILE_TOOL.test(name)) {
    return ["Editing", "Edited"];
  }
  if (WEB_TOOL.test(name)) {
    return ["Fetching", "Fetched"];
  }
  if (SEND_TOOL.test(name)) {
    return ["Sending", "Sent"];
  }
  return ["Using", "Used"];
}

function verbOf(call: ToolCall) {
  const [running, done] = verbsFor(call.tool);
  switch (call.state) {
    case "approval-responded":
      return running;
    case "output-denied":
      return "Denied";
    case "output-error":
      return "Failed";
    default:
      return done;
  }
}

/**
 * A decided call, folded to one line. Running calls show their output as it
 * streams; finished ones open it on click.
 */
function TraceLine({ call }: { call: ToolCall }) {
  const state = call.state as Exclude<ToolCallState, "approval-requested">;
  const isRunning = state === "approval-responded";
  const hasOutput = Boolean(call.output?.length) && state !== "output-denied";
  const [open, setOpen] = useState(false);
  const outputId = useId();
  const showOutput = hasOutput && (isRunning || open);

  return (
    <div>
      <button
        aria-controls={hasOutput ? outputId : undefined}
        aria-expanded={hasOutput ? showOutput : undefined}
        className="group/line flex w-full items-center gap-2.5 rounded-md py-1.5 text-left text-[13px] leading-5 outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/40 disabled:cursor-default"
        disabled={!hasOutput || isRunning}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="flex size-4 shrink-0 items-center justify-center">
          <StatusIcon state={state} />
        </span>
        <span
          className={cn(
            "shrink-0",
            state === "output-denied"
              ? "text-zinc-400 dark:text-zinc-500"
              : "text-zinc-600 dark:text-zinc-300"
          )}
        >
          {verbOf(call)}
        </span>
        <code
          className={cn(
            "min-w-0 truncate font-mono text-[12.5px]",
            state === "output-denied"
              ? "text-zinc-400 line-through decoration-zinc-300 dark:text-zinc-500 dark:decoration-zinc-600"
              : "text-zinc-900 dark:text-zinc-100"
          )}
        >
          {inputSummary(call.input)}
        </code>
        {hasOutput && !isRunning && (
          <ChevronRight
            aria-hidden="true"
            className={cn(
              "ml-auto size-3.5 shrink-0 text-zinc-400 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/line:text-zinc-600 dark:group-hover/line:text-zinc-300",
              open && "rotate-90"
            )}
          />
        )}
      </button>
      <AnimatePresence initial={false}>
        {showOutput && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            id={outputId}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
          >
            <pre className="mb-1.5 ml-6.5 overflow-x-auto rounded-lg bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-600 leading-5 ring-1 ring-black/5 dark:bg-white/5 dark:text-zinc-400 dark:ring-white/10">
              {call.output?.join("\n")}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AIToolApproval({
  calls: callsProp,
  onRespond,
  className,
}: AIToolApprovalProps) {
  const demo = useDemoCalls(callsProp === undefined);
  const calls = callsProp ?? demo.calls;
  const rootRef = useRef<HTMLDivElement>(null);
  // Set when the user decides from the keyboard (or with focus inside), so
  // the next card takes focus instead of it falling back to the page.
  const refocusRef = useRef(false);
  const keepFocus = () => {
    refocusRef.current = Boolean(
      rootRef.current?.contains(document.activeElement)
    );
  };
  const respond = (id: string, approved: boolean, always: boolean) => {
    keepFocus();
    if (callsProp === undefined) {
      demo.respond(id, approved, always);
    }
    onRespond?.(id, approved, always);
  };

  // Calls already decided when the list mounts (an older turn) sit still;
  // only ones decided from here on unfold into the trace.
  const [mountedIds] = useState(
    () =>
      new Set(
        calls
          .filter((call) => call.state !== "approval-requested")
          .map((call) => call.id)
      )
  );

  const pending = calls.filter((call) => call.state === "approval-requested");
  const decided = calls.filter((call) => call.state !== "approval-requested");
  const current = pending[0];
  const demoFinished =
    callsProp === undefined &&
    calls.length === DEMO_CALLS.length &&
    pending.length === 0 &&
    calls.every((call) => call.state !== "approval-responded");

  const currentId = current?.id;
  useEffect(() => {
    if (!(currentId && refocusRef.current)) {
      return;
    }
    refocusRef.current = false;
    const root = rootRef.current;
    const focused = document.activeElement;
    // Leave focus alone if the user has moved on elsewhere meanwhile.
    if (focused && focused !== document.body && !root?.contains(focused)) {
      return;
    }
    root
      ?.querySelector<HTMLElement>(`[data-call-id="${CSS.escape(currentId)}"]`)
      ?.focus();
  }, [currentId]);

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("w-full max-w-md", className)} ref={rootRef}>
        <div className="rounded-2xl bg-black/5 p-1.5 dark:bg-white/5">
          {decided.length > 0 && (
            <div className="px-2.5 pt-1 pb-1.5">
              {decided.map((call) => (
                <motion.div
                  animate={{ opacity: 1, height: "auto" }}
                  initial={
                    mountedIds.has(call.id) ? false : { opacity: 0, height: 0 }
                  }
                  key={call.id}
                  transition={{ duration: 0.24, ease: EASE_OUT }}
                >
                  <TraceLine call={call} />
                </motion.div>
              ))}
            </div>
          )}
          <AnimatePresence initial={false} mode="popLayout">
            {current ? (
              <motion.div
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -6, filter: "blur(2px)" }}
                initial={{ opacity: 0, y: 8, filter: "blur(2px)" }}
                key={current.id}
                transition={{ duration: 0.22, ease: EASE_OUT }}
              >
                {pending.length > 1 && (
                  <p className="px-2.5 pb-1.5 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                    1 of {pending.length} waiting
                  </p>
                )}
                <ApprovalCard
                  call={current}
                  onRespond={(approved, always) =>
                    respond(current.id, approved, always)
                  }
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
          {demoFinished && (
            <div className="flex justify-end px-2.5 pb-1">
              <button
                className="rounded-md px-1.5 py-1 text-xs text-zinc-500 outline-hidden transition-colors duration-150 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400/40 dark:text-zinc-400 dark:hover:text-white"
                onClick={() => {
                  keepFocus();
                  demo.reset();
                }}
                type="button"
              >
                Replay
              </button>
            </div>
          )}
        </div>
      </div>
    </MotionConfig>
  );
}
