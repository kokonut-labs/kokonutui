"use client";

/**
 * @author: @kokonutui
 * @description: AI Voice
 * @version: 2.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Mic } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const BAR_COUNT = 48;
// One extra bar waits off the right edge, so the row can slide a full bar
// before the samples shift and nothing pops in.
const BAR_IDS = Array.from({ length: BAR_COUNT + 1 }, (_, i) => `bar-${i}`);
const BAR_PITCH = 5; // bar width + gap, px
// A new sample enters on the right this often, so the history scrolls at
// BAR_PITCH / SAMPLE_MS px per ms.
const SAMPLE_MS = 70;
const REST_LEVEL = 0.12;
// Shape shown under reduced motion: still bars, no scrolling.
const STILL_LEVELS = BAR_IDS.map(
  (_, i) => 0.25 + 0.5 * Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.21))
);
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

/**
 * Speech-like level without a microphone: syllables at about 4-5 per second,
 * grouped into words and phrases with pauses between them.
 */
function createVoiceSimulator() {
  let speaking = true;
  let switchAt = 0;
  let gate = 0;
  return (time: number) => {
    if (time >= switchAt) {
      speaking = !speaking;
      switchAt =
        time +
        (speaking ? 700 + Math.random() * 1600 : 180 + Math.random() * 500);
    }
    // The gate eases in and out, so words swell and fade instead of cutting.
    gate += ((speaking ? 1 : 0) - gate) * 0.35;
    const t = time / 1000;
    const syllable = Math.abs(
      Math.sin(t * Math.PI * 4.4 + Math.sin(t * 1.7) * 2)
    );
    const grain = 0.65 + Math.random() * 0.35;
    return REST_LEVEL + gate * syllable * grain * (1 - REST_LEVEL);
  };
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

interface AIVoiceProps {
  className?: string;
  /** Plays a listening loop until the first click. */
  demo?: boolean;
  /**
   * Live input level from 0 to 1, e.g. from your own audio analyser. When
   * omitted, the waveform plays a simulated voice.
   */
  level?: number;
  /** Called with the new state when the user starts or stops listening. */
  onListeningChange?: (listening: boolean) => void;
  /** Called with the recording length in seconds when the user stops. */
  onStop?: (duration: number) => void;
}

export default function AI_Voice({
  className,
  demo = true,
  level,
  onListeningChange,
  onStop,
}: AIVoiceProps) {
  const [listening, setListening] = useState(false);
  const [isDemo, setIsDemo] = useState(demo);
  const [seconds, setSeconds] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const levelRef = useRef(level);
  useEffect(() => {
    levelRef.current = level;
  }, [level]);
  // The demo loop is not the user listening, so assistive tech only hears
  // about real listening.
  const isUserListening = listening && !isDemo;

  // Waveform: one rAF loop writes transforms straight to the bars, so a
  // frame never re-renders React. It pauses while the card is offscreen.
  useEffect(() => {
    const bars = barRefs.current;
    const row = rowRef.current;
    const root = rootRef.current;
    if (!(row && root)) {
      return;
    }

    if (!listening) {
      row.style.transform = "translateX(0px)";
      for (const bar of bars) {
        if (bar) {
          bar.style.transform = `scaleY(${REST_LEVEL})`;
        }
      }
      return;
    }

    if (shouldReduceMotion) {
      bars.forEach((bar, i) => {
        if (bar) {
          bar.style.transform = `scaleY(${STILL_LEVELS[i]})`;
        }
      });
      return;
    }

    const simulate = createVoiceSimulator();
    const samples = BAR_IDS.map(() => REST_LEVEL);
    let phase = 0;
    let last = performance.now();
    let frame = 0;
    let visible = true;

    const tick = (now: number) => {
      // Clamped so a backgrounded tab doesn't fast-forward on return.
      const dt = Math.min(now - last, 100);
      last = now;
      phase += dt / SAMPLE_MS;
      while (phase >= 1) {
        phase -= 1;
        samples.shift();
        const live = levelRef.current;
        samples.push(
          live === undefined
            ? simulate(now)
            : Math.max(REST_LEVEL, Math.min(1, live))
        );
      }
      row.style.transform = `translateX(${(-phase * BAR_PITCH).toFixed(2)}px)`;
      samples.forEach((sample, i) => {
        const bar = bars[i];
        if (bar) {
          bar.style.transform = `scaleY(${sample.toFixed(3)})`;
        }
      });
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      cancelAnimationFrame(frame);
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        start();
      } else {
        cancelAnimationFrame(frame);
      }
    });
    observer.observe(root);
    start();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [listening, shouldReduceMotion]);

  // Timer: counts whole seconds while listening.
  useEffect(() => {
    if (!listening) {
      return;
    }
    setSeconds(0);
    const startedAt = Date.now();
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [listening]);

  // Demo: listen for 3s, rest for 1.2s, until the first click.
  useEffect(() => {
    if (!isDemo) {
      return;
    }
    let id: ReturnType<typeof setTimeout>;
    const run = (next: boolean) => {
      setListening(next);
      id = setTimeout(() => run(!next), next ? 3000 : 1200);
    };
    id = setTimeout(() => run(true), 300);
    return () => clearTimeout(id);
  }, [isDemo]);

  const handleClick = () => {
    // The first click ends the demo loop and starts listening right away.
    const next = isDemo || !listening;
    if (!(next || isDemo)) {
      onStop?.(seconds);
    }
    setIsDemo(false);
    setListening(next);
    onListeningChange?.(next);
  };

  return (
    <div className={cn("w-full py-4", className)} ref={rootRef}>
      <div className="relative mx-auto flex w-full max-w-xl flex-col items-center gap-2">
        <button
          aria-label={isUserListening ? "Stop listening" : "Start listening"}
          aria-pressed={isUserListening}
          className={cn(
            "relative flex h-16 w-16 items-center justify-center rounded-xl transition-colors duration-150 ease-out",
            "outline-hidden focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/30",
            listening
              ? "bg-black/5 dark:bg-white/5"
              : "hover:bg-black/5 dark:hover:bg-white/5"
          )}
          onClick={handleClick}
          type="button"
        >
          {/* Both icons stay mounted and crossfade with a little blur, so
              the swap reads as one control changing state. */}
          <Mic
            aria-hidden="true"
            className={cn(
              "absolute h-6 w-6 text-black/90 transition-[opacity,filter,scale] duration-200 dark:text-white/90",
              listening
                ? "scale-50 opacity-0 blur-[3px]"
                : "scale-100 opacity-100 blur-0"
            )}
            style={{ transitionTimingFunction: EASE_OUT }}
          />
          <span
            aria-hidden="true"
            className={cn(
              "absolute h-5 w-5 rounded-[5px] bg-black transition-[opacity,filter,scale] duration-200 dark:bg-white",
              listening
                ? "scale-100 opacity-100 blur-0"
                : "scale-50 opacity-0 blur-[3px]"
            )}
            style={{ transitionTimingFunction: EASE_OUT }}
          />
        </button>

        <span
          className={cn(
            "font-mono text-sm tabular-nums transition-colors duration-300",
            listening
              ? "text-black/70 dark:text-white/70"
              : "text-black/30 dark:text-white/30"
          )}
        >
          {formatTime(listening ? seconds : 0)}
        </span>

        {/* Newest sound enters on the right and scrolls left; the edges fade
            so bars arrive and leave softly. */}
        <div
          aria-hidden="true"
          className="h-8 w-60 overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, black 18%, black 92%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 18%, black 92%, transparent)",
          }}
        >
          <div className="flex h-full items-center gap-[2px]" ref={rowRef}>
            {BAR_IDS.map((id, i) => (
              <span
                className={cn(
                  "h-full w-[3px] shrink-0 rounded-full",
                  listening
                    ? "bg-black/60 dark:bg-white/60"
                    : "bg-black/15 transition-transform duration-500 dark:bg-white/15"
                )}
                key={id}
                ref={(el) => {
                  barRefs.current[i] = el;
                }}
                style={{
                  transform: `scaleY(${REST_LEVEL})`,
                  // When listening stops, the bars settle right to left.
                  transitionDelay: listening
                    ? undefined
                    : `${(BAR_COUNT - i) * 6}ms`,
                  transitionTimingFunction: EASE_OUT,
                }}
              />
            ))}
          </div>
        </div>

        {/* <output> has the implicit role="status". It stays silent while the
            demo loop toggles the caption every few seconds. */}
        <output
          aria-live={isDemo ? "off" : "polite"}
          className="h-4 text-black/70 text-xs dark:text-white/70"
        >
          {listening ? "Listening..." : "Click to speak"}
        </output>
      </div>
    </div>
  );
}
