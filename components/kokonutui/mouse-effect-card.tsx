"use client";

/**
 * @author: @dorianbaffier
 * @description: Mouse Effect Card - Interactive card with animated dot pattern that responds to mouse movement
 * @version: 1.0.0
 * @date: 2025-01-30
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  type MotionStyle,
  type MotionValue,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const SPRING_CONFIG = { stiffness: 300, damping: 30, mass: 0.5 };
const BOOST_SPRING_CONFIG = { stiffness: 150, damping: 25 };
const OPACITY_DURATION_BASE = 0.8;
const OPACITY_DURATION_VARIATION = 0.2;
const OPACITY_DELAY_CYCLE = 1.5;
const OPACITY_DELAY_STEP = 0.02;
const MIN_OPACITY_MULTIPLIER = 0.5;
const MAX_OPACITY_MULTIPLIER = 1.5;
const MIN_OPACITY_FALLBACK = 0.3;
const PROXIMITY_MULTIPLIER = 1.2;
const PROXIMITY_OPACITY_BOOST = 0.8;

// The twinkle runs in CSS on each dot's ::before (off the main thread). It
// only defines the midpoint, so it goes from the dot's resting opacity
// (`--dot-rest`) to `--dot-peak` and back.
const TWINKLE_KEYFRAMES =
  "@keyframes kokonutui-dot-twinkle { 50% { opacity: var(--dot-peak); } }";

export interface MouseEffectCardProps {
  className?: string;
  children?: React.ReactNode;
  dotSize?: number;
  dotSpacing?: number;
  repulsionRadius?: number;
  repulsionStrength?: number;
  title?: string;
  subtitle?: string;
  topText?: string;
  topSubtext?: string;
  primaryCtaText?: string;
  primaryCtaUrl?: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  footerText?: string;
  /**
   * @deprecated The dot pattern is decorative and no longer focusable, so
   * there is nothing to label. This prop is ignored.
   */
  ariaLabel?: string;
}

interface Dot {
  id: string;
  baseX: number;
  baseY: number;
  opacity: number;
}

interface Force {
  x: number;
  y: number;
  boost: number;
}

interface DotComponentProps {
  dot: Dot;
  index: number;
  dotSize: number;
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
  repulsionRadius: number;
  repulsionStrength: number;
}

const NO_FORCE: Force = { x: 0, y: 0, boost: 0 };

function getForce(
  dot: Dot,
  mouseX: number,
  mouseY: number,
  repulsionRadius: number,
  repulsionStrength: number
): Force {
  const dx = dot.baseX - mouseX;
  const dy = dot.baseY - mouseY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const boostRadius = repulsionRadius * PROXIMITY_MULTIPLIER;

  // Also catches the pointer being off the card (coordinates at Infinity).
  if (!(distance < boostRadius)) {
    return NO_FORCE;
  }

  const boost = (1 - distance / boostRadius) * PROXIMITY_OPACITY_BOOST;
  if (distance >= repulsionRadius || distance === 0) {
    return { x: 0, y: 0, boost };
  }

  const push =
    ((1 - distance / repulsionRadius) * repulsionStrength) / distance;
  return { x: dx * push, y: dy * push, boost };
}

function generateDots(width: number, height: number, spacing: number): Dot[] {
  const dots: Dot[] = [];
  const cols = Math.ceil(width / spacing);
  const rows = Math.ceil(height / spacing);
  const centerX = width / 2;
  const centerY = height / 2;
  const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);

  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= cols; col++) {
      const x = col * spacing;
      const y = row * spacing;

      const dx = x - centerX;
      const dy = y - centerY;
      const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);

      // 0 at the center, rising to 1 at 70% of the way to the corners.
      const edgeFactor = Math.min(distanceFromCenter / (maxDistance * 0.7), 1);

      // Randomly drop dots, more of them towards the center, to keep the
      // area behind the text clear.
      if (Math.random() > edgeFactor) {
        continue;
      }

      const pattern = (row + col) % 3;
      const baseOpacities = [0.3, 0.5, 0.7];
      const opacity = baseOpacities[pattern] * edgeFactor;

      dots.push({
        id: `dot-${row}-${col}`,
        baseX: x,
        baseY: y,
        opacity,
      });
    }
  }

  return dots;
}

function DotComponent({
  dot,
  index,
  dotSize,
  mouseX,
  mouseY,
  repulsionRadius,
  repulsionStrength,
}: DotComponentProps) {
  const force = useTransform<number, Force>([mouseX, mouseY], ([mx, my]) =>
    getForce(dot, mx, my, repulsionRadius, repulsionStrength)
  );

  const x = useSpring(
    useTransform(force, (f) => f.x),
    SPRING_CONFIG
  );
  const y = useSpring(
    useTransform(force, (f) => f.y),
    SPRING_CONFIG
  );

  const baseMinOpacity = Math.max(
    dot.opacity * MIN_OPACITY_MULTIPLIER,
    MIN_OPACITY_FALLBACK
  );
  const baseMaxOpacity = Math.min(dot.opacity * MAX_OPACITY_MULTIPLIER, 1);
  // Faint dots hit the 0.3 floor, so "min" can be the brighter of the two.
  const brightestOpacity = Math.max(baseMinOpacity, baseMaxOpacity);

  // The dot's own opacity carries the pointer boost, its ::before carries the
  // twinkle (as fractions of the brightest value), and the two multiply: at
  // rest the dot twinkles from baseMinOpacity to baseMaxOpacity and back, and
  // near the pointer it brightens.
  const opacity = useSpring(
    useTransform(force, (f) => Math.min(brightestOpacity + f.boost, 1)),
    BOOST_SPRING_CONFIG
  );

  const duration =
    OPACITY_DURATION_BASE + (index % 4) * OPACITY_DURATION_VARIATION;
  const delay = (index * OPACITY_DELAY_STEP) % OPACITY_DELAY_CYCLE;

  const style: MotionStyle & Record<`--${string}`, string> = {
    width: dotSize,
    height: dotSize,
    left: dot.baseX,
    top: dot.baseY,
    x,
    y,
    opacity,
    "--dot-rest": String(baseMinOpacity / brightestOpacity),
    "--dot-peak": String(baseMaxOpacity / brightestOpacity),
    "--dot-duration": `${duration}s`,
    "--dot-delay": `${delay}s`,
  };

  return (
    <motion.div
      className="absolute rounded-full before:absolute before:inset-0 before:rounded-full before:bg-zinc-400 before:opacity-(--dot-rest) motion-safe:before:animate-[kokonutui-dot-twinkle_var(--dot-duration)_cubic-bezier(0.4,0,0.2,1)_var(--dot-delay)_infinite] dark:before:bg-zinc-600"
      style={style}
    />
  );
}

