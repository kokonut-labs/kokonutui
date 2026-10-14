"use client";

/**
 * @author: @dorianbaffier
 * @description: Split Nav
 * @version: 2.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  animate,
  type MotionValue,
  motion,
  motionValue,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type Ref,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface NavItem {
  name: string;
}

export interface MorphicNavbarProps {
  /** Links keyed by their href, in display order. */
  items?: Record<string, NavItem>;
  /**
   * Initially active path. Defaults to the first item's path. When an item's
   * path matches the current route, that item is active instead.
   */
  defaultPath?: string;
  /**
   * After 80px of page scroll, fold the bar down to the active link plus a
   * chevron that opens it again.
   */
  compact?: boolean;
  className?: string;
}

// The demo links to in-page anchors so it never navigates away. Use route
// paths ("/", "/works", ...) as keys in a real app.
const DEFAULT_NAV_ITEMS: Record<string, NavItem> = {
  "#home": { name: "Home" },
  "#work": { name: "Work" },
  "#notes": { name: "Notes" },
  "#blog": { name: "Blog" },
  "#about": { name: "About" },
};

/** Gap opened on each side of the active link, in px. */
const SPLIT = 8;
/** Gap a hovered link opens around itself, in px. */
const HOVER_SPLIT = 2;
/** Movement before a press turns into a scrub, in px. */
const DRAG_SLOP = 4;
/** Seconds of release velocity added to where a flick lands. */
const PROJECTION = 0.16;
/** Pointer samples older than this (ms) do not count toward release velocity. */
const VELOCITY_WINDOW = 90;
/** Page scroll past which `compact` folds the bar, in px. */
const COMPACT_AFTER = 80;
const CHEVRON_SIZE = 36;
const CHEVRON_GAP = 4;

const SPRING = { type: "spring", bounce: 0.15, visualDuration: 0.32 } as const;

const round2 = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const matchesPath = (path: string, current: string) =>
  path === current || (path !== "/" && current.startsWith(`${path}/`));

/** The longest item path that matches, so "/docs/a" beats "/docs". */
const findItemPath = (paths: string[], current: string | null) => {
  let match: string | undefined;
  for (const path of paths) {
    if (
      current &&
      matchesPath(path, current) &&
      (!match || path.length > match.length)
    ) {
      match = path;
    }
  }
  return match;
};

/** How much link `k` is "the split one" when the split sits at `focus`. */
const bump = (focus: number, k: number) => Math.max(0, 1 - Math.abs(focus - k));

/**
 * x offset of every link for a split centred on `focus`, which may be
 * fractional while scrubbing. Offsets are centred so the bar grows evenly on
 * both sides.
 */
const splitOffsets = (count: number, focus: number, hover: number | null) => {
  const cumulative = [0];
  let total = 0;
  for (let joint = 0; joint < count - 1; joint++) {
    let gap = SPLIT * Math.max(bump(focus, joint), bump(focus, joint + 1));
    const hoverJoint =
      hover !== null &&
      hover !== Math.round(focus) &&
      (joint === hover - 1 || joint === hover);
    if (hoverJoint) {
      gap = Math.max(gap, HOVER_SPLIT);
    }
    total += gap;
    cumulative.push(total);
  }
  return cumulative.map((x) => round2(x - total / 2));
};

interface BarLayout {
  centers: number[];
  widths: number[];
  rowWidth: number;
}

/**
 * Folded: the active link slides to the middle with the chevron beside it,
 * the rest tuck in behind it.
 */
const foldedOffsets = (layout: BarLayout, active: number) => {
  const { centers, widths, rowWidth } = layout;
  const activeWidth = widths[active] ?? 0;
  const groupWidth = activeWidth + CHEVRON_GAP + CHEVRON_SIZE;
  const activeCenter = rowWidth / 2 - groupWidth / 2 + activeWidth / 2;
  const xs = centers.map((center) => round2(activeCenter - center));
  const chevron = round2(
    activeCenter + activeWidth / 2 + CHEVRON_GAP + CHEVRON_SIZE / 2
  );
  return { xs, chevron };
};

/** Fractional link index under a row-local x, from the links' centres. */
const indexAt = (centers: number[], x: number) => {
  const last = centers.length - 1;
  if (last <= 0 || x <= (centers[0] ?? 0)) {
    return 0;
  }
  for (let k = 0; k < last; k++) {
    const a = centers[k] ?? 0;
    const b = centers[k + 1] ?? a;
    if (x < b) {
      return k + (x - a) / Math.max(1, b - a);
    }
  }
  return last;
};

interface DragState {
  pointerId: number;
  startX: number;
  rowLeft: number;
  scrubbing: boolean;
  focus: number;
  samples: { x: number; t: number }[];
}

