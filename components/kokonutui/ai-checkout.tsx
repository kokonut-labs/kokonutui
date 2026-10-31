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

import { Check, Coffee, CreditCard } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface CheckoutOrder {
  title: string;
  subtitle: string;
  /** Amounts in cents. */
  subtotal: number;
  shipping: number;
  tax: number;
  currency?: string;
  /** e.g. "Visa •• 4242". */
  paymentMethod: string;
  /** e.g. "Arrives Tue, Nov 4". */
  delivery: string;
  icon?: ReactNode;
}

export interface AICheckoutProps {
  prompt?: string;
  /** What the assistant says before the order. */
  message?: string;
  /** What it says once paid. */
  confirmation?: string;
  order?: CheckoutOrder;
  /**
   * Charges the order. Resolve with an order number, or throw to show an
   * error. The demo waits a moment and resolves.
   */
  onPay?: () => Promise<string>;
  /** Opens the receipt once paid. */
  onReceipt?: (orderId: string) => void;
  className?: string;
}

type Status = "review" | "paying" | "paid" | "receipt" | "dismissed";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const PAY_MS = 1400;

const DEMO_ORDER: CheckoutOrder = {
  title: "Ethiopia Guji",
  subtitle: "Whole bean · 2 × 250 g",
  subtotal: 3800,
  shipping: 0,
  tax: 304,
  paymentMethod: "Visa •• 4242",
  delivery: "Arrives Tue, Nov 4",
};

const demoPay = () =>
  new Promise<string>((resolve) => setTimeout(() => resolve("7F2K"), PAY_MS));

export default function AICheckout({
  prompt = "Reorder the coffee beans I got last month",
  message = "Same as October: two bags of Ethiopia Guji, whole bean. Here’s the order.",
  confirmation = "Done. I’ll tell you when it ships.",
  order = DEMO_ORDER,
  onPay = demoPay,
  onReceipt,
  className,
}: AICheckoutProps) {
  const [status, setStatus] = useState<Status>("review");
  const [orderId, setOrderId] = useState("");
  const total = order.subtotal + order.shipping + order.tax;
  const money = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: order.currency ?? "USD",
    }).format(cents / 100);

  // Shows "Paid" on the button for a beat, then folds the card.
  useEffect(() => {
    if (status !== "paid") {
      return;
    }
    const t = setTimeout(() => setStatus("receipt"), 750);
    return () => clearTimeout(t);
  }, [status]);

  const pay = async () => {
    setStatus("paying");
    try {
      setOrderId(await onPay());
      setStatus("paid");
    } catch {
      setStatus("review");
    }
  };

  const folded = status === "receipt" || status === "dismissed";

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("flex w-full max-w-md flex-col gap-4", className)}>
        <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-zinc-100 px-3.5 py-2 text-[14px] text-zinc-800 leading-snug dark:bg-zinc-800 dark:text-zinc-100">
          {prompt}
        </p>
        <p className="text-[15px] text-zinc-800 leading-7 dark:text-zinc-200">
          {message}
        </p>

        <AutoHeight className="rounded-2xl bg-white ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10">
          <AnimatePresence initial={false} mode="popLayout">
            {folded ? (
              <motion.div
                animate={{ opacity: 1, filter: "blur(0px)" }}
                initial={{ opacity: 0, filter: "blur(3px)" }}
                key="receipt"
                transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.08 }}
              >
                {status === "receipt" ? (
                  <Receipt
                    delivery={order.delivery}
                    onReceipt={() => onReceipt?.(orderId)}
                    orderId={orderId}
                    title={order.title}
                    total={money(total)}
                  />
                ) : (
                  <div className="flex h-12 items-center justify-between px-4 text-[13px]">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Order not placed
                    </span>
                    <button
                      className="rounded-md px-1.5 py-0.5 font-medium text-zinc-700 outline-hidden transition-colors duration-100 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:text-zinc-200 dark:hover:bg-white/[0.07]"
                      onClick={() => setStatus("review")}
                      type="button"
                    >
                      Review again
                    </button>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                exit={{ opacity: 0, filter: "blur(3px)" }}
                key="order"
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-start gap-3 p-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#6f4e37] text-[#f3e6d8]">
                    {order.icon ?? <Coffee className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[14px] text-zinc-900 dark:text-zinc-100">
                      {order.title}
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-zinc-500 dark:text-zinc-400">
                      {order.subtitle}
                    </p>
                  </div>
                  <span className="text-[14px] text-zinc-900 tabular-nums dark:text-zinc-100">
                    {money(order.subtotal)}
                  </span>
                </div>

                <dl className="mx-4 space-y-1.5 border-black/[0.06] border-t border-dashed py-3 text-[13px] dark:border-white/10">
                  <Line label="Shipping">
                    {order.shipping === 0 ? "Free" : money(order.shipping)}
                  </Line>
                  <Line label="Tax">{money(order.tax)}</Line>
                  <Line label="Total" strong>
                    {money(total)}
                  </Line>
                </dl>

                <div className="flex items-center gap-2 border-black/[0.06] border-t px-4 py-2.5 text-[12.5px] text-zinc-500 dark:border-white/[0.08] dark:text-zinc-400">
                  <CreditCard aria-hidden="true" className="size-3.5" />
                  <span>{order.paymentMethod}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{order.delivery}</span>
                </div>

                <div className="flex gap-2 px-3 pb-3">
                  <button
                    className="h-10 rounded-xl px-3.5 text-[14px] text-zinc-600 outline-hidden transition-colors duration-100 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400/50 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-white/[0.07]"
                    disabled={status !== "review"}
                    onClick={() => setStatus("dismissed")}
                    type="button"
                  >
                    Not now
                  </button>
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
              animate={{ opacity: 1, filter: "blur(0px)" }}
              className="text-[15px] text-zinc-800 leading-7 dark:text-zinc-200"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0, filter: "blur(4px)" }}
              transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.35 }}
            >
              {confirmation}
            </motion.p>
          )}
        </AnimatePresence>
        <p aria-live="polite" className="sr-only">
          {status === "paying" ? "Paying" : ""}
          {status === "paid" || status === "receipt" ? "Payment complete" : ""}
        </p>
      </div>
    </MotionConfig>
  );
}

