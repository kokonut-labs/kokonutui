"use client";

/**
 * @author: @dorianbaffier
 * @description: Comment Pins
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ArrowUp, Check, MessageSquarePlus } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  type CSSProperties,
  type PointerEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const POPOVER_W = 272;
const DRAG_SLOP = 4;
const PREVIEW_DELAY = 250;
// From the pin's point to the popover's near edge: the pin is 28px wide.
const PIN_GAP = 36;
/** Thread card header plus reply row, around the scrolling list. */
const CARD_CHROME = 92;

export interface PinAuthor {
  name: string;
  /** Tailwind classes for the avatar, such as "bg-rose-500". */
  color?: string;
}

export interface PinComment {
  id: string;
  author: PinAuthor;
  text: string;
  /** Shown as written, such as "2h" or "Yesterday". */
  time: string;
}

export interface PinThread {
  id: string;
  /** Position on the canvas, 0 to 1 from the left. */
  x: number;
  /** Position on the canvas, 0 to 1 from the top. */
  y: number;
  comments: PinComment[];
  resolved?: boolean;
}

export interface CommentPinsProps {
  threads?: PinThread[];
  /** Who new comments are from. */
  me?: PinAuthor;
  /** What gets reviewed. Defaults to a small landing page mockup. */
  children?: ReactNode;
  title?: string;
  onChange?: (threads: PinThread[]) => void;
  className?: string;
}

const MAYA: PinAuthor = { name: "Maya Chen", color: "bg-rose-500" };
const LUCAS: PinAuthor = { name: "Lucas Moreau", color: "bg-teal-600" };
const PRIYA: PinAuthor = { name: "Priya Nair", color: "bg-orange-500" };
const YOU: PinAuthor = {
  name: "You",
  color: "bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900",
};

const DEFAULT_THREADS: PinThread[] = [
  {
    id: "headline",
    x: 0.37,
    y: 0.28,
    comments: [
      {
        id: "a",
        author: MAYA,
        text: "Can we tighten the tracking here? It reads loose at this size.",
        time: "2h",
      },
      {
        id: "b",
        author: LUCAS,
        text: "Agreed, -2% should do it.",
        time: "1h",
      },
    ],
  },
  {
    id: "cta",
    x: 0.15,
    y: 0.56,
    comments: [
      {
        id: "c",
        author: LUCAS,
        text: "Primary button should say what happens: “Start free trial”.",
        time: "45m",
      },
    ],
  },
  {
    id: "shot",
    x: 0.77,
    y: 0.47,
    comments: [
      {
        id: "d",
        author: PRIYA,
        text: "Swap for the new dashboard shot once it's final.",
        time: "Yesterday",
      },
    ],
    resolved: true,
  },
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function Avatar({ author, size = 6 }: { author: PinAuthor; size?: 5 | 6 }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        size === 6 ? "size-6 text-[10px]" : "size-5 text-[9px]",
        author.color ?? "bg-zinc-500"
      )}
    >
      {initials(author.name)}
    </span>
  );
}

