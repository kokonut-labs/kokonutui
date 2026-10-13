"use client";

/**
 * @author: @kokonutui
 * @description: AI Input Search
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Globe, Paperclip, Send } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export interface AIInputSearchProps {
  placeholder?: string;
  searchLabel?: string;
  /** Receives the text and whether web search was on when it was sent. */
  onSubmit?: (value: string, options: { webSearch: boolean }) => void;
  /** Called with the files picked through the attach button. */
  onFilesSelected?: (files: File[]) => void;
  /** Controlled web-search state. Leave unset to let the component own it. */
  webSearch?: boolean;
  defaultWebSearch?: boolean;
  onWebSearchChange?: (webSearch: boolean) => void;
  className?: string;
}

export default function AI_Input_Search({
  placeholder = "Search the web...",
  searchLabel = "Search",
  onSubmit,
  onFilesSelected,
  webSearch: webSearchProp,
  defaultWebSearch = true,
  onWebSearchChange,
  className,
}: AIInputSearchProps) {
  const [value, setValue] = useState("");
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 52,
    maxHeight: 200,
  });
  const [uncontrolledWebSearch, setUncontrolledWebSearch] =
    useState(defaultWebSearch);
  const webSearch = webSearchProp ?? uncontrolledWebSearch;
  const shouldReduceMotion = useReducedMotion();

  const toggleWebSearch = () => {
    const next = !webSearch;
    if (webSearchProp === undefined) {
      setUncontrolledWebSearch(next);
    }
    onWebSearchChange?.(next);
  };

  const handleSubmit = () => {
    if (!value.trim()) {
      return;
    }
    onSubmit?.(value, { webSearch });
    setValue("");
    adjustHeight(true);
  };

  // Mouse convenience: clicking the box around the field focuses it. Clicks
  // on the controls keep their own behaviour.
  const handleContainerClick = (target: EventTarget) => {
    if (target instanceof Element && target.closest("button, label, input")) {
      return;
    }
    textareaRef.current?.focus();
  };

  const canSubmit = value.trim().length > 0;

  return (
    <div className={cn("w-full py-4", className)}>
      <div className="relative mx-auto w-full max-w-xl">
        {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents lint/a11y/noNoninteractiveElementInteractions: pointer-only shortcut; the textarea and buttons inside are keyboard reachable */}
        <div
          className={cn(
            "relative flex w-full cursor-text flex-col rounded-xl text-left transition-shadow duration-200",
            "ring-1 ring-black/10 dark:ring-white/10",
            "has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-sky-600 dark:has-[textarea:focus-visible]:ring-sky-500"
          )}
          onClick={(e) => handleContainerClick(e.target)}
        >
          <Textarea
            aria-label={placeholder}
            className="min-h-[52px] w-full resize-none rounded-xl rounded-b-none border-none bg-black/5 px-4 py-3 leading-[1.2] placeholder:text-black/70 focus-visible:ring-0 dark:bg-white/5 dark:text-white dark:placeholder:text-white/70"
            onChange={(e) => {
              setValue(e.target.value);
              adjustHeight();
            }}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={placeholder}
            ref={textareaRef}
            value={value}
          />

          <div className="flex items-center justify-between rounded-b-xl bg-black/5 px-3 pt-1 pb-3 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <label className="group/attach cursor-pointer rounded-lg bg-black/5 p-2 transition-transform has-focus-visible:ring-2 has-focus-visible:ring-sky-600 motion-safe:active:scale-[0.97] dark:bg-white/5 dark:has-focus-visible:ring-sky-500">
                <input
                  aria-label="Attach file"
                  className="sr-only"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    // Clear so picking the same file again still fires onChange.
                    e.target.value = "";
                    if (files.length > 0) {
                      onFilesSelected?.(files);
                    }
                  }}
                  type="file"
                />
                <Paperclip className="h-4 w-4 text-black/40 transition-colors group-hover/attach:text-black dark:text-white/40 dark:group-hover/attach:text-white" />
              </label>
              <button
                aria-label={searchLabel}
                aria-pressed={webSearch}
                className={cn(
                  "flex h-8 cursor-pointer items-center gap-2 rounded-full border px-1.5 py-1 transition-[color,background-color,border-color,scale]",
                  webSearch
                    ? "border-sky-400 bg-sky-500/15 text-sky-500"
                    : "border-transparent bg-black/5 text-black/40 hover:text-black dark:bg-white/5 dark:text-white/40 dark:hover:text-white",
                  "motion-safe:active:scale-[0.97]"
                )}
                onClick={toggleWebSearch}
                type="button"
              >
                <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                  <motion.div
                    transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
                    whileHover={
                      shouldReduceMotion
                        ? undefined
                        : { rotate: 15, scale: 1.1 }
                    }
                  >
                    <Globe
                      className={cn(
                        "h-4 w-4",
                        webSearch ? "text-sky-500" : "text-inherit"
                      )}
                    />
                  </motion.div>
                </div>
                <AnimatePresence initial={false}>
                  {webSearch && (
                    <motion.span
                      animate={{
                        width: "auto",
                        opacity: 1,
                      }}
                      className="shrink-0 overflow-hidden whitespace-nowrap text-sky-500 text-sm"
                      exit={{
                        width: 0,
                        opacity: 0,
                        transition: { duration: 0.15, ease: EASE_OUT },
                      }}
                      initial={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: EASE_OUT }}
                    >
                      {searchLabel}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
            <button
              aria-label="Send"
              className={cn(
                "rounded-lg p-2 transition-[color,background-color,scale] motion-safe:active:scale-[0.97]",
                canSubmit
                  ? "cursor-pointer bg-sky-500/15 text-sky-500"
                  : "bg-black/5 text-black/40 dark:bg-white/5 dark:text-white/40"
              )}
              disabled={!canSubmit}
              onClick={handleSubmit}
              type="button"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
