"use client";

/**
 * @author: @dorianbaffier
 * @description: Card Flip
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ArrowRight, Repeat2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const ORBS = Array.from({ length: 10 }, (_, i) => ({
  id: `orb-${i}`,
  delay: `${i * 0.3}s`,
}));

export interface CardFlipProps {
  title?: string;
  subtitle?: string;
  description?: string;
  features?: string[];
}

export default function CardFlip({
  title = "Design Systems",
  subtitle = "Explore the fundamentals",
  description = "Dive deep into the world of modern UI/UX design.",
  features = ["UI/UX", "Modern Design", "Tailwind CSS", "Kokonut UI"],
}: CardFlipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [hasKeyboardFocus, setHasKeyboardFocus] = useState(false);
  const isFlipped = isHovered || hasKeyboardFocus;

  return (
    // biome-ignore lint/a11y/useSemanticElements: a labelled card group, not a form fieldset
    <div
      aria-label={title}
      className="group relative h-[320px] w-full max-w-[280px] rounded-2xl outline-hidden [perspective:2000px] focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setHasKeyboardFocus(false);
        }
      }}
      onFocus={(e) => {
        // Only keyboard focus flips the card, so a mouse click doesn't pin it open
        if (e.target.matches(":focus-visible")) {
          setHasKeyboardFocus(true);
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="group"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard focus is what flips the card; the turned-away face is inert
      tabIndex={0}
    >
      <div
        className={cn(
          "relative h-full w-full",
          "[transform-style:preserve-3d]",
          "transition-[transform] duration-500 ease-[cubic-bezier(0.77,0,0.175,1)]",
          "motion-reduce:transition-none",
          isFlipped
            ? "[transform:rotateY(180deg)]"
            : "[transform:rotateY(0deg)]"
        )}
      >
        <div
          aria-hidden={isFlipped || undefined}
          className={cn(
            "absolute inset-0 h-full w-full",
            "[backface-visibility:hidden] [transform:rotateY(0deg)]",
            "overflow-hidden rounded-2xl",
            "bg-zinc-50 dark:bg-zinc-900",
            "border border-zinc-200 dark:border-zinc-800/50",
            "shadow-xs dark:shadow-lg",
            "transition-shadow duration-500",
            "group-hover:shadow-lg dark:group-hover:shadow-xl"
          )}
          inert={isFlipped}
        >
          <div className="relative h-full overflow-hidden bg-gradient-to-b from-zinc-100 to-white dark:from-zinc-900 dark:to-black">
            <div
              aria-hidden="true"
              className="absolute inset-0 flex items-start justify-center pt-24"
            >
              <div className="relative flex h-[100px] w-[200px] items-center justify-center">
                {ORBS.map((orb) => (
                  <div
                    className={cn(
                      "absolute h-[50px] w-[50px]",
                      "rounded-[140px]",
                      // motion-safe on both: a plain group-hover:animate-*
                      // outranks motion-reduce:animate-none.
                      "motion-safe:animate-[scale_3s_linear_infinite]",
                      "opacity-0",
                      "shadow-[0_0_50px_rgba(255,165,0,0.5)]",
                      "motion-safe:group-hover:animate-[scale_2s_linear_infinite]"
                    )}
                    key={orb.id}
                    style={{
                      animationDelay: orb.delay,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="absolute right-0 bottom-0 left-0 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1.5">
                <h3 className="font-semibold text-lg text-zinc-900 leading-snug tracking-tighter transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-y-[-4px] dark:text-white">
                  {title}
                </h3>
                <p className="line-clamp-2 text-sm text-zinc-600 tracking-tight transition-transform delay-[50ms] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-y-[-4px] dark:text-zinc-200">
                  {subtitle}
                </p>
              </div>
              <div className="group/icon relative">
                <div
                  className={cn(
                    "absolute inset-[-8px] rounded-lg",
                    "bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-transparent"
                  )}
                />
                <Repeat2
                  aria-hidden="true"
                  className="relative z-10 h-4 w-4 text-orange-500 transition-transform duration-300 group-hover/icon:-rotate-12 group-hover/icon:scale-110"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Back of card */}
        <div
          aria-hidden={!isFlipped || undefined}
          className={cn(
            "absolute inset-0 h-full w-full",
            "[backface-visibility:hidden] [transform:rotateY(180deg)]",
            "rounded-2xl p-6",
            "bg-gradient-to-b from-zinc-100 to-white dark:from-zinc-900 dark:to-black",
            "border border-zinc-200 dark:border-zinc-800",
            "shadow-xs dark:shadow-lg",
            "flex flex-col",
            "transition-shadow duration-500",
            "group-hover:shadow-lg dark:group-hover:shadow-xl"
          )}
          inert={!isFlipped}
        >
          <div className="flex-1 space-y-6">
            <div className="space-y-2">
              <h3 className="font-semibold text-lg text-zinc-900 leading-snug tracking-tight transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-y-[-2px] dark:text-white">
                {title}
              </h3>
              <p className="line-clamp-2 text-sm text-zinc-600 tracking-tight transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-y-[-2px] dark:text-zinc-400">
                {description}
              </p>
            </div>

            <div className="space-y-2">
              {features.map((feature, index) => (
                <div
                  className="motion-reduce:transform-none! flex items-center gap-2 text-sm text-zinc-700 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] dark:text-zinc-300"
                  key={feature}
                  style={{
                    transform: isFlipped
                      ? "translateX(0)"
                      : "translateX(-10px)",
                    opacity: isFlipped ? 1 : 0,
                    transitionDelay: `${index * 50 + 150}ms`,
                  }}
                >
                  <ArrowRight
                    aria-hidden="true"
                    className="h-3 w-3 text-orange-500"
                  />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 border-zinc-200 border-t pt-6 dark:border-zinc-800">
            <button
              className={cn(
                "group/start relative w-full",
                "flex items-center justify-between",
                "-m-3 rounded-xl p-3",
                "transition-[scale,--tw-gradient-from,--tw-gradient-via,--tw-gradient-to,--tw-gradient-via-position] duration-300",
                "bg-gradient-to-r from-zinc-100 via-zinc-100 to-zinc-100",
                "dark:from-zinc-800 dark:via-zinc-800 dark:to-zinc-800",
                "hover:from-0% hover:from-orange-500/10 hover:via-100% hover:via-orange-500/5 hover:to-100% hover:to-transparent",
                "dark:hover:from-0% dark:hover:from-orange-500/20 dark:hover:via-100% dark:hover:via-orange-500/10 dark:hover:to-100% dark:hover:to-transparent",
                "hover:scale-[1.02] active:scale-[0.98]",
                "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900"
              )}
              type="button"
            >
              <span className="font-medium text-sm text-zinc-900 transition-colors duration-300 group-hover/start:text-orange-600 dark:text-white dark:group-hover/start:text-orange-400">
                Start today
              </span>
              <div className="group/icon relative">
                <div
                  className={cn(
                    "absolute inset-[-6px] rounded-lg transition-[scale,opacity] duration-300",
                    "bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-transparent",
                    "scale-90 opacity-0 group-hover/start:scale-100 group-hover/start:opacity-100"
                  )}
                />
                <ArrowRight
                  aria-hidden="true"
                  className="relative z-10 h-4 w-4 text-orange-500 transition-transform duration-300 group-hover/start:translate-x-0.5 group-hover/start:scale-110"
                />
              </div>
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
                @keyframes scale {
                    0% {
                        transform: scale(2);
                        opacity: 0;
                        box-shadow: 0px 0px 50px rgba(255, 165, 0, 0.5);
                    }
                    50% {
                        transform: translate(0px, -5px) scale(1);
                        opacity: 1;
                        box-shadow: 0px 8px 20px rgba(255, 165, 0, 0.5);
                    }
                    100% {
                        transform: translate(0px, 5px) scale(0.1);
                        opacity: 0;
                        box-shadow: 0px 10px 20px rgba(255, 165, 0, 0);
                    }
                }
            `}</style>
    </div>
  );
}
