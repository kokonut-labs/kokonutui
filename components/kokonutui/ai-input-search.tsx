"use client";

/**
 * @author: @kokonutui
 * @description: AI Input Search
 * @version: 2.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  ArrowUp,
  CalendarDays,
  FileText,
  Globe,
  Search,
  Telescope,
  X,
} from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { type ComponentType, useId, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_OUT_CSS = "ease-[cubic-bezier(0.23,1,0.32,1)]";

export type SearchFilterKind = "site" | "after" | "before" | "type";

export interface SearchFilter {
  kind: SearchFilterKind;
  value: string;
}

export interface AIInputSearchProps {
  placeholder?: string;
  /** Where to search. The first one is selected unless `defaultScope` says. */
  scopes?: string[];
  defaultScope?: string;
  /** Start with deep research on: reads more sources, takes longer. */
  defaultDeep?: boolean;
  /**
   * Receives the query with operators taken out, plus the filters they
   * became, the scope and whether deep research was on.
   */
  onSubmit?: (
    query: string,
    options: { filters: SearchFilter[]; scope: string; deep: boolean }
  ) => void;
  className?: string;
}

const WWW = /^www\./;

const OPERATORS: Record<
  SearchFilterKind,
  {
    icon: ComponentType<{ className?: string }>;
    label: (value: string) => string;
  }
> = {
  site: { icon: Globe, label: (v) => v.replace(WWW, "") },
  after: { icon: CalendarDays, label: (v) => `After ${v}` },
  before: { icon: CalendarDays, label: (v) => `Before ${v}` },
  type: { icon: FileText, label: (v) => v.toUpperCase() },
};

// An operator the user just finished with a space, e.g. "site:github.com ".
const FINISHED_OPERATOR = /(^|\s)(site|after|before|type):(\S+)\s$/i;
// Operators still in the text on submit, e.g. typed last with no space.
const ANY_OPERATOR = /(^|\s)(site|after|before|type):(\S+)/gi;
const EXTRA_SPACES = /\s+/g;

const HINTS = ["site:", "after:", "type:pdf"];

/** Adds a filter; a second one of the same kind replaces the first. */
const withFilter = (filters: SearchFilter[], next: SearchFilter) => [
  ...filters.filter((f) => f.kind !== next.kind),
  next,
];

function FilterChip({
  filter,
  onRemove,
}: {
  filter: SearchFilter;
  onRemove: () => void;
}) {
  const { icon: Icon, label } = OPERATORS[filter.kind];
  return (
    <motion.li
      animate={{ opacity: 1, filter: "blur(0px)" }}
      className="flex h-7 items-center gap-1.5 rounded-md bg-sky-500/10 pr-0.5 pl-2 text-sky-700 text-xs dark:bg-sky-400/10 dark:text-sky-300"
      exit={{
        opacity: 0,
        filter: "blur(2px)",
        transition: { duration: 0.12, ease: EASE_OUT },
      }}
      initial={{ opacity: 0, filter: "blur(2px)" }}
      layout="position"
      transition={{ duration: 0.18, ease: EASE_OUT }}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0 opacity-70" />
      <span className="max-w-40 truncate">{label(filter.value)}</span>
      <button
        aria-label={`Remove filter ${filter.kind}:${filter.value}`}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded opacity-60 hover:bg-sky-500/10 hover:opacity-100",
          "transition-[background-color,opacity] duration-150",
          EASE_OUT_CSS,
          "focus-visible:opacity-100 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-sky-500"
        )}
        onClick={onRemove}
        type="button"
      >
        <X aria-hidden="true" className="size-3" />
      </button>
    </motion.li>
  );
}

