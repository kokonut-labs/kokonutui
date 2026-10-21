"use client";

/**
 * @author: @dorianbaffier
 * @description: Message Thread
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  ArrowUp,
  Heart,
  Laugh,
  type LucideIcon,
  SmilePlus,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import {
  type FormEvent,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const SEND_MS = 380;
const GLIDE_MS = 320;
const LONG_PRESS_MS = 420;
// Messages closer than this from the same person share one group.
const GROUP_GAP_MS = 2 * 60_000;

// Full class names, so Tailwind finds them.
const BAR_ORIGIN: Record<string, string> = {
  "top-left": "origin-top-left",
  "top-right": "origin-top-right",
  "bottom-left": "origin-bottom-left",
  "bottom-right": "origin-bottom-right",
};

export type Reaction = "love" | "like" | "dislike" | "laugh";

const REACTIONS: { id: Reaction; icon: LucideIcon; label: string }[] = [
  { id: "love", icon: Heart, label: "Love" },
  { id: "like", icon: ThumbsUp, label: "Like" },
  { id: "dislike", icon: ThumbsDown, label: "Dislike" },
  { id: "laugh", icon: Laugh, label: "Haha" },
];

export interface ThreadMessage {
  id: string;
  from: "me" | "them";
  text: string;
  /** Milliseconds since epoch. */
  at: number;
  reaction?: Reaction;
}

export interface MessageThreadProps {
  /** Who you're talking to. */
  name?: string;
  status?: string;
  messages?: ThreadMessage[];
  /** Called with the text when you send. Return nothing to keep the demo replies. */
  onSend?: (text: string) => void;
  /** Lines the other side sends back in the demo, in turn. Pass [] to turn replies off. */
  replies?: string[];
  className?: string;
}

// A fixed clock for the starting messages, so server and browser agree.
const T0 = Date.UTC(2026, 9, 21, 9, 38);

const DEFAULT_MESSAGES: ThreadMessage[] = [
  {
    id: "m1",
    from: "them",
    text: "Did the new pricing page go out?",
    at: T0,
  },
  {
    id: "m2",
    from: "them",
    text: "Lucas said it's still behind a flag",
    at: T0 + 20_000,
  },
  {
    id: "m3",
    from: "me",
    text: "Shipping it after lunch",
    at: T0 + 120_000,
    reaction: "like",
  },
  {
    id: "m4",
    from: "me",
    text: "Just fixing the yearly toggle first",
    at: T0 + 150_000,
  },
];

const DEFAULT_REPLIES = [
  "Nice, send me the link when it's live",
  "Perfect, thank you!",
  "Ha, classic",
  "On it",
];

type Receipt = "sending" | "delivered" | "read";

const RECEIPT_TEXT: Record<Receipt, string> = {
  sending: "Sending…",
  delivered: "Delivered",
  read: "Read",
};

const timeOf = (at: number) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(at);

/** Where a message sits in its run: corners tuck in on the sender's side. */
function shapeOf(messages: ThreadMessage[], i: number) {
  const m = messages[i];
  const prev = messages[i - 1];
  const next = messages[i + 1];
  const joinsPrev =
    prev && prev.from === m.from && m.at - prev.at < GROUP_GAP_MS;
  const joinsNext =
    next && next.from === m.from && next.at - m.at < GROUP_GAP_MS;
  return { joinsPrev: Boolean(joinsPrev), joinsNext: Boolean(joinsNext) };
}

// Never earlier than the last message, even when the starting messages carry
// fixed demo times.
const after = (list: ThreadMessage[]) =>
  Math.max(Date.now(), (list.at(-1)?.at ?? 0) + 1000);

let sent = 0;

