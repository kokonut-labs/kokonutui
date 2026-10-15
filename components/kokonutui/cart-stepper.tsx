"use client";

/**
 * @author: @dorianbaffier
 * @description: Cart Stepper
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import {
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
// Holding + or − repeats: first after a pause, then faster and faster.
const REPEAT_DELAY = 400;
const REPEAT_START = 150;
const REPEAT_MIN = 50;
const REPEAT_ACCEL = 0.85;

const ROLL: Variants = {
  enter: (dir: number) => ({
    y: `${dir * 90}%`,
    opacity: 0,
    filter: "blur(2px)",
  }),
  center: { y: "0%", opacity: 1, filter: "blur(0px)" },
  exit: (dir: number) => ({
    y: `${dir * -90}%`,
    opacity: 0,
    filter: "blur(2px)",
  }),
};

const SWAP: Variants = {
  enter: { opacity: 0, rotate: -30, filter: "blur(2px)" },
  center: { opacity: 1, rotate: 0, filter: "blur(0px)" },
  exit: { opacity: 0, rotate: 30, filter: "blur(2px)" },
};

export interface CartStepperProps {
  /** Controlled quantity. */
  quantity?: number;
  defaultQuantity?: number;
  onQuantityChange?: (quantity: number) => void;
  /** Most that can go in the cart, such as the stock left. */
  max?: number;
  label?: string;
  className?: string;
}