const releaseVelocity = (samples: DragState["samples"], now: number) => {
  const recent = samples.filter((s) => now - s.t <= VELOCITY_WINDOW);
  const first = recent[0];
  const last = recent.at(-1);
  if (!(first && last) || last.t === first.t) {
    return 0;
  }
  return ((last.x - first.x) / (last.t - first.t)) * 1000;
};

/** A square patch that hides a rounded corner while the neighbour touches. */
const capScale = (gap: number, fold: number) =>
  `scaleX(${round2(clamp(1 - gap / 1.5, 0, 1) * (1 - clamp(fold * 4, 0, 1)))})`;

/** Where each key sends keyboard focus, from index `i` of `n` links. */
const KEY_MOVES: Record<string, (i: number, n: number) => number> = {
  ArrowLeft: (i) => i - 1,
  ArrowRight: (i) => i + 1,
  Home: () => 0,
  End: (_, n) => n - 1,
};

const SURFACE = "bg-zinc-900 dark:bg-zinc-100";
const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-inset";

function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

interface SegmentProps {
  href: string;
  name: string;
  x: MotionValue<number>;
  prevX?: MotionValue<number>;
  nextX?: MotionValue<number>;
  fold: MotionValue<number>;
  /** Stays visible when the bar folds. */
  pinned: boolean;
  hidden: boolean;
  highlighted: boolean;
  current: boolean;
  linkRef: Ref<HTMLAnchorElement>;
  onSelect: () => void;
  onFocus: (event: FocusEvent<HTMLAnchorElement>) => void;
  onHover: (event: PointerEvent<HTMLDivElement>, entering: boolean) => void;
}

function Segment({
  href,
  name,
  x,
  prevX,
  nextX,
  fold,
  pinned,
  hidden,
  highlighted,
  current,
  linkRef,
  onSelect,
  onFocus,
  onHover,
}: SegmentProps) {
  const transform = useTransform(() => `translate3d(${x.get()}px,0,0)`);
  const opacity = useTransform(() =>
    pinned ? 1 : round2(clamp(1 - fold.get() * 1.8, 0, 1))
  );
  const leftCap = useTransform(() =>
    prevX ? capScale(x.get() - prevX.get(), fold.get()) : "scaleX(0)"
  );
  const rightCap = useTransform(() =>
    nextX ? capScale(nextX.get() - x.get(), fold.get()) : "scaleX(0)"
  );
  // Next's Link scrolls the page when a hash matches no element, so in-page
  // anchors use a plain <a> and keep the browser's behaviour.
  const NavLink = href.startsWith("#") ? "a" : Link;

  return (
    <motion.div
      className={cn(
        "relative",
        pinned ? "z-20" : "z-10",
        hidden && "pointer-events-none"
      )}
      onPointerEnter={(event) => onHover(event, true)}
      onPointerLeave={(event) => onHover(event, false)}
      style={{ transform, opacity }}
    >
      <NavLink
        aria-current={current ? "page" : undefined}
        className={cn(
          "relative flex h-9 items-center rounded-xl px-4 font-medium text-sm transition-colors duration-150",
          SURFACE,
          FOCUS_RING,
          highlighted
            ? "text-white dark:text-zinc-950"
            : "text-zinc-400 hover:text-zinc-100 dark:text-zinc-500 dark:hover:text-zinc-800"
        )}
        draggable={false}
        href={href}
        inert={hidden}
        onClick={onSelect}
        onDragStart={(event: MouseEvent) => event.preventDefault()}
        onFocus={onFocus}
        ref={linkRef}
      >
        {prevX ? (
          <motion.span
            aria-hidden="true"
            className={cn(
              "absolute inset-y-0 -left-px w-3 origin-left",
              SURFACE
            )}
            style={{ transform: leftCap }}
          />
        ) : null}
        {nextX ? (
          <motion.span
            aria-hidden="true"
            className={cn(
              "absolute inset-y-0 -right-px w-3 origin-right",
              SURFACE
            )}
            style={{ transform: rightCap }}
          />
        ) : null}
        <span className="relative">{name}</span>
        <span
          aria-hidden="true"
          className={cn(
            "absolute bottom-1.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-orange-500 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
            highlighted ? "scale-x-100" : "scale-x-0"
          )}
        />
      </NavLink>
    </motion.div>
  );
}

/** True once the page has scrolled past `COMPACT_AFTER`, when enabled. */
function useScrolledPast(enabled: boolean) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setPast(false);
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      setPast(window.scrollY > COMPACT_AFTER);
    };
    const onScroll = () => {
      if (!frame) {
        frame = requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [enabled]);
  return past;
}

