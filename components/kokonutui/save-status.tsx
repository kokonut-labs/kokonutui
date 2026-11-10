"use client";

/**
 * @author: @kokonutui
 * @description: Save Status
 * @version: 1.0.0
 * @date: 2026-11-08
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { CloudOff, FileText, Wifi, WifiOff } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface SaveStatusProps {
  title?: string;
  defaultText?: string;
  /** Pause after typing before a save starts, in ms. */
  idleMs?: number;
  /** Stand-in for your save call: resolve when the server has it. */
  onSave?: (text: string) => Promise<void>;
  className?: string;
}

type State =
  | { kind: "saved"; at: number; fresh: boolean }
  | { kind: "editing" }
  | { kind: "saving" }
  | { kind: "offline"; queued: number }
  | { kind: "syncing"; left: number };

const DEMO_TEXT =
  "Launch is Thursday at 10:00. Marketing sends the email first, then we flip the pricing page. Keep the old plans live for a week.";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const FRESH_MS = 1600;
const WORD = /\S+/g;

const wait = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const ago = (at: number, now: number) => {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 10) {
    return "just now";
  }
  if (s < 60) {
    return `${Math.floor(s / 5) * 5}s ago`;
  }
  return `${Math.floor(s / 60)}m ago`;
};

export default function SaveStatus({
  title = "Launch notes",
  defaultText = DEMO_TEXT,
  idleMs = 700,
  onSave = () => wait(650),
  className,
}: SaveStatusProps) {
  const [text, setText] = useState(defaultText);
  const [online, setOnline] = useState(true);
  const [state, setState] = useState<State>({
    kind: "saved",
    at: 0,
    fresh: false,
  });
  const [now, setNow] = useState(0);
  const idle = useRef<number>(undefined);
  const settle = useRef<number>(undefined);
  const onlineRef = useRef(online);
  onlineRef.current = online;
  const textRef = useRef(text);
  textRef.current = text;

  // Start the clock after mount, so the server and client agree.
  useEffect(() => {
    const start = Date.now();
    setNow(start);
    setState((s) =>
      s.kind === "saved" && s.at === 0 ? { ...s, at: start } : s
    );
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(idle.current);
      window.clearTimeout(settle.current);
    };
  }, []);

  const save = async () => {
    window.clearTimeout(idle.current);
    setState({ kind: "saving" });
    await onSave(textRef.current);
    const at = Date.now();
    setNow(at);
    // Saved shows in green for a moment, then settles into a quiet timestamp.
    setState({ kind: "saved", at, fresh: true });
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      setState((s) => (s.kind === "saved" ? { ...s, fresh: false } : s));
    }, FRESH_MS);
  };

  const queue = () =>
    // Each pause in typing is one change waiting to go up.
    setState((s) => ({
      kind: "offline",
      queued: (s.kind === "offline" ? s.queued : 0) + 1,
    }));

  const onType = (value: string) => {
    setText(value);
    setState((s) => (s.kind === "offline" ? s : { kind: "editing" }));
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => {
      if (onlineRef.current) {
        save();
      } else {
        queue();
      }
    }, idleMs);
  };

  // Cmd/Ctrl+S saves now instead of waiting for the pause.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (onlineRef.current && state.kind === "editing") {
        save();
      }
    }
  };

  const sync = async (count: number) => {
    for (let left = count; left > 0; left--) {
      setState({ kind: "syncing", left });
      await wait(380);
    }
    await save();
  };

  const toggle = () => {
    const next = !online;
    setOnline(next);
    window.clearTimeout(idle.current);
    if (next) {
      const queued = state.kind === "offline" ? state.queued : 0;
      if (queued > 0) {
        sync(queued);
      } else {
        setState({ kind: "saved", at: Date.now(), fresh: false });
      }
    } else {
      setState({ kind: "offline", queued: 0 });
    }
  };

  const words = text.match(WORD)?.length ?? 0;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-md overflow-hidden rounded-[24px] border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
      >
        <div className="flex h-14 items-center gap-2 border-zinc-200 border-b px-4 dark:border-zinc-800">
          <FileText
            aria-hidden="true"
            className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500"
          />
          <span className="min-w-0 truncate font-medium text-[14px]">
            {title}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <Pill now={now} state={state} />
            <button
              aria-label={online ? "Go offline" : "Go online"}
              aria-pressed={!online}
              className={cn(
                "flex size-8 items-center justify-center rounded-full outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400/50",
                online
                  ? "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 active:bg-zinc-200 dark:text-zinc-400 dark:active:bg-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                  : "bg-orange-500/10 text-orange-600 dark:text-orange-400"
              )}
              onClick={toggle}
              title={online ? "Go offline" : "Go online"}
              type="button"
            >
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.8, filter: "blur(2px)" }}
                  initial={{ opacity: 0, scale: 0.8, filter: "blur(2px)" }}
                  key={online ? "on" : "off"}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                >
                  {online ? (
                    <Wifi aria-hidden="true" className="size-4" />
                  ) : (
                    <WifiOff aria-hidden="true" className="size-4" />
                  )}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </div>

        <textarea
          aria-label={title}
          className="block h-36 w-full resize-none bg-transparent px-4 py-3 text-[16px] leading-relaxed outline-hidden placeholder:text-zinc-400 sm:text-[15px]"
          onChange={(event) => onType(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Start typing…"
          value={text}
        />

        <div className="relative h-10 overflow-hidden border-zinc-100 border-t text-[12px] dark:border-zinc-900">
          <AnimatePresence initial={false} mode="popLayout">
            {online ? (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="flex h-10 items-center justify-between px-4 text-zinc-500 dark:text-zinc-400"
                exit={{ opacity: 0, y: -8 }}
                initial={{ opacity: 0, y: 8 }}
                key="words"
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                <span className="flex items-center gap-1 tabular-nums">
                  <Roll value={words} /> words
                </span>
                <span className="flex items-center gap-1.5">
                  <Kbd>{"⌘"}</Kbd>
                  <Kbd>S</Kbd>
                  <span>save now</span>
                </span>
              </motion.div>
            ) : (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="flex h-10 items-center gap-2 bg-orange-500/[0.07] px-4 text-orange-700 dark:text-orange-300"
                exit={{ opacity: 0, y: -8 }}
                initial={{ opacity: 0, y: 8 }}
                key="offline"
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                <CloudOff aria-hidden="true" className="size-3.5 shrink-0" />
                Changes stay on this device until you're back online.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="flex h-5 min-w-5 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 px-1 font-sans text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
      {children}
    </kbd>
  );
}

const NEUTRAL = "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400";

function pillLook(state: State, now: number) {
  switch (state.kind) {
    case "saved":
      return {
        key: state.fresh ? "fresh" : "saved",
        tone: state.fresh
          ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          : NEUTRAL,
        icon: <DrawnCheck />,
        label: state.fresh ? "Saved" : `Saved ${ago(state.at, now)}`,
      };
    case "saving":
      return {
        key: "saving",
        tone: "bg-sky-500/10 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
        icon: <Spinner />,
        label: "Saving",
      };
    case "offline":
      return {
        key: "offline",
        tone: "bg-orange-500/10 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
        icon: <CloudOff aria-hidden="true" className="size-3.5" />,
        label:
          state.queued > 0 ? (
            <>
              <Roll value={state.queued} /> to sync
            </>
          ) : (
            "Offline"
          ),
      };
    case "syncing":
      return {
        key: "syncing",
        tone: "bg-sky-500/10 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
        icon: <Spinner />,
        label: (
          <>
            Syncing <Roll value={state.left} />
          </>
        ),
      };
    default:
      return {
        key: "editing",
        tone: NEUTRAL,
        icon: <span className="size-1.5 rounded-full bg-current opacity-70" />,
        label: "Editing",
      };
  }
}

/** One pill whose width follows its words, so every state change glides. */
function Pill({ state, now }: { state: State; now: number }) {
  const look = pillLook(state, now);
  return (
    <motion.div
      aria-live="polite"
      className={cn(
        "flex h-8 items-center overflow-hidden px-3 font-medium text-[12.5px] transition-colors duration-300",
        look.tone
      )}
      layout
      role="status"
      style={{ borderRadius: 999 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          className="flex items-center gap-1.5 whitespace-nowrap tabular-nums"
          exit={{ opacity: 0, y: -8, filter: "blur(2px)" }}
          initial={{ opacity: 0, y: 8, filter: "blur(2px)" }}
          key={look.key}
          layout="position"
          transition={{ duration: 0.2, ease: EASE_OUT }}
        >
          {look.icon}
          {look.label}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5 animate-spin"
      fill="none"
      viewBox="0 0 14 14"
    >
      <circle
        cx={7}
        cy={7}
        opacity={0.25}
        r={5.5}
        stroke="currentColor"
        strokeWidth={2}
      />
      <path
        d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function DrawnCheck() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5 text-emerald-500"
      fill="none"
      viewBox="0 0 14 14"
    >
      <motion.path
        animate={{ pathLength: 1 }}
        d="M2.8 7.3l2.7 2.6 5.7-5.8"
        initial={{ pathLength: 0 }}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        transition={{ duration: 0.25, delay: 0.1, ease: EASE_OUT }}
      />
    </svg>
  );
}

/** A number that rolls up when it grows and down when it shrinks. */
function Roll({ value }: { value: number }) {
  const previous = useRef(value);
  const up = value >= previous.current;
  useEffect(() => {
    previous.current = value;
  }, [value]);
  return (
    <span className="relative inline-flex overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: up ? "-70%" : "70%", opacity: 0 }}
          initial={{ y: up ? "70%" : "-70%", opacity: 0 }}
          key={value}
          transition={{ duration: 0.2, ease: EASE_OUT }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
