"use client";

/**
 * @author: @dorianbaffier
 * @description: Attract Button
 * @version: 2.0.0
 * @date: 2026-10-16
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Magnet } from "lucide-react";
import {
  type ComponentProps,
  type FocusEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
} from "react";
import { cn } from "@/lib/utils";

interface AttractButtonProps extends ComponentProps<"button"> {
  /** Filing density. 1 places a filing roughly every 12px; 2 doubles it. */
  density?: number;
  /** How far, in px, the field of filings extends past the button's edges. */
  radius?: number;
  /** Classes for the wrapper that holds the button and its field. */
  containerClassName?: string;
}

interface Filing {
  x: number;
  y: number;
  /** Rest direction in doubled-angle space (filings have no head or tail). */
  restX: number;
  restY: number;
  /** Unit vector from the filing toward the button's center. */
  inX: number;
  inY: number;
  /** 0 at the button's edge, 1 at the field's outer edge. */
  t: number;
  fade: number;
  len: number;
  theta: number;
  omega: number;
  near: number;
}

interface Controls {
  setFocus: (on: boolean) => void;
  touchStart: (event: PointerEvent) => void;
}

const BASE_SPACING = 12;
const FILING_LENGTH = 7;
const LINE_WIDTH = 1.25;
const CLEARANCE = 6;
// Rotational spring: slightly under-damped so filings settle with a small,
// physical overshoot rather than snapping.
const STIFFNESS = 240;
const DAMPING = 21;
const PRESENCE_TAU = 0.07;
const PULL_TAU = 0.09;
const REST_ALPHA = 0.3;
const HALF_PI = Math.PI / 2;

const hash = (x: number, y: number, seed: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43_758.5453;
  return s - Math.floor(s);
};