function ScopeTabs({
  scopes,
  value,
  onChange,
}: {
  scopes: string[];
  value: string;
  onChange: (scope: string) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const layoutId = useId();

  // Arrow keys move along the tabs, like a radio group.
  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (step === undefined) {
      return;
    }
    event.preventDefault();
    const next = (index + step + scopes.length) % scopes.length;
    refs.current[next]?.focus();
    onChange(scopes[next]);
  };

  return (
    <LayoutGroup id={layoutId}>
      <div
        aria-label="Search in"
        className="flex items-center rounded-full bg-black/[0.04] p-0.5 dark:bg-white/[0.06]"
        role="radiogroup"
      >
        {scopes.map((scope, index) => {
          const selected = scope === value;
          return (
            // biome-ignore lint/a11y/useSemanticElements: a pill tab with a sliding thumb doesn't fit a native radio input
            <button
              aria-checked={selected}
              className={cn(
                "relative h-7 rounded-full px-2.5 text-xs outline-hidden",
                "transition-colors duration-150",
                EASE_OUT_CSS,
                "focus-visible:ring-2 focus-visible:ring-sky-500/50",
                selected
                  ? "text-black dark:text-white"
                  : "text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
              )}
              key={scope}
              onClick={() => onChange(scope)}
              onKeyDown={(event) => onKeyDown(event, index)}
              ref={(node) => {
                refs.current[index] = node;
              }}
              role="radio"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {selected && (
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-black/5 dark:bg-zinc-700 dark:ring-white/10"
                  layoutId="scope-thumb"
                  transition={{ duration: 0.22, ease: EASE_OUT }}
                />
              )}
              <span className="relative">{scope}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

export default function AI_Input_Search({
  placeholder = "Search anything",
  scopes = ["Web", "News", "Papers", "Code"],
  defaultScope,
  defaultDeep = false,
  onSubmit,
  className,
}: AIInputSearchProps) {
  const [value, setValue] = useState("");
  const [filters, setFilters] = useState<SearchFilter[]>([]);
  const [scope, setScope] = useState(
    defaultScope && scopes.includes(defaultScope)
      ? defaultScope
      : (scopes[0] ?? "")
  );
  const [deep, setDeep] = useState(defaultDeep);
  const [focused, setFocused] = useState(false);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 44,
    maxHeight: 160,
  });

  const focusEnd = () => {
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
      adjustHeight();
    });
  };

  // A finished "kind:value " turns into a chip, and the text loses it.
  const handleChange = (next: string) => {
    const match = FINISHED_OPERATOR.exec(next);
    if (match) {
      const [, lead, kind, operand] = match;
      setFilters((current) =>
        withFilter(current, {
          kind: kind.toLowerCase() as SearchFilterKind,
          value: operand,
        })
      );
      setValue(next.slice(0, match.index + lead.length));
    } else {
      setValue(next);
    }
    adjustHeight();
  };

  const removeFilter = (kind: SearchFilterKind) => {
    setFilters((current) => current.filter((f) => f.kind !== kind));
    textareaRef.current?.focus();
  };

  // Backspace in an empty field opens the last chip back up as text.
  const reopenLastFilter = () => {
    const last = filters.at(-1);
    if (!last) {
      return false;
    }
    setFilters(filters.slice(0, -1));
    setValue(`${last.kind}:${last.value}`);
    focusEnd();
    return true;
  };

  const insertHint = (hint: string) => {
    const spacer = value === "" || value.endsWith(" ") ? "" : " ";
    // A complete hint like "type:pdf" becomes a chip straight away.
    handleChange(`${value}${spacer}${hint}${hint.endsWith(":") ? "" : " "}`);
    focusEnd();
  };

  const handleSubmit = () => {
    let all = filters;
    const query = value
      .replace(ANY_OPERATOR, (_, lead: string, kind: string, operand) => {
        all = withFilter(all, {
          kind: kind.toLowerCase() as SearchFilterKind,
          value: operand,
        });
        return lead;
      })
      .replace(EXTRA_SPACES, " ")
      .trim();
    if (!query && all.length === 0) {
      return;
    }
    onSubmit?.(query, { filters: all, scope, deep });
    setValue("");
    setFilters([]);
    adjustHeight(true);
  };

  // Mouse convenience: clicking the box around the field focuses it. Clicks
  // on the controls keep their own behaviour.
  const handleContainerClick = (target: EventTarget) => {
    if (target instanceof Element && target.closest("button")) {
      return;
    }
    textareaRef.current?.focus();
  };

  const canSubmit = value.trim().length > 0 || filters.length > 0;
  const showHints = focused && value === "" && filters.length === 0;

  return (
    <div className={cn("w-full py-4", className)}>
      <div className="relative mx-auto w-full max-w-xl">
        {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents lint/a11y/noNoninteractiveElementInteractions: pointer-only shortcut; the textarea and buttons inside are keyboard reachable */}
        <div
          className={cn(
            "relative flex w-full cursor-text flex-col rounded-2xl bg-white text-left ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10",
            "shadow-[0_1px_2px_rgb(0_0_0/0.04),0_6px_20px_-10px_rgb(0_0_0/0.12)]",
            "transition-shadow duration-150 has-[textarea:focus-visible]:ring-sky-500/60 dark:has-[textarea:focus-visible]:ring-sky-400/50"
          )}
          onClick={(e) => handleContainerClick(e.target)}
        >
          <div className="flex items-start gap-1 pt-1.5 pr-3 pl-3.5">
            <Search
              aria-hidden="true"
              className="mt-[13px] size-4 shrink-0 text-black/40 dark:text-white/40"
            />
            <div className="min-w-0 flex-1">
              <AnimatePresence initial={false}>
                {filters.length > 0 && (
                  <motion.div
                    animate={{ height: "auto", opacity: 1 }}
                    className="overflow-hidden"
                    exit={{ height: 0, opacity: 0 }}
                    initial={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: EASE_OUT }}
                  >
                    <ul
                      aria-label="Filters"
                      className="flex flex-wrap gap-1.5 px-2 pt-2"
                    >
                      <AnimatePresence initial={false} mode="popLayout">
                        {filters.map((filter) => (
                          <FilterChip
                            filter={filter}
                            key={filter.kind}
                            onRemove={() => removeFilter(filter.kind)}
                          />
                        ))}
                      </AnimatePresence>
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
              <Textarea
                aria-label="Search"
                className="min-h-[44px] w-full resize-none rounded-none border-none bg-transparent px-2 py-2.5 text-[15px] text-black leading-relaxed placeholder:text-black/35 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent dark:text-white dark:placeholder:text-white/35"
                onBlur={() => setFocused(false)}
                onChange={(e) => handleChange(e.target.value)}
                onFocus={() => setFocused(true)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) {
                    return;
                  }
                  if (
                    e.key === "Backspace" &&
                    value === "" &&
                    reopenLastFilter()
                  ) {
                    e.preventDefault();
                  } else if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={placeholder}
                ref={textareaRef}
                value={value}
              />
            </div>
          </div>

          {/* Operator hints for an empty, focused field. Space is kept so
              nothing jumps when they fade. */}
          <div
            aria-hidden={!showHints}
            className={cn(
              "flex h-6 items-center gap-1 pl-[42px] text-[11px] transition-opacity duration-150",
              showHints ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            <span className="mr-0.5 text-black/35 dark:text-white/35">Try</span>
            {HINTS.map((hint) => (
              <button
                className="rounded px-1 font-mono text-black/55 transition-colors duration-150 hover:bg-black/5 hover:text-black dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"
                key={hint}
                // Keeps the field focused, so the hints don't vanish mid-click.
                onClick={() => insertHint(hint)}
                onMouseDown={(e) => e.preventDefault()}
                tabIndex={showHints ? 0 : -1}
                type="button"
              >
                {hint}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 px-2.5 pt-1.5 pb-2.5">
            <ScopeTabs onChange={setScope} scopes={scopes} value={scope} />
            <button
              aria-pressed={deep}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs",
                "transition-[background-color,color,box-shadow] duration-150",
                EASE_OUT_CSS,
                "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500/50",
                deep
                  ? "bg-sky-500/10 text-sky-700 ring-1 ring-sky-500/30 dark:text-sky-300"
                  : "text-black/50 hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
              )}
              onClick={() => setDeep((d) => !d)}
              title="Deep research reads more sources and takes longer"
              type="button"
            >
              <Telescope aria-hidden="true" className="size-3.5" />
              Deep
            </button>
            <div className="flex-1" />
            {/* What the mode costs, in plain numbers. */}
            <span className="relative hidden h-5 w-20 text-[11px] text-black/40 tabular-nums sm:block dark:text-white/40">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  className="absolute inset-0 flex items-center justify-end"
                  exit={{ opacity: 0, filter: "blur(2px)" }}
                  initial={{ opacity: 0, filter: "blur(2px)" }}
                  key={String(deep)}
                  transition={{ duration: 0.15, ease: EASE_OUT }}
                >
                  {deep ? "~40 sources" : "~8 sources"}
                </motion.span>
              </AnimatePresence>
            </span>
            <button
              aria-label="Search"
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full transition-[color,background-color] duration-150",
                EASE_OUT_CSS,
                "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500/50",
                // Fills once there is something to search for.
                canSubmit
                  ? "cursor-pointer bg-sky-500 text-white hover:bg-sky-600"
                  : "bg-black/5 text-black/30 dark:bg-white/10 dark:text-white/30"
              )}
              disabled={!canSubmit}
              onClick={handleSubmit}
              type="button"
            >
              <ArrowUp
                aria-hidden="true"
                className="size-4"
                strokeWidth={2.25}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
