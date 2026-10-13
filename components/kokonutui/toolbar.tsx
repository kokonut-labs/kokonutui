"use client";

/**
 * @author: @dorianbaffier
 * @description: Toolbar
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  Bell,
  CircleUserRound,
  Edit2,
  FileDown,
  Frame,
  Layers,
  Lock,
  type LucideIcon,
  MousePointer2,
  Move,
  Palette,
  Shapes,
  Share2,
  SlidersHorizontal,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  type Transition,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ToolbarItem {
  id: string;
  title: string;
  icon: LucideIcon;
}

interface ToolbarProps {
  items?: ToolbarItem[];
  defaultSelected?: string;
  /** The selected tool id (`null` for none), for a controlled toolbar. */
  value?: string | null;
  className?: string;
  /** Classes for the selected tool, merged over the blue default. */
  activeColor?: string;
  /** Called with the clicked tool id, on select and on deselect. */
  onSelect?: (itemId: string) => void;
  /** Called with the new selection: the tool id, or `null` on deselect. */
  onValueChange?: (itemId: string | null) => void;
  /** Accessible name for the toolbar */
  ariaLabel?: string;
}

const DEFAULT_TOOLBAR_ITEMS: ToolbarItem[] = [
  { id: "select", title: "Select", icon: MousePointer2 },
  { id: "move", title: "Move", icon: Move },
  { id: "shapes", title: "Shapes", icon: Shapes },
  { id: "layers", title: "Layers", icon: Layers },
  { id: "frame", title: "Frame", icon: Frame },
  { id: "properties", title: "Properties", icon: SlidersHorizontal },
  { id: "export", title: "Export", icon: FileDown },
  { id: "share", title: "Share", icon: Share2 },
  { id: "notifications", title: "Notifications", icon: Bell },
  { id: "profile", title: "Profile", icon: CircleUserRound },
  { id: "appearance", title: "Appearance", icon: Palette },
];

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const buttonVariants = {
  animate: (isSelected: boolean) => ({
    gap: isSelected ? ".5rem" : 0,
    paddingLeft: isSelected ? "1rem" : ".5rem",
    paddingRight: isSelected ? "1rem" : ".5rem",
  }),
} satisfies Variants;

const spanVariants = {
  initial: { width: 0, opacity: 0 },
  animate: { width: "auto", opacity: 1 },
  exit: { width: 0, opacity: 0 },
} satisfies Variants;

const notificationVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: -10 },
  exit: { opacity: 0, y: -20, transition: { duration: 0.15, ease: EASE_OUT } },
} satisfies Variants;

const lineVariants = {
  initial: { scaleX: 0, x: "-50%" },
  animate: {
    scaleX: 1,
    x: "0%",
    transition: { duration: 0.2, ease: EASE_OUT },
  },
  exit: {
    scaleX: 0,
    x: "50%",
    transition: { duration: 0.15, ease: EASE_OUT },
  },
} satisfies Variants;

const transition: Transition = { type: "spring", bounce: 0, duration: 0.2 };

