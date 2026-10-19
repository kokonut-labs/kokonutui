"use client";

/**
 * @author: @kokonutui
 * @description: AI Input Search
 * @version: 4.0.0
 * @date: 2026-10-18
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  ArrowUp,
  Braces,
  Check,
  ChevronDown,
  FileText,
  Globe,
  ImageIcon,
  Lightbulb,
  type LucideIcon,
  Plus,
  Settings2,
  Telescope,
  X,
} from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_OUT_CSS = "ease-[cubic-bezier(0.23,1,0.32,1)]";
const WWW = /^www\./;

export interface SearchTool {
  id: string;
  /** Shown in the menu and on the chip. */
  label: string;
  icon: LucideIcon;
  /** What the trace says while this tool works, e.g. "Searching the web". */
  activity: string;
  /** Placeholder while the tool is picked. */
  placeholder?: string;
  /** True when the tool reads sources, so the trace stacks them up. */
  readsSources?: boolean;
  /** Runs left today. The menu shows them as dots and locks the tool at zero. */
  limit?: number;
  /** One quiet line under the label in the menu. */
  hint?: string;
  /** Any CSS color. Tints the icon tile, the pill and the caret. */
  color?: string;
}

export interface SearchSource {
  /** e.g. "developer.mozilla.org" */
  domain: string;
  title: string;
}

export interface AIInputSearchProps {
  placeholder?: string;
  tools?: SearchTool[];
  /** Tool picked at first. Pass null to start with none. */
  defaultTool?: string | null;
  models?: string[];
  defaultModel?: string;
  /**
   * Runs the request. Call `onSource` for each source as it is read, and
   * resolve when the answer is ready; `signal` aborts on Stop. Without it,
   * the component plays a pretend run so the demo feels alive.
   */
  onSearch?: (
    query: string,
    options: {
      tool: SearchTool | null;
      model: string;
      files: File[];
      signal: AbortSignal;
      onSource: (source: SearchSource) => void;
    }
  ) => Promise<void> | void;
  className?: string;
}

type Phase = "idle" | "working" | "done" | "stopped";

const DEFAULT_TOOLS: SearchTool[] = [
  {
    id: "browse",
    label: "Browse sources",
    hint: "Answers with links you can check",
    icon: Globe,
    color: "#0ea5e9",
    activity: "Searching the web",
    placeholder: "Look something up",
    readsSources: true,
  },
  {
    id: "investigate",
    label: "Investigate",
    hint: "Reads widely, takes a few minutes",
    icon: Telescope,
    color: "#8b5cf6",
    activity: "Investigating",
    placeholder: "What should I dig into?",
    readsSources: true,
    limit: 3,
  },
  {
    id: "visual",
    label: "Draft a visual",
    hint: "Diagrams, mockups and covers",
    icon: ImageIcon,
    color: "#f97316",
    activity: "Sketching the visual",
    placeholder: "Describe what to draw",
  },
  {
    id: "code",
    label: "Run some code",
    hint: "Works the numbers in a sandbox",
    icon: Braces,
    color: "#10b981",
    activity: "Running the code",
    placeholder: "What should the code work out?",
  },
  {
    id: "reason",
    label: "Reason it through",
    hint: "Slower, more careful answers",
    icon: Lightbulb,
    color: "#f43f5e",
    activity: "Thinking it over",
    placeholder: "Ask something hard",
  },
];

const DEFAULT_MODELS = ["Opus 5.5", "Sonnet 5.5", "Haiku 5.5"];

const DEMO_SOURCES: SearchSource[] = [
  { domain: "developer.mozilla.org", title: "429 Too Many Requests" },
  { domain: "cloudflare.com", title: "What is rate limiting?" },
  {
    domain: "github.com",
    title: "upstash/ratelimit: serverless rate limiting",
  },
  { domain: "vercel.com", title: "Rate limiting at the edge" },
  { domain: "stripe.com", title: "Scaling your API with rate limiters" },
  { domain: "redis.io", title: "Rate limiting with sorted sets" },
  { domain: "ietf.org", title: "RateLimit header fields for HTTP" },
  { domain: "stackoverflow.com", title: "Token bucket vs sliding window" },
  { domain: "aws.amazon.com", title: "Throttling requests in API Gateway" },
  { domain: "nginx.org", title: "Module ngx_http_limit_req_module" },
  { domain: "arxiv.org", title: "Fair queuing for multi-tenant APIs" },
  { domain: "martinfowler.com", title: "Circuit breaker" },
];

