"use client";

/**
 * @author: @dorianbaffier
 * @description: Spaces Sidebar
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  BookOpen,
  Briefcase,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  FileText,
  Folder,
  Hash,
  House,
  Image as ImageIcon,
  Inbox,
  type LucideIcon,
  Mail,
  Map as MapIcon,
  Music,
  Palette,
  PenLine,
  Receipt,
  Users,
} from "lucide-react";
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
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface SpaceItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Makes the row a folder holding these items. */
  children?: SpaceItem[];
}

export interface Space {
  id: string;
  name: string;
  icon: LucideIcon;
  /** Any CSS color. Tints the sidebar while the space is in view. */
  accent: string;
  pinned: SpaceItem[];
  items: SpaceItem[];
}

export interface SpacesSidebarProps {
  spaces?: Space[];
  /** Controlled space index. */
  space?: number;
  defaultSpace?: number;
  onSpaceChange?: (index: number) => void;
  /** Called with the item id when a row or pinned tile is chosen. */
  onSelect?: (spaceId: string, itemId: string) => void;
  className?: string;
}

const DEFAULT_SPACES: Space[] = [
  {
    id: "personal",
    name: "Personal",
    icon: House,
    accent: "#ea580c",
    pinned: [
      { id: "mail", label: "Mail", icon: Mail },
      { id: "calendar", label: "Calendar", icon: CalendarDays },
      { id: "music", label: "Music", icon: Music },
      { id: "photos", label: "Photos", icon: ImageIcon },
    ],
    items: [
      { id: "trip", label: "Lisbon weekend ideas", icon: MapIcon },
      {
        id: "recipes",
        label: "Recipes",
        icon: Folder,
        children: [
          { id: "ramen", label: "Weeknight ramen", icon: FileText },
          { id: "focaccia", label: "Overnight focaccia", icon: FileText },
          { id: "salsa", label: "Charred salsa", icon: FileText },
        ],
      },
      { id: "running", label: "Half marathon plan", icon: Dumbbell },
      { id: "reading", label: "Reading list", icon: BookOpen },
    ],
  },
  {
    id: "work",
    name: "Work",
    icon: Briefcase,
    accent: "#2563eb",
    pinned: [
      { id: "inbox", label: "Inbox", icon: Inbox },
      { id: "calendar", label: "Calendar", icon: CalendarDays },
      { id: "team", label: "Team", icon: Users },
      { id: "channels", label: "Channels", icon: Hash },
    ],
    items: [
      { id: "roadmap", label: "Q4 roadmap", icon: MapIcon },
      {
        id: "reviews",
        label: "Design reviews",
        icon: Folder,
        children: [
          { id: "checkout", label: "Checkout v3", icon: FileText },
          { id: "onboarding", label: "Onboarding flow", icon: FileText },
        ],
      },
      { id: "standup", label: "Standup notes", icon: PenLine },
      { id: "hiring", label: "Hiring pipeline", icon: Users },
      { id: "okrs", label: "Team OKRs", icon: FileText },
    ],
  },
  {
    id: "studio",
    name: "Studio",
    icon: Palette,
    accent: "#16a34a",
    pinned: [
      { id: "mail", label: "Mail", icon: Mail },
      { id: "board", label: "Mood board", icon: ImageIcon },
      { id: "invoices", label: "Invoices", icon: Receipt },
      { id: "music", label: "Music", icon: Music },
    ],
    items: [
      {
        id: "lumen",
        label: "Lumen rebrand",
        icon: Folder,
        children: [
          { id: "logo", label: "Logo explorations", icon: ImageIcon },
          { id: "type", label: "Type pairings", icon: FileText },
          { id: "brief", label: "Client brief", icon: FileText },
        ],
      },
      { id: "portfolio", label: "Portfolio refresh", icon: Palette },
      { id: "rates", label: "2027 rates", icon: Receipt },
    ],
  },
];

// Past the first or last space the track follows the pointer at this rate.
const RUBBER = 0.3;
// A release this fast (px per ms) turns the page even if it moved little.
const FLICK = 0.35;
// Wheel gestures have no "up"; this long after the last event, they end.
const WHEEL_IDLE = 110;
const SNAP = { type: "spring", stiffness: 420, damping: 42 } as const;
// The switcher's icons are this far apart, centre to centre.
const DOT_STEP = 32;

