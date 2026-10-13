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

interface AIInputSearchProps {
  placeholder?: string;
  searchLabel?: string;
  onSubmit?: (value: string) => void;
  className?: string;
}

export default function AI_Input_Search({
  placeholder = "Search the web...",
  searchLabel = "Search",
  onSubmit,
  className,
}: AIInputSearchProps) {
  const [value, setValue] = useState("");
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 52,
    maxHeight: 200,
  });
  const [showSearch, setShowSearch] = useState(true);
  const shouldReduceMotion = useReducedMotion();
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = () => {
    if (!value.trim()) {
      return;
    }
    onSubmit?.(value);
    setValue("");
    adjustHeight(true);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
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
            isFocused && "ring-black/20 dark:ring-white/20"
          )}
          onClick={(e) => handleContainerClick(e.target)}
        >
          <div className="max-h-[200px] overflow-y-auto">
            <Textarea
              aria-label={placeholder}
              className="w-full resize-none rounded-xl rounded-b-none border-none bg-black/5 px-4 py-3 leading-[1.2] placeholder:text-black/70 focus-visible:ring-0 dark:bg-white/5 dark:text-white dark:placeholder:text-white/70"
              onBlur={handleBlur}
              onChange={(e) => {
                setValue(e.target.value);
                adjustHeight();
              }}
              onFocus={handleFocus}
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
          </div>

          <div className="h-12 rounded-b-xl bg-black/5 dark:bg-white/5">
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <label className="cursor-pointer rounded-lg bg-black/5 p-2 has-focus-visible:ring-2 has-focus-visible:ring-sky-600 dark:bg-white/5 dark:has-focus-visible:ring-sky-500">
                <input
                  aria-label="Attach file"
                  className="sr-only"
                  type="file"
                />
                <Paperclip className="h-4 w-4 text-black/40 transition-colors hover:text-black dark:text-white/40 dark:hover:text-white" />
              </label>
              <button
                aria-label={searchLabel}
                aria-pressed={showSearch}
                className={cn(
                  "flex h-8 cursor-pointer items-center gap-2 rounded-full border px-1.5 py-1 transition-all",
                  showSearch
                    ? "border-sky-400 bg-sky-500/15 text-sky-500"
                    : "border-transparent bg-black/5 text-black/40 hover:text-black dark:bg-white/5 dark:text-white/40 dark:hover:text-white",
                  "motion-safe:active:scale-[0.97]"
                )}
                onClick={() => {
                  setShowSearch(!showSearch);
                }}
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
                        showSearch ? "text-sky-500" : "text-inherit"
                      )}
                    />
                  </motion.div>
                </div>
                <AnimatePresence initial={false}>
                  {showSearch && (
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
            <div className="absolute right-3 bottom-3">
              <button
                aria-label="Send"
                className={cn(
                  "rounded-lg p-2 transition-colors",
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
    </div>
  );
}
