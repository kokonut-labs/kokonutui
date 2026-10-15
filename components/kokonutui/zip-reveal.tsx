"use client";

/**
 * @author: @dorianbaffier
 * @description: Zip Reveal
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, Copy, EyeOff } from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// Drawn in px: the SVG is as wide as the field, 1 unit to 1 px.
const HEIGHT = 56;
const MID = HEIGHT / 2;
// Teeth: one every PITCH px on each side, the two rows offset by half.
const PITCH = 9;
const TOOTH_W = 5;
// Each tooth sits across its tape edge: TOOTH_IN on the tape, TOOTH_OUT past it.
const TOOTH_IN = 4;
const TOOTH_OUT = 5;
// Where the slider rests, and how far short of the end it stops (px).
const START = 22;
const END_PAD = 22;
// How the opening flares behind the slider: it reaches ~63% of its widest
// FLARE px back, so it starts narrow, like a real one, then opens wide.
const FLARE = 64;
const MAX_GAP = MID - 2;
// Released past this share of the way, or flicked forward, it opens.
const OPEN_AT = 0.9;
const FLICK = 0.6;
const FLICK_MIN = 0.3;
// Critically damped follow for the slider and the halves.
const STIFFNESS = 240;
const SAMPLE = 6;
// The grab area around the slider, mostly over its tab.
const GRIP = { w: 60, h: 44, left: 16 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const DAMPING = 2 * Math.sqrt(STIFFNESS);

interface Springs {
  phase: "idle" | "drag" | "move";
  x: number;
  speed: number;
  target: number;
  spread: number;
  spreadSpeed: number;
  spreadTarget: number;
  tab: number;
  tabSpeed: number;
  tabTarget: number;
  after: "none" | "spread";
  closing: boolean;
}

// Moves the slider, the halves and the pull tab one step along.
function stepSprings(s: Springs, dt: number) {
  if (s.phase === "move") {
    s.speed += (-(s.x - s.target) * STIFFNESS - s.speed * DAMPING) * dt;
    s.x += s.speed * dt;
    if (Math.abs(s.x - s.target) < 0.3 && Math.abs(s.speed) < 4) {
      s.x = s.target;
      s.speed = 0;
      s.phase = "idle";
      if (s.after === "spread") {
        s.spreadTarget = 1;
      }
      s.after = "none";
    }
  }
  s.spreadSpeed +=
    (-(s.spread - s.spreadTarget) * STIFFNESS * 1.4 -
      s.spreadSpeed * DAMPING * 1.2) *
    dt;
  s.spread += s.spreadSpeed * dt;
  // Closing: once the halves are back, zip them up from the end.
  if (s.closing && s.spread < 0.04) {
    s.closing = false;
    s.phase = "move";
    s.target = START;
  }
  if (s.phase !== "drag") {
    s.tabTarget = 0;
  }
  s.tabSpeed += (-(s.tab - s.tabTarget) * 320 - s.tabSpeed * 11) * dt;
  s.tab += s.tabSpeed * dt;
}

export interface ZipRevealProps {
  /** The text behind the zip, an API key, a password, a recovery code. */
  secret?: string;
  label?: string;
  /** Called with the secret when the copy button is pressed. */
  onCopy?: (secret: string) => void;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export default function ZipReveal({
  secret = "kk_live_9f2a7c41e8b3d6a05c7e",
  label = "API key",
  onCopy,
  onOpenChange,
  className,
}: ZipRevealProps) {
  const [width, setWidth] = useState(384);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<SVGPathElement>(null);
  const bottomRef = useRef<SVGPathElement>(null);
  const stitchTopRef = useRef<SVGPathElement>(null);
  const stitchBottomRef = useRef<SVGPathElement>(null);
  const teethRef = useRef<SVGPathElement>(null);
  const sliderRef = useRef<SVGGElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef<SVGGElement>(null);
  const copiedTimer = useRef(0);

  const sim = useRef({
    phase: "idle" as "idle" | "drag" | "move",
    x: START,
    speed: 0,
    target: START,
    // 0: the halves follow the zip. 1: pulled right back out of the way.
    spread: 0,
    spreadSpeed: 0,
    spreadTarget: 0,
    tab: 0,
    tabSpeed: 0,
    tabTarget: 0,
    grab: 0,
    grabY: 0,
    pointerId: -1,
    lastX: 0,
    lastT: 0,
    velocity: 0,
    raf: 0,
    last: 0,
    // What to do once the slider arrives.
    after: "none" as "none" | "spread",
    // Waiting for the halves to come back before zipping up.
    closing: false,
    reduceMotion: false,
    width: 384,
  });
  const callbacks = useRef({ onOpenChange });
  callbacks.current = { onOpenChange };

  const draw = useCallback(() => {
    const s = sim.current;
    const w = s.width;
    const sx = s.x;
    // Half the gap between the two edges of tape at x.
    const gapAt = (x: number) => {
      const behind = sx - x;
      // At rest the slider sits a little in from the end; that stub stays shut.
      const ease = Math.min(1, Math.max(0, (sx - START) / 30));
      const zip =
        behind <= 0
          ? 0
          : MAX_GAP * ease * (1 - Math.exp(-((behind / FLARE) ** 1.5)));
      return lerp(zip, MID + 14, s.spread);
    };
    const edgeTop = (x: number) => MID - gapAt(x);
    const edgeBottom = (x: number) => MID + gapAt(x);

    // Fabric: one shape per half, its inner edge sampled across the field.
    let top = `M${w} 0L0 0`;
    let bottom = `M${w} ${HEIGHT}L0 ${HEIGHT}`;
    let stitchTop = "";
    let stitchBottom = "";
    for (let x = 0; x <= w + SAMPLE; x += SAMPLE) {
      const cx = Math.min(x, w);
      const t = edgeTop(cx);
      const b = edgeBottom(cx);
      top += `L${cx} ${t.toFixed(2)}`;
      bottom += `L${cx} ${b.toFixed(2)}`;
      stitchTop += `${x ? "L" : "M"}${cx} ${(t - 9).toFixed(2)}`;
      stitchBottom += `${x ? "L" : "M"}${cx} ${(b + 9).toFixed(2)}`;
    }
    topRef.current?.setAttribute("d", `${top}Z`);
    bottomRef.current?.setAttribute("d", `${bottom}Z`);
    stitchTopRef.current?.setAttribute("d", stitchTop);
    stitchBottomRef.current?.setAttribute("d", stitchBottom);

    // Teeth hang off each edge and tilt with it. Closed, the two rows
    // overlap and interleave, which is what reads as locked.
    let teeth = "";
    const tooth = (x: number, edge: (x: number) => number, dir: 1 | -1) => {
      const y = edge(x);
      const slope = (edge(x + 1) - edge(x - 1)) / 2;
      const len = Math.hypot(1, slope);
      const ux = 1 / len;
      const uy = slope / len;
      // Corners: along the edge ±TOOTH_W/2, across from -TOOTH_IN to TOOTH_OUT.
      const hw = TOOTH_W / 2;
      const nx = -uy * dir;
      const ny = ux * dir;
      const pts = [
        [x - ux * hw - nx * TOOTH_IN, y - uy * hw - ny * TOOTH_IN],
        [x + ux * hw - nx * TOOTH_IN, y + uy * hw - ny * TOOTH_IN],
        [x + ux * hw + nx * TOOTH_OUT, y + uy * hw + ny * TOOTH_OUT],
        [x - ux * hw + nx * TOOTH_OUT, y - uy * hw + ny * TOOTH_OUT],
      ];
      teeth += `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L")}Z`;
    };
    for (let x = 6; x < w - 4; x += PITCH) {
      tooth(x, edgeTop, 1);
      tooth(x + PITCH / 2, edgeBottom, -1);
    }
    teethRef.current?.setAttribute("d", teeth);

    sliderRef.current?.setAttribute(
      "transform",
      `translate(${sx.toFixed(2)} ${MID})`
    );
    tabRef.current?.setAttribute("transform", `rotate(${s.tab.toFixed(2)})`);
    // The slider leaves with the halves when they pull away.
    if (sliderRef.current) {
      sliderRef.current.style.opacity = (1 - s.spread * 1.6).toFixed(2);
    }
    if (handleRef.current) {
      handleRef.current.style.transform = `translate(${(sx - GRIP.left).toFixed(1)}px, ${MID - GRIP.h / 2}px)`;
    }
  }, []);

  const finish = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    callbacks.current.onOpenChange?.(nextOpen);
  }, []);

  const tick = useCallback(
    (now: number) => {
      const s = sim.current;
      s.raf = 0;
      const dt = s.last ? Math.min((now - s.last) / 1000, 0.032) : 1 / 60;
      s.last = now;
      stepSprings(s, dt);

      draw();
      const spreadDone =
        Math.abs(s.spread - s.spreadTarget) < 0.002 &&
        Math.abs(s.spreadSpeed) < 0.01;
      if (spreadDone && s.spread !== s.spreadTarget) {
        s.spread = s.spreadTarget;
        draw();
        if (s.spreadTarget === 1) {
          finish(true);
        }
      }
      const resting =
        s.phase !== "move" &&
        !s.closing &&
        spreadDone &&
        Math.abs(s.tab - s.tabTarget) < 0.05 &&
        Math.abs(s.tabSpeed) < 0.5;
      if (resting) {
        s.last = 0;
        return;
      }
      s.raf = requestAnimationFrame(tick);
    },
    [draw, finish]
  );

  const run = useCallback(() => {
    const s = sim.current;
    if (!s.raf) {
      s.last = 0;
      s.raf = requestAnimationFrame(tick);
    }
  }, [tick]);

  const endX = () => sim.current.width - END_PAD;

  // Runs the slider to the end, then pulls the halves out of the way.
  const unzip = useCallback(() => {
    const s = sim.current;
    if (s.reduceMotion) {
      s.x = s.width - END_PAD;
      s.spread = 1;
      s.spreadTarget = 1;
      draw();
      finish(true);
      return;
    }
    s.phase = "move";
    s.target = s.width - END_PAD;
    s.after = "spread";
    run();
  }, [draw, finish, run]);

  // Brings the halves back, then zips them shut from the end.
  const zip = useCallback(() => {
    const s = sim.current;
    if (s.reduceMotion) {
      s.x = START;
      s.spread = 0;
      s.spreadTarget = 0;
      draw();
      finish(false);
      return;
    }
    s.spreadTarget = 0;
    s.closing = true;
    finish(false);
    run();
  }, [draw, finish, run]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) {
      return;
    }
    const measure = () => {
      const s = sim.current;
      const next = el.clientWidth;
      const ratio = (s.x - START) / Math.max(1, s.width - END_PAD - START);
      s.width = next;
      s.x = START + ratio * (next - END_PAD - START);
      s.target = s.phase === "move" ? s.target : s.x;
      setWidth(next);
      draw();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [draw]);

  useEffect(() => {
    const s = sim.current;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    s.reduceMotion = query.matches;
    const onMotion = () => {
      s.reduceMotion = query.matches;
    };
    query.addEventListener("change", onMotion);
    return () => {
      query.removeEventListener("change", onMotion);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      window.clearTimeout(copiedTimer.current);
    };
  }, []);

  const local = (event: PointerEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (s.pointerId !== -1 || open) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = local(event);
    s.pointerId = event.pointerId;
    s.phase = "drag";
    s.after = "none";
    s.closing = false;
    s.spreadTarget = 0;
    s.speed = 0;
    s.grab = p.x - s.x;
    s.grabY = p.y;
    s.lastX = s.x;
    s.lastT = event.timeStamp;
    s.velocity = 0;
    run();
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (event.pointerId !== s.pointerId) {
      return;
    }
    const p = local(event);
    const end = endX();
    let x = p.x - s.grab;
    // Past either end it gives a little, then stops.
    if (x < START) {
      x = START - 10 * (1 - Math.exp(-(START - x) / 10));
    } else if (x > end) {
      x = end + 10 * (1 - Math.exp(-(x - end) / 10));
    }
    const dt = event.timeStamp - s.lastT;
    if (dt > 0) {
      s.velocity = lerp(s.velocity, (x - s.lastX) / dt, 0.4);
    }
    s.lastX = x;
    s.lastT = event.timeStamp;
    s.x = x;
    // The pull tab swings toward the finger.
    s.tabTarget = Math.max(
      -38,
      Math.min(38, (Math.atan2(p.y - s.grabY, 30) * 180) / Math.PI)
    );
    draw();
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (event.pointerId !== s.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    s.pointerId = -1;
    const progress = (s.x - START) / (endX() - START);
    // Flick speed in px/ms. Without a move in the last moment, it's still.
    const velocity = event.timeStamp - s.lastT > 80 ? 0 : s.velocity;
    if (progress > OPEN_AT || (velocity > FLICK && progress > FLICK_MIN)) {
      s.speed = Math.max(0, velocity * 1000);
      unzip();
      return;
    }
    // Let go early, and it zips itself back up: a peek, not a reveal.
    s.phase = "move";
    s.target = START;
    s.speed = Math.min(0, velocity * 1000);
    s.after = "none";
    if (s.reduceMotion) {
      s.x = START;
      s.phase = "idle";
      draw();
      return;
    }
    run();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      unzip();
    }
  };

  const handleCopy = async () => {
    onCopy?.(secret);
    try {
      await navigator.clipboard?.writeText(secret);
    } catch {
      // Clipboard can be blocked; onCopy still ran.
    }
    setCopied(true);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className={cn("w-full max-w-md", className)}>
      <p className="mb-2 font-medium text-sm text-zinc-900 dark:text-zinc-100">
        {label}
      </p>
      <div
        className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
        ref={wrapRef}
        style={{ height: HEIGHT }}
      >
        {/* What's behind the zip. Hidden from everyone until it's open. */}
        <div
          aria-hidden={!open}
          className={cn(
            "absolute inset-0 flex items-center gap-2 pr-2 pl-4",
            !open && "select-none"
          )}
        >
          <code className="min-w-0 flex-1 truncate font-mono text-sm text-zinc-900 dark:text-zinc-100">
            {secret}
          </code>
          {[
            {
              key: "copy",
              label: copied ? "Copied" : "Copy",
              onClick: handleCopy,
              icon: copied ? Check : Copy,
            },
            { key: "hide", label: "Hide", onClick: zip, icon: EyeOff },
          ].map((action) => (
            <button
              aria-label={action.label}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 outline-none transition-[opacity,filter,background-color,color] duration-200 ease-out hover:bg-zinc-200/60 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 active:bg-zinc-200 dark:text-zinc-400 dark:active:bg-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                open
                  ? "opacity-100 blur-0"
                  : "pointer-events-none opacity-0 blur-[2px]"
              )}
              key={action.key}
              onClick={action.onClick}
              tabIndex={open ? 0 : -1}
              type="button"
            >
              <action.icon className="size-4" />
            </button>
          ))}
        </div>

        {/* The handle: a grab area around the slider and its tab. */}
        <div
          aria-label={`Unzip to reveal ${label}`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={0}
          aria-valuetext="Closed"
          className={cn(
            "peer/zip absolute top-0 left-0 cursor-grab rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:cursor-grabbing",
            open && "pointer-events-none"
          )}
          onKeyDown={handleKeyDown}
          onLostPointerCapture={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          ref={handleRef}
          role="slider"
          style={{ width: GRIP.w, height: GRIP.h, touchAction: "none" }}
          tabIndex={open ? -1 : 0}
        />

        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 peer-hover/zip:[&_.zip-tab]:fill-white"
          height={HEIGHT}
          width={width}
        >
          <path className="fill-zinc-900 dark:fill-zinc-800" ref={topRef} />
          <path className="fill-zinc-900 dark:fill-zinc-800" ref={bottomRef} />
          <path
            className="fill-none stroke-white/15"
            ref={stitchTopRef}
            strokeDasharray="3 3"
            strokeWidth={1}
          />
          <path
            className="fill-none stroke-white/15"
            ref={stitchBottomRef}
            strokeDasharray="3 3"
            strokeWidth={1}
          />
          <path className="fill-zinc-400 dark:fill-zinc-400" ref={teethRef} />

          {/* The slider and its pull tab. */}
          <g ref={sliderRef}>
            {/* The body: wide where the teeth come apart, narrow where they lock. */}
            <path
              className="fill-zinc-300 stroke-zinc-400"
              d="M-10 -10C-10 -12 -8 -12 -7 -12L5 -8C6 -7.6 7 -7 7 -6L7 6C7 7 6 7.6 5 8L-7 12C-8 12 -10 12 -10 10Z"
              strokeWidth={1}
            />
            <g ref={tabRef}>
              <rect
                className="zip-tab fill-zinc-200 stroke-zinc-400 transition-[fill] duration-150 ease-out dark:fill-zinc-300"
                height={12}
                rx={4}
                strokeWidth={1}
                width={30}
                x={2}
                y={-6}
              />
              <rect
                className="fill-zinc-400"
                height={4}
                rx={2}
                width={10}
                x={18}
                y={-2}
              />
            </g>
            <circle className="fill-zinc-400" cx={0} cy={0} r={2} />
          </g>
        </svg>
      </div>
    </div>
  );
}
