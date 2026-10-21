"use client";

/**
 * @author: @dorianbaffier
 * @description: Reflow Text
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import Image from "next/image";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface ReflowTextProps {
  /** The paragraph that wraps around the object. Plain text. */
  text?: string;
  /** What the text wraps around. Drawn inside a circle of `radius`. */
  object?: ReactNode;
  /** Label for the object, for screen readers and keyboard users. */
  objectLabel?: string;
  /** Radius of the object in px. */
  radius?: number;
  /** Space kept clear between the object and the text, in px. */
  gap?: number;
  className?: string;
}

const DEFAULT_TEXT =
  "Nobody plans a trip on paper anymore, and yet the paper map keeps coming back. Shops that sold them by the dozen now sell them by the hundred, folded to the size of a passport and printed on stone paper that survives the rain. People say they like seeing the whole valley at once instead of a blue dot in a small square. They like that it never needs charging, that it shows the trail you did not take, and that the fold lines become a record of where you have been. A phone tells you where to turn. A map tells you where you are, and lets you decide the rest yourself, one ridge at a time.";

// Word springs: stiff enough to keep up with a drag, damped so they glide.
const STIFFNESS = 260;
const DAMPING = 30;
// The thrown object: friction per second and the share of speed kept off a
// wall.
const FRICTION = 2.4;
const BOUNCE = 0.55;
// Segments of a line narrower than this are left empty rather than holding
// one squeezed word.
const MIN_SEGMENT = 84;
// A row is spread to fill its stretch only if that adds less than this
// share of the stretch as extra space; otherwise it stays ragged.
const JUSTIFY_LIMIT = 0.3;
const KEY_STEP = 24;
const WHITESPACE = /\s+/;
const REST = 0.05;

interface Obstacle {
  x: number;
  y: number;
  r: number;
}

/** The open stretches of one line, after cutting out the object's chord. */
function segments(
  top: number,
  lineHeight: number,
  width: number,
  o: Obstacle
): [number, number][] {
  const bottom = top + lineHeight;
  let dy = 0;
  if (o.y < top) {
    dy = top - o.y;
  } else if (o.y > bottom) {
    dy = o.y - bottom;
  }
  if (dy >= o.r) {
    return [[0, width]];
  }
  const half = Math.sqrt(o.r * o.r - dy * dy);
  const out: [number, number][] = [];
  if (o.x - half > MIN_SEGMENT) {
    out.push([0, o.x - half]);
  }
  if (width - (o.x + half) > MIN_SEGMENT) {
    out.push([o.x + half, width]);
  }
  return out;
}

/**
 * Justifies full rows, so the text traces the object's outline the way a
 * set page does. The paragraph's last row stays ragged.
 */
function placeRow(
  row: number[],
  widths: number[],
  space: number,
  start: number,
  end: number,
  x: number,
  more: boolean,
  top: number,
  at: [number, number][]
) {
  const slack = end - start - (x - space - start);
  const justify =
    row.length > 1 && more && slack < (end - start) * JUSTIFY_LIMIT;
  const extra = justify ? slack / (row.length - 1) : 0;
  let left = start;
  for (const index of row) {
    at.push([left, top]);
    left += widths[index] + space + extra;
  }
}

/**
 * Greedy line breaking into whatever each line leaves open: the left
 * stretch fills first, then the right. Returns each word's top-left corner.
 */
function layout(
  widths: number[],
  space: number,
  width: number,
  lineHeight: number,
  o: Obstacle
) {
  const at: [number, number][] = [];
  let i = 0;
  let top = 0;
  while (i < widths.length) {
    const open = segments(top, lineHeight, width, o);
    for (const [start, end] of open) {
      const row: number[] = [];
      let x = start;
      while (i < widths.length) {
        const w = widths[i];
        // A word longer than the whole column still has to go somewhere.
        const forced = x === 0 && end === width && w > width;
        if (x + w > end + 0.5 && !forced) {
          break;
        }
        row.push(i);
        x += w + space;
        i++;
      }
      placeRow(row, widths, space, start, end, x, i < widths.length, top, at);
    }
    top += lineHeight;
    // Never loop forever on a column too narrow for anything.
    if (top > lineHeight * (widths.length + 40)) {
      break;
    }
  }
  return { at, height: top };
}

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface Word {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
}

/**
 * The thrown object coasts, slows and bounces off the block's sides.
 * Returns whether it moved.
 */
function coast(o: Body, dt: number, width: number, height: number) {
  if (Math.abs(o.vx) <= REST && Math.abs(o.vy) <= REST) {
    return false;
  }
  o.x += o.vx * dt;
  o.y += o.vy * dt;
  const k = Math.exp(-FRICTION * dt);
  o.vx *= k;
  o.vy *= k;
  if (o.x < o.r || o.x > width - o.r) {
    o.x = Math.min(Math.max(o.r, o.x), width - o.r);
    o.vx = -o.vx * BOUNCE;
  }
  if (o.y < o.r || o.y > height - o.r) {
    o.y = Math.min(Math.max(o.r, o.y), Math.max(o.r, height - o.r));
    o.vy = -o.vy * BOUNCE;
  }
  if (Math.hypot(o.vx, o.vy) < 8) {
    o.vx = 0;
    o.vy = 0;
  }
  return true;
}

