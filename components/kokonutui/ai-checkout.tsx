"use client";

/**
 * @author: @kokonutui
 * @description: AI Checkout
 * @version: 1.0.0
 * @date: 2026-10-31
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, Coffee, Lock, Minus, Plus } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface CheckoutItem {
  title: string;
  subtitle: string;
  /** Price of one, in cents. */
  unitPrice: number;
  quantity: number;
  /** Most you can order in one go. */
  maxQuantity?: number;
  icon?: ReactNode;
}

export interface CheckoutDetails {
  merchant: string;
  item: CheckoutItem;
  /** Tax rate, e.g. 0.08. */
  taxRate: number;
  currency?: string;
  /** Last four digits of the saved card. */
  cardLast4: string;
  /** e.g. "Arrives Tue, Nov 4". */
  delivery: string;
}

export interface AICheckoutProps {
  prompt?: string;
  /** What the assistant says before the order. */
  message?: string;
  /** What it says once paid. */
  confirmation?: string;
  checkout?: CheckoutDetails;
  /**
   * Charges the card for this many items. Resolve with an order number, or
   * throw to go back to the order. The demo waits a moment and resolves.
   */
  onPay?: (quantity: number, total: number) => Promise<string>;
  className?: string;
}

type Status = "review" | "paying" | "paid" | "receipt";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const MORPH = { type: "spring", stiffness: 420, damping: 36 } as const;

const DEMO: CheckoutDetails = {
  merchant: "Northside Roasters",
  item: {
    title: "Ethiopia Guji",
    subtitle: "Whole bean, 250 g",
    unitPrice: 1900,
    quantity: 2,
    maxQuantity: 6,
  },
  taxRate: 0.08,
  cardLast4: "4242",
  delivery: "Arrives Tue, Nov 4",
};

const demoPay = () =>
  new Promise<string>((resolve) => setTimeout(() => resolve("7F2K"), 1500));

