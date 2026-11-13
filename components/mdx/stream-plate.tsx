"use client";

import { type ReactNode, useEffect, useState } from "react";
import {
  CELL,
  EASE_COLORS,
  FOCUS,
  LINE,
  META,
} from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";

type Run = "ok" | "error";

/**
 * Steps through a scripted stream, one frame every `stepMs`: what an app
 * would hold in state as parts arrive. Starts on mount; `play` restarts it,
 * on the happy path or the one where something fails.
 */
export function useScript<T>(
  scripts: Record<Run, T[]>,
  stepMs = 700
): { frame: T; play: (run: Run) => void; run: Run; key: number } {
  const [run, setRun] = useState<Run>("ok");
  const [step, setStep] = useState(0);
  const [key, setKey] = useState(0);
  const frames = scripts[run];

  useEffect(() => {
    if (step >= frames.length - 1) {
      return;
    }
    const next = setTimeout(() => setStep((s) => s + 1), stepMs);
    return () => clearTimeout(next);
  }, [step, frames.length, stepMs]);

  const play = (next: Run) => {
    setRun(next);
    setStep(0);
    setKey((k) => k + 1);
  };

  return { frame: frames[Math.min(step, frames.length - 1)], play, run, key };
}

/**
 * The frame for a component driven from props, as it would be in an app:
 * a fake stream feeds it, with a way to replay it with an error.
 */
export function StreamPlate({
  children,
  run,
  play,
  label = "Driven by a scripted stream",
}: {
  children: ReactNode;
  run: Run;
  play: (run: Run) => void;
  label?: string;
}) {
  const button = (target: Run, text: string) => (
    <button
      aria-pressed={run === target}
      className={cn(
        META,
        "rounded-[5px] px-1.5 py-0.5 hover:text-black aria-pressed:bg-black/[0.05] aria-pressed:text-black dark:aria-pressed:bg-white/[0.08] dark:aria-pressed:text-white dark:hover:text-white",
        EASE_COLORS,
        FOCUS
      )}
      onClick={() => play(target)}
      type="button"
    >
      {text}
    </button>
  );

  return (
    <figure className={cn("not-prose my-6 w-full border", LINE, CELL)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-3.5">
        <span className={cn(META, "truncate")}>{label}</span>
        <span className="flex gap-1">
          {button("ok", "Play")}
          {button("error", "Play with an error")}
        </span>
      </div>
      <div className="flex min-h-[340px] items-center justify-center p-4 md:p-8">
        {children}
      </div>
    </figure>
  );
}
