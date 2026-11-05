"use client";

/**
 * @author: @kokonutui
 * @description: AI Order Status
 * @version: 1.0.0
 * @date: 2026-11-05
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Bike, Check, Home, MessageCircle, Store } from "lucide-react";
import {
  AnimatePresence,
  animate,
  MotionConfig,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface DeliveryOrder {
  merchant: string;
  orderId: string;
  courier: string;
  vehicle: string;
  /** Minutes left when the card first shows. */
  minutes: number;
  /** How far along the route the courier is, 0 to 1. */
  progress: number;
  /** When it should arrive, as shown. */
  arriveAt: string;
}

export interface AIOrderStatusProps {
  prompt?: string;
  message?: string;
  order?: DeliveryOrder;
  /** Shown once it has arrived. */
  delivered?: string;
  /** Demo timing: real ms per minute of ETA. */
  minuteMs?: number;
  onMessage?: () => void;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const W = 320;
const H = 96;
const ROUTE = "M28 70 C 72 70, 82 30, 128 30 S 182 72, 226 64 S 270 26, 292 26";
const START = { x: 28, y: 70 };
const END = { x: 292, y: 26 };

const DEMO_ORDER: DeliveryOrder = {
  merchant: "Bloom & Stem",
  orderId: "4821",
  courier: "Leo",
  vehicle: "Grey scooter",
  minutes: 12,
  progress: 0.42,
  arriveAt: "2:14 pm",
};

export default function AIOrderStatus({
  prompt = "Where are my flowers?",
  message = "They’re on the way with Leo. I’ll keep this updated.",
  order = DEMO_ORDER,
  delivered = "Delivered. Leo left them with the concierge, and the card is tucked in the front.",
  minuteMs = 700,
  onMessage,
  className,
}: AIOrderStatusProps) {
  const reduce = useReducedMotion();
  const [minutes, setMinutes] = useState(order.minutes);
  const arrived = minutes <= 0;
  const progress = useMotionValue(order.progress);
  const x = useMotionValue(START.x);
  const y = useMotionValue(START.y);
  const pathRef = useRef<SVGPathElement>(null);

  // Keeps the courier on the route as progress moves.
  const place = (v: number) => {
    const path = pathRef.current;
    if (!path) {
      return;
    }
    const point = path.getPointAtLength(v * path.getTotalLength());
    x.set(point.x);
    y.set(point.y);
  };
  useMotionValueEvent(progress, "change", place);
  // biome-ignore lint/correctness/useExhaustiveDependencies: places once on mount
  useLayoutEffect(() => place(progress.get()), []);

  // Counts the ETA down, and moves the courier with it.
  useEffect(() => {
    if (arrived) {
      return;
    }
    const t = setTimeout(() => {
      const next = minutes - 1;
      setMinutes(next);
      const target =
        order.progress + (1 - order.progress) * (1 - next / order.minutes);
      animate(progress, target, {
        duration: reduce ? 0 : minuteMs / 1000,
        ease: "linear",
      });
    }, minuteMs);
    return () => clearTimeout(t);
  }, [minutes, arrived, minuteMs, order, progress, reduce]);

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("flex w-full max-w-md flex-col gap-4", className)}>
        <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-zinc-100 px-3.5 py-2 text-[14px] text-zinc-800 leading-snug dark:bg-zinc-800 dark:text-zinc-100">
          {prompt}
        </p>
        <p className="text-[15px] text-zinc-800 leading-7 dark:text-zinc-200">
          {message}
        </p>

        <div className="rounded-[22px] bg-black/[0.04] p-1 dark:bg-white/[0.06]">
          <div className="flex h-8 items-center justify-between px-3 text-[12px] text-zinc-500 dark:text-zinc-400">
            <span className="truncate">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {order.merchant}
              </span>{" "}
              · Order #{order.orderId}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span
                className={cn(
                  "size-1.5 rounded-full transition-colors duration-300",
                  arrived ? "bg-emerald-500" : "bg-blue-500"
                )}
              />
              {arrived ? "Delivered" : "Live"}
            </span>
          </div>

          <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-black/[0.06] dark:bg-zinc-900 dark:ring-white/[0.08]">
            <div className="flex items-end justify-between gap-3 px-4 pt-3.5">
              <div className="min-w-0">
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                  {arrived
                    ? `Arrived at ${order.arriveAt}`
                    : `Arriving around ${order.arriveAt}`}
                </p>
                <div className="mt-0.5 h-8 overflow-hidden font-semibold text-[26px] text-zinc-900 tracking-tight dark:text-zinc-100">
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                      className="block leading-8"
                      exit={{ y: -14, opacity: 0, filter: "blur(2px)" }}
                      initial={{ y: 14, opacity: 0, filter: "blur(2px)" }}
                      key={arrived ? "done" : minutes}
                      transition={{ duration: 0.3, ease: EASE_OUT }}
                    >
                      {arrived ? (
                        "Delivered"
                      ) : (
                        <>
                          <span className="tabular-nums">{minutes}</span>
                          <span className="ml-1 font-medium text-[15px] text-zinc-500 tracking-normal dark:text-zinc-400">
                            min
                          </span>
                        </>
                      )}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>
              <Steps arrived={arrived} />
            </div>

