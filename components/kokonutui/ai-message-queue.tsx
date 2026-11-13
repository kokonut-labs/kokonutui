"use client";

/**
 * @author: @kokonutui
 * @description: AI Message Queue
 * @version: 1.1.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  ArrowUp,
  Check,
  CornerDownLeft,
  GripVertical,
  ListPlus,
  Pencil,
  Play,
  Square,
  X,
} from "lucide-react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  Reorder,
  useDragControls,
} from "motion/react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface AgentResponse {
  /** What the agent shows while it works, one line per step. */
  steps: string[];
  reply: string;
}

/**
 * One update from a live run: a `step` starts a new line of work (the one
 * before it is done), a `text` adds to the reply.
 */
export type AgentUpdate = { step: string } | { text: string };

export interface QueuedMessage {
  id: string;
  text: string;
}

export interface AIMessageQueueProps {
  title?: string;
  /**
   * The message the agent is working on when the component mounts. The
   * demo's when `respond` is left out.
   */
  initialPrompt?: string;
  /** Follow-ups already waiting in the queue. */
  initialQueue?: string[];
  /**
   * Runs the agent on a message. Return a stream of updates (steps as they
   * start, reply text as it comes) and the run follows it, ending when the
   * stream does. Stop and Send now abort `signal`; a throw ends the run with
   * the error's message. Or return fixed steps and a reply, played on
   * `stepMs`. Demo when omitted.
   */
  respond?: (
    text: string,
    signal: AbortSignal
  ) => AgentResponse | AsyncIterable<AgentUpdate>;
  /** Called with the queue whenever it changes, to keep it across reloads. */
  onQueueChange?: (queue: QueuedMessage[]) => void;
  /** Milliseconds per step of a run with fixed steps. */
  stepMs?: number;
  className?: string;
}

interface UserEntry {
  id: string;
  role: "user";
  text: string;
}

interface AgentEntry {
  id: string;
  role: "agent";
  steps: string[];
  reply: string;
  step: number;
  status: "running" | "done" | "stopped";
  seconds: number;
  /** Follows a stream of updates rather than a timer. */
  live?: boolean;
  /** Why the run ended early. */
  error?: string;
}

type Entry = UserEntry | AgentEntry;

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const APPLE = /Mac|iPhone|iPad/;

const DEMO: Record<string, AgentResponse> = {
  "Move session handling onto the new token store": {
    steps: [
      "Reading src/auth/session.ts",
      "Finding every getSession call",
      "Editing 6 files",
      "Running auth tests",
    ],
    reply:
      "Session handling now reads from TokenStore. I updated 6 files and the auth tests pass.",
  },
  "Also add a test for expired tokens": {
    steps: [
      "Opening session.test.ts",
      "Writing the expired token case",
      "Running auth tests",
    ],
    reply:
      "Added a test that expires a token mid-request and checks we answer 401. 14 of 14 pass.",
  },
  "Keep the old cookie name for now": {
    steps: [
      "Searching for SESSION_COOKIE",
      "Restoring kk_session",
      "Running auth tests",
    ],
    reply:
      "The cookie stays kk_session so nobody gets signed out. I left a TODO to rename it after the migration.",
  },
  "Then open a PR": {
    steps: [
      "Writing the PR description",
      "Pushing auth/token-store",
      "Opening the pull request",
    ],
    reply:
      "Opened #482, Move sessions onto TokenStore, with the test and the cookie change in it.",
  },
};

const demoRespond = (text: string): AgentResponse =>
  DEMO[text] ?? {
    steps: ["Reading the thread", "Making the change", "Checking the result"],
    reply: "Done, that's in. The tests still pass.",
  };

let counter = 0;
const uid = (prefix: string) => {
  counter += 1;
  return `${prefix}-${counter}`;
};

const useModKey = () => {
  const [mod, setMod] = useState("⌘");
  useEffect(() => {
    if (!APPLE.test(navigator.userAgent)) {
      setMod("Ctrl");
    }
  }, []);
  return mod;
};

type Respond = NonNullable<AIMessageQueueProps["respond"]>;

const isStream = (
  value: AgentResponse | AsyncIterable<AgentUpdate>
): value is AsyncIterable<AgentUpdate> => Symbol.asyncIterator in value;

const reasonOf = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : "The run failed. Try again.";

const DEMO_QUEUE = [
  "Also add a test for expired tokens",
  "Keep the old cookie name for now",
];

