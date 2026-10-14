"use client";

/**
 * @author: @dorianbaffier
 * @description: Paper Fold
 * @version: 1.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Plane } from "lucide-react";
import {
  type AnimationPlaybackControls,
  animate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
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

// How far open the paper rests while hovered, as a hint that it unfolds.
const HOVER_PEEK = 0.07;
// Movement before a press counts as a drag rather than a click.
const DRAG_SLOP = 4;
// Release faster than this (share of the full fold per second) and the
// paper follows the flick, whatever its position.
const FLICK = 1.2;
// Opening overshoots flat by a hair, so the paper settles like paper.
const OPEN_SPRING = {
  type: "spring",
  stiffness: 260,
  damping: 22,
  restDelta: 0.001,
} as const;
const CLOSE_SPRING = {
  type: "spring",
  stiffness: 320,
  damping: 34,
  restDelta: 0.001,
} as const;
const PEEK_TRANSITION = { duration: 0.25, ease: [0.23, 1, 0.32, 1] } as const;

export interface PaperFoldProps {
  /** Always visible; clicking it folds and unfolds the rest. */
  header?: ReactNode;
  /** The folded panels, top to bottom. */
  panels?: ReactNode[];
  /** Height of each panel in px. */
  panelHeight?: number;
  /** Controlled state. */
  open?: boolean;
  /** Initial state when uncontrolled. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * Angle of one panel relative to the one above it. The panels hang from one
 * another like a folded map: the first tips back by the fold angle, and
 * each next one bends twice that the other way, so they zig-zag flat.
 */
function panelAngle(index: number, fold: number) {
  if (index === 0) {
    return -fold;
  }
  return index % 2 === 1 ? 2 * fold : -2 * fold;
}

const round = (n: number) => Math.round(n * 100) / 100;

