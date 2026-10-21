"use client";

/**
 * @author: @dorianbaffier
 * @description: Fold Menu
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ArrowUpRight } from "lucide-react";
import {
  AnimatePresence,
  animate,
  type MotionValue,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface FoldMenuItem {
  label: string;
  href: string;
  /** A short line under the label. */
  hint?: string;
}

export interface FoldMenuProps {
  items?: FoldMenuItem[];
  /** The left side of the bar: a logo or the site name. */
  brand?: ReactNode;
  /** Height of each folded panel, in px. */
  panelHeight?: number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

const DEFAULT_ITEMS: FoldMenuItem[] = [
  { label: "Work", href: "#work", hint: "Selected projects, 2019 to now" },
  { label: "Studio", href: "#studio", hint: "Who we are and how we work" },
  {
    label: "Journal",
    href: "#journal",
    hint: "Notes on type, print and paper",
  },
  { label: "Shop", href: "#shop", hint: "Prints, books and postcards" },
  { label: "Contact", href: "#contact", hint: "hello@foldstudio.co" },
];

const BAR = 56;
// A drag past this many px counts as a drag, not a tap.
const SLOP = 5;
// A release faster than this (px/ms) opens or closes whatever the position.
const FLICK = 0.35;
const OPEN = { type: "spring", duration: 0.6, bounce: 0 } as const;
const CLOSE = { type: "spring", duration: 0.45, bounce: 0 } as const;

export function FoldMenu({
  items = DEFAULT_ITEMS,
  brand,
  panelHeight = 64,
  open,
  defaultOpen = false,
  onOpenChange,
  className,
}: FoldMenuProps) {
  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const isOpen = open ?? ownOpen;
  const reduced = useReducedMotion();
  const menuId = useId();
  const total = items.length * panelHeight;

  // 0 is folded flat, 1 is open. Everything below is drawn from this.
  const f = useMotionValue(defaultOpen ? 1 : 0);
  // How far each panel is turned from facing you, in degrees.
  const theta = useTransform(f, (v) => (1 - Math.min(1, Math.max(0, v))) * 90);
  // A folded accordion is as tall as its panels' shadows on the wall.
  const height = useTransform(theta, (t) => {
    const stretch = Math.max(0, f.get() - 1) * 0.25;
    return total * Math.cos((t * Math.PI) / 180) + stretch * total;
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Drag the paper (or pull down on the bar) to fold it part way.
  const drag = useRef({
    id: -1,
    y: 0,
    from: 0,
    active: false,
    lastY: 0,
    lastT: 0,
    v: 0,
  });

  const setOpen = (next: boolean, velocity = 0) => {
    animate(
      f,
      next ? 1 : 0,
      reduced ? { duration: 0 } : { ...(next ? OPEN : CLOSE), velocity }
    );
    if (next !== isOpen) {
      setOwnOpen(next);
      onOpenChange?.(next);
    }
  };

  // Follow a controlled `open`.
  useEffect(() => {
    const target = isOpen ? 1 : 0;
    if (f.get() !== target && !drag.current.active) {
      const spring = isOpen ? OPEN : CLOSE;
      animate(f, target, reduced ? { duration: 0 } : spring);
    }
  }, [isOpen, f, reduced]);

  // Escape closes and hands focus back to the button.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    f.stop();
    drag.current = {
      id: event.pointerId,
      y: event.clientY,
      from: f.get(),
      active: false,
      lastY: event.clientY,
      lastT: event.timeStamp,
      v: 0,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d.id !== event.pointerId) {
      return;
    }
    const dy = event.clientY - d.y;
    if (!d.active) {
      if (Math.abs(dy) < SLOP) {
        return;
      }
      d.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const dt = Math.max(1, event.timeStamp - d.lastT);
    d.v = 0.8 * ((event.clientY - d.lastY) / dt) + 0.2 * d.v;
    d.lastY = event.clientY;
    d.lastT = event.timeStamp;
    let next = d.from + dy / total;
    // Past fully open the paper only gives a little, like it's taut.
    if (next > 1) {
      next = 1 + (next - 1) * 0.2;
    }
    f.set(Math.max(0, next));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d.id !== event.pointerId) {
      return;
    }
    d.id = -1;
    if (!d.active) {
      return;
    }
    let next = f.get() > 0.5;
    if (Math.abs(d.v) > FLICK) {
      next = d.v > 0;
    }
    // Keep the gesture's speed going into the spring.
    setOpen(next, (d.v * 1000) / total);
    // The click that follows a drag isn't a tap.
    window.setTimeout(() => {
      d.active = false;
    }, 0);
  };

  return (
    <div
      className={cn(
        "relative w-full max-w-sm touch-pan-x select-none text-zinc-900 [perspective:900px] dark:text-zinc-100",
        className
      )}
      onPointerCancel={onPointerUp}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      ref={rootRef}
    >
      <div
        className={cn(
          "relative z-10 flex items-center justify-between rounded-t-xl border border-zinc-200 bg-white px-4 transition-[border-radius] duration-200 dark:border-zinc-800 dark:bg-zinc-900",
          !isOpen && "rounded-b-xl"
        )}
        style={{ height: BAR }}
      >
        {brand ?? (
          <span className="font-semibold text-[15px] tracking-tight">
            Fold Studio
          </span>
        )}
        <button
          aria-controls={menuId}
          aria-expanded={isOpen}
          className="relative h-9 w-[72px] overflow-hidden rounded-full border border-zinc-200 font-medium text-[13px] outline-none transition-colors duration-150 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:hover:bg-zinc-800"
          onClick={() => {
            if (!drag.current.active) {
              setOpen(!isOpen);
            }
          }}
          ref={buttonRef}
          type="button"
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ y: 0, opacity: 1 }}
              className="absolute inset-0 flex items-center justify-center"
              exit={{ y: isOpen ? -14 : 14, opacity: 0 }}
              initial={{ y: isOpen ? 14 : -14, opacity: 0 }}
              key={isOpen ? "close" : "menu"}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            >
              {isOpen ? "Close" : "Menu"}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>

      <motion.nav
        aria-label="Main"
        className="relative"
        id={menuId}
        inert={!isOpen}
        style={{ height, transformStyle: "preserve-3d" }}
      >
        <Panel
          f={f}
          index={0}
          items={items}
          onPick={() => setOpen(false)}
          panelHeight={panelHeight}
          theta={theta}
        />
      </motion.nav>
    </div>
  );
}

