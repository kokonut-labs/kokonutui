"use client";

/**
 * @author: @dorianbaffier
 * @description: Social Button
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Link } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ShareItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** Renders the item as a link (opened in a new tab). */
  href?: string;
  onClick?: () => void;
}

interface SocialButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  /** Icon shown on the trigger next to the label. */
  icon?: React.ComponentType<{ className?: string }>;
  items?: ShareItem[];
  onShare?: (index: number, item: ShareItem) => void;
  className?: string;
}

// lucide-react 1.x removed its brand icons, so the defaults ship inline
// (same paths as the old lucide Twitter, Instagram and Linkedin icons).
function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <rect height="20" rx="5" ry="5" width="20" x="2" y="2" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect height="12" width="4" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

const DEFAULT_SHARE_ITEMS: ShareItem[] = [
  { icon: TwitterIcon, label: "Share on Twitter" },
  { icon: InstagramIcon, label: "Share on Instagram" },
  { icon: LinkedinIcon, label: "Share on LinkedIn" },
  {
    icon: Link,
    label: "Copy link",
    onClick: () => {
      navigator.clipboard?.writeText(window.location.href).catch(() => null);
    },
  },
];

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const HOVER_INTENT_MS = 100;

export default function SocialButton({
  label = "Share",
  icon: TriggerIcon = Link,
  items = DEFAULT_SHARE_ITEMS,
  onShare,
  className,
  onClick,
  onBlur,
  onKeyDown,
  ...props
}: SocialButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  // Opened by click/keyboard; stays open while focus is inside
  const [isOpen, setIsOpen] = useState(false);
  const isVisible = isHovered || isOpen;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
      }
      if (hoverTimer.current) {
        clearTimeout(hoverTimer.current);
      }
    },
    []
  );

  const handleShare = (index: number) => {
    const item = items[index];
    setActiveIndex(index);
    item.onClick?.();
    onShare?.(index, item);
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
    pressTimer.current = setTimeout(() => setActiveIndex(null), 300);
  };

  const handleTriggerClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) {
      return;
    }
    // Commit the open state first so the items are no longer inert
    flushSync(() => setIsOpen(true));
    rowRef.current?.querySelector<HTMLElement>("a, button")?.focus();
  };

  // Mouse only: touch fires emulated mouse events that never "leave".
  const handlePointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") {
      return;
    }
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
    }
    hoverTimer.current = setTimeout(() => setIsHovered(true), HOVER_INTENT_MS);
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") {
      return;
    }
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
    }
    setIsHovered(false);
  };

  // On the trigger and every item (not the wrapper), so the wrapper stays a
  // plain element.
  const handleBlur = (e: React.FocusEvent) => {
    if (!rootRef.current?.contains(e.relatedTarget)) {
      setIsOpen(false);
    }
  };

  const handleEscape = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && isVisible) {
      setIsOpen(false);
      setIsHovered(false);
      triggerRef.current?.focus();
    }
  };

  // Exits run faster than entrances.
  const revealDuration = isVisible ? 0.2 : 0.15;

  // `initial={false}` below renders the closed state in the server HTML.
  // Without it Motion leaves those styles out until hydration, so the share
  // row showed over the trigger and then animated shut on every page load.
  return (
    <div
      className="relative inline-flex"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      ref={rootRef}
    >
      <motion.div
        animate={{
          opacity: isVisible ? 0 : 1,
        }}
        initial={false}
        transition={{
          duration: 0.2,
          ease: EASE_OUT,
        }}
      >
        <Button
          className={cn(
            "relative min-w-40",
            "bg-white dark:bg-black",
            "hover:bg-gray-50 dark:hover:bg-gray-950",
            "text-black dark:text-white",
            "border border-black/10 dark:border-white/10",
            "transition-[color,background-color,border-color,scale] duration-200",
            "motion-safe:active:scale-[0.97]",
            className
          )}
          {...props}
          aria-expanded={isVisible}
          onBlur={(e) => {
            onBlur?.(e);
            handleBlur(e);
          }}
          onClick={handleTriggerClick}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            handleEscape(e);
          }}
          ref={triggerRef}
          // Hidden under the open menu, so keep it out of the tab order
          tabIndex={isVisible ? -1 : props.tabIndex}
        >
          <span className="flex items-center gap-2">
            <TriggerIcon className="h-4 w-4" />
            {label}
          </span>
        </Button>
      </motion.div>

      {/* Covers the trigger exactly, one equal column per item */}
      <motion.div
        animate={{
          clipPath: isVisible ? "inset(0% 0% 0% 0%)" : "inset(0% 100% 0% 0%)",
        }}
        className="absolute inset-0 grid"
        inert={!isVisible}
        initial={false}
        ref={rowRef}
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        }}
        transition={{
          duration: shouldReduceMotion ? 0 : revealDuration,
          ease: EASE_OUT,
        }}
      >
        {items.map((item, i) => {
          const itemProps = {
            animate: {
              opacity: isVisible ? 1 : 0,
              x: isVisible ? 0 : -20,
            },
            "aria-label": item.label,
            initial: false,
            className: cn(
              "h-full w-full",
              "flex items-center justify-center",
              // Reduced motion: fade the items in without the slide.
              "motion-reduce:transform-none!",
              "bg-black dark:bg-white",
              "text-white dark:text-black",
              i === 0 && "rounded-l-md",
              i === items.length - 1 && "rounded-r-md",
              "border-white/10 border-r last:border-r-0 dark:border-black/10",
              "hover:bg-gray-900 dark:hover:bg-gray-100",
              "outline-hidden focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-inset dark:focus-visible:ring-black/70",
              "relative overflow-hidden",
              "transition-colors duration-200"
            ),
            onBlur: handleBlur,
            onClick: () => handleShare(i),
            onKeyDown: handleEscape,
            transition: {
              duration: revealDuration,
              ease: EASE_OUT,
              delay: isVisible ? i * 0.05 : 0,
            },
          };
          const content = (
            <>
              <motion.span
                animate={{
                  scale: activeIndex === i ? 0.95 : 1,
                }}
                className="motion-reduce:transform-none! relative z-10 inline-flex"
                initial={false}
                transition={{
                  duration: 0.2,
                  ease: EASE_OUT,
                }}
              >
                <item.icon className="h-4 w-4" />
              </motion.span>
              <motion.span
                animate={{
                  opacity: activeIndex === i ? 0.15 : 0,
                }}
                className="absolute inset-0 bg-white dark:bg-black"
                initial={{ opacity: 0 }}
                transition={{
                  duration: 0.2,
                  ease: EASE_OUT,
                }}
              />
            </>
          );
          return item.href ? (
            <motion.a
              {...itemProps}
              href={item.href}
              key={`share-${item.label}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              {content}
            </motion.a>
          ) : (
            <motion.button
              {...itemProps}
              key={`share-${item.label}`}
              type="button"
            >
              {content}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
