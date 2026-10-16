"use client";

/**
 * @author: @dorianbaffier
 * @description: Switch Button
 * @version: 2.0.0
 * @date: 2026-10-16
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Works on its own: it toggles the `dark` class on <html>. If a theme provider
 * owns the theme (next-themes or your own), pass `theme` and `onThemeChange`.
 *
 * The new theme spreads from the button as a circle (View Transitions API).
 * Without that API, or with reduced motion, the theme switches instantly.
 */

import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

interface SwitchButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "default" | "lg";
  showLabel?: boolean;
  /**
   * The applied theme, when a theme provider owns it (for next-themes, its
   * `resolvedTheme`). Pair it with `onThemeChange`. Without it the button
   * toggles the `dark` class on <html> itself.
   */
  theme?: Theme;
  /** Called with the theme to switch to. */
  onThemeChange?: (theme: Theme) => void;
  /** Spread the new theme from the button as a circle. */
  reveal?: boolean;
}

const SIZES = {
  sm: { button: "h-8 gap-1.5 px-2.5 text-[13px]", square: "w-8", icon: 14 },
  default: { button: "h-9 gap-2 px-3 text-sm", square: "w-9", icon: 16 },
  lg: { button: "h-10 gap-2 px-3.5 text-[15px]", square: "w-10", icon: 18 },
};

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const EASE_IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";
const EASE_REVEAL = "cubic-bezier(0.4, 0, 0.2, 1)";
const REVEAL_ATTR = "data-theme-reveal";
const REVEAL_STYLE_ID = "kokonut-theme-reveal";
const REVEAL_CSS = `html[${REVEAL_ATTR}]::view-transition-old(root),html[${REVEAL_ATTR}]::view-transition-new(root){animation:none;mix-blend-mode:normal}`;

const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const RAYS = RAY_ANGLES.map((deg) => {
  const rad = (deg * Math.PI) / 180;
  const at = (r: number) => ({
    x: Number((12 + r * Math.cos(rad)).toFixed(2)),
    y: Number((12 + r * Math.sin(rad)).toFixed(2)),
  });
  return { deg, from: at(7.5), to: at(10) };
});

// Each part's light look is its base class and its dark look a `dark:` class,
// so the server render (theme unknown) matches the client. Clicking animates
// from the old computed values to the new ones with WAAPI, which keeps
// working when a provider disables CSS transitions while it swaps themes.
const ANIMATED_PROPS = ["opacity", "scale", "translate", "filter"] as const;

type Snapshot = Map<Element, Keyframe>;

function snapshot(elements: Element[]): Snapshot {
  const map: Snapshot = new Map();
  for (const el of elements) {
    const style = getComputedStyle(el);
    const frame: Keyframe = { offset: 0 };
    for (const prop of ANIMATED_PROPS) {
      frame[prop] = style.getPropertyValue(prop);
    }
    map.set(el, frame);
    for (const animation of el.getAnimations()) {
      animation.cancel();
    }
  }
  return map;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ensureRevealStyle() {
  if (document.getElementById(REVEAL_STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = REVEAL_STYLE_ID;
  style.textContent = REVEAL_CSS;
  document.head.appendChild(style);
}

function timing(el: Element, toDark: boolean): KeyframeAnimationOptions {
  const { part, index = "0" } = (el as HTMLElement | SVGElement).dataset;
  const i = Number(index);
  switch (part) {
    case "ray":
      // Rays retract one after another; on the way back they wait for the
      // bite to clear first.
      return {
        delay: toDark ? i * 18 : 140 + i * 22,
        duration: 260,
        easing: EASE_OUT,
      };
    case "bite":
      return { delay: toDark ? 60 : 0, duration: 380, easing: EASE_IN_OUT };
    case "disc":
      return { delay: toDark ? 40 : 0, duration: 380, easing: EASE_OUT };
    default:
      return { duration: 240, easing: EASE_OUT };
  }
}

function morph(from: Snapshot, toDark: boolean) {
  if (prefersReducedMotion()) {
    return;
  }
  for (const [el, frame] of from) {
    el.animate([frame, {}], { ...timing(el, toDark), fill: "backwards" });
  }
}

let revealRunning = false;

function revealFrom(button: HTMLElement, apply: () => void) {
  const doc = document as Document & { activeViewTransition?: unknown };
  if (
    typeof doc.startViewTransition !== "function" ||
    prefersReducedMotion() ||
    revealRunning ||
    doc.activeViewTransition
  ) {
    apply();
    return;
  }

  const rect = button.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );
  const root = document.documentElement;

  ensureRevealStyle();
  root.setAttribute(REVEAL_ATTR, "");
  revealRunning = true;

  let transition: ViewTransition;
  try {
    transition = doc.startViewTransition(() => flushSync(apply));
  } catch {
    root.removeAttribute(REVEAL_ATTR);
    revealRunning = false;
    apply();
    return;
  }

  transition.ready
    .then(() => {
      root.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 500,
          easing: EASE_REVEAL,
          pseudoElement: "::view-transition-new(root)",
        }
      );
    })
    .catch(() => {
      // Skipped or aborted (e.g. a page navigation started a transition).
    });

  transition.finished
    .catch(() => {
      // The theme is already applied by the time a transition can fail.
    })
    .finally(() => {
      root.removeAttribute(REVEAL_ATTR);
      revealRunning = false;
    });
}