/**
 * One panel of the accordion, with the rest hanging from its bottom edge.
 * Even panels lean back by `theta` and odd ones forward, so neighbours
 * meet at the creases like folded paper.
 */
function Panel({
  items,
  index,
  theta,
  f,
  panelHeight,
  onPick,
}: {
  items: FoldMenuItem[];
  index: number;
  theta: MotionValue<number>;
  f: MotionValue<number>;
  panelHeight: number;
  onPick: () => void;
}) {
  const item = items[index];
  const odd = index % 2 === 1;
  const rotateX = useTransform(theta, (t) => {
    if (index === 0) {
      return -t;
    }
    return odd ? 2 * t : -2 * t;
  });
  // Panels facing down catch less light than the ones facing up.
  const shade = useTransform(theta, (t) => {
    const s = Math.sin((t * Math.PI) / 180);
    return odd ? s * 0.38 : s * 0.1;
  });
  // The label settles in as its own panel opens, a beat after the crease.
  const textY = useTransform(f, (v) => {
    const local = Math.min(1, Math.max(0, v * 1.15 - index * 0.04));
    return (1 - local) * 8;
  });
  const last = index === items.length - 1;

  return (
    <motion.div
      className={cn(
        "absolute inset-x-0 origin-top",
        index === 0 ? "top-0" : "top-full"
      )}
      style={{
        height: panelHeight,
        rotateX,
        transformStyle: "preserve-3d",
      }}
    >
      <a
        className={cn(
          "group/fold relative flex h-full items-center gap-3 border-zinc-200 border-x bg-white px-4 outline-none transition-colors duration-150 [backface-visibility:hidden] hover:bg-zinc-50 focus-visible:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-visible:bg-zinc-800 dark:hover:bg-zinc-800",
          index > 0 && "border-zinc-100 border-t dark:border-zinc-800/70",
          last && "rounded-b-xl border-b"
        )}
        draggable={false}
        href={item.href}
        onClick={onPick}
      >
        <motion.span className="min-w-0 flex-1" style={{ y: textY }}>
          <span className="block font-medium text-[17px] tracking-tight">
            {item.label}
          </span>
          {item.hint ? (
            <span className="block truncate text-[12.5px] text-zinc-500 dark:text-zinc-400">
              {item.hint}
            </span>
          ) : null}
        </motion.span>
        <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
        <ArrowUpRight className="size-4 text-zinc-400 transition-colors duration-150 group-hover/fold:text-zinc-900 dark:group-hover/fold:text-zinc-100" />
        <motion.span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 bg-black",
            last && "rounded-b-xl"
          )}
          style={{ opacity: shade }}
        />
      </a>
      {last ? null : (
        <Panel
          f={f}
          index={index + 1}
          items={items}
          onPick={onPick}
          panelHeight={panelHeight}
          theta={theta}
        />
      )}
    </motion.div>
  );
}

export default function FoldMenuDemo() {
  return (
    <div className="flex h-[440px] w-full items-start justify-center pt-2">
      <FoldMenu />
    </div>
  );
}