export default function AIMessageQueue({
  title = "Auth refactor",
  initialPrompt,
  initialQueue,
  respond: respondProp,
  onQueueChange,
  stepMs = 1700,
  className,
}: AIMessageQueueProps) {
  const isDemo = respondProp === undefined;
  const respond: Respond = respondProp ?? demoRespond;
  const firstPrompt = isDemo
    ? (initialPrompt ?? "Move session handling onto the new token store")
    : initialPrompt;
  const [entries, setEntries] = useState<Entry[]>(() =>
    isDemo && firstPrompt
      ? [
          { id: "u-0", role: "user", text: firstPrompt },
          {
            id: "a-0",
            role: "agent",
            ...demoRespond(firstPrompt),
            step: 0,
            status: "running",
            seconds: 0,
          },
        ]
      : []
  );
  const [queue, setQueue] = useState<QueuedMessage[]>(() =>
    (initialQueue ?? (isDemo ? DEMO_QUEUE : [])).map((text, i) => ({
      id: `q-${i}`,
      text,
    }))
  );
  // Tells the app about every change after the first render.
  const onQueueRef = useRef(onQueueChange);
  onQueueRef.current = onQueueChange;
  const queueMounted = useRef(false);
  useEffect(() => {
    if (queueMounted.current) {
      onQueueRef.current?.(queue);
    }
    queueMounted.current = true;
  }, [queue]);
  const controllers = useRef(new Map<string, AbortController>());
  const [paused, setPaused] = useState(false);
  const [draft, setDraft] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const mod = useModKey();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const last = entries.at(-1);
  const running = last?.role === "agent" && last.status === "running";

  const runId = running && !last.live ? last.id : null;
  const runStep = running ? last.step : -1;

  // Step a run with fixed steps along; a live one follows its stream.
  useEffect(() => {
    if (!runId || runStep < 0) {
      return;
    }
    const id = setTimeout(() => {
      setEntries((list) =>
        list.map((e) => {
          if (e.id !== runId || e.role !== "agent") {
            return e;
          }
          const step = e.step + 1;
          return step >= e.steps.length
            ? { ...e, step, status: "done" }
            : { ...e, step };
        })
      );
    }, stepMs);
    return () => clearTimeout(id);
  }, [runId, runStep, stepMs]);

  // A clock for the run, so "Working · 4s" keeps moving.
  useEffect(() => {
    if (!running) {
      return;
    }
    const id = setInterval(() => {
      setEntries((list) =>
        list.map((e) =>
          e.role === "agent" && e.status === "running"
            ? { ...e, seconds: e.seconds + 1 }
            : e
        )
      );
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const patch = useCallback(
    (id: string, change: (e: AgentEntry) => AgentEntry) =>
      setEntries((list) =>
        list.map((e) => (e.id === id && e.role === "agent" ? change(e) : e))
      ),
    []
  );

  /** Follows a live run's updates into its entry. */
  const follow = useCallback(
    async (
      id: string,
      updates: AsyncIterable<AgentUpdate>,
      signal: AbortSignal
    ) => {
      try {
        for await (const update of updates) {
          if (signal.aborted) {
            return;
          }
          patch(id, (e) =>
            "step" in update
              ? { ...e, steps: [...e.steps, update.step], step: e.steps.length }
              : { ...e, reply: e.reply + update.text }
          );
        }
        patch(id, (e) =>
          e.status === "running"
            ? { ...e, step: e.steps.length, status: "done" }
            : e
        );
      } catch (error) {
        if (!signal.aborted) {
          patch(id, (e) => ({
            ...e,
            status: "stopped",
            error: reasonOf(error),
          }));
          // A failed run holds the queue, so nothing builds on it.
          setPaused(true);
        }
      } finally {
        controllers.current.delete(id);
      }
    },
    [patch]
  );

  /** A user message and the agent's run on it. */
  const startRun = useCallback(
    (text: string): Entry[] => {
      const id = uid("a");
      const controller = new AbortController();
      const result = respond(text, controller.signal);
      const user: UserEntry = { id: uid("u"), role: "user", text };
      const base = { id, role: "agent" as const, step: 0, seconds: 0 };
      if (!isStream(result)) {
        return [user, { ...base, ...result, status: "running" }];
      }
      controllers.current.set(id, controller);
      follow(id, result, controller.signal);
      return [
        user,
        { ...base, steps: [], reply: "", status: "running", live: true },
      ];
    },
    [respond, follow]
  );

  // Live: the first message's run starts once mounted.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || isDemo || !firstPrompt) {
      return;
    }
    started.current = true;
    setEntries(startRun(firstPrompt));
  }, [isDemo, firstPrompt, startRun]);

  // When a run ends, the next queued message goes in.
  useEffect(() => {
    if (running || paused || queue.length === 0) {
      return;
    }
    const id = setTimeout(() => {
      const [next] = queue;
      setQueue((q) => q.slice(1));
      setEntries((list) => [...list, ...startRun(next.text)]);
    }, 450);
    return () => clearTimeout(id);
  }, [running, paused, queue, startRun]);

  // Keep the newest activity in view.
  const entryCount = entries.length;
  const lastStep = last?.role === "agent" ? last.step : 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (entryCount > 0 && el) {
      el.scrollTo({ top: el.scrollHeight + lastStep, behavior: "smooth" });
    }
  }, [entryCount, lastStep]);

  const stopCurrent = useCallback(() => {
    for (const c of controllers.current.values()) {
      c.abort();
    }
    setEntries((list) =>
      list.map((e) =>
        e.role === "agent" && e.status === "running"
          ? { ...e, status: "stopped" }
          : e
      )
    );
  }, []);

  /** Interrupts the run and sends this message straight away. */
  const sendNow = (text: string) => {
    setPaused(false);
    for (const c of controllers.current.values()) {
      c.abort();
    }
    setEntries((list) => [
      ...list.map((e) =>
        e.role === "agent" && e.status === "running"
          ? { ...e, status: "stopped" as const }
          : e
      ),
      ...startRun(text),
    ]);
  };

  const submit = (now: boolean) => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    setDraft("");
    if (running && !now) {
      setQueue((q) => [...q, { id: uid("q"), text }]);
      return;
    }
    if (running) {
      sendNow(text);
      return;
    }
    setPaused(false);
    setEntries((list) => [...list, ...startRun(text)]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter that confirms an IME candidate must not send.
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit(event.metaKey || event.ctrlKey);
    }
  };

  // Remove, Clear and Send now take their row (or the whole list) away, so
  // focus goes to the composer instead of dropping to the page.
  // Only from the keyboard: a tap shouldn't pop the on-screen keyboard.
  const toComposer = () => {
    if (document.activeElement?.matches(":focus-visible")) {
      inputRef.current?.focus({ preventScroll: true });
    }
  };

  const queueing = running && draft.trim().length > 0;
  let action: "stop" | "queue" | "send" = "send";
  if (queueing) {
    action = "queue";
  } else if (running) {
    action = "stop";
  }

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "flex w-full max-w-md flex-col rounded-2xl bg-white ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10",
          className
        )}
        data-state={running ? "running" : "idle"}
      >
        <header className="flex items-center gap-2 border-black/[0.06] border-b px-4 py-3 dark:border-white/[0.08]">
          <h2 className="min-w-0 flex-1 truncate font-medium text-[13px] text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          <span
            className={cn(
              "text-[12px] tabular-nums",
              running
                ? "text-zinc-600 dark:text-zinc-300"
                : "text-zinc-400 dark:text-zinc-500"
            )}
          >
            {running ? "Working" : "Idle"}
          </span>
        </header>

        <div
          className="h-72 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-width:thin]"
          ref={scrollRef}
        >
          <div className="flex min-h-full flex-col justify-end gap-4">
            <AnimatePresence initial={false}>
              {entries.map((entry) => (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  initial={{ opacity: 0, y: 10 }}
                  key={entry.id}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                >
                  {entry.role === "user" ? (
                    <div className="flex justify-end">
                      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-zinc-100 px-3.5 py-2 text-[13px] text-zinc-800 leading-snug dark:bg-zinc-800 dark:text-zinc-100">
                        {entry.text}
                      </p>
                    </div>
                  ) : (
                    <AgentBlock entry={entry} />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="p-2 pt-0">
          <div className="rounded-xl bg-zinc-50 ring-1 ring-black/[0.07] dark:bg-zinc-800/60 dark:ring-white/[0.08]">
            <QueueList
              onClear={() => {
                setQueue([]);
                toComposer();
              }}
              onEdit={(id, text) =>
                setQueue((q) =>
                  q.map((m) => (m.id === id ? { ...m, text } : m))
                )
              }
              onMoved={(text, position) =>
                setAnnouncement(`Moved "${text}" to position ${position}`)
              }
              onRemove={(id) => {
                setQueue((q) => q.filter((m) => m.id !== id));
                toComposer();
              }}
              onReorder={setQueue}
              onResume={() => setPaused(false)}
              onSendNow={(m) => {
                setQueue((q) => q.filter((x) => x.id !== m.id));
                sendNow(m.text);
                toComposer();
              }}
              paused={paused && !running}
              progress={
                running && !last.live && last.steps.length > 0
                  ? (last.step + 1) / last.steps.length
                  : 0
              }
              queue={queue}
            />
            <span aria-live="polite" className="sr-only">
              {announcement}
            </span>
            <div className="flex items-end gap-2 p-2">
              <textarea
                aria-label="Message the agent"
                className="max-h-28 min-h-8 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-[13px] text-zinc-900 leading-5 outline-hidden placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500 [@media(pointer:coarse)]:text-base"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder={
                  running
                    ? "Queue a follow-up…"
                    : "Ask the agent to do something…"
                }
                ref={inputRef}
                rows={1}
                value={draft}
              />
              <ComposerAction
                draft={draft}
                mode={action}
                onSend={() => submit(false)}
                onStop={() => {
                  stopCurrent();
                  setPaused(queue.length > 0);
                }}
              />
            </div>
          </div>
          <p className="flex h-7 items-center gap-1 px-2 text-[11px] text-zinc-400 dark:text-zinc-500">
            {running ? (
              <>
                <CornerDownLeft aria-hidden="true" className="size-3" />
                to queue
                <span className="mx-1">·</span>
                <kbd className="font-sans">{mod}</kbd>
                <CornerDownLeft aria-hidden="true" className="size-3" />
                to send now
              </>
            ) : (
              "The agent picks up queued messages when it finishes"
            )}
          </p>
        </div>
      </div>
    </MotionConfig>
  );
}

function AgentBlock({ entry }: { entry: AgentEntry }) {
  const working = entry.status === "running";
  const current =
    entry.steps[Math.min(entry.step, entry.steps.length - 1)] ?? "Thinking";
  const showReply =
    entry.status === "done" || (entry.live === true && entry.reply !== "");
  return (
    <div className="space-y-1.5">
      <div className="flex h-5 items-center gap-2 text-[12px] text-zinc-500 dark:text-zinc-400">
        {working ? (
          <>
            <Pulse />
            <span className="relative h-5 min-w-0 flex-1 overflow-hidden">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  className="absolute inset-0 truncate leading-5"
                  exit={{ y: -10, opacity: 0, filter: "blur(2px)" }}
                  initial={{ y: 10, opacity: 0, filter: "blur(2px)" }}
                  key={entry.step}
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                >
                  {current}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="shrink-0 text-zinc-400 tabular-nums dark:text-zinc-500">
              {entry.live
                ? `${entry.seconds}s`
                : `${entry.step + 1}/${entry.steps.length} · ${entry.seconds}s`}
            </span>
          </>
        ) : (
          <>
            {entry.status === "done" ? (
              <Check aria-hidden="true" className="size-3.5" />
            ) : (
              <Square aria-hidden="true" className="size-2.5 fill-current" />
            )}
            <EndLine entry={entry} />
          </>
        )}
      </div>
      <AnimatePresence initial={false}>
        {showReply && (
          <motion.p
            animate={{ opacity: 1, filter: "blur(0px)" }}
            className="text-[13px] text-zinc-800 leading-relaxed dark:text-zinc-200"
            initial={{ opacity: 0, filter: "blur(3px)" }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            {entry.reply}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function EndLine({ entry }: { entry: AgentEntry }) {
  if (entry.error) {
    return (
      <span className="min-w-0 truncate text-rose-600 dark:text-rose-400">
        {entry.error}
      </span>
    );
  }
  if (entry.status === "done") {
    return (
      <span>
        {entry.steps.length} steps · {entry.seconds}s
      </span>
    );
  }
  return (
    <span>
      Stopped after {entry.step} of {entry.steps.length} steps
    </span>
  );
}

function ComposerAction({
  mode,
  draft,
  onSend,
  onStop,
}: {
  mode: "stop" | "queue" | "send";
  draft: string;
  onSend: () => void;
  onStop: () => void;
}) {
  const swap = {
    initial: { opacity: 0, filter: "blur(2px)" },
    animate: { opacity: 1, filter: "blur(0px)" },
    exit: { opacity: 0, filter: "blur(2px)" },
    transition: { duration: 0.14, ease: EASE_OUT },
  };
  // The wrapper fades, so the button's own disabled opacity still shows.
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span className="flex shrink-0" key={mode} {...swap}>
        {mode === "stop" ? (
          <button
            aria-label="Stop the agent"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-700 transition-colors duration-150 hover:bg-zinc-300 active:bg-zinc-400/70 dark:bg-zinc-700 dark:text-zinc-200 dark:active:bg-zinc-500 dark:hover:bg-zinc-600"
            onClick={onStop}
            type="button"
          >
            <Square className="size-3 fill-current" />
          </button>
        ) : (
          <button
            aria-label={mode === "queue" ? "Add to queue" : "Send"}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 font-medium text-[12px] text-white transition-[background-color,opacity] duration-150 hover:bg-zinc-700 active:bg-zinc-600 disabled:opacity-30 dark:bg-white dark:text-zinc-900 dark:active:bg-zinc-300 dark:hover:bg-zinc-200"
            disabled={!draft.trim()}
            onClick={onSend}
            type="button"
          >
            {mode === "queue" ? (
              <>
                <ListPlus aria-hidden="true" className="size-3.5" />
                Queue
              </>
            ) : (
              <ArrowUp aria-hidden="true" className="size-3.5" />
            )}
          </button>
        )}
      </motion.span>
    </AnimatePresence>
  );
}

function QueueList({
  queue,
  paused,
  progress,
  onMoved,
  onReorder,
  onEdit,
  onRemove,
  onSendNow,
  onClear,
  onResume,
}: {
  queue: QueuedMessage[];
  paused: boolean;
  /** How far the current run is, 0 to 1. The next row in line shows it. */
  progress: number;
  onMoved: (text: string, position: number) => void;
  onReorder: (queue: QueuedMessage[]) => void;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onSendNow: (message: QueuedMessage) => void;
  onClear: () => void;
  onResume: () => void;
}) {
  const move = (index: number, by: number) => {
    const to = index + by;
    if (to < 0 || to >= queue.length) {
      return;
    }
    const next = [...queue];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    onReorder(next);
    onMoved(item.text, to + 1);
  };

  return (
    <AnimatePresence initial={false}>
      {queue.length > 0 && (
        <motion.div
          animate={{ height: "auto", opacity: 1 }}
          className="overflow-hidden"
          exit={{ height: 0, opacity: 0 }}
          initial={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
        >
          <div className="border-black/[0.06] border-b px-1.5 pt-1.5 pb-1 dark:border-white/[0.08]">
            <div className="flex h-6 items-center gap-2 px-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span>
                {paused ? "Queue paused" : "Queued"}
                <span className="ml-1 tabular-nums">{queue.length}</span>
              </span>
              {paused && (
                <button
                  className="flex items-center gap-1 rounded px-1 font-medium text-zinc-800 transition-colors duration-100 hover:bg-zinc-900/[0.06] dark:text-zinc-100 dark:hover:bg-white/10"
                  onClick={onResume}
                  type="button"
                >
                  <Play aria-hidden="true" className="size-2.5 fill-current" />
                  Resume
                </button>
              )}
              <button
                className="ml-auto rounded px-1 transition-colors duration-100 hover:bg-zinc-900/[0.06] hover:text-zinc-800 dark:hover:bg-white/10 dark:hover:text-zinc-100"
                onClick={onClear}
                type="button"
              >
                Clear
              </button>
            </div>
            <Reorder.Group
              axis="y"
              className="space-y-0.5"
              onReorder={onReorder}
              values={queue}
            >
              <AnimatePresence initial={false}>
                {queue.map((message, index) => (
                  <QueueRow
                    index={index}
                    key={message.id}
                    message={message}
                    next={index === 0}
                    onEdit={(text) => onEdit(message.id, text)}
                    onMove={(by) => move(index, by)}
                    onRemove={() => onRemove(message.id)}
                    onSendNow={() => onSendNow(message)}
                    progress={paused ? 0 : progress}
                  />
                ))}
              </AnimatePresence>
            </Reorder.Group>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function QueueRow({
  message,
  index,
  next,
  progress,
  onEdit,
  onMove,
  onRemove,
  onSendNow,
}: {
  message: QueuedMessage;
  index: number;
  next: boolean;
  progress: number;
  onEdit: (text: string) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
  onSendNow: () => void;
}) {
  const controls = useDragControls();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(message.text);
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  /** Set once an edit ends, so the blur that follows can't save it again. */
  const finished = useRef(false);

  useEffect(() => {
    if (editing) {
      finished.current = false;
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  /** Ends the edit. Escape passes `save: false`; keyboard exits refocus Edit. */
  const finish = (save: boolean, refocus: boolean) => {
    if (finished.current) {
      return;
    }
    finished.current = true;
    const text = value.trim();
    if (save && text) {
      onEdit(text);
    } else {
      setValue(message.text);
    }
    setEditing(false);
    if (refocus) {
      editRef.current?.focus();
    }
  };

  const icon =
    "flex size-6 shrink-0 items-center justify-center rounded-md text-zinc-400 outline-hidden transition-colors duration-100 hover:bg-zinc-900/[0.06] hover:text-zinc-800 focus-visible:bg-zinc-900/[0.06] active:bg-zinc-900/[0.1] dark:active:bg-white/15 focus-visible:text-zinc-800 dark:text-zinc-500 dark:focus-visible:bg-white/10 dark:focus-visible:text-zinc-100 dark:hover:bg-white/10 dark:hover:text-zinc-100";

  return (
    <Reorder.Item
      animate={{ opacity: 1, y: 0 }}
      className="group/row relative flex h-8 items-center gap-1 overflow-hidden rounded-lg bg-white pr-1 pl-0.5 ring-1 ring-black/[0.05] dark:bg-zinc-900 dark:ring-white/[0.06]"
      dragControls={controls}
      dragListener={false}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
      initial={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.22, ease: EASE_OUT }}
      value={message}
      whileDrag={{
        boxShadow: "0 8px 20px -8px rgb(0 0 0 / 0.25)",
        zIndex: 10,
      }}
    >
      <button
        aria-label={`Move "${message.text}". Use the arrow keys to reorder`}
        className={cn(icon, "cursor-grab touch-none active:cursor-grabbing")}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            onMove(event.key === "ArrowUp" ? -1 : 1);
          }
        }}
        onPointerDown={(event) => controls.start(event)}
        type="button"
      >
        <GripVertical className="size-3.5" />
      </button>
      {next && (
        <motion.span
          animate={{ scaleX: progress, opacity: progress > 0 ? 1 : 0 }}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-zinc-900/25 dark:bg-white/30"
          initial={false}
          transition={{ duration: 0.4, ease: EASE_OUT }}
        />
      )}
      <span className="w-3.5 shrink-0 text-center text-[11px] text-zinc-400 tabular-nums dark:text-zinc-500">
        {index + 1}
      </span>
      {editing ? (
        <input
          aria-label="Edit queued message"
          className="h-6 min-w-0 flex-1 rounded-md bg-zinc-100 px-1.5 text-[12px] text-zinc-900 outline-hidden dark:bg-zinc-800 dark:text-zinc-100 [@media(pointer:coarse)]:text-base"
          onBlur={() => finish(true, false)}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) {
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              finish(true, true);
            } else if (event.key === "Escape") {
              event.preventDefault();
              finish(false, true);
            }
          }}
          ref={inputRef}
          value={value}
        />
      ) : (
        <p className="min-w-0 flex-1 truncate px-1.5 text-[12px] text-zinc-700 dark:text-zinc-200">
          {message.text}
        </p>
      )}
      <div className="flex shrink-0 items-center opacity-100 transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:focus-within:opacity-100 [@media(hover:hover)]:group-hover/row:opacity-100">
        <button
          aria-label="Edit"
          className={icon}
          onClick={() => setEditing(true)}
          ref={editRef}
          type="button"
        >
          <Pencil className="size-3" />
        </button>
        <button
          aria-label="Send now"
          className={icon}
          onClick={onSendNow}
          title="Stop the agent and send this now"
          type="button"
        >
          <ArrowUp className="size-3.5" />
        </button>
        <button
          aria-label="Remove from queue"
          className={icon}
          onClick={onRemove}
          type="button"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </Reorder.Item>
  );
}

function Pulse() {
  return (
    <span
      aria-hidden="true"
      className="relative flex size-3.5 items-center justify-center"
    >
      <motion.span
        animate={{ opacity: [0.35, 1, 0.35] }}
        className="size-1.5 rounded-full bg-zinc-800 dark:bg-zinc-200"
        transition={{
          duration: 1.2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
    </span>
  );
}
