"use client";

/**
 * @author: @dorianbaffier
 * @description: Currency Transfer
 * @version: 2.1.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  ArrowDownIcon,
  ArrowUpDown,
  ArrowUpIcon,
  InfoIcon,
  XIcon,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  type Transition,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type TransferStatus = "processing" | "completed" | "failed";

export interface TransferAccount {
  /** Amount sent from / received into this account. */
  amount: number;
  /** ISO currency code, e.g. "USD". */
  currency: string;
  /** Short symbol shown in the badge, e.g. "$". Defaults to the currency's own symbol. */
  symbol?: string;
  /** Bank or account name, e.g. "Chase Bank". */
  bank: string;
  /** Last digits of the account number, shown masked. */
  last4?: string;
}

export interface CurrencyTransferProps {
  from?: TransferAccount;
  to?: TransferAccount;
  /** Units of `to.currency` per one unit of `from.currency`. */
  rate?: number;
  /** Transaction reference shown once the transfer completes. */
  txnId?: string;
  /** When the exchange rate was set, shown in the info tooltip (e.g. "10:45 AM"). */
  timestamp?: string;
  /**
   * Controlled status. When omitted, the card runs a demo: it starts as
   * "processing" and completes on its own after a short delay.
   */
  status?: TransferStatus;
  /** BCP 47 locale for amounts, symbols and the rate. */
  locale?: string;
  className?: string;
}

const DEFAULT_FROM: TransferAccount = {
  amount: 500,
  currency: "USD",
  symbol: "$",
  bank: "Chase Bank",
  last4: "4589",
};

const DEFAULT_TO: TransferAccount = {
  amount: 460,
  currency: "EUR",
  symbol: "€",
  bank: "Deutsche Bank",
  last4: "7823",
};

const DEMO_COMPLETE_DELAY_MS = 2600;

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
const EASE_OUT_CSS = "cubic-bezier(0.23, 1, 0.32, 1)";
const EASE_IN_OUT_CSS = "cubic-bezier(0.77, 0, 0.175, 1)";

// While processing, the live rate wobbles by up to this fraction, this often.
const RATE_TICK_MS = 750;
const RATE_WOBBLE = 0.0008;
// The currency chip's trip from the From row to the To row.
const CHIP_MS = 600;
// Each digit column starts this much after the one to its right.
const DIGIT_STAGGER_MS = 40;
const DIGIT_ROLL_MS = 600;
// Progress arc: creeps towards 85% while processing, closes on completion.
const ARC_PENDING = 0.85;
const ARC_PENDING_MS = 4000;
const ARC_RADIUS = 48;
const ARC_LENGTH = 2 * Math.PI * ARC_RADIUS;

function formatNumber(value: number, locale: string, digits: number) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function getCurrencySymbol(currency: string, locale: string) {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    return (
      parts.find((part) => part.type === "currency")?.value ??
      currency.charAt(0)
    );
  } catch {
    // Not an ISO 4217 code.
    return currency.charAt(0);
  }
}

const symbolOf = (account: TransferAccount, locale: string) =>
  account.symbol ?? getCurrencySymbol(account.currency, locale);

/** Text that swaps between states: short rise in, short rise out. */
const swapVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15, ease: EASE_OUT } },
};

/**
 * Same swap without movement, for prefers-reduced-motion. `y` and `scale` are
 * pinned at rest so the server (which can't know the preference) and the
 * client render the same transform.
 */
const fadeVariants: Variants = {
  initial: { opacity: 0, y: 0, scale: 1 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.2, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    y: 0,
    scale: 1,
    transition: { duration: 0.15, ease: EASE_OUT },
  },
};

/** Status icon swap: never from scale(0), a slight 0.9 -> 1 settle. */
const iconVariants: Variants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.25, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.15, ease: EASE_OUT },
  },
};

/**
 * An odometer: each digit is a 0-9 strip in a one-digit window, moved with
 * translateY. Columns are keyed from the right so a changing length keeps
 * them aligned, and the right-most column moves first.
 */
