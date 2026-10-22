"use client";

/**
 * @author: @dorianbaffier
 * @description: Tip Selector
 * @version: 2.0.0
 * @date: 2026-10-22
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, Heart } from "lucide-react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { type PointerEvent, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** Width of one percent on the tape, in px. */
const TICK = 16;
const SETTLE = { type: "spring", stiffness: 420, damping: 42 } as const;

export interface TipSelectorProps {
  /** The order before the tip. */
  subtotal?: number;
  /** Who the tip goes to. */
  recipient?: { name: string; note?: string };
  /** Marked on the tape and offered as shortcuts, in percent. */
  percents?: number[];
  /** Where the tape starts. */
  defaultPercent?: number;
  /** The far end of the tape, in percent. */
  max?: number;
  currency?: string;
  onChange?: (tip: number) => void;
  onPay?: (total: number) => void;
  className?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

const fmt = (n: number, currency: string) =>
  `${currency}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Past either end the tape gives, but less and less. */
const rubber = (value: number, max: number) => {
  if (value < 0) {
    return -Math.sqrt(-value) * 0.9;
  }
  return value > max ? max + Math.sqrt(value - max) * 0.9 : value;
};

/**
 * A money amount whose digits roll: up when it grows, down when it shrinks.
 * Columns are keyed from the right, so cents stay over cents.
 */
function Rolling({
  value,
  currency,
  reduceMotion,
  className,
}: {
  value: number;
  currency: string;
  reduceMotion: boolean;
  className?: string;
}) {
  const [last, setLast] = useState(value);
  const [direction, setDirection] = useState(1);
  if (last !== value) {
    setDirection(value > last ? 1 : -1);
    setLast(value);
  }
  const text = fmt(value, currency);
  const chars = [...text];
  return (
    <span className={cn("inline-flex tabular-nums", className)}>
      <span className="sr-only">{text}</span>
      {chars.map((char, i) => {
        const column = chars.length - i;
        return (
          <span
            aria-hidden="true"
            className="relative inline-block overflow-hidden"
            key={column}
          >
            <AnimatePresence
              custom={direction}
              initial={false}
              mode="popLayout"
            >
              <motion.span
                animate={{ y: "0%", opacity: 1 }}
                className="inline-block"
                exit={{ y: `${-70 * direction}%`, opacity: 0 }}
                initial={{ y: `${70 * direction}%`, opacity: 0 }}
                key={char}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.22, ease: EASE_OUT, delay: column * 0.01 }
                }
              >
                {char}
              </motion.span>
            </AnimatePresence>
          </span>
        );
      })}
    </span>
  );
}

function Ticks({ max, percents }: { max: number; percents: number[] }) {
  const ticks: number[] = [];
  for (let i = 0; i <= max; i++) {
    ticks.push(i);
  }
  return (
    <>
      {ticks.map((i) => {
        const major = i % 5 === 0;
        const marked = percents.includes(i);
        return (
          <span
            className={cn(
              "absolute bottom-7 w-px -translate-x-1/2 rounded-full bg-current",
              major || marked ? "h-6" : "h-3"
            )}
            key={i}
            style={{ left: i * TICK }}
          />
        );
      })}
    </>
  );
}

/**
 * A tip picker for checkout, set on a tape you drag. Flick it and it coasts
 * to a whole percent; the ticks you've passed fill in, the tip and total roll,
 * and Round up picks the tip that makes the total a whole amount.
 */
export default function TipSelector({
  subtotal = 42.6,
  recipient = { name: "Sam", note: "Your courier · 6 min early" },
  percents = [15, 18, 20],
  defaultPercent = 18,
  max = 30,
  currency = "$",
  onChange,
  onPay,
  className,
}: TipSelectorProps) {
  const [percent, setPercent] = useState(defaultPercent);
  // Round up sets the tip itself, so the total lands on a whole amount.
  const [exactTip, setExactTip] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [paid, setPaid] = useState(false);
  const reduceMotion = Boolean(useReducedMotion());

  const position = useMotionValue(defaultPercent);
  const x = useTransform(position, (v) => -v * TICK);
  const filled = useTransform(
    position,
    (v) => `inset(0px ${(max - clamp(v, 0, max)) * TICK}px 0px -2px)`
  );
  const drag = useRef({ x: 0, from: 0, v: 0, t: 0, lastX: 0 });

  const tip = exactTip ?? round2((subtotal * percent) / 100);
  const total = round2(subtotal + tip);
  const roundTip = round2(Math.floor(subtotal + tip) + 1 - subtotal);

  const commit = (next: number, exact: number | null = null) => {
    setPercent(next);
    setExactTip(exact);
    setPaid(false);
    onChange?.(exact ?? round2((subtotal * next) / 100));
  };

  const glide = (target: number, exact: number | null = null) => {
    commit(Math.round(target), exact);
    if (reduceMotion) {
      position.set(target);
      return;
    }
    animate(position, target, SETTLE);
  };

  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    position.stop();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      x: event.clientX,
      from: position.get(),
      v: 0,
      t: event.timeStamp,
      lastX: event.clientX,
    };
    setDragging(true);
  };

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) {
      return;
    }
    const d = drag.current;
    const dt = Math.max(1, event.timeStamp - d.t);
    d.v = d.v * 0.6 + ((event.clientX - d.lastX) / dt) * 0.4;
    d.t = event.timeStamp;
    d.lastX = event.clientX;
    const raw = d.from - (event.clientX - d.x) / TICK;
    position.set(rubber(raw, max));
    const next = clamp(Math.round(raw), 0, max);
    if (next !== percent || exactTip !== null) {
      commit(next);
    }
  };

  const onUp = () => {
    if (!dragging) {
      return;
    }
    setDragging(false);
    // Carry the flick a little way, then settle on a whole percent.
    const coast = (-drag.current.v * 160) / TICK;
    glide(clamp(Math.round(position.get() + coast), 0, max));
  };

  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-100 font-medium text-orange-700 text-xs dark:bg-orange-500/15 dark:text-orange-300">
          {recipient.name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-medium text-sm text-zinc-900 dark:text-zinc-100">
            Tip {recipient.name}
          </p>
          {recipient.note && (
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {recipient.note}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-col items-center">
        <Rolling
          className="font-semibold text-4xl text-zinc-900 tracking-tight dark:text-zinc-50"
          currency={currency}
          reduceMotion={reduceMotion}
          value={tip}
        />
        <p className="mt-1 h-4 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          {tip === 0
            ? "No tip"
            : `${exactTip === null ? percent : ((tip / subtotal) * 100).toFixed(1)}% of ${fmt(subtotal, currency)}`}
        </p>
      </div>

      {/* The tape. A range input underneath keeps it on the keyboard. */}
      <div
        className={cn(
          "relative mt-4 h-20 touch-none select-none overflow-hidden rounded-2xl text-zinc-300 outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-zinc-400 dark:text-zinc-700",
          dragging ? "cursor-grabbing" : "cursor-grab"
        )}
        onPointerCancel={onUp}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 22%, black 78%, transparent)",
        }}
      >
        <input
          aria-label={`Tip for ${recipient.name}, in percent`}
          aria-valuetext={`${percent}%, ${fmt(tip, currency)}`}
          className="sr-only"
          max={max}
          min={0}
          onChange={(event) => glide(Number(event.target.value))}
          step={1}
          type="range"
          value={percent}
        />
        <motion.div
          aria-hidden="true"
          className="absolute inset-y-0 left-1/2"
          style={{ x, width: max * TICK }}
        >
          <Ticks max={max} percents={percents} />
          <motion.div
            className="absolute inset-0 text-zinc-900 dark:text-zinc-100"
            style={{ clipPath: filled }}
          >
            <Ticks max={max} percents={percents} />
          </motion.div>
          {[...new Set([0, ...percents, max])].map((p) => (
            <span
              className={cn(
                "absolute bottom-2 -translate-x-1/2 text-[10px] tabular-nums",
                p === percent
                  ? "text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-400 dark:text-zinc-500"
              )}
              key={p}
              style={{ left: p * TICK }}
            >
              {p}%
            </span>
          ))}
        </motion.div>
        {/* The needle. */}
        <span className="pointer-events-none absolute top-3 bottom-7 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-orange-500" />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {percents.map((p) => (
          <button
            aria-pressed={exactTip === null && percent === p}
            className={cn(
              "h-8 rounded-full font-medium text-xs tabular-nums outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400",
              exactTip === null && percent === p
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            )}
            key={p}
            onClick={() => glide(p)}
            type="button"
          >
            {p}%
          </button>
        ))}
        <button
          aria-pressed={exactTip !== null}
          className={cn(
            "h-8 rounded-full font-medium text-xs outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400",
            exactTip === null
              ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          )}
          onClick={() => glide((roundTip / subtotal) * 100, roundTip)}
          title={`Round the total up to ${fmt(subtotal + roundTip, currency)}`}
          type="button"
        >
          Round up
        </button>
      </div>

      <dl className="mt-5 space-y-1.5 border-zinc-100 border-t pt-4 text-sm dark:border-zinc-900">
        <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{fmt(subtotal, currency)}</dd>
        </div>
        <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
          <dt className="flex items-center gap-1.5">
            Tip
            <Heart
              aria-hidden
              className="size-3 text-rose-500"
              fill="currentColor"
            />
            <span className="text-xs">all to {recipient.name}</span>
          </dt>
          <dd className="tabular-nums">{fmt(tip, currency)}</dd>
        </div>
        <div className="flex items-baseline justify-between pt-1 text-zinc-900 dark:text-zinc-50">
          <dt className="font-medium">Total</dt>
          <dd>
            <Rolling
              className="font-semibold text-xl tracking-tight"
              currency={currency}
              reduceMotion={reduceMotion}
              value={total}
            />
          </dd>
        </div>
      </dl>

      <button
        className={cn(
          "mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl font-medium text-sm outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
          paid
            ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950"
            : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        )}
        onClick={() => {
          if (paid) {
            return;
          }
          onPay?.(total);
          setPaid(true);
        }}
        type="button"
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2"
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: 8 }}
            key={paid ? "paid" : "pay"}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: EASE_OUT }}
          >
            {paid ? (
              <>
                <Check aria-hidden className="size-4" strokeWidth={2.5} />
                Paid, thank you
              </>
            ) : (
              "Place order"
            )}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
}
