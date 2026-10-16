"use client";

/**
 * @author: @dorianbaffier
 * @description: Waveform Player
 * @version: 1.0.0
 * @date: 2026-10-16
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const BARS = 72;
const SPEEDS = [1, 1.25, 1.5, 2];
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export interface WaveformChapter {
  /** Seconds from the start. */
  start: number;
  title: string;
}

export interface WaveformPlayerProps {
  show?: string;
  title?: string;
  /** A short label for the cover tile, like an episode number. */
  badge?: string;
  /** Length in seconds. Playback is simulated; drive it from your own audio with `onTimeChange`. */
  duration?: number;
  chapters?: WaveformChapter[];
  /** Where the playhead starts, in seconds. */
  defaultTime?: number;
  /** Bar heights from 0 to 1. Generated from the duration when left out. */
  peaks?: number[];
  onTimeChange?: (seconds: number) => void;
  className?: string;
}

const DEFAULT_CHAPTERS: WaveformChapter[] = [
  { start: 0, title: "Cold open" },
  { start: 72, title: "Why springs feel right" },
  { start: 228, title: "Easing you never notice" },
  { start: 371, title: "Listener questions" },
];

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Seeded, so server and browser draw the same waveform. Speech-like: a
// slow envelope with fast jitter, and a quiet dip where each chapter starts.
function demoPeaks(
  count: number,
  duration: number,
  chapters: WaveformChapter[]
) {
  let seed = 7;
  const random = () => {
    seed = (seed * 16_807) % 2_147_483_647;
    return seed / 2_147_483_647;
  };
  const peaks: number[] = [];
  let level = 0.55;
  for (let i = 0; i < count; i++) {
    level = clamp(level + (random() - 0.5) * 0.35, 0.3, 0.95);
    const t = ((i + 0.5) / count) * duration;
    const nearCut = chapters.some(
      (c) => c.start > 0 && Math.abs(c.start - t) < duration / count
    );
    const jitter = 0.55 + random() * 0.45;
    peaks.push(nearCut ? 0.12 : clamp(level * jitter, 0.14, 1));
  }
  return peaks;
}