export default function AICheckout({
  prompt = "Reorder the coffee beans I got last month",
  message = "Same as October, two bags of Ethiopia Guji. Want me to place it?",
  confirmation = "Done. I’ll tell you when it ships.",
  checkout = DEMO,
  onPay = demoPay,
  className,
}: AICheckoutProps) {
  const { item } = checkout;
  const [status, setStatus] = useState<Status>("review");
  const [quantity, setQuantity] = useState(item.quantity);
  const [orderId, setOrderId] = useState("");

  const subtotal = item.unitPrice * quantity;
  const tax = Math.round(subtotal * checkout.taxRate);
  const total = subtotal + tax;
  const money = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: checkout.currency ?? "USD",
    }).format(cents / 100);

  // Holds the drawn check for a beat, then folds into the receipt.
  useEffect(() => {
    if (status !== "paid") {
      return;
    }
    const t = setTimeout(() => setStatus("receipt"), 900);
    return () => clearTimeout(t);
  }, [status]);

  const pay = async () => {
    setStatus("paying");
    try {
      setOrderId(await onPay(quantity, total));
      setStatus("paid");
    } catch {
      setStatus("review");
    }
  };

  const locked = status !== "review";

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("flex w-full max-w-md flex-col gap-4", className)}>
        <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-zinc-100 px-3.5 py-2 text-[14px] text-zinc-800 leading-snug dark:bg-zinc-800 dark:text-zinc-100">
          {prompt}
        </p>
        <p className="text-[15px] text-zinc-800 leading-7 dark:text-zinc-200">
          {message}
        </p>

        <AutoHeight className="rounded-[22px] bg-black/[0.04] dark:bg-white/[0.06]">
          <AnimatePresence initial={false} mode="popLayout">
            {status === "receipt" ? (
              <motion.div
                animate={{ opacity: 1, filter: "blur(0px)" }}
                initial={{ opacity: 0, filter: "blur(4px)" }}
                key="receipt"
                transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.1 }}
              >
                <Receipt
                  delivery={checkout.delivery}
                  merchant={checkout.merchant}
                  orderId={orderId}
                  total={money(total)}
                />
              </motion.div>
            ) : (
              <motion.div
                exit={{ opacity: 0, filter: "blur(4px)" }}
                key="order"
                transition={{ duration: 0.2 }}
              >
                <div className="flex h-8 items-center justify-between px-3 text-[12px] text-zinc-500 dark:text-zinc-400">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {checkout.merchant}
                  </span>
                  <span className="flex items-center gap-1">
                    <Lock aria-hidden="true" className="size-3" />
                    Secure checkout
                  </span>
                </div>

                <div className="rounded-[18px] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-black/[0.06] dark:bg-zinc-900 dark:ring-white/[0.08]">
                  <div className="flex items-center gap-3 p-3.5">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#6f4e37] text-[#f3e6d8]">
                      {item.icon ?? <Coffee className="size-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[14px] text-zinc-900 dark:text-zinc-100">
                        {item.title}
                      </p>
                      <p className="mt-0.5 truncate text-[12.5px] text-zinc-500 dark:text-zinc-400">
                        {money(item.unitPrice)} · {item.subtitle}
                      </p>
                    </div>
                    <Stepper
                      disabled={locked}
                      max={item.maxQuantity ?? 9}
                      onChange={setQuantity}
                      value={quantity}
                    />
                  </div>

                  <dl className="mx-3.5 space-y-1 border-black/[0.08] border-t border-dashed py-3 text-[13px] dark:border-white/10">
                    <Line label="Subtotal" value={money(subtotal)} />
                    <Line label="Shipping" value="Free" />
                    <Line label="Tax" value={money(tax)} />
                  </dl>
                  <div className="flex items-baseline justify-between border-black/[0.06] border-t px-3.5 py-3 dark:border-white/[0.08]">
                    <span className="font-medium text-[14px] text-zinc-900 dark:text-zinc-100">
                      Total
                    </span>
                    <Rolling
                      className="font-semibold text-[17px] text-zinc-900 tracking-tight dark:text-zinc-100"
                      value={money(total)}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 py-1 pr-1 pl-3">
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px] text-zinc-600 dark:text-zinc-300">
                    <CardChip />
                    <span className="whitespace-nowrap tabular-nums tracking-wide">
                      •••• {checkout.cardLast4}
                    </span>
                    <span className="hidden truncate text-zinc-400 sm:inline dark:text-zinc-500">
                      · {checkout.delivery}
                    </span>
                  </span>
                  <PayButton
                    label={`Pay ${money(total)}`}
                    onPay={pay}
                    status={status}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </AutoHeight>

        <AnimatePresence>
          {status === "receipt" && (
            <motion.p
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              className="text-[15px] text-zinc-800 leading-7 dark:text-zinc-200"
              initial={{ opacity: 0, filter: "blur(4px)", y: 4 }}
              transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.4 }}
            >
              {confirmation}
            </motion.p>
          )}
        </AnimatePresence>
        <p aria-live="polite" className="sr-only">
          {status === "paying" ? "Processing payment" : ""}
          {status === "paid" || status === "receipt" ? "Payment complete" : ""}
        </p>
      </div>
    </MotionConfig>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-zinc-700 tabular-nums dark:text-zinc-300">
        <Rolling value={value} />
      </dd>
    </div>
  );
}

