"use client";

/**
 * @author: @kokonutui
 * @description: AI Input Search
 * @version: 1.1.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ArrowUp, FileText, Globe, Paperclip, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_OUT_CSS = "ease-[cubic-bezier(0.23,1,0.32,1)]";

export interface AIInputSearchProps {
  /** Placeholder while web search is on. */
  placeholder?: string;
  /** Placeholder while web search is off, when the input is a plain chat. */
  chatPlaceholder?: string;
  searchLabel?: string;
  /** Receives the text, whether web search was on, and the attached files. */
  onSubmit?: (
    value: string,
    options: { webSearch: boolean; files: File[] }
  ) => void;
  /** Called with the files picked through the attach button. */
  onFilesSelected?: (files: File[]) => void;
  /** Controlled web-search state. Leave unset to let the component own it. */
  webSearch?: boolean;
  defaultWebSearch?: boolean;
  onWebSearchChange?: (webSearch: boolean) => void;
  className?: string;
}

interface Attachment {
  id: number;
  file: File;
}

function FileChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  return (
    <motion.li
      animate={{ opacity: 1, filter: "blur(0px)" }}
      className="flex h-7 max-w-48 items-center gap-1.5 rounded-md bg-white pr-0.5 pl-2 text-black/70 text-xs ring-1 ring-black/5 dark:bg-white/10 dark:text-white/80 dark:ring-white/10"
      exit={{
        opacity: 0,
        filter: "blur(2px)",
        transition: { duration: 0.12, ease: EASE_OUT },
      }}
      initial={{ opacity: 0, filter: "blur(2px)" }}
      layout="position"
      transition={{ duration: 0.18, ease: EASE_OUT }}
    >
      <FileText aria-hidden="true" className="size-3.5 shrink-0 opacity-60" />
      <span className="truncate">{file.name}</span>
      <button
        aria-label={`Remove ${file.name}`}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded text-black/40 hover:bg-black/5 hover:text-black dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white",
          "transition-[background-color,color] duration-150",
          EASE_OUT_CSS,
          "focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-sky-500"
        )}
        onClick={onRemove}
        type="button"
      >
        <X aria-hidden="true" className="size-3" />
      </button>
    </motion.li>
  );
}

function SearchToggle({
  on,
  label,
  onToggle,
}: {
  on: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      aria-pressed={on}
      className={cn(
        "flex h-8 cursor-pointer items-center rounded-full border pr-2 pl-[7px]",
        "transition-[color,background-color,border-color] duration-150",
        EASE_OUT_CSS,
        "focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-sky-500",
        on
          ? "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400"
          : "border-transparent text-black/50 hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
      )}
      onClick={onToggle}
      title={on ? `${label} on` : `${label} off`}
      type="button"
    >
      <Globe aria-hidden="true" className="size-4 shrink-0" />
      {/* The label is always there for screen readers; it only folds away
          visually, with a clip so the pill closes around the icon. */}
      <span
        className={cn(
          "grid transition-[grid-template-columns,opacity] duration-200",
          EASE_OUT_CSS,
          on ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0"
        )}
      >
        <span className="overflow-hidden whitespace-nowrap pl-1.5 text-sm">
          {label}
        </span>
      </span>
    </button>
  );
}

export default function AI_Input_Search({
  placeholder = "Search the web…",
  chatPlaceholder = "Ask anything…",
  searchLabel = "Search",
  onSubmit,
  onFilesSelected,
  webSearch: webSearchProp,
  defaultWebSearch = true,
  onWebSearchChange,
  className,
}: AIInputSearchProps) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const nextIdRef = useRef(0);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 52,
    maxHeight: 200,
  });
  const [uncontrolledWebSearch, setUncontrolledWebSearch] =
    useState(defaultWebSearch);
  const webSearch = webSearchProp ?? uncontrolledWebSearch;

  const toggleWebSearch = () => {
    const next = !webSearch;
    if (webSearchProp === undefined) {
      setUncontrolledWebSearch(next);
    }
    onWebSearchChange?.(next);
    // Back to typing: the toggle is a modifier on what you're writing.
    textareaRef.current?.focus();
  };

  const addFiles = (files: File[]) => {
    onFilesSelected?.(files);
    setAttachments((current) => [
      ...current,
      ...files.map((file) => {
        nextIdRef.current += 1;
        return { id: nextIdRef.current, file };
      }),
    ]);
  };

  const removeAttachment = (id: number) => {
    setAttachments((current) => current.filter((a) => a.id !== id));
    textareaRef.current?.focus();
  };

  const handleSubmit = () => {
    if (!value.trim()) {
      return;
    }
    onSubmit?.(value, { webSearch, files: attachments.map((a) => a.file) });
    setValue("");
    setAttachments([]);
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
            "relative flex w-full cursor-text flex-col rounded-xl bg-black/5 text-left dark:bg-white/5",
            "ring-1 ring-black/10 transition-shadow duration-150 dark:ring-white/10",
            "has-[textarea:focus-visible]:ring-sky-500/70 dark:has-[textarea:focus-visible]:ring-sky-400/60"
          )}
          onClick={(e) => handleContainerClick(e.target)}
        >
          <AnimatePresence initial={false}>
            {attachments.length > 0 && (
              <motion.div
                animate={{ height: "auto", opacity: 1 }}
                className="overflow-hidden"
                exit={{ height: 0, opacity: 0 }}
                initial={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                <ul
                  aria-label="Attached files"
                  className="flex flex-wrap gap-1.5 px-3 pt-3"
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    {attachments.map((a) => (
                      <FileChip
                        file={a.file}
                        key={a.id}
                        onRemove={() => removeAttachment(a.id)}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              </motion.div>
            )}
          </AnimatePresence>

          <Textarea
            aria-label={webSearch ? placeholder : chatPlaceholder}
            className="min-h-[52px] w-full resize-none rounded-xl border-none bg-transparent px-4 py-3 text-black leading-relaxed placeholder:text-black/40 focus-visible:ring-0 dark:bg-transparent dark:text-white dark:placeholder:text-white/40"
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
            // The placeholder says what Enter will do in each mode.
            placeholder={webSearch ? placeholder : chatPlaceholder}
            ref={textareaRef}
            value={value}
          />

          <div className="flex items-center justify-between px-3 pt-1 pb-3">
            <div className="flex items-center gap-1">
              <label
                className={cn(
                  "flex size-8 cursor-pointer items-center justify-center rounded-lg text-black/50 hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white",
                  "transition-[background-color,color] duration-150",
                  EASE_OUT_CSS,
                  "has-focus-visible:ring-1 has-focus-visible:ring-sky-500"
                )}
                title="Attach files"
              >
                <input
                  aria-label="Attach files"
                  className="sr-only"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    // Clear so picking the same file again still fires onChange.
                    e.target.value = "";
                    if (files.length > 0) {
                      addFiles(files);
                    }
                  }}
                  type="file"
                />
                <Paperclip aria-hidden="true" className="size-4" />
              </label>
              <SearchToggle
                label={searchLabel}
                on={webSearch}
                onToggle={toggleWebSearch}
              />
            </div>
            <button
              aria-label={webSearch ? "Search" : "Send"}
              className={cn(
                "flex size-8 items-center justify-center rounded-lg transition-[color,background-color] duration-150",
                EASE_OUT_CSS,
                "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500/50",
                // Fills once there is something to send.
                canSubmit
                  ? "cursor-pointer bg-sky-500 text-white hover:bg-sky-600"
                  : "bg-black/5 text-black/30 dark:bg-white/5 dark:text-white/30"
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