export default function CartStepper({
  quantity: quantityProp,
  defaultQuantity = 0,
  onQuantityChange,
  max = 10,
  label = "Add to cart",
  className,
}: CartStepperProps) {
  const [internal, setInternal] = useState(defaultQuantity);
  const quantity = quantityProp ?? internal;
  const [direction, setDirection] = useState(1);
  const [widths, setWidths] = useState<{ add: number; step: number } | null>(
    null
  );
  const reduceMotion = useReducedMotion();
  const open = quantity > 0;

  const addRef = useRef<HTMLButtonElement>(null);
  const stepRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const quantityRef = useRef(quantity);
  quantityRef.current = quantity;
  const repeat = useRef({ timer: 0, delay: REPEAT_START });
  const focusNext = useRef<"add" | "plus" | null>(null);

  // Both faces are measured so the pill can morph between their widths.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new label changes the add face's width
  useLayoutEffect(() => {
    const add = addRef.current?.offsetWidth ?? 0;
    const step = stepRef.current?.offsetWidth ?? 0;
    setWidths({ add, step });
  }, [label]);

  // Focus follows the face that's showing, so keyboard users don't lose it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the face swaps
  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (!target) {
      return;
    }
    // After the swap has rendered, so the target face is no longer inert.
    const frame = requestAnimationFrame(() => {
      (target === "add" ? addRef : plusRef).current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => () => window.clearTimeout(repeat.current.timer), []);

  const set = (next: number) => {
    const clamped = Math.max(0, Math.min(max, next));
    if (clamped === quantityRef.current) {
      return false;
    }
    setDirection(clamped > quantityRef.current ? 1 : -1);
    quantityRef.current = clamped;
    if (quantityProp === undefined) {
      setInternal(clamped);
    }
    onQuantityChange?.(clamped);
    return true;
  };

  // At the stock limit the count shakes instead of moving.
  const refuse = () => {
    countRef.current?.animate?.(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-2px)" },
        { transform: "translateX(2px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 180, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
    );
  };

  const stopRepeat = () => {
    window.clearTimeout(repeat.current.timer);
    repeat.current.timer = 0;
  };

  const stepBy = (delta: number, repeating: boolean) => {
    const current = quantityRef.current;
    // A held − stops at one: removing the item always takes its own press.
    if (delta < 0 && current === 1) {
      if (repeating) {
        return false;
      }
      focusNext.current = "add";
      return set(0);
    }
    if (delta > 0 && current >= max) {
      refuse();
      return false;
    }
    return set(current + delta);
  };

  const startRepeat = (delta: number) => {
    stopRepeat();
    repeat.current.delay = REPEAT_START;
    const loop = () => {
      if (!stepBy(delta, true)) {
        stopRepeat();
        return;
      }
      repeat.current.delay = Math.max(
        REPEAT_MIN,
        repeat.current.delay * REPEAT_ACCEL
      );
      repeat.current.timer = window.setTimeout(loop, repeat.current.delay);
    };
    repeat.current.timer = window.setTimeout(loop, REPEAT_DELAY);
  };

  const pressHandlers = (delta: number) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) {
        return;
      }
      // Pointer presses don't take focus, so collapsing to the add button
      // can't strand it on a face that's going away.
      event.preventDefault();
      stepBy(delta, false);
      if (quantityRef.current > 0) {
        startRepeat(delta);
      }
    },
    onPointerUp: stopRepeat,
    onPointerLeave: stopRepeat,
    onPointerCancel: stopRepeat,
    // Keyboard and assistive tech press with a click that has no pointer down.
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0) {
        stepBy(delta, false);
      }
    },
    onContextMenu: (event: MouseEvent<HTMLButtonElement>) =>
      event.preventDefault(),
  });

  const handleAdd = () => {
    focusNext.current = "plus";
    set(1);
  };

  const fade = reduceMotion
    ? { duration: 0.15 }
    : { duration: 0.2, ease: EASE_OUT };
  const removing = quantity === 1;
  // Once measured, both faces sit centred over each other while the pill
  // morphs. Before that (server render) the showing face sizes the pill.
  const placement = (showing: boolean) => {
    if (widths) {
      return "absolute inset-y-0 left-1/2 -translate-x-1/2";
    }
    return showing ? "relative" : "absolute inset-y-0 left-0";
  };

  return (
    <div
      className={cn(
        "relative inline-flex h-10 select-none overflow-hidden rounded-full bg-zinc-900 text-sm text-white transition-[width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none dark:bg-zinc-100 dark:text-zinc-900",
        className
      )}
      style={widths ? { width: open ? widths.step : widths.add } : undefined}
    >
      <button
        className={cn(
          "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 font-medium outline-none transition-[opacity,filter,background-color] duration-200 ease-out hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset active:bg-zinc-700 dark:active:bg-zinc-300 dark:hover:bg-zinc-200",
          placement(!open),
          open
            ? "pointer-events-none opacity-0 blur-[2px]"
            : "opacity-100 blur-0"
        )}
        inert={open}
        onClick={handleAdd}
        ref={addRef}
        type="button"
      >
        <ShoppingBag className="size-4" strokeWidth={2} />
        {label}
      </button>

      {/* biome-ignore lint/a11y/useSemanticElements: a labelled row of buttons; a fieldset's default box would fight the pill */}
      <div
        aria-label="Quantity"
        className={cn(
          "flex shrink-0 items-center gap-0.5 p-1 transition-[opacity,filter] duration-200 ease-out",
          placement(open),
          open
            ? "opacity-100 blur-0"
            : "pointer-events-none opacity-0 blur-[2px]"
        )}
        inert={!open}
        ref={stepRef}
        role="group"
      >
        <button
          aria-label={removing ? "Remove from cart" : "Decrease quantity"}
          className="relative flex size-8 items-center justify-center rounded-full outline-none transition-colors duration-150 ease-out hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60 active:bg-white/20 dark:active:bg-zinc-900/15 dark:focus-visible:ring-zinc-900/40 dark:hover:bg-zinc-900/10"
          type="button"
          {...pressHandlers(-1)}
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate="center"
              className="flex"
              exit="exit"
              initial="enter"
              key={removing ? "trash" : "minus"}
              transition={fade}
              variants={SWAP}
            >
              {removing ? (
                <Trash2 className="size-4" strokeWidth={2} />
              ) : (
                <Minus className="size-4" strokeWidth={2} />
              )}
            </motion.span>
          </AnimatePresence>
        </button>

        <span
          className="relative flex h-8 min-w-8 items-center justify-center overflow-hidden font-medium tabular-nums"
          ref={countRef}
        >
          <AnimatePresence custom={direction} initial={false} mode="popLayout">
            <motion.span
              animate="center"
              custom={direction}
              exit="exit"
              initial="enter"
              key={Math.max(1, quantity)}
              transition={fade}
              variants={ROLL}
            >
              {Math.max(1, quantity)}
            </motion.span>
          </AnimatePresence>
        </span>

        <button
          aria-disabled={quantity >= max}
          aria-label="Increase quantity"
          className={cn(
            "flex size-8 items-center justify-center rounded-full outline-none transition-[background-color,opacity] duration-150 ease-out hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60 active:bg-white/20 dark:active:bg-zinc-900/15 dark:focus-visible:ring-zinc-900/40 dark:hover:bg-zinc-900/10",
            quantity >= max && "opacity-40"
          )}
          ref={plusRef}
          type="button"
          {...pressHandlers(1)}
        >
          <Plus className="size-4" strokeWidth={2} />
        </button>
      </div>

      <span aria-live="polite" className="sr-only">
        {open ? `${quantity} in cart` : ""}
      </span>
    </div>
  );
}
