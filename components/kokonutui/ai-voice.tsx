"use client";

/**
 * @author: @kokonutui
 * @description: AI Voice
 * @version: 2.1.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ArrowUp, Mic, Pause, Play, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Mode = "idle" | "recording" | "review";

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
const EDGE_MASK =
  "linear-gradient(to right, transparent, black 18%, black 92%, transparent)";

/**
 * Speech-like level without a microphone: syllables at about 4-5 per second,
 * grouped into words and phrases with pauses between them.
 */
function createVoiceSimulator() {
  let speaking = false;
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

/** Squeezes a whole take into BAR_COUNT bars, keeping each slice's peak. */
function condense(take: number[]) {
  if (take.length === 0) {
    return STILL_LEVELS.slice(0, BAR_COUNT);
  }
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    const from = Math.floor((i / BAR_COUNT) * take.length);
    const to = Math.max(
      from + 1,
      Math.floor(((i + 1) / BAR_COUNT) * take.length)
    );
    return Math.max(REST_LEVEL, ...take.slice(from, to));
  });
}

const formatTime = (seconds: number) => {
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const setScales = (
  bars: (HTMLSpanElement | null)[],
  levels: readonly number[]
) => {
  bars.forEach((bar, i) => {
    if (bar) {
      bar.style.transform = `scaleY(${(levels[i] ?? REST_LEVEL).toFixed(3)})`;
    }
  });
};

type Face = "mic" | "stop" | "play" | "pause";

const mainLabelFor = (mode: Mode, playing: boolean) => {
  if (mode === "recording") {
    return "Stop recording";
  }
  if (mode === "review") {
    return playing ? "Pause playback" : "Play recording";
  }
  return "Start recording";
};

const timerText = (
  mode: Mode,
  seconds: number,
  duration: number,
  playing: boolean,
  playhead: number
) => {
  if (mode === "review") {
    return formatTime(playing || playhead > 0 ? playhead : duration);
  }
  return formatTime(mode === "recording" ? seconds : 0);
};

const FACE_CLASS =
  "absolute transition-[opacity,filter,scale] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity";
const faceState = (visible: boolean) =>
  visible ? "scale-100 opacity-100 blur-0" : "scale-50 opacity-0 blur-[3px]";

/**
 * Mic, stop, play and pause stay mounted and crossfade with a little blur,
 * so every swap reads as one control changing state.
 */
function ButtonFaces({ visible }: { visible: Record<Face, boolean> }) {
  const icon = "h-6 w-6 text-black/90 dark:text-white/90";
  return (
    <>
      <Mic
        aria-hidden="true"
        className={cn(FACE_CLASS, icon, faceState(visible.mic))}
      />
      <span
        aria-hidden="true"
        className={cn(
          FACE_CLASS,
          "h-5 w-5 rounded-[5px] bg-black dark:bg-white",
          faceState(visible.stop)
        )}
      />
      <Play
        aria-hidden="true"
        className={cn(
          FACE_CLASS,
          icon,
          "fill-current",
          faceState(visible.play)
        )}
      />
      <Pause
        aria-hidden="true"
        className={cn(
          FACE_CLASS,
          icon,
          "fill-current",
          faceState(visible.pause)
        )}
      />
    </>
  );
}

const ACTION_FOCUS =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/30";

function ReviewActions({
  onDiscard,
  onSend,
}: {
  onDiscard: () => void;
  onSend: () => void;
}) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      className="flex items-center gap-1"
      exit={{ opacity: 0, filter: "blur(2px)" }}
      initial={{ opacity: 0, y: 4, filter: "blur(2px)" }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
    >
      <button
        className={cn(
          "flex h-7 items-center gap-1 rounded-lg px-2 text-black/60 text-xs transition-colors duration-150 hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white",
          ACTION_FOCUS
        )}
        onClick={onDiscard}
        type="button"
      >
        <X aria-hidden="true" className="size-3.5" />
        Discard
      </button>
      <button
        className={cn(
          "flex h-7 items-center gap-1 rounded-lg bg-black px-2.5 text-white text-xs transition-colors duration-150 hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80",
          ACTION_FOCUS
        )}
        onClick={onSend}
        type="button"
      >
        Send
        <ArrowUp aria-hidden="true" className="size-3.5" />
      </button>
    </motion.div>
  );
}