/** A stand-in page to review: a landing page drawn in boxes. */
function Mockup() {
  return (
    <div className="@container absolute inset-0 bg-white leading-tight dark:bg-zinc-950">
      <div className="flex h-full flex-col p-[4cqw]">
        <div className="flex items-center gap-[1.5cqw]">
          <span className="size-[3cqw] rounded-[0.8cqw] bg-zinc-900 dark:bg-zinc-100" />
          <span className="font-semibold text-[2.2cqw] text-zinc-900 dark:text-zinc-100">
            Northwind
          </span>
          <span className="ml-auto flex gap-[2.5cqw] text-[1.6cqw] text-zinc-500">
            <span>Product</span>
            <span>Pricing</span>
            <span>Docs</span>
          </span>
          <span className="rounded-full bg-zinc-900 px-[1.8cqw] py-[0.7cqw] text-[1.5cqw] text-white dark:bg-zinc-100 dark:text-zinc-900">
            Sign in
          </span>
        </div>
        <div className="mt-[6cqw] grid flex-1 grid-cols-[1fr_1fr] gap-[4cqw]">
          <div className="flex flex-col">
            <span className="text-[1.5cqw] text-zinc-500">
              Planning, simplified
            </span>
            <span className="mt-[1cqw] font-semibold text-[5cqw] text-zinc-900 leading-[1.05] tracking-tight dark:text-zinc-100">
              Plan the week in one place
            </span>
            <span className="mt-[2cqw] text-[1.7cqw] text-zinc-500 leading-snug">
              Tasks, calendar and notes, synced for the whole team.
            </span>
            <span className="mt-[3cqw] flex gap-[1.2cqw]">
              <span className="rounded-[1cqw] bg-zinc-900 px-[2cqw] py-[1cqw] text-[1.6cqw] text-white dark:bg-zinc-100 dark:text-zinc-900">
                Get started
              </span>
              <span className="rounded-[1cqw] px-[2cqw] py-[1cqw] text-[1.6cqw] text-zinc-700 ring-1 ring-black/10 dark:text-zinc-300 dark:ring-white/15">
                See a demo
              </span>
            </span>
          </div>
          <div className="flex flex-col gap-[1.2cqw] rounded-[1.6cqw] bg-zinc-100 p-[2cqw] dark:bg-zinc-900">
            <span className="h-[2cqw] w-1/3 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <div className="flex flex-1 items-end gap-[1.2cqw]">
              {[48, 72, 56, 88, 64, 96, 76].map((h) => (
                <span
                  className="flex-1 rounded-[0.6cqw] bg-zinc-300 dark:bg-zinc-700"
                  key={h}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <span className="h-[1.6cqw] w-2/3 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface Drag {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
}

let made = 0;

export default function CommentPins({
  threads: initialThreads = DEFAULT_THREADS,
  me = YOU,
  children,
  title = "Homepage, v3",
  onChange,
  className,
}: CommentPinsProps) {
  const [threads, setThreads] = useState(initialThreads);
  const [openId, setOpenId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [commenting, setCommenting] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const previewTimer = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const update = useCallback((fn: (list: PinThread[]) => PinThread[]) => {
    setThreads((list) => {
      const next = fn(list);
      onChangeRef.current?.(next.filter((t) => t.comments.length > 0));
      return next;
    });
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const observer = new ResizeObserver(() =>
      setSize({ w: canvas.clientWidth, h: canvas.clientHeight })
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // A pin dropped and left without a comment goes away.
  const close = useCallback(() => {
    setOpenId(null);
    setThreads((list) => list.filter((t) => t.comments.length > 0));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA";
      if (event.key === "Escape") {
        if (openId) {
          close();
        } else {
          setCommenting(false);
        }
      } else if (
        !typing &&
        event.key.toLowerCase() === "c" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        canvasRef.current?.closest("section")?.matches(":hover, :focus-within")
      ) {
        setCommenting((on) => !on);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, close]);

  useEffect(
    () => () => {
      if (previewTimer.current) {
        window.clearTimeout(previewTimer.current);
      }
    },
    []
  );

  const pointOf = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  };

  const onCanvasClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (openId) {
      close();
      return;
    }
    if (!commenting) {
      return;
    }
    made++;
    const thread: PinThread = {
      id: `new-${made}`,
      ...pointOf(event.clientX, event.clientY),
      comments: [],
    };
    setThreads((list) => [...list, thread]);
    setOpenId(thread.id);
    setCommenting(false);
    setGhost(null);
  };

  const onPinPointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    id: string
  ) => {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  };

  const onPinPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    if (
      !drag.moved &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <
        DRAG_SLOP
    ) {
      return;
    }
    drag.moved = true;
    setPreviewId(null);
    const point = pointOf(event.clientX, event.clientY);
    setThreads((list) =>
      list.map((t) => (t.id === drag.id ? { ...t, ...point } : t))
    );
  };

  const onPinPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    if (drag.moved) {
      update((list) => list);
      return;
    }
    setPreviewId(null);
    if (openId === drag.id) {
      close();
    } else {
      setThreads((list) => list.filter((t) => t.comments.length > 0));
      setOpenId(drag.id);
    }
  };

  const showPreview = (id: string) => {
    if (previewTimer.current) {
      window.clearTimeout(previewTimer.current);
    }
    // The first preview waits a beat; moving straight to another pin doesn't.
    if (previewId) {
      setPreviewId(id);
      return;
    }
    previewTimer.current = window.setTimeout(
      () => setPreviewId(id),
      PREVIEW_DELAY
    );
  };

  const hidePreview = () => {
    if (previewTimer.current) {
      window.clearTimeout(previewTimer.current);
    }
    setPreviewId(null);
  };

  const post = (id: string, text: string) => {
    update((list) =>
      list.map((t) =>
        t.id === id
          ? {
              ...t,
              comments: [
                ...t.comments,
                {
                  id: `${id}-${t.comments.length}`,
                  author: me,
                  text,
                  time: "now",
                },
              ],
            }
          : t
      )
    );
  };

  const resolve = (id: string, resolved: boolean) => {
    update((list) => list.map((t) => (t.id === id ? { ...t, resolved } : t)));
    if (resolved) {
      setOpenId(null);
    }
  };

  const visible = threads.filter((t) => showResolved || !t.resolved);
  const openCount = threads.filter(
    (t) => !t.resolved && t.comments.length > 0
  ).length;
  const resolvedCount = threads.filter((t) => t.resolved).length;
  const openThread = threads.find((t) => t.id === openId) ?? null;
  const previewThread =
    previewId && previewId !== openId
      ? (threads.find((t) => t.id === previewId) ?? null)
      : null;

  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.18, ease: EASE_OUT }}
    >
      <section
        aria-label="Design review"
        className={cn(
          "@container w-full max-w-2xl rounded-2xl bg-black/5 p-1.5 dark:bg-white/5",
          className
        )}
      >
        <header className="flex items-center gap-2 px-2 pt-0.5 pb-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium text-sm text-zinc-900 dark:text-zinc-100">
              {title}
            </h3>
            <p className="truncate text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
              {openCount} open
              {resolvedCount > 0 && ` · ${resolvedCount} resolved`}
            </p>
          </div>
          {resolvedCount > 0 && (
            <button
              aria-pressed={showResolved}
              className={cn(
                "h-8 rounded-lg px-2.5 text-xs outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-rose-500/50",
                showResolved
                  ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.06)] ring-1 ring-black/5 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/10"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              )}
              onClick={() => setShowResolved((on) => !on)}
              type="button"
            >
              <span className="@md:hidden">Resolved</span>
              <span className="@md:inline hidden">Show resolved</span>
            </button>
          )}
          <button
            aria-pressed={commenting}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-medium text-xs outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-rose-500/50",
              commenting
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "bg-white text-zinc-700 shadow-[0_1px_2px_rgb(0_0_0/0.06)] ring-1 ring-black/5 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-white/10 dark:hover:text-white"
            )}
            onClick={() => setCommenting((on) => !on)}
            type="button"
          >
            <MessageSquarePlus aria-hidden="true" className="size-3.5" />
            Comment
            <kbd
              className={cn(
                "font-sans text-[10px] leading-none",
                commenting ? "opacity-60" : "text-zinc-400"
              )}
            >
              C
            </kbd>
          </button>
        </header>

        <div className="relative">
          {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents lint/a11y/noNoninteractiveElementInteractions: pins are placed with the pointer; C and Escape work from the keyboard, and each pin is a button */}
          <div
            className={cn(
              "relative aspect-[16/10] w-full overflow-hidden rounded-xl ring-1 ring-black/5 dark:ring-white/10",
              commenting ? "cursor-none" : "cursor-default"
            )}
            onClick={onCanvasClick}
            onPointerLeave={() => setGhost(null)}
            onPointerMove={(event) => {
              if (commenting && event.pointerType === "mouse") {
                setGhost(pointOf(event.clientX, event.clientY));
              }
            }}
            ref={canvasRef}
          >
            {children ?? <Mockup />}
            {/* A faint wash says the canvas takes clicks now. */}
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-0 bg-rose-500/[0.04] ring-2 ring-rose-500/40 ring-inset transition-opacity duration-150",
                commenting ? "opacity-100" : "opacity-0"
              )}
            />
          </div>

          {/* Pins and popovers sit above the canvas so they can overflow it. */}
          <div className="pointer-events-none absolute inset-0">
            {ghost && commenting && (
              <span
                aria-hidden="true"
                className="absolute flex size-7 -translate-y-full items-center justify-center rounded-full rounded-bl-[5px] bg-rose-500 text-white opacity-90 shadow-[0_2px_6px_rgb(0_0_0/0.18)] ring-2 ring-white dark:ring-zinc-900"
                style={{ left: `${ghost.x * 100}%`, top: `${ghost.y * 100}%` }}
              >
                <MessageSquarePlus className="size-3.5" />
              </span>
            )}

            <AnimatePresence>
              {visible.map((thread) => (
                <Pin
                  active={thread.id === openId}
                  key={thread.id}
                  onBlur={hidePreview}
                  onFocus={() => showPreview(thread.id)}
                  onKeyOpen={() =>
                    thread.id === openId ? close() : setOpenId(thread.id)
                  }
                  onPointerDown={(event) => onPinPointerDown(event, thread.id)}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse" && !dragRef.current) {
                      showPreview(thread.id);
                    }
                  }}
                  onPointerLeave={hidePreview}
                  onPointerMove={onPinPointerMove}
                  onPointerUp={onPinPointerUp}
                  thread={thread}
                />
              ))}
            </AnimatePresence>

            <AnimatePresence>
              {previewThread && !openThread && (
                <Popover
                  key={`p-${previewThread.id}`}
                  size={size}
                  thread={previewThread}
                >
                  <Preview thread={previewThread} />
                </Popover>
              )}
              {openThread && (
                <Popover key={openThread.id} size={size} thread={openThread}>
                  <ThreadCard
                    me={me}
                    onClose={close}
                    onPost={(text) => post(openThread.id, text)}
                    onResolve={(resolved) => resolve(openThread.id, resolved)}
                    thread={openThread}
                  />
                </Popover>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}

interface PinProps {
  thread: PinThread;
  active: boolean;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerEnter: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyOpen: () => void;
}

function Pin({
  thread,
  active,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  onKeyOpen,
}: PinProps) {
  const first = thread.comments[0];
  const replies = thread.comments.length - 1;
  const label = first
    ? `Comment from ${first.author.name}${replies > 0 ? `, ${replies} ${replies === 1 ? "reply" : "replies"}` : ""}${thread.resolved ? ", resolved" : ""}`
    : "New comment";

  return (
    // The pin's tail is its bottom-left corner, which sits on the point.
    <motion.button
      animate={{ opacity: 1, transform: "translateY(-100%)" }}
      aria-expanded={active}
      aria-label={label}
      className={cn(
        "pointer-events-auto absolute touch-none outline-hidden",
        active ? "z-20" : "z-10"
      )}
      exit={{ opacity: 0, transform: "translateY(-100%)" }}
      initial={{ opacity: 0, transform: "translateY(calc(-100% - 10px))" }}
      onBlur={onBlur}
      onClick={(event) => {
        // Pointer presses are handled on release; this is Enter and Space.
        if (event.detail === 0) {
          onKeyOpen();
        }
      }}
      onFocus={onFocus}
      onPointerCancel={onPointerUp}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ left: `${thread.x * 100}%`, top: `${thread.y * 100}%` }}
      type="button"
    >
      <span
        className={cn(
          "group/pin relative flex items-center justify-center rounded-full rounded-bl-[5px] shadow-[0_2px_6px_rgb(0_0_0/0.18)] ring-2 ring-white transition-[width,height,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] dark:ring-zinc-900",
          thread.resolved
            ? "size-5 bg-zinc-400 text-white dark:bg-zinc-600"
            : "size-7 text-white",
          !thread.resolved && (first?.author.color ?? "bg-rose-500"),
          active && "ring-rose-500/70 dark:ring-rose-400/70",
          "[button:focus-visible_&]:ring-rose-500"
        )}
      >
        {thread.resolved && <Check className="size-3" strokeWidth={3} />}
        {!thread.resolved && first && (
          <span className="font-semibold text-[10px]">
            {initials(first.author.name)}
          </span>
        )}
        {!(thread.resolved || first) && (
          <MessageSquarePlus className="size-3.5" />
        )}
        {!thread.resolved && replies > 0 && (
          <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-white font-semibold text-[8px] text-zinc-900 tabular-nums ring-1 ring-black/10 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-white/15">
            {replies + 1}
          </span>
        )}
      </span>
    </motion.button>
  );
}

