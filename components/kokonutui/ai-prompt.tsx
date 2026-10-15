"use client";

/**
 * @author: @kokonutui
 * @description: AI Prompt Input
 * @version: 2.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  AlignLeft,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  Code2,
  FileText,
  Languages,
  Lightbulb,
  Plus,
  Slash,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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

export interface PromptModel {
  name: string;
  /** One line under the name in the menu. */
  description?: string;
  /**
   * Effort levels, lowest first, e.g. ["Low", "Medium", "High"]. Leave out
   * for a model without a thinking control: the Effort button hides.
   */
  efforts?: string[];
  /** Effort to start on when the model is picked fresh. */
  defaultEffort?: string;
}

interface AIPromptProps {
  models?: PromptModel[];
  /** Name of the model selected at first. */
  defaultModel?: string;
  placeholder?: string;
  /** One line above the box, e.g. a promo. Pass "" to hide the header. */
  headerText?: string;
  /** Label of the header button, which switches to `promotedModel`. */
  headerAction?: string;
  /** The model the header talks about; its icon leads the header. */
  promotedModel?: string;
  /**
   * Sends the message. Return a promise to show the Stop button until it
   * settles; `signal` aborts when the user presses Stop. Without it, the
   * component plays a short pretend reply so the demo feels alive.
   */
  onSubmit?: (
    value: string,
    model: string,
    options: {
      /** The effort level, or null for a model without one. */
      effort: string | null;
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

const DEFAULT_MODELS: PromptModel[] = [
  {
    name: "Claude Fable 5",
    description: "Most capable, for writing and analysis",
    efforts: ["Low", "Medium", "High", "Max"],
    defaultEffort: "High",
  },
  {
    name: "GPT-5.6",
    description: "A strong all-rounder",
    efforts: ["Minimal", "Low", "Medium", "High"],
    defaultEffort: "Medium",
  },
  {
    name: "GPT-5.6 Codex",
    description: "Tuned for agentic coding",
    efforts: ["Low", "Medium", "High"],
    defaultEffort: "Medium",
  },
  {
    name: "Gemini 3 Pro",
    description: "Long context and images",
    efforts: ["Low", "High"],
    defaultEffort: "High",
  },
  {
    name: "GPT-5.6 Mini",
    description: "Fastest, no thinking step",
  },
];

/** Hints for the usual effort names; other names show without one. */
const EFFORT_HINTS: Record<string, string> = {
  Minimal: "Skips reasoning almost entirely",
  Low: "Answers right away",
  Medium: "Thinks briefly first",
  High: "Thinks longer on hard problems",
  Max: "No limit on thinking",
};

const effortsOf = (model: PromptModel | undefined) => model?.efforts ?? [];

const startEffort = (model: PromptModel | undefined) => {
  const efforts = effortsOf(model);
  if (efforts.length === 0) {
    return null;
  }
  return model?.defaultEffort && efforts.includes(model.defaultEffort)
    ? model.defaultEffort
    : (efforts.at(-1) ?? null);
};

/**
 * The effort to keep when switching models: the same level if the new model
 * has it, otherwise the one at the same height on its scale.
 */
function carryEffort(
  from: PromptModel | undefined,
  to: PromptModel,
  effort: string | null
) {
  const next = effortsOf(to);
  if (next.length === 0) {
    return null;
  }
  if (effort && next.includes(effort)) {
    return effort;
  }
  const previous = effortsOf(from);
  if (!effort || previous.length < 2) {
    return startEffort(to);
  }
  const share = previous.indexOf(effort) / (previous.length - 1);
  return next[Math.round(share * (next.length - 1))] ?? startEffort(to);
}

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
      className="flex h-11 max-w-52 items-center gap-2 rounded-xl bg-black/[0.03] py-1 pr-1.5 pl-1 ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10"
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

/** Bolds the part of the label the user has typed after "/". */
function MatchedLabel({ label, query }: { label: string; query: string }) {
  const start = query ? label.toLowerCase().indexOf(query) : -1;
  if (start < 0) {
    return <>{label}</>;
  }
  const end = start + query.length;
  return (
    <>
      {label.slice(0, start)}
      <span className="font-medium text-black dark:text-white">
        {label.slice(start, end)}
      </span>
      {label.slice(end)}
    </>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-black/5 px-1 font-sans text-[10px] text-black/60 dark:bg-white/10 dark:text-white/60">
      {children}
    </kbd>
  );
}

function CommandMenu({
  id,
  commands,
  query,
  activeIndex,
  onHover,
  onSelect,
}: {
  id: string;
  commands: PromptCommand[];
  query: string | null;
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (command: PromptCommand) => void;
}) {
  // Opened by typing, so it only fades: nothing travels between the
  // keystroke and the list.
  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="absolute inset-x-0 bottom-full z-10 mb-2 rounded-xl bg-white p-1 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.18)] ring-1 ring-black/10 dark:bg-zinc-900 dark:ring-white/10"
      exit={{ opacity: 0, transition: { duration: 0.08 } }}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.12, ease: EASE_OUT }}
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
            <span className="shrink-0 text-black/80 text-sm dark:text-white/80">
              <MatchedLabel label={command.label} query={query ?? ""} />
            </span>
            {command.description && (
              <span className="min-w-0 truncate text-black/40 text-xs dark:text-white/40">
                {command.description}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex items-center gap-3 border-black/5 border-t px-2 pt-1.5 pb-1 text-[11px] text-black/40 dark:border-white/5 dark:text-white/40">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          to move
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd>
          to pick
        </span>
        <span className="flex items-center gap-1">
          <Kbd>esc</Kbd>
          to close
        </span>
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
      className="flex h-11 items-center gap-1.5 rounded-xl bg-blue-500/10 pr-1.5 pl-2.5 text-blue-600 text-sm dark:text-blue-400"
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
        "relative size-8 shrink-0 rounded-full",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500/60",
        "transition-[background-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
        // Fills in once there is something to send, so the button says
        // "ready" before it is pressed. Stop keeps the same fill.
        responding || canSend
          ? "bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/85"
          : "bg-black/5 text-black/30 dark:bg-white/10 dark:text-white/30"
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
        <ArrowUp className="size-4" strokeWidth={2.25} />
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

function PromoHeader({
  model,
  text,
  action,
  canSwitch,
  inUse,
  onAction,
}: {
  model: string;
  text: string;
  action: string;
  /** False when the promoted model is not in the menu: no button then. */
  canSwitch: boolean;
  inUse: boolean;
  onAction: () => void;
}) {
  return (
    <div className="flex h-9 items-center gap-2 pr-1.5 pl-3 text-xs">
      <span className="flex size-3.5 shrink-0 items-center justify-center text-black dark:text-white [&_svg]:size-3.5">
        {getModelIcon(model)}
      </span>
      <p className="min-w-0 flex-1 truncate text-black/60 dark:text-white/60">
        {text}
      </p>
      {action && canSwitch && (
        <button
          className={cn(
            "flex h-6 shrink-0 items-center gap-1 rounded-md px-2 font-medium",
            "transition-[background-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
            "focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-blue-500",
            inUse
              ? "text-black/40 dark:text-white/40"
              : "text-black hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
          )}
          disabled={inUse}
          onClick={onAction}
          type="button"
        >
          {inUse ? (
            <>
              <Check aria-hidden="true" className="size-3" />
              In use
            </>
          ) : (
            action
          )}
        </button>
      )}
    </div>
  );
}

/** Rising bars, filled up to the current effort, like a signal meter. */
function EffortBars({ count, level }: { count: number; level: number }) {
  return (
    <span aria-hidden="true" className="flex h-3 items-end gap-[2px]">
      {Array.from({ length: count }, (_, i) => (
        <span
          className={cn(
            "w-[3px] rounded-[1px] transition-colors duration-200",
            i <= level
              ? "bg-black/80 dark:bg-white/85"
              : "bg-black/15 dark:bg-white/20"
          )}
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed bars, never reordered
          key={i}
          style={{ height: `${((i + 1) / count) * 100}%` }}
        />
      ))}
    </span>
  );
}

const ghostButton = cn(
  "flex h-8 items-center gap-1.5 rounded-full px-2.5 text-black/70 text-xs dark:text-white/70",
  "hover:bg-black/5 hover:text-black data-[state=open]:bg-black/5 data-[state=open]:text-black",
  "dark:data-[state=open]:bg-white/10 dark:data-[state=open]:text-white dark:hover:bg-white/10 dark:hover:text-white",
  "transition-[background-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500/60"
);

const menuPanel =
  "origin-(--radix-dropdown-menu-content-transform-origin) rounded-xl border-black/10 p-1 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.18)] dark:border-white/10 dark:bg-zinc-900";

function ModelMenu({
  models,
  selected,
  onSelect,
}: {
  models: PromptModel[];
  selected: string;
  onSelect: (model: PromptModel) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn(ghostButton, "group pr-2")} type="button">
          <span className="flex items-center [&_svg]:size-3.5">
            {getModelIcon(selected)}
          </span>
          {/* Only the name swaps; the chevron stays put. */}
          <span className="relative inline-grid">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ opacity: 1, filter: "blur(0px)" }}
                className="col-start-1 row-start-1 whitespace-nowrap font-medium"
                exit={{ opacity: 0, filter: "blur(2px)" }}
                initial={{ opacity: 0, filter: "blur(2px)" }}
                key={selected}
                transition={{ duration: 0.15, ease: EASE_OUT }}
              >
                {selected}
              </motion.span>
            </AnimatePresence>
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-3 opacity-50 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-data-[state=open]:rotate-180"
          />
        </button>
      </DropdownMenuTrigger>
      {/* Opens upward, as the prompt sits at the bottom of a chat, and
          grows out of its trigger. */}
      <DropdownMenuContent
        align="start"
        className={cn(menuPanel, "w-72")}
        side="top"
        sideOffset={8}
      >
        <DropdownMenuLabel className="px-2 pt-1.5 pb-1 font-normal text-[11px] text-black/40 dark:text-white/40">
          Model
        </DropdownMenuLabel>
        {models.map((model) => (
          <DropdownMenuItem
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
            key={model.name}
            onSelect={() => onSelect(model)}
          >
            <span className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-3.5">
              {getModelIcon(model.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-black text-xs dark:text-white">
                {model.name}
              </span>
              {model.description && (
                <span className="block truncate text-[11px] text-black/45 dark:text-white/45">
                  {model.description}
                </span>
              )}
            </span>
            <Check
              aria-hidden="true"
              className={cn(
                "size-3.5 shrink-0 text-black dark:text-white",
                model.name !== selected && "invisible"
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * How hard the model thinks. A separate control from the model, so it can
 * be turned up for one hard question without opening the model list.
 */
function EffortMenu({
  efforts,
  value,
  onChange,
}: {
  efforts: string[];
  value: string;
  onChange: (effort: string) => void;
}) {
  const level = Math.max(0, efforts.indexOf(value));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Effort: ${value}. Change`}
          className={ghostButton}
          type="button"
        >
          <EffortBars count={efforts.length} level={level} />
          <span className="tabular-nums">{value}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn(menuPanel, "w-60")}
        side="top"
        sideOffset={8}
      >
        <DropdownMenuLabel className="px-2 pt-1.5 pb-1 font-normal text-[11px] text-black/40 dark:text-white/40">
          Effort
        </DropdownMenuLabel>
        {/* Highest first, so the list reads like the bars: up is more. */}
        <DropdownMenuRadioGroup onValueChange={onChange} value={value}>
          {[...efforts].reverse().map((effort) => {
            const index = efforts.indexOf(effort);
            return (
              <DropdownMenuRadioItem
                className="flex items-center gap-2.5 rounded-lg py-1.5 pr-2 pl-2 [&>span:first-child]:hidden"
                key={effort}
                value={effort}
              >
                <EffortBars count={efforts.length} level={index} />
                <span className="min-w-0 flex-1">
                  <span className="block text-black text-xs dark:text-white">
                    {effort}
                  </span>
                  {EFFORT_HINTS[effort] && (
                    <span className="block truncate text-[11px] text-black/45 dark:text-white/45">
                      {EFFORT_HINTS[effort]}
                    </span>
                  )}
                </span>
                <Check
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 shrink-0 text-black dark:text-white",
                    effort !== value && "invisible"
                  )}
                />
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function AI_Prompt({
  models = DEFAULT_MODELS,
  defaultModel = "GPT-5.6",
  placeholder = "Ask anything. Type / for commands",
  headerText = "Claude Fable 5 is free this weekend",
  headerAction = "Try it",
  promotedModel = "Claude Fable 5",
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
  // The last message sent, for ↑ in an empty prompt (as in a terminal).
  const lastSentRef = useRef("");
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 56,
    maxHeight: 280,
  });
  // A default that is not in `models` would show a model the menu can't pick.
  const [selectedModel, setSelectedModel] = useState(() =>
    models.some((m) => m.name === defaultModel)
      ? defaultModel
      : (models[0]?.name ?? defaultModel)
  );
  const currentModel = models.find((m) => m.name === selectedModel);
  const [effort, setEffort] = useState(() => startEffort(currentModel));
  const textareaId = useId();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => () => abortRef.current?.abort(), []);

  const pickModel = (next: PromptModel) => {
    setEffort(carryEffort(currentModel, next, effort));
    setSelectedModel(next.name);
  };

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
    lastSentRef.current = value;
    setValue("");
    setAttachments([]);
    setCommand(null);
    adjustHeight(true);
    setResponding(true);
    try {
      await (onSubmit
        ? onSubmit(value, selectedModel, {
            effort,
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

  // ↑ in an empty prompt brings the last message back to edit.
  const recallLast = () => {
    setValue(lastSentRef.current);
    // After React writes the value: grow to fit, caret at the end.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      adjustHeight();
      el?.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const handleEmptyKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "ArrowUp" && lastSentRef.current) {
      e.preventDefault();
      recallLast();
      return true;
    }
    // Backspace in an empty prompt takes the command off first.
    if (e.key === "Backspace" && command) {
      e.preventDefault();
      setCommand(null);
      return true;
    }
    return false;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter during IME composition confirms the candidate; it must not submit.
    if (e.nativeEvent.isComposing) {
      return;
    }
    if (menuOpen && handleMenuKey(e)) {
      return;
    }
    if (value === "" && handleEmptyKey(e)) {
      return;
    }
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

  const efforts = effortsOf(currentModel);
  const hasTray = attachments.length > 0 || command !== null;

  return (
    <div className={cn("w-full max-w-lg py-4", className)}>
      <div className="rounded-[22px] bg-black/[0.04] p-1 dark:bg-white/[0.04]">
        {headerText && (
          <PromoHeader
            action={headerAction}
            canSwitch={models.some((m) => m.name === promotedModel)}
            inUse={selectedModel === promotedModel}
            model={promotedModel}
            onAction={() => {
              const promoted = models.find((m) => m.name === promotedModel);
              if (promoted) {
                pickModel(promoted);
              }
              textareaRef.current?.focus();
            }}
            text={headerText}
          />
        )}
        {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/noNoninteractiveElementInteractions: drop target for files; keyboard users have the attach button */}
        <div
          className={cn(
            "relative flex flex-col rounded-[18px] bg-white ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10",
            "shadow-[0_1px_2px_rgb(0_0_0/0.04),0_6px_20px_-10px_rgb(0_0_0/0.12)]",
            "transition-shadow duration-150 has-[textarea:focus-visible]:ring-black/20 dark:has-[textarea:focus-visible]:ring-white/25",
            isDragging && "ring-blue-500/60 dark:ring-blue-400/60"
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
            {hasTray && (
              <motion.div
                animate={{ height: "auto", opacity: 1 }}
                className="overflow-hidden"
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
                query={slashQuery}
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
            className="min-h-[56px] w-full resize-none rounded-none border-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] text-black leading-relaxed placeholder:text-black/35 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent dark:text-white dark:placeholder:text-white/35"
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
            placeholder={
              responding ? "Replying… Esc to stop, or keep typing" : placeholder
            }
            ref={textareaRef}
            value={value}
          />

          <div className="flex items-center gap-1 px-2.5 pt-1 pb-2.5">
            <label
              className={cn(
                "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full ring-1 ring-black/10 dark:ring-white/15",
                "text-black/60 hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white",
                "has-focus-visible:ring-2 has-focus-visible:ring-blue-500/60",
                "transition-[background-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
              )}
              title="Attach files, or drop or paste them"
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
              <Plus aria-hidden="true" className="size-4" />
            </label>
            <ModelMenu
              models={models}
              onSelect={pickModel}
              selected={selectedModel}
            />
            {efforts.length > 0 && effort && (
              <EffortMenu
                efforts={efforts}
                onChange={setEffort}
                value={effort}
              />
            )}
            <div className="flex-1" />
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
              "pointer-events-none absolute inset-0 flex items-center justify-center rounded-[18px] border border-blue-500/50 border-dashed bg-white/85 text-blue-600 text-xs transition-opacity duration-150 dark:bg-zinc-900/85 dark:text-blue-400",
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
