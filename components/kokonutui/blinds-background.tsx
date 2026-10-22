"use client";

/**
 * @author: @dorianbaffier
 * @description: Blinds Background
 * @version: 1.0.0
 * @date: 2026-10-22
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface BlindsBackgroundProps {
  className?: string;
  /** Content shown over the blinds. Pass `null` for a bare background. */
  children?: ReactNode;
  /** What's outside the window. */
  src?: string;
  /** Height of one slat, in px. */
  slat?: number;
  /** Tilt the slats near the cursor, and open them all on click. */
  interactive?: boolean;
}

/** How far a slat turns at most, in degrees. */
const OPEN = 78;
/** At rest the slats sit a little open, so the view shows in thin bands. */
const AJAR = 36;
/** Slats behind the copy only turn this far, so it stays readable. */
const BEHIND_COPY = 16;
/** Reach of the hand above and below, in px. */
const REACH = 150;
/** Spring per frame: pull toward the target, and the drag on it. */
const PULL = 0.07;
const DRAG = 0.24;
/** The pull cord opens slats top to bottom, this far apart in ms. */
const CORD_STAGGER = 22;
const REST = 0.05;

const DEFAULT_SRC =
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=2000&q=80&auto=format&fit=crop";

const smooth = (t: number) => t * t * (3 - 2 * t);

interface SlatState {
  i: number;
  now: number;
  slat: number;
  time: number;
  hand: { y: number; on: boolean; idle: number };
  cord: { open: boolean; at: number };
  copy: { top: number; bottom: number };
}

/** How far a slat wants to be open right now, in degrees. */
function slatTarget({ i, now, slat, time, hand, cord, copy }: SlatState) {
  const mid = (i + 0.5) * slat;
  let open = AJAR;
  if (cord.open) {
    open = now - cord.at > i * CORD_STAGGER ? OPEN : AJAR;
  } else if (hand.on) {
    const d = Math.abs(mid - hand.y) / REACH;
    open = d < 1 ? AJAR + (OPEN - AJAR) * smooth(1 - d) : AJAR;
  } else if (hand.idle > 2.5) {
    // Nobody here: a slow swell of light runs down the window.
    const wave = Math.sin(time * 0.6 - i * 0.28);
    open = AJAR + OPEN * 0.4 * Math.max(0, wave) ** 6;
  }
  const behind = mid > copy.top && mid < copy.bottom;
  return behind ? Math.min(open, BEHIND_COPY) : open;
}

/**
 * A window with venetian blinds for a hero. The slats tilt open around the
 * cursor and swing back on a spring, letting light and the view through in
 * a band that follows you. Click to pull the cord and open them all, top to
 * bottom; the slats behind the copy only ever open a little.
 */