/**
 * Beside the pin when there's room, else under it (or over it, low on the
 * canvas), so the popover never covers the pin it belongs to.
 */
type Edge = { top: number } | { bottom: number };

function placePopover(
  thread: PinThread,
  size: { w: number; h: number }
): { left: number; width: number; origin: string; vertical: Edge } {
  const px = thread.x * size.w;
  const py = thread.y * size.h;
  const width = Math.min(POPOVER_W, size.w - 8);
  const low = thread.y > 0.55;
  const beside: Edge = low
    ? { bottom: Math.max(4, size.h - py) }
    : { top: Math.max(4, py - 34) };
  if (px + PIN_GAP + width <= size.w) {
    return {
      left: px + PIN_GAP,
      width,
      origin: `left ${low ? "bottom" : "top"}`,
      vertical: beside,
    };
  }
  if (px - 10 - width >= 4) {
    return {
      left: px - 10 - width,
      width,
      origin: `right ${low ? "bottom" : "top"}`,
      vertical: beside,
    };
  }
  const left = Math.min(Math.max(4, px - 24), size.w - width - 4);
  return {
    left,
    width,
    origin: `${px - left}px ${low ? "bottom" : "top"}`,
    vertical: low ? { bottom: size.h - py + 40 } : { top: py + 8 },
  };
}

