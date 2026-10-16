"use client";

/**
 * @author: @dorianbaffier
 * @description: Synced Transcript
 * @version: 1.0.0
 * @date: 2026-10-16
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ArrowDown, ArrowUp, Pause, Play } from "lucide-react";
import {
  type KeyboardEvent,
  type MouseEvent,
  memo,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const SPEEDS = [1, 1.5, 2];
const WHITESPACE = /\s+/;

export interface TranscriptSegment {
  speaker: string;
  /** Seconds from the start. */
  start: number;
  end: number;
  text: string;
}

export interface SyncedTranscriptProps {
  title?: string;
  segments?: TranscriptSegment[];
  /** Seconds. Defaults to the end of the last segment. Playback is simulated; drive it from your own audio with `onTimeChange`. */
  duration?: number;
  onTimeChange?: (seconds: number) => void;
  className?: string;
}

interface Word {
  text: string;
  start: number;
  /** Index across the whole transcript. */
  index: number;
}

// Times each segment from its word count, with a breath between speakers.
function timed(lines: [string, string][]): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  let t = 0.6;
  for (const [speaker, text] of lines) {
    const words = text.split(WHITESPACE).length;
    const end = t + words / 2.7;
    out.push({ speaker, start: t, end, text });
    t = end + 0.7;
  }
  return out;
}

const DEFAULT_SEGMENTS = timed([
  [
    "Maya",
    "Welcome back. Today we're talking about the small details in interfaces, the ones nobody notices until they're missing.",
  ],
  [
    "Theo",
    "Right. Like a menu that opens in a hundred and fifty milliseconds instead of four hundred. You never think about it, but the slow one feels broken.",
  ],
  ["Maya", "So where do you start when something feels off?"],
  [
    "Theo",
    "I slow it down. I record the screen and step through it frame by frame. Most of the time the easing is wrong, or two things move that should move as one.",
  ],
  ["Maya", "And when it finally feels right?"],
  [
    "Theo",
    "Then I stop touching it. The best motion is the kind you only miss when it's gone.",
  ],
]);

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Spreads a segment's time over its words by length, so long words last longer.
function splitWords(segments: TranscriptSegment[]) {
  let index = 0;
  return segments.map((segment) => {
    const parts = segment.text.split(WHITESPACE).filter(Boolean);
    const total = parts.reduce((sum, w) => sum + w.length + 1, 0);
    let t = segment.start;
    return parts.map((text) => {
      const word = { text, start: t, index };
      t += ((text.length + 1) / total) * (segment.end - segment.start);
      index += 1;
      return word;
    });
  });
}

// What each paragraph needs to know: all spoken, none yet, or which word.
// Past and future paragraphs get a constant, so they skip re-rendering.
function paragraphActive(segment: number, current: number, active: number) {
  if (segment < current) {
    return Number.MAX_SAFE_INTEGER;
  }
  return segment === current ? active : -1;
}

// Only the paragraph holding the spoken word re-renders as time moves.
const Paragraph = memo(function Paragraph({
  words,
  active,
}: {
  words: Word[];
  /** The spoken word's global index. */
  active: number;
}) {
  return (
    <>
      {words.map((word) => (
        <span
          className={cn(
            "transition-colors duration-150 ease-out",
            word.index <= active
              ? "text-zinc-900 dark:text-zinc-100"
              : "text-zinc-400 dark:text-zinc-500"
          )}
          data-index={word.index}
          key={word.index}
        >
          {word.text}{" "}
        </span>
      ))}
    </>
  );
});

