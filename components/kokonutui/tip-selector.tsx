"use client";

/**
 * @author: @dorianbaffier
 * @description: Tip Selector
 * @version: 1.0.0
 * @date: 2026-10-22
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, Delete, Heart } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];
const MAX_CUSTOM = 999;

export interface TipSelectorProps {
  /** The order before the tip. */
  subtotal?: number;
  /** Who the tip goes to. */
  recipient?: string;
  /** Preset tips, in percent. */
  percents?: number[];
  /** Preset picked at first. */
  defaultPercent?: number;
  currency?: string;
  onChange?: (tip: number) => void;
  onPay?: (total: number) => void;
  className?: string;
}

type Choice =
  | { kind: "percent"; value: number }
  | { kind: "custom" }
  | { kind: "none" };

const round2 = (n: number) => Math.round(n * 100) / 100;

const fmt = (n: number, currency: string) =>
  `${currency}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function tipFor(choice: Choice, subtotal: number, custom: number) {
  if (choice.kind === "percent") {
    return round2((subtotal * choice.value) / 100);
  }
  return choice.kind === "custom" ? custom : 0;
}

/** What pressing `key` makes of the custom amount, or null if it can't take it. */
function typeCustom(custom: string, key: string): string | null {
  if (key === "back") {
    return custom.slice(0, -1);
  }
  if (key === ".") {
    if (custom.includes(".")) {
      return null;
    }
    return custom ? `${custom}.` : "0.";
  }
  const [, cents] = custom.split(".");
  if (cents !== undefined && cents.length >= 2) {
    return null;
  }
  const next = custom === "0" ? key : custom + key;
  return Number.parseFloat(next) > MAX_CUSTOM ? null : next;
}

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
                    : { duration: 0.26, ease: EASE_OUT, delay: column * 0.012 }
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

/**
 * A tip picker for checkout. Each preset shows what it adds, Custom opens a
 * keypad in place of the presets, and the total rolls as you change it.
 */
export default function TipSelector({
  subtotal = 42.6,
  recipient = "Sam",
  percents = [15, 18, 20],
  defaultPercent = 18,
  currency = "$",
  onChange,
  onPay,
  className,
}: TipSelectorProps) {
  const [choice, setChoice] = useState<Choice>({
    kind: "percent",
    value: defaultPercent,
  });
  const [custom, setCustom] = useState("");
  const [editing, setEditing] = useState(false);
  const [paid, setPaid] = useState(false);
  const reduceMotion = Boolean(useReducedMotion());

  const customValue = Math.min(MAX_CUSTOM, Number.parseFloat(custom || "0"));
  const tip = tipFor(choice, subtotal, customValue);
  const total = round2(subtotal + tip);

  const pick = (next: Choice) => {
    setChoice(next);
    setPaid(false);
    onChange?.(tipFor(next, subtotal, customValue));
  };

  const press = (key: string) => {
    setPaid(false);
    const next = typeCustom(custom, key);
    if (next === null) {
      return;
    }
    setCustom(next);
    onChange?.(Math.min(MAX_CUSTOM, Number.parseFloat(next || "0")));
  };

  const openCustom = () => {
    // Start from what the current preset would have given, so it's an edit.
    if (!custom && choice.kind === "percent") {
      setCustom(String(round2((subtotal * choice.value) / 100)));
    }
    setChoice({ kind: "custom" });
    setEditing(true);
    setPaid(false);
  };

  const spring = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.4, bounce: 0 };
  const fade = { duration: reduceMotion ? 0 : 0.18, ease: EASE_OUT };
  const chip =
    "relative flex h-14 flex-col items-center justify-center rounded-2xl outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400";

  return (
    <div
      className={cn(
        "w-full max-w-sm overflow-hidden rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
    >
      <div className="flex items-baseline justify-between">
        <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
          Add a tip for {recipient}
        </p>
        <button
          className={cn(
            "rounded text-xs outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400",
            choice.kind === "none"
              ? "text-zinc-900 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          )}
          onClick={() => {
            setEditing(false);
            pick({ kind: "none" });
          }}
          type="button"
        >
          No tip
        </button>
      </div>

      <motion.div
        animate={{ height: editing ? "auto" : 56 }}
        className="relative mt-3"
        initial={false}
        transition={spring}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {editing ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              initial={{ opacity: 0, y: 6 }}
              key="pad"
              transition={fade}
            >
              <div className="flex h-14 items-center justify-between rounded-2xl bg-zinc-900 pr-1.5 pl-4 text-white dark:bg-zinc-100 dark:text-zinc-900">
                <div className="flex items-baseline gap-1 font-semibold text-2xl tabular-nums tracking-tight">
                  <span className="text-white/50 dark:text-zinc-900/50">
                    {currency}
                  </span>
                  <span>{custom || "0"}</span>
                  <span className="ml-0.5 inline-block h-6 w-px animate-pulse self-center bg-current" />
                </div>
                <button
                  className="flex h-11 items-center gap-1.5 rounded-xl bg-white px-3.5 font-medium text-sm text-zinc-900 outline-none transition-colors duration-150 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-white/60 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                  onClick={() => setEditing(false)}
                  type="button"
                >
                  <Check aria-hidden className="size-4" />
                  Done
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {KEYS.map((key) => (
                  <button
                    aria-label={key === "back" ? "Delete" : key}
                    className="flex h-11 items-center justify-center rounded-xl font-medium text-lg text-zinc-900 tabular-nums outline-none transition-colors duration-100 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 active:bg-zinc-100 active:duration-0 dark:text-zinc-100 dark:active:bg-zinc-800 dark:hover:bg-zinc-900"
                    key={key}
                    onClick={() => press(key)}
                    type="button"
                  >
                    {key === "back" ? (
                      <Delete
                        aria-hidden
                        className="size-5 text-zinc-500"
                        strokeWidth={1.75}
                      />
                    ) : (
                      key
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-4 gap-1.5"
              exit={{ opacity: 0, y: 6 }}
              initial={{ opacity: 0, y: -6 }}
              key="chips"
              transition={fade}
            >
              {percents.map((percent) => {
                const active =
                  choice.kind === "percent" && choice.value === percent;
                return (
                  <button
                    aria-pressed={active}
                    className={cn(
                      chip,
                      active
                        ? "text-white dark:text-zinc-900"
                        : "bg-zinc-50 text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    )}
                    key={percent}
                    onClick={() => pick({ kind: "percent", value: percent })}
                    type="button"
                  >
                    {active && (
                      <motion.span
                        className="absolute inset-0 rounded-2xl bg-zinc-900 dark:bg-zinc-100"
                        layoutId="tip-selector-active"
                        transition={spring}
                      />
                    )}
                    <span className="relative font-semibold text-sm">
                      {percent}%
                    </span>
                    <span
                      className={cn(
                        "relative text-[11px] tabular-nums",
                        active
                          ? "text-white/60 dark:text-zinc-900/60"
                          : "text-zinc-500 dark:text-zinc-400"
                      )}
                    >
                      {fmt((subtotal * percent) / 100, currency)}
                    </span>
                  </button>
                );
              })}
              <button
                aria-pressed={choice.kind === "custom"}
                className={cn(
                  chip,
                  choice.kind === "custom"
                    ? "text-white dark:text-zinc-900"
                    : "bg-zinc-50 text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                )}
                onClick={openCustom}
                type="button"
              >
                {choice.kind === "custom" && (
                  <motion.span
                    className="absolute inset-0 rounded-2xl bg-zinc-900 dark:bg-zinc-100"
                    layoutId="tip-selector-active"
                    transition={spring}
                  />
                )}
                <span className="relative font-semibold text-sm">Custom</span>
                {choice.kind === "custom" && (
                  <span className="relative text-[11px] text-white/60 tabular-nums dark:text-zinc-900/60">
                    {fmt(customValue, currency)}
                  </span>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        <Heart
          aria-hidden
          className="size-3 text-rose-500"
          fill="currentColor"
        />
        All of it goes to {recipient}
      </p>

      <dl className="mt-4 space-y-1.5 border-zinc-100 border-t pt-4 text-sm dark:border-zinc-900">
        <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{fmt(subtotal, currency)}</dd>
        </div>
        <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
          <dt>Tip</dt>
          <dd>
            <Rolling
              currency={currency}
              reduceMotion={reduceMotion}
              value={tip}
            />
          </dd>
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
          onPay?.(total);
          setEditing(false);
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
            transition={fade}
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
