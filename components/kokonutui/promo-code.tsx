"use client";

/**
 * @author: @dorianbaffier
 * @description: Promo Code
 * @version: 1.0.0
 * @date: 2026-10-22
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Tag, X } from "lucide-react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { type FormEvent, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const LEADING_SYMBOLS = /^[^\d]+/;

export interface PromoDiscount {
  /** Shown on the chip, e.g. "10% off". */
  label: string;
  /** Taken off the total, in major units. */
  amount: number;
}

export type PromoResult =
  | ({ ok: true } & PromoDiscount)
  | { ok: false; reason: string };

export interface PromoLine {
  label: string;
  amount: number;
}

export interface PromoCodeProps {
  /** Order lines above the total, e.g. subtotal and shipping. */
  lines?: PromoLine[];
  currency?: string;
  /** Checks a code. Return a discount or the reason it can't be used. */
  onApply?: (code: string, total: number) => Promise<PromoResult> | PromoResult;
  onRemove?: (code: string) => void;
  /** A line under the field, e.g. a hint for the demo. */
  hint?: string;
  className?: string;
}

const DEFAULT_LINES: PromoLine[] = [
  { label: "Subtotal", amount: 64 },
  { label: "Shipping", amount: 5 },
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The demo's codes. In an app this is a request to the server.
async function demoApply(code: string, total: number): Promise<PromoResult> {
  await wait(700);
  switch (code) {
    case "SAVE10":
      return {
        ok: true,
        label: "10% off",
        amount: Math.round(total * 10) / 100,
      };
    case "FREESHIP":
      return { ok: true, label: "Free shipping", amount: 5 };
    case "WELCOME50":
      return { ok: false, reason: "Only for orders over $100" };
    case "SPRING":
      return { ok: false, reason: "This code expired on Oct 1" };
    default:
      return { ok: false, reason: "We don't recognize that code" };
  }
}

const roll = {
  enter: (direction: number) => ({ opacity: 0, y: direction * 12 }),
  center: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } },
  exit: (direction: number) => ({
    opacity: 0,
    y: direction * -12,
    transition: { duration: 0.14, ease: EASE_OUT },
  }),
} satisfies Variants;

/**
 * Rolls each character on its own, keyed by its place from the right, so a
 * discount only moves the digits that change.
 */