const STACK_MAX = 5;

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new DOMException("Stopped", "AbortError"));
    });
  });

async function demoRun(
  tool: SearchTool | null,
  signal: AbortSignal,
  onSource: (source: SearchSource) => void
) {
  await wait(500, signal);
  if (!tool?.readsSources) {
    await wait(1600, signal);
    return;
  }
  // Investigating reads more and faster than a quick browse.
  const deep = (tool.limit ?? 0) > 0;
  for (const source of DEMO_SOURCES.slice(0, deep ? 12 : 5)) {
    await wait(deep ? 200 : 260, signal);
    onSource(source);
  }
  await wait(700, signal);
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** A neutral letter tile per site, so the trace needs no favicon service. */
function Monogram({ domain, ring }: { domain: string; ring?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full bg-white font-medium text-[10px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200",
        ring
          ? "outline-1 outline-black/10 ring-2 ring-zinc-100 dark:outline-white/10 dark:ring-zinc-800"
          : "ring-1 ring-black/10 dark:ring-white/10"
      )}
    >
      {domain.replace(WWW, "").charAt(0).toUpperCase()}
    </span>
  );
}

function SourceStack({ sources }: { sources: SearchSource[] }) {
  const shown = sources.slice(-STACK_MAX);
  if (shown.length === 0) {
    return (
      <span className="size-5 shrink-0 rounded-full border border-black/15 border-dashed dark:border-white/20" />
    );
  }
  // Sites stack up as they are read; the newest lands at the end.
  return (
    <span className="flex shrink-0 items-center">
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map((source, i) => (
          <motion.span
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            className={cn(i > 0 && "-ml-1")}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            initial={{ opacity: 0, x: -6, filter: "blur(2px)" }}
            key={source.domain}
            layout="position"
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <Monogram domain={source.domain} ring />
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}

function SourceList({ id, sources }: { id: string; sources: SearchSource[] }) {
  return (
    <motion.div
      animate={{ height: "auto", opacity: 1 }}
      className="overflow-hidden"
      exit={{ height: 0, opacity: 0 }}
      id={id}
      initial={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: EASE_OUT }}
    >
      <ol className="max-h-56 overflow-y-auto px-1.5 pb-1.5">
        {sources.map((source, i) => (
          <motion.li
            animate={{ opacity: 1, y: 0 }}
            className="flex h-8 items-center gap-2.5 rounded-lg px-1.5 text-xs"
            initial={{ opacity: 0, y: 4 }}
            key={source.domain}
            // A short cascade, capped so a long list doesn't drag.
            transition={{
              duration: 0.18,
              ease: EASE_OUT,
              delay: Math.min(i, 8) * 0.025,
            }}
          >
            <span className="w-4 shrink-0 text-right text-[11px] text-black/30 tabular-nums dark:text-white/30">
              {i + 1}
            </span>
            <Monogram domain={source.domain} />
            <span className="min-w-0 flex-1 truncate text-black/80 dark:text-white/80">
              {source.title}
            </span>
            <span className="hidden shrink-0 text-black/40 sm:block dark:text-white/40">
              {source.domain}
            </span>
          </motion.li>
        ))}
      </ol>
    </motion.div>
  );
}

const traceLabel = (
  phase: Phase,
  tool: SearchTool | null,
  count: number
): string => {
  const noun = count === 1 ? "source" : "sources";
  if (phase === "working") {
    if (count > 0) {
      return "Reading sources";
    }
    return tool?.activity ?? "Writing the answer";
  }
  if (phase === "stopped") {
    return count > 0 ? `Stopped after ${count} ${noun}` : "Stopped";
  }
  return count > 0 ? `Read ${count} ${noun}` : "Done";
};

/** Under the box: what the run is doing now, then what it read. */
function Trace({
  phase,
  tool,
  sources,
  elapsed,
  expanded,
  onToggle,
  listId,
}: {
  phase: Phase;
  tool: SearchTool | null;
  sources: SearchSource[];
  elapsed: number;
  expanded: boolean;
  onToggle: () => void;
  listId: string;
}) {
  const finished = phase === "done" || phase === "stopped";
  const canOpen = finished && sources.length > 0;
  const label = traceLabel(phase, tool, sources.length);
  const ToolIcon = tool?.icon;

  return (
    <div>
      <button
        aria-controls={listId}
        aria-expanded={expanded}
        className={cn(
          "flex h-10 w-full items-center gap-2.5 rounded-[18px] px-3 text-left text-xs outline-hidden",
          "transition-colors duration-150",
          EASE_OUT_CSS,
          "focus-visible:ring-2 focus-visible:ring-black/15 dark:focus-visible:ring-white/20",
          canOpen
            ? "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
            : "cursor-default"
        )}
        disabled={!canOpen}
        onClick={onToggle}
        type="button"
      >
        {tool?.readsSources || !ToolIcon ? (
          <SourceStack sources={sources} />
        ) : (
          <span
            className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-(--tool) ring-1 ring-black/10 dark:bg-zinc-800 dark:ring-white/10"
            style={
              { "--tool": tool?.color ?? "currentColor" } as React.CSSProperties
            }
          >
            <ToolIcon aria-hidden="true" className="size-3" />
          </span>
        )}
        <span className="relative min-w-0 flex-1">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ opacity: 1, filter: "blur(0px)" }}
              className={cn(
                "block truncate",
                finished
                  ? "text-black/70 dark:text-white/70"
                  : "text-black/50 dark:text-white/50"
              )}
              exit={{ opacity: 0, filter: "blur(2px)" }}
              initial={{ opacity: 0, filter: "blur(2px)" }}
              key={label}
              transition={{ duration: 0.15, ease: EASE_OUT }}
            >
              {label}
              {phase === "working" && sources.length > 0 && (
                <span className="text-black/35 tabular-nums dark:text-white/35">
                  {" "}
                  · {sources.length}
                </span>
              )}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="shrink-0 text-black/35 tabular-nums dark:text-white/35">
          {seconds(elapsed)}
        </span>
        {canOpen && (
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-3.5 shrink-0 text-black/40 transition-transform duration-200 dark:text-white/40",
              EASE_OUT_CSS,
              expanded && "rotate-180"
            )}
          />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && <SourceList id={listId} sources={sources} />}
      </AnimatePresence>
    </div>
  );
}

