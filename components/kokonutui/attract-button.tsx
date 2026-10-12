"use client";

/**
 * @author: @dorianbaffier
 * @description: Attract Button
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Magnet } from "lucide-react";
import { motion, type Transition, useReducedMotion } from "motion/react";
import {
  type ComponentProps,
  type PointerEvent,
  useEffect,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AttractButtonProps extends ComponentProps<"button"> {
  particleCount?: number;
  /** Max distance in px that particles scatter from the button's center. */
  attractRadius?: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
}

const SPRING: Transition = { type: "spring", duration: 0.5, bounce: 0.2 };

export default function AttractButton({
  className,
  children,
  particleCount = 12,
  attractRadius = 180,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  ...props
}: AttractButtonProps) {
  const [isAttracting, setIsAttracting] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    setParticles(
      Array.from({ length: particleCount }, (_, i) => ({
        id: i,
        x: (Math.random() * 2 - 1) * attractRadius,
        y: (Math.random() * 2 - 1) * attractRadius,
      }))
    );
  }, [particleCount, attractRadius]);

  // Mouse attracts on hover. Touch and pen attract only while pressed, so a
  // tap can't leave the button stuck in the attracting state.
  const handlePointerEnter = (event: PointerEvent<HTMLButtonElement>) => {
    onPointerEnter?.(event);
    if (event.pointerType === "mouse") {
      setIsAttracting(true);
    }
  };

  const handlePointerLeave = (event: PointerEvent<HTMLButtonElement>) => {
    onPointerLeave?.(event);
    if (event.pointerType === "mouse") {
      setIsAttracting(false);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    onPointerDown?.(event);
    if (event.pointerType !== "mouse") {
      setIsAttracting(true);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    onPointerUp?.(event);
    if (event.pointerType !== "mouse") {
      setIsAttracting(false);
    }
  };

  const handlePointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    onPointerCancel?.(event);
    if (event.pointerType !== "mouse") {
      setIsAttracting(false);
    }
  };

  const pullIn = isAttracting && !shouldReduceMotion;

  return (
    <Button
      {...props}
      className={cn(
        "relative min-w-40",
        "bg-violet-100 dark:bg-violet-900",
        "hover:bg-violet-200 dark:hover:bg-violet-800",
        "text-violet-600 dark:text-violet-300",
        "border border-violet-300 dark:border-violet-700",
        "transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.97]",
        className
      )}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerUp={handlePointerUp}
    >
      {particles.map((particle) => (
        <motion.div
          animate={pullIn ? { x: 0, y: 0 } : { x: particle.x, y: particle.y }}
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute h-1.5 w-1.5 rounded-full",
            "bg-violet-400 dark:bg-violet-300",
            "transition-opacity duration-300",
            isAttracting ? "opacity-100" : "opacity-40"
          )}
          initial={{ x: particle.x, y: particle.y }}
          key={particle.id}
          transition={SPRING}
        />
      ))}
      <span className="relative flex w-full items-center justify-center gap-2">
        <Magnet
          className={cn(
            "h-4 w-4 transition-transform duration-300",
            isAttracting && "motion-safe:scale-110"
          )}
        />
        {children ?? (isAttracting ? "Attracting" : "Hover me")}
      </span>
    </Button>
  );
}
