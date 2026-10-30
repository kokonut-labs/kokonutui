"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { type PointerEvent, useEffect, useRef } from "react";
import { useHalloween } from "@/lib/halloween";

/**
 * The web fills the cell's top-right corner, where two hairlines meet. It's
 * drawn at this size and shown at half of it on phones.
 */
const WEB = 132;
/**
 * How far below the web it hangs at rest. On phones the headline fills the
 * cell, so it drops past the words into the gap above the copy.
 */
const REST = { narrow: 96, wide: 104 };
const MAX_PULL = 260;
const MAX_SWAY = 40;

/**
 * A spider on a single thread, hanging from a web drawn into the corner of
 * the cover. It lowers itself in once the page lands, dips when you scroll,
 * backs up its thread when the pointer comes close, and can be pulled down
 * and let go.
 */
export function Spider() {
  const on = useHalloween("spider");
  return on ? <SpiderOnWeb /> : null;
}

function SpiderOnWeb() {
  const reduce = useReducedMotion();
  const rest = useRef(REST.wide);
  const dragging = useRef(false);
  const shy = useRef(0);
  const anchorRef = useRef<HTMLDivElement>(null);

  const length = useMotionValue(0);
  const drop = useSpring(
    length,
    reduce
      ? { stiffness: 300, damping: 40 }
      : { stiffness: 140, damping: 9, mass: 0.8 }
  );
  const angle = useMotionValue(0);
  const sway = useSpring(
    angle,
    reduce
      ? { stiffness: 300, damping: 40 }
      : { stiffness: 80, damping: 5, mass: 1 }
  );

  // Lower in once the cover has landed.
  useEffect(() => {
    rest.current = window.innerWidth < 640 ? REST.narrow : REST.wide;
    const id = window.setTimeout(() => length.set(rest.current), 700);
    return () => window.clearTimeout(id);
  }, [length]);

  // Scrolling shakes the thread: it pays out a little and reels back in.
  useEffect(() => {
    if (reduce) {
      return;
    }
    let last = window.scrollY;
    let settle = 0;
    const onScroll = () => {
      if (dragging.current) {
        return;
      }
      const dy = Math.abs(window.scrollY - last);
      last = window.scrollY;
      length.set(rest.current + Math.min(dy * 1.2, 64));
      window.clearTimeout(settle);
      settle = window.setTimeout(() => length.set(rest.current), 140);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(settle);
    };
  }, [length, reduce]);

  const pull = (event: PointerEvent) => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    if (!anchor) {
      return;
    }
    const dx = event.clientX - anchor.left;
    const dy = Math.max(event.clientY - anchor.top, 1);
    const reach = Math.min(Math.hypot(dx, dy), rest.current + MAX_PULL);
    const tilt = (Math.atan2(-dx, dy) * 180) / Math.PI;
    length.set(Math.max(reach - 12, 16));
    angle.set(Math.max(-MAX_SWAY, Math.min(MAX_SWAY, tilt)));
    // Follow the hand directly; the springs only take over on release.
    drop.jump(length.get());
    sway.jump(angle.get());
  };

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 right-0 z-10 select-none"
    >
      <Web />
      {/* Where the thread leaves the web. */}
      <div
        className="absolute top-5 right-5 sm:top-10 sm:right-10"
        ref={anchorRef}
      >
        <motion.div
          className="absolute top-0 left-0 origin-top"
          style={{ rotate: sway }}
        >
          <motion.div
            className="absolute top-0 left-0 w-px -translate-x-1/2 bg-black/35 dark:bg-white/40"
            style={{ height: drop }}
          />
          <motion.div
            className="pointer-events-auto absolute top-0 left-0 -mt-[7px] -ml-[17px] cursor-grab touch-none p-1 active:cursor-grabbing"
            onPointerCancel={() => {
              dragging.current = false;
              length.set(rest.current);
              angle.set(0);
            }}
            onPointerDown={(event) => {
              dragging.current = true;
              window.clearTimeout(shy.current);
              event.currentTarget.setPointerCapture(event.pointerId);
              pull(event);
            }}
            onPointerEnter={(event) => {
              // Shy: it backs up its thread when a mouse comes close, and
              // comes back down a moment later.
              if (event.pointerType !== "mouse" || dragging.current) {
                return;
              }
              length.set(rest.current - 40);
              window.clearTimeout(shy.current);
              shy.current = window.setTimeout(() => {
                if (!dragging.current) {
                  length.set(rest.current);
                }
              }, 1100);
            }}
            onPointerMove={(event) => {
              if (dragging.current) {
                pull(event);
              }
            }}
            onPointerUp={() => {
              dragging.current = false;
              length.set(rest.current);
              angle.set(0);
            }}
            style={{ y: drop }}
          >
            <SpiderGlyph />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

/** Radials from the corner and four sagging rings, drawn in hairline. */
function Web() {
  const radials = [0, 16, 32, 48, 64, 80, 90];
  const rings = [26, 50, 76, 102];
  const point = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180;
    return [WEB - r * Math.cos(rad), r * Math.sin(rad)] as const;
  };
  const ringPath = (r: number) =>
    radials
      .map((deg, i) => {
        const [x, y] = point(deg, r);
        if (i === 0) {
          return `M${x} ${y}`;
        }
        // Each span sags toward the corner, as silk does between spokes.
        const [cx, cy] = point((deg + radials[i - 1]) / 2, r * 0.86);
        return `Q${cx} ${cy} ${x} ${y}`;
      })
      .join(" ");
  return (
    <svg
      aria-hidden="true"
      className="absolute top-0 right-0 size-16 overflow-visible text-black/25 sm:size-[132px] dark:text-white/25"
      fill="none"
      viewBox={`0 0 ${WEB} ${WEB}`}
    >
      {radials.slice(1, -1).map((deg) => {
        const [x, y] = point(deg, WEB - 8);
        return (
          <line
            key={deg}
            stroke="currentColor"
            strokeWidth={0.75}
            vectorEffect="non-scaling-stroke"
            x1={WEB}
            x2={x}
            y1={0}
            y2={y}
          />
        );
      })}
      {rings.map((r) => (
        <path
          d={ringPath(r)}
          key={r}
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth={0.75}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

/** Seen from the side, hanging by its spinnerets: abdomen up, legs folded. */
function SpiderGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="block text-black dark:text-white"
      fill="none"
      height={26}
      viewBox="0 0 26 26"
      width={26}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.3}
      >
        <path d="M11 13.5 L6.5 9.5 L3.5 12.5" />
        <path d="M10.8 15 L5.5 13.5 L2.5 17.5" />
        <path d="M11 16.5 L6.5 18.5 L5 22.5" />
        <path d="M11.5 17.5 L9 21 L9.5 24.5" />
        <path d="M15 13.5 L19.5 9.5 L22.5 12.5" />
        <path d="M15.2 15 L20.5 13.5 L23.5 17.5" />
        <path d="M15 16.5 L19.5 18.5 L21 22.5" />
        <path d="M14.5 17.5 L17 21 L16.5 24.5" />
      </g>
      <ellipse cx={13} cy={8.6} fill="currentColor" rx={4.1} ry={5} />
      <circle cx={13} cy={15.6} fill="currentColor" r={2.7} />
    </svg>
  );
}
