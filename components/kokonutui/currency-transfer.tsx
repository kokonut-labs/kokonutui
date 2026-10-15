"use client";

/**
 * @author: @dorianbaffier
 * @description: Currency Transfer
 * @version: 3.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { CheckIcon, CopyIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type TransferStatus = "processing" | "completed" | "failed";

export interface TransferAccount {
  /** Amount sent from / received into this account. */
  amount: number;
  /** ISO currency code, e.g. "USD". */
  currency: string;
  /** Short symbol, e.g. "$". Defaults to the currency's own symbol. */
  symbol?: string;
  /** Bank or account name, e.g. "Chase Bank". */
  bank: string;
  /** Last digits of the account number, shown masked. */
  last4?: string;
  /** Account holder, shown on the receiving side, e.g. "Lena Fischer". */
  name?: string;
}

export interface CurrencyTransferProps {
  from?: TransferAccount;
  to?: TransferAccount;
  /** Units of `to.currency` per one unit of `from.currency`. */
  rate?: number;
  /** Transaction reference, copyable from the footer. */
  txnId?: string;
  /** When the rate was locked, e.g. "10:45 AM". */
  timestamp?: string;
  /**
   * Controlled status. While "processing" the steps run up to the last
   * one and wait there. Leave unset for a demo that completes on its own.
   */
  status?: TransferStatus;
  /** BCP 47 locale for amounts, symbols and the rate. */
  locale?: string;
  /** Shows a Retry button when the transfer has failed. */
  onRetry?: () => void;
  className?: string;
}

const DEFAULT_FROM: TransferAccount = {
  amount: 500,
  currency: "USD",
  symbol: "$",
  bank: "Chase",
  last4: "4589",
};

const DEFAULT_TO: TransferAccount = {
  amount: 460,
  currency: "EUR",
  symbol: "€",
  bank: "Deutsche Bank",
  last4: "7823",
  name: "Lena Fischer",
};

const EASE_OUT_CSS = "cubic-bezier(0.23, 1, 0.32, 1)";
// Each step takes this long in the demo, and while processing.
const STEP_MS = 1100;
// Steps done at first render: the payment has already been taken.
const FIRST_DONE = 1;
// While processing, the run waits on the last step (arrival).
const WAIT_AT = 3;
const DIGIT_STAGGER_MS = 35;
const DIGIT_ROLL_MS = 650;
const COPIED_MS = 1500;
const NOT_LETTER = /[^\p{L}]+/u;

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

const initialsOf = (name: string) =>
  name
    .split(NOT_LETTER)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

/**
 * An odometer: each digit is a 0-9 strip in a one-digit window, moved with
 * translateY. Columns are keyed from the right so a changing length keeps
 * them aligned, and the right-most column moves first.
 */
function RollingNumber({ value }: { value: string }) {
  const chars = Array.from(value);
  return (
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
              // Reduced motion is handled in CSS, so the server and the
              // client render the same markup.
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
  );
}

/** Two symbols in one cell, crossfading, so the amount never shifts. */
function SwapSymbol({
  from,
  to,
  showTo,
}: {
  from: string;
  to: string;
  showTo: boolean;
}) {
  const face =
    "col-start-1 row-start-1 text-right transition-[opacity,filter] duration-300 motion-reduce:transition-none";
  return (
    <span aria-hidden="true" className="inline-grid">
      <span className={cn(face, showTo && "opacity-0 blur-[3px]")}>{from}</span>
      <span className={cn(face, !showTo && "opacity-0 blur-[3px]")}>{to}</span>
    </span>
  );
}

type StepState = "done" | "active" | "pending" | "failed";

