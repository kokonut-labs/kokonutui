"use client";

/**
 * @author: @dorianbaffier
 * @description: Marking Menu
 * @version: 1.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  CalendarDays,
  Folder,
  House,
  Inbox,
  type LucideIcon,
  PenLine,
  Search,
  Settings,
  User,
} from "lucide-react";
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface MarkingMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface MarkingMenuProps {
  /** Up to eight destinations, laid out clockwise from the top. */
  items?: MarkingMenuItem[];
  /** Called with the item picked, by menu, flick or keyboard. */
  onSelect?: (item: MarkingMenuItem) => void;
  /** The surface the menu opens over. Defaults to a small demo page. */
  children?: ReactNode;
  className?: string;
}

const DEFAULT_ITEMS: MarkingMenuItem[] = [
  { id: "home", label: "Home", icon: House },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "files", label: "Files", icon: Folder },
  { id: "search", label: "Search", icon: Search },
  { id: "compose", label: "Compose", icon: PenLine },
  { id: "profile", label: "Profile", icon: User },
  { id: "settings", label: "Settings", icon: Settings },
];

// Hold this long without moving and the menu appears under the finger.
// Move further than FLICK first and it never does: the stroke alone picks.
const HOLD_MS = 180;
const FLICK = 36;
// Inside this radius nothing is picked; letting go there cancels.
const DEAD_ZONE = 24;
// Geometry of the disc, in px.
const DISC = 112;
const RING = 78;
const HUB = 30;
// Selected items lean towards the pointer by this much.
const LEAN = 7;
// How long the stroke's tail stays on screen.
const TRAIL_MS = 260;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

// Arrow keys walk round the ring: right and down go clockwise.
const MOVE_KEYS: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

type Mode = "press" | "sticky";

interface OpenMenu {
  // Where the disc is drawn: the press point, nudged inside the surface.
  x: number;
  y: number;
  mode: Mode;
  fromKeyboard: boolean;
}

interface Gesture {
  id: number;
  x: number;
  y: number;
  stage: "pending" | "menu" | "flick";
  timer: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Item index for a direction, clockwise from the top, or -1 if too short. */
function pick(dx: number, dy: number, count: number) {
  if (Math.hypot(dx, dy) < DEAD_ZONE) {
    return -1;
  }
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  const step = 360 / count;
  return Math.round((((angle % 360) + 360) % 360) / step) % count;
}

/** A ring sector pointing up, spanning `span` degrees. */
function sectorPath(span: number) {
  const half = ((span / 2 - 1.5) * Math.PI) / 180;
  const inner = HUB + 5;
  const outer = DISC - 5;
  const point = (r: number, a: number) =>
    `${round(r * Math.sin(a))} ${round(-r * Math.cos(a))}`;
  return [
    `M${point(inner, -half)}`,
    `L${point(outer, -half)}`,
    `A${outer} ${outer} 0 0 1 ${point(outer, half)}`,
    `L${point(inner, half)}`,
    `A${inner} ${inner} 0 0 0 ${point(inner, -half)}`,
    "Z",
  ].join(" ");
}

function haptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(4);
  }
}