/** One spring step toward the word's place. Returns whether it is moving. */
function stepWord(w: Word, dt: number, reduced: boolean) {
  if (!reduced) {
    w.vx += (STIFFNESS * (w.tx - w.x) - DAMPING * w.vx) * dt;
    w.vy += (STIFFNESS * (w.ty - w.y) - DAMPING * w.vy) * dt;
    w.x += w.vx * dt;
    w.y += w.vy * dt;
    const far = Math.abs(w.tx - w.x) > REST || Math.abs(w.ty - w.y) > REST;
    if (far || Math.abs(w.vx) > REST || Math.abs(w.vy) > REST) {
      return true;
    }
  }
  w.x = w.tx;
  w.y = w.ty;
  w.vx = 0;
  w.vy = 0;
  return false;
}

export default function ReflowText({
  text = DEFAULT_TEXT,
  object,
  objectLabel = "Photo of a lake below mountains",
  radius = 68,
  gap = 14,
  className,
}: ReflowTextProps) {
  const words = useMemo(() => text.split(WHITESPACE).filter(Boolean), [text]);
  const boxRef = useRef<HTMLDivElement>(null);
  const objectRef = useRef<HTMLButtonElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  // Words sit in normal flow until measured, so the server render reads as a
  // plain paragraph; then they lift off and spring into the wrapped layout.
  const [ready, setReady] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const sim = useRef({
    width: 0,
    lineHeight: 28,
    space: 4,
    widths: [] as number[],
    words: [] as {
      x: number;
      y: number;
      vx: number;
      vy: number;
      tx: number;
      ty: number;
    }[],
    o: { x: 0, y: 0, vx: 0, vy: 0, r: 0 },
    height: 0,
    drag: null as null | {
      id: number;
      dx: number;
      dy: number;
      lastX: number;
      lastY: number;
      lastT: number;
    },
    raf: 0,
    last: 0,
    reduced: false,
    kick: (() => undefined) as () => void,
  });

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) {
      return;
    }
    const s = sim.current;
    s.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const relayout = () => {
      const { at, height: h } = layout(
        s.widths,
        s.space,
        s.width,
        s.lineHeight,
        { x: s.o.x, y: s.o.y, r: s.o.r + gap }
      );
      at.forEach(([x, y], i) => {
        const w = s.words[i];
        if (w) {
          w.tx = x;
          w.ty = y;
        }
      });
      // The block is as tall as the text, or the object, whichever needs more.
      const next = Math.max(h, s.o.y + s.o.r + 4);
      if (Math.abs(next - s.height) > 0.5) {
        s.height = next;
        setHeight(next);
      }
    };

    const paint = () => {
      s.words.forEach((w, i) => {
        const el = wordRefs.current[i];
        if (el) {
          el.style.transform = `translate3d(${w.x.toFixed(2)}px, ${w.y.toFixed(2)}px, 0)`;
        }
      });
      const obj = objectRef.current;
      if (obj) {
        obj.style.transform = `translate3d(${(s.o.x - s.o.r).toFixed(2)}px, ${(s.o.y - s.o.r).toFixed(2)}px, 0)`;
      }
    };

    const frame = (now: number) => {
      s.raf = 0;
      const dt = Math.min(0.032, s.last ? (now - s.last) / 1000 : 1 / 60);
      s.last = now;
      let moving = false;

      if (!s.drag && coast(s.o, dt, s.width, s.height)) {
        relayout();
        moving = true;
      }
      for (const w of s.words) {
        moving = stepWord(w, dt, s.reduced) || moving;
      }
      paint();
      if (moving || s.drag) {
        s.raf = requestAnimationFrame(frame);
      }
    };

    s.kick = () => {
      relayout();
      if (!s.raf) {
        s.last = 0;
        s.raf = requestAnimationFrame(frame);
      }
    };

    const measure = (first: boolean) => {
      const style = getComputedStyle(box);
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) {
        return;
      }
      ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      s.widths = words.map((w) => ctx.measureText(w).width);
      s.space = ctx.measureText(" ").width;
      s.lineHeight =
        Number.parseFloat(style.lineHeight) ||
        Number.parseFloat(style.fontSize) * 1.6;
      const prevWidth = s.width;
      s.width = box.clientWidth;
      const r = Math.min(radius, s.width / 4);
      if (first) {
        // Start where each word sits in the plain paragraph.
        const origin = box.getBoundingClientRect();
        s.words = words.map((_, i) => {
          const rect = wordRefs.current[i]?.getBoundingClientRect();
          const x = rect ? rect.left - origin.left : 0;
          const y = rect ? rect.top - origin.top : 0;
          return { x, y, vx: 0, vy: 0, tx: x, ty: y };
        });
        s.o = {
          x: s.width * 0.66,
          y: s.lineHeight * 2.5 + r,
          vx: 0,
          vy: 0,
          r,
        };
        s.height = box.clientHeight;
      } else {
        s.o.r = r;
        s.o.x = Math.min(
          Math.max(r, prevWidth ? (s.o.x / prevWidth) * s.width : s.o.x),
          s.width - r
        );
      }
    };

    measure(true);
    setReady(true);
    s.kick();
    paint();

    const observer = new ResizeObserver(() => {
      if (Math.abs(box.clientWidth - s.width) > 0.5) {
        measure(false);
        s.kick();
      }
    });
    observer.observe(box);
    document.fonts?.ready.then(() => {
      measure(false);
      s.kick();
    });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [words, radius, gap]);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    const s = sim.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    s.o.vx = 0;
    s.o.vy = 0;
    s.drag = {
      id: event.pointerId,
      dx: event.clientX - box.left - s.o.x,
      dy: event.clientY - box.top - s.o.y,
      lastX: event.clientX,
      lastY: event.clientY,
      lastT: event.timeStamp,
    };
    setDragging(true);
    s.kick();
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const s = sim.current;
    const d = s.drag;
    const box = boxRef.current?.getBoundingClientRect();
    if (!(d && box) || d.id !== event.pointerId) {
      return;
    }
    const x = event.clientX - box.left - d.dx;
    const y = event.clientY - box.top - d.dy;
    const dt = Math.max(1, event.timeStamp - d.lastT) / 1000;
    // Remember how fast it was moving, for the throw.
    s.o.vx = 0.7 * ((event.clientX - d.lastX) / dt) + 0.3 * s.o.vx;
    s.o.vy = 0.7 * ((event.clientY - d.lastY) / dt) + 0.3 * s.o.vy;
    d.lastX = event.clientX;
    d.lastY = event.clientY;
    d.lastT = event.timeStamp;
    s.o.x = Math.min(Math.max(s.o.r, x), s.width - s.o.r);
    s.o.y = Math.min(Math.max(s.o.r, y), Math.max(s.o.r, s.height - s.o.r));
    s.kick();
  };

  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const s = sim.current;
    if (!s.drag || s.drag.id !== event.pointerId) {
      return;
    }
    // A pause before letting go means a drop, not a throw.
    if (event.timeStamp - s.drag.lastT > 80) {
      s.o.vx = 0;
      s.o.vy = 0;
    }
    s.drag = null;
    setDragging(false);
    s.kick();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[event.key];
    if (!step) {
      return;
    }
    event.preventDefault();
    const s = sim.current;
    s.o.x = Math.min(
      Math.max(s.o.r, s.o.x + step[0] * KEY_STEP),
      s.width - s.o.r
    );
    s.o.y = Math.min(
      Math.max(s.o.r, s.o.y + step[1] * KEY_STEP),
      Math.max(s.o.r, s.height - s.o.r)
    );
    s.kick();
  };

  const size = sim.current.o.r * 2 || radius * 2;

  return (
    <div className={cn("w-full max-w-2xl px-2 py-4", className)}>
      <p className="mb-2 font-medium text-[13px] text-zinc-500 dark:text-zinc-400">
        Field notes
      </p>
      <h2 className="mb-6 text-balance font-semibold text-3xl text-zinc-900 tracking-tight dark:text-zinc-100">
        The quiet return of the paper map
      </h2>
      <p className="sr-only">{text}</p>
      <div
        className="relative text-[17px] text-zinc-700 leading-7 dark:text-zinc-300"
        ref={boxRef}
        style={ready && height !== null ? { height } : undefined}
      >
        <div aria-hidden="true" className={cn(ready && "absolute inset-0")}>
          {words.map((word, i) => (
            <span
              className={cn(
                ready
                  ? "absolute top-0 left-0 whitespace-nowrap will-change-transform"
                  : "inline"
              )}
              // biome-ignore lint/suspicious/noArrayIndexKey: words repeat; their order is their identity
              key={i}
              ref={(el) => {
                wordRefs.current[i] = el;
              }}
            >
              {word}
              {ready ? null : " "}
            </span>
          ))}
        </div>
        <button
          aria-label={`${objectLabel}. Drag, throw or use the arrow keys to move it; the text wraps around it.`}
          className={cn(
            "absolute top-0 left-0 touch-none select-none overflow-hidden rounded-full outline-none ring-1 ring-black/10 transition-[box-shadow,opacity] duration-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:ring-white/10",
            dragging
              ? "cursor-grabbing shadow-[0_18px_40px_-12px_rgba(0,0,0,0.35)]"
              : "cursor-grab shadow-[0_6px_16px_-8px_rgba(0,0,0,0.3)]",
            ready ? "opacity-100" : "opacity-0"
          )}
          onKeyDown={onKeyDown}
          onPointerCancel={onPointerUp}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          ref={objectRef}
          style={{ width: size, height: size }}
          type="button"
        >
          {object ?? (
            <Image
              alt=""
              className="pointer-events-none size-full object-cover"
              draggable={false}
              height={320}
              src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=320&h=320&fit=crop&auto=format&q=80"
              unoptimized
              width={320}
            />
          )}
        </button>
      </div>
    </div>
  );
}
