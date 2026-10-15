"use client";

/**
 * @author: @dorianbaffier
 * @description: Peek Preview
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Archive, ChevronLeft, MailOpen, Reply } from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface PeekItem {
  id: string;
  from: string;
  subject: string;
  /** The full message. The list shows its first line. */
  body: string;
  time: string;
}

export interface PeekAction {
  label: string;
  icon?: ReactNode;
}

export interface PeekPreviewProps {
  items?: PeekItem[];
  title?: string;
  /** Shown under the preview when it is swiped up. */
  actions?: PeekAction[];
  className?: string;
  /** Called when a row is opened: tapped, clicked, or held past the peek. */
  onOpen?: (item: PeekItem) => void;
  /** Called with the action picked from under the preview. */
  onAction?: (item: PeekItem, action: PeekAction) => void;
}

const DEFAULT_ITEMS: PeekItem[] = [
  {
    id: "m-1",
    from: "Lena Fischer",
    subject: "Final cut of the launch video",
    body: "I trimmed the intro to twelve seconds and moved the product shot up, so it lands before anyone scrolls away. The music now ends on the logo instead of fading under it. If you're happy with this one I'll export the square version for social tonight.",
    time: "9:41",
  },
  {
    id: "m-2",
    from: "Marco Ruiz",
    subject: "Invoice 2041 for September",
    body: "Attached is the invoice for the September retainer, same amount as last month. Payment terms are thirty days as usual. Let me know if finance needs it split across the two projects.",
    time: "9:12",
  },
  {
    id: "m-3",
    from: "Aiko Tanaka",
    subject: "Climbing on Saturday?",
    body: "The new wall opens at ten and the first hour is free. I can bring the spare shoes if yours are still at the office. Coffee after, obviously.",
    time: "Yesterday",
  },
  {
    id: "m-4",
    from: "Noah Kim",
    subject: "Notes from the user interviews",
    body: "Six interviews this week. Everyone found the export button, nobody found the history panel, and three people asked for a keyboard shortcut to duplicate a frame. Full notes are in the shared folder, with timestamps for the good bits.",
    time: "Yesterday",
  },
  {
    id: "m-5",
    from: "Studio Weekly",
    subject: "Twelve type specimens worth a look",
    body: "This week: a grotesk drawn from 1960s railway signs, a variable serif with an optical size axis that actually works at caption sizes, and the story behind a typeface cut for a single museum.",
    time: "Mon",
  },
  {
    id: "m-6",
    from: "Priya Shah",
    subject: "Offsite dates",
    body: "Two options for the offsite: the second week of November by the lake, or early December in town. The lake house fits everyone but needs a deposit by Friday.",
    time: "Sun",
  },
];

const DEFAULT_ACTIONS: PeekAction[] = [
  { label: "Reply", icon: <Reply className="size-4" /> },
  { label: "Mark as read", icon: <MailOpen className="size-4" /> },
  { label: "Archive", icon: <Archive className="size-4" /> },
];

// Hold timeline, in ms: a short wait so taps and scrolls don't peek, the
// peek itself (tracked to the finger, so it can be backed out of), then a
// longer hold that opens the row.
const HOLD_DELAY = 140;
const PEEK_TIME = 360;
const OPEN_HOLD = 700;
// Moving this far before the peek means a scroll, not a press.
const SLOP = 8;
// Drag up past this, or flick, to keep the actions open.
const ACTION_PULL = 28;
const FLICK = 0.11;
// Where the preview rests once the actions are out.
const ACTION_LIFT = 44;
const EXIT = 150;
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const EASE_DRAWER = "cubic-bezier(0.32, 0.72, 0, 1)";

type Phase = "idle" | "press" | "peek" | "actions" | "open";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

/** Rubber band: follows the finger, then gives less and less. */
function rubber(x: number, limit: number) {
  return limit * Math.tanh(x / limit);
}

function easeOut(t: number) {
  return 1 - (1 - t) ** 4;
}

function reduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 font-medium text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
        className
      )}
    >
      {initials(name)}
    </span>
  );
}

