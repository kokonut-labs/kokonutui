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

// Movement before a press counts as a drag rather than a click.
const DRAG_SLOP = 4;
// Release faster than this (share of the full fold per second) and the
// paper follows the flick, whatever its position.
const FLICK = 1.2;
// Panels unfold one after another, top first, each starting this share of
// the way after the one above. Folding runs the other way, bottom first.
const STAGGER = 0.14;
// No bounce: paper that overshoots flat and folds back reads as jitter.
const OPEN_SPRING = { type: "spring", duration: 0.5, bounce: 0 } as const;
const CLOSE_SPRING = { type: "spring", duration: 0.4, bounce: 0 } as const;
const RADIUS = 16;

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

/** How folded one panel is (0 flat, 90 edge-on) at overall progress p. */
function panelFold(index: number, count: number, p: number) {
  const span = 1 - (count - 1) * STAGGER;
  const local = Math.min(1, Math.max(0, (p - index * STAGGER) / span));
  return (1 - local) * 90;
}

/**
 * Angle of each panel relative to the one above it. The panels hang from
 * one another like a folded map: even panels tip back by their fold, odd
 * ones forward, so together they zig-zag flat.
 */
function panelAngles(count: number, p: number) {
  const angles: number[] = [];
  let previous = 0;
  for (let i = 0; i < count; i++) {
    const net = (i % 2 === 0 ? -1 : 1) * panelFold(i, count, p);
    angles.push(net - previous);
    previous = net;
  }
  return angles;
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
  // Inline styles come from the first render only. After that the DOM is
  // driven directly, and a re-render must not snap it back to an end state
  // in the middle of an animation.
  const [initialOpen] = useState(open);

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
  // The state this component last animated to, so a parent's change can be
  // told apart from our own.
  const requested = useRef(open);

  const count = panels.length;
  const fullHeight = count * panelHeight;

  // Each frame writes only the panels' transforms and shading. The body's
  // height changes once per toggle, not per frame: it opens to full size
  // as the paper starts to unfold and closes after it has folded, so the
  // page around it lays out twice instead of on every frame.
  const apply = (p: number) => {
    const angles = panelAngles(count, p);
    for (let i = 0; i < count; i++) {
      const panel = panelRefs.current[i];
      if (panel) {
        panel.style.transform = `rotateX(${round(angles[i])}deg)`;
      }
      const shade = shadeRefs.current[i];
      if (shade) {
        // Panels tipped towards the light stay pale; the ones facing down
        // fall into shadow.
        const strength = i % 2 === 0 ? 0.06 : 0.22;
        const fold = (panelFold(i, count, p) * Math.PI) / 180;
        shade.style.opacity = String(round(strength * Math.sin(fold)));
      }
    }
  };
  useMotionValueEvent(progress, "change", apply);

  const setLaidOut = (expanded: boolean) => {
    if (bodyRef.current) {
      bodyRef.current.style.height = `${expanded ? fullHeight : 0}px`;
    }
    if (headerRef.current) {
      const radius = `${expanded ? 0 : RADIUS}px`;
      headerRef.current.style.borderBottomLeftRadius = radius;
      headerRef.current.style.borderBottomRightRadius = radius;
    }
  };

  // Follow the controlled value when the parent changes it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: setLaidOut only writes to refs.
  useEffect(() => {
    if (drag.current || open === requested.current) {
      return;
    }
    requested.current = open;
    const target = open ? 1 : 0;
    if (Math.abs(progress.get() - target) > 0.2) {
      animation.current?.stop();
      progress.jump(target);
      setLaidOut(open);
    }
  }, [open, progress]);

  useEffect(() => () => animation.current?.stop(), []);

  const settle = (next: boolean, velocity = 0) => {
    animation.current?.stop();
    requested.current = next;
    if (next) {
      setLaidOut(true);
    }
    if (reduceMotion) {
      progress.jump(next ? 1 : 0);
      setLaidOut(next);
    } else {
      const controls = animate(progress, next ? 1 : 0, {
        ...(next ? OPEN_SPRING : CLOSE_SPRING),
        velocity,
        onComplete: () => {
          if (!next && animation.current === controls) {
            setLaidOut(false);
          }
        },
      });
      animation.current = controls;
    }
    if (next !== open) {
      if (openProp === undefined) {
        setInternal(next);
      }
      onOpenChange?.(next);
    }
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
      setLaidOut(true);
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
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className="relative z-10 overflow-hidden rounded-t-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        ref={headerRef}
        style={{
          borderBottomLeftRadius: initialOpen ? 0 : RADIUS,
          borderBottomRightRadius: initialOpen ? 0 : RADIUS,
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
          height: initialOpen ? fullHeight : 0,
          perspective: 900,
          perspectiveOrigin: "50% 0%",
        }}
      >
        <Panel
          height={panelHeight}
          index={0}
          initialAngle={panelAngles(count, initialOpen ? 1 : 0)}
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
  initialAngle,
  last,
  panelRefs,
  shadeRefs,
}: {
  panels: ReactNode[];
  index: number;
  height: number;
  initialAngle: number[];
  last: boolean;
  panelRefs: { current: (HTMLDivElement | null)[] };
  shadeRefs: { current: (HTMLDivElement | null)[] };
}) {
  return (
    <div
      className="absolute inset-x-0 origin-top will-change-transform"
      ref={(node) => {
        panelRefs.current[index] = node;
      }}
      style={{
        height,
        top: index === 0 ? 0 : "100%",
        transform: `rotateX(${round(initialAngle[index])}deg)`,
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
          initialAngle={initialAngle}
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