export default function BlindsBackground({
  className,
  children,
  src = DEFAULT_SRC,
  slat = 30,
  interactive = true,
}: BlindsBackgroundProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const slatRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shadeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const measure = () =>
      setCount(Math.ceil(root.getBoundingClientRect().height / slat) + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [slat]);

  useEffect(() => {
    const root = rootRef.current;
    if (!(root && count)) {
      return;
    }
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const angle = new Float32Array(count);
    const speed = new Float32Array(count);
    const hand = { y: 0, on: false, idle: 10 };
    const cord = { open: false, at: 0 };
    let copy = { top: 0, bottom: 0 };
    let raf = 0;
    let running = false;
    let visible = true;
    let time = 0;

    const measureCopy = () => {
      const box = copyRef.current?.getBoundingClientRect();
      const rect = root.getBoundingClientRect();
      copy = box
        ? { top: box.top - rect.top - 12, bottom: box.bottom - rect.top + 12 }
        : { top: 0, bottom: 0 };
    };

    const targetFor = (i: number, now: number) =>
      slatTarget({ i, now, slat, time, hand, cord, copy });

    const apply = (i: number) => {
      const a = angle[i];
      const el = slatRefs.current[i];
      if (el) {
        el.style.transform = `rotateX(${-a}deg)`;
      }
      const shade = shadeRefs.current[i];
      if (shade) {
        // Tipped toward the sky the slat catches light; the turn itself
        // shows as a darker band toward its lower edge.
        shade.style.opacity = String(Math.min(1, a / OPEN));
      }
    };

    const frame = (now: number) => {
      raf = 0;
      time += 1 / 60;
      hand.idle += 1 / 60;
      let moving = false;
      for (let i = 0; i < count; i++) {
        const target = targetFor(i, now);
        speed[i] = speed[i] * (1 - DRAG) + (target - angle[i]) * PULL;
        angle[i] += speed[i];
        if (Math.abs(speed[i]) > REST || Math.abs(target - angle[i]) > REST) {
          moving = true;
        }
        apply(i);
      }
      if (visible && (moving || hand.idle > 2.5)) {
        raf = requestAnimationFrame(frame);
      } else {
        running = false;
      }
    };

    const start = () => {
      if (!(running || reduceMotion) && visible) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };

    measureCopy();
    if (reduceMotion) {
      // A still window, half open.
      for (let i = 0; i < count; i++) {
        hand.on = false;
        const mid = (i + 0.5) * slat;
        angle[i] = mid > copy.top && mid < copy.bottom ? BEHIND_COPY : 46;
        apply(i);
      }
    }
    start();

    const resize = new ResizeObserver(measureCopy);
    resize.observe(root);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      start();
    });
    intersection.observe(root);
    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onMove = (event: PointerEvent) => {
      hand.y = event.clientY - root.getBoundingClientRect().top;
      hand.on = true;
      hand.idle = 0;
      start();
    };
    const onLeave = () => {
      hand.on = false;
      hand.idle = 0;
      start();
    };
    const onClick = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest("a, button, input, textarea")) {
        return;
      }
      cord.open = !cord.open;
      cord.at = performance.now();
      hand.idle = 0;
      start();
    };
    if (interactive && !reduceMotion) {
      root.addEventListener("pointermove", onMove);
      root.addEventListener("pointerleave", onLeave);
      root.addEventListener("click", onClick);
    }

    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("click", onClick);
    };
  }, [count, slat, interactive]);

  const slats: number[] = [];
  for (let i = 0; i < count; i++) {
    slats.push(i);
  }

  return (
    <div
      className={cn(
        "relative flex min-h-[560px] w-full items-center justify-center overflow-hidden bg-zinc-300 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100",
        interactive && "cursor-pointer",
        className
      )}
      ref={rootRef}
    >
      {/* The view outside. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-center bg-cover dark:brightness-75"
        style={{ backgroundImage: `url("${src}")` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [perspective:1400px]"
      >
        {slats.map((i) => (
          <div
            className="backface-hidden absolute inset-x-0 overflow-hidden border-zinc-300/80 border-b bg-zinc-100 shadow-[inset_0_1px_0_rgb(255_255_255/0.9)] will-change-transform dark:border-black/60 dark:bg-zinc-900 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
            key={i}
            ref={(el) => {
              slatRefs.current[i] = el;
            }}
            style={{
              top: i * slat,
              // A touch taller than the pitch, so closed slats overlap.
              height: slat + 2,
            }}
          >
            <div
              className="absolute inset-0 bg-gradient-to-b from-white/70 to-zinc-400/50 opacity-0 dark:from-zinc-700/60 dark:to-black/70"
              ref={(el) => {
                shadeRefs.current[i] = el;
              }}
            />
          </div>
        ))}
      </div>
      <div className="pointer-events-none relative" ref={copyRef}>
        {children === undefined ? <DefaultContent /> : children}
      </div>
    </div>
  );
}

function DefaultContent() {
  return (
    <div className="flex max-w-xl flex-col items-center gap-4 px-6 text-center">
      <h1 className="font-semibold text-4xl tracking-tight sm:text-5xl">
        Let the light in
      </h1>
      <p className="max-w-sm text-base text-zinc-600 dark:text-zinc-400">
        Venetian blinds that tilt open around your cursor. Click anywhere to
        pull the cord.
      </p>
    </div>
  );
}
