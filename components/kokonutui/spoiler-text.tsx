"use client";

/**
 * @author: @dorianbaffier
 * @description: Spoiler Text
 * @version: 1.0.0
 * @date: 2026-10-16
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface SpoilerProps {
  children: ReactNode;
  /** Controlled state. Leave it out and the spoiler keeps its own. */
  revealed?: boolean;
  defaultRevealed?: boolean;
  onRevealedChange?: (revealed: boolean) => void;
  /** What screen readers hear while the text is hidden. */
  label?: string;
  className?: string;
}

// Specks per square pixel of hidden text. About one every 6px², like the
// grain on a scratch card, so even one short word reads as a solid patch.
const DENSITY = 1 / 6;
const MAX_SPECKS = 2400;
// How far a speck wanders, in px per second, while it shimmers in place.
const DRIFT = 7;
// The reveal wave crosses the whole spoiler in this long, whatever its size.
const WAVE_MS = 520;
// Once the wave passes a speck it is thrown out and fades over this long.
const FADE_MS = 360;
const THROW = 70;

interface Speck {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Where in its twinkle the speck is, 0 to 1. */
  phase: number;
  /** Twinkles per second. */
  rate: number;
  size: number;
  /** The rectangle (one per line) the speck is kept inside. */
  box: number;
  /** When the reveal wave reached it, in ms; 0 while hidden. */
  hit: number;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** How far the wave has to travel from where it started to clear it all. */
function farthestCorner(at: { x: number; y: number }, w: number, h: number) {
  return Math.max(
    Math.hypot(at.x, at.y),
    Math.hypot(w - at.x, at.y),
    Math.hypot(at.x, h - at.y),
    Math.hypot(w - at.x, h - at.y)
  );
}

function union(rects: DOMRect[]): Box {
  return {
    left: Math.min(...rects.map((r) => r.left)),
    top: Math.min(...rects.map((r) => r.top)),
    right: Math.max(...rects.map((r) => r.right)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
  };
}

/**
 * Puts the canvas over the text and returns each line's box inside it.
 * An inline element split over lines has no single box to position a
 * canvas against, and browsers disagree on where its absolute children
 * go. So the canvas is parked at 0,0, measured, then moved by the
 * difference: it lands on the text's bounding box whatever the browser.
 */
function fitCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  text: HTMLElement
) {
  const lines = Array.from(text.getClientRects());
  if (lines.length === 0) {
    return null;
  }
  const bounds = union(lines);
  canvas.style.left = "0px";
  canvas.style.top = "0px";
  const origin = canvas.getBoundingClientRect();
  canvas.style.left = `${bounds.left - origin.left}px`;
  canvas.style.top = `${bounds.top - origin.top}px`;

  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const boxes: Box[] = lines.map((r) => ({
    left: r.left - bounds.left,
    top: r.top - bounds.top,
    right: r.right - bounds.left,
    bottom: r.bottom - bounds.top,
  }));
  return { width, height, boxes };
}

/** Draws every speck still showing; returns how many there were. */
function paint(ctx: CanvasRenderingContext2D, specks: Speck[], frame: Frame) {
  let alive = 0;
  for (const s of specks) {
    const alpha = step(s, frame);
    if (alpha > 0) {
      alive++;
      ctx.globalAlpha = alpha;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
  }
  ctx.globalAlpha = 1;
  return alive;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

function makeSpecks(boxes: Box[]): Speck[] {
  const specks: Speck[] = [];
  const area = boxes.reduce(
    (sum, box) => sum + (box.right - box.left) * (box.bottom - box.top),
    0
  );
  const scale = Math.min(1, MAX_SPECKS / Math.max(1, area * DENSITY));
  boxes.forEach((box, index) => {
    const width = box.right - box.left;
    const height = box.bottom - box.top;
    const count = Math.round(width * height * DENSITY * scale);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = DRIFT * (0.3 + Math.random() * 0.7);
      specks.push({
        x: box.left + Math.random() * width,
        y: box.top + Math.random() * height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        phase: Math.random(),
        rate: 0.35 + Math.random() * 0.9,
        size: Math.random() < 0.18 ? 1.5 : 1,
        box: index,
        hit: 0,
      });
    }
  });
  return specks;
}

interface Frame {
  now: number;
  dt: number;
  wave: { x: number; y: number } | null;
  radius: number;
  boxes: Box[];
  reduced: boolean;
}

/** Moves one speck a frame on; returns its opacity, 0 once it has faded. */
function step(s: Speck, { now, dt, wave, radius, boxes, reduced }: Frame) {
  if (wave && !s.hit && Math.hypot(s.x - wave.x, s.y - wave.y) <= radius) {
    s.hit = now;
    const dx = s.x - wave.x;
    const dy = s.y - wave.y;
    const length = Math.hypot(dx, dy) || 1;
    const push = THROW * (0.5 + Math.random());
    s.vx += (dx / length) * push;
    s.vy += (dy / length) * push;
  }
  const fade = s.hit ? 1 - (now - s.hit) / FADE_MS : 1;
  if (fade <= 0) {
    return 0;
  }
  if (!reduced || s.hit) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.phase = (s.phase + s.rate * dt) % 1;
  }
  // Until it's hit, a speck bounces around inside its own line.
  const box = s.hit ? undefined : boxes[s.box];
  if (box) {
    if (s.x < box.left || s.x > box.right) {
      s.vx = -s.vx;
      s.x = Math.min(box.right, Math.max(box.left, s.x));
    }
    if (s.y < box.top || s.y > box.bottom) {
      s.vy = -s.vy;
      s.y = Math.min(box.bottom, Math.max(box.top, s.y));
    }
  }
  // Each speck twinkles between faint and full, out of step with the
  // others, so the patch shimmers instead of flashing.
  const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(s.phase * Math.PI));
  return twinkle * fade * 0.9;
}

