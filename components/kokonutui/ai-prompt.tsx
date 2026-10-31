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
    name: "Claude Opus 5.5",
    description: "Most capable, for complex work",
    efforts: ["Low", "Medium", "High", "Max"],
    defaultEffort: "High",
  },
  {
    name: "Claude Sonnet 5.5",
    description: "Fast and smart for everyday tasks",
    efforts: ["Low", "Medium", "High", "Max"],
    defaultEffort: "Medium",
  },
  {
    name: "Claude Fable 5.1",
    description: "Newest model, free to try this weekend",
    efforts: ["Low", "Medium", "High"],
    defaultEffort: "Medium",
  },
  {
    name: "Claude Haiku 5.5",
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

// Decorative: the icon sits next to the model name, which carries the label.
const CLAUDE_ICON = (
  <svg
    aria-hidden="true"
    fill="#D57156"
    height="1em"
    style={{ flex: "none", lineHeight: "1" }}
    viewBox="0 0 256 257"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="m50.228 170.321 50.357-28.257.843-2.463-.843-1.361h-2.462l-8.426-.518-28.775-.778-24.952-1.037-24.175-1.296-6.092-1.297L0 125.796l.583-3.759 5.12-3.434 7.324.648 16.202 1.101 24.304 1.685 17.629 1.037 26.118 2.722h4.148l.583-1.685-1.426-1.037-1.101-1.037-25.147-17.045-27.22-18.017-14.258-10.37-7.713-5.25-3.888-4.925-1.685-10.758 7-7.713 9.397.649 2.398.648 9.527 7.323 20.35 15.75L94.817 91.9l3.889 3.24 1.555-1.102.195-.777-1.75-2.917-14.453-26.118-15.425-26.572-6.87-11.018-1.814-6.61c-.648-2.723-1.102-4.991-1.102-7.778l7.972-10.823L71.42 0 82.05 1.426l4.472 3.888 6.61 15.101 10.694 23.786 16.591 32.34 4.861 9.592 2.592 8.879.973 2.722h1.685v-1.556l1.36-18.211 2.528-22.36 2.463-28.776.843-8.1 4.018-9.722 7.971-5.25 6.222 2.981 5.12 7.324-.713 4.73-3.046 19.768-5.962 30.98-3.889 20.739h2.268l2.593-2.593 10.499-13.934 17.628-22.036 7.778-8.749 9.073-9.657 5.833-4.601h11.018l8.1 12.055-3.628 12.443-11.342 14.388-9.398 12.184-13.48 18.147-8.426 14.518.778 1.166 2.01-.194 30.46-6.481 16.462-2.982 19.637-3.37 8.88 4.148.971 4.213-3.5 8.62-20.998 5.184-24.628 4.926-36.682 8.685-.454.324.519.648 16.526 1.555 7.065.389h17.304l32.21 2.398 8.426 5.574 5.055 6.805-.843 5.184-12.962 6.611-17.498-4.148-40.83-9.721-14-3.5h-1.944v1.167l11.666 11.406 21.387 19.314 26.767 24.887 1.36 6.157-3.434 4.86-3.63-.518-23.526-17.693-9.073-7.972-20.545-17.304h-1.36v1.814l4.73 6.935 25.017 37.59 1.296 11.536-1.814 3.76-6.481 2.268-7.13-1.297-14.647-20.544-15.1-23.138-12.185-20.739-1.49.843-7.194 77.448-3.37 3.953-7.778 2.981-6.48-4.925-3.436-7.972 3.435-15.749 4.148-20.544 3.37-16.333 3.046-20.285 1.815-6.74-.13-.454-1.49.194-15.295 20.999-23.267 31.433-18.406 19.702-4.407 1.75-7.648-3.954.713-7.064 4.277-6.286 25.47-32.405 15.36-20.092 9.917-11.6-.065-1.686h-.583L44.07 198.125l-12.055 1.555-5.185-4.86.648-7.972 2.463-2.593 20.35-13.999-.064.065Z" />
  </svg>
);

const getModelIcon = (model: string) =>
  model.startsWith("Claude") ? (
    CLAUDE_ICON
  ) : (
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
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        resolve();
      },
      { once: true }
    );
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
  defaultModel = "Claude Opus 5.5",
  placeholder = "Ask anything. Type / for commands",
  headerText = "Claude Fable 5.1 is free this weekend",
  headerAction = "Try it",
  promotedModel = "Claude Fable 5.1",
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

  // A dropped screenshot with no text is still a message.
  const canSend =
    (value.trim().length > 0 || attachments.length > 0) && !responding;

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
            // shadow-none and md:text-[15px] beat the shadow-xs and
            // md:text-sm of the current shadcn Textarea. Touch screens get 16px so
            // iOS does not zoom into the field on focus.
            className="min-h-[56px] w-full resize-none rounded-none border-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] text-black leading-relaxed shadow-none placeholder:text-black/35 focus-visible:ring-0 focus-visible:ring-offset-0 md:text-[15px] dark:bg-transparent dark:text-white dark:placeholder:text-white/35 [@media(pointer:coarse)]:text-base"
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
