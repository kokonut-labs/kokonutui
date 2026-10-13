"use client";

/**
 * @author: @dorianbaffier
 * @description: Liquid Glass Card - Optimized with Shadcn UI
 * @version: 2.0.0
 * @date: 2025-10-11
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { cva, type VariantProps } from "class-variance-authority";
import {
  ArrowLeft,
  ArrowRight,
  MoreHorizontal,
  Pause,
  Play,
} from "lucide-react";
import Image from "next/image";
import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const GLASS_SHADOW_LIGHT =
  "shadow-[0_0_6px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_3px_3px_0.5px_-3px_rgba(0,0,0,0.9),inset_-3px_-3px_0.5px_-3px_rgba(0,0,0,0.85),inset_1px_1px_1px_-0.5px_rgba(0,0,0,0.6),inset_-1px_-1px_1px_-0.5px_rgba(0,0,0,0.6),inset_0_0_6px_6px_rgba(0,0,0,0.12),inset_0_0_2px_2px_rgba(0,0,0,0.06),0_0_12px_rgba(255,255,255,0.15)]";

const GLASS_SHADOW_DARK =
  "dark:shadow-[0_0_8px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_3px_3px_0.5px_-3.5px_rgba(255,255,255,0.09),inset_-3px_-3px_0.5px_-3.5px_rgba(255,255,255,0.85),inset_1px_1px_1px_-0.5px_rgba(255,255,255,0.6),inset_-1px_-1px_1px_-0.5px_rgba(255,255,255,0.6),inset_0_0_6px_6px_rgba(255,255,255,0.12),inset_0_0_2px_2px_rgba(255,255,255,0.06),0_0_12px_rgba(0,0,0,0.15)]";

const GLASS_SHADOW = `${GLASS_SHADOW_LIGHT} ${GLASS_SHADOW_DARK}`;

const DEFAULT_GLASS_FILTER_SCALE = 30;
const BUTTON_GLASS_FILTER_SCALE = 70;

interface GlassFilterProps {
  id: string;
  scale?: number;
}

const GlassFilter = React.memo(
  ({ id, scale = DEFAULT_GLASS_FILTER_SCALE }: GlassFilterProps) => (
    <svg aria-hidden="true" className="hidden" focusable={false}>
      <defs>
        <filter
          colorInterpolationFilters="sRGB"
          height="200%"
          id={id}
          width="200%"
          x="-50%"
          y="-50%"
        >
          <feTurbulence
            baseFrequency="0.05 0.05"
            numOctaves="1"
            result="turbulence"
            seed="1"
            type="fractalNoise"
          />
          <feGaussianBlur
            in="turbulence"
            result="blurredNoise"
            stdDeviation="2"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurredNoise"
            result="displaced"
            scale={scale}
            xChannelSelector="R"
            yChannelSelector="B"
          />
          <feGaussianBlur in="displaced" result="finalBlur" stdDeviation="4" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  )
);
GlassFilter.displayName = "GlassFilter";

// Colours are listed next to scale so callers have no reason to pass
// `transition-colors`, which tailwind-merge would swap in for this list,
// making the press and hover scale snap.
const liquidButtonVariants = cva(
  "relative transition-[color,background-color,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
  {
    variants: {
      liquidVariant: {
        default:
          "hover:scale-105 active:scale-[0.97] motion-reduce:active:scale-100 motion-reduce:hover:scale-100",
        none: "",
      },
    },
    defaultVariants: {
      liquidVariant: "default",
    },
  }
);

export type LiquidButtonProps = React.ComponentProps<typeof Button> &
  VariantProps<typeof liquidButtonVariants>;

function LiquidButton({
  className,
  liquidVariant = "default",
  children,
  ...props
}: LiquidButtonProps) {
  const filterId = React.useId();

  return (
    <>
      <Button
        className={cn(liquidButtonVariants({ liquidVariant }), className)}
        {...props}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit]",
            GLASS_SHADOW
          )}
        />
        <div
          className="pointer-events-none absolute inset-0 isolate -z-10 overflow-hidden rounded-[inherit]"
          style={{ backdropFilter: `url("#${filterId}")` }}
        />
        <span className="relative z-10">{children}</span>
      </Button>
      <GlassFilter id={filterId} scale={BUTTON_GLASS_FILTER_SCALE} />
    </>
  );
}

const liquidGlassCardVariants = cva(
  "group relative overflow-hidden bg-background/20 backdrop-blur-[2px]",
  {
    variants: {
      glassSize: {
        sm: "p-4",
        default: "p-6",
        lg: "p-8",
      },
    },
    defaultVariants: {
      glassSize: "default",
    },
  }
);

export type LiquidGlassCardProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof liquidGlassCardVariants> & {
    glassEffect?: boolean;
  };

function LiquidGlassCard({
  className,
  glassSize,
  glassEffect = true,
  children,
  ...props
}: LiquidGlassCardProps) {
  const filterId = React.useId();

  return (
    <Card
      className={cn(liquidGlassCardVariants({ glassSize }), className)}
      {...props}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit]",
          GLASS_SHADOW
        )}
      />

      {glassEffect && (
        <>
          <div
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
            style={{ backdropFilter: `url("#${filterId}")` }}
          />
          <GlassFilter id={filterId} scale={DEFAULT_GLASS_FILTER_SCALE} />
        </>
      )}

      <div className="relative z-10">{children}</div>

      <div className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] bg-gradient-to-r from-transparent via-black/5 to-transparent opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 motion-reduce:transition-none dark:via-white/5" />
    </Card>
  );
}

// Demo: Music Player Card
const TOTAL_DURATION = 45;
const VOLUME_BAR_COUNT = 8;
const SEEK_JUMP_SECONDS = 5;
const TIMER_INTERVAL_MS = 1000;
const STATIC_BAR_SCALE = "scaleY(0.23)";
const MIN_TIME = 0;
const BAR_DELAY_INCREMENT = 0.1;

const formatTime = (timeInSeconds: number): string => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

interface VolumeBarsProps {
  isPlaying: boolean;
}

// Shipped with the component so it works without adding keyframes to globals.css.
const VOLUME_BAR_KEYFRAMES = `@keyframes liquid-glass-volume-bar{0%,100%{transform:${STATIC_BAR_SCALE}}50%{transform:scaleY(1)}}`;

const VolumeBars = React.memo(({ isPlaying }: VolumeBarsProps) => {
  const bars = Array.from({ length: VOLUME_BAR_COUNT }, (_, i) => ({
    id: `bar-${i}`,
    delay: i * BAR_DELAY_INCREMENT,
  }));

  return (
    <div className="pointer-events-none flex h-8 w-10 items-end gap-0.5">
      <style>{VOLUME_BAR_KEYFRAMES}</style>
      {bars.map((bar) => (
        <div
          className={cn(
            "h-[26px] w-[3px] origin-bottom rounded-sm",
            isPlaying &&
              "motion-safe:animate-[liquid-glass-volume-bar_0.8s_ease-in-out_infinite]"
          )}
          key={bar.id}
          style={{
            transform: STATIC_BAR_SCALE,
            animationDelay: `${bar.delay}s`,
            background: "linear-gradient(to top, #FF2E55, #FF6B88)",
          }}
        />
      ))}
    </div>
  );
});
VolumeBars.displayName = "VolumeBars";

interface ProgressBarProps {
  currentTime: number;
  totalDuration: number;
  onSeek: (newTime: number) => void;
}

const ProgressBar = React.memo(
  ({ currentTime, totalDuration, onSeek }: ProgressBarProps) => {
    const progress = currentTime / totalDuration;

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = e.currentTarget;
      const rect = bar.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = x / rect.width;
      const newTime = Math.min(
        Math.max(MIN_TIME, percent * totalDuration),
        totalDuration
      );
      onSeek(newTime);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          onSeek(Math.min(currentTime + SEEK_JUMP_SECONDS, totalDuration));
          break;
        case "ArrowLeft":
          e.preventDefault();
          onSeek(Math.max(currentTime - SEEK_JUMP_SECONDS, MIN_TIME));
          break;
        case "Home":
          e.preventDefault();
          onSeek(MIN_TIME);
          break;
        case "End":
          e.preventDefault();
          onSeek(totalDuration);
          break;
        default:
          break;
      }
    };

    return (
      <>
        <div className="flex justify-between font-medium text-xs text-zinc-500 dark:text-zinc-400">
          <span className="tabular-nums">{formatTime(currentTime)}</span>
          <span className="tabular-nums">{formatTime(totalDuration)}</span>
        </div>
        <div
          aria-label="Seek progress bar"
          aria-valuemax={totalDuration}
          aria-valuemin={MIN_TIME}
          aria-valuenow={currentTime}
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(totalDuration)}`}
          className="relative z-10 h-1 w-full cursor-pointer overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          role="slider"
          tabIndex={0}
        >
          <div
            className="h-full w-full origin-left bg-gradient-to-r from-[#FF2E55] to-[#FF6B88] transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      </>
    );
  }
);
ProgressBar.displayName = "ProgressBar";

export function NotificationCenter() {
  const [isPlaying, setIsPlaying] = React.useState(true);
  const [currentTime, setCurrentTime] = React.useState(MIN_TIME);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = React.useState(true);

  // Only tick while on screen — an off-screen interval keeps waking the main
  // thread and re-rendering for a component nobody can see.
  React.useEffect(() => {
    const element = rootRef.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: "100px" }
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  // One tick per second; the tick that reaches the end also stops playback.
  React.useEffect(() => {
    if (!(isPlaying && isVisible)) {
      return;
    }

    const timeoutId = setTimeout(() => {
      const nextTime = Math.min(currentTime + 1, TOTAL_DURATION);
      setCurrentTime(nextTime);
      if (nextTime >= TOTAL_DURATION) {
        setIsPlaying(false);
      }
    }, TIMER_INTERVAL_MS);

    return () => clearTimeout(timeoutId);
  }, [currentTime, isPlaying, isVisible]);

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    // Pressing Play at the end restarts the track.
    if (currentTime >= TOTAL_DURATION) {
      setCurrentTime(MIN_TIME);
    }
    setIsPlaying(true);
  };

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    setIsPlaying(newTime < TOTAL_DURATION);
  };

  return (
    <div className="w-full max-w-sm" ref={rootRef}>
      <LiquidGlassCard className="gap-3.5 rounded-3xl border border-zinc-200/60 bg-gradient-to-br from-zinc-50 to-zinc-100 p-4 shadow-xl dark:border-zinc-700/60 dark:from-zinc-900 dark:to-black">
        <div className="flex items-center gap-3">
          <div className="relative mr-2 mb-4 h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-pink-400 via-pink-300 to-rose-200 shadow-lg ring-1 ring-black/5 dark:shadow-xl">
            <Image
              alt="Album Art for Glow by Echo"
              className="h-full w-full object-cover"
              height={64}
              sizes="64px"
              src="https://ferf1mheo22r9ira.public.blob.vercel-storage.com/portrait2-x5MjJSaQ9ed0HZrewEhH7TkZwjZ66K.jpeg"
              unoptimized
              width={64}
            />
          </div>

          <div className="flex-1 overflow-hidden">
            <h3 className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-lg text-zinc-900 dark:text-white">
              Glow
            </h3>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              Echo
            </p>
          </div>

          <VolumeBars isPlaying={isPlaying} />
        </div>

        <div className="flex flex-col gap-2">
          <ProgressBar
            currentTime={currentTime}
            onSeek={handleSeek}
            totalDuration={TOTAL_DURATION}
          />

          <div className="mt-1 flex items-center justify-between">
            <div className="flex items-center justify-center gap-2">
              <LiquidButton
                aria-label="Previous track"
                className="h-10 w-10 rounded-full bg-transparent text-zinc-700 hover:bg-zinc-200/80 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                size="icon"
                variant="ghost"
              >
                <ArrowLeft className="size-4" />
              </LiquidButton>
              <LiquidButton
                aria-label={isPlaying ? "Pause" : "Play"}
                className="h-11 w-11 rounded-full bg-transparent text-zinc-700 hover:bg-zinc-200/80 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                onClick={handlePlayPause}
                size="icon"
                variant="ghost"
              >
                {isPlaying ? (
                  <Pause className="size-5" />
                ) : (
                  <Play className="size-5" />
                )}
              </LiquidButton>
              <LiquidButton
                aria-label="Next track"
                className="h-10 w-10 rounded-full bg-transparent text-zinc-700 hover:bg-zinc-200/80 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                size="icon"
                variant="ghost"
              >
                <ArrowRight className="size-4" />
              </LiquidButton>
            </div>
            <LiquidButton
              aria-label="More options"
              className="h-10 w-10 rounded-full bg-transparent text-zinc-700 hover:bg-zinc-200/80 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
              size="icon"
              variant="ghost"
            >
              <MoreHorizontal className="size-4" />
            </LiquidButton>
          </div>
        </div>
      </LiquidGlassCard>
    </div>
  );
}

export { LiquidButton, LiquidGlassCard };
export default NotificationCenter;
