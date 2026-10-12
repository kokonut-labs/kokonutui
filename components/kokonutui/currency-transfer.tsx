"use client";

/**
 * @author: @dorianbaffier
 * @description: Currency Transfer
 * @version: 2.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  ArrowDownIcon,
  ArrowUpDown,
  ArrowUpIcon,
  InfoIcon,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  type Transition,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type TransferStatus = "processing" | "completed";

export interface TransferAccount {
  /** Amount sent from / received into this account. */
  amount: number;
  /** ISO currency code, e.g. "USD". */
  currency: string;
  /** Short symbol shown in the badge, e.g. "$". Defaults to the first letter of `currency`. */
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

const DEMO_COMPLETE_DELAY_MS = 1500;

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

const amountFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatAmount(account: TransferAccount) {
  return `${amountFormatter.format(account.amount)} ${account.currency}`;
}

/** Text that swaps between states: short rise in, short rise out. */
const swapVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15, ease: EASE_OUT } },
};

/** Same swap without movement, for prefers-reduced-motion. */
const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: EASE_OUT } },
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

interface AccountRowProps {
  direction: "from" | "to";
  account: TransferAccount;
  completed: boolean;
  reduceMotion: boolean;
}

function AccountRow({
  direction,
  account,
  completed,
  reduceMotion,
}: AccountRowProps) {
  const isFrom = direction === "from";
  const DirectionIcon = isFrom ? ArrowUpIcon : ArrowDownIcon;
  // The two rows sit 12px apart; on completion each moves 6px toward the
  // other so they join into one block (transform only, no layout animation).
  const joinOffset = isFrom ? 6 : -6;
  const transition: Transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.3, ease: EASE_IN_OUT };

  return (
    <motion.div
      animate={{ y: completed ? joinOffset : 0 }}
      className={cn(
        "w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 transition-colors duration-200 dark:border-zinc-700/50 dark:bg-zinc-800/50",
        completed && isFrom && "rounded-b-none border-b-0",
        completed && !isFrom && "rounded-t-none border-t-0",
        !completed && "hover:border-emerald-500/30"
      )}
      initial={false}
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
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-300 bg-white font-medium text-sm text-zinc-900 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {account.symbol ?? account.currency.charAt(0)}
          </span>
          <div className="flex flex-col items-start">
            <span
              className={cn(
                "font-medium text-zinc-900 tabular-nums tracking-tight transition-opacity duration-200 dark:text-zinc-100",
                !completed && "opacity-50"
              )}
            >
              {formatAmount(account)}
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

function StatusIcon({
  completed,
  reduceMotion,
}: {
  completed: boolean;
  reduceMotion: boolean;
}) {
  return (
    <div className="relative flex h-[100px] w-[100px] items-center justify-center">
      <motion.div
        animate={{ opacity: completed ? 1 : 0.6 }}
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-emerald-500/10 blur-2xl dark:bg-emerald-500/5"
        initial={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
      />
      <AnimatePresence initial={false} mode="wait">
        {completed ? (
          <motion.div
            animate="animate"
            className="relative z-10 rounded-full border border-emerald-500 bg-white p-5 dark:bg-zinc-900"
            exit="exit"
            initial="initial"
            key="completed"
            variants={reduceMotion ? fadeVariants : iconVariants}
          >
            <svg
              aria-hidden="true"
              className="h-10 w-10 text-emerald-500"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3.5}
              viewBox="0 0 24 24"
            >
              <motion.path
                animate={{ pathLength: 1 }}
                d="M20 6 9 17l-5-5"
                initial={{ pathLength: reduceMotion ? 1 : 0 }}
                transition={{ duration: 0.3, delay: 0.1, ease: EASE_OUT }}
              />
            </svg>
          </motion.div>
        ) : (
          <motion.div
            animate="animate"
            className="relative z-10"
            exit="exit"
            initial="initial"
            key="processing"
            variants={reduceMotion ? fadeVariants : iconVariants}
          >
            {/* CSS spin runs off the main thread, so it stays smooth while
                the app is busy with the transfer. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-emerald-500/20 border-l-emerald-500 motion-reduce:animate-none"
            />
            <div className="relative z-10 rounded-full bg-white p-5 shadow-[0_0_15px_rgba(16,185,129,0.1)] dark:bg-zinc-900">
              <ArrowUpDown
                aria-hidden="true"
                className="h-10 w-10 text-emerald-500"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CurrencyTransfer({
  from = DEFAULT_FROM,
  to = DEFAULT_TO,
  rate = 0.92,
  txnId = "TXN-DAB3UL494",
  timestamp = "10:45 AM",
  status,
  className,
}: CurrencyTransferProps = {}) {
  const reduceMotion = useReducedMotion() ?? false;
  const isControlled = status !== undefined;
  const [demoStatus, setDemoStatus] = useState<TransferStatus>("processing");
  const currentStatus = status ?? demoStatus;
  const completed = currentStatus === "completed";

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
  const entry: Variants = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 8 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.25, delay: i * 0.06, ease: EASE_OUT },
    }),
  };

  return (
    <TooltipProvider>
      <Card
        className={cn(
          "mx-auto flex h-[420px] w-full max-w-sm flex-col border border-zinc-200/60 bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.03)] transition-colors duration-200 hover:border-emerald-500/20 dark:border-zinc-800/60 dark:bg-zinc-900 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)] dark:hover:border-emerald-500/20",
          className
        )}
      >
        <CardContent className="flex flex-1 flex-col justify-center space-y-4">
          <output aria-live="polite" className="sr-only">
            {completed
              ? `Transfer completed. Transaction ID ${txnId}.`
              : "Transfer in progress."}
          </output>

          <motion.div
            animate="visible"
            className="flex h-[80px] items-center justify-center"
            custom={0}
            initial="hidden"
            variants={entry}
          >
            <StatusIcon completed={completed} reduceMotion={reduceMotion} />
          </motion.div>

          <motion.div
            animate="visible"
            className="flex h-[280px] flex-col"
            custom={1}
            initial="hidden"
            variants={entry}
          >
            <div className="mb-4 w-full space-y-2 text-center">
              <AnimatePresence initial={false} mode="wait">
                <motion.h2
                  animate="animate"
                  className="font-semibold text-lg text-zinc-900 uppercase tracking-tighter dark:text-zinc-100"
                  exit="exit"
                  initial="initial"
                  key={completed ? "completed-title" : "processing-title"}
                  variants={swap}
                >
                  {completed ? "Transfer Completed" : "Transfer in Progress"}
                </motion.h2>
              </AnimatePresence>
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  animate="animate"
                  className="font-medium text-emerald-600 text-xs dark:text-emerald-400"
                  exit="exit"
                  initial="initial"
                  key={completed ? "completed-id" : "processing-status"}
                  variants={swap}
                >
                  {completed
                    ? `Transaction ID: ${txnId}`
                    : "Processing Transaction..."}
                </motion.div>
              </AnimatePresence>

              <div className="mt-4 flex flex-col items-start gap-3">
                <AccountRow
                  account={from}
                  completed={completed}
                  direction="from"
                  reduceMotion={reduceMotion}
                />
                <AccountRow
                  account={to}
                  completed={completed}
                  direction="to"
                  reduceMotion={reduceMotion}
                />
              </div>

              <div className="mt-2 flex items-center justify-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <AnimatePresence initial={false} mode="wait">
                  <motion.span
                    animate="animate"
                    exit="exit"
                    initial="initial"
                    key={completed ? "completed-rate" : "calculating-rate"}
                    variants={swap}
                  >
                    {completed
                      ? `Exchange Rate: 1 ${from.currency} = ${rate} ${to.currency}`
                      : "Calculating exchange rate..."}
                  </motion.span>
                </AnimatePresence>
                <Tooltip>
                  <TooltipTrigger
                    aria-label="Exchange rate details"
                    className="rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  >
                    <InfoIcon
                      aria-hidden="true"
                      className="h-3 w-3 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {completed
                        ? `Rate updated at ${timestamp}`
                        : "Please wait..."}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </motion.div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
