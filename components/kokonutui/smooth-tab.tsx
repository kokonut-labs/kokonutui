"use client";

/**
 * @author: @dorianbaffier
 * @description: Smooth Tab
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";
import { cn } from "@/lib/utils";

interface TabItem {
  id: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  content?: React.ReactNode;
  cardContent?: React.ReactNode;
  color: string;
}

const WaveformPath = () => (
  <motion.path
    animate={{
      x: [0, 10, 0],
      transition: {
        duration: 5,
        ease: "linear",
        repeat: Number.POSITIVE_INFINITY,
      },
    }}
    d="M0 50 
           C 20 40, 40 30, 60 50
           C 80 70, 100 60, 120 50
           C 140 40, 160 30, 180 50
           C 200 70, 220 60, 240 50
           C 260 40, 280 30, 300 50
           C 320 70, 340 60, 360 50
           C 380 40, 400 30, 420 50
           L 420 100 L 0 100 Z"
    initial={false}
  />
);

// Tailwind never generates classes built at runtime (`fill-${name}`), so the
// waveform colour comes from the tab's bg-* class: palette colours resolve
// through Tailwind v4's theme variables, arbitrary values are used as is.
function getWaveFill(colorClass: string): string {
  const value = colorClass.split(" ").at(0)?.replace("bg-", "");
  if (!value) {
    return "currentColor";
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    return value.slice(1, -1).replaceAll("_", " ");
  }
  return `var(--color-${value.split("/").at(0)}, currentColor)`;
}

function TabCardContent({
  title,
  description,
  fill,
}: {
  title: string;
  description: string;
  fill: string;
}) {
  return (
    <div className="relative h-full">
      <div className="absolute inset-0 overflow-hidden">
        <svg
          aria-hidden="true"
          className="absolute bottom-0 h-32 w-full"
          preserveAspectRatio="none"
          role="presentation"
          viewBox="0 0 420 100"
        >
          <motion.g
            animate={{ opacity: 0.15 }}
            initial={{ opacity: 0 }}
            style={{ fill, stroke: fill, strokeWidth: 1 }}
            transition={{ duration: 0.5 }}
          >
            <WaveformPath />
          </motion.g>
          <motion.g
            animate={{ opacity: 0.1 }}
            initial={{ opacity: 0 }}
            style={{
              fill,
              stroke: fill,
              strokeWidth: 1,
              transform: "translateY(10px)",
            }}
            transition={{ duration: 0.5 }}
          >
            <WaveformPath />
          </motion.g>
        </svg>
      </div>
      <div className="relative flex h-full flex-col p-6">
        <div className="space-y-2">
          <h3 className="bg-gradient-to-r from-black via-black/90 to-black/70 bg-clip-text font-semibold text-2xl text-transparent tracking-tight dark:from-white dark:via-white/90 dark:to-white/70">
            {title}
          </h3>
          <p className="max-w-[90%] text-black/50 text-sm leading-relaxed dark:text-white/50">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_TABS: TabItem[] = [
  {
    id: "Models",
    title: "Models",
    description: "Choose the model you want to use",
    color: "bg-blue-500 hover:bg-blue-600",
  },
  {
    id: "MCPs",
    title: "MCPs",
    description: "Choose the MCP you want to use",
    color: "bg-purple-500 hover:bg-purple-600",
  },
  {
    id: "Agents",
    title: "Agents",
    description: "Choose the agent you want to use",
    color: "bg-emerald-500 hover:bg-emerald-600",
  },
  {
    id: "Users",
    title: "Users",
    description: "Choose the user you want to use",
    color: "bg-amber-500 hover:bg-amber-600",
  },
];

interface SmoothTabProps {
  items?: TabItem[];
  defaultTabId?: string;
  className?: string;
  activeColor?: string;
  onChange?: (tabId: string) => void;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
    filter: "blur(8px)",
    scale: 0.95,
    position: "absolute" as const,
  }),
  center: {
    x: 0,
    opacity: 1,
    filter: "blur(0px)",
    scale: 1,
    position: "absolute" as const,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? "100%" : "-100%",
    opacity: 0,
    filter: "blur(8px)",
    scale: 0.95,
    position: "absolute" as const,
  }),
};

const transition = {
  duration: 0.4,
  ease: [0.32, 0.72, 0, 1],
};

export default function SmoothTab({
  items = DEFAULT_TABS,
  defaultTabId,
  className,
  activeColor = "bg-[#1F9CFE]",
  onChange,
}: SmoothTabProps) {
  const [selected, setSelected] = React.useState<string>(
    defaultTabId ?? items[0]?.id
  );
  const [direction, setDirection] = React.useState(0);
  const [dimensions, setDimensions] = React.useState({ width: 0, left: 0 });

  // Reference for the selected button
  const buttonRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const containerRef = React.useRef<HTMLDivElement>(null);
  const baseId = React.useId();

  // Update dimensions whenever selected tab changes or on mount
  React.useLayoutEffect(() => {
    const updateDimensions = () => {
      const selectedButton = buttonRefs.current.get(selected);
      const container = containerRef.current;

      if (selectedButton && container) {
        const rect = selectedButton.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        setDimensions({
          width: rect.width,
          left: rect.left - containerRect.left,
        });
      }
    };

    // Initial update
    requestAnimationFrame(() => {
      updateDimensions();
    });

    // Update on resize
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [selected]);

  const handleTabClick = (tabId: string) => {
    const currentIndex = items.findIndex((item) => item.id === selected);
    const newIndex = items.findIndex((item) => item.id === tabId);
    setDirection(newIndex > currentIndex ? 1 : -1);
    setSelected(tabId);
    onChange?.(tabId);
  };

  // WAI-ARIA tabs pattern: arrows (wrapping), Home and End move focus and select
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let nextIndex: number;
    switch (e.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % items.length;
        break;
      case "ArrowLeft":
        nextIndex = (index - 1 + items.length) % items.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = items.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const nextId = items[nextIndex].id;
    buttonRefs.current.get(nextId)?.focus();
    handleTabClick(nextId);
  };

  const selectedItem = items.find((item) => item.id === selected);
  const selectedIndex = items.findIndex((item) => item.id === selected);
  // Keep one tab reachable with Tab even if `selected` matches no item
  const focusableIndex = Math.max(selectedIndex, 0);
  const panelId = `${baseId}-panel`;
  const getTabId = (index: number) => `${baseId}-tab-${index}`;

  return (
    <div className="flex h-full flex-col">
      {/* Card Content Area */}
      <div className="relative mb-4 flex-1">
        <div
          aria-labelledby={selectedItem ? getTabId(selectedIndex) : undefined}
          className="relative h-[200px] w-full rounded-lg border bg-card"
          id={panelId}
          role="tabpanel"
        >
          <div className="absolute inset-0 overflow-hidden rounded-lg">
            <AnimatePresence
              custom={direction}
              initial={false}
              mode="popLayout"
            >
              <motion.div
                animate="center"
                className="absolute inset-0 h-full w-full bg-card will-change-transform"
                custom={direction}
                exit="exit"
                initial="enter"
                key={`card-${selected}`}
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                }}
                transition={transition as any}
                variants={slideVariants as any}
              >
                {selectedItem?.cardContent ??
                  (selectedItem && (
                    <TabCardContent
                      description={selectedItem.description ?? ""}
                      fill={getWaveFill(selectedItem.color)}
                      title={selectedItem.title}
                    />
                  ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Bottom Toolbar */}
      <div
        aria-label="Smooth tabs"
        className={cn(
          "relative mt-auto flex items-center justify-between gap-1 py-1",
          "mx-auto w-[400px] bg-background",
          "rounded-xl border",
          "transition-all duration-200",
          className
        )}
        ref={containerRef}
        role="tablist"
      >
        {/* Sliding Background */}
        <motion.div
          animate={{
            width: dimensions.width - 8,
            x: dimensions.left + 4,
            opacity: 1,
          }}
          className={cn(
            "absolute z-[1] rounded-lg",
            selectedItem?.color || activeColor
          )}
          initial={false}
          style={{ height: "calc(100% - 8px)", top: "4px" }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
          }}
        />

        <div className="relative z-[2] grid w-full grid-cols-4 gap-1">
          {items.map((item, index) => {
            const isSelected = selected === item.id;
            return (
              <motion.button
                aria-controls={isSelected ? panelId : undefined}
                aria-selected={isSelected}
                className={cn(
                  "relative flex items-center justify-center gap-0.5 rounded-lg px-2 py-1.5",
                  "font-medium text-sm transition-all duration-300",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "truncate",
                  isSelected
                    ? "text-white"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
                id={getTabId(index)}
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                ref={(el) => {
                  if (el) buttonRefs.current.set(item.id, el);
                  else buttonRefs.current.delete(item.id);
                }}
                role="tab"
                tabIndex={index === focusableIndex ? 0 : -1}
                type="button"
              >
                <span className="truncate">{item.title}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
