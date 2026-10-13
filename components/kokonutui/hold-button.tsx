"use client";

/**
 * @author: @dorianbaffier
 * @description: Hold Button
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { cva, type VariantProps } from "class-variance-authority";
import {
  AlertCircleIcon,
  ArchiveXIcon,
  BanIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const holdButtonVariants = cva("relative min-w-40 touch-none overflow-hidden", {
  variants: {
    variant: {
      red: [
        "bg-red-100 dark:bg-red-200",
        "hover:bg-red-100 dark:hover:bg-red-200",
        "text-red-500 dark:text-red-600",
        "border border-red-200 dark:border-red-300",
      ],
      green: [
        "bg-green-100 dark:bg-green-200",
        "hover:bg-green-100 dark:hover:bg-green-200",
        "text-green-500 dark:text-green-600",
        "border border-green-200 dark:border-green-300",
      ],
      blue: [
        "bg-blue-100 dark:bg-blue-200",
        "hover:bg-blue-100 dark:hover:bg-blue-200",
        "text-blue-500 dark:text-blue-600",
        "border border-blue-200 dark:border-blue-300",
      ],
      orange: [
        "bg-orange-100 dark:bg-orange-200",
        "hover:bg-orange-100 dark:hover:bg-orange-200",
        "text-orange-500 dark:text-orange-600",
        "border border-orange-200 dark:border-orange-300",
      ],
      grey: [
        "bg-gray-100 dark:bg-gray-200",
        "hover:bg-gray-100 dark:hover:bg-gray-200",
        "text-gray-500 dark:text-gray-600",
        "border border-gray-200 dark:border-gray-300",
      ],
    },
  },
  defaultVariants: {
    variant: "red",
  },
});

interface HoldButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof holdButtonVariants> {
  holdDuration?: number;
  /**
   * Called once the button has been held for the full `holdDuration`.
   * A short click or an early release never calls it.
   */
  onHoldComplete?: () => void;
}

const HOLD_KEYS = new Set([" ", "Enter"]);

const holdFeedbackClassName = cn(
  "select-none [-webkit-touch-callout:none]",
  "transition-[color,background-color,border-color,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
  "active:scale-[0.97] motion-reduce:active:scale-100"
);

export default function HoldButton({
  className,
  variant = "red",
  holdDuration = 3000,
  onHoldComplete,
  children,
  type = "button",
  ...props
}: HoldButtonProps) {
  const [isHolding, setIsHolding] = useState(false);
  const holdingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHoldCompleteRef = useRef(onHoldComplete);

  useEffect(() => {
    onHoldCompleteRef.current = onHoldComplete;
  }, [onHoldComplete]);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    []
  );

  function handleHoldStart() {
    if (holdingRef.current) {
      return;
    }
    holdingRef.current = true;
    setIsHolding(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (holdingRef.current) {
        onHoldCompleteRef.current?.();
      }
    }, holdDuration);
  }

  function handleHoldEnd() {
    if (!holdingRef.current) {
      return;
    }
    holdingRef.current = false;
    setIsHolding(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    props.onPointerDown?.(e);
    if (e.button !== 0) {
      return;
    }
    // Touch pointers are captured implicitly, which would keep the hold
    // going after the finger slides off. Release so pointerleave cancels it.
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    handleHoldStart();
  }

  return (
    <Button
      {...props}
      className={cn(
        holdButtonVariants({ variant }),
        holdFeedbackClassName,
        className
      )}
      onBlur={(e) => {
        props.onBlur?.(e);
        handleHoldEnd();
      }}
      onKeyDown={(e) => {
        props.onKeyDown?.(e);
        if (!e.repeat && HOLD_KEYS.has(e.key)) {
          handleHoldStart();
        }
      }}
      onKeyUp={(e) => {
        props.onKeyUp?.(e);
        if (HOLD_KEYS.has(e.key)) {
          handleHoldEnd();
        }
      }}
      onPointerCancel={(e) => {
        props.onPointerCancel?.(e);
        handleHoldEnd();
      }}
      onPointerDown={handlePointerDown}
      onPointerLeave={(e) => {
        props.onPointerLeave?.(e);
        handleHoldEnd();
      }}
      onPointerUp={(e) => {
        props.onPointerUp?.(e);
        handleHoldEnd();
      }}
      type={type}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 transition-[clip-path]",
          "motion-reduce:transition-opacity motion-reduce:[clip-path:none]",
          isHolding
            ? "ease-linear [clip-path:inset(0_0_0_0)] motion-reduce:opacity-100"
            : "duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [clip-path:inset(0_100%_0_0)] motion-reduce:opacity-0",
          {
            "bg-red-200/30 dark:bg-red-300/30": variant === "red",
            "bg-green-200/30 dark:bg-green-300/30": variant === "green",
            "bg-blue-200/30 dark:bg-blue-300/30": variant === "blue",
            "bg-orange-200/30 dark:bg-orange-300/30": variant === "orange",
            "bg-gray-200/30 dark:bg-gray-300/30": variant === "grey",
          }
        )}
        style={
          isHolding ? { transitionDuration: `${holdDuration}ms` } : undefined
        }
      />
      <span className="relative z-10 flex w-full items-center justify-center gap-2">
        {children ?? (
          <>
            {(variant === "red" || !variant) && (
              <Trash2Icon className="h-4 w-4" />
            )}
            {variant === "green" && <ArchiveXIcon className="h-4 w-4" />}
            {variant === "blue" && <XCircleIcon className="h-4 w-4" />}
            {variant === "orange" && <AlertCircleIcon className="h-4 w-4" />}
            {variant === "grey" && <BanIcon className="h-4 w-4" />}
            {isHolding ? "Release" : "Hold me"}
          </>
        )}
      </span>
    </Button>
  );
}