/** Height left for the comment list so the card stays on the canvas. */
function listRoom(vertical: Edge, size: { w: number; h: number }) {
  const edge = "top" in vertical ? vertical.top : vertical.bottom;
  return Math.max(56, Math.min(224, size.h - edge - 4 - CARD_CHROME));
}

function Popover({
  thread,
  size,
  children,
}: {
  thread: PinThread;
  size: { w: number; h: number };
  children: ReactNode;
}) {
  const { left, width, vertical, origin } = placePopover(thread, size);
  const style: CSSProperties & { "--list-room": string } = {
    left,
    width,
    transformOrigin: origin,
    "--list-room": `${listRoom(vertical, size)}px`,
    ...vertical,
  };
  return (
    <motion.div
      animate={{ opacity: 1, transform: "scale(1)" }}
      className="pointer-events-auto absolute z-30"
      exit={{
        opacity: 0,
        transform: "scale(0.97)",
        transition: { duration: 0.12 },
      }}
      initial={{ opacity: 0, transform: "scale(0.96)" }}
      onClick={(event) => event.stopPropagation()}
      style={style}
    >
      {children}
    </motion.div>
  );
}

function Preview({ thread }: { thread: PinThread }) {
  const first = thread.comments[0];
  if (!first) {
    return null;
  }
  return (
    <div className="rounded-xl bg-white p-3 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.25)] ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
      <div className="flex items-center gap-2">
        <Avatar author={first.author} size={5} />
        <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100">
          {first.author.name}
        </span>
        <span className="text-[11px] text-zinc-400">{first.time}</span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[13px] text-zinc-600 leading-snug dark:text-zinc-300">
        {first.text}
      </p>
      {thread.comments.length > 1 && (
        <p className="mt-1.5 text-[11px] text-zinc-400">
          {thread.comments.length - 1}{" "}
          {thread.comments.length === 2 ? "reply" : "replies"}
        </p>
      )}
    </div>
  );
}

