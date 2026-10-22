"use client";

/**
 * @author: @dorianbaffier
 * @description: Amount Pad
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ArrowUp, Check, Delete } from "lucide-react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const MAX_WHOLE_DIGITS = 7;
const DIGIT = /^\d$/;
const KEY_LABELS: Record<string, string> = {
  back: "Delete",
  ".": "Decimal point",
};
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];

export interface AmountPadProps {
  /** Who the money goes to. */
  recipient?: { name: string; handle?: string };
  /** Currency sign drawn before the amount. */
  currency?: string;
  /** Largest amount allowed in one go. */
  max?: number;
  /** Shown under the amount until you hit the cap. */
  balance?: number;
  /** One-tap amounts. */
  presets?: number[];
  onSend?: (amount: number) => void;
  className?: string;
}

/** One typed character, with an id that follows it as commas move around. */
interface Char {
  id: number;
  char: string;
}

interface Glyph {
  key: string;
  char: string;
  kind: "digit" | "sep" | "ghost";
}

const toNumber = (chars: Char[]) =>
  Number.parseFloat(chars.map((c) => c.char).join("") || "0");

const money = (value: number, currency: string) =>
  `${currency}${value.toLocaleString("en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

/** What typing `key` does to the amount: the new characters, or null if it can't take it. */
function typeKey(
  chars: Char[],
  key: string,
  make: (char: string) => Char
): Char[] | null {
  const point = chars.findIndex((c) => c.char === ".");
  if (key === ".") {
    if (point !== -1) {
      return null;
    }
    return chars.length === 0 ? [make("0"), make(".")] : [...chars, make(".")];
  }
  const centsFull = point !== -1 && chars.length - point > 2;
  const wholeFull = point === -1 && chars.length >= MAX_WHOLE_DIGITS;
  if (centsFull || wholeFull) {
    return null;
  }
  // A lone leading zero is replaced, not followed.
  return chars.length === 1 && chars[0].char === "0"
    ? [make(key)]
    : [...chars, make(key)];
}

/**
 * Lays typed characters out as an amount: commas every three whole digits,
 * keyed by the digit they sit in front of, and faint zeros after the point
 * for the cents still to come.
 */
function layout(chars: Char[]): Glyph[] {
  const point = chars.findIndex((c) => c.char === ".");
  const whole = point === -1 ? chars : chars.slice(0, point);
  const glyphs: Glyph[] = [];

  whole.forEach((c, index) => {
    const fromRight = whole.length - index;
    if (index > 0 && fromRight % 3 === 0) {
      glyphs.push({ key: `comma-${c.id}`, char: ",", kind: "sep" });
    }
    glyphs.push({ key: `d-${c.id}`, char: c.char, kind: "digit" });
  });

  if (point !== -1) {
    const cents = chars.slice(point + 1);
    glyphs.push({ key: `d-${chars[point].id}`, char: ".", kind: "sep" });
    for (const c of cents) {
      glyphs.push({ key: `d-${c.id}`, char: c.char, kind: "digit" });
    }
    for (let i = cents.length; i < 2; i++) {
      glyphs.push({ key: `ghost-${i}`, char: "0", kind: "ghost" });
    }
  }
  return glyphs;
}

export default function AmountPad({
  recipient = { name: "Maya Chen", handle: "@maya" },
  currency = "$",
  max = 2500,
  balance = 3204.18,
  presets = [20, 50, 100],
  onSend,
  className,
}: AmountPadProps) {
  const [chars, setChars] = useState<Char[]>([]);
  const [capped, setCapped] = useState(false);
  const [sent, setSent] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();

  const nextId = useRef(1);
  const frameRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLDivElement>(null);
  const capTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sentTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fit = useMotionValue(1);
  const shakeX = useMotionValue(0);

  const value = toNumber(chars);
  const empty = chars.length === 0;

  useEffect(
    () => () => {
      clearTimeout(capTimer.current);
      clearTimeout(sentTimer.current);
    },
    []
  );

  // The amount shrinks to stay on one line as it grows, and grows back as
  // digits are deleted.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const amount = amountRef.current;
    if (!(frame && amount)) {
      return;
    }
    const measure = () => {
      const target = Math.min(1, frame.clientWidth / amount.scrollWidth);
      animate(
        fit,
        target,
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 380, damping: 34 }
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(amount);
    return () => observer.disconnect();
  }, [fit, reduceMotion]);

  const refuse = useCallback(
    (showCap: boolean) => {
      if (showCap) {
        setCapped(true);
        clearTimeout(capTimer.current);
        capTimer.current = setTimeout(() => setCapped(false), 1800);
      }
      if (!reduceMotion) {
        animate(shakeX, [0, -10, 9, -6, 4, 0], {
          duration: 0.36,
          ease: "easeOut",
        });
      }
    },
    [reduceMotion, shakeX]
  );

  const make = (char: string): Char => {
    const id = nextId.current;
    nextId.current += 1;
    return { id, char };
  };

  // Touching the pad after a send keeps what you type: the pending reset
  // would otherwise wipe it.
  const clearSent = () => {
    clearTimeout(sentTimer.current);
    setSent(null);
  };

  const press = (key: string) => {
    clearSent();
    if (key === "back") {
      setChars((current) => current.slice(0, -1));
      setCapped(false);
      return;
    }

    const next = typeKey(chars, key, make);
    if (!next) {
      refuse(false);
    } else if (toNumber(next) > max) {
      refuse(true);
    } else {
      setChars(next);
    }
  };

  const preset = (amount: number) => {
    clearSent();
    setCapped(false);
    setChars([...String(Math.min(amount, max))].map(make));
  };

  const send = () => {
    if (sent !== null) {
      return;
    }
    if (empty || value <= 0) {
      refuse(false);
      return;
    }
    onSend?.(value);
    setSent(value);
    clearTimeout(sentTimer.current);
    sentTimer.current = setTimeout(() => {
      setChars([]);
      setSent(null);
    }, 1600);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    let key: string | null = null;
    if (DIGIT.test(event.key) || event.key === ".") {
      key = event.key;
    } else if (event.key === ",") {
      key = ".";
    } else if (event.key === "Backspace") {
      key = "back";
    }
    // Enter is left alone: on a focused key or Send it already clicks it.
    if (key) {
      event.preventDefault();
      press(key);
    }
  };

  const glyphs = layout(chars);
  let sendTone =
    "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";
  if (sent !== null) {
    sendTone =
      "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950";
  } else if (empty) {
    sendTone = "bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600";
  }
  const digitIn = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 520, damping: 30, mass: 0.8 };
  const slide = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 500, damping: 40 };

  const initials = recipient.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: typing anywhere in the pad goes to the amount; the keys themselves are buttons.
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: same as above
    <div
      className={cn(
        "flex w-full max-w-xs flex-col rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
      onKeyDown={onKeyDown}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-orange-100 font-medium text-orange-700 text-xs dark:bg-orange-500/15 dark:text-orange-300">
          {initials}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Send to</p>
          <p className="truncate font-medium text-sm text-zinc-900 dark:text-zinc-100">
            {recipient.name}
            {recipient.handle && (
              <span className="ml-1.5 font-normal text-zinc-400 dark:text-zinc-500">
                {recipient.handle}
              </span>
            )}
          </p>
        </div>
      </div>

      <div
        className="mt-6 flex h-20 items-center justify-center"
        ref={frameRef}
      >
        <output aria-live="polite" className="sr-only">
          {money(value, currency)}
        </output>
        <motion.div
          aria-hidden="true"
          className="flex origin-center items-baseline whitespace-nowrap font-semibold text-[56px] text-zinc-900 tabular-nums leading-none tracking-tight dark:text-zinc-50"
          ref={amountRef}
          style={{ scale: fit, x: shakeX }}
        >
          <span
            className={cn(
              "mr-0.5 transition-colors duration-200",
              empty
                ? "text-zinc-300 dark:text-zinc-700"
                : "text-zinc-400 dark:text-zinc-500"
            )}
          >
            {currency}
          </span>
          <AnimatePresence initial={false} mode="popLayout">
            {empty && (
              <motion.span
                animate={{ opacity: 1 }}
                className="text-zinc-300 dark:text-zinc-700"
                exit={{ opacity: 0, transition: { duration: 0.08 } }}
                initial={{ opacity: 0 }}
                key="placeholder"
                transition={{ duration: 0.15 }}
              >
                0
              </motion.span>
            )}
            {glyphs.map((glyph) => (
              <motion.span
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                className={cn(
                  "inline-block",
                  glyph.kind === "ghost" && "text-zinc-300 dark:text-zinc-700",
                  glyph.kind === "sep" && "text-zinc-400 dark:text-zinc-500"
                )}
                exit={{
                  opacity: 0,
                  y: 18,
                  filter: "blur(2px)",
                  transition: { duration: 0.14, ease: EASE_OUT },
                }}
                initial={{ opacity: 0, y: -22, filter: "blur(2px)" }}
                key={glyph.key}
                layout="position"
                transition={{
                  default: digitIn,
                  layout: slide,
                  filter: { duration: 0.16 },
                }}
              >
                {glyph.char}
              </motion.span>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      <div className="relative h-5 text-center text-xs">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              capped
                ? "text-red-600 dark:text-red-400"
                : "text-zinc-500 dark:text-zinc-400"
            )}
            exit={{ opacity: 0, y: -6 }}
            initial={{ opacity: 0, y: 6 }}
            key={capped ? "cap" : "balance"}
            transition={{ duration: 0.18, ease: EASE_OUT }}
          >
            {capped
              ? `Up to ${money(max, currency)} per transfer`
              : `Balance ${currency}${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex justify-center gap-2">
        {presets.map((amount) => (
          <button
            className="h-8 rounded-full border border-zinc-200 px-3 font-medium text-xs text-zinc-700 tabular-nums transition-colors duration-150 hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:active:bg-zinc-800 dark:hover:bg-zinc-900"
            key={amount}
            onClick={() => preset(amount)}
            type="button"
          >
            {money(amount, currency)}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-1">
        {KEYS.map((key) => (
          <button
            aria-label={KEY_LABELS[key] ?? key}
            className={cn(
              "flex h-14 items-center justify-center rounded-2xl font-medium text-2xl text-zinc-900 tabular-nums outline-none",
              "transition-colors duration-100 ease-out hover:bg-zinc-50 active:bg-zinc-100 active:duration-0",
              "focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-100 dark:active:bg-zinc-800 dark:hover:bg-zinc-900"
            )}
            key={key}
            onClick={() => press(key)}
            type="button"
          >
            {key === "back" ? (
              <Delete
                aria-hidden
                className="size-6 text-zinc-500"
                strokeWidth={1.75}
              />
            ) : (
              key
            )}
          </button>
        ))}
      </div>

      <button
        aria-disabled={empty}
        className={cn(
          "relative mt-3 flex h-12 items-center justify-center gap-2 overflow-hidden rounded-2xl font-medium text-sm outline-none",
          "transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
          sendTone
        )}
        onClick={send}
        type="button"
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2"
            exit={{ opacity: 0, y: -10 }}
            initial={{ opacity: 0, y: 10 }}
            key={sent === null ? "send" : "sent"}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            {sent === null ? (
              <>
                <ArrowUp aria-hidden className="size-4" />
                {empty ? "Enter an amount" : `Send ${money(value, currency)}`}
              </>
            ) : (
              <>
                <Check aria-hidden className="size-4" strokeWidth={2.5} />
                Sent {money(sent, currency)}
              </>
            )}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
}