function RollingNumber({ value }: { value: string }) {
  const chars = Array.from(value);
  return (
    <>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="inline-flex select-none tabular-nums">
        {chars.map((char, index) => {
          const fromRight = chars.length - index;
          const digit = Number.parseInt(char, 10);
          if (Number.isNaN(digit)) {
            return <span key={`s-${fromRight}`}>{char}</span>;
          }
          return (
            <span
              className="relative inline-block h-[1lh] overflow-hidden"
              key={`d-${fromRight}`}
            >
              {/* Sizes the window to one digit. */}
              <span className="invisible">0</span>
              <span
                // Reduced motion is handled in CSS: the server can't know the
                // preference, so it must not change the markup.
                className="absolute inset-x-0 top-0 flex flex-col motion-reduce:transition-none!"
                style={{
                  transform: `translateY(${-digit * 10}%)`,
                  transition: `transform ${DIGIT_ROLL_MS}ms ${EASE_OUT_CSS} ${(fromRight - 1) * DIGIT_STAGGER_MS}ms`,
                }}
              >
                {"0123456789".split("").map((n) => (
                  <span className="h-[1lh]" key={n}>
                    {n}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </>
  );
}

interface AccountRowProps {
  direction: "from" | "to";
  account: TransferAccount;
  /** The amount shown; the To row shows zero until the money lands. */
  amount: number;
  /** Rows join once the money has landed. */
  joined: boolean;
  /** Full colour once the amount is final. */
  settled: boolean;
  locale: string;
  reduceMotion: boolean;
  badgeRef: RefObject<HTMLSpanElement | null>;
}

function AccountRow({
  direction,
  account,
  amount,
  joined,
  settled,
  locale,
  reduceMotion,
  badgeRef,
}: AccountRowProps) {
  const isFrom = direction === "from";
  const DirectionIcon = isFrom ? ArrowUpIcon : ArrowDownIcon;
  // The two rows sit 12px apart; once joined each moves 6px toward the
  // other so they form one block (transform only, no layout animation).
  const joinOffset = isFrom ? 6 : -6;
  const transition: Transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.3, ease: EASE_IN_OUT };
  // The facing corners square off once the rows meet, not as they start
  // moving; they round again as soon as the rows start to part.
  const [hasMet, setHasMet] = useState(joined);
  const squared = joined && hasMet;

  return (
    <motion.div
      animate={{ y: joined ? joinOffset : 0 }}
      className={cn(
        "w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-700/50 dark:bg-zinc-800/50",
        squared && isFrom && "rounded-b-none border-b-0",
        squared && !isFrom && "rounded-t-none border-t-0"
      )}
      initial={false}
      onAnimationComplete={() => setHasMet(joined)}
      transition={transition}
    >
      <div className="w-full space-y-1">
        <span className="flex items-center gap-1.5 font-medium text-xs text-zinc-500 dark:text-zinc-400">
          <DirectionIcon aria-hidden="true" className="h-3 w-3" />
          {isFrom ? "From" : "To"}
        </span>
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-lg border bg-white font-medium text-sm text-zinc-900 transition-colors duration-300 dark:bg-zinc-900 dark:text-zinc-100",
              !isFrom && settled
                ? "border-emerald-500/70"
                : "border-zinc-300 dark:border-zinc-700"
            )}
            ref={badgeRef}
          >
            {symbolOf(account, locale)}
          </span>
          <div className="flex flex-col items-start">
            <span
              className={cn(
                "font-medium tracking-tight transition-colors duration-200",
                settled
                  ? "text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 dark:text-zinc-400"
              )}
            >
              <RollingNumber value={formatNumber(amount, locale, 2)} />{" "}
              {account.currency}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {account.bank}
              {account.last4 ? ` ••••${account.last4}` : null}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * The progress arc stands in for a spinner: it eases towards 85% while the
 * transfer is processing (an honest "almost"), then closes on completion.
 * On failure it turns red and only this badge shakes.
 */
function StatusBadge({
  status,
  reduceMotion,
}: {
  status: TransferStatus;
  reduceMotion: boolean;
}) {
  const badgeRef = useRef<HTMLDivElement>(null);
  // Starts empty on the server; the creep towards 85% begins on mount.
  const [armed, setArmed] = useState(status !== "processing");
  useEffect(() => {
    const frame = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const previous = useRef(status);
  useEffect(() => {
    const was = previous.current;
    previous.current = status;
    if (status !== "failed" || was === "failed" || reduceMotion) {
      return;
    }
    badgeRef.current?.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-7px)" },
        { transform: "translateX(6px)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(2px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 420, easing: "ease-out" }
    );
  }, [status, reduceMotion]);

  let progress = 1;
  let arcTransition = `stroke-dashoffset 350ms ${EASE_OUT_CSS}, color 200ms ease`;
  if (status === "processing") {
    progress = armed ? ARC_PENDING : 0;
    arcTransition = `stroke-dashoffset ${ARC_PENDING_MS}ms cubic-bezier(0.1, 0.7, 0.3, 1)`;
  }

  return (
    <div
      className="relative flex h-[100px] w-[100px] items-center justify-center"
      ref={badgeRef}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 -rotate-90 [&_circle]:motion-reduce:transition-none!"
        height="100"
        viewBox="0 0 100 100"
        width="100"
      >
        <circle
          className="text-zinc-200 dark:text-zinc-800"
          cx="50"
          cy="50"
          fill="none"
          r={ARC_RADIUS}
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <circle
          className={
            status === "failed"
              ? "text-red-500"
              : "text-emerald-500 dark:text-emerald-400"
          }
          cx="50"
          cy="50"
          fill="none"
          r={ARC_RADIUS}
          stroke="currentColor"
          strokeDasharray={ARC_LENGTH}
          strokeLinecap="round"
          strokeWidth="2.5"
          style={{
            strokeDashoffset: (1 - progress) * ARC_LENGTH,
            transition: arcTransition,
          }}
        />
      </svg>
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          animate="animate"
          className="relative rounded-full p-5"
          exit="exit"
          initial="initial"
          key={status}
          variants={reduceMotion ? fadeVariants : iconVariants}
        >
          {status === "failed" && (
            <XIcon
              aria-hidden="true"
              className="h-10 w-10 text-red-500"
              strokeWidth={3}
            />
          )}
          {status === "completed" && (
            <svg
              aria-hidden="true"
              className="h-10 w-10 text-emerald-500 dark:text-emerald-400"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              viewBox="0 0 24 24"
            >
              <motion.path
                animate={{ pathLength: 1 }}
                d="M20 6 9 17l-5-5"
                initial={{ pathLength: reduceMotion ? 1 : 0 }}
                transition={{ duration: 0.3, delay: 0.15, ease: EASE_OUT }}
              />
            </svg>
          )}
          {status === "processing" && (
            <ArrowUpDown
              aria-hidden="true"
              className="h-10 w-10 text-emerald-500 dark:text-emerald-400"
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const TITLES: Record<TransferStatus, string> = {
  processing: "Transfer in Progress",
  completed: "Transfer Completed",
  failed: "Transfer Failed",
};

/**
 * Wobbles the rate a little while the transfer is processing, as a live
 * quote would, and settles back on the agreed rate otherwise.
 */
function useLiveRate(rate: number, processing: boolean, reduceMotion: boolean) {
  const [live, setLive] = useState(rate);
  useEffect(() => {
    setLive(rate);
    if (!processing || reduceMotion) {
      return;
    }
    const timer = window.setInterval(() => {
      setLive(rate * (1 + (Math.random() * 2 - 1) * RATE_WOBBLE));
    }, RATE_TICK_MS);
    return () => window.clearInterval(timer);
  }, [rate, processing, reduceMotion]);
  return live;
}

/**
 * Plays the currency chip's trip from the From badge to the To badge when
 * the transfer completes. `landed` turns true when it arrives (at once
 * with reduced motion, or when the card first renders as completed).
 */
function useChipFlight(
  completed: boolean,
  reduceMotion: boolean,
  refs: {
    area: RefObject<HTMLDivElement | null>;
    fromBadge: RefObject<HTMLSpanElement | null>;
    toBadge: RefObject<HTMLSpanElement | null>;
    chip: RefObject<HTMLSpanElement | null>;
  }
) {
  const [landed, setLanded] = useState(completed);
  const { area, fromBadge, toBadge, chip } = refs;
  useEffect(() => {
    if (!completed) {
      setLanded(false);
      return;
    }
    const node = chip.current;
    const box = area.current?.getBoundingClientRect();
    const start = fromBadge.current?.getBoundingClientRect();
    const end = toBadge.current?.getBoundingClientRect();
    if (reduceMotion || !(node && box && start && end)) {
      setLanded(true);
      return;
    }
    node.style.left = `${start.left - box.left}px`;
    node.style.top = `${start.top - box.top}px`;
    const dy = end.top - start.top;
    // A slight bow to the right, as if handed over, not slid down a rail.
    const flight = node.animate(
      [
        { transform: "translate(0, 0)", opacity: 0, offset: 0 },
        { transform: "translate(0, 0)", opacity: 1, offset: 0.08 },
        {
          transform: `translate(14px, ${dy * 0.5}px)`,
          opacity: 1,
          offset: 0.5,
        },
        { transform: `translate(0, ${dy}px)`, opacity: 1, offset: 0.92 },
        { transform: `translate(0, ${dy}px)`, opacity: 0, offset: 1 },
      ],
      { duration: CHIP_MS, easing: EASE_IN_OUT_CSS }
    );
    // The symbol changes currency on the way.
    const [fromSymbol, toSymbol] = Array.from(node.children);
    const swap = { duration: CHIP_MS, easing: "linear" };
    fromSymbol?.animate(
      [
        { opacity: 1 },
        { opacity: 1, offset: 0.4 },
        { opacity: 0, offset: 0.6 },
      ],
      swap
    );
    toSymbol?.animate(
      [
        { opacity: 0 },
        { opacity: 0, offset: 0.4 },
        { opacity: 1, offset: 0.6 },
        { opacity: 1 },
      ],
      swap
    );
    let cancelled = false;
    flight.finished
      .then(() => {
        if (!cancelled) {
          setLanded(true);
        }
      })
      .catch(() => {
        // Cancelled by unmount.
      });
    return () => {
      cancelled = true;
      flight.cancel();
    };
  }, [completed, reduceMotion, area, fromBadge, toBadge, chip]);
  return landed && completed;
}

export default function CurrencyTransfer({
  from = DEFAULT_FROM,
  to = DEFAULT_TO,
  rate = 0.92,
  txnId = "TXN-DAB3UL494",
  timestamp = "10:45 AM",
  status,
  locale = "en-US",
  className,
}: CurrencyTransferProps = {}) {
  const reduceMotion = useReducedMotion() ?? false;
  const isControlled = status !== undefined;
  const [demoStatus, setDemoStatus] = useState<TransferStatus>("processing");
  const currentStatus = status ?? demoStatus;
  const completed = currentStatus === "completed";
  const failed = currentStatus === "failed";
  const processing = currentStatus === "processing";

  const liveRate = useLiveRate(rate, processing, reduceMotion);
  const areaRef = useRef<HTMLDivElement>(null);
  const fromBadgeRef = useRef<HTMLSpanElement>(null);
  const toBadgeRef = useRef<HTMLSpanElement>(null);
  const chipRef = useRef<HTMLSpanElement>(null);
  const landed = useChipFlight(completed, reduceMotion, {
    area: areaRef,
    fromBadge: fromBadgeRef,
    toBadge: toBadgeRef,
    chip: chipRef,
  });
  // Nothing has arrived until the chip lands; then the amount rolls up.
  const toAmount = landed ? to.amount : 0;

  // Demo mode only: auto-complete after a short delay. Controlled usage
  // (status passed in) never starts a timer.
  useEffect(() => {
    if (isControlled) {
      return;
    }
    const timer = setTimeout(() => {
      setDemoStatus("completed");
    }, DEMO_COMPLETE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isControlled]);

  const swap = reduceMotion ? fadeVariants : swapVariants;
  // The hidden pose is the same on server and client; reduced motion drops
  // the rise by giving `y` no duration.
  const entry: Variants = {
    hidden: { opacity: 0, y: 8 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.25,
        delay: i * 0.06,
        ease: EASE_OUT,
        y: reduceMotion ? { duration: 0 } : undefined,
      },
    }),
  };

  return (
    <TooltipProvider>
      {/* Sized by its content, so the icon and rows no longer overflow
          fixed slots into the card's padding. */}
      <Card
        className={cn(
          "mx-auto flex w-full max-w-sm flex-col border border-zinc-200/60 bg-white p-6 dark:border-zinc-800/60 dark:bg-zinc-900",
          className
        )}
      >
        <CardContent className="flex flex-1 flex-col justify-center space-y-4 py-0">
          <output aria-live="polite" className="sr-only">
            {completed && `Transfer completed. Transaction ID ${txnId}.`}
            {failed && "Transfer failed."}
            {processing && "Transfer in progress."}
          </output>

          <motion.div
            animate="visible"
            className="flex items-center justify-center"
            custom={0}
            initial="hidden"
            variants={entry}
          >
            <StatusBadge reduceMotion={reduceMotion} status={currentStatus} />
          </motion.div>

          <motion.div
            animate="visible"
            className="flex flex-col"
            custom={1}
            initial="hidden"
            variants={entry}
          >
            <div className="w-full space-y-2 text-center">
              <AnimatePresence initial={false} mode="wait">
                <motion.h2
                  animate="animate"
                  className="font-semibold text-lg text-zinc-900 uppercase tracking-wide dark:text-zinc-100"
                  exit="exit"
                  initial="initial"
                  key={`${currentStatus}-title`}
                  variants={swap}
                >
                  {TITLES[currentStatus]}
                </motion.h2>
              </AnimatePresence>
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  animate="animate"
                  className={cn(
                    "font-medium text-xs",
                    failed
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}
                  exit="exit"
                  initial="initial"
                  key={`${currentStatus}-detail`}
                  variants={swap}
                >
                  {completed && `Transaction ID: ${txnId}`}
                  {failed && "Please try again"}
                  {processing && "Processing Transaction..."}
                </motion.div>
              </AnimatePresence>

              <div
                className="relative mt-4 flex flex-col items-start gap-3"
                ref={areaRef}
              >
                <AccountRow
                  account={from}
                  amount={from.amount}
                  badgeRef={fromBadgeRef}
                  direction="from"
                  joined={landed}
                  locale={locale}
                  reduceMotion={reduceMotion}
                  settled={landed}
                />
                <AccountRow
                  account={to}
                  amount={toAmount}
                  badgeRef={toBadgeRef}
                  direction="to"
                  joined={landed}
                  locale={locale}
                  reduceMotion={reduceMotion}
                  settled={landed}
                />
                {/* The money in transit: a copy of the From badge that
                    travels to the To badge, changing currency on the way. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute z-10 grid h-7 w-7 place-items-center rounded-lg border border-emerald-500/70 bg-white font-medium text-sm text-zinc-900 opacity-0 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
                  ref={chipRef}
                >
                  <span className="col-start-1 row-start-1">
                    {symbolOf(from, locale)}
                  </span>
                  <span className="col-start-1 row-start-1 opacity-0">
                    {symbolOf(to, locale)}
                  </span>
                </span>
              </div>

              <div className="mt-2 flex items-center justify-center gap-2 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                <span>
                  {processing ? "Live rate" : "Exchange Rate"}: 1{" "}
                  {from.currency} ={" "}
                  <RollingNumber value={formatNumber(liveRate, locale, 4)} />{" "}
                  {to.currency}
                </span>
                {/* Only once there is a rate to explain. The padding gives
                    the 12px icon a 24px target without moving the layout. */}
                {!processing && (
                  <Tooltip>
                    <TooltipTrigger
                      aria-label="Exchange rate details"
                      className="-m-1.5 rounded-sm p-1.5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                    >
                      <InfoIcon
                        aria-hidden="true"
                        className="h-3 w-3 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Rate updated at {timestamp}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </motion.div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