export default function PaperFold({
  header = <DefaultHeader />,
  panels = DEFAULT_PANELS,
  panelHeight = 76,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  className,
}: PaperFoldProps) {
  const bodyId = useId();
  const reduceMotion = useReducedMotion();
  const [internal, setInternal] = useState(defaultOpen);
  const open = openProp ?? internal;

  // 0 is folded flat under the header, 1 is open flat.
  const progress = useMotionValue(open ? 1 : 0);
  const animation = useRef<AnimationPlaybackControls | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shadeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef<{
    id: number;
    startY: number;
    start: number;
    moved: boolean;
    samples: { t: number; p: number }[];
  } | null>(null);
  const suppressClick = useRef(false);

  const count = panels.length;
  const fullHeight = count * panelHeight;

  // Each frame writes the panel transforms, their shading and the body's
  // height straight to the DOM. The height has to change: content below
  // the paper should follow it.
  const apply = (p: number) => {
    const fold = (1 - p) * 90;
    const rad = (fold * Math.PI) / 180;
    for (let i = 0; i < count; i++) {
      const panel = panelRefs.current[i];
      if (panel) {
        panel.style.transform = `rotateX(${round(panelAngle(i, fold))}deg)`;
      }
      const shade = shadeRefs.current[i];
      if (shade) {
        // Panels tipped towards the light stay pale; the ones facing down
        // fall into shadow.
        const strength = i % 2 === 0 ? 0.06 : 0.22;
        shade.style.opacity = String(round(strength * Math.abs(Math.sin(rad))));
      }
    }
    if (bodyRef.current) {
      bodyRef.current.style.height = `${round(fullHeight * Math.cos(rad))}px`;
    }
    if (headerRef.current) {
      // The header's bottom corners round off as the paper tucks away.
      const radius = round(16 * Math.min(1, Math.max(0, 1 - p * 6)));
      headerRef.current.style.borderBottomLeftRadius = `${radius}px`;
      headerRef.current.style.borderBottomRightRadius = `${radius}px`;
    }
  };
  useMotionValueEvent(progress, "change", apply);

  // Follow the controlled value when the parent changes it.
  useEffect(() => {
    if (drag.current) {
      return;
    }
    const target = open ? 1 : 0;
    if (Math.abs(progress.get() - target) > 0.2) {
      animation.current?.stop();
      progress.jump(target);
    }
  }, [open, progress]);

  useEffect(() => () => animation.current?.stop(), []);

  const settle = (next: boolean, velocity = 0) => {
    animation.current?.stop();
    if (reduceMotion) {
      progress.jump(next ? 1 : 0);
    } else {
      animation.current = animate(progress, next ? 1 : 0, {
        ...(next ? OPEN_SPRING : CLOSE_SPRING),
        velocity,
      });
    }
    if (next !== open) {
      if (openProp === undefined) {
        setInternal(next);
      }
      onOpenChange?.(next);
    }
  };

  const peek = (to: number) => {
    if (open || drag.current || reduceMotion) {
      return;
    }
    animation.current?.stop();
    animation.current = animate(progress, to, PEEK_TRANSITION);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) {
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    suppressClick.current = false;
    drag.current = {
      id: event.pointerId,
      startY: event.clientY,
      start: progress.get(),
      moved: false,
      samples: [{ t: event.timeStamp, p: progress.get() }],
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) {
      return;
    }
    const dy = event.clientY - current.startY;
    if (!current.moved) {
      if (Math.abs(dy) < DRAG_SLOP) {
        return;
      }
      current.moved = true;
      animation.current?.stop();
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    // Pulling down unfolds, at the same rate the bottom edge moves. Past
    // either end the paper resists instead of stopping dead.
    let p = current.start + dy / fullHeight;
    if (p > 1) {
      p = 1 + (p - 1) * 0.15;
    } else if (p < 0) {
      p *= 0.15;
    }
    progress.set(p);
    current.samples.push({ t: event.timeStamp, p });
    while (
      current.samples.length > 2 &&
      event.timeStamp - current.samples[0].t > 80
    ) {
      current.samples.shift();
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) {
      return;
    }
    drag.current = null;
    if (!current.moved) {
      return;
    }
    suppressClick.current = true;
    const first = current.samples[0];
    const last = current.samples.at(-1) ?? first;
    const elapsed = (last.t - first.t) / 1000;
    const paused = event.timeStamp - last.t > 80;
    const velocity = elapsed > 0 && !paused ? (last.p - first.p) / elapsed : 0;
    const p = progress.get();
    let next = p > 0.5;
    if (Math.abs(velocity) > FLICK) {
      next = velocity > 0;
    }
    settle(next, velocity);
  };

  return (
    <div
      className={cn("w-[340px] touch-pan-x select-none", className)}
      onLostPointerCapture={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          peek(HOVER_PEEK);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") {
          peek(0);
        }
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className="relative z-10 overflow-hidden rounded-t-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        ref={headerRef}
        style={{
          borderBottomLeftRadius: open ? 0 : 16,
          borderBottomRightRadius: open ? 0 : 16,
        }}
      >
        <button
          aria-controls={bodyId}
          aria-expanded={open}
          className="block w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            settle(!open);
          }}
          type="button"
        >
          {header}
        </button>
      </div>

      <div
        aria-hidden={!open}
        className="relative"
        id={bodyId}
        ref={bodyRef}
        // Perspective lives on the panels' direct parent; set any higher
        // and the folds flatten into a plain squash.
        style={{
          height: open ? fullHeight : 0,
          perspective: 900,
          perspectiveOrigin: "50% 0%",
        }}
      >
        <Panel
          height={panelHeight}
          index={0}
          initialFold={open ? 0 : 90}
          last={count === 1}
          panelRefs={panelRefs}
          panels={panels}
          shadeRefs={shadeRefs}
        />
      </div>
    </div>
  );
}

