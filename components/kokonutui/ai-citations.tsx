"use client";

/**
 * @author: @kokonutui
 * @description: AI Inline Citations
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ArrowUpRight, ChevronDown } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface CitationSource {
  id: string;
  title: string;
  url: string;
  /** Short site name for the chip, such as `MDN`. Defaults to the host. */
  site?: string;
  /** The passage that backs the claim, shown in the preview. */
  snippet?: string;
}

export interface AnswerPart {
  text: string;
  /** Ids of the sources that back this text. A chip follows it. */
  cite?: string[];
}

interface AICitationsProps {
  /** The answer, split where citations go. Demo content when omitted. */
  parts?: AnswerPart[];
  sources?: CitationSource[];
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const CARD_WIDTH = 288;
const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 90;
/** After a preview closes, the next one within this window opens at once. */
const WARM_MS = 400;

const DEMO_SOURCES: CitationSource[] = [
  {
    id: "emil",
    title: "Great animations",
    url: "https://emilkowal.ski/ui/great-animations",
    site: "emilkowal.ski",
    snippet:
      "UI motion should be fast, mostly under 300ms, with an ease-out curve so movement starts right away. Popovers scale from their trigger.",
  },
  {
    id: "webdev",
    title: "Animations and performance",
    url: "https://web.dev/articles/animations-and-performance",
    site: "web.dev",
    snippet:
      "Stick to transform and opacity where you can. Changing them skips layout and paint, so the compositor can run the animation.",
  },
  {
    id: "mdn-perf",
    title: "CSS and JavaScript animation performance",
    url: "https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/CSS_JavaScript_animation_performance",
    site: "MDN",
    snippet:
      "Properties that trigger layout are expensive to animate. Transforms and opacity can be handed to the GPU.",
  },
  {
    id: "mdn-reduce",
    title: "prefers-reduced-motion",
    url: "https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion",
    site: "MDN",
    snippet:
      "Detects whether the user asked the system to minimize non-essential motion.",
  },
];

const DEMO_PARTS: AnswerPart[] = [
  { text: "Keep the dropdown quick. " },
  {
    text: "Most UI motion should finish in under 300ms, and an ease-out curve feels faster than ease-in at the same duration.",
    cite: ["emil"],
  },
  { text: " " },
  {
    text: "Animate only transform and opacity, which the browser can run without layout or paint.",
    cite: ["webdev", "mdn-perf"],
  },
  { text: " " },
  {
    text: "When someone asks for reduced motion, swap the movement for a plain fade.",
    cite: ["mdn-reduce"],
  },
  { text: " Finally, " },
  {
    text: "scale the menu from its trigger rather than its center",
    cite: ["emil"],
  },
  { text: ", so it feels attached to the button that opened it." },
];

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
};
const siteOf = (source: CitationSource) => source.site ?? hostOf(source.url);

function Monogram({
  source,
  className,
}: {
  source: CitationSource;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-zinc-200 font-semibold text-[9px] text-zinc-600 uppercase dark:bg-zinc-700 dark:text-zinc-200",
        className
      )}
    >
      {siteOf(source).charAt(0)}
    </span>
  );
}

interface Preview {
  /** Index of the cited part the chip belongs to. */
  part: number;
  x: number;
  y: number;
}

/**
 * Opens a preview after a short hover, and lets it glide from chip to chip
 * without re-entering while the user moves along a sentence.
 */
function usePreview() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [warm, setWarm] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClosed = useRef(0);

  const clear = useCallback(() => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
    }
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
    }
  }, []);

  const show = useCallback(
    (next: Preview, immediate = false) => {
      clear();
      const isWarm =
        preview !== null || Date.now() - lastClosed.current < WARM_MS;
      if (immediate || isWarm) {
        setWarm(preview !== null);
        setPreview(next);
        return;
      }
      openTimer.current = setTimeout(() => {
        setWarm(false);
        setPreview(next);
      }, OPEN_DELAY_MS);
    },
    [preview, clear]
  );

  const hide = useCallback(
    (immediate = false) => {
      clear();
      const close = () => {
        lastClosed.current = Date.now();
        setPreview(null);
      };
      if (immediate) {
        close();
        return;
      }
      closeTimer.current = setTimeout(close, CLOSE_DELAY_MS);
    },
    [clear]
  );

  useEffect(() => clear, [clear]);

  return { preview, warm, show, hide };
}