const ghostButton = cn(
  "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-black/70 text-xs outline-hidden dark:text-white/70",
  "transition-[background-color,color] duration-150",
  EASE_OUT_CSS,
  "hover:bg-black/[0.04] hover:text-black dark:hover:bg-white/[0.06] dark:hover:text-white",
  "data-[state=open]:bg-black/[0.05] data-[state=open]:text-black dark:data-[state=open]:bg-white/[0.08] dark:data-[state=open]:text-white",
  "focus-visible:ring-2 focus-visible:ring-black/15 dark:focus-visible:ring-white/20"
);

const menuPanel =
  "origin-(--radix-dropdown-menu-content-transform-origin) rounded-xl border-black/10 p-1 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.18)] dark:border-white/10 dark:bg-zinc-900";

/**
 * Width of what an element holds, so its wrapper can animate to it rather
 * than snap when a label changes.
 */
function useContentWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.borderBoxSize[0].inlineSize);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Runs left as dots, so a metered tool reads at a glance. */
function RunsLeft({ left, limit }: { left: number; limit: number }) {
  return (
    <span
      className="flex shrink-0 items-center gap-0.5"
      title={left > 0 ? `${left} left today` : "None left today"}
    >
      {Array.from({ length: limit }, (_, i) => (
        <span
          className={cn(
            "size-1.5 rounded-full",
            i < left ? "bg-(--tool)" : "bg-black/10 dark:bg-white/15"
          )}
          // biome-ignore lint/suspicious/noArrayIndexKey: dots are positional
          key={i}
        />
      ))}
    </span>
  );
}

/**
 * Tools trigger and picked tool in one pill: picking a tool morphs the
 * pill into it (icon, name, tint and an x) instead of adding a second chip.
 */