export default function MarkingMenu({
  items = DEFAULT_ITEMS,
  onSelect,
  children,
  className,
}: MarkingMenuProps) {
  const list = items.slice(0, 8);
  const count = list.length;
  const step = 360 / count;
  const menuId = useId();

  const surfaceRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const aimRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<SVGPathElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const trailPoints = useRef<{ x: number; y: number; t: number }[]>([]);
  const trailFrame = useRef(0);

  const [open, setOpen] = useState<OpenMenu | null>(null);
  const [selected, setSelected] = useState(-1);
  const [current, setCurrent] = useState(list[0]);
  const [flash, setFlash] = useState<{
    item: MarkingMenuItem;
    x: number;
    y: number;
    key: number;
  } | null>(null);

  // Live mirrors for pointer handlers, which must not wait for a render.
  const openRef = useRef(open);
  openRef.current = open;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // The highlight swings round to the picked slice on a spring, always the
  // short way.
  const wedge = useMotionValue(0);

  useEffect(() => {
    if (selected < 0) {
      return;
    }
    const from = wedge.get();
    const to = selected * step;
    const delta = ((((to - from) % 360) + 540) % 360) - 180;
    const controls = animate(wedge, from + delta, {
      type: "spring",
      stiffness: 520,
      damping: 36,
    });
    return () => controls.stop();
  }, [selected, step, wedge]);

  const local = useCallback((event: { clientX: number; clientY: number }) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    };
  }, []);

  /** Where to draw the disc so it stays inside the surface. */
  const place = useCallback((x: number, y: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 0;
    const h = rect?.height ?? 0;
    const pad = DISC + 8;
    return {
      x: w > pad * 2 ? Math.min(Math.max(x, pad), w - pad) : w / 2,
      y: h > pad * 2 ? Math.min(Math.max(y, pad), h - pad) : h / 2,
    };
  }, []);

  const select = useCallback((index: number) => {
    if (index !== selectedRef.current) {
      selectedRef.current = index;
      setSelected(index);
      if (index >= 0) {
        haptic();
      }
    }
  }, []);

  /** Point the aim tick at the pointer and pick the slice it is in. */
  const aim = useCallback(
    (x: number, y: number) => {
      const menu = openRef.current;
      if (!menu) {
        return;
      }
      const dx = x - menu.x;
      const dy = y - menu.y;
      const tick = aimRef.current;
      if (tick) {
        const away = Math.hypot(dx, dy) >= DEAD_ZONE;
        tick.style.opacity = away ? "1" : "0";
        tick.style.transform = `rotate(${Math.atan2(dy, dx) + Math.PI / 2}rad)`;
      }
      select(pick(dx, dy, count));
    },
    [count, select]
  );

  const close = useCallback(() => {
    const menu = openRef.current;
    openRef.current = null;
    setOpen(null);
    select(-1);
    if (menu?.fromKeyboard) {
      triggerRef.current?.focus();
    }
  }, [select]);

  const commit = useCallback(
    (index: number, at?: { x: number; y: number }) => {
      const item = list[index];
      if (item) {
        setCurrent(item);
        onSelect?.(item);
        if (at) {
          setFlash({ item, ...at, key: performance.now() });
        }
      }
      close();
    },
    [list, onSelect, close]
  );

  const show = useCallback(
    (x: number, y: number, mode: Mode, fromKeyboard = false) => {
      const at = place(x, y);
      const menu = { ...at, mode, fromKeyboard };
      openRef.current = menu;
      setOpen(menu);
      select(fromKeyboard ? 0 : -1);
    },
    [place, select]
  );

  // The stroke the pointer leaves while pressed, eaten from its tail.
  const drawTrail = useCallback(() => {
    trailFrame.current = 0;
    const now = performance.now();
    const points = trailPoints.current;
    while (points.length > 0 && now - points[0].t > TRAIL_MS) {
      points.shift();
    }
    const path = trailRef.current;
    if (path) {
      path.setAttribute(
        "d",
        points
          .map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)} ${round(p.y)}`)
          .join("")
      );
    }
    if (points.length > 0) {
      trailFrame.current = requestAnimationFrame(drawTrail);
    }
  }, []);

  const addTrail = useCallback(
    (x: number, y: number) => {
      trailPoints.current.push({ x, y, t: performance.now() });
      if (!trailFrame.current) {
        trailFrame.current = requestAnimationFrame(drawTrail);
      }
    },
    [drawTrail]
  );

  useEffect(
    () => () => {
      cancelAnimationFrame(trailFrame.current);
      window.clearTimeout(gestureRef.current?.timer);
    },
    []
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || gestureRef.current) {
      return;
    }
    if ((event.target as HTMLElement).closest("[data-marking-trigger]")) {
      return;
    }
    const p = local(event);
    const menu = openRef.current;
    if (menu?.mode === "sticky") {
      // A sticky menu (right click, keyboard) is picked with a click.
      aim(p.x, p.y);
      commit(selectedRef.current);
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const gesture: Gesture = {
      id: event.pointerId,
      x: p.x,
      y: p.y,
      stage: "pending",
      timer: window.setTimeout(() => {
        if (gestureRef.current === gesture && gesture.stage === "pending") {
          gesture.stage = "menu";
          show(gesture.x, gesture.y, "press");
        }
      }, HOLD_MS),
    };
    gestureRef.current = gesture;
    addTrail(p.x, p.y);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const p = local(event);
    const gesture = gestureRef.current;
    if (!gesture) {
      if (openRef.current?.mode === "sticky") {
        aim(p.x, p.y);
      }
      return;
    }
    if (event.pointerId !== gesture.id) {
      return;
    }
    addTrail(p.x, p.y);
    if (
      gesture.stage === "pending" &&
      Math.hypot(p.x - gesture.x, p.y - gesture.y) > FLICK
    ) {
      // Moving off before the menu shows: an expert stroke. No menu, the
      // direction alone decides.
      window.clearTimeout(gesture.timer);
      gesture.stage = "flick";
    }
    if (gesture.stage === "menu") {
      aim(p.x, p.y);
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.id) {
      return;
    }
    gestureRef.current = null;
    window.clearTimeout(gesture.timer);
    const p = local(event);
    if (gesture.stage === "menu") {
      aim(p.x, p.y);
      commit(selectedRef.current);
    } else if (gesture.stage === "flick") {
      commit(pick(p.x - gesture.x, p.y - gesture.y, count), p);
    }
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (gesture && event.pointerId === gesture.id) {
      window.clearTimeout(gesture.timer);
      gestureRef.current = null;
      close();
    }
  };

  const onContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const gesture = gestureRef.current;
    if (gesture) {
      window.clearTimeout(gesture.timer);
      gestureRef.current = null;
    }
    const p = local(event);
    show(p.x, p.y, "sticky");
  };

  const openFromKeyboard = () => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    show((rect?.width ?? 0) / 2, (rect?.height ?? 0) / 2, "sticky", true);
  };

  useEffect(() => {
    if (open?.fromKeyboard) {
      menuRef.current?.focus();
    }
  }, [open]);

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const index = selectedRef.current;
    const move = MOVE_KEYS[event.key];
    const digit = Number.parseInt(event.key, 10);
    if (move) {
      event.preventDefault();
      // From nothing picked, the first step lands on the top item.
      let from = index;
      if (index < 0) {
        from = move > 0 ? -1 : 1;
      }
      select((from + move + count) % count);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      commit(index);
    } else if (event.key === "Escape" || event.key === "Tab") {
      close();
    } else if (digit >= 1 && digit <= count) {
      event.preventDefault();
      commit(digit - 1);
    }
  };

  const Current = current?.icon ?? House;
  const active = selected >= 0 ? list[selected] : undefined;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a gesture surface; the Menu button is its keyboard path.
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: same as above.
    <div
      className={cn(
        "relative h-[440px] w-full touch-none select-none overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        open ? "cursor-default" : "cursor-crosshair",
        className
      )}
      onContextMenu={onContextMenu}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      ref={surfaceRef}
    >
      {children ?? (
        <div className="pointer-events-none absolute inset-0 flex flex-col p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <Current className="size-4" strokeWidth={1.75} />
            </span>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ opacity: 1, filter: "blur(0px)" }}
                className="font-medium text-sm"
                exit={{ opacity: 0, filter: "blur(2px)" }}
                initial={{ opacity: 0, filter: "blur(2px)" }}
                key={current?.id}
                transition={{ duration: 0.18, ease: EASE_OUT }}
              >
                {current?.label}
              </motion.span>
            </AnimatePresence>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Press and hold anywhere, or flick
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Right click opens it too
            </p>
          </div>
        </div>
      )}

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full text-zinc-400 dark:text-zinc-600"
      >
        <path
          fill="none"
          ref={trailRef}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </svg>

      <button
        aria-controls={open ? menuId : undefined}
        aria-expanded={Boolean(open)}
        aria-haspopup="menu"
        className="absolute top-4 right-4 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 font-medium text-xs text-zinc-600 transition-colors duration-150 ease-out hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-zinc-400 focus-visible:outline-offset-2 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        data-marking-trigger=""
        onClick={openFromKeyboard}
        ref={triggerRef}
        type="button"
      >
        Menu
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            aria-activedescendant={
              active ? `${menuId}-${active.id}` : undefined
            }
            aria-label="Go to"
            className="absolute outline-none"
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
            id={menuId}
            initial={{ opacity: 0, scale: 0.94 }}
            key="menu"
            onKeyDown={onMenuKeyDown}
            ref={menuRef}
            role="menu"
            style={{
              left: open.x - DISC,
              top: open.y - DISC,
              width: DISC * 2,
              height: DISC * 2,
            }}
            tabIndex={-1}
            transition={{ duration: 0.16, ease: EASE_OUT }}
          >
            <div className="absolute inset-0 rounded-full border border-zinc-200 bg-white shadow-[0_8px_30px_rgb(0_0_0/0.08)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_8px_30px_rgb(0_0_0/0.5)]" />
            <motion.div
              animate={{ opacity: selected >= 0 ? 1 : 0 }}
              aria-hidden="true"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              style={{ rotate: wedge }}
              transition={{ duration: 0.12 }}
            >
              <svg
                aria-hidden="true"
                className="overflow-visible"
                height={DISC * 2}
                viewBox={`${-DISC} ${-DISC} ${DISC * 2} ${DISC * 2}`}
                width={DISC * 2}
              >
                <path
                  className="fill-zinc-100 dark:fill-zinc-800"
                  d={sectorPath(step)}
                />
              </svg>
            </motion.div>

            {list.map((item, index) => {
              const angle = ((index * step - 90) * Math.PI) / 180;
              const cos = Math.cos(angle);
              const sin = Math.sin(angle);
              const isSelected = index === selected;
              const Icon = item.icon;
              return (
                <motion.div
                  animate={{
                    opacity: 1,
                    x: round(cos * (RING + (isSelected ? LEAN : 0))),
                    y: round(sin * (RING + (isSelected ? LEAN : 0))),
                  }}
                  aria-label={item.label}
                  className={cn(
                    "absolute top-1/2 left-1/2 -mt-5 -ml-5 flex size-10 items-center justify-center rounded-full transition-colors duration-150 ease-out",
                    isSelected
                      ? "text-zinc-900 dark:text-white"
                      : "text-zinc-400 dark:text-zinc-500"
                  )}
                  id={`${menuId}-${item.id}`}
                  initial={{
                    opacity: 0,
                    x: round(cos * RING * 0.55),
                    y: round(sin * RING * 0.55),
                  }}
                  key={item.id}
                  role="menuitem"
                  transition={{
                    type: "spring",
                    stiffness: 600,
                    damping: 34,
                    delay: open.mode === "press" ? index * 0.015 : 0,
                  }}
                >
                  <Icon className="size-[18px]" strokeWidth={1.75} />
                </motion.div>
              );
            })}

            {/* The hub names the slice; the tick on its rim follows the
                pointer exactly, while the highlight springs after it. */}
            <div
              className="absolute top-1/2 left-1/2 flex items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
              style={{
                width: HUB * 2,
                height: HUB * 2,
                marginLeft: -HUB,
                marginTop: -HUB,
              }}
            >
              <div
                className="absolute inset-0 opacity-0 transition-opacity duration-100"
                ref={aimRef}
              >
                <span className="absolute top-[3px] left-1/2 size-1 -translate-x-1/2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
              </div>
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  className="font-medium text-[11px] text-zinc-600 dark:text-zinc-300"
                  exit={{ opacity: 0, filter: "blur(2px)" }}
                  initial={{ opacity: 0, filter: "blur(2px)" }}
                  key={active?.id ?? "none"}
                  transition={{ duration: 0.12, ease: EASE_OUT }}
                >
                  {active?.label ?? ""}
                </motion.span>
              </AnimatePresence>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* After a flick, the pick shows briefly where the stroke ended, so
          the hand learns the direction without ever seeing the menu. */}
      <AnimatePresence>
        {flash ? (
          <motion.div
            animate={{ opacity: [0, 1, 1, 0], y: [4, 0, 0, -4] }}
            className="pointer-events-none absolute flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 font-medium text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            key={flash.key}
            onAnimationComplete={() => setFlash(null)}
            style={{ left: flash.x + 12, top: flash.y - 32 }}
            transition={{ duration: 0.9, times: [0, 0.15, 0.7, 1] }}
          >
            <flash.item.icon className="size-3.5" strokeWidth={1.75} />
            {flash.item.label}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
