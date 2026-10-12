"use client";

/**
 * @author: @kokonutui
 * @description: AI Voice
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Mic } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const BAR_COUNT = 48;
const BAR_IDS = Array.from({ length: BAR_COUNT }, (_, i) => `bar-${i}`);

// Bar heights in percent. Random levels are only created in effects, never
// during render, so the server and client markup match.
const INITIAL_LEVELS = BAR_IDS.map(() => 20);
const createLevels = () => BAR_IDS.map(() => 20 + Math.random() * 80);

interface AIVoiceProps {
  className?: string;
  /** Plays a fake listening loop until the first click. */
  demo?: boolean;
  /** Called with the new state when the user starts or stops listening. */
  onListeningChange?: (listening: boolean) => void;
}

export default function AI_Voice({
  className,
  demo = true,
  onListeningChange,
}: AIVoiceProps) {
  const [submitted, setSubmitted] = useState(false);
  const [time, setTime] = useState(0);
  const [levels, setLevels] = useState(INITIAL_LEVELS);
  const [isDemo, setIsDemo] = useState(demo);
  // The demo loop is not the user listening, so assistive tech only hears
  // about real listening.
  const isListening = submitted && !isDemo;

  useEffect(() => {
    if (!submitted) {
      setTime(0);
      return;
    }

    setLevels(createLevels());
    const intervalId = setInterval(() => {
      setTime((t) => t + 1);
      setLevels(createLevels());
    }, 1000);

    return () => clearInterval(intervalId);
  }, [submitted]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  /**
   * Remove that, only used for demo
   */
  useEffect(() => {
    if (!isDemo) return;

    let timeoutId: NodeJS.Timeout;
    const runAnimation = () => {
      setSubmitted(true);
      timeoutId = setTimeout(() => {
        setSubmitted(false);
        timeoutId = setTimeout(runAnimation, 1000);
      }, 3000);
    };

    const initialTimeout = setTimeout(runAnimation, 100);
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(initialTimeout);
    };
  }, [isDemo]);

  const handleClick = () => {
    // The first click ends the demo loop and starts listening right away.
    const next = isDemo || !submitted;
    setIsDemo(false);
    setSubmitted(next);
    if (next) {
      setTime(0);
    }
    onListeningChange?.(next);
  };

  return (
    <div className={cn("w-full py-4", className)}>
      <div className="relative mx-auto flex w-full max-w-xl flex-col items-center gap-2">
        <button
          aria-label={isListening ? "Stop listening" : "Start listening"}
          aria-pressed={isListening}
          className={cn(
            "group flex h-16 w-16 items-center justify-center rounded-xl transition-colors",
            submitted
              ? "bg-none"
              : "bg-none hover:bg-black/5 dark:hover:bg-white/5"
          )}
          onClick={handleClick}
          type="button"
        >
          {submitted ? (
            <div
              className="pointer-events-auto h-6 w-6 animate-spin cursor-pointer rounded-sm bg-black dark:bg-white"
              style={{ animationDuration: "3s" }}
            />
          ) : (
            <Mic className="h-6 w-6 text-black/90 dark:text-white/90" />
          )}
        </button>

        <span
          className={cn(
            "font-mono text-sm transition-opacity duration-300",
            submitted
              ? "text-black/70 dark:text-white/70"
              : "text-black/30 dark:text-white/30"
          )}
        >
          {formatTime(time)}
        </span>

        <div className="flex h-4 w-64 items-center justify-center gap-0.5">
          {BAR_IDS.map((id, i) => (
            <div
              className={cn(
                "w-0.5 rounded-full transition-[height,background-color] duration-300 motion-reduce:transition-none",
                submitted
                  ? "animate-pulse bg-black/50 motion-reduce:animate-none dark:bg-white/50"
                  : "h-1 bg-black/10 dark:bg-white/10"
              )}
              key={id}
              style={
                submitted
                  ? {
                      height: `${levels[i]}%`,
                      animationDelay: `${i * 0.05}s`,
                    }
                  : undefined
              }
            />
          ))}
        </div>

        {/* <output> has the implicit role="status". It stays silent while the
            demo loop toggles the caption every few seconds. */}
        <output
          aria-live={isDemo ? "off" : "polite"}
          className="h-4 text-black/70 text-xs dark:text-white/70"
        >
          {submitted ? "Listening..." : "Click to speak"}
        </output>
      </div>
    </div>
  );
}