/**
 * Inline text hidden under a field of drifting specks, like a spoiler in a
 * chat app. Click it, or focus it and press Enter, and the specks are blown
 * away from the point you touched while the words come into focus.
 */
export function Spoiler({
  children,
  revealed: revealedProp,
  defaultRevealed = false,
  onRevealedChange,
  label = "Hidden text. Activate to reveal.",
  className,
}: SpoilerProps) {
  const [ownRevealed, setOwnRevealed] = useState(defaultRevealed);
  const revealed = revealedProp ?? ownRevealed;
  // The specks stay on screen while the wave clears them, after `revealed`.
  const [clearing, setClearing] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveRef = useRef<{ x: number; y: number; start: number } | null>(null);

  const reveal = useCallback(
    (clientX?: number, clientY?: number) => {
      if (revealed) {
        return;
      }
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      const first = textRef.current?.getClientRects()[0];
      if (rect) {
        // A keyboard reveal starts from the start of the first line.
        const x = clientX ?? (first ? first.left + 4 : rect.left);
        const y = clientY ?? (first ? first.top + first.height / 2 : rect.top);
        waveRef.current = {
          x: x - rect.left,
          y: y - rect.top,
          start: performance.now(),
        };
        setClearing(true);
      }
      setOwnRevealed(true);
      onRevealedChange?.(true);
    },
    [revealed, onRevealedChange]
  );

  // Hiding again (a controlled parent can) forgets any wave in progress.
  useEffect(() => {
    if (!revealed) {
      waveRef.current = null;
      setClearing(false);
    }
  }, [revealed]);

  const showSpecks = !revealed || clearing;

  useEffect(() => {
    if (!showSpecks) {
      return;
    }
    const root = rootRef.current;
    const text = textRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!(root && text && canvas && ctx)) {
      return;
    }

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    let boxes: Box[] = [];
    let specks: Speck[] = [];
    let width = 0;
    let height = 0;
    let color = "currentColor";
    let frame = 0;
    let last = 0;
    let visible = true;

    const layout = () => {
      const fitted = fitCanvas(canvas, ctx, text);
      if (!fitted) {
        return;
      }
      ({ width, height, boxes } = fitted);
      specks = makeSpecks(boxes);
      color = getComputedStyle(root).color;
    };

    const draw = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;

      const wave = waveRef.current;
      const radius = wave
        ? farthestCorner(wave, width, height) *
          easeOut(Math.min(1, (now - wave.start) / WAVE_MS))
        : -1;
      const alive = paint(ctx, specks, {
        now,
        dt,
        wave,
        radius,
        boxes,
        reduced,
      });

      if (wave && alive === 0) {
        waveRef.current = null;
        setClearing(false);
        return;
      }
      if ((!reduced || wave) && visible) {
        frame = requestAnimationFrame(draw);
      }
    };

    const restart = () => {
      cancelAnimationFrame(frame);
      last = 0;
      frame = requestAnimationFrame(draw);
    };

    layout();
    restart();

    // Text rewraps when its container changes width; lay the specks out again.
    const resize = new ResizeObserver(() => {
      if (!waveRef.current) {
        layout();
        restart();
      }
    });
    const block = root.parentElement ?? root;
    resize.observe(block);

    // Off screen, the shimmer stops.
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) {
        restart();
      } else {
        cancelAnimationFrame(frame);
      }
    });
    seen.observe(root);

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      seen.disconnect();
    };
  }, [showSpecks]);

  const onClick = (event: MouseEvent<HTMLSpanElement>) => {
    // A keyboard "click" has no position; start from the first line instead.
    if (event.detail === 0) {
      reveal();
    } else {
      reveal(event.clientX, event.clientY);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      reveal();
    }
  };

  const text = (
    <span
      aria-hidden={revealed ? undefined : true}
      className={cn(
        "transition-[opacity,filter] duration-[450ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity",
        revealed ? "opacity-100 blur-0" : "select-none opacity-0 blur-[6px]"
      )}
      ref={textRef}
    >
      {children}
    </span>
  );
  const specksLayer = showSpecks && (
    <canvas className="pointer-events-none absolute" ref={canvasRef} />
  );
  const shape =
    "relative rounded-[3px] [-webkit-box-decoration-break:clone] [box-decoration-break:clone]";

  if (revealed) {
    return (
      <span className={cn(shape, className)} ref={rootRef}>
        {text}
        {specksLayer}
      </span>
    );
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: a <button> can't wrap across lines like inline text
    <span
      aria-label={label}
      className={cn(
        shape,
        "cursor-pointer bg-zinc-900/[0.06] outline-none transition-colors duration-150 hover:bg-zinc-900/10 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-white/[0.08] dark:hover:bg-white/12",
        className
      )}
      onClick={onClick}
      onKeyDown={onKeyDown}
      ref={rootRef}
      role="button"
      tabIndex={0}
    >
      {text}
      {specksLayer}
    </span>
  );
}