const smoothstep = (a: number, b: number, v: number) => {
  const k = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** Shortest difference between two undirected angles, in (-π/2, π/2]. */
const lineDelta = (target: number, current: number) => {
  const d = (target - current + HALF_PI) % Math.PI;
  return (d < 0 ? d + Math.PI : d) - HALF_PI;
};

export default function AttractButton({
  className,
  containerClassName,
  children,
  density = 1,
  radius = 64,
  disabled,
  onPointerDown,
  onFocus,
  onBlur,
  ...props
}: AttractButtonProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<Controls | null>(null);
  const disabledRef = useRef(Boolean(disabled));
  disabledRef.current = Boolean(disabled);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!(wrapper && canvas && ctx)) {
      return;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const spacing = BASE_SPACING / Math.max(0.25, density);

    let filings: Filing[] = [];
    let width = 0;
    let height = 0;
    let box = { left: 0, top: 0, right: 0, bottom: 0, cx: 0, cy: 0 };
    let ink = "currentColor";
    let raf = 0;
    let last = 0;
    let visible = true;
    let reduced = motionQuery.matches;

    const pointer = { x: 0, y: 0 };
    let presence = 0;
    let presenceTarget = 0;
    let pull = 0;
    let pullTarget = 0;
    let focused = false;
    let touchId: number | null = null;

    const readInk = () => {
      ink = getComputedStyle(canvas).color;
    };

    const layout = () => {
      const bw = wrapper.offsetWidth;
      const bh = wrapper.offsetHeight;
      width = bw + radius * 2;
      height = bh + radius * 2;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      box = {
        left: radius,
        top: radius,
        right: radius + bw,
        bottom: radius + bh,
        cx: radius + bw / 2,
        cy: radius + bh / 2,
      };

      // A bar magnet laid along the button: north pole right, south pole left.
      const poleOffset = Math.max(bw / 2 - bh / 3, bw / 4);
      const nx = box.cx + poleOffset;
      const sx = box.cx - poleOffset;

      filings = [];
      const cols = Math.ceil(width / spacing);
      const rows = Math.ceil(height / spacing);
      for (let row = 0; row <= rows; row++) {
        for (let col = 0; col <= cols; col++) {
          const x = col * spacing + (hash(col, row, 1) - 0.5) * spacing * 0.45;
          const y = row * spacing + (hash(col, row, 2) - 0.5) * spacing * 0.45;
          const dx = Math.max(box.left - x, 0, x - box.right);
          const dy = Math.max(box.top - y, 0, y - box.bottom);
          const edge = Math.hypot(dx, dy);
          const t = edge / radius;
          if (edge < CLEARANCE || t > 1) {
            continue;
          }

          const ndx = x - nx;
          const ndy = y - box.cy;
          const sdx = x - sx;
          const sdy = y - box.cy;
          const nd3 = Math.max(Math.hypot(ndx, ndy) ** 3, 1);
          const sd3 = Math.max(Math.hypot(sdx, sdy) ** 3, 1);
          const bx = ndx / nd3 - sdx / sd3;
          const by = ndy / nd3 - sdy / sd3;
          const rest = Math.atan2(by, bx);

          const cdx = box.cx - x;
          const cdy = box.cy - y;
          const cd = Math.hypot(cdx, cdy) || 1;

          filings.push({
            x,
            y,
            restX: Math.cos(rest * 2),
            restY: Math.sin(rest * 2),
            inX: cdx / cd,
            inY: cdy / cd,
            t,
            fade: 1 - smoothstep(0.4, 1, t),
            len: FILING_LENGTH * (0.8 + hash(col, row, 3) * 0.4),
            theta: rest,
            omega: 0,
            near: 0,
          });
        }
      }
    };

    const targetAngle = (f: Filing) => {
      let vx = f.restX;
      let vy = f.restY;
      f.near = 0;

      if (pull > 0.001) {
        const w = pull * 0.6 * (1 - f.t * 0.4);
        const a = Math.atan2(f.inY, f.inX) * 2;
        vx = vx * (1 - w) + Math.cos(a) * w;
        vy = vy * (1 - w) + Math.sin(a) * w;
      }

      if (presence > 0.001) {
        const dx = pointer.x - f.x;
        const dy = pointer.y - f.y;
        const sigma = radius * 0.75;
        const w = presence * 0.92 * Math.exp(-(dx * dx + dy * dy) / sigma ** 2);
        f.near = w;
        if (w > 0.001) {
          const a = Math.atan2(dy, dx) * 2;
          vx = vx * (1 - w) + Math.cos(a) * w;
          vy = vy * (1 - w) + Math.sin(a) * w;
        }
      }

      return Math.atan2(vy, vx) / 2;
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = ink;
      ctx.lineWidth = LINE_WIDTH;
      ctx.lineCap = "round";
      for (const f of filings) {
        const alpha = f.fade * (REST_ALPHA + f.near * 0.4 + pull * 0.2);
        if (alpha < 0.01) {
          continue;
        }
        const shift = pull * 2.5 * (1 - f.t);
        const x = f.x + f.inX * shift;
        const y = f.y + f.inY * shift;
        const hx = (Math.cos(f.theta) * f.len) / 2;
        const hy = (Math.sin(f.theta) * f.len) / 2;
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.beginPath();
        ctx.moveTo(x - hx, y - hy);
        ctx.lineTo(x + hx, y + hy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const ease = (value: number, target: number, dt: number, tau: number) => {
      const next = value + (target - value) * (1 - Math.exp(-dt / tau));
      return Math.abs(target - next) < 0.001 ? target : next;
    };

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      presence = ease(presence, presenceTarget, dt, PRESENCE_TAU);
      pull = ease(pull, pullTarget, dt, PULL_TAU);
      let active = presence !== presenceTarget || pull !== pullTarget;

      for (const f of filings) {
        const diff = lineDelta(targetAngle(f), f.theta);
        f.omega += (STIFFNESS * diff - DAMPING * f.omega) * dt;
        f.theta += f.omega * dt;
        if (Math.abs(diff) > 0.002 || Math.abs(f.omega) > 0.02) {
          active = true;
        }
      }

      draw();
      raf = active ? requestAnimationFrame(step) : 0;
    };

    const kick = () => {
      if (reduced || !visible || raf) {
        return;
      }
      last = performance.now();
      raf = requestAnimationFrame(step);
    };

    const settleNow = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      presence = 0;
      presenceTarget = 0;
      pullTarget = focused && !disabledRef.current ? 1 : 0;
      pull = pullTarget;
      for (const f of filings) {
        f.theta = Math.atan2(f.restY, f.restX) / 2;
        f.omega = 0;
        f.near = 0;
      }
      draw();
    };

    const track = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const inField = x >= 0 && y >= 0 && x <= width && y <= height;
      const inButton =
        x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
      if (inField) {
        pointer.x = x;
        pointer.y = y;
      }
      const nextPresence = inField ? 1 : 0;
      const nextPull = (inButton || focused) && !disabledRef.current ? 1 : 0;
      if (
        inField ||
        nextPresence !== presenceTarget ||
        nextPull !== pullTarget
      ) {
        presenceTarget = nextPresence;
        pullTarget = nextPull;
        kick();
      }
    };

    const release = () => {
      presenceTarget = 0;
      pullTarget = focused && !disabledRef.current ? 1 : 0;
      kick();
    };

    const handleMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        if (event.pointerId === touchId) {
          track(event.clientX, event.clientY);
        }
        return;
      }
      track(event.clientX, event.clientY);
    };

    const handleUp = (event: PointerEvent) => {
      if (event.pointerId === touchId) {
        touchId = null;
        release();
      }
    };

    const handleOut = (event: PointerEvent) => {
      if (!event.relatedTarget && event.pointerType !== "touch") {
        release();
      }
    };

    let listening = false;
    const listen = (on: boolean) => {
      if (on === listening) {
        return;
      }
      listening = on;
      if (on) {
        window.addEventListener("pointermove", handleMove, { passive: true });
        window.addEventListener("pointerup", handleUp);
        window.addEventListener("pointercancel", handleUp);
        document.addEventListener("pointerout", handleOut);
        window.addEventListener("blur", release);
        return;
      }
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      document.removeEventListener("pointerout", handleOut);
      window.removeEventListener("blur", release);
    };

    controlsRef.current = {
      setFocus: (on) => {
        focused = on;
        if (on && presenceTarget === 0) {
          pointer.x = box.cx;
          pointer.y = box.cy;
        }
        pullTarget = on && !disabledRef.current ? 1 : 0;
        kick();
      },
      touchStart: (event) => {
        if (reduced) {
          return;
        }
        touchId = event.pointerId;
        track(event.clientX, event.clientY);
      },
    };

    const redraw = () => {
      readInk();
      draw();
    };

    const resizeObserver = new ResizeObserver(() => {
      layout();
      readInk();
      if (reduced) {
        draw();
      } else {
        settleNow();
      }
    });
    resizeObserver.observe(wrapper);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      listen(visible && !reduced);
      if (!visible) {
        settleNow();
      }
    });
    intersectionObserver.observe(canvas);

    const handleMotionChange = () => {
      reduced = motionQuery.matches;
      listen(visible && !reduced);
      settleNow();
    };
    motionQuery.addEventListener("change", handleMotionChange);

    // Repaint in the new ink when the theme changes, even while settled.
    darkQuery.addEventListener("change", redraw);
    const themeObserver = new MutationObserver(redraw);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });

    return () => {
      cancelAnimationFrame(raf);
      listen(false);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      motionQuery.removeEventListener("change", handleMotionChange);
      darkQuery.removeEventListener("change", redraw);
      controlsRef.current = null;
    };
  }, [density, radius]);

  // Touch and pen-on-screen run the field only while pressed.
  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    onPointerDown?.(event);
    if (event.pointerType === "touch") {
      controlsRef.current?.touchStart(event.nativeEvent);
    }
  };

  // Keyboard focus pulls the field in too; mouse focus does not hold it.
  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    onFocus?.(event);
    if (event.currentTarget.matches(":focus-visible")) {
      controlsRef.current?.setFocus(true);
    }
  };

  const handleBlur = (event: FocusEvent<HTMLButtonElement>) => {
    onBlur?.(event);
    controlsRef.current?.setFocus(false);
  };

  return (
    <div
      className={cn("relative inline-flex", containerClassName)}
      ref={wrapperRef}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{ inset: -radius }}
      >
        <canvas
          className="block size-full text-zinc-900 dark:text-zinc-400"
          ref={canvasRef}
        />
      </span>
      <button
        type="button"
        {...props}
        className={cn(
          "relative inline-flex h-10 min-w-36 cursor-pointer select-none items-center justify-center gap-2 rounded-md px-4",
          "font-medium text-sm",
          "bg-zinc-900 text-zinc-50 hover:bg-zinc-800 active:bg-zinc-700",
          "dark:bg-zinc-100 dark:text-zinc-900 dark:active:bg-zinc-300 dark:hover:bg-white",
          "transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
          "outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-950",
          "disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        disabled={disabled}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onPointerDown={handlePointerDown}
      >
        <Magnet aria-hidden="true" className="size-4 shrink-0" />
        {children ?? "Get started"}
      </button>
    </div>
  );
}