/** Opened by the chevron; folds again after another `COMPACT_AFTER` of scroll. */
function useUserOpen(scrolledPast: boolean) {
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  useEffect(() => {
    if (openedAt === null) {
      return;
    }
    const onScroll = () => {
      if (Math.abs(window.scrollY - openedAt) > COMPACT_AFTER) {
        setOpenedAt(null);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [openedAt]);
  if (!scrolledPast && openedAt !== null) {
    setOpenedAt(null);
  }
  return [openedAt !== null, () => setOpenedAt(window.scrollY)] as const;
}

export function MorphicNavbar({
  items = DEFAULT_NAV_ITEMS,
  defaultPath,
  compact = false,
  className,
}: MorphicNavbarProps) {
  const entries = Object.entries(items);
  const paths = entries.map(([path]) => path);
  const count = entries.length;
  const pathname = usePathname();
  const [activePath, setActivePath] = useState(
    () => findItemPath(paths, pathname) ?? defaultPath ?? paths[0] ?? "/"
  );

  // Follow the route when it changes to one of the items, so the active link
  // stays right after the back button or navigation from elsewhere. Clicks
  // still update it right away. In-page anchors (the demo) never match.
  const [syncedPathname, setSyncedPathname] = useState(pathname);
  if (pathname !== syncedPathname) {
    setSyncedPathname(pathname);
    const routePath = findItemPath(paths, pathname);
    if (routePath) {
      setActivePath(routePath);
    }
  }

  const activeIndex = paths.indexOf(findItemPath(paths, activePath) ?? "");
  /** Where a scrub or keyboard focus has moved the split, before committing. */
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [keyboardInside, setKeyboardInside] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);

  const scrolledPast = useScrolledPast(compact);
  const [userOpen, openBar] = useUserOpen(scrolledPast);
  const folded =
    compact &&
    scrolledPast &&
    !userOpen &&
    !keyboardInside &&
    !scrubbing &&
    activeIndex >= 0;

  const highlightIndex = previewIndex ?? activeIndex;

  // One spring-driven offset per link, rebuilt only when the count changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the first split only seeds new values; later moves animate them
  const xs = useMemo(
    () => splitOffsets(count, activeIndex, null).map((x) => motionValue(x)),
    [count]
  );
  const fold = useMotionValue(0);
  const chevronX = useMotionValue(0);
  const chevronTransform = useTransform(
    () => `translate3d(${chevronX.get()}px,0,0)`
  );

  const rowRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const layoutRef = useRef<BarLayout | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const instantRef = useRef(false);
  const suppressClickRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const reduceRef = useRef(false);
  reduceRef.current = reduceMotion === true;

  const live = { activeIndex, highlightIndex, hoverIndex, folded, count };
  const liveRef = useRef(live);
  liveRef.current = live;

  // Measures the links' natural (untransformed) positions.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) {
      return;
    }
    const measure = () => {
      const boxes = linkRefs.current
        .slice(0, count)
        .map((el) => el?.parentElement);
      layoutRef.current = {
        centers: boxes.map((box) =>
          box ? box.offsetLeft + box.offsetWidth / 2 : 0
        ),
        widths: boxes.map((box) => box?.offsetWidth ?? 0),
        rowWidth: row.offsetWidth,
      };
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [count]);

  /** Sends every offset towards where the current state says it belongs. */
  const retargetRef = useRef<(instant: boolean) => void>(() => undefined);
  retargetRef.current = (instant) => {
    const state = liveRef.current;
    const drag = dragRef.current;
    const jump = instant || reduceRef.current;
    const to = (value: MotionValue<number>, target: number) => {
      if (jump) {
        value.jump(target);
      } else {
        animate(value, target, SPRING);
      }
    };
    const layout = layoutRef.current;
    let targets: number[];
    let chevron: number;
    if (state.folded && layout) {
      const result = foldedOffsets(layout, state.activeIndex);
      targets = result.xs;
      chevron = result.chevron;
    } else {
      const focus = drag?.scrubbing ? drag.focus : state.highlightIndex;
      targets = splitOffsets(
        state.count,
        focus,
        drag?.scrubbing ? null : state.hoverIndex
      );
      // Unfolded, the chevron waits tucked behind the active link.
      const anchor = Math.max(0, state.activeIndex);
      chevron = (layout?.centers[anchor] ?? 0) + (targets[anchor] ?? 0);
    }
    for (const [i, value] of xs.entries()) {
      to(value, targets[i] ?? 0);
    }
    to(chevronX, round2(chevron - CHEVRON_SIZE / 2));
    to(fold, state.folded ? 1 : 0);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: these are the inputs retarget reads through liveRef
  useEffect(() => {
    retargetRef.current(instantRef.current);
    instantRef.current = false;
  }, [activeIndex, highlightIndex, hoverIndex, folded, count]);

  const selectIndex = (index: number) => {
    const path = paths[index];
    if (path !== undefined) {
      setActivePath(path);
    }
  };

  const toFocus = (clientX: number, drag: DragState) =>
    clamp(
      indexAt(layoutRef.current?.centers ?? [], clientX - drag.rowLeft),
      0,
      count - 1
    );

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (event.button !== 0 || folded || target.closest("[data-chevron]")) {
      return;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      rowLeft: event.currentTarget.getBoundingClientRect().left,
      scrubbing: false,
      focus: highlightIndex,
      samples: [{ x: event.clientX, t: event.timeStamp }],
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    if (!drag.scrubbing) {
      if (Math.abs(event.clientX - drag.startX) < DRAG_SLOP) {
        return;
      }
      drag.scrubbing = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setScrubbing(true);
      setHoverIndex(null);
    }
    drag.samples.push({ x: event.clientX, t: event.timeStamp });
    if (drag.samples.length > 12) {
      drag.samples.shift();
    }
    drag.focus = toFocus(event.clientX, drag);
    setPreviewIndex(Math.round(drag.focus));
    retargetRef.current(false);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>, commit: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    if (!drag.scrubbing) {
      return;
    }
    setScrubbing(false);
    setPreviewIndex(null);
    if (!commit) {
      retargetRef.current(false);
      return;
    }
    // A flick lands where its velocity would carry it, so it can skip links.
    const velocity = releaseVelocity(drag.samples, event.timeStamp);
    const index = Math.round(
      toFocus(event.clientX + velocity * PROJECTION, drag)
    );
    // The browser still sends a click for this press; swallow it and fire
    // the chosen link's own click so Next's router (or the anchor) handles it.
    suppressClickRef.current = true;
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    selectIndex(index);
    linkRefs.current[index]?.click();
  };

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current && event.isTrusted) {
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = KEY_MOVES[event.key];
    const from = linkRefs.current.indexOf(
      document.activeElement as HTMLAnchorElement
    );
    if (!move || from < 0) {
      return;
    }
    event.preventDefault();
    const next = clamp(move(from, count), 0, count - 1);
    instantRef.current = true;
    setPreviewIndex(next);
    linkRefs.current[next]?.focus();
  };

  const onLinkFocus = (index: number, event: FocusEvent<HTMLAnchorElement>) => {
    if (event.currentTarget.matches(":focus-visible")) {
      // Keyboard moves are instant: no spring for something done this often.
      instantRef.current = true;
      setKeyboardInside(true);
      setPreviewIndex(index);
    }
  };

  const onRowBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      instantRef.current = true;
      setKeyboardInside(false);
      setPreviewIndex(null);
    }
  };

  const onHover = (
    index: number,
    event: PointerEvent<HTMLDivElement>,
    entering: boolean
  ) => {
    if (event.pointerType !== "mouse" || dragRef.current?.scrubbing) {
      return;
    }
    setHoverIndex((current) => {
      if (entering) {
        return index;
      }
      return current === index ? null : current;
    });
  };

  const openFolded = () => {
    openBar();
    linkRefs.current[activeIndex]?.focus({ preventScroll: true });
  };

  return (
    <nav
      aria-label="Main"
      className={cn("flex justify-center px-4 py-2", className)}
    >
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: the row only adds scrubbing and arrow keys on top of real links */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: same as above */}
      <div
        className="relative flex touch-pan-y select-none items-center"
        onBlur={onRowBlur}
        onClickCapture={onClickCapture}
        onKeyDown={onKeyDown}
        onPointerCancel={(event) => endDrag(event, false)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => endDrag(event, true)}
        ref={rowRef}
      >
        {entries.map(([path, { name }], index) => (
          <Segment
            current={index === activeIndex}
            fold={fold}
            hidden={folded && index !== activeIndex}
            highlighted={index === highlightIndex}
            href={path}
            key={`${count}-${path}`}
            linkRef={(el) => {
              linkRefs.current[index] = el;
            }}
            name={name}
            nextX={xs[index + 1]}
            onFocus={(event) => onLinkFocus(index, event)}
            onHover={(event, entering) => onHover(index, event, entering)}
            onSelect={() => selectIndex(index)}
            pinned={index === activeIndex}
            prevX={xs[index - 1]}
            x={xs[index] ?? fold}
          />
        ))}
        {compact ? (
          <motion.button
            aria-expanded={!folded}
            aria-hidden={!folded}
            aria-label="Show all links"
            className={cn(
              "absolute top-0 left-0 flex size-9 items-center justify-center rounded-xl text-zinc-400 transition-colors duration-150 hover:text-zinc-100 dark:text-zinc-500 dark:hover:text-zinc-800",
              SURFACE,
              FOCUS_RING,
              folded ? "z-30" : "pointer-events-none z-0"
            )}
            data-chevron=""
            onClick={openFolded}
            style={{ transform: chevronTransform, opacity: fold }}
            tabIndex={folded ? 0 : -1}
            type="button"
          >
            <ChevronIcon />
          </motion.button>
        ) : null}
      </div>
    </nav>
  );
}

export default MorphicNavbar;