function rubber(offset: number, min: number) {
  if (offset > 0) {
    return offset * RUBBER;
  }
  if (offset < min) {
    return min + (offset - min) * RUBBER;
  }
  return offset;
}

export default function SpacesSidebar({
  spaces = DEFAULT_SPACES,
  space,
  defaultSpace = 0,
  onSpaceChange,
  onSelect,
  className,
}: SpacesSidebarProps) {
  const [ownSpace, setOwnSpace] = useState(defaultSpace);
  const index = space ?? ownSpace;
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(spaces.map((s) => [s.id, s.items[0]?.id ?? ""]))
  );
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const reduced = useReducedMotion();

  const viewportRef = useRef<HTMLDivElement>(null);
  const width = useRef(0);
  const x = useMotionValue(0);
  // How far through the spaces the track is, as a fractional index. Every
  // piece of chrome reads this, so it all moves with the finger.
  const progress = useTransform(x, (v) =>
    width.current ? -v / width.current : index
  );
  const stops = spaces.map((_, i) => i);
  const accent = useTransform(
    progress,
    stops.length > 1 ? stops : [0, 1],
    stops.length > 1
      ? spaces.map((s) => s.accent)
      : [spaces[0].accent, spaces[0].accent]
  );
  const dotX = useTransform(progress, (p) => p * DOT_STEP);

  const indexRef = useRef(index);
  indexRef.current = index;
  const go = useRef<(to: number, velocity?: number) => void>(() => undefined);

  go.current = (to, velocity = 0) => {
    const next = Math.max(0, Math.min(spaces.length - 1, to));
    animate(
      x,
      -next * width.current,
      reduced ? { duration: 0 } : { ...SNAP, velocity }
    );
    if (next !== indexRef.current) {
      setOwnSpace(next);
      onSpaceChange?.(next);
    }
  };

  // Keep the track on the current space when the width or a controlled
  // `space` changes.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const measure = () => {
      width.current = viewport.clientWidth;
      x.jump(-indexRef.current * width.current);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [x]);

  useEffect(() => {
    if (width.current && x.get() !== -index * width.current) {
      animate(x, -index * width.current, reduced ? { duration: 0 } : SNAP);
    }
  }, [index, x, reduced]);

  // Pointer drag, locked to whichever axis moves first so the lists can
  // still scroll vertically.
  const drag = useRef({
    id: -1,
    startX: 0,
    startY: 0,
    from: 0,
    axis: "" as "" | "x" | "y",
    lastX: 0,
    lastT: 0,
    velocity: 0,
    moved: false,
  });

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    x.stop();
    drag.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      from: x.get(),
      axis: "",
      lastX: event.clientX,
      lastT: event.timeStamp,
      velocity: 0,
      moved: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d.id !== event.pointerId) {
      return;
    }
    const dx = event.clientX - d.startX;
    const dy = event.clientY - d.startY;
    if (!d.axis) {
      if (Math.hypot(dx, dy) < 6) {
        return;
      }
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.axis === "x") {
        event.currentTarget.setPointerCapture(event.pointerId);
        d.moved = true;
      }
    }
    if (d.axis !== "x") {
      return;
    }
    const dt = Math.max(1, event.timeStamp - d.lastT);
    d.velocity = 0.8 * ((event.clientX - d.lastX) / dt) + 0.2 * d.velocity;
    d.lastX = event.clientX;
    d.lastT = event.timeStamp;
    const min = -(spaces.length - 1) * width.current;
    x.set(rubber(d.from + dx, min));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d.id !== event.pointerId) {
      return;
    }
    d.id = -1;
    if (d.axis !== "x") {
      return;
    }
    const start = Math.round(-d.from / width.current);
    const at = -x.get() / width.current;
    let to = Math.round(at);
    if (Math.abs(d.velocity) > FLICK) {
      to = start - Math.sign(d.velocity);
    }
    // One page per gesture, however hard the flick.
    to = Math.max(start - 1, Math.min(start + 1, to));
    go.current(to, d.velocity * 1000);
  };

  // A sideways two-finger swipe on a trackpad moves the track like a drag.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    let timer = 0;
    let from = 0;
    let travel = 0;
    let active = false;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
        return;
      }
      event.preventDefault();
      if (!active) {
        active = true;
        x.stop();
        from = x.get();
        travel = 0;
      }
      travel -= event.deltaX;
      const min = -(spaces.length - 1) * width.current;
      x.set(rubber(from + travel, min));
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        active = false;
        const start = Math.round(-from / width.current);
        // A third of a page is enough to commit, as with a drag.
        let to = start;
        if (travel < -width.current / 3) {
          to = start + 1;
        } else if (travel > width.current / 3) {
          to = start - 1;
        }
        go.current(to);
      }, WHEEL_IDLE);
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", onWheel);
      window.clearTimeout(timer);
    };
  }, [x, spaces.length]);

  const choose = (spaceId: string, itemId: string) => {
    setSelected((prev) => ({ ...prev, [spaceId]: itemId }));
    onSelect?.(spaceId, itemId);
  };

  const onSwitcherKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!step) {
      return;
    }
    event.preventDefault();
    const next = Math.max(0, Math.min(spaces.length - 1, index + step));
    go.current(next);
    const buttons =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        "button"
      );
    buttons?.[next]?.focus();
  };

  return (
    <motion.nav
      aria-label="Spaces"
      className={cn(
        "relative flex h-[540px] w-full max-w-[290px] flex-col overflow-hidden rounded-2xl border border-zinc-200 text-zinc-900 dark:border-zinc-800 dark:text-zinc-100",
        "bg-[color-mix(in_oklab,var(--space-accent)_7%,white)] dark:bg-[color-mix(in_oklab,var(--space-accent)_9%,#18181b)]",
        className
      )}
      style={{ "--space-accent": accent } as never}
    >
      <header className="relative h-14 shrink-0">
        {spaces.map((s, i) => (
          <SpaceTitle
            current={i === index}
            i={i}
            key={s.id}
            progress={progress}
            space={s}
          />
        ))}
      </header>

      <div
        className="relative min-h-0 flex-1 touch-pan-y select-none overflow-hidden"
        onClickCapture={(event) => {
          // A drag that ends over a row shouldn't also open it.
          if (drag.current.moved) {
            event.stopPropagation();
            drag.current.moved = false;
          }
        }}
        onPointerCancel={onPointerUp}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={viewportRef}
      >
        <motion.div className="flex h-full" style={{ x }}>
          {spaces.map((s, i) => (
            <section
              aria-hidden={i !== index}
              aria-label={s.name}
              className="flex h-full w-full shrink-0 flex-col overflow-y-auto px-3 pb-3"
              inert={i !== index}
              key={s.id}
            >
              <div className="grid grid-cols-4 gap-1.5">
                {s.pinned.map((item) => {
                  const active = selected[s.id] === item.id;
                  return (
                    <button
                      aria-label={item.label}
                      aria-pressed={active}
                      className={cn(
                        "flex h-11 items-center justify-center rounded-xl border outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400",
                        active
                          ? "border-[color-mix(in_oklab,var(--space-accent)_35%,transparent)] bg-white text-[var(--space-accent)] dark:bg-zinc-900"
                          : "border-transparent bg-white/70 text-zinc-500 hover:bg-white hover:text-zinc-800 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100"
                      )}
                      key={item.id}
                      onClick={() => choose(s.id, item.id)}
                      title={item.label}
                      type="button"
                    >
                      <item.icon className="size-[18px]" strokeWidth={1.75} />
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 mb-1 flex items-center justify-between px-2">
                <span className="font-medium text-[11px] text-zinc-500 dark:text-zinc-400">
                  Today
                </span>
              </div>
              <ul className="flex flex-col gap-px">
                {s.items.map((item) => (
                  <Row
                    item={item}
                    key={item.id}
                    onChoose={(id) => choose(s.id, id)}
                    onToggle={() =>
                      setOpen((prev) => ({
                        ...prev,
                        [`${s.id}/${item.id}`]: !prev[`${s.id}/${item.id}`],
                      }))
                    }
                    open={Boolean(open[`${s.id}/${item.id}`])}
                    selected={selected[s.id]}
                  />
                ))}
              </ul>
            </section>
          ))}
        </motion.div>
      </div>

      <footer className="flex h-14 shrink-0 items-center justify-center border-zinc-900/5 border-t dark:border-white/5">
        <div aria-label="Switch space" className="relative flex" role="toolbar">
          <motion.span
            aria-hidden="true"
            className="absolute top-0 left-0 size-8 rounded-lg bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:bg-white/10"
            style={{ x: dotX }}
          />
          {spaces.map((s, i) => (
            <SpaceDot
              active={i === index}
              i={i}
              key={s.id}
              onClick={() => go.current(i)}
              onKeyDown={onSwitcherKey}
              progress={progress}
              space={s}
            />
          ))}
        </div>
      </footer>
    </motion.nav>
  );
}

function SpaceTitle({
  space,
  i,
  current,
  progress,
}: {
  space: Space;
  i: number;
  current: boolean;
  progress: MotionValue<number>;
}) {
  // Each title slides a little and fades as its page leaves, so the header
  // always says which space the finger is closest to.
  const opacity = useTransform(progress, (p) =>
    Math.max(0, 1 - Math.abs(p - i) * 2.2)
  );
  const x = useTransform(progress, (p) => (i - p) * 56);
  const Icon = space.icon;
  return (
    <motion.div
      aria-hidden={!current}
      className="absolute inset-0 flex items-center gap-2.5 px-4"
      style={{ opacity, x }}
    >
      <span
        className="flex size-7 items-center justify-center rounded-lg text-white"
        style={{ backgroundColor: space.accent }}
      >
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <span className="font-semibold text-[15px] tracking-tight">
        {space.name}
      </span>
    </motion.div>
  );
}

function SpaceDot({
  space,
  i,
  active,
  progress,
  onClick,
  onKeyDown,
}: {
  space: Space;
  i: number;
  active: boolean;
  progress: MotionValue<number>;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  // The icon takes its space's color as the plate slides under it.
  const near = useTransform(progress, (p) => Math.max(0, 1 - Math.abs(p - i)));
  const color = useTransform(near, (n) =>
    n > 0.01
      ? `color-mix(in oklab, ${space.accent} ${Math.round(n * 100)}%, #a1a1aa)`
      : "#a1a1aa"
  );
  const Icon = space.icon;
  return (
    <motion.button
      aria-label={`${space.name} space`}
      aria-pressed={active}
      className="relative flex size-8 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
      onClick={onClick}
      onKeyDown={onKeyDown}
      style={{ color }}
      tabIndex={active ? 0 : -1}
      type="button"
    >
      <Icon className="size-4" strokeWidth={2} />
    </motion.button>
  );
}

function Row({
  item,
  selected,
  open,
  onChoose,
  onToggle,
  depth = 0,
}: {
  item: SpaceItem;
  selected: string;
  open: boolean;
  onChoose: (id: string) => void;
  onToggle: () => void;
  depth?: number;
}) {
  const folder = Boolean(item.children?.length);
  const active = !folder && selected === item.id;
  const Icon = item.icon;
  return (
    <li>
      <button
        aria-current={active ? "page" : undefined}
        aria-expanded={folder ? open : undefined}
        className={cn(
          "flex h-9 w-full items-center gap-2.5 rounded-lg pr-2 text-left text-[13.5px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400",
          active
            ? "bg-white font-medium text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:bg-white/10 dark:text-zinc-50"
            : "text-zinc-600 hover:bg-zinc-900/[0.04] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100"
        )}
        onClick={folder ? onToggle : () => onChoose(item.id)}
        style={{ paddingLeft: 8 + depth * 18 }}
        type="button"
      >
        {folder ? (
          <ChevronRight
            className={cn(
              "-ml-0.5 size-3.5 shrink-0 text-zinc-400 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
              open && "rotate-90"
            )}
          />
        ) : null}
        <Icon
          className={cn(
            "size-4 shrink-0",
            active ? "text-[var(--space-accent)]" : "text-zinc-400"
          )}
          strokeWidth={1.75}
        />
        <span className="truncate">{item.label}</span>
        {folder ? (
          <span className="ml-auto text-[11px] text-zinc-400 tabular-nums">
            {item.children?.length}
          </span>
        ) : null}
      </button>
      <AnimatePresence initial={false}>
        {folder && open ? (
          <motion.ul
            animate={{ height: "auto", opacity: 1 }}
            className="flex flex-col gap-px overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            {item.children?.map((child) => (
              <Row
                depth={depth + 1}
                item={child}
                key={child.id}
                onChoose={onChoose}
                onToggle={onToggle}
                open={false}
                selected={selected}
              />
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </li>
  );
}