function RollingText({ text, direction }: { text: string; direction: number }) {
  const prefix = text.match(LEADING_SYMBOLS)?.[0] ?? "";
  const columns = [...text.slice(prefix.length)].map((char, index, all) => ({
    char,
    place: all.length - index,
  }));
  return (
    <span className="inline-flex tabular-nums">
      {prefix}
      {columns.map(({ char, place }) => (
        <span
          className="relative inline-flex overflow-hidden"
          key={`place-${place}`}
        >
          <AnimatePresence custom={direction} initial={false} mode="popLayout">
            <motion.span
              animate="center"
              className="inline-block"
              custom={direction}
              exit="exit"
              initial="enter"
              key={char}
              variants={roll}
            >
              {char}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

type Phase = "idle" | "checking" | "error";

export default function PromoCode({
  lines = DEFAULT_LINES,
  currency = "$",
  onApply = demoApply,
  onRemove,
  hint = "Try SAVE10, FREESHIP or SPRING",
  className,
}: PromoCodeProps) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [reason, setReason] = useState("");
  const [applied, setApplied] = useState<
    (PromoDiscount & { code: string }) | null
  >(null);
  const [direction, setDirection] = useState(-1);
  const reduceMotion = useReducedMotion();

  const messageId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const shakeX = useMotionValue(0);

  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const total = Math.max(0, subtotal - (applied?.amount ?? 0));

  const money = (value: number) =>
    `${currency}${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const apply = async (event: FormEvent) => {
    event.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean || phase === "checking") {
      return;
    }
    setPhase("checking");
    const result = await onApply(clean, subtotal);
    if (result.ok) {
      setDirection(-1);
      setApplied({ code: clean, label: result.label, amount: result.amount });
      setCode("");
      setPhase("idle");
      return;
    }
    setReason(result.reason);
    setPhase("error");
    if (!reduceMotion) {
      animate(shakeX, [0, -8, 7, -5, 3, 0], {
        duration: 0.36,
        ease: "easeOut",
      });
    }
    inputRef.current?.select();
  };

  const remove = () => {
    if (!applied) {
      return;
    }
    setDirection(1);
    onRemove?.(applied.code);
    setApplied(null);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const swap = reduceMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: EASE_OUT };
  const busy = phase === "checking";
  let view: "chip" | "field" | "add" = "add";
  if (applied) {
    view = "chip";
  } else if (open) {
    view = "field";
  }

  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
    >
      <p className="font-semibold text-zinc-900 dark:text-zinc-50">
        Order summary
      </p>

      <dl className="mt-4 space-y-2 text-sm">
        {lines.map((line) => (
          <div className="flex justify-between" key={line.label}>
            <dt className="text-zinc-500 dark:text-zinc-400">{line.label}</dt>
            <dd className="text-zinc-900 tabular-nums dark:text-zinc-100">
              {money(line.amount)}
            </dd>
          </div>
        ))}
        <AnimatePresence initial={false}>
          {applied && (
            <motion.div
              animate={{ height: "auto", opacity: 1 }}
              className="overflow-hidden"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              key="discount"
              transition={swap}
            >
              <div className="flex justify-between pt-0.5">
                <dt className="text-zinc-500 dark:text-zinc-400">
                  Discount
                  <span className="ml-1.5 font-medium text-[11px] text-zinc-400 uppercase tracking-wide dark:text-zinc-500">
                    {applied.code}
                  </span>
                </dt>
                <dd className="text-emerald-600 tabular-nums dark:text-emerald-400">
                  −{money(applied.amount)}
                </dd>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </dl>

      <div className="mt-4 border-zinc-100 border-t pt-4 dark:border-zinc-900">
        <AnimatePresence initial={false} mode="popLayout">
          {view === "chip" && applied && (
            <motion.div
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -4, filter: "blur(2px)" }}
              initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
              key="chip"
              transition={swap}
            >
              <TicketChip
                code={applied.code}
                label={applied.label}
                onRemove={remove}
              />
            </motion.div>
          )}
          {view === "field" && (
            <motion.form
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              initial={{ opacity: 0, y: 4 }}
              key="field"
              onSubmit={apply}
              transition={swap}
            >
              <motion.div
                className={cn(
                  "flex h-11 items-center rounded-xl border bg-white pr-1 pl-3 transition-colors duration-150 dark:bg-zinc-950",
                  "focus-within:border-zinc-400 dark:focus-within:border-zinc-600",
                  phase === "error"
                    ? "border-red-300 dark:border-red-900"
                    : "border-zinc-200 dark:border-zinc-800"
                )}
                style={{ x: shakeX }}
              >
                <Tag aria-hidden className="size-4 shrink-0 text-zinc-400" />
                <input
                  aria-describedby={messageId}
                  aria-invalid={phase === "error"}
                  aria-label="Promo code"
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent px-2 font-medium text-sm text-zinc-900 uppercase tracking-wide outline-none placeholder:font-normal placeholder:text-zinc-400 placeholder:normal-case placeholder:tracking-normal dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  onChange={(event) => {
                    setCode(event.target.value);
                    if (phase === "error") {
                      setPhase("idle");
                    }
                  }}
                  placeholder="Promo code"
                  readOnly={busy}
                  ref={inputRef}
                  spellCheck={false}
                  value={code}
                />
                <button
                  className={cn(
                    "relative h-9 min-w-16 rounded-lg px-3 font-medium text-xs transition-colors duration-150",
                    code.trim()
                      ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                      : "bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600"
                  )}
                  disabled={!code.trim() || busy}
                  type="submit"
                >
                  <span
                    className={cn(
                      "transition-opacity duration-150",
                      busy && "opacity-0"
                    )}
                  >
                    Apply
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-0 flex items-center justify-center transition-opacity duration-150",
                      busy ? "opacity-100" : "opacity-0"
                    )}
                  >
                    <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-zinc-900/20 dark:border-t-zinc-900" />
                  </span>
                </button>
              </motion.div>
              <div className="relative mt-2 min-h-4 text-xs" id={messageId}>
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.p
                    animate={{ opacity: 1, y: 0 }}
                    aria-live="polite"
                    className={
                      phase === "error"
                        ? "text-red-600 dark:text-red-400"
                        : "text-zinc-400 dark:text-zinc-500"
                    }
                    exit={{ opacity: 0, y: -4 }}
                    initial={{ opacity: 0, y: 4 }}
                    key={phase === "error" ? reason : "hint"}
                    transition={{ duration: 0.16, ease: EASE_OUT }}
                  >
                    {phase === "error" ? reason : hint}
                  </motion.p>
                </AnimatePresence>
              </div>
            </motion.form>
          )}
          {view === "add" && (
            <motion.button
              animate={{ opacity: 1 }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg font-medium text-sm text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors duration-150 hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key="add"
              onClick={() => {
                setOpen(true);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              transition={{ duration: 0.12 }}
              type="button"
            >
              Add a promo code
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex items-baseline justify-between border-zinc-200 border-t pt-4 dark:border-zinc-800">
        <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
          Total
        </span>
        <span className="font-semibold text-xl text-zinc-900 tracking-tight dark:text-zinc-50">
          <RollingText direction={direction} text={money(total)} />
        </span>
      </div>
    </div>
  );
}

/** The applied code as a ticket stub, notched on both sides. */
function TicketChip({
  code,
  label,
  onRemove,
}: {
  code: string;
  label: string;
  onRemove: () => void;
}) {
  return (
    <div className="relative flex h-11 items-center gap-3 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 pr-1 pl-4 dark:border-emerald-900 dark:bg-emerald-950/40">
      {/* Notches punched into each side, filled with the card behind. */}
      <span className="absolute top-1/2 -left-2 size-4 -translate-y-1/2 rounded-full border border-emerald-200 bg-white dark:border-emerald-900 dark:bg-zinc-950" />
      <span className="absolute top-1/2 -right-2 size-4 -translate-y-1/2 rounded-full border border-emerald-200 bg-white dark:border-emerald-900 dark:bg-zinc-950" />
      <span className="font-semibold text-emerald-800 text-sm uppercase tracking-wide dark:text-emerald-300">
        {code}
      </span>
      <span className="h-5 border-emerald-300 border-l border-dashed dark:border-emerald-800" />
      <span className="flex-1 text-emerald-700 text-sm dark:text-emerald-400">
        {label}
      </span>
      <button
        aria-label={`Remove ${code}`}
        className="mr-2 flex size-8 items-center justify-center rounded-lg text-emerald-700 transition-colors duration-150 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
        onClick={onRemove}
        type="button"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