            <div className="relative mt-2">
              <svg
                aria-hidden="true"
                className="block h-auto w-full"
                viewBox={`0 0 ${W} ${H}`}
              >
                <g className="stroke-zinc-100 dark:stroke-white/[0.05]">
                  <path d="M0 48 H320" strokeWidth="6" />
                  <path d="M96 0 V96" strokeWidth="5" />
                  <path d="M200 0 L250 96" strokeWidth="5" />
                  <path d="M0 14 L140 4" strokeWidth="4" />
                </g>
                <path
                  className="stroke-zinc-300 dark:stroke-zinc-600"
                  d={ROUTE}
                  fill="none"
                  ref={pathRef}
                  strokeDasharray="2 5"
                  strokeLinecap="round"
                  strokeWidth="2"
                />
                <motion.path
                  className={cn(
                    "transition-colors duration-500",
                    arrived
                      ? "stroke-emerald-500"
                      : "stroke-zinc-900 dark:stroke-zinc-100"
                  )}
                  d={ROUTE}
                  fill="none"
                  strokeLinecap="round"
                  strokeWidth="2.5"
                  style={{ pathLength: progress }}
                />
                <Pin x={START.x} y={START.y}>
                  <Store height={11} width={11} x={-5.5} y={-5.5} />
                </Pin>
                <Pin done={arrived} x={END.x} y={END.y}>
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.g
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      initial={{ opacity: 0 }}
                      key={arrived ? "check" : "home"}
                      transition={{ duration: 0.2, delay: arrived ? 0.15 : 0 }}
                    >
                      {arrived ? (
                        <Check
                          height={12}
                          strokeWidth={3}
                          width={12}
                          x={-6}
                          y={-6}
                        />
                      ) : (
                        <Home height={11} width={11} x={-5.5} y={-5.5} />
                      )}
                    </motion.g>
                  </AnimatePresence>
                </Pin>
                <AnimatePresence>
                  {!arrived && (
                    <motion.g exit={{ opacity: 0 }} style={{ x, y }}>
                      <circle
                        className="fill-zinc-900 dark:fill-white"
                        r="12"
                      />
                      <Bike
                        className="text-white dark:text-zinc-900"
                        height={13}
                        width={13}
                        x={-6.5}
                        y={-6.5}
                      />
                    </motion.g>
                  )}
                </AnimatePresence>
              </svg>
            </div>

            <div className="flex items-center gap-3 border-black/[0.06] border-t px-4 py-3 dark:border-white/[0.08]">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-100 font-semibold text-[12px] text-sky-800 dark:bg-sky-500/20 dark:text-sky-200">
                {order.courier.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-[13.5px] text-zinc-900 dark:text-zinc-100">
                  {order.courier}
                </span>
                <span className="block truncate text-[12px] text-zinc-500 dark:text-zinc-400">
                  {order.vehicle}
                </span>
              </span>
              <button
                className="flex h-8 items-center gap-1.5 rounded-full px-3 font-medium text-[12.5px] text-zinc-700 outline-hidden ring-1 ring-black/[0.08] transition-colors duration-150 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-blue-500/50 active:bg-zinc-100 dark:text-zinc-200 dark:ring-white/10 dark:active:bg-white/[0.08] dark:hover:bg-white/[0.05]"
                onClick={onMessage}
                type="button"
              >
                <MessageCircle aria-hidden="true" className="size-3.5" />
                Message
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {arrived && (
            <motion.p
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              className="text-[15px] text-zinc-800 leading-7 dark:text-zinc-200"
              initial={{ opacity: 0, filter: "blur(4px)", y: 4 }}
              transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.5 }}
            >
              {delivered}
            </motion.p>
          )}
        </AnimatePresence>
        <p aria-live="polite" className="sr-only">
          {arrived ? "Delivered" : ""}
        </p>
      </div>
    </MotionConfig>
  );
}

const STEPS = ["Packed", "On the way", "Delivered"];

/** Three short ticks under the ETA: where the order is at a glance. */
function Steps({ arrived }: { arrived: boolean }) {
  const at = arrived ? 2 : 1;
  return (
    <ol className="mb-1.5 flex shrink-0 gap-1" title={STEPS[at]}>
      {STEPS.map((s, i) => (
        <li
          aria-current={i === at ? "step" : undefined}
          className="relative h-1 w-6 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
          key={s}
        >
          <span className="sr-only">{s}</span>
          <motion.span
            animate={{ scaleX: i <= at ? 1 : 0 }}
            className={cn(
              "absolute inset-0 origin-left rounded-full",
              arrived ? "bg-emerald-500" : "bg-zinc-900 dark:bg-zinc-100"
            )}
            initial={false}
            transition={{ duration: 0.4, ease: EASE_OUT }}
          />
        </li>
      ))}
    </ol>
  );
}

function Pin({
  x,
  y,
  done = false,
  children,
}: {
  x: number;
  y: number;
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle
        className={cn(
          "transition-colors duration-500",
          done
            ? "fill-emerald-500 stroke-emerald-500"
            : "fill-white stroke-zinc-300 dark:fill-zinc-900 dark:stroke-zinc-600"
        )}
        r="11"
        strokeWidth="1.5"
      />
      <g
        className={cn(
          "transition-colors duration-500",
          done ? "text-white" : "text-zinc-500 dark:text-zinc-400"
        )}
      >
        {children}
      </g>
    </g>
  );
}