export default function MessageThread({
  name = "Maya Chen",
  status = "Product design",
  messages: initialMessages = DEFAULT_MESSAGES,
  onSend,
  replies = DEFAULT_REPLIES,
  className,
}: MessageThreadProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [receipt, setReceipt] = useState<Receipt>("read");
  const [typing, setTyping] = useState(false);
  const [picker, setPicker] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const flipRef = useRef<{ id: string; from: DOMRect } | null>(null);
  const timers = useRef(new Set<number>());
  const replyIndex = useRef(0);
  const stuckRef = useRef(true);
  const receiptRef = useRef<number | null>(null);
  const seenRef = useRef(new Set(initialMessages.map((m) => m.id)));

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const id of pending) {
        window.clearTimeout(id);
      }
    };
  }, []);

  // Stay pinned to the newest message unless you scrolled up to read.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the list grows
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && stuckRef.current) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages.length, typing]);

  // The sent text leaves the field and lands as the bubble.
  useLayoutEffect(() => {
    const flip = flipRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const last = messages.at(-1);
    // Replies rise into place; sent messages fly from the field below.
    if (!flip && last?.from === "them" && !seenRef.current.has(last.id)) {
      seenRef.current.add(last.id);
      listRef.current
        ?.querySelector<HTMLElement>(`[data-message="${last.id}"]`)
        ?.animate(
          [
            {
              opacity: 0,
              transform: reduce.matches
                ? "none"
                : "translateY(8px) scale(0.98)",
            },
            { opacity: 1, transform: "none" },
          ],
          { duration: 240, easing: EASE_OUT }
        );
    }
    if (!flip) {
      return;
    }
    flipRef.current = null;
    const bubble = listRef.current?.querySelector<HTMLElement>(
      `[data-message="${flip.id}"]`
    );
    if (!bubble || reduce.matches) {
      return;
    }
    const to = bubble.getBoundingClientRect();
    const dx = flip.from.left - to.left;
    const dy = flip.from.top + flip.from.height / 2 - (to.top + to.height / 2);
    bubble.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
      { duration: SEND_MS, easing: EASE_OUT }
    );
    // The bubble fills in on the way, so it starts as plain text.
    bubble
      .querySelector<HTMLElement>("[data-fill]")
      ?.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: SEND_MS * 0.7,
        easing: EASE_OUT,
      });
  }, [messages]);

  const reply = useCallback(() => {
    if (replies.length === 0) {
      return;
    }
    const text = replies[replyIndex.current % replies.length];
    replyIndex.current++;
    const id = `r${replyIndex.current}`;
    later(() => setReceipt("read"), 900);
    later(() => setTyping(true), 1400);
    later(() => {
      setTyping(false);
      setMessages((list) => [
        ...list,
        { id, from: "them", text, at: after(list) },
      ]);
    }, 2600);
  }, [later, replies]);

  const send = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    const input = inputRef.current;
    if (!(text && input)) {
      return;
    }
    // Measure where the text sits in the field, minus its padding.
    const rect = input.getBoundingClientRect();
    const pad = Number.parseFloat(getComputedStyle(input).paddingLeft);
    sent++;
    const id = `s${sent}`;
    flipRef.current = {
      id,
      from: new DOMRect(
        rect.left + pad - 12,
        rect.top,
        rect.width,
        rect.height
      ),
    };
    stuckRef.current = true;
    setMessages((list) => [...list, { id, from: "me", text, at: after(list) }]);
    setDraft("");
    setReceipt("sending");
    later(() => setReceipt("delivered"), 350);
    onSend?.(text);
    reply();
  };

  const react = (id: string, reaction: Reaction) => {
    setMessages((list) =>
      list.map((m) =>
        m.id === id
          ? { ...m, reaction: m.reaction === reaction ? undefined : reaction }
          : m
      )
    );
    setPicker(null);
  };

  useEffect(() => {
    if (!picker) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPicker(null);
      }
    };
    const onDown = (event: globalThis.PointerEvent) => {
      if (!(event.target as Element | null)?.closest("[data-picker]")) {
        setPicker(null);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [picker]);

  let lastMine: string | undefined;
  for (const m of messages) {
    if (m.from === "me") {
      lastMine = m.id;
    }
  }

  return (
    <div
      className={cn(
        "flex h-[30rem] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10",
        className
      )}
    >
      <header className="flex items-center gap-3 border-black/5 border-b px-4 py-3 dark:border-white/10">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-rose-500 font-semibold text-[11px] text-white">
          {name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-sm text-zinc-900 dark:text-zinc-100">
            {name}
          </p>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {typing ? "Typing…" : status}
          </p>
        </div>
      </header>

      <div
        aria-live="polite"
        className="relative flex flex-1 flex-col overflow-y-auto overscroll-contain px-3 pt-4 pb-2"
        onScroll={(event) => {
          const el = event.currentTarget;
          stuckRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
        ref={listRef}
        role="log"
      >
        <p className="mb-3 text-center text-[11px] text-zinc-400 dark:text-zinc-500">
          Today {timeOf(messages[0]?.at ?? T0)}
        </p>
        {messages.map((message, i) => {
          const shape = shapeOf(messages, i);
          return (
            <Bubble
              joinsNext={shape.joinsNext}
              joinsPrev={shape.joinsPrev}
              key={message.id}
              message={message}
              onPick={(reaction) => react(message.id, reaction)}
              onPicker={(open) => setPicker(open ? message.id : null)}
              picking={picker === message.id}
              receipt={message.id === lastMine ? receipt : null}
              receiptMemory={receiptRef}
            />
          );
        })}
        {typing && <TypingDots />}
      </div>

      <form
        className="flex items-center gap-2 border-black/5 border-t p-2.5 dark:border-white/10"
        onSubmit={send}
      >
        <input
          aria-label={`Message ${name}`}
          className="h-9 min-w-0 flex-1 rounded-full bg-zinc-100 px-4 text-sm text-zinc-900 outline-hidden ring-1 ring-transparent transition-shadow duration-150 placeholder:text-zinc-400 focus:ring-zinc-300 dark:bg-white/5 dark:text-zinc-100 dark:focus:ring-white/15"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message"
          ref={inputRef}
          value={draft}
        />
        <button
          aria-label="Send"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white outline-hidden transition-[opacity,scale] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-zinc-400/60 focus-visible:ring-offset-1 dark:bg-white dark:text-zinc-900 dark:focus-visible:ring-offset-zinc-900",
            draft.trim() ? "scale-100 opacity-100" : "scale-90 opacity-0"
          )}
          disabled={!draft.trim()}
          type="submit"
        >
          <ArrowUp aria-hidden="true" className="size-4" strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );
}

interface BubbleProps {
  message: ThreadMessage;
  joinsPrev: boolean;
  joinsNext: boolean;
  receipt: Receipt | null;
  receiptMemory: RefObject<number | null>;
  picking: boolean;
  onPicker: (open: boolean) => void;
  onPick: (reaction: Reaction) => void;
}

function Bubble({
  message,
  joinsPrev,
  joinsNext,
  receipt,
  receiptMemory,
  picking,
  onPicker,
  onPick,
}: BubbleProps) {
  const mine = message.from === "me";
  const pressRef = useRef<number | null>(null);
  const Reacted = REACTIONS.find((r) => r.id === message.reaction)?.icon;

  const cancelPress = () => {
    if (pressRef.current) {
      window.clearTimeout(pressRef.current);
      pressRef.current = null;
    }
  };

  // Touch has no double-click, so a long press opens the reactions.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") {
      return;
    }
    cancelPress();
    pressRef.current = window.setTimeout(() => onPicker(true), LONG_PRESS_MS);
  };

  useEffect(
    () => () => {
      if (pressRef.current) {
        window.clearTimeout(pressRef.current);
      }
    },
    []
  );

  // Big corners outside a run; the sender's side tucks in where bubbles meet.
  const corners = mine
    ? cn(
        "rounded-[18px]",
        joinsPrev && "rounded-tr-[5px]",
        joinsNext && "rounded-br-[5px]"
      )
    : cn(
        "rounded-[18px]",
        joinsPrev && "rounded-tl-[5px]",
        joinsNext && "rounded-bl-[5px]"
      );

  return (
    <div
      className={cn(
        "group/msg flex flex-col",
        mine ? "items-end" : "items-start",
        joinsPrev ? "mt-0.5" : "mt-3 first-of-type:mt-0",
        message.reaction && !joinsPrev && "mt-5"
      )}
    >
      <div
        className={cn(
          "relative flex max-w-[78%] items-center gap-1.5",
          mine ? "flex-row-reverse" : "flex-row",
          message.reaction && "mt-2"
        )}
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/noNoninteractiveElementInteractions: double-click and long-press are shortcuts; the React button is the accessible way in */}
        <div
          className="relative select-none [-webkit-touch-callout:none]"
          data-message={message.id}
          onContextMenu={(event) => {
            if (pressRef.current === null && picking) {
              event.preventDefault();
            }
          }}
          onDoubleClick={() => onPicker(true)}
          onPointerCancel={cancelPress}
          onPointerDown={onPointerDown}
          onPointerLeave={cancelPress}
          onPointerUp={cancelPress}
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-0 transition-[border-radius] duration-200",
              corners,
              mine
                ? "bg-zinc-900 dark:bg-zinc-100"
                : "bg-zinc-100 dark:bg-white/10"
            )}
            data-fill
          />
          <p
            className={cn(
              "relative px-3.5 py-2 text-[14px] leading-snug [overflow-wrap:anywhere]",
              mine
                ? "text-white dark:text-zinc-900"
                : "text-zinc-900 dark:text-zinc-100"
            )}
          >
            {message.text}
          </p>
          {Reacted && (
            <button
              aria-label={`Remove ${message.reaction} reaction`}
              className={cn(
                "absolute -top-3.5 flex size-6 starting:scale-75 items-center justify-center rounded-full bg-white text-rose-500 starting:opacity-0 shadow-[0_1px_3px_rgb(0_0_0/0.15)] ring-1 ring-black/5 transition-[opacity,scale] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] dark:bg-zinc-800 dark:ring-white/10",
                mine ? "-left-3" : "-right-3"
              )}
              data-picker
              onClick={() => message.reaction && onPick(message.reaction)}
              type="button"
            >
              <Reacted
                aria-hidden="true"
                className="size-3.5"
                fill={message.reaction === "love" ? "currentColor" : "none"}
              />
            </button>
          )}
          {picking && (
            <ReactionBar
              current={message.reaction}
              mine={mine}
              onPick={onPick}
            />
          )}
        </div>
        <button
          aria-label="React"
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-zinc-400 opacity-0 outline-hidden transition-[opacity,color] duration-150 hover:text-zinc-700 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-zinc-400/50 group-hover/msg:opacity-100 dark:hover:text-zinc-200"
          data-picker
          onClick={() => onPicker(!picking)}
          type="button"
        >
          <SmilePlus aria-hidden="true" className="size-4" />
        </button>
      </div>
      {receipt && <ReceiptLine memory={receiptMemory} receipt={receipt} />}
    </div>
  );
}

