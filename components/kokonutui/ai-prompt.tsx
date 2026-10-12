"use client";

/**
 * @author: @kokonutui
 * @description: AI Prompt Input
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ArrowRight, Bot, Check, ChevronDown, Paperclip } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import Anthropic from "@/components/icons/anthropic";
import AnthropicDark from "@/components/icons/anthropic-dark";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { cn } from "@/lib/utils";

const OPENAI_SVG = (
  <div>
    <svg
      aria-label="OpenAI icon"
      className="block dark:hidden"
      height="260"
      preserveAspectRatio="xMidYMid"
      viewBox="0 0 256 260"
      width="256"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>OpenAI Icon Light</title>
      <path d="M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483Zm-97.56 136.338a48.397 48.397 0 0 1-31.105-11.255l1.535-.87 51.67-29.825a8.595 8.595 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601Zm-104.466-44.61a48.345 48.345 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.339 8.339 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803ZM23.549 85.38a48.499 48.499 0 0 1 25.58-21.333v61.39a8.288 8.288 0 0 0 4.195 7.316l62.874 36.272-21.845 12.636a.819.819 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405v.256Zm179.466 41.695-63.08-36.63L161.73 77.86a.819.819 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.544 8.544 0 0 0-4.4-7.213Zm21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.716.716 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391v.205ZM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87-51.67 29.825a8.595 8.595 0 0 0-4.246 7.367l-.051 72.697Zm11.868-25.58 28.138-16.217 28.188 16.218v32.434l-28.086 16.218-28.188-16.218-.052-32.434Z" />
    </svg>
    <svg
      aria-label="OpenAI icon"
      className="hidden dark:block"
      height="260"
      preserveAspectRatio="xMidYMid"
      viewBox="0 0 256 260"
      width="256"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>OpenAI Icon Dark</title>
      <path
        d="M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483Zm-97.56 136.338a48.397 48.397 0 0 1-31.105-11.255l1.535-.87 51.67-29.825a8.595 8.595 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601Zm-104.466-44.61a48.345 48.345 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.339 8.339 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803ZM23.549 85.38a48.499 48.499 0 0 1 25.58-21.333v61.39a8.288 8.288 0 0 0 4.195 7.316l62.874 36.272-21.845 12.636a.819.819 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405v.256Zm179.466 41.695-63.08-36.63L161.73 77.86a.819.819 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.544 8.544 0 0 0-4.4-7.213Zm21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.716.716 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391v.205ZM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87-51.67 29.825a8.595 8.595 0 0 0-4.246 7.367l-.051 72.697Zm11.868-25.58 28.138-16.217 28.188 16.218v32.434l-28.086 16.218-28.188-16.218-.052-32.434Z"
        fill="#fff"
      />
    </svg>
  </div>
);

// Rendered once in the trigger and once in the menu, so every instance needs
// its own gradient id.
function GeminiIcon() {
  const gradientId = useId();

  return (
    <svg
      height="1em"
      style={{ flex: "none", lineHeight: "1" }}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Gemini</title>
      <defs>
        <linearGradient
          id={gradientId}
          x1="0%"
          x2="68.73%"
          y1="100%"
          y2="30.395%"
        >
          <stop offset="0%" stopColor="#1C7DFF" />
          <stop offset="52.021%" stopColor="#1C69FF" />
          <stop offset="100%" stopColor="#F0DCD6" />
        </linearGradient>
      </defs>
      <path
        d="M12 24A14.304 14.304 0 000 12 14.304 14.304 0 0012 0a14.305 14.305 0 0012 12 14.305 14.305 0 00-12 12"
        fill={`url(#${gradientId})`}
        fillRule="nonzero"
      />
    </svg>
  );
}

interface AIPromptProps {
  models?: string[];
  defaultModel?: string;
  placeholder?: string;
  headerText?: string;
  headerAction?: string;
  onSubmit?: (value: string, model: string) => void;
  className?: string;
}

const DEFAULT_MODELS = [
  "Gemini 3 Pro",
  "GPT-5.6 Mini",
  "Claude Fable 5",
  "GPT-5.6 Codex",
  "GPT-5.6",
];

export default function AI_Prompt({
  models = DEFAULT_MODELS,
  defaultModel = "Claude Fable 5",
  placeholder = "What can I do for you?",
  headerText = "is free this weekend!",
  headerAction = "Ship Now!",
  onSubmit,
  className,
}: AIPromptProps) {
  const [value, setValue] = useState("");
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 72,
    maxHeight: 300,
  });
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const textareaId = useId();
  const shouldReduceMotion = useReducedMotion();
  const labelOffset = shouldReduceMotion ? 0 : 5;

  const MODEL_ICONS: Record<string, React.ReactNode> = {
    "GPT-5.6 Mini": OPENAI_SVG,
    "Gemini 3 Pro": <GeminiIcon />,
    "Claude Fable 5": (
      <div>
        <svg
          className="block dark:hidden"
          fill="#000"
          fillRule="evenodd"
          style={{ flex: "none", lineHeight: "1" }}
          viewBox="0 0 24 24"
          width="1em"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>Anthropic Icon Light</title>
          <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z" />
        </svg>
        <svg
          className="hidden dark:block"
          fill="#ffff"
          fillRule="evenodd"
          style={{ flex: "none", lineHeight: "1" }}
          viewBox="0 0 24 24"
          width="1em"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>Anthropic Icon Dark</title>
          <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z" />
        </svg>
      </div>
    ),
    "GPT-5.6 Codex": OPENAI_SVG,
    "GPT-5.6": OPENAI_SVG,
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.(value, selectedModel);
      setValue("");
      adjustHeight(true);
    }
  };

  return (
    <div className={cn("w-4/6 py-4", className)}>
      <div className="rounded-2xl bg-black/5 p-1.5 pt-4 dark:bg-white/5">
        <div className="mx-2 mb-2.5 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2">
            <Anthropic className="h-3.5 w-3.5 text-black dark:hidden" />
            <AnthropicDark className="hidden h-3.5 w-3.5 dark:block" />
            <h3 className="text-black text-xs tracking-tighter dark:text-white/90">
              {headerText}
            </h3>
          </div>
          <p className="text-black text-xs tracking-tighter dark:text-white/90">
            {headerAction}
          </p>
        </div>
        <div className="relative">
          <div className="relative flex flex-col">
            <Textarea
              className={cn(
                "w-full resize-none rounded-xl rounded-b-none border-none bg-black/5 px-4 py-3 placeholder:text-black/70 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-white/5 dark:text-white dark:placeholder:text-white/70",
                "min-h-[72px]"
              )}
              id={textareaId}
              onChange={(e) => {
                setValue(e.target.value);
                adjustHeight();
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              ref={textareaRef}
              value={value}
            />

            <div className="flex h-14 items-center rounded-b-xl bg-black/5 dark:bg-white/5">
              <div className="absolute right-3 bottom-3 left-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="flex h-8 items-center gap-1 rounded-md pr-2 pl-1 text-xs hover:bg-black/10 focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:ring-offset-0 dark:text-white dark:hover:bg-white/10"
                        variant="ghost"
                      >
                        <AnimatePresence initial={false} mode="popLayout">
                          <motion.div
                            animate={{
                              opacity: 1,
                              y: 0,
                            }}
                            className="flex items-center gap-1"
                            exit={{
                              opacity: 0,
                              y: labelOffset,
                            }}
                            initial={{
                              opacity: 0,
                              y: -labelOffset,
                            }}
                            key={selectedModel}
                            transition={{
                              duration: 0.15,
                              ease: [0.23, 1, 0.32, 1],
                            }}
                          >
                            {MODEL_ICONS[selectedModel]}
                            {selectedModel}
                            <ChevronDown className="h-3 w-3 opacity-50" />
                          </motion.div>
                        </AnimatePresence>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className={cn(
                        "min-w-[10rem]",
                        "border-black/10 dark:border-white/10",
                        "bg-gradient-to-b from-white via-white to-neutral-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-800"
                      )}
                    >
                      {models.map((model) => (
                        <DropdownMenuItem
                          className="flex items-center justify-between gap-2"
                          key={model}
                          onSelect={() => setSelectedModel(model)}
                        >
                          <div className="flex items-center gap-2">
                            {MODEL_ICONS[model] || (
                              <Bot className="h-4 w-4 opacity-50" />
                            )}
                            <span>{model}</span>
                          </div>
                          {selectedModel === model && (
                            <Check className="h-4 w-4 text-blue-500" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="mx-0.5 h-4 w-px bg-black/10 dark:bg-white/10" />
                  <label
                    aria-label="Attach file"
                    className={cn(
                      "cursor-pointer rounded-lg bg-black/5 p-2 dark:bg-white/5",
                      "hover:bg-black/10 focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:ring-offset-0 dark:hover:bg-white/10",
                      "text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white"
                    )}
                  >
                    <input className="hidden" type="file" />
                    <Paperclip className="h-4 w-4 transition-colors" />
                  </label>
                </div>
                <button
                  aria-label="Send message"
                  className={cn(
                    "rounded-lg bg-black/5 p-2 dark:bg-white/5",
                    "hover:bg-black/10 focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:ring-offset-0 dark:hover:bg-white/10"
                  )}
                  disabled={!value.trim()}
                  type="button"
                >
                  <ArrowRight
                    className={cn(
                      "h-4 w-4 transition-opacity duration-200 dark:text-white",
                      value.trim() ? "opacity-100" : "opacity-30"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