function StepNode({ state }: { state: StepState }) {
  return (
    <span className="relative flex size-5 shrink-0 items-center justify-center">
      {/* Pending: an empty ring. Active: the ring with a turning arc. */}
      <span
        className={cn(
          "absolute inset-0 rounded-full border-[1.5px] transition-colors duration-300",
          (state === "pending" || state === "active") &&
            "border-zinc-200 dark:border-zinc-700",
          state === "done" &&
            "border-zinc-900 bg-zinc-900 dark:border-zinc-100 dark:bg-zinc-100",
          state === "failed" && "border-red-500 bg-red-500"
        )}
      />
      {state === "active" && (
        <svg
          aria-hidden="true"
          className="absolute inset-0 animate-spin text-zinc-900 [animation-duration:900ms] motion-reduce:animate-none dark:text-zinc-100"
          fill="none"
          viewBox="0 0 20 20"
        >
          <path
            d="M10 1.25A8.75 8.75 0 0 1 18.75 10"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.5"
          />
        </svg>
      )}
      {state === "done" && (
        <svg
          aria-hidden="true"
          className="relative size-3 text-white dark:text-zinc-900"
          fill="none"
          viewBox="0 0 12 12"
        >
          {/* The tick draws once, as the step finishes. */}
          <path
            className="animate-[ct-draw_300ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none"
            d="M2.5 6.25 5 8.5l4.5-5"
            pathLength={1}
            stroke="currentColor"
            strokeDasharray="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.75"
          />
        </svg>
      )}
      {state === "failed" && (
        <XIcon
          aria-hidden="true"
          className="relative size-3 text-white"
          strokeWidth={3}
        />
      )}
    </span>
  );
}

/** The reference, with a copy button that confirms in place. */
function TxnId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const icon =
    "col-start-1 row-start-1 size-3 transition-[opacity,filter] duration-150";
  return (
    <button
      aria-label={copied ? "Reference copied" : `Copy reference ${id}`}
      className="-mx-1.5 -my-1 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 font-mono text-zinc-600 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      onClick={() => {
        navigator.clipboard
          ?.writeText(id)
          .then(() => setCopied(true))
          .catch(() => {
            // Clipboard blocked (permissions, insecure origin): no tick.
          });
      }}
      type="button"
    >
      {id}
      <span aria-hidden="true" className="grid size-3 place-items-center">
        <CopyIcon
          className={cn(icon, copied ? "opacity-0 blur-[2px]" : "opacity-60")}
        />
        <CheckIcon
          className={cn(
            icon,
            "text-emerald-600 dark:text-emerald-400",
            copied ? "opacity-100" : "opacity-0 blur-[2px]"
          )}
          strokeWidth={3}
        />
      </span>
    </button>
  );
}

const PILL: Record<TransferStatus, { label: string; className: string }> = {
  processing: {
    label: "In progress",
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  },
  completed: {
    label: "Arrived",
    className:
      "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
  },
  failed: {
    label: "Failed",
    className:
      "bg-red-500/10 text-red-700 dark:bg-red-400/10 dark:text-red-300",
  },
};

/**
 * Steps done so far. Runs a step at a time while processing and waits on
 * the last one; a fresh "processing" (a retry) starts over.
 */