function Line({
  label,
  strong = false,
  children,
}: {
  label: string;
  strong?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex justify-between">
      <dt
        className={
          strong
            ? "font-medium text-zinc-900 dark:text-zinc-100"
            : "text-zinc-500 dark:text-zinc-400"
        }
      >
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums",
          strong
            ? "font-medium text-zinc-900 dark:text-zinc-100"
            : "text-zinc-600 dark:text-zinc-300"
        )}
      >
        {children}
      </dd>
    </div>
  );
}

/** The bar fills while the charge runs, then the button turns green. */
function PayButton({
  status,
  label,
  onPay,
}: {
  status: Status;
  label: string;
  onPay: () => void;
}) {
  const paid = status === "paid" || status === "receipt";
  return (
    <button
      aria-busy={status === "paying"}
      className={cn(
        "relative h-10 flex-1 overflow-hidden rounded-xl font-medium text-[14px] outline-hidden transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-zinc-400/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900",
        paid
          ? "bg-emerald-600 text-white dark:bg-emerald-500"
          : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      )}
      disabled={status !== "review"}
      onClick={onPay}
      type="button"
    >
      <AnimatePresence>
        {status === "paying" && (
          <motion.span
            animate={{ scaleX: 1 }}
            className="absolute inset-0 origin-left bg-white/15 dark:bg-black/10"
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            initial={{ scaleX: 0 }}
            transition={{ duration: PAY_MS / 1000, ease: [0.4, 0, 0.2, 1] }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ opacity: 1, y: 0 }}
          className="relative flex items-center justify-center gap-1.5 tabular-nums"
          exit={{ opacity: 0, y: -6 }}
          initial={{ opacity: 0, y: 6 }}
          key={paid ? "paid" : status}
          transition={{ duration: 0.18, ease: EASE_OUT }}
        >
          {paid && <Check aria-hidden="true" className="size-4" />}
          {paid && "Paid"}
          {status === "paying" && "Paying…"}
          {status === "review" && label}
          {status === "dismissed" && label}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function Receipt({
  total,
  title,
  orderId,
  delivery,
  onReceipt,
}: {
  onReceipt: () => void;
  total: string;
  title: string;
  orderId: string;
  delivery: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <motion.span
        animate={{ scale: 1 }}
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500"
        initial={{ scale: 0.6 }}
        transition={{ type: "spring", stiffness: 500, damping: 26, delay: 0.1 }}
      >
        <Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
      </motion.span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] text-zinc-900 dark:text-zinc-100">
          <span className="font-medium tabular-nums">Paid {total}</span>
          <span className="text-zinc-500 dark:text-zinc-400"> · {title}</span>
        </p>
        <p className="mt-0.5 truncate text-[12px] text-zinc-500 dark:text-zinc-400">
          Order {orderId} · {delivery}
        </p>
      </div>
      <button
        className="shrink-0 rounded-md px-1.5 py-0.5 font-medium text-[12.5px] text-zinc-700 outline-hidden transition-colors duration-100 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:text-zinc-200 dark:hover:bg-white/[0.07]"
        onClick={onReceipt}
        type="button"
      >
        Receipt
      </button>
    </div>
  );
}

/** Eases the card to its content's height when the content swaps. */
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
      transition={{ duration: 0.4, ease: EASE_OUT }}
    >
      <div ref={innerRef}>{children}</div>
    </motion.div>
  );
}