export default function PeekPreview({
  items = DEFAULT_ITEMS,
  title = "Inbox",
  actions = DEFAULT_ACTIONS,
  className,
  onOpen,
  onAction,
}: PeekPreviewProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [active, setActive] = useState(0);
  const [read, setRead] = useState<Set<string>>(() => new Set());

  const rootRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLSpanElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const fillRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // Everything that moves every frame lives here, written straight to the
  // DOM, so React only renders when the phase changes.
  const live = useRef({
    phase: "idle" as Phase,
    index: 0,
    progress: 0,
    lift: 0,
    pointer: -1,
    startX: 0,
    startY: 0,
    startTime: 0,
    peekTime: 0,
    lastY: 0,
    lastTime: 0,
    velocity: 0,
    raf: 0,
    tween: 0,
    keyboard: false,
  });

  const go = useCallback((next: Phase) => {
    live.current.phase = next;
    setPhase(next);
  }, []);

  /** Draw the peek at `progress` (0 to 1) and the swipe lift in px. */
  const paint = useCallback(() => {
    const s = live.current;
    const overlay = overlayRef.current;
    const card = cardRef.current;
    const root = rootRef.current;
    const row = rowRefs.current[s.index];
    if (!(overlay && card && root && row)) {
      return;
    }
    const p = s.progress;
    const t = easeOut(p);
    overlay.style.opacity = `${Math.min(p * 1.4, 1)}`;
    overlay.style.backdropFilter = `blur(${(t * 6).toFixed(2)}px)`;
    // The pressed row fills as the press deepens.
    const fill = fillRefs.current[s.index];
    if (fill) {
      fill.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(1)}% 0 0)`;
    }
    // The preview grows out of the row it belongs to.
    const rootBox = root.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    const rowMid = rowBox.top + rowBox.height / 2 - rootBox.top;
    const cardMid = card.offsetTop + card.offsetHeight / 2;
    const appear = Math.min(Math.max((p - 0.3) / 0.25, 0), 1);
    const from = reduced() ? 0 : (rowMid - cardMid) * (1 - t);
    const scale = reduced() ? 1 : 0.92 + 0.08 * t;
    card.style.opacity = `${appear}`;
    card.style.transform = `translate3d(0, ${(from - s.lift).toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
    const actionsEl = actionsRef.current;
    if (actionsEl) {
      const out = Math.min(s.lift / ACTION_LIFT, 1);
      actionsEl.style.opacity = `${out}`;
      actionsEl.style.transform = `translate3d(0, ${((1 - out) * 24).toFixed(2)}px, 0)`;
    }
  }, []);

  const stopLoop = useCallback(() => {
    cancelAnimationFrame(live.current.raf);
    cancelAnimationFrame(live.current.tween);
    live.current.raf = 0;
    live.current.tween = 0;
  }, []);

  /** Ease progress and lift to a target, then call `done`. */
  const tweenTo = useCallback(
    (progress: number, lift: number, duration: number, done?: () => void) => {
      const s = live.current;
      cancelAnimationFrame(s.tween);
      const from = { progress: s.progress, lift: s.lift };
      const start = performance.now();
      const tick = (now: number) => {
        const t = duration > 0 ? Math.min((now - start) / duration, 1) : 1;
        const k = easeOut(t);
        s.progress = from.progress + (progress - from.progress) * k;
        s.lift = from.lift + (lift - from.lift) * k;
        paint();
        if (t < 1) {
          s.tween = requestAnimationFrame(tick);
        } else {
          s.tween = 0;
          done?.();
        }
      };
      s.tween = requestAnimationFrame(tick);
    },
    [paint]
  );

  const dismiss = useCallback(() => {
    stopLoop();
    // Leaving is quicker than arriving.
    tweenTo(0, 0, EXIT, () => {
      const fill = fillRefs.current[live.current.index];
      if (fill) {
        fill.style.clipPath = "inset(0 100% 0 0)";
      }
      go("idle");
    });
  }, [go, stopLoop, tweenTo]);

  const open = useCallback(
    (index: number) => {
      stopLoop();
      const s = live.current;
      s.index = index;
      setActive(index);
      setRead((prev) => new Set(prev).add(items[index].id));
      go("open");
      onOpen?.(items[index]);
    },
    [go, items, onOpen, stopLoop]
  );

  // The open view unfolds from where the preview (or the row) was.
  useEffect(() => {
    if (phase !== "open") {
      return;
    }
    const view = openRef.current;
    const root = rootRef.current;
    const s = live.current;
    const source =
      s.progress > 0.5 ? cardRef.current : rowRefs.current[s.index];
    if (!(view && root && source) || reduced()) {
      s.progress = 0;
      s.lift = 0;
      paint();
      return;
    }
    const a = root.getBoundingClientRect();
    const b = source.getBoundingClientRect();
    const inset = `inset(${b.top - a.top}px ${a.right - b.right}px ${a.bottom - b.bottom}px ${b.left - a.left}px round 16px)`;
    view.animate(
      [{ clipPath: inset }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }],
      { duration: 340, easing: EASE_DRAWER }
    );
    s.progress = 0;
    s.lift = 0;
    paint();
  }, [phase, paint]);

  const back = useCallback(() => {
    const view = openRef.current;
    const root = rootRef.current;
    const row = rowRefs.current[live.current.index];
    const finish = () => {
      go("idle");
      requestAnimationFrame(() => row?.focus({ preventScroll: true }));
    };
    if (!(view && root && row) || reduced()) {
      finish();
      return;
    }
    const a = root.getBoundingClientRect();
    const b = row.getBoundingClientRect();
    const inset = `inset(${b.top - a.top}px ${a.right - b.right}px ${a.bottom - b.bottom}px ${b.left - a.left}px round 12px)`;
    const anim = view.animate(
      [
        { clipPath: "inset(0px 0px 0px 0px round 0px)", opacity: 1 },
        { clipPath: inset, opacity: 0 },
      ],
      { duration: 240, easing: EASE_OUT, fill: "forwards" }
    );
    anim.onfinish = finish;
  }, [go]);

  /** The hold loop: deepen the press, peek, then open if still held. */
  const loop = useCallback(
    (now: number) => {
      const s = live.current;
      if (s.phase === "press") {
        const held = now - s.startTime - HOLD_DELAY;
        s.progress = Math.min(Math.max(held / PEEK_TIME, 0), 1);
        if (s.progress >= 1) {
          s.peekTime = now;
          go("peek");
        }
      } else if (s.phase === "peek") {
        const hold = (now - s.peekTime) / OPEN_HOLD;
        const hint = hintRef.current;
        if (hint) {
          hint.style.clipPath = `inset(0 ${((1 - Math.min(hold, 1)) * 100).toFixed(1)}% 0 0)`;
        }
        if (hold >= 1 && s.lift < 4) {
          open(s.index);
          return;
        }
      } else {
        return;
      }
      paint();
      s.raf = requestAnimationFrame(loop);
    },
    [go, open, paint]
  );

  const onRowPointerDown = (index: number, event: PointerEvent) => {
    const s = live.current;
    if (s.phase !== "idle" || event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    Object.assign(s, {
      index,
      pointer: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: performance.now(),
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
      progress: 0,
      lift: 0,
      keyboard: false,
    });
    setActive(index);
    go("press");
    stopLoop();
    s.raf = requestAnimationFrame(loop);
  };

  const onRowPointerMove = (event: PointerEvent) => {
    const s = live.current;
    if (event.pointerId !== s.pointer) {
      return;
    }
    const dx = event.clientX - s.startX;
    const dy = event.clientY - s.startY;
    if (s.phase === "press" && Math.hypot(dx, dy) > SLOP) {
      // It's a scroll or a drag, not a press: let it go.
      s.pointer = -1;
      dismiss();
      return;
    }
    if (s.phase !== "peek") {
      return;
    }
    const dt = Math.max(event.timeStamp - s.lastTime, 1);
    s.velocity = (s.lastY - event.clientY) / dt;
    s.lastY = event.clientY;
    s.lastTime = event.timeStamp;
    // Up lifts the preview to show its actions; down resists.
    s.lift = dy < 0 ? rubber(-dy, ACTION_LIFT * 1.6) : -rubber(dy, 24);
    if (Math.abs(dy) > 6) {
      s.peekTime = performance.now();
    }
  };

  const onRowPointerUp = (event: PointerEvent) => {
    const s = live.current;
    if (event.pointerId !== s.pointer) {
      return;
    }
    s.pointer = -1;
    if (s.phase === "press") {
      const quick = performance.now() - s.startTime < HOLD_DELAY + 60;
      if (quick) {
        open(s.index);
      } else {
        dismiss();
      }
      return;
    }
    if (s.phase !== "peek") {
      return;
    }
    stopLoop();
    if (s.lift > ACTION_PULL || s.velocity > FLICK) {
      go("actions");
      tweenTo(1, ACTION_LIFT, 260);
    } else {
      dismiss();
    }
  };

  const onRowPointerCancel = (event: PointerEvent) => {
    const s = live.current;
    if (event.pointerId !== s.pointer) {
      return;
    }
    s.pointer = -1;
    if (s.phase === "press" || s.phase === "peek") {
      dismiss();
    }
  };

  const peekWithKeyboard = (index: number) => {
    const s = live.current;
    stopLoop();
    s.index = index;
    s.keyboard = true;
    setActive(index);
    go("actions");
    tweenTo(1, ACTION_LIFT, reduced() ? 0 : 200);
  };

  const onRowKeyDown = (index: number, event: KeyboardEvent) => {
    const s = live.current;
    if (event.key === " ") {
      // Space peeks, like Quick Look.
      event.preventDefault();
      if (s.phase === "idle") {
        peekWithKeyboard(index);
      } else {
        dismiss();
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.min(
        Math.max(index + (event.key === "ArrowDown" ? 1 : -1), 0),
        items.length - 1
      );
      rowRefs.current[next]?.focus();
      if (s.phase === "actions" && s.keyboard) {
        // The peek follows the selection without animating.
        s.index = next;
        setActive(next);
        requestAnimationFrame(paint);
      }
    }
  };

  // Escape closes whatever is open, wherever focus is.
  useEffect(() => {
    if (phase === "idle") {
      return;
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (live.current.phase === "open") {
        back();
      } else if (live.current.phase !== "idle") {
        dismiss();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase, back, dismiss]);

  // Once a touch has peeked, its moves swipe the preview instead of
  // scrolling the page (touch-action is fixed when the touch starts).
  useEffect(() => {
    const root = rootRef.current;
    const onTouchMove = (event: TouchEvent) => {
      const { phase: now } = live.current;
      if (event.cancelable && (now === "peek" || now === "actions")) {
        event.preventDefault();
      }
    };
    root?.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => root?.removeEventListener("touchmove", onTouchMove);
  }, []);

  useEffect(() => stopLoop, [stopLoop]);

  const item = items[active] ?? items[0];
  const peeking = phase === "press" || phase === "peek" || phase === "actions";

  return (
    <div
      className={cn(
        "relative isolate h-[520px] w-full max-w-sm select-none overflow-hidden rounded-3xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
      ref={rootRef}
    >
      <div className="flex items-baseline justify-between px-5 pt-5 pb-3">
        <h3 className="font-semibold text-lg tracking-tight">{title}</h3>
        <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          {items.length - read.size} unread
        </span>
      </div>
      <ul className="px-2">
        {items.map((entry, index) => {
          const pressed = peeking && index === active;
          return (
            <li key={entry.id}>
              <button
                aria-label={`${entry.from}: ${entry.subject}`}
                className={cn(
                  "group/row relative flex w-full touch-pan-y items-start gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-left outline-none transition-colors duration-150 ease-out [-webkit-touch-callout:none] hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:hover:bg-zinc-900",
                  // The pressed row stays sharp above the blur until the
                  // preview takes over.
                  pressed &&
                    phase === "press" &&
                    "z-20 bg-zinc-50 dark:bg-zinc-900"
                )}
                onClick={(event) => {
                  // Pointer taps open on release; this is Enter on a focused row.
                  if (event.detail === 0) {
                    open(index);
                  }
                }}
                onContextMenu={(event) => event.preventDefault()}
                onKeyDown={(event) => onRowKeyDown(index, event)}
                onPointerCancel={onRowPointerCancel}
                onPointerDown={(event) => onRowPointerDown(index, event)}
                onPointerMove={onRowPointerMove}
                onPointerUp={onRowPointerUp}
                ref={(el) => {
                  rowRefs.current[index] = el;
                }}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800/70"
                  ref={(el) => {
                    fillRefs.current[index] = el;
                  }}
                  style={{ clipPath: "inset(0 100% 0 0)" }}
                />
                <Avatar className="relative" name={entry.from} />
                <span className="relative min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-sm",
                        read.has(entry.id)
                          ? "text-zinc-600 dark:text-zinc-400"
                          : "font-semibold"
                      )}
                    >
                      {entry.from}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-400 tabular-nums dark:text-zinc-500">
                      {entry.time}
                    </span>
                  </span>
                  <span className="block truncate text-sm text-zinc-800 dark:text-zinc-200">
                    {entry.subject}
                  </span>
                  <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {entry.body}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Blur over the list while peeking; a tap on it puts the preview away. */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 z-10 bg-white/50 opacity-0 dark:bg-zinc-950/50",
          phase === "actions" ? "pointer-events-auto" : "pointer-events-none"
        )}
        onClick={dismiss}
        ref={overlayRef}
      />

      {/* The preview card. */}
      <div
        aria-hidden={!peeking}
        aria-label={`Preview: ${item.subject}`}
        className={cn(
          "absolute inset-x-4 top-16 z-30 flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 opacity-0 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] will-change-transform dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.8)]",
          peeking ? "pointer-events-auto" : "pointer-events-none"
        )}
        ref={cardRef}
        role="dialog"
      >
        <div className="flex items-center gap-3">
          <Avatar name={item.from} />
          <div className="min-w-0">
            <p className="truncate font-medium text-sm">{item.from}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {item.time}
            </p>
          </div>
        </div>
        <p className="mt-4 font-semibold text-base tracking-tight">
          {item.subject}
        </p>
        <p className="mt-2 line-clamp-5 text-sm text-zinc-600 leading-relaxed dark:text-zinc-300">
          {item.body}
        </p>
        <p className="relative mt-4 border-zinc-100 border-t pt-3 text-xs dark:border-zinc-800">
          <span className="text-zinc-400 dark:text-zinc-500">
            {phase === "actions"
              ? "Pick an action, or tap outside to close"
              : "Hold to open · Swipe up for actions"}
          </span>
          {/* The hint fills while the hold counts down to opening. */}
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-x-0 top-3 text-zinc-700 dark:text-zinc-200",
              phase !== "peek" && "hidden"
            )}
            ref={hintRef}
            style={{ clipPath: "inset(0 100% 0 0)" }}
          >
            Hold to open · Swipe up for actions
          </span>
        </p>
      </div>

      {/* Actions, revealed by swiping the preview up. */}
      <div
        className={cn(
          "absolute inset-x-4 bottom-4 z-30 overflow-hidden rounded-2xl border border-zinc-200 bg-white opacity-0 dark:border-zinc-800 dark:bg-zinc-900",
          phase === "actions" ? "pointer-events-auto" : "pointer-events-none"
        )}
        ref={actionsRef}
      >
        {actions.map((action) => (
          <button
            className="flex w-full items-center justify-between border-zinc-100 border-b px-4 py-3 text-left text-sm outline-none transition-colors duration-150 ease-out last:border-b-0 hover:bg-zinc-50 focus-visible:bg-zinc-50 dark:border-zinc-800 dark:focus-visible:bg-zinc-800 dark:hover:bg-zinc-800"
            key={action.label}
            onClick={() => {
              if (action.label === "Mark as read") {
                setRead((prev) => new Set(prev).add(item.id));
              }
              onAction?.(item, action);
              dismiss();
            }}
            tabIndex={phase === "actions" ? 0 : -1}
            type="button"
          >
            {action.label}
            <span className="text-zinc-400 dark:text-zinc-500">
              {action.icon}
            </span>
          </button>
        ))}
      </div>

      {/* The opened message. */}
      {phase === "open" && (
        <div
          className="absolute inset-0 z-40 flex flex-col bg-white dark:bg-zinc-950"
          ref={openRef}
        >
          <div className="flex items-center gap-1 px-2 pt-3">
            <button
              className="flex items-center gap-0.5 rounded-lg px-2 py-1.5 text-sm text-zinc-600 outline-none transition-colors duration-150 ease-out hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-300 dark:hover:bg-zinc-900"
              onClick={back}
              ref={(el) => el?.focus({ preventScroll: true })}
              type="button"
            >
              <ChevronLeft className="size-4" />
              {title}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6">
            <p className="font-semibold text-xl tracking-tight">
              {item.subject}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Avatar name={item.from} />
              <div>
                <p className="font-medium text-sm">{item.from}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {item.time}
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm text-zinc-700 leading-relaxed dark:text-zinc-300">
              {item.body}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
