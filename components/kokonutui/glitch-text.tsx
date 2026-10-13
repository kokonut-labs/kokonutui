"use client";

/**
 * @author: @dorianbaffier
 * @description: Glitch Text
 * @version: 2.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { motion, useInView, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

export type GlitchTextColor =
  | "rainbow"
  | "blue"
  | "purple"
  | "cyan"
  | "pink"
  | "orange"
  | "gradient-orange";

export type GlitchTextIntensity = "light" | "medium" | "heavy" | "extreme";

export type GlitchTextSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | number;

export interface GlitchTextProps {
  /** Text to render. Defaults to "Glitch Text". */
  text?: string;
  className?: string;
  /** How far and how often the glitch bursts fire. */
  glitchIntensity?: GlitchTextIntensity;
  color?: GlitchTextColor;
  /** Optional background color for the container. */
  backgroundColor?: string;
  /** Disable the glitch and render clean, static text. */
  isStatic?: boolean;
  size?: GlitchTextSize;
  fontWeight?: number;
  /** Letter spacing in px. */
  letterSpacing?: number;
}

/** One OKLCH color: lightness, chroma, hue (hue may be a CSS expression). */
type Oklch = readonly [l: number, c: number, h: number | string];

/** A layer is painted either with a flat color or a text-clipped gradient. */
type Paint =
  | { kind: "solid"; color: Oklch }
  | { kind: "gradient"; stops: readonly [Oklch, Oklch, Oklch] };

interface ColorScheme {
  primary: Paint;
  before: Paint;
  after: Paint;
}

const oklch = ([l, c, h]: Oklch, alpha?: number) =>
  alpha === undefined
    ? `oklch(${l} ${c} ${h})`
    : `oklch(${l} ${c} ${h} / ${alpha})`;

const solid = (l: number, c: number, h: number | string): Paint => ({
  kind: "solid",
  color: [l, c, h],
});

const gradient = (a: Oklch, b: Oklch, c: Oklch): Paint => ({
  kind: "gradient",
  stops: [a, b, c],
});

/** Animated on the text wrapper when `color="rainbow"` (and motion is allowed). */
const RAINBOW_HUE = "var(--rainbow-hue, 270)";
/** One full trip around the hue wheel, starting from the static 270. */
const RAINBOW_CYCLE = { "--rainbow-hue": [270, 630] };
const RAINBOW_TRANSITION = {
  duration: 6,
  ease: "linear",
  repeat: Number.POSITIVE_INFINITY,
} as const;

const COLOR_SCHEMES: Record<GlitchTextColor, ColorScheme> = {
  rainbow: {
    primary: solid(0.85, 0.2, RAINBOW_HUE),
    before: solid(0.9, 0.15, `calc(${RAINBOW_HUE} + 60)`),
    after: solid(0.8, 0.25, `calc(${RAINBOW_HUE} - 60)`),
  },
  blue: {
    primary: solid(0.65, 0.2, 250),
    before: solid(0.75, 0.15, 255),
    after: solid(0.55, 0.25, 245),
  },
  purple: {
    primary: solid(0.6, 0.22, 290),
    before: solid(0.7, 0.18, 295),
    after: solid(0.5, 0.25, 285),
  },
  cyan: {
    primary: solid(0.8, 0.15, 200),
    before: solid(0.85, 0.12, 205),
    after: solid(0.7, 0.18, 195),
  },
  pink: {
    primary: solid(0.7, 0.25, 330),
    before: solid(0.8, 0.2, 335),
    after: solid(0.6, 0.28, 325),
  },
  orange: {
    primary: solid(0.7, 0.25, 45),
    before: solid(0.85, 0.2, 40),
    after: solid(0.6, 0.28, 50),
  },
  "gradient-orange": {
    primary: gradient([0.7, 0.25, 45], [0.75, 0.28, 30], [0.65, 0.3, 60]),
    before: gradient([0.85, 0.2, 40], [0.8, 0.22, 25], [0.75, 0.25, 55]),
    after: gradient([0.6, 0.28, 50], [0.55, 0.3, 35], [0.5, 0.32, 65]),
  },
};

/** Representative color of a paint, used for the glow. */
const baseColor = (paint: Paint): Oklch =>
  paint.kind === "solid" ? paint.color : paint.stops[1];

/**
 * Gradients go through background-clip:text with a transparent fill — CSS
 * `color` can't hold a gradient. The glow uses drop-shadow, since text-shadow
 * would paint over a clipped background.
 */
const paintStyle = (paint: Paint, glowBlur: number): CSSProperties => {
  const glow = `drop-shadow(0 0 ${glowBlur}px ${oklch(baseColor(paint), 0.35)})`;
  if (paint.kind === "solid") {
    return { color: oklch(paint.color), filter: glow };
  }
  const [a, b, c] = paint.stops;
  return {
    backgroundImage: `linear-gradient(135deg, ${oklch(a)} 0%, ${oklch(b)} 50%, ${oklch(c)} 100%)`,
    filter: glow,
  };
};