/** One panel, with the rest of the paper hanging from its bottom edge. */
function Panel({
  panels,
  index,
  height,
  initialFold,
  last,
  panelRefs,
  shadeRefs,
}: {
  panels: ReactNode[];
  index: number;
  height: number;
  initialFold: number;
  last: boolean;
  panelRefs: { current: (HTMLDivElement | null)[] };
  shadeRefs: { current: (HTMLDivElement | null)[] };
}) {
  return (
    <div
      className="absolute inset-x-0 origin-top"
      ref={(node) => {
        panelRefs.current[index] = node;
      }}
      style={{
        height,
        top: index === 0 ? 0 : "100%",
        transform: `rotateX(${panelAngle(index, initialFold)}deg)`,
        transformStyle: "preserve-3d",
      }}
    >
      <div
        className={cn(
          "relative h-full overflow-hidden border-zinc-200 border-x bg-white dark:border-zinc-800 dark:bg-zinc-900",
          last && "rounded-b-2xl border-b"
        )}
      >
        {/* The crease: a perforated line where this panel meets the one above. */}
        <div className="absolute inset-x-4 top-0 border-zinc-200 border-t border-dashed dark:border-zinc-700" />
        {panels[index]}
        <div
          className="pointer-events-none absolute inset-0 bg-black"
          ref={(node) => {
            shadeRefs.current[index] = node;
          }}
          style={{ opacity: 0 }}
        />
      </div>
      {index + 1 < panels.length && (
        <Panel
          height={height}
          index={index + 1}
          initialFold={initialFold}
          last={index + 2 === panels.length}
          panelRefs={panelRefs}
          panels={panels}
          shadeRefs={shadeRefs}
        />
      )}
    </div>
  );
}

function DefaultHeader() {
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>Kokonut Air · KO 026</span>
        <span className="tabular-nums">14 Oct</span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-3xl text-zinc-900 tracking-tight dark:text-zinc-50">
            LIS
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Lisbon</p>
        </div>
        <div className="flex flex-1 items-center gap-2 px-4 text-zinc-300 dark:text-zinc-600">
          <span className="h-px flex-1 bg-current" />
          <Plane className="size-4 text-zinc-900 dark:text-zinc-100" />
          <span className="h-px flex-1 bg-current" />
        </div>
        <div className="text-right">
          <p className="font-semibold text-3xl text-zinc-900 tracking-tight dark:text-zinc-50">
            HND
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Tokyo</p>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="font-medium text-sm text-zinc-900 tabular-nums dark:text-zinc-100">
        {value}
      </p>
    </div>
  );
}

// Bar widths for the barcode, fixed so server and browser draw the same.
const BARS = [
  2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 1, 3, 2, 1, 1, 2, 3, 1, 2, 2, 1, 1, 4, 1, 2, 1,
  3, 2, 1, 1, 2, 1, 3, 1, 1, 2, 2, 1, 4, 1, 1, 2, 1, 3, 2, 1,
];

function Barcode() {
  let x = 0;
  const rects = BARS.map((width, i) => {
    const rect = { x, width, dark: i % 2 === 0 };
    x += width;
    return rect;
  });
  return (
    <svg
      aria-hidden="true"
      className="h-9 w-full text-zinc-900 dark:text-zinc-100"
      preserveAspectRatio="none"
      viewBox={`0 0 ${x} 10`}
    >
      {rects
        .filter((r) => r.dark)
        .map((r) => (
          <rect
            fill="currentColor"
            height={10}
            key={r.x}
            width={r.width}
            x={r.x}
          />
        ))}
    </svg>
  );
}

const DEFAULT_PANELS: ReactNode[] = [
  <div className="grid h-full grid-cols-3 items-center px-5" key="passenger">
    <Detail label="Passenger" value="D. Baffier" />
    <Detail label="Seat" value="26A" />
    <Detail label="Gate" value="C12" />
  </div>,
  <div className="grid h-full grid-cols-3 items-center px-5" key="boarding">
    <Detail label="Boarding" value="21:40" />
    <Detail label="Group" value="2" />
    <Detail label="Departs" value="22:10" />
  </div>,
  <div className="flex h-full flex-col justify-center gap-1.5 px-5" key="code">
    <Barcode />
    <p className="text-center text-[10px] text-zinc-400 tabular-nums tracking-[0.3em]">
      KO0260261410
    </p>
  </div>,
];