export default function SyncedTranscript({
  title = "Frame Rate · Episode 48",
  segments = DEFAULT_SEGMENTS,
  duration: durationProp,
  onTimeChange,
  className,
}: SyncedTranscriptProps) {
  const duration = durationProp ?? Math.ceil((segments.at(-1)?.end ?? 0) + 0.6);
  const words = useMemo(() => splitWords(segments), [segments]);
  const flat = useMemo(() => words.flat(), [words]);

  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [following, setFollowing] = useState(true);
  // Where the spoken word is when the reader has scrolled away from it.
  const [away, setAway] = useState<"up" | "down" | null>(null);
  const timeRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const lastTop = useRef<number | null>(null);
  const rate = SPEEDS[speedIndex];

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

  useEffect(() => {
    onTimeChange?.(time);
  }, [time, onTimeChange]);

  const seek = useCallback(
    (seconds: number) => {
      const next = clamp(seconds, 0, duration);
      timeRef.current = next;
      setTime(next);
    },
    [duration]
  );

  // The last word that has started, or -1 before the first.
  let active = -1;
  for (const word of flat) {
    if (word.start <= time) {
      active = word.index;
    } else {
      break;
    }
  }
  const activeSegment = words.findIndex((ws) =>
    ws.some((w) => w.index === active)
  );

  const scrollToWord = useCallback((el: HTMLElement, smooth: boolean) => {
    const box = scrollRef.current;
    if (!box) {
      return;
    }
    // Keep the spoken line a third of the way down, like lyrics.
    const top =
      box.scrollTop +
      el.getBoundingClientRect().top -
      box.getBoundingClientRect().top -
      box.clientHeight / 3;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    box.scrollTo({ top, behavior: smooth && !reduce ? "smooth" : "auto" });
  }, []);

  // One highlight slides from word to word; it jumps, unanimated, to a new line.
  useLayoutEffect(() => {
    const mark = markRef.current;
    const el = contentRef.current?.querySelector<HTMLElement>(
      `[data-index="${active}"]`
    );
    if (!(mark && el)) {
      if (mark) {
        mark.style.opacity = "0";
      }
      lastTop.current = null;
      return;
    }
    const sameLine = lastTop.current === el.offsetTop;
    mark.style.transition = sameLine
      ? "transform 140ms cubic-bezier(0.23, 1, 0.32, 1), width 140ms cubic-bezier(0.23, 1, 0.32, 1), opacity 150ms ease-out"
      : "opacity 150ms ease-out";
    // The trailing space is part of the span; leave it out of the mark.
    const space = Number.parseFloat(getComputedStyle(el).fontSize) * 0.28;
    mark.style.transform = `translate(${el.offsetLeft - 3}px, ${el.offsetTop}px)`;
    mark.style.width = `${el.offsetWidth - space + 6}px`;
    mark.style.height = `${el.offsetHeight}px`;
    mark.style.opacity = "1";
    if (!sameLine && following) {
      scrollToWord(el, lastTop.current !== null);
    }
    lastTop.current = el.offsetTop;
  }, [active, following, scrollToWord]);

  // When the reader scrolls away, note which way the spoken word went.
  const checkAway = useCallback(() => {
    const box = scrollRef.current;
    const el = contentRef.current?.querySelector<HTMLElement>(
      `[data-index="${active}"]`
    );
    if (!(box && el) || following) {
      setAway(null);
      return;
    }
    const word = el.getBoundingClientRect();
    const view = box.getBoundingClientRect();
    if (word.bottom < view.top) {
      setAway("up");
    } else if (word.top > view.bottom) {
      setAway("down");
    } else {
      setAway(null);
    }
  }, [active, following]);

  useEffect(() => {
    checkAway();
  }, [checkAway]);

  const takeOver = () => setFollowing(false);

  const follow = () => {
    setFollowing(true);
    setAway(null);
    const el = contentRef.current?.querySelector<HTMLElement>(
      `[data-index="${active}"]`
    );
    if (el) {
      scrollToWord(el, true);
    }
  };

  const handleWordClick =
    (segment: TranscriptSegment) => (event: MouseEvent<HTMLButtonElement>) => {
      const target = (event.target as HTMLElement).closest("[data-index]");
      const index = Number(target?.getAttribute("data-index") ?? -1);
      // Keyboard presses have no word under them; start the paragraph.
      seek(index >= 0 ? (flat[index]?.start ?? segment.start) : segment.start);
      setFollowing(true);
    };

  const handleProgress = (event: PointerEvent<HTMLDivElement>) => {
    if (event.type === "pointerdown") {
      event.currentTarget.setPointerCapture(event.pointerId);
    } else if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    seek(((event.clientX - rect.left) / rect.width) * duration);
    setFollowing(true);
  };

  const handleProgressKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowLeft: -5,
      ArrowDown: -5,
      ArrowRight: 5,
      ArrowUp: 5,
      Home: -duration,
      End: duration,
    };
    if (event.key === " ") {
      event.preventDefault();
      setPlaying((p) => !p);
      return;
    }
    const move = moves[event.key];
    if (move !== undefined) {
      event.preventDefault();
      seek(time + move);
      setFollowing(true);
    }
  };

  const togglePlay = () => {
    if (!playing && timeRef.current >= duration) {
      seek(0);
    }
    setPlaying((p) => !p);
  };

  return (
    <div
      className={cn(
        "w-full max-w-md select-none rounded-3xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Transcript</p>
          <p className="truncate font-medium text-sm">{title}</p>
        </div>
        <button
          aria-label={`Playback speed ${rate}x`}
          className="h-7 shrink-0 rounded-full border border-zinc-200 px-2.5 font-medium text-xs tabular-nums outline-none transition-colors duration-150 ease-out hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-800 dark:hover:bg-zinc-900"
          onClick={() => setSpeedIndex((i) => (i + 1) % SPEEDS.length)}
          type="button"
        >
          {rate}×
        </button>
      </div>

      <div className="relative">
        <section
          aria-label="Transcript"
          className="h-72 overflow-y-auto px-5 py-6 outline-none [mask-image:linear-gradient(to_bottom,transparent,black_24px,black_calc(100%-24px),transparent)] focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
          onScroll={checkAway}
          onTouchMove={takeOver}
          onWheel={takeOver}
          ref={scrollRef}
        >
          <div className="relative isolate" ref={contentRef}>
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 left-0 -z-10 rounded-md bg-zinc-100 opacity-0 dark:bg-zinc-800/80"
              ref={markRef}
            />
            {segments.map((segment, i) => (
              <div
                className={cn(i > 0 && "mt-5")}
                key={`${segment.start}-${segment.speaker}`}
              >
                <div className="mb-1 flex items-center gap-2 text-xs">
                  <span
                    aria-hidden
                    className="flex size-5 items-center justify-center rounded-full bg-zinc-100 font-medium text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {segment.speaker.charAt(0)}
                  </span>
                  <span className="font-medium">{segment.speaker}</span>
                  <button
                    aria-label={`Play from ${formatTime(segment.start)}`}
                    className="rounded text-zinc-400 tabular-nums outline-none transition-colors duration-150 ease-out hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-500 dark:hover:text-zinc-100"
                    onClick={() => {
                      seek(segment.start);
                      setFollowing(true);
                    }}
                    type="button"
                  >
                    {formatTime(segment.start)}
                  </button>
                </div>
                <button
                  className="block cursor-pointer rounded-sm text-left text-[15px] leading-7 outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                  onClick={handleWordClick(segment)}
                  tabIndex={-1}
                  type="button"
                >
                  <Paragraph
                    active={paragraphActive(i, activeSegment, active)}
                    words={words[i]}
                  />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Back to the spoken word after scrolling away. */}
        <button
          className={cn(
            "absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1.5 font-medium text-white text-xs shadow-sm outline-none transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900",
            away
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-2 opacity-0"
          )}
          onClick={follow}
          tabIndex={away ? 0 : -1}
          type="button"
        >
          {away === "up" ? (
            <ArrowUp aria-hidden className="size-3.5" />
          ) : (
            <ArrowDown aria-hidden className="size-3.5" />
          )}
          Back to now
        </button>
      </div>

      <div className="flex items-center gap-3 border-zinc-200 border-t px-5 py-3 dark:border-zinc-800">
        <button
          aria-label={playing ? "Pause" : "Play"}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white outline-none transition-colors duration-150 ease-out hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:focus-visible:ring-offset-zinc-950 dark:hover:bg-zinc-300"
          onClick={togglePlay}
          type="button"
        >
          {playing ? (
            <Pause aria-hidden className="size-4" fill="currentColor" />
          ) : (
            <Play
              aria-hidden
              className="size-4 translate-x-px"
              fill="currentColor"
            />
          )}
        </button>
        <span className="w-9 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          {formatTime(time)}
        </span>
        <div
          aria-label="Seek"
          aria-valuemax={Math.round(duration)}
          aria-valuemin={0}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
          className="group relative flex h-6 flex-1 cursor-pointer touch-none items-center rounded outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          onKeyDown={handleProgressKey}
          onPointerDown={handleProgress}
          onPointerMove={handleProgress}
          role="slider"
          tabIndex={0}
        >
          <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full w-full origin-left rounded-full bg-zinc-900 dark:bg-zinc-100"
              style={{ transform: `scaleX(${time / duration})` }}
            />
          </div>
        </div>
        <span className="w-9 text-right text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