function usePlayback(duration: number, rate: number, defaultTime: number) {
  const [time, setTime] = useState(defaultTime);
  const [playing, setPlaying] = useState(false);
  const timeRef = useRef(defaultTime);

  useEffect(() => {
    if (!playing) {
      return;
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = Math.min(
        duration,
        timeRef.current + ((now - last) / 1000) * rate
      );
      last = now;
      timeRef.current = next;
      setTime(next);
      if (next >= duration) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration, rate]);

  const seek = useCallback(
    (seconds: number) => {
      const next = clamp(seconds, 0, duration);
      timeRef.current = next;
      setTime(next);
    },
    [duration]
  );

  const toggle = useCallback(() => {
    if (!playing && timeRef.current >= duration) {
      seek(0);
    }
    setPlaying((p) => !p);
  }, [playing, duration, seek]);

  return { time, playing, setPlaying, seek, toggle, timeRef };
}

function Bars({ peaks }: { peaks: number[] }) {
  return (
    <div className="flex h-full items-center gap-[2px]">
      {peaks.map((peak, i) => (
        <span
          className="min-w-0 flex-1 rounded-full bg-current"
          // biome-ignore lint/suspicious/noArrayIndexKey: one bar per slice of time, never reordered
          key={i}
          style={{ height: `${peak * 100}%` }}
        />
      ))}
    </div>
  );
}

// The line that changes rolls: new text comes from the way time is moving.
function Roll({
  id,
  direction,
  children,
  className,
}: {
  id: string | number;
  direction: number;
  children: string;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex overflow-hidden", className)}>
      <AnimatePresence custom={direction} initial={false} mode="popLayout">
        <motion.span
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          className="block whitespace-nowrap"
          custom={direction}
          exit={{ y: -10 * direction, opacity: 0, filter: "blur(2px)" }}
          initial={{ y: 10 * direction, opacity: 0, filter: "blur(2px)" }}
          key={id}
          transition={{ duration: 0.22, ease: EASE_OUT }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const iconButton =
  "flex size-9 items-center justify-center rounded-full text-zinc-600 outline-none transition-colors duration-150 ease-out hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100";

export default function WaveformPlayer({
  show = "Frame Rate",
  title = "Motion that respects the user",
  badge = "48",
  duration = 504,
  chapters = DEFAULT_CHAPTERS,
  defaultTime = 96,
  peaks: peaksProp,
  onTimeChange,
  className,
}: WaveformPlayerProps) {
  const [speedIndex, setSpeedIndex] = useState(0);
  const rate = SPEEDS[speedIndex];
  const { time, playing, setPlaying, seek, toggle } = usePlayback(
    duration,
    rate,
    defaultTime
  );
  const [hover, setHover] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const waveRef = useRef<HTMLDivElement>(null);
  const resumeRef = useRef(false);

  const peaks = useMemo(
    () => peaksProp ?? demoPeaks(BARS, duration, chapters),
    [peaksProp, duration, chapters]
  );

  useEffect(() => {
    onTimeChange?.(time);
  }, [time, onTimeChange]);

  const chapterAt = useCallback(
    (seconds: number) => {
      let index = 0;
      for (const [i, c] of chapters.entries()) {
        if (c.start <= seconds) {
          index = i;
        }
      }
      return index;
    },
    [chapters]
  );

  const chapter = chapterAt(time);
  const lastChapter = useRef(chapter);
  const chapterDirection = chapter >= lastChapter.current ? 1 : -1;
  useEffect(() => {
    lastChapter.current = chapter;
  }, [chapter]);

  const lastSpeed = useRef(speedIndex);
  const speedDirection = speedIndex >= lastSpeed.current ? 1 : -1;
  useEffect(() => {
    lastSpeed.current = speedIndex;
  }, [speedIndex]);

  const timeAt = (clientX: number) => {
    const rect = waveRef.current?.getBoundingClientRect();
    if (!rect) {
      return 0;
    }
    return clamp((clientX - rect.left) / rect.width, 0, 1) * duration;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    // Hold playback while scrubbing, so the playhead stays under the finger.
    resumeRef.current = playing;
    setPlaying(false);
    setScrubbing(true);
    const t = timeAt(event.clientX);
    seek(t);
    setHover(t);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (scrubbing) {
      const t = timeAt(event.clientX);
      seek(t);
      setHover(t);
    } else if (event.pointerType === "mouse") {
      setHover(timeAt(event.clientX));
    }
  };

  const endScrub = (event: PointerEvent<HTMLDivElement>) => {
    if (!scrubbing) {
      return;
    }
    setScrubbing(false);
    if (event.pointerType !== "mouse") {
      setHover(null);
    }
    if (resumeRef.current) {
      setPlaying(true);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 30 : 5;
    const moves: Record<string, number> = {
      ArrowLeft: -step,
      ArrowDown: -step,
      ArrowRight: step,
      ArrowUp: step,
      Home: -duration,
      End: duration,
    };
    if (event.key === " " || event.key === "k") {
      event.preventDefault();
      toggle();
      return;
    }
    const move = moves[event.key];
    if (move !== undefined) {
      event.preventDefault();
      seek(time + move);
    }
  };

  const progress = (time / duration) * 100;
  const hoverPct = hover === null ? null : (hover / duration) * 100;
  const showTip = hover !== null;
  const current = chapters[chapter];

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-md select-none rounded-3xl border border-zinc-200 bg-white p-5 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 font-medium text-sm text-white tabular-nums dark:bg-zinc-100 dark:text-zinc-900">
            {badge}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {show}
            </p>
            <p className="truncate font-medium text-sm">{title}</p>
          </div>
        </div>

        <p className="mt-5 flex min-w-0 items-baseline gap-1.5 text-sm">
          <span className="shrink-0 text-zinc-400 tabular-nums dark:text-zinc-500">
            {String(chapter + 1).padStart(2, "0")}
          </span>
          <Roll
            className="min-w-0 font-medium"
            direction={chapterDirection}
            id={chapter}
          >
            {current?.title ?? ""}
          </Roll>
        </p>

        <div className="relative mt-3 [container-type:inline-size]">
          {/* Hover or scrub tooltip: time and the chapter it lands in. */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute -top-9 left-0 z-10 transition-opacity duration-150 ease-out",
              showTip ? "opacity-100" : "opacity-0"
            )}
            style={{
              transform: `translateX(clamp(0px, calc(${hoverPct ?? 0}cqw - 50%), calc(100cqw - 100%)))`,
            }}
          >
            {hover !== null && (
              <span className="block whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] text-white tabular-nums dark:bg-zinc-100 dark:text-zinc-900">
                {formatTime(hover)} · {chapters[chapterAt(hover)]?.title}
              </span>
            )}
          </div>

          <div
            aria-label={`${title}, seek`}
            aria-valuemax={Math.round(duration)}
            aria-valuemin={0}
            aria-valuenow={Math.round(time)}
            aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}, ${current?.title ?? ""}`}
            className="relative h-14 cursor-pointer touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-zinc-950"
            onKeyDown={handleKeyDown}
            onLostPointerCapture={endScrub}
            onPointerCancel={endScrub}
            onPointerDown={handlePointerDown}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse" && !scrubbing) {
                setHover(null);
              }
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={endScrub}
            ref={waveRef}
            role="slider"
            tabIndex={0}
          >
            <div className="absolute inset-0 text-zinc-200 dark:text-zinc-800">
              <Bars peaks={peaks} />
            </div>
            {/* Where a click would land, ahead of the playhead. */}
            <div
              aria-hidden
              className={cn(
                "absolute inset-0 text-zinc-400 transition-opacity duration-150 ease-out dark:text-zinc-600",
                showTip ? "opacity-100" : "opacity-0"
              )}
              style={{ clipPath: `inset(0 ${100 - (hoverPct ?? 0)}% 0 0)` }}
            >
              <Bars peaks={peaks} />
            </div>
            {/* Played: the same bars, clipped, so a bar fills part-way. */}
            <div
              aria-hidden
              className="absolute inset-0 text-zinc-900 dark:text-zinc-100"
              style={{ clipPath: `inset(0 ${100 - progress}% 0 0)` }}
            >
              <Bars peaks={peaks} />
            </div>
          </div>

          {/* Chapters as segments under the waveform. */}
          <div aria-hidden className="mt-2 flex h-1 gap-[3px]">
            {chapters.map((c, i) => {
              const end = chapters[i + 1]?.start ?? duration;
              return (
                <span
                  className={cn(
                    "rounded-full transition-colors duration-200 ease-out",
                    i === chapter
                      ? "bg-zinc-900 dark:bg-zinc-100"
                      : "bg-zinc-200 dark:bg-zinc-800"
                  )}
                  key={c.start}
                  style={{ flexGrow: end - c.start, flexBasis: 0 }}
                />
              );
            })}
          </div>
        </div>

        <div className="mt-2 flex justify-between text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          <span>{formatTime(time)}</span>
          <span>-{formatTime(duration - time)}</span>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center">
          <button
            aria-label={`Playback speed ${rate}x`}
            className="h-8 w-14 justify-self-start rounded-full border border-zinc-200 font-medium text-xs tabular-nums outline-none transition-colors duration-150 ease-out hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-800 dark:hover:bg-zinc-900"
            onClick={() => setSpeedIndex((i) => (i + 1) % SPEEDS.length)}
            type="button"
          >
            <Roll direction={speedDirection} id={rate}>
              {`${rate}×`}
            </Roll>
          </button>

          <div className="flex items-center gap-1">
            <button
              aria-label="Back 15 seconds"
              className={iconButton}
              onClick={() => seek(time - 15)}
              type="button"
            >
              <RotateCcw aria-hidden className="size-[18px]" />
            </button>
            <button
              aria-label={playing ? "Pause" : "Play"}
              className="relative flex size-11 items-center justify-center rounded-full bg-zinc-900 text-white outline-none transition-colors duration-150 ease-out hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:focus-visible:ring-offset-zinc-950 dark:hover:bg-zinc-300"
              onClick={toggle}
              type="button"
            >
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, filter: "blur(3px)" }}
                  initial={{ opacity: 0, filter: "blur(3px)" }}
                  key={playing ? "pause" : "play"}
                  transition={{ duration: 0.15, ease: EASE_OUT }}
                >
                  {playing ? (
                    <Pause aria-hidden className="size-5" fill="currentColor" />
                  ) : (
                    <Play
                      aria-hidden
                      className="size-5 translate-x-px"
                      fill="currentColor"
                    />
                  )}
                </motion.span>
              </AnimatePresence>
            </button>
            <button
              aria-label="Forward 30 seconds"
              className={iconButton}
              onClick={() => seek(time + 30)}
              type="button"
            >
              <RotateCw aria-hidden className="size-[18px]" />
            </button>
          </div>

          <span className="justify-self-end text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
            {chapter + 1} of {chapters.length}
          </span>
        </div>
      </div>
    </MotionConfig>
  );
}