function ToolPill({
  tools,
  tool,
  remaining,
  open,
  onOpenChange,
  onSelect,
  onCloseAutoFocus,
}: {
  tools: SearchTool[];
  tool: SearchTool | null;
  remaining: Record<string, number>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string | null) => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const [innerRef, width] = useContentWidth<HTMLSpanElement>();

  const Icon = tool?.icon ?? Settings2;
  const label = tool?.label ?? "Tools";

  // Number keys pick a tool while the menu is open.
  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const index = Number(event.key) - 1;
    const picked = tools[index];
    if (!(Number.isInteger(index) && picked)) {
      return;
    }
    const left = remaining[picked.id];
    if (left !== undefined && left <= 0) {
      return;
    }
    event.preventDefault();
    onSelect(picked.id === tool?.id ? null : picked.id);
    onOpenChange(false);
  };

  return (
    <motion.div
      animate={{ width }}
      className="h-8 min-w-0 shrink-0 overflow-hidden rounded-full"
      style={{ "--tool": tool?.color ?? "currentColor" } as React.CSSProperties}
      transition={{ duration: 0.25, ease: EASE_OUT }}
    >
      <span className="flex h-full w-max items-center" ref={innerRef}>
        <DropdownMenu modal={false} onOpenChange={onOpenChange} open={open}>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={tool ? `Tool: ${tool.label}. Change` : "Tools"}
              className={cn(
                // A plain ghost control, like the model picker: no outline,
                // just the tool's coloured icon and its name.
                "group flex h-8 items-center gap-1.5 rounded-full pr-2 pl-2.5 text-xs outline-hidden",
                "transition-[background-color,color] duration-150",
                EASE_OUT_CSS,
                "focus-visible:ring-2 focus-visible:ring-black/15 dark:focus-visible:ring-white/20",
                "hover:bg-black/5 hover:text-black data-[state=open]:bg-black/5 data-[state=open]:text-black dark:data-[state=open]:bg-white/10 dark:data-[state=open]:text-white dark:hover:bg-white/10 dark:hover:text-white",
                tool
                  ? "font-medium text-black/80 dark:text-white/85"
                  : "text-black/70 dark:text-white/70"
              )}
              type="button"
            >
              <span className="relative inline-grid size-4 shrink-0 place-items-center">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    animate={{ opacity: 1, filter: "blur(0px)", rotate: 0 }}
                    className="col-start-1 row-start-1 text-(--tool)"
                    exit={{ opacity: 0, filter: "blur(2px)", rotate: 30 }}
                    initial={{ opacity: 0, filter: "blur(2px)", rotate: -30 }}
                    key={tool?.id ?? "tools"}
                    transition={{ duration: 0.18, ease: EASE_OUT }}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="relative inline-grid">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                    className="col-start-1 row-start-1 max-w-[4rem] truncate whitespace-nowrap sm:max-w-none"
                    exit={{ opacity: 0, filter: "blur(2px)", y: -4 }}
                    initial={{ opacity: 0, filter: "blur(2px)", y: 4 }}
                    key={label}
                    transition={{ duration: 0.18, ease: EASE_OUT }}
                  >
                    {label}
                  </motion.span>
                </AnimatePresence>
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "size-3 shrink-0 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-180",
                  EASE_OUT_CSS
                )}
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className={cn(menuPanel, "w-72")}
            onCloseAutoFocus={onCloseAutoFocus}
            onKeyDown={onMenuKeyDown}
            // Below the box by default; Radix flips it up when there is no
            // room, so it also works with the composer at the bottom of a chat.
            side="bottom"
            sideOffset={8}
          >
            <div className="flex items-center justify-between px-2 pt-1.5 pb-1 text-[11px] text-black/40 dark:text-white/40">
              <span>Tools</span>
              <span>Press 1–{tools.length}</span>
            </div>
            {tools.map((item, i) => {
              const ItemIcon = item.icon;
              const isSelected = item.id === tool?.id;
              const left = remaining[item.id];
              const spent = left !== undefined && left <= 0;
              return (
                <DropdownMenuCheckboxItem
                  checked={isSelected}
                  className={cn(
                    "group/item flex items-center gap-2.5 rounded-lg px-2 py-1.5 [&>span:first-child]:hidden",
                    "focus:bg-black/[0.04] dark:focus:bg-white/[0.06]"
                  )}
                  disabled={spent}
                  key={item.id}
                  // Picking the active tool again clears it, like the pill's x.
                  onCheckedChange={(checked) =>
                    onSelect(checked ? item.id : null)
                  }
                  style={
                    {
                      "--tool": item.color ?? "currentColor",
                    } as React.CSSProperties
                  }
                >
                  <span className="flex size-4 shrink-0 items-center justify-center text-(--tool)">
                    <ItemIcon aria-hidden="true" className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "truncate text-xs",
                          isSelected
                            ? "text-black dark:text-white"
                            : "text-black/75 dark:text-white/75"
                        )}
                      >
                        {item.label}
                      </span>
                      {left !== undefined && item.limit !== undefined && (
                        <RunsLeft left={left} limit={item.limit} />
                      )}
                    </span>
                    {item.hint && (
                      <span className="block truncate text-[11px] text-black/40 dark:text-white/40">
                        {spent ? "None left today" : item.hint}
                      </span>
                    )}
                  </span>
                  {isSelected ? (
                    <Check
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-black dark:text-white"
                      strokeWidth={2.25}
                    />
                  ) : (
                    <kbd className="w-3.5 shrink-0 text-center font-sans text-[11px] text-black/30 tabular-nums dark:text-white/30">
                      {i + 1}
                    </kbd>
                  )}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <AnimatePresence initial={false} mode="popLayout">
          {tool && (
            <motion.button
              animate={{ opacity: 1, filter: "blur(0px)" }}
              aria-label={`Remove ${tool.label}`}
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-black/40 outline-hidden dark:text-white/45",
                "transition-[background-color,color] duration-150",
                EASE_OUT_CSS,
                "hover:bg-black/[0.06] hover:text-black dark:hover:bg-white/10 dark:hover:text-white",
                "focus-visible:ring-2 focus-visible:ring-black/15 dark:focus-visible:ring-white/20"
              )}
              exit={{
                opacity: 0,
                filter: "blur(2px)",
                transition: { duration: 0.1 },
              }}
              initial={{ opacity: 0, filter: "blur(2px)" }}
              onClick={() => onSelect(null)}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              type="button"
            >
              <X aria-hidden="true" className="size-3.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </span>
    </motion.div>
  );
}

