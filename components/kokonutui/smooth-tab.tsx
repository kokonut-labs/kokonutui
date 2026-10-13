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
import {
  AnimatePresence,
  motion,
  type Transition,
  useReducedMotion,
  type Variants,
} from "motion/react";
import {
  type KeyboardEvent,
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

interface TabItem {
  id: string;
  title: string;
  description?: string;
  /** Shown before the title in the tab. */
  icon?: LucideIcon;
  /** Extra content in the default card, below the description. */
  content?: ReactNode;
  /** Replaces the whole default card. */
  cardContent?: ReactNode;
  /** A literal bg-* class for the indicator. Falls back to `activeColor`. */
  color?: string;
}

const WaveformPath = () => (
  <path
    d="M0 50 
           C 20 40, 40 30, 60 50
           C 80 70, 100 60, 120 50
           C 140 40, 160 30, 180 50
           C 200 70, 220 60, 240 50
           C 260 40, 280 30, 300 50
           C 320 70, 340 60, 360 50
           C 380 40, 400 30, 420 50
           L 420 100 L 0 100 Z"
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
  children,
}: {
  title: string;
  description: string;
  fill: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative h-full">
      <div className="absolute inset-0 overflow-hidden">
        <svg
          aria-hidden="true"
          className="absolute bottom-0 h-32 w-full"
          preserveAspectRatio="none"
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
        {children}
      </div>
    </div>
  );
}

const DEFAULT_TABS: TabItem[] = [
  {
    id: "Models",
    title: "Models",
    description: "Choose the model you want to use",
    color: "bg-blue-600",
  },
  {
    id: "MCPs",
    title: "MCPs",
    description: "Choose the MCP you want to use",
    color: "bg-purple-600",
  },
  {
    id: "Agents",
    title: "Agents",
    description: "Choose the agent you want to use",
    color: "bg-emerald-700",
  },
  {
    id: "Users",
    title: "Users",
    description: "Choose the user you want to use",
    color: "bg-amber-700",
  },
];

interface SmoothTabProps {
  items?: TabItem[];
  defaultTabId?: string;
  /** The selected tab id, for a controlled tab. Pair it with `onChange`. */
  value?: string;
  className?: string;
  activeColor?: string;
  onChange?: (tabId: string) => void;
}

const SLIDE_DISTANCE = 16;

// `custom` is the signed slide offset: positive enters from the right.
const slideVariants = {
  enter: (offset: number) => ({
    x: offset,
    opacity: 0,
    filter: "blur(2px)",
  }),
  center: {
    x: 0,
    opacity: 1,
    filter: "blur(0px)",
  },
  exit: (offset: number) => ({
    x: -offset,
    opacity: 0,
    filter: "blur(2px)",
  }),
} satisfies Variants;

const transition: Transition = {
  duration: 0.25,
  ease: [0.32, 0.72, 0, 1],
};

const indicatorTransition: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
};

export default function SmoothTab({
  items = DEFAULT_TABS,
  defaultTabId,
  value,
  className,
  activeColor = "bg-[#1F9CFE]",
  onChange,
}: SmoothTabProps) {
  const [uncontrolledSelected, setUncontrolledSelected] = useState<string>(
    defaultTabId ?? items[0]?.id
  );
  const selected = value ?? uncontrolledSelected;
  const [indicator, setIndicator] = useState<{
    width: number;
    left: number;
  } | null>(null);
  const shouldReduceMotion = useReducedMotion();

  // The card slides in from the side of the newly selected tab, whether the
  // change came from a click, the keyboard or a controlled `value`.
  const [previousSelected, setPreviousSelected] = useState(selected);
  const [direction, setDirection] = useState(0);
  if (selected !== previousSelected) {
    const indexOf = (id: string) => items.findIndex((item) => item.id === id);
    setPreviousSelected(selected);
    setDirection(indexOf(selected) > indexOf(previousSelected) ? 1 : -1);
  }
  const slideOffset = shouldReduceMotion ? 0 : direction * SLIDE_DISTANCE;

  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const baseId = useId();

  // Measured before paint, so the indicator is in place on the first frame
  // instead of springing in from the left edge. Offsets ignore transforms
  // such as the press scale, and the observer catches container resizes.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const button = buttonRefs.current.get(selected);
    if (!(container && button)) {
      setIndicator(null);
      return;
    }

    const measure = () => {
      let left = 0;
      let node: Element | null = button;
      while (node instanceof HTMLElement && node !== container) {
        left += node.offsetLeft;
        node = node.offsetParent;
      }
      const width = button.offsetWidth;
      setIndicator((current) =>
        current?.width === width && current.left === left
          ? current
          : { width, left }
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(button);
    return () => observer.disconnect();
  }, [selected]);

  const handleTabClick = (tabId: string) => {
    setUncontrolledSelected(tabId);
    onChange?.(tabId);
  };

  // WAI-ARIA tabs pattern: arrows (wrapping), Home and End move focus and select
  const handleKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
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
      <div className="relative mb-4 flex-1">
        <div
          aria-labelledby={selectedItem ? getTabId(selectedIndex) : undefined}
          className="relative h-[200px] w-full rounded-lg border bg-card"
          id={panelId}
          role="tabpanel"
        >
          <div className="absolute inset-0 overflow-hidden rounded-lg">
            <AnimatePresence custom={slideOffset} initial={false}>
              <motion.div
                animate="center"
                className="absolute inset-0 bg-card"
                custom={slideOffset}
                exit="exit"
                initial="enter"
                key={`card-${selected}`}
                transition={transition}
                variants={slideVariants}
              >
                {selectedItem?.cardContent ??
                  (selectedItem && (
                    <TabCardContent
                      description={selectedItem.description ?? ""}
                      fill={getWaveFill(selectedItem.color || activeColor)}
                      title={selectedItem.title}
                    >
                      {selectedItem.content}
                    </TabCardContent>
                  ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div
        aria-label="Smooth tabs"
        className={cn(
          "relative mt-auto flex items-center justify-between gap-1 py-1",
          "mx-auto w-full max-w-[400px] bg-background",
          "rounded-xl border",
          className
        )}
        ref={containerRef}
        role="tablist"
      >
        {indicator && (
          <motion.div
            animate={{
              width: indicator.width - 8,
              x: indicator.left + 4,
            }}
            className={cn(
              "absolute z-[1] rounded-lg transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
              selectedItem?.color || activeColor
            )}
            initial={false}
            style={{ height: "calc(100% - 8px)", top: "4px" }}
            transition={
              shouldReduceMotion ? { duration: 0 } : indicatorTransition
            }
          />
        )}

        <div className="relative z-[2] grid w-full auto-cols-fr grid-flow-col gap-1">
          {items.map((item, index) => {
            const isSelected = selected === item.id;
            const Icon = item.icon;
            return (
              <button
                aria-controls={isSelected ? panelId : undefined}
                aria-selected={isSelected}
                className={cn(
                  "relative flex items-center justify-center gap-0.5 rounded-lg px-2 py-1.5",
                  "font-medium text-sm transition-[color,background-color,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:active:scale-[0.97]",
                  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
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
                  if (el) {
                    buttonRefs.current.set(item.id, el);
                  } else {
                    buttonRefs.current.delete(item.id);
                  }
                }}
                role="tab"
                tabIndex={index === focusableIndex ? 0 : -1}
                type="button"
              >
                {Icon && <Icon className="size-4 shrink-0" />}
                <span className="truncate">{item.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