function ReactionBar({
  mine,
  current,
  onPick,
}: {
  mine: boolean;
  current?: Reaction;
  onPick: (reaction: Reaction) => void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [below, setBelow] = useState(false);

  // Above the bubble, unless that's cut off by the top of the thread.
  useLayoutEffect(() => {
    const bar = barRef.current;
    const log = bar?.closest("[role=log]");
    if (bar && log) {
      setBelow(
        bar.getBoundingClientRect().top < log.getBoundingClientRect().top
      );
    }
    first.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div
      aria-label="Reactions"
      className={cn(
        "absolute z-10 flex starting:scale-90 gap-0.5 rounded-full bg-white p-1 starting:opacity-0 shadow-[0_6px_20px_-6px_rgb(0_0_0/0.3)] ring-1 ring-black/5 transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] dark:bg-zinc-800 dark:ring-white/10",
        below ? "top-full mt-2" : "bottom-full mb-2",
        mine ? "right-0" : "left-0",
        BAR_ORIGIN[`${below ? "top" : "bottom"}-${mine ? "right" : "left"}`]
      )}
      data-picker
      ref={barRef}
      role="toolbar"
    >
      {REACTIONS.map(({ id, icon: Icon, label }, i) => (
        <button
          aria-label={label}
          aria-pressed={current === id}
          className={cn(
            "flex size-8 items-center justify-center rounded-full outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-rose-500/50",
            current === id
              ? "bg-rose-500 text-white"
              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
          )}
          key={id}
          onClick={() => onPick(id)}
          ref={i === 0 ? first : undefined}
          type="button"
        >
          <Icon
            aria-hidden="true"
            className="size-4"
            fill={id === "love" && current === id ? "currentColor" : "none"}
          />
        </button>
      ))}
    </div>
  );
}

// The receipt is one line that moves to whichever message is newest, so it
// glides there instead of vanishing under one bubble and popping up under the
// next. Offsets are within the scrolling list, so scrolling doesn't skew them.
function ReceiptLine({
  receipt,
  memory,
}: {
  receipt: Receipt;
  memory: RefObject<number | null>;
}) {
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const to = el.offsetTop;
    const from = memory.current;
    memory.current = to;
    if (
      from === null ||
      from === to ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    el.animate(
      [
        { transform: `translateY(${from - to}px)`, opacity: 0.4 },
        { transform: "none", opacity: 1 },
      ],
      { duration: GLIDE_MS, easing: EASE_OUT }
    );
  }, [memory]);

  return (
    <p
      className="mt-1 mr-1 text-[11px] text-zinc-400 tabular-nums dark:text-zinc-500"
      ref={ref}
    >
      {RECEIPT_TEXT[receipt]}
    </p>
  );
}

function TypingDots() {
  return (
    <div className="mt-3 flex starting:translate-y-1.5 items-start starting:opacity-0 transition-[opacity,translate] duration-200 ease-out motion-reduce:starting:translate-y-0">
      <output
        aria-label="Typing"
        className="flex h-9 items-center gap-1 rounded-[18px] bg-zinc-100 px-3.5 dark:bg-white/10"
      >
        {[0, 1, 2].map((dot) => (
          <span
            className="size-1.5 animate-[typing-dot_1.2s_ease-in-out_infinite] rounded-full bg-zinc-400 motion-reduce:animate-none dark:bg-zinc-500"
            key={dot}
            style={{ animationDelay: `${dot * 160}ms` }}
          />
        ))}
      </output>
      <style>
        {
          "@keyframes typing-dot{0%,60%,100%{opacity:.35;transform:none}30%{opacity:1;transform:translateY(-2px)}}"
        }
      </style>
    </div>
  );
}