interface AIVoiceProps {
  className?: string;
  /** Plays a record, review and send loop until the first click. */
  demo?: boolean;
  /**
   * Live input level from 0 to 1, e.g. from your own audio analyser. When
   * omitted, the waveform plays a simulated voice.
   */
  level?: number;
  /** Called with the new state when the user starts or stops recording. */
  onListeningChange?: (listening: boolean) => void;
  /** Called with the take's length in seconds when recording stops. */
  onStop?: (duration: number) => void;
  /** Called when the user sends the reviewed take. */
  onSend?: (duration: number) => void;
  /** Called when the user throws the take away. */
  onDiscard?: () => void;
}

export default function AI_Voice({
  className,
  demo = true,
  level,
  onListeningChange,
  onStop,
  onSend,
  onDiscard,
}: AIVoiceProps) {
  const [mode, setMode] = useState<Mode>("idle");
  const [isDemo, setIsDemo] = useState(demo);
  const [seconds, setSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLButtonElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const playedRef = useRef<HTMLDivElement>(null);
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const playedBarRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const takeRef = useRef<number[]>([]);
  const startedAtRef = useRef(0);
  const levelRef = useRef(level);
  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  const recording = mode === "recording";
  const reviewing = mode === "review";
  // The demo loop is not the user recording, so assistive tech only hears
  // about real actions.
  const announce = !isDemo;

  // Recording: one rAF loop writes transforms straight to the bars and the
  // ring, so a frame never re-renders React. It pauses offscreen.
  useEffect(() => {
    const bars = barRefs.current;
    const row = rowRef.current;
    const ring = ringRef.current;
    const root = rootRef.current;
    if (!(recording && row && ring && root)) {
      return;
    }
    takeRef.current = [];

    if (shouldReduceMotion) {
      setScales(bars, STILL_LEVELS);
      takeRef.current = STILL_LEVELS.slice();
      return;
    }

    const simulate = createVoiceSimulator();
    const samples = BAR_IDS.map(() => REST_LEVEL);
    let phase = 0;
    let smooth = 0;
    let last = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      // Clamped so a backgrounded tab doesn't fast-forward on return.
      const dt = Math.min(now - last, 100);
      last = now;
      phase += dt / SAMPLE_MS;
      while (phase >= 1) {
        phase -= 1;
        const live = levelRef.current;
        const sample =
          live === undefined
            ? simulate(now)
            : Math.max(REST_LEVEL, Math.min(1, live));
        samples.shift();
        samples.push(sample);
        takeRef.current.push(sample);
      }
      row.style.transform = `translateX(${(-phase * BAR_PITCH).toFixed(2)}px)`;
      setScales(bars, samples);
      // The ring behind the button swells with the voice, smoothed so it
      // breathes rather than flickers.
      const latest = samples.at(-1) ?? REST_LEVEL;
      smooth += (latest - smooth) * 0.18;
      const lift = Math.max(0, smooth - REST_LEVEL);
      ring.style.transform = `scale(${(1 + lift * 0.22).toFixed(3)})`;
      ring.style.opacity = (0.4 + lift * 0.8).toFixed(3);
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      cancelAnimationFrame(frame);
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
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
      ring.style.transform = "scale(1)";
      ring.style.opacity = "0";
    };
  }, [recording, shouldReduceMotion]);

  // Review shows the whole take squeezed into the row; idle lays it flat.
  // The bars carry a CSS transition outside recording, so both glide.
  useEffect(() => {
    const row = rowRef.current;
    if (recording || !row) {
      return;
    }
    row.style.transform = "translateX(0px)";
    const levels = reviewing
      ? condense(takeRef.current)
      : BAR_IDS.map(() => REST_LEVEL);
    setScales(barRefs.current, levels);
    setScales(playedBarRefs.current, levels);
  }, [recording, reviewing]);

  // Recording timer.
  useEffect(() => {
    if (!recording) {
      return;
    }
    setSeconds(0);
    startedAtRef.current = Date.now();
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [recording]);

  // Playback: a playhead sweeps the take. There is no audio; it shows where
  // your own player is, or just previews the take in the demo.
  useEffect(() => {
    const played = playedRef.current;
    if (!(playing && played)) {
      return;
    }
    const length = Math.max(duration, 1) * 1000;
    const startedAt = performance.now();
    let frame = 0;
    let shownSecond = -1;
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / length, 1);
      played.style.clipPath = `inset(0 ${((1 - progress) * 100).toFixed(2)}% 0 0)`;
      // The clip moves every frame; React only hears about it when the
      // timer's second changes.
      const position = progress * Math.max(duration, 1);
      if (Math.floor(position) !== shownSecond || progress >= 1) {
        shownSecond = Math.floor(position);
        setPlayhead(Math.max(position, Number.EPSILON));
      }
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setPlaying(false);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration]);

  // The demo loop calls these with notify = false, so the parent's callbacks
  // only hear about what the user did.
  const startRecording = (notify = true) => {
    setPlaying(false);
    setMode("recording");
    if (notify) {
      onListeningChange?.(true);
    }
  };

  const stopRecording = (notify = true) => {
    const taken = Math.max(
      (Date.now() - startedAtRef.current) / 1000,
      takeRef.current.length * (SAMPLE_MS / 1000)
    );
    setDuration(taken);
    setPlayhead(0);
    if (playedRef.current) {
      playedRef.current.style.clipPath = "inset(0 100% 0 0)";
    }
    setMode("review");
    if (notify) {
      onListeningChange?.(false);
      onStop?.(taken);
    }
  };

  const finish = (sent: boolean, notify = true) => {
    setPlaying(false);
    setMode("idle");
    if (!notify) {
      return;
    }
    // Send and Discard leave with the review row, so focus goes back to the
    // record button instead of dropping to the page.
    mainRef.current?.focus();
    if (sent) {
      onSend?.(duration);
    } else {
      onDiscard?.();
    }
  };

  const togglePlay = () => {
    if (!playing && playedRef.current) {
      playedRef.current.style.clipPath = "inset(0 100% 0 0)";
    }
    setPlaying((p) => !p);
  };

  // Demo: record, review with a playback sweep, send, rest. Ends on the
  // first press anywhere in the component.
  const hasPlayed = playhead > 0;
  const demoStepRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    demoStepRef.current = () => {
      if (mode === "idle") {
        startRecording(false);
      } else if (mode === "recording") {
        stopRecording(false);
      } else if (hasPlayed) {
        finish(true, false);
      } else {
        togglePlay();
      }
    };
  });
  useEffect(() => {
    if (!isDemo || playing) {
      return;
    }
    const delays: Record<Mode, number> = {
      idle: 1200,
      recording: 3400,
      review: hasPlayed ? 900 : 500,
    };
    const id = setTimeout(() => demoStepRef.current(), delays[mode]);
    return () => clearTimeout(id);
  }, [isDemo, mode, hasPlayed, playing]);

  const endDemo = () => {
    if (isDemo) {
      setIsDemo(false);
      setPlaying(false);
      setMode("idle");
    }
  };

  const handleMainClick = () => {
    if (isDemo) {
      endDemo();
      startRecording();
    } else if (recording) {
      stopRecording();
    } else if (reviewing) {
      togglePlay();
    } else {
      startRecording();
    }
  };

  const faces: Record<Face, boolean> = {
    mic: mode === "idle",
    stop: recording,
    play: reviewing && !playing,
    pause: reviewing && playing,
  };
  const timerValue = timerText(mode, seconds, duration, playing, playhead);

  return (
    <div
      className={cn("w-full py-4", className)}
      onPointerDownCapture={endDemo}
      ref={rootRef}
    >
      <div className="relative mx-auto flex w-full max-w-xl flex-col items-center gap-2">
        <div className="relative">
          {/* Swells with the voice while recording. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-xl bg-black/5 opacity-0 dark:bg-white/5"
            ref={ringRef}
          />
          <button
            aria-label={mainLabelFor(mode, playing)}
            aria-pressed={recording && announce}
            className={cn(
              "relative flex h-16 w-16 items-center justify-center rounded-xl transition-colors duration-150 ease-out",
              "outline-hidden focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/30",
              mode === "idle"
                ? "hover:bg-black/5 dark:hover:bg-white/5"
                : "bg-black/5 dark:bg-white/5"
            )}
            onClick={handleMainClick}
            ref={mainRef}
            type="button"
          >
            <ButtonFaces visible={faces} />
          </button>
        </div>

        <span
          className={cn(
            "relative font-mono text-sm tabular-nums transition-colors duration-300",
            mode === "idle"
              ? "text-black/30 dark:text-white/30"
              : "text-black/70 dark:text-white/70"
          )}
        >
          {/* A steady red dot, like a recorder's REC lamp. Sits outside the
              text so the timer stays centred. */}
          <span
            aria-hidden="true"
            className={cn(
              "absolute top-1/2 right-full mr-2 size-1.5 -translate-y-1/2 rounded-full bg-red-500 transition-opacity duration-150",
              recording ? "opacity-100" : "opacity-0"
            )}
          />
          {timerValue}
        </span>

        {/* While recording, the newest sound enters on the right and the
            edges fade. In review the whole take sits still and a darker
            copy, clipped at the playhead, shows what has played. */}
        <div
          aria-hidden="true"
          className="relative h-8 w-60 overflow-hidden"
          style={{
            maskImage: recording ? EDGE_MASK : undefined,
            WebkitMaskImage: recording ? EDGE_MASK : undefined,
          }}
        >
          <div className="flex h-full items-center gap-[2px]" ref={rowRef}>
            {BAR_IDS.map((id, i) => (
              <span
                className={cn(
                  "h-full w-[3px] shrink-0 rounded-full",
                  recording
                    ? "bg-black/60 dark:bg-white/60"
                    : "bg-black/15 transition-transform duration-500 motion-reduce:transition-none dark:bg-white/15"
                )}
                key={id}
                ref={(el) => {
                  barRefs.current[i] = el;
                }}
                style={{
                  transform: `scaleY(${REST_LEVEL})`,
                  // Out of recording the bars settle right to left.
                  transitionDelay: recording
                    ? undefined
                    : `${(BAR_COUNT - i) * 6}ms`,
                  transitionTimingFunction: EASE_OUT,
                }}
              />
            ))}
          </div>
          <div
            className={cn(
              "absolute inset-0 flex items-center gap-[2px] transition-opacity duration-200",
              reviewing ? "opacity-100" : "opacity-0"
            )}
            ref={playedRef}
            style={{ clipPath: "inset(0 100% 0 0)" }}
          >
            {BAR_IDS.map((id, i) => (
              <span
                className="h-full w-[3px] shrink-0 rounded-full bg-black/70 dark:bg-white/70"
                key={id}
                ref={(el) => {
                  playedBarRefs.current[i] = el;
                }}
                style={{ transform: `scaleY(${REST_LEVEL})` }}
              />
            ))}
          </div>
        </div>

        <div className="relative flex h-7 items-center justify-center">
          <AnimatePresence initial={false} mode="popLayout">
            {reviewing ? (
              <ReviewActions
                key="actions"
                onDiscard={() => finish(false)}
                onSend={() => finish(true)}
              />
            ) : (
              <motion.span
                animate={{ opacity: 1, filter: "blur(0px)" }}
                className="text-black/70 text-xs dark:text-white/70"
                exit={{ opacity: 0, filter: "blur(2px)" }}
                initial={{ opacity: 0, filter: "blur(2px)" }}
                key="caption"
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              >
                {recording ? "Listening..." : "Click to speak"}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* <output> has the implicit role="status". It stays silent during
            the demo loop. */}
        <output aria-live={announce ? "polite" : "off"} className="sr-only">
          {announce && recording ? "Recording" : ""}
          {announce && reviewing ? "Recording ready to send" : ""}
        </output>
      </div>
    </div>
  );
}
