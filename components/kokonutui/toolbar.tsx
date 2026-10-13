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
  type Variants,
} from "motion/react";
import * as React from "react";
import { cn } from "@/lib/utils";

interface ToolbarItem {
  id: string;
  title: string;
  icon: LucideIcon;
}

interface ToolbarProps {
  items?: ToolbarItem[];
  defaultSelected?: string;
  className?: string;
  activeColor?: string;
  onSelect?: (itemId: string) => void;
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
  className,
  activeColor = "text-primary",
  onSelect,
  ariaLabel = "Tools",
}: ToolbarProps) {
  const [selected, setSelected] = React.useState<string | null>(
    defaultSelected
  );
  const [isToggled, setIsToggled] = React.useState(false);
  const [activeNotification, setActiveNotification] = React.useState<
    string | null
  >(null);
  const outsideClickRef = React.useRef(null);
  const notificationTimeoutRef = React.useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);

  React.useEffect(() => () => clearTimeout(notificationTimeoutRef.current), []);

  const handleItemClick = (itemId: string) => {
    setSelected(selected === itemId ? null : itemId);
    onSelect?.(itemId);
    setActiveNotification(itemId);
    clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = setTimeout(
      () => setActiveNotification(null),
      1500
    );
  };

  return (
    <div className="space-y-2">
      <div
        aria-label={ariaLabel}
        className={cn(
          "relative flex items-center gap-3 p-2",
          "bg-background",
          "rounded-xl border",
          className
        )}
        ref={outsideClickRef}
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

        <div className="flex items-center gap-2">
          {items.map((item) => (
            <motion.button
              animate="animate"
              aria-label={item.title}
              aria-pressed={selected === item.id}
              className={cn(
                "relative flex items-center rounded-none px-3 py-2",
                "font-medium text-sm transition-colors duration-300",
                selected === item.id
                  ? "rounded-lg bg-[#1F9CFE] text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              custom={selected === item.id}
              initial={false}
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              title={item.title}
              transition={transition as any}
              type="button"
              variants={buttonVariants as any}
            >
              <item.icon
                className={cn(selected === item.id && "text-white")}
                size={16}
              />
              <AnimatePresence initial={false}>
                {selected === item.id && (
                  <motion.span
                    animate="animate"
                    className="overflow-hidden"
                    exit="exit"
                    initial="initial"
                    transition={transition}
                    variants={spanVariants}
                  >
                    {item.title}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          ))}

          <motion.button
            className={cn(
              "flex items-center gap-2 px-4 py-2",
              "rounded-xl border shadow-sm transition-colors duration-200",
              "hover:shadow-md active:border-primary/50",
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
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isToggled ? (
              <Edit2 className="h-3.5 w-3.5" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
            <span className="font-medium text-sm">
              {isToggled ? "On" : "Off"}
            </span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export default Toolbar;
