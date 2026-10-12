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

import type { LucideIcon } from "lucide-react";
import { Instagram, Link, Linkedin, Twitter } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShareItem {
  icon: LucideIcon;
  label: string;
}

interface SocialButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  items?: ShareItem[];
  onShare?: (index: number, item: ShareItem) => void;
  className?: string;
}

const DEFAULT_SHARE_ITEMS: ShareItem[] = [
  { icon: Twitter, label: "Share on Twitter" },
  { icon: Instagram, label: "Share on Instagram" },
  { icon: Linkedin, label: "Share on LinkedIn" },
  { icon: Link, label: "Copy link" },
];

export default function SocialButton({
  label = "Share",
  items = DEFAULT_SHARE_ITEMS,
  onShare,
  className,
  onClick,
  ...props
}: SocialButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  // Opened by click/keyboard; stays open while focus is inside
  const [isOpen, setIsOpen] = useState(false);
  const isVisible = isHovered || isOpen;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  const handleShare = (index: number) => {
    setActiveIndex(index);
    onShare?.(index, items[index]);
    setTimeout(() => setActiveIndex(null), 300);
  };

  const handleTriggerClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) {
      return;
    }
    // Commit the open state first so the items are no longer inert
    flushSync(() => setIsOpen(true));
    firstItemRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && isVisible) {
      setIsOpen(false);
      setIsHovered(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setIsOpen(false);
        }
      }}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div
        animate={{
          opacity: isVisible ? 0 : 1,
        }}
        transition={{
          duration: 0.2,
          ease: "easeInOut",
        }}
      >
        <Button
          className={cn(
            "relative min-w-40",
            "bg-white dark:bg-black",
            "hover:bg-gray-50 dark:hover:bg-gray-950",
            "text-black dark:text-white",
            "border border-black/10 dark:border-white/10",
            "transition-colors duration-200",
            className
          )}
          {...props}
          aria-expanded={isVisible}
          onClick={handleTriggerClick}
          ref={triggerRef}
          // Hidden under the open menu, so keep it out of the tab order
          tabIndex={isVisible ? -1 : props.tabIndex}
        >
          <span className="flex items-center gap-2">
            <Link className="h-4 w-4" />
            {label}
          </span>
        </Button>
      </motion.div>

      <motion.div
        animate={{
          width: isVisible ? "auto" : 0,
        }}
        className="absolute top-0 left-0 flex h-10 overflow-hidden"
        inert={!isVisible}
        transition={{
          duration: 0.3,
          ease: [0.23, 1, 0.32, 1],
        }}
      >
        {items.map((button, i) => (
          <motion.button
            animate={{
              opacity: isVisible ? 1 : 0,
              x: isVisible ? 0 : -20,
            }}
            aria-label={button.label}
            className={cn(
              "h-10",
              "w-10",
              "flex items-center justify-center",
              "bg-black dark:bg-white",
              "text-white dark:text-black",
              i === 0 && "rounded-l-md",
              i === items.length - 1 && "rounded-r-md",
              "border-white/10 border-r last:border-r-0 dark:border-black/10",
              "hover:bg-gray-900 dark:hover:bg-gray-100",
              "outline-hidden focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-inset dark:focus-visible:ring-black/70",
              "relative overflow-hidden",
              "transition-colors duration-200"
            )}
            key={`share-${button.label}`}
            onClick={() => handleShare(i)}
            ref={i === 0 ? firstItemRef : undefined}
            transition={{
              duration: 0.3,
              ease: [0.23, 1, 0.32, 1],
              delay: isVisible ? i * 0.05 : 0,
            }}
            type="button"
          >
            <motion.div
              animate={{
                scale: activeIndex === i ? 0.85 : 1,
              }}
              className="relative z-10"
              transition={{
                duration: 0.2,
                ease: "easeInOut",
              }}
            >
              <button.icon className="h-4 w-4" />
            </motion.div>
            <motion.div
              animate={{
                opacity: activeIndex === i ? 0.15 : 0,
              }}
              className="absolute inset-0 bg-white dark:bg-black"
              initial={{ opacity: 0 }}
              transition={{
                duration: 0.2,
                ease: "easeInOut",
              }}
            />
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
