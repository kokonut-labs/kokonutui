"use client";

/**
 * @author: @dorianbaffier
 * @description: Background Paths
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { MotionConfig, motion, useInView } from "motion/react";
import { useId, useRef } from "react";

interface Point {
  x: number;
  y: number;
}

interface WaveLayerConfig {
  type: "primary" | "secondary" | "accent";
  count: number;
  amplitude: number;
  segments: number;
  /** Vertical drift of the whole layer, in viewBox units. */
  drift: number;
  /** Seconds per drift cycle. */
  duration: number;
  /** Opacity of the whole layer. */
  opacity: number;
  opacityBase: number;
  opacityStep: number;
  widthBase: number;
  widthStep: number;
}

const WAVE_LAYERS: WaveLayerConfig[] = [
  {
    type: "primary",
    count: 12,
    amplitude: 150,
    segments: 10,
    drift: 15,
    duration: 8,
    opacity: 1,
    opacityBase: 0.15,
    opacityStep: 0.02,
    widthBase: 4,
    widthStep: 0.3,
  },
  {
    type: "secondary",
    count: 15,
    amplitude: 100,
    segments: 8,
    drift: 10,
    duration: 6,
    opacity: 0.8,
    opacityBase: 0.12,
    opacityStep: 0.015,
    widthBase: 3,
    widthStep: 0.25,
  },
  {
    type: "accent",
    count: 10,
    amplitude: 60,
    segments: 6,
    drift: 5,
    duration: 4,
    opacity: 0.6,
    opacityBase: 0.08,
    opacityStep: 0.12,
    widthBase: 2,
    widthStep: 0.2,
  },
];

function generateAestheticPath(
  index: number,
  baseAmplitude: number,
  segments: number
): string {
  const phase = index * 0.2;
  const points: Point[] = [];

  const startX = 2400;
  const startY = 800;
  const endX = -2400;
  const endY = -800 + index * 25;

  for (let i = 0; i <= segments; i++) {
    const progress = i / segments;
    const eased = 1 - (1 - progress) ** 2;

    const baseX = startX + (endX - startX) * eased;
    const baseY = startY + (endY - startY) * eased;

    const amplitudeFactor = 1 - eased * 0.3;
    const wave1 =
      Math.sin(progress * Math.PI * 3 + phase) *
      (baseAmplitude * 0.7 * amplitudeFactor);
    const wave2 =
      Math.cos(progress * Math.PI * 4 + phase) *
      (baseAmplitude * 0.3 * amplitudeFactor);
    const wave3 =
      Math.sin(progress * Math.PI * 2 + phase) *
      (baseAmplitude * 0.2 * amplitudeFactor);

    points.push({
      x: baseX,
      y: baseY + wave1 + wave2 + wave3,
    });
  }

  // Math.sin/cos can differ in the last digits between the server and the
  // browser, so round the coordinates to keep the SSR markup identical.
  const f = (n: number) => n.toFixed(1);

  const pathCommands = points.map((point: Point, i: number) => {
    if (i === 0) {
      return `M ${f(point.x)} ${f(point.y)}`;
    }
    const prevPoint = points[i - 1];
    const tension = 0.4;
    const cp1x = prevPoint.x + (point.x - prevPoint.x) * tension;
    const cp1y = prevPoint.y;
    const cp2x = prevPoint.x + (point.x - prevPoint.x) * (1 - tension);
    const cp2y = point.y;
    return `C ${f(cp1x)} ${f(cp1y)}, ${f(cp2x)} ${f(cp2y)}, ${f(point.x)} ${f(point.y)}`;
  });

  return pathCommands.join(" ");
}

// The paths are deterministic, so they are built once for every instance.
const LAYERS = WAVE_LAYERS.map((layer) => ({
  ...layer,
  paths: Array.from({ length: layer.count }, (_, i) => ({
    id: `${layer.type}-${i}`,
    d: generateAestheticPath(i, layer.amplitude, layer.segments),
    opacity: Math.min(layer.opacityBase + i * layer.opacityStep, 1),
    width: layer.widthBase + i * layer.widthStep,
  })),
}));

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

function FloatingPaths() {
  const ref = useRef<HTMLDivElement>(null);
  // Drift only while on screen.
  const drifting = useInView(ref);
  const gradientId = useId();

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      ref={ref}
    >
      <svg
        aria-hidden="true"
        className="h-full w-full"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        viewBox="-2400 -800 4800 1600"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(147, 51, 234, 0.5)" />
            <stop offset="50%" stopColor="rgba(236, 72, 153, 0.5)" />
            <stop offset="100%" stopColor="rgba(59, 130, 246, 0.5)" />
          </linearGradient>
        </defs>

        {/* One drift loop per layer: its paths always moved in lockstep. */}
        {LAYERS.map((layer) => (
          <motion.g
            animate={{
              opacity: layer.opacity,
              y: drifting ? [0, -layer.drift, 0] : 0,
            }}
            initial={{ opacity: 0 }}
            key={layer.type}
            transition={{
              opacity: { duration: 1, ease: EASE_OUT },
              y: drifting
                ? {
                    duration: layer.duration,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }
                : { duration: 0 },
            }}
          >
            {layer.paths.map((path) => (
              <path
                d={path.d}
                key={path.id}
                opacity={path.opacity}
                stroke={`url(#${gradientId})`}
                strokeLinecap="round"
                strokeWidth={path.width}
              />
            ))}
          </motion.g>
        ))}
      </svg>
    </div>
  );
}

export default function BackgroundPaths({
  title = "Background Paths",
}: {
  title?: string;
}) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-white dark:bg-neutral-950">
      {/* Reduced motion skips the drift and the title's rise; fades stay. */}
      <MotionConfig reducedMotion="user">
        <FloatingPaths />

        <div className="container relative z-10 mx-auto px-4 text-center md:px-6">
          <div className="mx-auto max-w-4xl">
            <motion.h1
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 bg-gradient-to-r from-neutral-800/90 to-neutral-600/90 bg-clip-text font-bold text-3xl text-transparent tracking-tighter sm:text-5xl dark:from-white/90 dark:to-white/70"
              initial={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.7, ease: EASE_OUT }}
            >
              {title}
            </motion.h1>
          </div>
        </div>
      </MotionConfig>
    </div>
  );
}