export default function AICitations({
  parts = DEMO_PARTS,
  sources = DEMO_SOURCES,
  className,
}: AICitationsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { preview, warm, show, hide } = usePreview();
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const previewId = useId();
  const listId = useId();

  const byId = new Map(sources.map((source) => [source.id, source]));
  // Sources numbered in the order the answer first cites them.
  const order: string[] = [];
  for (const part of parts) {
    for (const id of part.cite ?? []) {
      if (!order.includes(id) && byId.has(id)) {
        order.push(id);
      }
    }
  }
  const cited = order
    .map((id) => byId.get(id))
    .filter((source): source is CitationSource => Boolean(source));

  const place = (index: number, chip: HTMLElement): Preview => {
    const root = rootRef.current?.getBoundingClientRect();
    const rect = chip.getBoundingClientRect();
    const width = Math.min(CARD_WIDTH, root?.width ?? CARD_WIDTH);
    const left = rect.left - (root?.left ?? 0) + rect.width / 2 - width / 2;
    const max = (root?.width ?? width) - width;
    return {
      part: index,
      x: Math.min(Math.max(0, left), Math.max(0, max)),
      y: rect.top - (root?.top ?? 0) - 8,
    };
  };

  const active = preview ? parts[preview.part] : null;
  const activeSources = (active?.cite ?? [])
    .map((id) => byId.get(id))
    .filter((source): source is CitationSource => Boolean(source));

  // Escape closes a preview opened by keyboard or tap.
  useEffect(() => {
    if (!preview) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        hide(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preview, hide]);

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("relative w-full max-w-lg", className)} ref={rootRef}>
        <p className="text-[15px] text-zinc-800 leading-7 dark:text-zinc-200">
          {parts.map((part, index) => {
            const partSources = (part.cite ?? [])
              .map((id) => byId.get(id))
              .filter((source): source is CitationSource => Boolean(source));
            if (partSources.length === 0) {
              // biome-ignore lint/suspicious/noArrayIndexKey: parts are an ordered, static answer
              return <span key={index}>{part.text}</span>;
            }
            const first = partSources[0];
            const isActive = preview?.part === index;
            const isLinked = partSources.some(
              (source) => source.id === hoveredSource
            );
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: parts are an ordered, static answer
              <span key={index}>
                {/* The claim a chip supports lights up while it's previewed. */}
                <span
                  className={cn(
                    "rounded-[3px] decoration-1 underline-offset-4 transition-[background-color,text-decoration-color] duration-150",
                    isActive || isLinked
                      ? "bg-sky-100/80 underline decoration-sky-400/70 dark:bg-sky-400/15 dark:decoration-sky-400/50"
                      : "bg-transparent underline decoration-transparent"
                  )}
                >
                  {part.text}
                </span>{" "}
                <button
                  aria-describedby={isActive ? previewId : undefined}
                  aria-label={`Sources: ${partSources.map(siteOf).join(", ")}`}
                  className={cn(
                    "inline-flex h-5 translate-y-[-1px] items-center gap-1 rounded-full py-0 pr-1.5 pl-0.5 align-middle font-medium text-[11px] outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sky-500/50",
                    isActive || isLinked
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/15"
                  )}
                  onBlur={() => hide(true)}
                  // Focus already opened it for mouse and keyboard; a tap
                  // on touch opens it here. Blur or Escape closes it.
                  onClick={(event) =>
                    show(place(index, event.currentTarget), true)
                  }
                  onFocus={(event) =>
                    show(place(index, event.currentTarget), true)
                  }
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse") {
                      show(place(index, event.currentTarget));
                    }
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType === "mouse") {
                      hide();
                    }
                  }}
                  type="button"
                >
                  <Monogram className="size-4 rounded-full" source={first} />
                  {siteOf(first)}
                  {partSources.length > 1 && (
                    <span className="opacity-60">
                      +{partSources.length - 1}
                    </span>
                  )}
                </button>
              </span>
            );
          })}
        </p>

        {/* One preview for every chip. It glides between chips once open,
            and fades in fresh after a pause. */}
        <AnimatePresence>
          {preview && activeSources.length > 0 && (
            <motion.div
              animate={{
                opacity: 1,
                scale: 1,
                x: preview.x,
                y: preview.y,
              }}
              className="pointer-events-none absolute top-0 left-0 z-10"
              exit={{ opacity: 0, scale: 0.97 }}
              id={previewId}
              initial={{ opacity: 0, scale: 0.97, x: preview.x, y: preview.y }}
              role="tooltip"
              style={{
                // The card hangs above this box, so its top edge is the
                // card's bottom: grow from there, toward the chip.
                transformOrigin: "50% 0%",
                width: Math.min(
                  CARD_WIDTH,
                  rootRef.current?.offsetWidth ?? CARD_WIDTH
                ),
              }}
              transition={{
                opacity: { duration: 0.14, ease: EASE_OUT },
                scale: { duration: 0.14, ease: EASE_OUT },
                x: warm ? { duration: 0.22, ease: EASE_OUT } : { duration: 0 },
                y: warm ? { duration: 0.22, ease: EASE_OUT } : { duration: 0 },
              }}
            >
              <div className="origin-bottom -translate-y-full rounded-xl bg-white p-1 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.2)] ring-1 ring-black/10 dark:bg-zinc-900 dark:ring-white/10">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.div
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, filter: "blur(2px)" }}
                    initial={{ opacity: 0, filter: "blur(2px)" }}
                    key={preview.part}
                    transition={{ duration: 0.16, ease: EASE_OUT }}
                  >
                    {activeSources.map((source) => (
                      <div className="rounded-lg p-2.5" key={source.id}>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          <Monogram source={source} />
                          <span className="truncate">{hostOf(source.url)}</span>
                          <span className="ml-auto shrink-0 tabular-nums">
                            {order.indexOf(source.id) + 1}
                          </span>
                        </div>
                        <p className="mt-1.5 font-medium text-sm text-zinc-900 leading-snug dark:text-zinc-100">
                          {source.title}
                        </p>
                        {source.snippet && (
                          <p className="mt-1 line-clamp-3 text-xs text-zinc-500 leading-relaxed dark:text-zinc-400">
                            {source.snippet}
                          </p>
                        )}
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {cited.length > 0 && (
          <div className="mt-4">
            <button
              aria-controls={listId}
              aria-expanded={listOpen}
              className="group/sources flex items-center gap-2 rounded-full py-1 pr-2.5 pl-1 text-xs text-zinc-600 outline-hidden transition-colors duration-150 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-sky-500/50 dark:text-zinc-300 dark:hover:bg-white/10"
              onClick={() => setListOpen((open) => !open)}
              type="button"
            >
              <span className="flex -space-x-1">
                {cited.slice(0, 4).map((source) => (
                  <Monogram
                    className="size-5 rounded-full ring-2 ring-white dark:ring-zinc-950"
                    key={source.id}
                    source={source}
                  />
                ))}
              </span>
              {cited.length} sources
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "size-3.5 text-zinc-400 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                  listOpen && "rotate-180"
                )}
              />
            </button>
            <AnimatePresence initial={false}>
              {listOpen && (
                <motion.ol
                  animate={{ height: "auto", opacity: 1 }}
                  className="overflow-hidden"
                  exit={{ height: 0, opacity: 0 }}
                  id={listId}
                  initial={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: EASE_OUT }}
                >
                  {cited.map((source, index) => (
                    <li className="pt-1 first:pt-2" key={source.id}>
                      <a
                        className="group/source flex items-center gap-2.5 rounded-lg px-2 py-1.5 outline-hidden transition-colors duration-150 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-sky-500/50 dark:hover:bg-white/5"
                        href={source.url}
                        onBlur={() => setHoveredSource(null)}
                        onFocus={() => setHoveredSource(source.id)}
                        onPointerEnter={() => setHoveredSource(source.id)}
                        onPointerLeave={() => setHoveredSource(null)}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <span className="w-3 shrink-0 text-right text-xs text-zinc-400 tabular-nums">
                          {index + 1}
                        </span>
                        <Monogram source={source} />
                        <span className="min-w-0 flex-1 truncate text-sm text-zinc-800 dark:text-zinc-200">
                          {source.title}
                        </span>
                        <span className="hidden shrink-0 text-xs text-zinc-400 sm:inline dark:text-zinc-500">
                          {hostOf(source.url)}
                        </span>
                        <ArrowUpRight
                          aria-hidden="true"
                          className="size-3.5 shrink-0 text-zinc-300 transition-colors duration-150 group-hover/source:text-zinc-600 dark:text-zinc-600 dark:group-hover/source:text-zinc-300"
                        />
                      </a>
                    </li>
                  ))}
                </motion.ol>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
