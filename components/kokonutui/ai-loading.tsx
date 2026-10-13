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

const PROGRESS_MASK_RADIUS = 60;
const PROGRESS_MASK_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_MASK_RADIUS;

const LoadingAnimation = ({
  progress,
  maskId,
}: {
  progress: number;
  maskId: string;
}) => (
  <div className="relative h-6 w-6">
    <svg
      aria-label={`Loading progress: ${Math.round(progress)}%`}
      className="h-full w-full"
      fill="none"
      viewBox="0 0 240 240"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Loading Progress Indicator</title>

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

      <style>
        {`
                    @keyframes rotate-cw {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    @keyframes rotate-ccw {
                        from { transform: rotate(360deg); }
                        to { transform: rotate(0deg); }
                    }
                    .g-spin circle {
                        transform-origin: 120px 120px;
                    }
                    .g-spin circle:nth-child(1) { animation: rotate-cw 8s linear infinite; }
                    .g-spin circle:nth-child(2) { animation: rotate-ccw 8s linear infinite; }
                    .g-spin circle:nth-child(3) { animation: rotate-cw 8s linear infinite; }
                    .g-spin circle:nth-child(4) { animation: rotate-ccw 8s linear infinite; }

                    .g-spin circle:nth-child(2n) { animation-delay: 0.2s; }
                    .g-spin circle:nth-child(3n) { animation-delay: 0.3s; }

                    @media (prefers-reduced-motion: reduce) {
                        .g-spin circle:nth-child(n) { animation: none; }
                    }
                `}
      </style>

      <g
        className="g-spin"
        mask={`url(#${maskId})`}
        strokeDasharray="18% 40%"
        strokeWidth="16"
      >
        <circle cx="120" cy="120" opacity="0.95" r="110" stroke="#4ADE80" />
        <circle cx="120" cy="120" opacity="0.95" r="90" stroke="#FFA726" />
        <circle cx="120" cy="120" opacity="0.95" r="70" stroke="#FFEB3B" />
        <circle cx="120" cy="120" opacity="0.95" r="50" stroke="#FF4081" />
      </g>
    </svg>
  </div>
);

export default function AILoadingState() {
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [visibleLines, setVisibleLines] = useState<
    Array<{ text: string; number: number }>
  >([]);
  const [scrollPosition, setScrollPosition] = useState(0);
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const progressMaskId = useId();
  const lineHeight = 28;

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

  const currentSequence = TASK_SEQUENCES[sequenceIndex];
  const totalLines = currentSequence.lines.length;

  useEffect(() => {
    const initialLines: { text: string; number: number }[] = [];
    for (let i = 0; i < Math.min(5, totalLines); i++) {
      initialLines.push({
        text: currentSequence.lines[i],
        number: i + 1,
      });
    }
    setVisibleLines(initialLines);
    setScrollPosition(0);
  }, [currentSequence.lines, totalLines]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const advanceTimer = setInterval(() => {
      const firstVisibleLineIndex = Math.floor(scrollPosition / lineHeight);
      const nextLineIndex = (firstVisibleLineIndex + 3) % totalLines;

      // If we're about to wrap around, move to next sequence
      if (nextLineIndex < firstVisibleLineIndex && nextLineIndex !== 0) {
        setSequenceIndex(
          (prevIndex) => (prevIndex + 1) % TASK_SEQUENCES.length
        );
        return;
      }

      if (nextLineIndex >= visibleLines.length && nextLineIndex < totalLines) {
        setVisibleLines((prevLines) => [
          ...prevLines,
          {
            text: currentSequence.lines[nextLineIndex],
            number: nextLineIndex + 1,
          },
        ]);
      }

      setScrollPosition((prevPosition) => prevPosition + lineHeight);
    }, 2000);

    return () => clearInterval(advanceTimer);
  }, [
    isVisible,
    scrollPosition,
    visibleLines,
    totalLines,
    currentSequence.lines,
  ]);

  useEffect(() => {
    if (codeContainerRef.current) {
      codeContainerRef.current.scrollTop = scrollPosition;
    }
  }, [scrollPosition]);

  return (
    <div
      className="flex min-h-full w-full items-center justify-center"
      ref={rootRef}
    >
      <div className="w-auto space-y-4">
        <div className="ml-2 flex items-center space-x-2 font-medium text-gray-600 dark:text-gray-300">
          <LoadingAnimation
            maskId={progressMaskId}
            progress={((sequenceIndex + 1) / TASK_SEQUENCES.length) * 100}
          />
          <span className="text-sm">{currentSequence.status}...</span>
        </div>

        <div className="relative">
          <div
            className="relative h-[84px] w-full overflow-hidden rounded-lg font-mono text-xs motion-safe:scroll-smooth"
            ref={codeContainerRef}
          >
            <div>
              {visibleLines.map((line) => (
                <div
                  className="flex h-[28px] items-center px-2"
                  key={`${line.number}-${line.text}`}
                >
                  <div className="w-6 select-none pr-3 text-right text-gray-400 dark:text-gray-500">
                    {line.number}
                  </div>

                  <div className="ml-1 flex-1 text-gray-800 dark:text-gray-200">
                    {line.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="pointer-events-none absolute inset-0 rounded-lg from-white/90 via-white/50 to-transparent dark:from-black/90 dark:via-black/50 dark:to-transparent"
            style={{
              background:
                "linear-gradient(to bottom, var(--tw-gradient-from) 0%, var(--tw-gradient-via) 30%, var(--tw-gradient-to) 100%)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