function ThreadCard({
  thread,
  me,
  onPost,
  onResolve,
  onClose,
}: {
  thread: PinThread;
  me: PinAuthor;
  onPost: (text: string) => void;
  onResolve: (resolved: boolean) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isNew = thread.comments.length === 0;

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const send = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    onPost(text);
    setDraft("");
    if (inputRef.current) {
      inputRef.current.style.height = "";
    }
  };

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-[0_8px_24px_-8px_rgb(0_0_0/0.25)] ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
      {!isNew && (
        <div className="flex items-center gap-2 border-black/5 border-b px-3 py-2 dark:border-white/10">
          <span className="flex-1 font-medium text-xs text-zinc-500 dark:text-zinc-400">
            {thread.resolved ? "Resolved" : "Thread"}
          </span>
          <button
            aria-label={thread.resolved ? "Reopen" : "Resolve"}
            className={cn(
              "flex h-6 items-center gap-1 rounded-md px-1.5 text-xs outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-rose-500/50",
              thread.resolved
                ? "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
            )}
            onClick={() => onResolve(!thread.resolved)}
            type="button"
          >
            <Check aria-hidden="true" className="size-3.5" />
            {thread.resolved ? "Reopen" : "Resolve"}
          </button>
        </div>
      )}
      {!isNew && (
        <ol className="max-h-(--list-room) overflow-y-auto overscroll-contain">
          {thread.comments.map((comment) => (
            <li className="flex gap-2.5 px-3 pt-3" key={comment.id}>
              <Avatar author={comment.author} />
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2">
                  <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100">
                    {comment.author.name}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {comment.time}
                  </span>
                </p>
                <p className="mt-0.5 text-[13px] text-zinc-700 leading-snug [overflow-wrap:anywhere] dark:text-zinc-300">
                  {comment.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <form
        className="flex items-end gap-2 p-2"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        {isNew && <Avatar author={me} />}
        <textarea
          aria-label={isNew ? "Add a comment" : "Reply"}
          className="max-h-24 min-h-8 flex-1 resize-none rounded-lg bg-zinc-50 px-2.5 py-1.5 text-[13px] text-zinc-900 leading-5 outline-hidden ring-1 ring-black/5 placeholder:text-zinc-400 focus:ring-rose-500/40 dark:bg-white/5 dark:text-zinc-100 dark:ring-white/10"
          onChange={(event) => {
            setDraft(event.target.value);
            // Grow with the text, up to the max height.
            const el = event.currentTarget;
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }
          }}
          placeholder={isNew ? "Add a comment" : "Reply"}
          ref={inputRef}
          rows={1}
          value={draft}
        />
        <button
          aria-label="Post"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-rose-500 text-white outline-hidden transition-[background-color,opacity] duration-150 hover:bg-rose-600 focus-visible:ring-2 focus-visible:ring-rose-500/50 focus-visible:ring-offset-1 disabled:opacity-40 dark:focus-visible:ring-offset-zinc-900"
          disabled={!draft.trim()}
          type="submit"
        >
          <ArrowUp aria-hidden="true" className="size-4" />
        </button>
      </form>
    </div>
  );
}