function useProgress(status: TransferStatus) {
  const [progress, setProgress] = useState(FIRST_DONE);
  const [runFor, setRunFor] = useState(status);
  if (runFor !== status) {
    setRunFor(status);
    if (status === "processing") {
      setProgress(FIRST_DONE);
    }
  }
  useEffect(() => {
    if (status !== "processing" || progress >= WAIT_AT) {
      return;
    }
    const timer = setTimeout(() => setProgress((p) => p + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [status, progress]);
  return status === "completed" ? 4 : progress;
}

export default function CurrencyTransfer({
  from = DEFAULT_FROM,
  to = DEFAULT_TO,
  rate = 0.92,
  txnId = "TXN-DAB3UL494",
  timestamp = "10:45 AM",
  status,
  locale = "en-US",
  onRetry,
  className,
}: CurrencyTransferProps = {}) {
  const isControlled = status !== undefined;
  const [demoStatus, setDemoStatus] = useState<TransferStatus>("processing");
  const current = status ?? demoStatus;
  const done = useProgress(current);

  // Demo only: once the run reaches the last step, the money arrives.
  useEffect(() => {
    if (isControlled || current !== "processing" || done < WAIT_AT) {
      return;
    }
    const timer = setTimeout(() => setDemoStatus("completed"), STEP_MS);
    return () => clearTimeout(timer);
  }, [isControlled, current, done]);

  const converted = done >= 2;
  const shown = converted ? to : from;
  const recipient = to.name ?? to.bank;
  const toAccount = `${to.bank}${to.last4 ? ` ••${to.last4}` : ""}`;
  const fromAccount = `${from.bank}${from.last4 ? ` ••${from.last4}` : ""}`;
  const rateText = `1 ${from.currency} = ${formatNumber(rate, locale, 4)} ${to.currency}`;
  const arrived = current === "completed";

  const steps = [
    { id: "paid", title: "Payment received", detail: `From ${fromAccount}` },
    { id: "converted", title: `Converted to ${to.currency}`, detail: rateText },
    { id: "sent", title: `Sent to ${to.bank}`, detail: toAccount },
    {
      id: "arrived",
      title: arrived ? "Arrived" : "Arriving",
      detail: arrived
        ? `${recipient} can use it now`
        : "Usually within a minute",
    },
  ];

  const stateOf = (index: number): StepState => {
    if (index < done) {
      return "done";
    }
    if (index === done) {
      return current === "failed" ? "failed" : "active";
    }
    return "pending";
  };

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-sm rounded-2xl bg-white p-5 ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800",
        "shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.12)]",
        className
      )}
    >
      {/* Draws the step ticks; a scoped name so it can't clash with app CSS. */}
      <style>
        {"@keyframes ct-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}"}
      </style>
      <output aria-live="polite" className="sr-only">
        {arrived &&
          `Transfer arrived. ${formatNumber(to.amount, locale, 2)} ${to.currency} to ${recipient}.`}
        {current === "failed" && `Transfer failed. Refunded to ${fromAccount}.`}
        {current === "processing" && steps[Math.min(done, 3)].title}
      </output>

      {/* Who it's for, and where it stands. */}
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 font-medium text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {initialsOf(recipient)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-medium text-sm text-zinc-900 dark:text-zinc-100">
            {recipient}
          </p>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {toAccount}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex h-6 shrink-0 items-center rounded-full px-2 font-medium text-[11px] transition-colors duration-300",
            PILL[current].className
          )}
        >
          {PILL[current].label}
        </span>
      </div>

      {/* The amount converts in place once the conversion step is done. */}
      <div className="mt-6">
        <p className="font-semibold text-4xl text-zinc-900 tracking-tight dark:text-zinc-50">
          <span className="sr-only">
            {formatNumber(shown.amount, locale, 2)} {shown.currency}
          </span>
          <SwapSymbol
            from={symbolOf(from, locale)}
            showTo={converted}
            to={symbolOf(to, locale)}
          />
          <RollingNumber value={formatNumber(shown.amount, locale, 2)} />
        </p>
        <p className="mt-1 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          {formatNumber(from.amount, locale, 2)} {from.currency} sent ·{" "}
          {formatNumber(to.amount, locale, 2)} {to.currency} received
        </p>
      </div>

      <ol className="mt-6">
        {steps.map((step, index) => {
          const state = stateOf(index);
          const last = index === steps.length - 1;
          return (
            <li className="flex gap-3" key={step.id}>
              <div className="flex flex-col items-center">
                <StepNode state={state} />
                {!last && (
                  // The rail fills down from each finished step.
                  <span className="relative my-1 w-[1.5px] flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <span
                      className={cn(
                        "absolute inset-0 origin-top bg-zinc-900 transition-[scale] duration-500 motion-reduce:transition-none dark:bg-zinc-100",
                        index < done - 1 ? "scale-y-100" : "scale-y-0"
                      )}
                      style={{ transitionTimingFunction: EASE_OUT_CSS }}
                    />
                  </span>
                )}
              </div>
              <div className={cn("min-w-0 flex-1", !last && "pb-4")}>
                <p
                  className={cn(
                    "text-sm leading-5 transition-colors duration-300",
                    state === "pending"
                      ? "text-zinc-400 dark:text-zinc-500"
                      : "text-zinc-900 dark:text-zinc-100",
                    state === "failed" && "text-red-600 dark:text-red-400"
                  )}
                >
                  {state === "failed" ? "Couldn't complete" : step.title}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-xs tabular-nums transition-colors duration-300",
                    state === "pending"
                      ? "text-zinc-400 dark:text-zinc-500"
                      : "text-zinc-500 dark:text-zinc-400"
                  )}
                >
                  {state === "failed"
                    ? `Refunded to ${fromAccount}`
                    : step.detail}
                </p>
                {state === "failed" && onRetry && (
                  <button
                    className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-md bg-zinc-900 px-2.5 font-medium text-white text-xs transition-colors duration-150 hover:bg-zinc-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                    onClick={onRetry}
                    type="button"
                  >
                    <RotateCcwIcon aria-hidden="true" className="size-3" />
                    Retry
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex items-center justify-between border-zinc-100 border-t pt-4 text-xs dark:border-zinc-800">
        <TxnId id={txnId} />
        <span className="text-zinc-400 dark:text-zinc-500">
          Rate locked {timestamp}
        </span>
      </div>
    </div>
  );
}
