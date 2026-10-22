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

import { Check, ChevronDown } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
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
              ? "bg-zinc-700 dark:bg-zinc-200"
              : "bg-zinc-300 dark:bg-zinc-600"
          )}
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed bars, never reordered
          key={i}
          style={{ height: `${((i + 1) / count) * 100}%` }}
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
      className="h-8 cursor-pointer touch-none select-none rounded-lg bg-zinc-100 p-0.5 outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:bg-white/5"
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
            "absolute inset-y-0 rounded-md bg-white shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-black/5 transition-[left,width] duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none dark:bg-zinc-700 dark:ring-white/10",
            dragging && "duration-150"
          )}
          style={{
            left: `${(value / count) * 100}%`,
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
        setOpen(false);
        triggerRef.current?.focus();
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
        <div className="relative flex h-11 items-center rounded-xl bg-black/5 px-1.5 dark:bg-white/5">
          <button
            aria-controls={panelId}
            aria-expanded={open}
            aria-label={`Model: ${model.name}, ${effort?.label} effort. Change`}
            className={cn(
              "flex h-8 items-center gap-2 rounded-lg px-2 text-xs text-zinc-700 outline-hidden transition-colors duration-150 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:text-zinc-200 dark:hover:bg-white/10",
              open && "bg-black/5 dark:bg-white/10"
            )}
            onClick={() => setOpen((current) => !current)}
            ref={triggerRef}
            type="button"
          >
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
                className="absolute bottom-full left-0 z-10 mb-2 w-72 origin-bottom-left rounded-xl bg-white p-1 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.18)] ring-1 ring-black/10 dark:bg-zinc-900 dark:ring-white/10"
                exit={{ opacity: 0, scale: 0.97, y: 4 }}
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
                        className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left outline-hidden transition-colors duration-150 hover:bg-zinc-100 focus-visible:bg-zinc-100 dark:focus-visible:bg-white/5 dark:hover:bg-white/5"
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
                            <Check
                              aria-hidden="true"
                              className="size-4 text-zinc-900 dark:text-zinc-100"
                            />
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
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
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