export default function MouseEffectCard({
  className,
  children,
  dotSize = 2,
  dotSpacing = 16,
  repulsionRadius = 80,
  repulsionStrength = 20,
  title = "Acme",
  subtitle = "Build interfaces with interactive patterns",
  topText = "Case Study",
  topSubtext = "Discover something new",
  primaryCtaText = "Get Started",
  primaryCtaUrl = "#",
  secondaryCtaText = "View Docs",
  secondaryCtaUrl = "#",
  footerText = "We do it all",
}: MouseEffectCardProps) {
  const innerContainerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY);
  const mouseY = useMotionValue(Number.POSITIVE_INFINITY);
  const [dots, setDots] = useState<Dot[]>([]);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const updateDots = () => {
      if (!innerContainerRef.current) {
        return;
      }
      const rect = innerContainerRef.current.getBoundingClientRect();
      const newDots = generateDots(rect.width, rect.height, dotSpacing);
      setDots(newDots);
    };

    updateDots();

    const resizeObserver = new ResizeObserver(updateDots);
    if (innerContainerRef.current) {
      resizeObserver.observe(innerContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [dotSpacing]);

  // Mouse only: a touch tap would otherwise leave the dots pushed aside
  // until the next tap elsewhere.
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !innerContainerRef.current) {
      return;
    }

    const rect = innerContainerRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  const handlePointerLeave = () => {
    mouseX.set(Number.POSITIVE_INFINITY);
    mouseY.set(Number.POSITIVE_INFINITY);
  };

  return (
    <Card
      className={cn(
        "relative w-full max-w-md overflow-hidden rounded-2xl border border-white/40 p-0 shadow-none dark:border-white/10",
        className
      )}
    >
      <style href="kokonutui-mouse-effect-card" precedence="default">
        {TWINKLE_KEYFRAMES}
      </style>
      <CardContent
        className="relative h-[400px] w-full overflow-hidden p-0"
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        ref={innerContainerRef}
      >
        <div aria-hidden="true" className="absolute inset-0">
          {dots.map((dot, index) => (
            <DotComponent
              dot={dot}
              dotSize={dotSize}
              index={index}
              key={dot.id}
              mouseX={mouseX}
              mouseY={mouseY}
              repulsionRadius={repulsionRadius}
              repulsionStrength={shouldReduceMotion ? 0 : repulsionStrength}
            />
          ))}
        </div>

        {topText && (
          <div className="absolute top-6 left-6 z-10">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-white/60 blur-lg dark:bg-zinc-950/60" />
              <div className="relative flex flex-col gap-1">
                <p className="font-bold text-sm text-zinc-900 dark:text-white">
                  {topText}
                </p>
                {topSubtext && (
                  <p className="font-medium text-xs text-zinc-600 opacity-70 dark:text-zinc-400">
                    {topSubtext}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="relative z-10 flex h-full flex-col items-center justify-center px-2">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-white/80 blur-2xl dark:bg-zinc-950/80" />
              <h2 className="relative text-center font-bold text-4xl text-zinc-900 tracking-tight dark:text-white">
                {title}
              </h2>
            </div>
            {(subtitle || children) && (
              <div className="relative">
                <div className="absolute inset-0 rounded-lg bg-white/60 blur-xl dark:bg-zinc-950/60" />
                <p className="relative max-w-sm text-center font-medium text-base text-zinc-700 leading-relaxed dark:text-zinc-300">
                  {children || subtitle}
                </p>
              </div>
            )}
            <div className="mt-2 flex items-center gap-3">
              <Button asChild className="rounded-full shadow-lg" size="lg">
                <a
                  href={primaryCtaUrl}
                  onClick={(e) => {
                    if (primaryCtaUrl === "#") {
                      e.preventDefault();
                    }
                  }}
                >
                  {primaryCtaText}
                </a>
              </Button>
              {secondaryCtaText && (
                <Button
                  asChild
                  className="rounded-full"
                  size="lg"
                  variant="outline"
                >
                  <a
                    href={secondaryCtaUrl}
                    onClick={(e) => {
                      if (secondaryCtaUrl === "#") {
                        e.preventDefault();
                      }
                    }}
                  >
                    {secondaryCtaText}
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>

        {footerText && (
          <div className="absolute right-0 bottom-6 left-0 z-10 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-white/60 blur-lg dark:bg-zinc-950/60" />
              <p className="relative px-4 py-1 font-medium text-xs text-zinc-600 dark:text-zinc-400">
                {footerText}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
