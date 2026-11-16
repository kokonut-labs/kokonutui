"use client";

/**
 * @author: @kokonutui
 * @description: AI Model Selector
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ChevronDown } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface EffortLevel {
  id: string;
  label: string;
  /** One line on the trade-off, shown under the track. */
  hint?: string;
}

export interface ModelOption {
  id: string;
  name: string;
  description?: string;
  /** A mark shown before the name. Claude models get the Claude mark. */
  icon?: ReactNode;
  /** Effort levels the model supports, lowest first. */
  efforts: EffortLevel[];
  /** Effort to land on when the model is picked fresh. */
  defaultEffort?: string;
}

export interface ModelSelection {
  model: string;
  effort: string;
}

interface AIModelSelectorProps {
  models?: ModelOption[];
  /** Controlled selection. Pair with `onChange`. */
  value?: ModelSelection;
  defaultValue?: ModelSelection;
  onChange?: (value: ModelSelection) => void;
  defaultOpen?: boolean;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const LOW: EffortLevel = {
  id: "low",
  label: "Low",
  hint: "Answers right away. Best for quick edits and lookups.",
};
const MEDIUM: EffortLevel = {
  id: "medium",
  label: "Medium",
  hint: "Thinks briefly first. A good default for most work.",
};
const HIGH: EffortLevel = {
  id: "high",
  label: "High",
  hint: "Thinks longer on hard problems. Slower, uses more tokens.",
};
const MAX: EffortLevel = {
  id: "max",
  label: "Max",
  hint: "No limit on thinking. For the hardest tasks only.",
};

const DEMO_MODELS: ModelOption[] = [
  {
    id: "opus",
    name: "Claude Opus 5.5",
    description: "Most capable, for complex work",
    efforts: [LOW, MEDIUM, HIGH, MAX],
    defaultEffort: "high",
  },
  {
    id: "sonnet",
    name: "Claude Sonnet 5.5",
    description: "Fast and capable for everyday tasks",
    efforts: [LOW, MEDIUM, HIGH],
    defaultEffort: "medium",
  },
  {
    id: "haiku",
    name: "Claude Haiku 5.5",
    description: "Fastest, for quick answers",
    efforts: [LOW, MEDIUM],
    defaultEffort: "low",
  },
  {
    id: "gpt",
    name: "GPT-5.6",
    description: "Strong at agentic coding",
    efforts: [
      {
        id: "minimal",
        label: "Minimal",
        hint: "Skips reasoning almost entirely. Lowest latency.",
      },
      LOW,
      MEDIUM,
      HIGH,
    ],
    defaultEffort: "medium",
  },
];

// Decorative: the mark sits next to the model name, which carries the label.
const CLAUDE_MARK = (
  <svg aria-hidden="true" fill="#D97757" viewBox="0 0 256 257">
    <path d="m50.228 170.321 50.357-28.257.843-2.463-.843-1.361h-2.462l-8.426-.518-28.775-.778-24.952-1.037-24.175-1.296-6.092-1.297L0 125.796l.583-3.759 5.12-3.434 7.324.648 16.202 1.101 24.304 1.685 17.629 1.037 26.118 2.722h4.148l.583-1.685-1.426-1.037-1.101-1.037-25.147-17.045-27.22-18.017-14.258-10.37-7.713-5.25-3.888-4.925-1.685-10.758 7-7.713 9.397.649 2.398.648 9.527 7.323 20.35 15.75L94.817 91.9l3.889 3.24 1.555-1.102.195-.777-1.75-2.917-14.453-26.118-15.425-26.572-6.87-11.018-1.814-6.61c-.648-2.723-1.102-4.991-1.102-7.778l7.972-10.823L71.42 0 82.05 1.426l4.472 3.888 6.61 15.101 10.694 23.786 16.591 32.34 4.861 9.592 2.592 8.879.973 2.722h1.685v-1.556l1.36-18.211 2.528-22.36 2.463-28.776.843-8.1 4.018-9.722 7.971-5.25 6.222 2.981 5.12 7.324-.713 4.73-3.046 19.768-5.962 30.98-3.889 20.739h2.268l2.593-2.593 10.499-13.934 17.628-22.036 7.778-8.749 9.073-9.657 5.833-4.601h11.018l8.1 12.055-3.628 12.443-11.342 14.388-9.398 12.184-13.48 18.147-8.426 14.518.778 1.166 2.01-.194 30.46-6.481 16.462-2.982 19.637-3.37 8.88 4.148.971 4.213-3.5 8.62-20.998 5.184-24.628 4.926-36.682 8.685-.454.324.519.648 16.526 1.555 7.065.389h17.304l32.21 2.398 8.426 5.574 5.055 6.805-.843 5.184-12.962 6.611-17.498-4.148-40.83-9.721-14-3.5h-1.944v1.167l11.666 11.406 21.387 19.314 26.767 24.887 1.36 6.157-3.434 4.86-3.63-.518-23.526-17.693-9.073-7.972-20.545-17.304h-1.36v1.814l4.73 6.935 25.017 37.59 1.296 11.536-1.814 3.76-6.481 2.268-7.13-1.297-14.647-20.544-15.1-23.138-12.185-20.739-1.49.843-7.194 77.448-3.37 3.953-7.778 2.981-6.48-4.925-3.436-7.972 3.435-15.749 4.148-20.544 3.37-16.333 3.046-20.285 1.815-6.74-.13-.454-1.49.194-15.295 20.999-23.267 31.433-18.406 19.702-4.407 1.75-7.648-3.954.713-7.064 4.277-6.286 25.47-32.405 15.36-20.092 9.917-11.6-.065-1.686h-.583L44.07 198.125l-12.055 1.555-5.185-4.86.648-7.972 2.463-2.593 20.35-13.999-.064.065Z" />
  </svg>
);

/** The model's mark: its own icon, the Claude mark, or its first letter. */
function ModelMark({ model }: { model: ModelOption }) {
  if (model.icon) {
    return <>{model.icon}</>;
  }
  if (model.name.startsWith("Claude")) {
    return CLAUDE_MARK;
  }
  return (
    <span className="flex size-full items-center justify-center rounded-full bg-zinc-900 font-semibold text-[9px] text-white dark:bg-white dark:text-zinc-900">
      {model.name.charAt(0)}
    </span>
  );
}

const effortIndex = (model: ModelOption, effort: string) =>
  Math.max(
    0,
    model.efforts.findIndex((level) => level.id === effort)
  );

/**
 * The effort to keep when switching models: the same level if the new model
 * has it, otherwise the one at the same relative height on its track.
 */
function carryEffort(from: ModelOption, to: ModelOption, effort: string) {
  if (to.efforts.some((level) => level.id === effort)) {
    return effort;
  }
  const share =
    from.efforts.length > 1
      ? effortIndex(from, effort) / (from.efforts.length - 1)
      : 0;
  const index = Math.round(share * (to.efforts.length - 1));
  return to.efforts[index]?.id ?? to.defaultEffort ?? to.efforts[0].id;
}

/** Rising bars that fill to the current effort, like a signal meter. */
function EffortGlyph({ count, level }: { count: number; level: number }) {
  return (
    <span aria-hidden="true" className="flex h-3 items-end gap-[2px]">
      {Array.from({ length: count }, (_, i) => (
        <span
          className={cn(
            "w-[3px] rounded-[1px] transition-colors duration-200",
            i <= level
              ? "bg-orange-500 dark:bg-orange-400"
              : "bg-zinc-300 dark:bg-zinc-600"
          )}
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed bars, never reordered
          key={i}
          style={{
            height: `${((i + 1) / count) * 100}%`,
            // Bars fill bottom up and empty top down.
            transitionDelay: `${(i <= level ? i : count - 1 - i) * 30}ms`,
          }}
        />
      ))}
    </span>
  );
}

/**
 * A detent track: drag the thumb, click a stop or use the arrow keys. The
 * thumb snaps from stop to stop while dragging, so every position is valid.
 */
function EffortTrack({
  levels,
  value,
  onChange,
  labelId,
}: {
  levels: EffortLevel[];
  value: number;
  onChange: (index: number) => void;
  labelId: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const count = levels.length;

  const indexAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) {
      return value;
    }
    const share = (clientX - rect.left) / rect.width;
    return Math.min(count - 1, Math.max(0, Math.floor(share * count)));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowLeft: value - 1,
      ArrowDown: value - 1,
      ArrowRight: value + 1,
      ArrowUp: value + 1,
      Home: 0,
      End: count - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      onChange(Math.min(count - 1, Math.max(0, moves[event.key])));
    }
  };

  return (
    <div
      aria-labelledby={labelId}
      aria-valuemax={count - 1}
      aria-valuemin={0}
      aria-valuenow={value}
      aria-valuetext={levels[value]?.label}
      className="h-8 cursor-pointer touch-none select-none rounded-full bg-zinc-100 p-0.5 outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:bg-white/5"
      onKeyDown={onKeyDown}
      onLostPointerCapture={() => setDragging(false)}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        onChange(indexAt(event.clientX));
      }}
      onPointerMove={(event) => {
        if (dragging) {
          const next = indexAt(event.clientX);
          if (next !== value) {
            onChange(next);
          }
        }
      }}
      onPointerUp={() => setDragging(false)}
      role="slider"
      tabIndex={0}
    >
      <div className="relative flex h-full" ref={trackRef}>
        {/* The thumb glides between stops, and resizes when a model has more
          or fewer levels. */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 left-0 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-black/5 transition-[translate,width] duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none dark:bg-zinc-700 dark:ring-white/10",
            dragging && "duration-150"
          )}
          // Moved with translate, which skips layout, rather than left.
          style={{
            translate: `${value * 100}% 0`,
            width: `${100 / count}%`,
          }}
        />
        {levels.map((level, index) => (
          <span
            aria-hidden="true"
            className={cn(
              "relative flex flex-1 items-center justify-center text-xs transition-colors duration-150",
              index === value
                ? "font-medium text-zinc-900 dark:text-white"
                : "text-zinc-500 dark:text-zinc-400"
            )}
            key={level.id}
          >
            {level.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AIModelSelector({
  models = DEMO_MODELS,
  value: valueProp,
  defaultValue,
  onChange,
  defaultOpen = false,
  className,
}: AIModelSelectorProps) {
  const first = models[0];
  const [inner, setInner] = useState<ModelSelection>(
    defaultValue ?? {
      model: first.id,
      effort: first.defaultEffort ?? first.efforts[0].id,
    }
  );
  const value = valueProp ?? inner;
  const model = models.find((item) => item.id === value.model) ?? first;
  const level = effortIndex(model, value.effort);
  const effort = model.efforts[level];

  const [open, setOpen] = useState(defaultOpen);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelId = useId();
  const effortLabelId = useId();

  const commit = (next: ModelSelection) => {
    if (valueProp === undefined) {
      setInner(next);
    }
    onChange?.(next);
  };

  const pickModel = (next: ModelOption) => {
    commit({
      model: next.id,
      effort: carryEffort(model, next, value.effort),
    });
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Only pull focus back when it was in the panel; Escape pressed
        // elsewhere on the page just closes it.
        if (rootRef.current?.contains(document.activeElement)) {
          triggerRef.current?.focus();
        }
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Up and Down move through the models, like a radio group.
  const onOptionKey = (event: React.KeyboardEvent, index: number) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (step === undefined) {
      return;
    }
    event.preventDefault();
    const next = (index + step + models.length) % models.length;
    optionRefs.current[next]?.focus();
    pickModel(models[next]);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("w-full max-w-sm", className)} ref={rootRef}>
        <div className="relative flex h-11 items-center rounded-full bg-black/5 px-1.5 dark:bg-white/5">
          <button
            aria-controls={panelId}
            aria-expanded={open}
            aria-label={`Model: ${model.name}, ${effort?.label} effort. Change`}
            className={cn(
              "flex h-8 items-center gap-2 rounded-full px-2.5 text-xs text-zinc-700 outline-hidden transition-colors duration-150 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:text-zinc-200 dark:hover:bg-white/10",
              open && "bg-black/5 dark:bg-white/10"
            )}
            onClick={() => setOpen((current) => !current)}
            ref={triggerRef}
            type="button"
          >
            <span className="flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5">
              <ModelMark model={model} />
            </span>
            <span className="font-medium">{model.name}</span>
            <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
              <EffortGlyph count={model.efforts.length} level={level} />
              {effort?.label}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-3 text-zinc-400 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                open && "rotate-180"
              )}
            />
          </button>
          {/* After the trigger in the DOM, so Tab moves from it into the
            panel, which still opens above. */}
          <AnimatePresence>
            {open && (
              <motion.div
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="absolute bottom-full left-0 z-10 mb-2 w-80 max-w-[calc(100vw-2rem)] origin-bottom-left rounded-2xl bg-white p-1 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.18)] ring-1 ring-black/10 dark:bg-zinc-900 dark:ring-white/10"
                exit={{
                  opacity: 0,
                  scale: 0.97,
                  y: 4,
                  transition: { duration: 0.12, ease: EASE_OUT },
                }}
                id={panelId}
                initial={{ opacity: 0, scale: 0.97, y: 4 }}
                transition={{ duration: 0.16, ease: EASE_OUT }}
              >
                <div aria-label="Model" role="radiogroup">
                  {models.map((option, index) => {
                    const selected = option.id === model.id;
                    return (
                      // biome-ignore lint/a11y/useSemanticElements: a two-line option with a check doesn't fit a native radio input
                      <button
                        aria-checked={selected}
                        className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-hidden transition-colors duration-150 hover:bg-zinc-100 focus-visible:bg-zinc-100 dark:focus-visible:bg-white/5 dark:hover:bg-white/5"
                        key={option.id}
                        onClick={() => pickModel(option)}
                        onKeyDown={(event) => onOptionKey(event, index)}
                        ref={(node) => {
                          optionRefs.current[index] = node;
                        }}
                        role="radio"
                        tabIndex={selected ? 0 : -1}
                        type="button"
                      >
                        <span className="flex size-4 shrink-0 items-center justify-center self-start pt-1 [&>*]:size-3.5">
                          <ModelMark model={option} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-zinc-900 dark:text-zinc-100">
                            {option.name}
                          </span>
                          {option.description && (
                            <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                              {option.description}
                            </span>
                          )}
                        </span>
                        <span className="flex size-4 shrink-0 items-center justify-center">
                          {selected && (
                            <svg
                              aria-hidden="true"
                              className="size-4 text-zinc-900 dark:text-zinc-100"
                              fill="none"
                              viewBox="0 0 16 16"
                            >
                              <motion.path
                                animate={{ pathLength: 1 }}
                                d="M3.5 8.5 6.5 11.5 12.5 4.5"
                                initial={{ pathLength: 0 }}
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.75}
                                transition={{ duration: 0.22, ease: EASE_OUT }}
                              />
                            </svg>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mx-1.5 my-1 border-zinc-100 border-t dark:border-white/10" />

                <div className="px-1.5 pt-1.5 pb-2">
                  <div className="mb-2 flex items-baseline justify-between">
                    <p
                      className="font-medium text-xs text-zinc-900 dark:text-zinc-100"
                      id={effortLabelId}
                    >
                      Effort
                    </p>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 [@media(hover:none)]:hidden">
                      ← → to adjust
                    </p>
                  </div>
                  <EffortTrack
                    labelId={effortLabelId}
                    levels={model.efforts}
                    onChange={(index) =>
                      commit({
                        model: model.id,
                        effort: model.efforts[index].id,
                      })
                    }
                    value={level}
                  />
                  {/* Fixed height so the panel doesn't jump as hints change. */}
                  <div className="relative mt-2 h-8">
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.p
                        animate={{ opacity: 1, filter: "blur(0px)" }}
                        className="absolute inset-x-0 top-0 text-xs text-zinc-500 leading-4 dark:text-zinc-400"
                        exit={{ opacity: 0, filter: "blur(2px)" }}
                        initial={{ opacity: 0, filter: "blur(2px)" }}
                        key={`${model.id}-${effort?.id}`}
                        transition={{ duration: 0.15, ease: EASE_OUT }}
                      >
                        {effort?.hint}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