interface Message {
  id: string;
  name: string;
  initial: string;
  time: string;
  body: ReactNode;
  own?: boolean;
}

/**
 * A group chat where two messages hide a spoiler. Click a hidden patch to
 * reveal it; "Hide again" puts the specks back.
 */
export default function SpoilerText({ className }: { className?: string }) {
  // Remounting the spoilers is the simplest way to hide them all again.
  const [round, setRound] = useState(0);
  const [shown, setShown] = useState(0);

  const onReveal = () => setShown((count) => count + 1);

  const messages: Message[] = [
    {
      id: "maya",
      name: "Maya",
      initial: "M",
      time: "21:04",
      body: "Finished the finale last night. I'm still not over it.",
    },
    {
      id: "jun",
      name: "Jun",
      initial: "J",
      time: "21:06",
      body: (
        <>
          Same. When it turned out{" "}
          <Spoiler key={`a${round}`} onRevealedChange={onReveal}>
            the lighthouse keeper had been writing the letters all along
          </Spoiler>{" "}
          I had to pause it for a minute.
        </>
      ),
    },
    {
      id: "you",
      name: "You",
      initial: "Y",
      time: "21:07",
      own: true,
      body: (
        <>
          Don't. I'm two episodes behind and I know someone{" "}
          <Spoiler key={`b${round}`} onRevealedChange={onReveal}>
            doesn't make it off the island
          </Spoiler>{" "}
          already.
        </>
      ),
    },
  ];

  return (
    <div
      className={cn(
        "w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
          # the-finale
        </p>
        <button
          className={cn(
            "rounded-md px-2 py-1 text-xs text-zinc-500 transition-[color,background-color,opacity] duration-150 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
            shown === 0 && "pointer-events-none opacity-0"
          )}
          onClick={() => {
            setRound((r) => r + 1);
            setShown(0);
          }}
          tabIndex={shown === 0 ? -1 : undefined}
          type="button"
        >
          Hide again
        </button>
      </div>
      <ul className="flex flex-col gap-3">
        {messages.map((message) => (
          <li className="flex gap-2.5" key={message.id}>
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full font-medium text-xs",
                message.own
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              )}
            >
              {message.initial}
            </span>
            <div className="min-w-0">
              <p className="flex items-baseline gap-2">
                <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                  {message.name}
                </span>
                <span className="text-xs text-zinc-400 tabular-nums dark:text-zinc-500">
                  {message.time}
                </span>
              </p>
              <p className="text-[15px] text-zinc-700 leading-6 dark:text-zinc-300">
                {message.body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