export default function SwitchButton({
  className,
  size = "default",
  showLabel = true,
  theme,
  onThemeChange,
  reveal = true,
  onClick,
  ...props
}: SwitchButtonProps) {
  const maskId = `${useId()}-moon`;
  const iconRef = useRef<SVGSVGElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [observed, setObserved] = useState<Theme | null>(null);

  // Only for aria-pressed: read the applied theme after mount, so the first
  // client render matches the server.
  useEffect(() => {
    const root = document.documentElement;
    const read = () =>
      setObserved(root.classList.contains("dark") ? "dark" : "light");
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const current = observed && (theme ?? observed);
  const sizing = SIZES[size];

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) {
      return;
    }
    const root = document.documentElement;
    const from = theme ?? (root.classList.contains("dark") ? "dark" : "light");
    const next: Theme = from === "dark" ? "light" : "dark";
    const button = e.currentTarget;

    const apply = () => {
      const parts = [
        ...(iconRef.current?.querySelectorAll("[data-part]") ?? []),
        ...(labelRef.current?.querySelectorAll("[data-part]") ?? []),
      ];
      const before = snapshot(parts);
      // With a provider the class is also set here, because next-themes
      // applies it in an effect: the reveal's snapshot needs it now. The
      // provider then sets the same value.
      root.classList.toggle("dark", next === "dark");
      root.style.colorScheme = next;
      onThemeChange?.(next);
      morph(before, next === "dark");
    };

    if (reveal) {
      revealFrom(button, apply);
    } else {
      apply();
    }
  };

  return (
    <button
      aria-label="Dark theme"
      aria-pressed={current ? current === "dark" : undefined}
      className={cn(
        "group/switch relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center rounded-lg font-medium",
        "border border-zinc-200 bg-white text-zinc-900 shadow-xs",
        "dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
        "hover:border-zinc-300 hover:bg-zinc-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/70",
        "active:bg-zinc-100 dark:active:bg-zinc-800",
        "transition-[background-color,border-color] duration-150 ease-out",
        "outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-950",
        "disabled:pointer-events-none disabled:opacity-50",
        sizing.button,
        !showLabel && cn(sizing.square, "px-0"),
        className
      )}
      type="button"
      {...props}
      onClick={handleClick}
    >
      <svg
        aria-hidden="true"
        className="pointer-events-none shrink-0 overflow-visible"
        fill="none"
        height={sizing.icon}
        ref={iconRef}
        viewBox="0 0 24 24"
        width={sizing.icon}
      >
        <mask id={maskId}>
          <rect fill="white" height="32" width="32" x="-4" y="-4" />
          <circle
            className="translate-x-[10px] -translate-y-[10px] dark:translate-x-0 dark:translate-y-0"
            cx="17"
            cy="7"
            data-part="bite"
            fill="black"
            r="7.5"
          />
        </mask>
        <g mask={`url(#${maskId})`}>
          <circle
            className="origin-[12px_12px] [transform-box:view-box] dark:scale-[1.8]"
            cx="12"
            cy="12"
            data-part="disc"
            fill="currentColor"
            r="4.75"
          />
        </g>
        <g stroke="currentColor" strokeLinecap="round" strokeWidth="2">
          {RAYS.map((ray, index) => (
            <line
              className="origin-[12px_12px] [transform-box:view-box] dark:scale-50 dark:opacity-0"
              data-index={index}
              data-part="ray"
              key={ray.deg}
              x1={ray.from.x}
              x2={ray.to.x}
              y1={ray.from.y}
              y2={ray.to.y}
            />
          ))}
        </g>
      </svg>
      {showLabel && (
        <span aria-hidden="true" className="grid leading-none" ref={labelRef}>
          <span
            className="col-start-1 row-start-1 dark:opacity-0 dark:blur-[3px]"
            data-part="label"
          >
            Light
          </span>
          <span
            className="col-start-1 row-start-1 opacity-0 blur-[3px] dark:opacity-100 dark:blur-none"
            data-part="label"
          >
            Dark
          </span>
        </span>
      )}
    </button>
  );
}