function ModelMenu({
  models,
  selected,
  onSelect,
  onCloseAutoFocus,
}: {
  models: string[];
  selected: string;
  onSelect: (model: string) => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Model: ${selected}. Change`}
          className={cn(ghostButton, "group gap-1 pr-2")}
          type="button"
        >
          {/* Only the name swaps; the chevron stays put. */}
          <span className="relative inline-grid">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ opacity: 1, filter: "blur(0px)" }}
                className="col-start-1 row-start-1 whitespace-nowrap"
                exit={{ opacity: 0, filter: "blur(2px)" }}
                initial={{ opacity: 0, filter: "blur(2px)" }}
                key={selected}
                transition={{ duration: 0.15, ease: EASE_OUT }}
              >
                {/* Phones get the family name only, to leave room for the chip. */}
                <span className="sm:hidden">{selected.split(" ")[0]}</span>
                <span className="hidden sm:inline">{selected}</span>
              </motion.span>
            </AnimatePresence>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-3.5 opacity-60 transition-transform duration-200 group-data-[state=open]:rotate-180",
              EASE_OUT_CSS
            )}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(menuPanel, "w-44")}
        onCloseAutoFocus={onCloseAutoFocus}
        side="bottom"
        sideOffset={8}
      >
        {models.map((model) => (
          <DropdownMenuItem
            className={cn(
              "flex h-8 items-center gap-2 rounded-lg px-2 text-xs",
              model === selected
                ? "text-black dark:text-white"
                : "text-black/55 dark:text-white/55"
            )}
            key={model}
            onSelect={() => onSelect(model)}
          >
            <span className="flex-1">{model}</span>
            {model === selected && (
              <Check
                aria-hidden="true"
                className="size-3.5"
                strokeWidth={2.25}
              />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FileChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  return (
    <motion.li
      animate={{ opacity: 1, filter: "blur(0px)" }}
      className="flex h-8 max-w-48 items-center gap-1.5 rounded-lg bg-black/[0.04] pr-1 pl-2 text-black/70 text-xs dark:bg-white/[0.07] dark:text-white/70"
      exit={{ opacity: 0, filter: "blur(2px)", transition: { duration: 0.1 } }}
      initial={{ opacity: 0, filter: "blur(2px)" }}
      layout="position"
      transition={{ duration: 0.18, ease: EASE_OUT }}
    >
      <FileText aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="truncate">{file.name}</span>
      <button
        aria-label={`Remove ${file.name}`}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-black/40 outline-hidden transition-colors duration-150 hover:bg-black/[0.06] hover:text-black focus-visible:ring-2 focus-visible:ring-black/15 dark:text-white/40 dark:focus-visible:ring-white/20 dark:hover:bg-white/10 dark:hover:text-white"
        onClick={onRemove}
        type="button"
      >
        <X aria-hidden="true" className="size-3" />
      </button>
    </motion.li>
  );
}

function SendStopButton({
  running,
  canSubmit,
  onSubmit,
  onStop,
}: {
  running: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onStop: () => void;
}) {
  // Same button, two faces: send crossfades into stop.
  const face = cn(
    "absolute inset-0 flex items-center justify-center transition-[opacity,filter] duration-200",
    EASE_OUT_CSS
  );
  return (
    <button
      aria-label={running ? "Stop" : "Send"}
      className={cn(
        "relative size-8 shrink-0 rounded-full",
        "transition-[background-color,color] duration-150",
        EASE_OUT_CSS,
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/30",
        // Fills in once there is something to send; Stop keeps the fill.
        running || canSubmit
          ? "bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/85"
          : "bg-black/5 text-black/30 dark:bg-white/10 dark:text-white/30"
      )}
      disabled={!(running || canSubmit)}
      onClick={running ? onStop : onSubmit}
      type="button"
    >
      <span
        aria-hidden="true"
        className={cn(face, running ? "opacity-0 blur-[2px]" : "opacity-100")}
      >
        <ArrowUp className="size-4" strokeWidth={2.25} />
      </span>
      <span
        aria-hidden="true"
        className={cn(face, running ? "opacity-100" : "opacity-0 blur-[2px]")}
      >
        <span className="size-2.5 rounded-[2px] bg-current" />
      </span>
    </button>
  );
}

export default function AI_Input_Search({
  placeholder = "Ask anything, or type / for tools",
  tools = DEFAULT_TOOLS,
  defaultTool = "browse",
  models = DEFAULT_MODELS,
  defaultModel = "Sonnet 5.5",
  onSearch,
  className,
}: AIInputSearchProps) {
  const [value, setValue] = useState("");
  const [toolId, setToolId] = useState<string | null>(defaultTool);
  const [menuOpen, setMenuOpen] = useState(false);
  const [model, setModel] = useState(defaultModel);
  const [files, setFiles] = useState<File[]>([]);
  const [remaining, setRemaining] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      tools.flatMap((t) => (t.limit === undefined ? [] : [[t.id, t.limit]]))
    )
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [runTool, setRunTool] = useState<SearchTool | null>(null);
  const [sources, setSources] = useState<SearchSource[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 56,
    maxHeight: 200,
  });

  const tool = tools.find((t) => t.id === toolId) ?? null;
  const running = phase === "working";

  useEffect(() => () => abortRef.current?.abort(), []);

  // The clock ticks only while a run is going, from zero each time.
  useEffect(() => {
    if (!running) {
      return;
    }
    const start = performance.now();
    const timer = setInterval(() => setElapsed(performance.now() - start), 100);
    return () => clearInterval(timer);
  }, [running]);

  const pickTool = (id: string | null) => {
    setToolId(id);
    textareaRef.current?.focus();
  };

  // Menus hand focus back to the field, not their trigger, so typing carries on.
  const backToField = (event: Event) => {
    event.preventDefault();
    textareaRef.current?.focus();
  };

  const submit = async () => {
    const query = value.trim();
    if (!query || running) {
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const attached = files;
    setValue("");
    setFiles([]);
    adjustHeight(true);
    setSources([]);
    setElapsed(0);
    setExpanded(false);
    setRunTool(tool);
    setPhase("working");

    // A metered tool spends a run; at zero it drops off the box.
    const left = tool ? remaining[tool.id] : undefined;
    if (tool && left !== undefined) {
      setRemaining((current) => ({ ...current, [tool.id]: left - 1 }));
      if (left - 1 <= 0) {
        setToolId(null);
      }
    }

    const onSource = (source: SearchSource) => {
      if (controller.signal.aborted) {
        return;
      }
      setSources((current) => [
        ...current.filter((s) => s.domain !== source.domain),
        source,
      ]);
    };
    try {
      await (onSearch
        ? onSearch(query, {
            tool,
            model,
            files: attached,
            signal: controller.signal,
            onSource,
          })
        : demoRun(tool, controller.signal, onSource));
      if (!controller.signal.aborted) {
        setPhase("done");
      }
    } catch {
      // Stopped: `stop` has already set the phase.
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("stopped");
    textareaRef.current?.focus();
  };

  // Mouse convenience: clicking the box around the field focuses it. Clicks
  // on the controls keep their own behaviour.
  const handleContainerClick = (target: EventTarget) => {
    if (target instanceof Element && target.closest("button, [role=menu]")) {
      return;
    }
    textareaRef.current?.focus();
  };

  const canSubmit = value.trim().length > 0 && !running;

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("mx-auto w-full max-w-lg py-4", className)}>
        {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents lint/a11y/noNoninteractiveElementInteractions: pointer-only shortcut; the textarea and buttons inside are keyboard reachable */}
        <div
          className="relative w-full cursor-text rounded-[22px] bg-black/[0.04] p-1 text-left dark:bg-white/[0.04]"
          onClick={(e) => handleContainerClick(e.target)}
        >
          {/* Card on a soft frame, as in AI Prompt; the trace opens in the frame. */}
          <div
            className={cn(
              "flex flex-col rounded-[18px] bg-white ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10",
              "shadow-[0_1px_2px_rgb(0_0_0/0.04),0_6px_20px_-10px_rgb(0_0_0/0.12)]",
              "transition-shadow duration-150 has-[textarea:focus-visible]:ring-black/20 dark:has-[textarea:focus-visible]:ring-white/25"
            )}
          >
            <AnimatePresence initial={false}>
              {files.length > 0 && (
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
                    <AnimatePresence initial={false}>
                      {files.map((file) => (
                        <FileChip
                          file={file}
                          key={`${file.name}-${file.size}-${file.lastModified}`}
                          onRemove={() =>
                            setFiles((current) =>
                              current.filter((f) => f !== file)
                            )
                          }
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>

            <Textarea
              aria-label="Message"
              className="min-h-[56px] w-full resize-none rounded-none border-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] text-black leading-relaxed placeholder:text-black/35 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent dark:text-white dark:placeholder:text-white/35"
              onChange={(e) => {
                setValue(e.target.value);
                adjustHeight();
              }}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) {
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                } else if (e.key === "Escape" && running) {
                  e.preventDefault();
                  stop();
                } else if (e.key === "/" && value === "") {
                  // "/" in an empty box opens the tools, keyboard first.
                  e.preventDefault();
                  setMenuOpen(true);
                } else if (e.key === "Backspace" && value === "" && toolId) {
                  // Backspace in an empty box takes the chip off, as in a
                  // tag field.
                  e.preventDefault();
                  setToolId(null);
                }
              }}
              placeholder={tool?.placeholder ?? placeholder}
              ref={textareaRef}
              style={tool?.color ? { caretColor: tool.color } : undefined}
              value={value}
            />

            <div className="flex items-center gap-1 px-2.5 pt-1 pb-2.5">
              <button
                aria-label="Attach files"
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-black/60 outline-hidden ring-1 ring-black/10 dark:text-white/60 dark:ring-white/15",
                  "transition-[background-color,color] duration-150",
                  EASE_OUT_CSS,
                  "hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white",
                  "focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/25"
                )}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <Plus aria-hidden="true" className="size-4" />
              </button>
              <input
                className="hidden"
                multiple
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  setFiles((current) => [...current, ...picked]);
                  e.target.value = "";
                }}
                ref={fileInputRef}
                tabIndex={-1}
                type="file"
              />
              <ToolPill
                onCloseAutoFocus={backToField}
                onOpenChange={setMenuOpen}
                onSelect={pickTool}
                open={menuOpen}
                remaining={remaining}
                tool={tool}
                tools={tools}
              />
              <div className="min-w-0 flex-1" />
              <ModelMenu
                models={models}
                onCloseAutoFocus={backToField}
                onSelect={setModel}
                selected={model}
              />
              <SendStopButton
                canSubmit={canSubmit}
                onStop={stop}
                onSubmit={submit}
                running={running}
              />
            </div>
          </div>
          <AnimatePresence initial={false}>
            {phase !== "idle" && (
              <motion.div
                animate={{ height: "auto", opacity: 1 }}
                className="overflow-hidden"
                exit={{ height: 0, opacity: 0 }}
                initial={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                <div className="pt-1">
                  <Trace
                    elapsed={elapsed}
                    expanded={expanded}
                    listId={listId}
                    onToggle={() => setExpanded((open) => !open)}
                    phase={phase}
                    sources={sources}
                    tool={runTool}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <output aria-live="polite" className="sr-only">
          {phase === "done" && "Done."}
          {phase === "stopped" && "Stopped."}
          {phase === "working" && (runTool?.activity ?? "Working.")}
        </output>
      </div>
    </MotionConfig>
  );
}
