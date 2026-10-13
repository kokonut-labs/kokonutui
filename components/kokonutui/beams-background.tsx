"use client";

/**
 * @author: @dorianbaffier
 * @description: Beams Background
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { MotionConfig, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface BeamsBackgroundProps {
  className?: string;
  children?: React.ReactNode;
  intensity?: "subtle" | "medium" | "strong";
}

interface Beam {
  x: number;
  y: number;
  width: number;
  length: number;
  angle: number;
  speed: number;
  opacity: number;
  hue: number;
  pulse: number;
  pulseSpeed: number;
  gradient: CanvasGradient | null;
}

const MINIMUM_BEAMS = 20;
const TOTAL_BEAMS = MINIMUM_BEAMS * 1.5;

// Beams are drawn unblurred into a low-resolution buffer that is blurred once
// per frame, instead of blurring every beam. The margin keeps beams that cross
// an edge from fading out there.
const BEAM_BLUR = "blur(35px)";
const BUFFER_SCALE = 0.5;
const BUFFER_MARGIN = 105;

// Speeds are per 60 Hz frame.
const FRAME_MS = 1000 / 60;

const opacityMap = {
  subtle: 0.7,
  medium: 0.85,
  strong: 1,
};

function createBeam(width: number, height: number, isDarkMode: boolean): Beam {
  const hueBase = isDarkMode ? 190 : 210;
  const hueRange = isDarkMode ? 70 : 50;

  return {
    x: Math.random() * width * 1.5 - width * 0.25,
    y: Math.random() * height * 1.5 - height * 0.25,
    width: 30 + Math.random() * 60,
    length: height * 2.5,
    angle: -35 + Math.random() * 10,
    speed: 0.6 + Math.random() * 1.2,
    opacity: 0.12 + Math.random() * 0.16,
    hue: hueBase + Math.random() * hueRange,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.02 + Math.random() * 0.03,
    gradient: null,
  };
}

/** A beam that left through the top comes back below the bottom edge. */
function respawnBeam(
  index: number,
  width: number,
  height: number,
  isDarkMode: boolean
): Beam {
  const spacing = width / 3;

  return {
    ...createBeam(width, height, isDarkMode),
    x:
      (index % 3) * spacing +
      spacing / 2 +
      (Math.random() - 0.5) * spacing * 0.5,
    y: height + 100,
  };
}

function createBeamGradient(
  ctx: CanvasRenderingContext2D,
  beam: Beam,
  isDarkMode: boolean
) {
  const saturation = isDarkMode ? "85%" : "75%";
  const lightness = isDarkMode ? "65%" : "45%";
  const color = (alpha: number) =>
    `hsla(${beam.hue}, ${saturation}, ${lightness}, ${alpha})`;

  const gradient = ctx.createLinearGradient(0, 0, 0, beam.length);
  gradient.addColorStop(0, color(0));
  gradient.addColorStop(0.1, color(0.5));
  gradient.addColorStop(0.4, color(1));
  gradient.addColorStop(0.6, color(1));
  gradient.addColorStop(0.9, color(0.5));
  gradient.addColorStop(1, color(0));
  return gradient;
}

