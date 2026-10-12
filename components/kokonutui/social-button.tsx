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
import { motion } from "motion/react";
import { type ComponentType, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShareItem {
  icon: ComponentType<{ className?: string }>;
  label: string;
}

interface SocialButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
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
  { icon: Link, label: "Copy link" },
];

export default function SocialButton({
  label = "Share",
  items = DEFAULT_SHARE_ITEMS,
  onShare,
  className,
  ...props
}: SocialButtonProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handleShare = (index: number) => {
    setActiveIndex(index);
    onShare?.(index, items[index]);
    setTimeout(() => setActiveIndex(null), 300);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
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
              "outline-none",
              "relative overflow-hidden",
              "transition-colors duration-200"
            )}
            key={`share-${button.label}`}
            onClick={() => handleShare(i)}
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