interface IntensitySettings {
  /** Max offset in px for the chromatic layers. */
  offset: number;
  /** Max skew in deg. */
  skew: number;
  /** Peak opacity of the chromatic layers during a burst. */
  opacity: number;
  /** Length of one glitch burst, in seconds. */
  burst: number;
  /** Calm time between bursts, in seconds. */
  rest: number;
}

const INTENSITY: Record<GlitchTextIntensity, IntensitySettings> = {
  light: { offset: 2, skew: 0.5, opacity: 0.7, burst: 0.3, rest: 3.2 },
  medium: { offset: 3, skew: 1, opacity: 0.8, burst: 0.36, rest: 2.2 },
  heavy: { offset: 5, skew: 2, opacity: 0.85, burst: 0.42, rest: 1.2 },
  extreme: { offset: 8, skew: 3, opacity: 0.9, burst: 0.48, rest: 0.5 },
};

const SIZE_CLASSES: Record<Exclude<GlitchTextSize, number>, string> = {
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-5xl",
  xl: "text-6xl",
  "2xl": "text-7xl",
  "3xl": "text-8xl",
};

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const BURST_TIMES = [0, 0.2, 0.4, 0.6, 0.8, 1];
const FIRST_BURST_DELAY = 0.6;
const REST = { x: 0, y: 0, skewX: 0, opacity: 0 };
const INSTANT = { duration: 0 };

/** Jitter pattern per layer (sign of x, y, skew at each keyframe). */
const PATTERNS = {
  before: [
    [1, -1, 1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, 1, -1],
  ],
  after: [
    [-1, 1, -1],
    [1, -1, 1],
    [1, 1, -1],
    [-1, -1, 1],
  ],
} as const;

type Pattern = (typeof PATTERNS)[keyof typeof PATTERNS];

const burstKeyframes = (pattern: Pattern, s: IntensitySettings) => ({
  x: [0, ...pattern.map(([x]) => x * s.offset), 0],
  y: [0, ...pattern.map(([, y]) => y * s.offset), 0],
  skewX: [0, ...pattern.map(([, , k]) => k * s.skew), 0],
  opacity: [0, s.opacity, s.opacity * 0.6, s.opacity, s.opacity * 0.6, 0],
});

const GlitchText = ({
  text = "Glitch Text",
  className,
  glitchIntensity = "medium",
  color = "gradient-orange",
  backgroundColor,
  isStatic = false,
  size = "md",
  fontWeight = 700,
  letterSpacing = 5,
}: GlitchTextProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const prefersReducedMotion = useReducedMotion();
  // Paused while offscreen so the loops don't spend frames nobody sees.
  const animated = !(isStatic || prefersReducedMotion) && inView;

  const scheme = COLOR_SCHEMES[color];
  const settings = INTENSITY[glitchIntensity];

  const transition = {
    duration: settings.burst,
    times: BURST_TIMES,
    ease: EASE_OUT,
    delay: FIRST_BURST_DELAY,
    repeat: Number.POSITIVE_INFINITY,
    repeatDelay: settings.rest,
  };

  const layerClass = (paint: Paint) =>
    cn("block", paint.kind === "gradient" && "bg-clip-text text-transparent");

  return (
    <div
      className={cn("relative flex items-center justify-center p-8", className)}
      ref={ref}
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      <motion.span
        animate={color === "rainbow" && animated ? RAINBOW_CYCLE : undefined}
        className={cn(
          "relative inline-block",
          typeof size === "string" && SIZE_CLASSES[size]
        )}
        style={{
          fontSize: typeof size === "number" ? `${size}px` : undefined,
          fontWeight,
          letterSpacing,
        }}
        transition={RAINBOW_TRANSITION}
      >
        {/* Always rendered (hidden at rest) so server and client markup match. */}
        {(["before", "after"] as const).map((layer) => (
          <motion.span
            animate={
              animated ? burstKeyframes(PATTERNS[layer], settings) : REST
            }
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 select-none",
              animated && "will-change-transform",
              layerClass(scheme[layer])
            )}
            initial={REST}
            key={layer}
            style={paintStyle(scheme[layer], 7)}
            transition={animated ? transition : INSTANT}
          >
            {text}
          </motion.span>
        ))}

        <motion.span
          animate={
            animated
              ? {
                  x: [
                    0,
                    settings.offset / 3,
                    -settings.offset / 3,
                    settings.offset / 4,
                    0,
                    0,
                  ],
                }
              : { x: 0 }
          }
          className={cn("relative", layerClass(scheme.primary))}
          initial={{ x: 0 }}
          style={paintStyle(scheme.primary, 5)}
          transition={animated ? transition : INSTANT}
        >
          {text}
        </motion.span>
      </motion.span>
    </div>
  );
};

export default GlitchText;