export default function BeamsBackground({
  className,
  children,
  intensity = "strong",
}: BeamsBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    const buffer = document.createElement("canvas");
    const bufferCtx = buffer.getContext("2d");
    if (!(canvas && container && ctx && bufferCtx)) {
      return;
    }

    // Under reduced motion one still frame is drawn, and redrawn when the
    // size or the theme changes.
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const intensityOpacity = opacityMap[intensity];

    // The root sets --beams-dark through the `dark:` variant, so this follows
    // whatever dark mode setup the app uses (class, data attribute or media).
    const readDarkMode = () =>
      getComputedStyle(container).getPropertyValue("--beams-dark").trim() ===
      "1";

    let width = 0;
    let height = 0;
    let isDarkMode = readDarkMode();
    let beams: Beam[] = [];
    let frameId = 0;
    let lastTime = 0;
    let isVisible = false;

    const drawBeam = (beam: Beam) => {
      beam.gradient ??= createBeamGradient(bufferCtx, beam, isDarkMode);
      bufferCtx.save();
      bufferCtx.translate(beam.x, beam.y);
      bufferCtx.rotate((beam.angle * Math.PI) / 180);
      bufferCtx.globalAlpha =
        beam.opacity * (0.8 + Math.sin(beam.pulse) * 0.2) * intensityOpacity;
      bufferCtx.fillStyle = beam.gradient;
      bufferCtx.fillRect(-beam.width / 2, 0, beam.width, beam.length);
      bufferCtx.restore();
    };

    const draw = () => {
      const bufferWidth = width + BUFFER_MARGIN * 2;
      const bufferHeight = height + BUFFER_MARGIN * 2;

      bufferCtx.clearRect(
        -BUFFER_MARGIN,
        -BUFFER_MARGIN,
        bufferWidth,
        bufferHeight
      );
      for (const beam of beams) {
        drawBeam(beam);
      }

      ctx.clearRect(0, 0, width, height);
      ctx.filter = BEAM_BLUR;
      ctx.drawImage(
        buffer,
        -BUFFER_MARGIN,
        -BUFFER_MARGIN,
        bufferWidth,
        bufferHeight
      );
    };

    const step = (frames: number) => {
      for (let i = 0; i < beams.length; i++) {
        const beam = beams[i];
        beam.y -= beam.speed * frames;
        beam.pulse += beam.pulseSpeed * frames;

        if (beam.y + beam.length < -100) {
          beams[i] = respawnBeam(i, width, height, isDarkMode);
        }
      }
    };

    const tick = (now: number) => {
      // Scale by the real frame time so the speed is the same at any refresh
      // rate. The cap keeps a long pause from jumping the beams.
      const frames = lastTime ? Math.min((now - lastTime) / FRAME_MS, 4) : 1;
      lastTime = now;
      step(frames);
      draw();
      frameId = requestAnimationFrame(tick);
    };

    const start = () => {
      if (frameId || prefersReducedMotion || !isVisible) {
        return;
      }
      lastTime = 0;
      frameId = requestAnimationFrame(tick);
    };

    const stop = () => {
      cancelAnimationFrame(frameId);
      frameId = 0;
    };

    const resize = () => {
      const nextWidth = container.clientWidth;
      const nextHeight = container.clientHeight;
      if (nextWidth === width && nextHeight === height) {
        return;
      }

      width = nextWidth;
      height = nextHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.scale(dpr, dpr);

      buffer.width = Math.ceil((width + BUFFER_MARGIN * 2) * BUFFER_SCALE);
      buffer.height = Math.ceil((height + BUFFER_MARGIN * 2) * BUFFER_SCALE);
      bufferCtx.setTransform(
        BUFFER_SCALE,
        0,
        0,
        BUFFER_SCALE,
        BUFFER_MARGIN * BUFFER_SCALE,
        BUFFER_MARGIN * BUFFER_SCALE
      );

      beams = Array.from({ length: TOTAL_BEAMS }, () =>
        createBeam(width, height, isDarkMode)
      );
      draw();
    };

    const updateDarkMode = () => {
      const next = readDarkMode();
      if (next === isDarkMode) {
        return;
      }

      isDarkMode = next;
      for (const beam of beams) {
        beam.gradient = null;
      }
      if (!frameId) {
        draw();
      }
    };

    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    // Only animate while the background is on screen.
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry?.isIntersecting ?? false;
      if (isVisible) {
        start();
      } else {
        stop();
      }
    });
    visibilityObserver.observe(container);

    const themeObserver = new MutationObserver(updateDarkMode);
    themeObserver.observe(document.documentElement, { attributes: true });
    themeObserver.observe(document.body, { attributes: true });
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    colorScheme.addEventListener("change", updateDarkMode);

    return () => {
      stop();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      themeObserver.disconnect();
      colorScheme.removeEventListener("change", updateDarkMode);
    };
  }, [intensity]);

  return (
    <div
      className={cn(
        "relative flex min-h-svh w-full flex-col overflow-hidden bg-neutral-100 [--beams-dark:0] dark:bg-neutral-950 dark:[--beams-dark:1]",
        className
      )}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <canvas
          className="h-full w-full"
          ref={canvasRef}
          style={{ filter: "blur(15px)" }}
        />
      </div>

      <div className="relative z-10 flex w-full flex-1 items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-6 px-4 text-center">
          {children ?? (
            // Reduced motion keeps the fade-in and drops the rise.
            <MotionConfig reducedMotion="user">
              <motion.h1
                animate={{ opacity: 1, y: 0 }}
                className="font-semibold text-6xl text-neutral-900 tracking-tighter md:text-7xl lg:text-8xl dark:text-white"
                initial={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              >
                Beams
                <br />
                Background
              </motion.h1>
            </MotionConfig>
          )}
        </div>
      </div>
    </div>
  );
}
