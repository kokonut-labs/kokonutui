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

import {
  AlignLeft,
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  Code2,
  FileText,
  Languages,
  Lightbulb,
  Paperclip,
  Slash,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
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

// Decorative: each icon sits next to the model name, which carries the label.
const OPENAI_ICON = (
  <svg
    aria-hidden="true"
    fill="currentColor"
    height="1em"
    preserveAspectRatio="xMidYMid"
    viewBox="0 0 256 260"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483Zm-97.56 136.338a48.397 48.397 0 0 1-31.105-11.255l1.535-.87 51.67-29.825a8.595 8.595 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601Zm-104.466-44.61a48.345 48.345 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.339 8.339 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803ZM23.549 85.38a48.499 48.499 0 0 1 25.58-21.333v61.39a8.288 8.288 0 0 0 4.195 7.316l62.874 36.272-21.845 12.636a.819.819 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405v.256Zm179.466 41.695-63.08-36.63L161.73 77.86a.819.819 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.544 8.544 0 0 0-4.4-7.213Zm21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.716.716 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391v.205ZM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87-51.67 29.825a8.595 8.595 0 0 0-4.246 7.367l-.051 72.697Zm11.868-25.58 28.138-16.217 28.188 16.218v32.434l-28.086 16.218-28.188-16.218-.052-32.434Z" />
  </svg>
);

// Rendered once in the trigger and once in the menu, so every instance needs
// its own gradient id.
function GeminiIcon() {
  const gradientId = useId();

  return (
    <svg
      aria-hidden="true"
      height="1em"
      style={{ flex: "none", lineHeight: "1" }}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
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

export interface PromptCommand {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

export interface PromptAttachment {
  id: string;
  file: File;
}

interface AIPromptProps {
  models?: string[];
  defaultModel?: string;
  placeholder?: string;
  headerText?: string;
  headerAction?: string;
  /**
   * Sends the message. Return a promise to show the Stop button until it
   * settles; `signal` aborts when the user presses Stop. Without it, the
   * component plays a short pretend reply so the demo feels alive.
   */
  onSubmit?: (
    value: string,
    model: string,
    options: {
      files: File[];
      signal: AbortSignal;
      command: PromptCommand | null;
    }
  ) => unknown;
  /** Shown when the message starts with "/". Pass [] to turn the menu off. */
  commands?: PromptCommand[];
  /** Called when the user presses Stop while a reply is in progress. */
  onStop?: () => void;
  /** Called with the files picked, dropped or pasted into the prompt. */
  onAttach?: (files: FileList | File[]) => void;
  className?: string;
}

const DEFAULT_COMMANDS: PromptCommand[] = [
  {
    id: "summarize",
    label: "Summarize",
    description: "Shorten text or files",
    icon: <AlignLeft className="size-4" />,
  },
  {
    id: "translate",
    label: "Translate",
    description: "Into another language",
    icon: <Languages className="size-4" />,
  },
  {
    id: "explain",
    label: "Explain",
    description: "Step by step, in plain words",
    icon: <Lightbulb className="size-4" />,
  },
  {
    id: "code",
    label: "Write code",
    description: "Functions, tests and fixes",
    icon: <Code2 className="size-4" />,
  },
];

const DEFAULT_MODELS = [
  "Gemini 3 Pro",
  "GPT-5.6 Mini",
  "Claude Fable 5",
  "GPT-5.6 Codex",
  "GPT-5.6",
];

const ANTHROPIC_ICON = (
  <svg
    aria-hidden="true"
    fill="currentColor"
    fillRule="evenodd"
    height="1em"
    style={{ flex: "none", lineHeight: "1" }}
    viewBox="0 0 24 24"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z" />
  </svg>
);

const MODEL_ICONS: Record<string, ReactNode> = {
  "GPT-5.6 Mini": OPENAI_ICON,
  "Gemini 3 Pro": <GeminiIcon />,
  "Claude Fable 5": ANTHROPIC_ICON,
  "GPT-5.6 Codex": OPENAI_ICON,
  "GPT-5.6": OPENAI_ICON,
};

const getModelIcon = (model: string) =>
  MODEL_ICONS[model] ?? (
    <Bot aria-hidden="true" className="h-4 w-4 opacity-50" />
  );

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const DEMO_REPLY_MS = 2400;
const WHITESPACE = /\s/;

const formatSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const waitFor = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(id);
      resolve();
    });
  });

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: PromptAttachment;
  onRemove: () => void;
}) {
  const { file } = attachment;
  const isImage = file.type.startsWith("image/");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Object URLs are created after mount and revoked on unmount, so a
  // removed chip doesn't keep its image in memory.
  useEffect(() => {
    if (!isImage) {
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <motion.li
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      className="flex h-11 max-w-52 items-center gap-2 rounded-lg bg-white py-1 pr-1.5 pl-1 ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/10"
      exit={{
        opacity: 0,
        filter: "blur(2px)",
        transition: { duration: 0.12, ease: EASE_OUT },
      }}
      initial={{ opacity: 0, y: 4, filter: "blur(2px)" }}
      layout="position"
      transition={{ duration: 0.2, ease: EASE_OUT }}
    >
      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/60">
        {previewUrl ? (
          // biome-ignore lint/performance/noImgElement: object URL preview, nothing to optimise
          <img
            alt=""
            className="size-full object-cover"
            height={36}
            src={previewUrl}
            width={36}
          />
        ) : (
          <FileText aria-hidden="true" className="size-4" />
        )}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-black text-xs dark:text-white">
          {file.name}
        </span>
        <span className="block text-[10px] text-black/50 tabular-nums dark:text-white/50">
          {formatSize(file.size)}
        </span>
      </span>
      <button
        aria-label={`Remove ${file.name}`}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-black/40 transition-colors duration-150 hover:bg-black/5 hover:text-black focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-blue-500 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
        onClick={onRemove}
        type="button"
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </motion.li>
  );
}

function CommandMenu({
  id,
  commands,
  activeIndex,
  onHover,
  onSelect,
}: {
  id: string;
  commands: PromptCommand[];
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (command: PromptCommand) => void;
}) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="absolute inset-x-0 bottom-full z-10 mb-2 origin-bottom rounded-xl bg-white p-1 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.18)] ring-1 ring-black/10 dark:bg-zinc-900 dark:ring-white/10"
      exit={{ opacity: 0, y: 2, scale: 0.98, transition: { duration: 0.1 } }}
      initial={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: 0.15, ease: EASE_OUT }}
    >
      {/* The highlight follows the keyboard instantly, without a transition. */}
      <div aria-label="Commands" id={id} role="listbox">
        {commands.map((command, i) => (
          // biome-ignore lint/a11y/useKeyWithClickEvents: options are driven from the textarea with the arrow keys
          <div
            aria-selected={i === activeIndex}
            className={cn(
              "flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2",
              i === activeIndex && "bg-black/5 dark:bg-white/10"
            )}
            id={`${id}-${command.id}`}
            key={command.id}
            onClick={() => onSelect(command)}
            onMouseDown={(e) => e.preventDefault()}
            onPointerMove={() => onHover(i)}
            role="option"
            tabIndex={-1}
          >
            <span className="flex size-6 shrink-0 items-center justify-center text-black/50 dark:text-white/60 [&_svg]:size-4">
              {command.icon ?? <Slash />}
            </span>
            <span className="text-black text-sm dark:text-white">
              {command.label}
            </span>
            {command.description && (
              <span className="min-w-0 truncate text-black/40 text-xs dark:text-white/40">
                {command.description}
              </span>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function CommandPill({
  command,
  onRemove,
}: {
  command: PromptCommand;
  onRemove: () => void;
}) {
  return (
    <motion.li
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      className="flex h-11 items-center gap-1.5 rounded-lg bg-blue-500/10 pr-1.5 pl-2.5 text-blue-600 text-sm dark:text-blue-400"
      exit={{
        opacity: 0,
        filter: "blur(2px)",
        transition: { duration: 0.12, ease: EASE_OUT },
      }}
      initial={{ opacity: 0, y: 4, filter: "blur(2px)" }}
      layout="position"
      transition={{ duration: 0.2, ease: EASE_OUT }}
    >
      <span aria-hidden="true" className="opacity-60">
        /
      </span>
      {command.label}
      <button
        aria-label={`Remove ${command.label} command`}
        className="flex size-6 items-center justify-center rounded-md transition-colors duration-150 hover:bg-blue-500/10 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-blue-500"
        onClick={onRemove}
        type="button"
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </motion.li>
  );
}

function SendButton({
  responding,
  canSend,
  onSend,
  onStop,
}: {
  responding: boolean;
  canSend: boolean;
  onSend: () => void;
  onStop: () => void;
}) {
  // One button with two faces. The faces crossfade with a little blur, so
  // Send turning into Stop reads as the same control changing state.
  const face =
    "absolute inset-0 flex items-center justify-center transition-[opacity,filter] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]";
  return (
    <button
      aria-label={responding ? "Stop response" : "Send message"}
      className={cn(
        "relative size-8 rounded-lg",
        "focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-blue-500",
        "transition-[background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
        responding
          ? "bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
          : "bg-black/5 hover:bg-black/10 disabled:pointer-events-none dark:bg-white/5 dark:hover:bg-white/10"
      )}
      disabled={!(responding || canSend)}
      onClick={responding ? onStop : onSend}
      type="button"
    >
      <span
        aria-hidden="true"
        className={cn(
          face,
          responding ? "opacity-0 blur-[2px]" : "opacity-100 blur-0"
        )}
      >
        <ArrowRight
          className={cn(
            "h-4 w-4 transition-opacity duration-200 dark:text-white",
            canSend ? "opacity-100" : "opacity-30"
          )}
        />
      </span>
      <span
        aria-hidden="true"
        className={cn(
          face,
          responding ? "opacity-100 blur-0" : "opacity-0 blur-[2px]"
        )}
      >
        <span className="size-2.5 rounded-[2px] bg-current" />
      </span>
    </button>
  );
}

export default function AI_Prompt({
  models = DEFAULT_MODELS,
  defaultModel = "Claude Fable 5",
  placeholder = "What can I do for you? Type / for commands",
  headerText = "is free this weekend!",
  headerAction = "Ship Now!",
  onSubmit,
  onStop,
  onAttach,
  commands = DEFAULT_COMMANDS,
  className,
}: AIPromptProps) {
  const [value, setValue] = useState("");
  const [command, setCommand] = useState<PromptCommand | null>(null);
  const [menuIndex, setMenuIndex] = useState(0);
  const [menuDismissed, setMenuDismissed] = useState(false);
  const menuId = useId();
  const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
  const [responding, setResponding] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const nextIdRef = useRef(0);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 72,
    maxHeight: 300,
  });
  // A default that is not in `models` would show a model the menu can't pick.
  const [selectedModel, setSelectedModel] = useState(() =>
    models.includes(defaultModel) ? defaultModel : (models[0] ?? defaultModel)
  );
  const textareaId = useId();
  const shouldReduceMotion = useReducedMotion();
  const labelOffset = shouldReduceMotion ? 0 : 5;

  useEffect(() => () => abortRef.current?.abort(), []);

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) {
      return;
    }
    onAttach?.(files);
    setAttachments((current) => [
      ...current,
      ...list.map((file) => {
        nextIdRef.current += 1;
        return { id: `attachment-${nextIdRef.current}`, file };
      }),
    ]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) => current.filter((a) => a.id !== id));
    textareaRef.current?.focus();
  };

  // "/" at the very start opens the menu; the text after it filters it.
  const slashQuery =
    !command && value.startsWith("/") && !WHITESPACE.test(value)
      ? value.slice(1).toLowerCase()
      : null;
  const matches =
    slashQuery === null
      ? []
      : commands.filter((c) => c.label.toLowerCase().includes(slashQuery));
  const menuOpen = matches.length > 0 && !menuDismissed;
  const activeIndex = Math.min(menuIndex, matches.length - 1);

  const pickCommand = (picked: PromptCommand) => {
    setCommand(picked);
    setValue("");
    setMenuIndex(0);
    adjustHeight(true);
    textareaRef.current?.focus();
  };

  const canSend = value.trim().length > 0 && !responding;

  const submit = async () => {
    if (!canSend) {
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const files = attachments.map((a) => a.file);
    const sentCommand = command;
    setValue("");
    setAttachments([]);
    setCommand(null);
    adjustHeight(true);
    setResponding(true);
    try {
      await (onSubmit
        ? onSubmit(value, selectedModel, {
            files,
            signal: controller.signal,
            command: sentCommand,
          })
        : waitFor(DEMO_REPLY_MS, controller.signal));
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setResponding(false);
      }
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setResponding(false);
    onStop?.();
    textareaRef.current?.focus();
  };

  const handleMenuKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (step) {
      e.preventDefault();
      setMenuIndex((activeIndex + step + matches.length) % matches.length);
      return true;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pickCommand(matches[activeIndex]);
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setMenuDismissed(true);
      return true;
    }
    return false;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) {
      return;
    }
    if (menuOpen && handleMenuKey(e)) {
      return;
    }
    // Backspace in an empty prompt takes the command off first.
    if (e.key === "Backspace" && command && value === "") {
      e.preventDefault();
      setCommand(null);
      return;
    }
    // Enter during IME composition confirms the candidate; it must not submit.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape" && responding) {
      e.preventDefault();
      stop();
    }
  };

  const hasFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types).includes("Files");

  return (
    <div className={cn("w-full max-w-md py-4", className)}>
      <div className="rounded-2xl bg-black/5 p-1.5 pt-4 dark:bg-white/5">
        <div className="mx-2 mb-2.5 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2">
            <Anthropic className="h-3.5 w-3.5 text-black dark:hidden" />
            <AnthropicDark className="hidden h-3.5 w-3.5 dark:block" />
            <p className="text-black text-xs tracking-tighter dark:text-white/90">
              {headerText}
            </p>
          </div>
          <p className="text-black text-xs tracking-tighter dark:text-white/90">
            {headerAction}
          </p>
        </div>
        {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/noNoninteractiveElementInteractions: drop target for files; keyboard users have the attach button */}
        <div
          className={cn(
            "relative flex flex-col rounded-xl has-[textarea:focus-visible]:ring-1 has-[textarea:focus-visible]:ring-blue-500",
            isDragging && "ring-1 ring-blue-500"
          )}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setIsDragging(false);
            }
          }}
          onDragOver={(e) => {
            if (hasFiles(e)) {
              e.preventDefault();
              setIsDragging(true);
            }
          }}
          onDrop={(e) => {
            if (!hasFiles(e)) {
              return;
            }
            e.preventDefault();
            setIsDragging(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <AnimatePresence initial={false}>
            {(attachments.length > 0 || command) && (
              <motion.div
                animate={{ height: "auto", opacity: 1 }}
                className="overflow-hidden rounded-t-xl bg-black/5 dark:bg-white/5"
                exit={{ height: 0, opacity: 0 }}
                initial={{ height: 0, opacity: 0 }}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.2,
                  ease: EASE_OUT,
                }}
              >
                <ul
                  aria-label="Attachments"
                  className="flex flex-wrap gap-2 px-3 pt-3"
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    {command && (
                      <CommandPill
                        command={command}
                        key={`command-${command.id}`}
                        onRemove={() => {
                          setCommand(null);
                          textareaRef.current?.focus();
                        }}
                      />
                    )}
                    {attachments.map((attachment) => (
                      <AttachmentChip
                        attachment={attachment}
                        key={attachment.id}
                        onRemove={() => removeAttachment(attachment.id)}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
          <label className="sr-only" htmlFor={textareaId}>
            Message
          </label>
          <AnimatePresence>
            {menuOpen && (
              <CommandMenu
                activeIndex={activeIndex}
                commands={matches}
                id={menuId}
                onHover={setMenuIndex}
                onSelect={pickCommand}
              />
            )}
          </AnimatePresence>
          <Textarea
            aria-activedescendant={
              menuOpen ? `${menuId}-${matches[activeIndex].id}` : undefined
            }
            aria-autocomplete="list"
            aria-controls={menuOpen ? menuId : undefined}
            aria-expanded={menuOpen}
            className={cn(
              "w-full resize-none rounded-xl rounded-b-none border-none bg-black/5 px-4 py-3 placeholder:text-black/70 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-white/5 dark:text-white dark:placeholder:text-white/70",
              "min-h-[72px]",
              (attachments.length > 0 || command) && "rounded-t-none"
            )}
            id={textareaId}
            onBlur={() => setMenuDismissed(true)}
            onChange={(e) => {
              setValue(e.target.value);
              setMenuDismissed(false);
              setMenuIndex(0);
              adjustHeight();
            }}
            onFocus={() => setMenuDismissed(false)}
            onKeyDown={handleKeyDown}
            onPaste={(e) => {
              if (e.clipboardData.files.length > 0) {
                e.preventDefault();
                addFiles(e.clipboardData.files);
              }
            }}
            placeholder={placeholder}
            ref={textareaRef}
            value={value}
          />

          <div className="flex h-14 items-center justify-between rounded-b-xl bg-black/5 px-3 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="relative flex h-8 items-center gap-1 rounded-md pr-2 pl-1 text-xs hover:bg-black/10 focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:ring-offset-0 dark:text-white dark:hover:bg-white/10"
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
                          ease: EASE_OUT,
                        }}
                      >
                        {getModelIcon(selectedModel)}
                        {selectedModel}
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </motion.div>
                    </AnimatePresence>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-[10rem] border-black/10 dark:border-white/10">
                  {models.map((model) => (
                    <DropdownMenuItem
                      className="flex items-center justify-between gap-2"
                      key={model}
                      onSelect={() => setSelectedModel(model)}
                    >
                      <div className="flex items-center gap-2">
                        {getModelIcon(model)}
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
                className={cn(
                  "cursor-pointer rounded-lg bg-black/5 p-2 dark:bg-white/5",
                  "hover:bg-black/10 has-focus-visible:ring-1 has-focus-visible:ring-blue-500 has-focus-visible:ring-offset-0 dark:hover:bg-white/10",
                  "text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white",
                  "transition-[background-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
                )}
              >
                <input
                  aria-label="Attach files"
                  className="sr-only"
                  multiple
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      addFiles(e.target.files);
                    }
                    // Cleared so picking the same file again still fires.
                    e.target.value = "";
                  }}
                  type="file"
                />
                <Paperclip className="h-4 w-4 transition-colors" />
              </label>
            </div>
            <SendButton
              canSend={canSend}
              onSend={submit}
              onStop={stop}
              responding={responding}
            />
          </div>

          {/* Shown while files are dragged over the prompt. */}
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl border border-blue-500/50 border-dashed bg-white/80 text-blue-600 text-xs transition-opacity duration-150 dark:bg-black/70 dark:text-blue-400",
              isDragging ? "opacity-100" : "opacity-0"
            )}
          >
            Drop files to attach
          </div>
        </div>
      </div>
    </div>
  );
}
