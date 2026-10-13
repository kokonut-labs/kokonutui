"use client";

/**
 * @author: @kokonutui
 * @description: AI Loading State
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const TASK_SEQUENCES = [
  {
    status: "Searching the web",
    lines: [
      "Initializing web search...",
      "Scanning web pages...",
      "Visiting 5 websites...",
      "Analyzing content...",
      "Generating summary...",
    ],
  },
  {
    status: "Analyzing results",
    lines: [
      "Analyzing search results...",
      "Generating summary...",
      "Checking for relevant information...",
      "Finalizing analysis...",
      "Setting up lazy loading...",
      "Configuring caching strategies...",
      "Running performance tests...",
      "Finalizing optimizations...",
    ],
  },
  {
    status: "Enhancing UI/UX",
    lines: [
      "Initializing UI enhancement scan...",
      "Checking accessibility compliance...",
      "Analyzing component animations...",
      "Reviewing loading states...",
      "Testing responsive layouts...",
      "Optimizing user interactions...",
      "Validating color contrast...",
      "Checking motion preferences...",
      "Finalizing UI improvements...",
    ],
  },
];

const LINE_HEIGHT = 28;
const VISIBLE_LINE_COUNT = 3;
const STEP_MS = 2000;

const PROGRESS_MASK_RADIUS = 60;
const PROGRESS_MASK_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_MASK_RADIUS;

const RINGS = [
  { r: 110, stroke: "#4ADE80", reverse: false, delay: "0s" },
  { r: 90, stroke: "#FFA726", reverse: true, delay: "0.2s" },
  { r: 70, stroke: "#FFEB3B", reverse: false, delay: "0.3s" },
  { r: 50, stroke: "#FF4081", reverse: true, delay: "0.2s" },
];

const LoadingAnimation = ({
  progress,
  maskId,
}: {
  progress: number;
  maskId: string;
}) => (
  <div className="relative h-6 w-6">
    {/* Decorative: the status text next to it is what assistive tech reads. */}
    <svg
      aria-hidden="true"
      className="h-full w-full"
      fill="none"
      viewBox="0 0 240 240"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <mask id={maskId}>
          <rect fill="black" height="240" width="240" />
          {/* Dim track so the rings stay visible at 0% */}
          <circle cx="120" cy="120" fill="white" opacity="0.2" r="120" />
          {/* A stroke as wide as the disk turns the dash into a growing pie slice */}
          <circle
            cx="120"
            cy="120"
            fill="none"
            r={PROGRESS_MASK_RADIUS}
            stroke="white"
            strokeDasharray={`${(progress / 100) * PROGRESS_MASK_CIRCUMFERENCE} ${PROGRESS_MASK_CIRCUMFERENCE}`}
            strokeWidth={PROGRESS_MASK_RADIUS * 2}
            transform="rotate(-90 120 120)"
          />
        </mask>
      </defs>

      <g mask={`url(#${maskId})`} strokeDasharray="18% 40%" strokeWidth="16">
        {RINGS.map((ring) => (
          <circle
            className="motion-safe:animate-spin"
            cx="120"
            cy="120"
            key={ring.r}
            opacity="0.95"
            r={ring.r}
            stroke={ring.stroke}
            style={{
              animationDelay: ring.delay,
              animationDirection: ring.reverse ? "reverse" : "normal",
              animationDuration: "1.5s",
              transformOrigin: "120px 120px",
            }}
          />
        ))}
      </g>
    </svg>
  </div>
);

interface AILoadingStateProps {
  className?: string;
}

interface Step {
  sequenceIndex: number;
  firstVisibleLine: number;
}

// Scroll one line per step until the last line is in view, then move on to
// the next sequence from its top.
const advance = ({ sequenceIndex, firstVisibleLine }: Step): Step => {
  const lineCount = TASK_SEQUENCES[sequenceIndex].lines.length;
  if (firstVisibleLine < lineCount - VISIBLE_LINE_COUNT) {
    return { sequenceIndex, firstVisibleLine: firstVisibleLine + 1 };
  }
  return {
    sequenceIndex: (sequenceIndex + 1) % TASK_SEQUENCES.length,
    firstVisibleLine: 0,
  };
};

export default function AILoadingState({ className }: AILoadingStateProps) {
  const [{ sequenceIndex, firstVisibleLine }, setStep] = useState<Step>({
    sequenceIndex: 0,
    firstVisibleLine: 0,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const progressMaskId = useId();

  // Only animate while on screen — an off-screen interval keeps waking the
  // main thread and re-rendering for a component nobody can see.
  useEffect(() => {
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

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const timer = setInterval(() => setStep(advance), STEP_MS);
    return () => clearInterval(timer);
  }, [isVisible]);

  const currentSequence = TASK_SEQUENCES[sequenceIndex];

  return (
    <div
      className={cn(
        "flex min-h-full w-full items-center justify-center",
        className
      )}
      ref={rootRef}
    >
      <div className="w-auto space-y-4">
        <div className="ml-2 flex items-center space-x-2 font-medium text-gray-600 dark:text-gray-300">
          <LoadingAnimation
            maskId={progressMaskId}
            progress={((sequenceIndex + 1) / TASK_SEQUENCES.length) * 100}
          />
          {/* <output> has the implicit role="status", so stage changes are
              announced. */}
          <output className="text-sm">{currentSequence.status}...</output>
        </div>

        {/* The log is decorative. A mask fades the older lines, so it works on
            any background. Keyed by sequence, so a new sequence starts at the
            top instead of scrolling back. */}
        <div
          aria-hidden="true"
          className="relative w-full overflow-hidden rounded-lg font-mono text-xs"
          key={sequenceIndex}
          style={{
            height: LINE_HEIGHT * VISIBLE_LINE_COUNT,
            maskImage:
              "linear-gradient(to bottom, rgb(0 0 0 / 0.1) 0%, rgb(0 0 0 / 0.5) 30%, black 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, rgb(0 0 0 / 0.1) 0%, rgb(0 0 0 / 0.5) 30%, black 100%)",
          }}
        >
          <div
            className="transition-transform duration-300 ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none"
            style={{
              transform: `translateY(${-firstVisibleLine * LINE_HEIGHT}px)`,
            }}
          >
            {currentSequence.lines.map((line, index) => (
              <div
                className="flex items-center px-2"
                key={line}
                style={{ height: LINE_HEIGHT }}
              >
                <div className="w-6 select-none pr-3 text-right text-gray-400 dark:text-gray-500">
                  {index + 1}
                </div>

                <div className="ml-1 flex-1 text-gray-800 dark:text-gray-200">
                  {line}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