export function Toolbar({
  items = DEFAULT_TOOLBAR_ITEMS,
  defaultSelected = "select",
  value,
  className,
  activeColor,
  onSelect,
  onValueChange,
  ariaLabel = "Tools",
}: ToolbarProps) {
  const [uncontrolledSelected, setUncontrolledSelected] = useState<
    string | null
  >(defaultSelected);
  const selected = value === undefined ? uncontrolledSelected : value;
  const [isToggled, setIsToggled] = useState(false);
  const [activeNotification, setActiveNotification] = useState<string | null>(
    null
  );
  // Roving tab stop: the toolbar is one Tab stop and arrows move inside it.
  // Index `items.length` is the toggle at the end.
  const [focusIndex, setFocusIndex] = useState(() =>
    Math.max(
      0,
      items.findIndex((item) => item.id === selected)
    )
  );
  const tabStop = Math.min(focusIndex, items.length);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const notificationTimeoutRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const shouldReduceMotion = useReducedMotion();
  const itemTransition: Transition = shouldReduceMotion
    ? { duration: 0 }
    : transition;

  useEffect(() => () => clearTimeout(notificationTimeoutRef.current), []);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const buttons = Array.from(
      toolbarRef.current?.querySelectorAll("button") ?? []
    );
    const current = buttons.indexOf(e.currentTarget);
    if (current === -1) {
      return;
    }

    let next: number;
    switch (e.key) {
      case "ArrowRight":
        next = (current + 1) % buttons.length;
        break;
      case "ArrowLeft":
        next = (current - 1 + buttons.length) % buttons.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = buttons.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    buttons[next]?.focus();
  };

  const handleItemClick = (itemId: string) => {
    const nextSelected = selected === itemId ? null : itemId;
    setUncontrolledSelected(nextSelected);
    onValueChange?.(nextSelected);
    onSelect?.(itemId);
    setActiveNotification(itemId);
    clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = setTimeout(
      () => setActiveNotification(null),
      1500
    );
  };

  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "relative flex max-w-full items-center gap-3 p-2",
        "bg-background",
        "rounded-xl border",
        className
      )}
      ref={toolbarRef}
      role="toolbar"
    >
      <AnimatePresence>
        {activeNotification && (
          <motion.div
            animate="animate"
            className="motion-reduce:transform-none! absolute -top-8 left-1/2 z-50 -translate-x-1/2"
            exit="exit"
            initial="initial"
            transition={{ duration: 0.2, ease: EASE_OUT }}
            variants={notificationVariants}
          >
            <div className="rounded-full bg-primary px-3 py-1 text-primary-foreground text-xs">
              {items.find((item) => item.id === activeNotification)?.title}{" "}
              clicked!
            </div>
            <motion.div
              animate="animate"
              className="motion-reduce:transform-none! absolute -bottom-1 left-0 h-[2px] w-full origin-left bg-primary"
              exit="exit"
              initial="initial"
              variants={lineVariants}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrolls sideways on narrow screens; the padding keeps focus
            outlines inside the scroll box. */}
      <div className="-m-1 flex min-w-0 items-center gap-2 overflow-x-auto p-1">
        {items.map((item, index) => (
          <motion.button
            animate="animate"
            aria-label={item.title}
            aria-pressed={selected === item.id}
            className={cn(
              "relative flex shrink-0 items-center rounded-lg py-2",
              "font-medium text-sm transition-colors duration-300",
              selected === item.id
                ? cn("bg-[#1F9CFE] text-white", activeColor)
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            custom={selected === item.id}
            initial={false}
            key={item.id}
            onClick={() => handleItemClick(item.id)}
            onFocus={() => setFocusIndex(index)}
            onKeyDown={handleKeyDown}
            tabIndex={index === tabStop ? 0 : -1}
            title={item.title}
            transition={itemTransition}
            type="button"
            variants={buttonVariants}
          >
            <item.icon size={16} />
            <AnimatePresence initial={false}>
              {selected === item.id && (
                <motion.span
                  animate="animate"
                  className="overflow-hidden whitespace-nowrap"
                  exit="exit"
                  initial="initial"
                  transition={itemTransition}
                  variants={spanVariants}
                >
                  {item.title}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        ))}

        <button
          className={cn(
            "flex shrink-0 items-center gap-2 px-4 py-2",
            "rounded-xl border shadow-sm transition-[color,background-color,border-color,box-shadow,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
            "hover:shadow-md active:scale-[0.97] active:border-primary/50 motion-reduce:active:scale-100",
            isToggled
              ? [
                  "bg-[#1F9CFE] text-white",
                  "border-[#1F9CFE]/30",
                  "hover:bg-[#1F9CFE]/90",
                  "hover:border-[#1F9CFE]/40",
                ]
              : [
                  "bg-background text-muted-foreground",
                  "border-border/30",
                  "hover:bg-muted",
                  "hover:text-foreground",
                  "hover:border-border/40",
                ]
          )}
          onClick={() => setIsToggled(!isToggled)}
          onFocus={() => setFocusIndex(items.length)}
          onKeyDown={handleKeyDown}
          tabIndex={tabStop === items.length ? 0 : -1}
          type="button"
        >
          {isToggled ? (
            <Edit2 className="h-3.5 w-3.5" />
          ) : (
            <Lock className="h-3.5 w-3.5" />
          )}
          <span className="font-medium text-sm">
            {isToggled ? "On" : "Off"}
          </span>
        </button>
      </div>
    </div>
  );
}

export default Toolbar;