/** Text that rolls up when it changes, for prices and counts. */
function Rolling({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex overflow-hidden tabular-nums",
        className
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-60%", opacity: 0 }}
          initial={{ y: "60%", opacity: 0 }}
          key={value}
          transition={{ duration: 0.22, ease: EASE_OUT }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Stepper({
  value,
  max,
  disabled,
  onChange,
}: {
  value: number;
  max: number;
  disabled: boolean;
  onChange: (n: number) => void;
}) {
  const button =
    "flex size-7 items-center justify-center rounded-full text-zinc-600 outline-hidden transition-colors duration-100 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400/50 disabled:pointer-events-none disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-white/[0.08] dark:hover:text-white";
  return (
    <div className="flex items-center rounded-full p-0.5 ring-1 ring-black/[0.08] dark:ring-white/10">
      <button
        aria-label="One fewer"
        className={button}
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
        type="button"
      >
        <Minus className="size-3.5" />
      </button>
      <Rolling
        className="w-5 justify-center font-medium text-[13px] text-zinc-900 dark:text-zinc-100"
        value={String(value)}
      />
      <button
        aria-label="One more"
        className={button}
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
        type="button"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

/** A small card face, so the saved method reads at a glance. */
function CardChip() {
  return (
    <span
      aria-hidden="true"
      className="relative flex h-[18px] w-[27px] shrink-0 items-end justify-end overflow-hidden rounded-[4px] bg-[#1a1f71] px-[3px] pb-[2px]"
    >
      <span className="absolute top-[4px] left-[3px] h-[5px] w-[7px] rounded-[1.5px] bg-[#d9b56b]" />
      <span className="font-black text-[6.5px] text-white italic leading-none tracking-tight">
        VISA
      </span>
    </span>
  );
}

/**
 * Pay folds into a ring while the charge runs, then fills green and draws
 * its check.
 */
function PayButton({
  status,
  label,
  onPay,
}: {
  status: Status;
  label: string;
  onPay: () => void;
}) {
  const round = status !== "review";
  const paid = status === "paid" || status === "receipt";
  let name = label;
  if (round) {
    name = paid ? "Paid" : "Paying";
  }

  return (
    <motion.button
      aria-label={name}
      className={cn(
        "relative flex h-10 shrink-0 items-center justify-center overflow-hidden font-medium text-[14px] outline-hidden transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-zinc-400/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900",
        round ? "w-10" : "px-4",
        paid
          ? "bg-emerald-600 text-white dark:bg-emerald-500"
          : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      )}
      disabled={round}
      layout
      onClick={onPay}
      style={{ borderRadius: 999 }}
      transition={{ layout: MORPH }}
      type="button"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {status === "review" && (
          <motion.span
            animate={{ opacity: 1 }}
            className="whitespace-nowrap tabular-nums"
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            initial={{ opacity: 0 }}
            key="label"
            layout="position"
          >
            {label}
          </motion.span>
        )}
        {status === "paying" && (
          <motion.svg
            animate={{ opacity: 1, rotate: 360 }}
            aria-hidden="true"
            className="size-5"
            exit={{ opacity: 0 }}
            fill="none"
            initial={{ opacity: 0 }}
            key="ring"
            transition={{
              opacity: { duration: 0.15, delay: 0.12 },
              rotate: {
                duration: 0.9,
                ease: "linear",
                repeat: Number.POSITIVE_INFINITY,
              },
            }}
            viewBox="0 0 20 20"
          >
            <circle
              cx="10"
              cy="10"
              opacity="0.25"
              r="8"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M10 2a8 8 0 0 1 8 8"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
            />
          </motion.svg>
        )}
        {paid && (
          <motion.svg
            aria-hidden="true"
            className="size-5"
            fill="none"
            key="check"
            viewBox="0 0 20 20"
          >
            <motion.path
              animate={{ pathLength: 1 }}
              d="M5 10.5l3.2 3.2L15 6.8"
              initial={{ pathLength: 0 }}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.2"
              transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.1 }}
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function Receipt({
  total,
  merchant,
  orderId,
  delivery,
}: {
  total: string;
  merchant: string;
  orderId: string;
  delivery: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-white px-3.5 py-3 ring-1 ring-black/[0.06] dark:bg-zinc-900 dark:ring-white/[0.08]">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-400">
        <Check aria-hidden="true" className="size-4" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] text-zinc-900 dark:text-zinc-100">
          <span className="font-medium tabular-nums">Paid {total}</span>
          <span className="text-zinc-500 dark:text-zinc-400">
            {" "}
            to {merchant}
          </span>
        </p>
        <p className="mt-0.5 truncate text-[12px] text-zinc-500 dark:text-zinc-400">
          {delivery}
        </p>
      </div>
      <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-white/[0.07] dark:text-zinc-300">
        #{orderId}
      </span>
    </div>
  );
}

/** Eases the frame to its content's height when the content swaps. */
function AutoHeight({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) {
      return;
    }
    const observer = new ResizeObserver(() => setHeight(inner.offsetHeight));
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      animate={{ height }}
      className={cn("overflow-hidden", className)}
      initial={false}
      transition={{ duration: 0.45, ease: EASE_OUT }}
    >
      <div className="p-1" ref={innerRef}>
        {children}
      </div>
    </motion.div>
  );
}
