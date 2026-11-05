"use client";

/**
 * @author: @kokonutui
 * @description: AI Attachment
 * @version: 1.0.0
 * @date: 2026-11-05
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  AnimatePresence,
  animate,
  MotionConfig,
  type MotionValue,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { Fragment, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface AttachedFile {
  name: string;
  /** In bytes. */
  size: number;
  pages: number;
}

/** A run of text, or a citation to a page (1-based). */
export type AnswerPart = string | { page: number };

export interface AIAttachmentProps {
  file?: AttachedFile;
  prompt?: string;
  answer?: AnswerPart[];
  /** Demo timing: how long the upload takes, in ms. */
  uploadMs?: number;
  /** Demo timing: how long each page takes to read, in ms. */
  pageMs?: number;
  className?: string;
}

type Phase = "uploading" | "reading" | "done";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** Line widths on a page thumbnail, in %, cycled per page. */
const LINES = [92, 100, 84, 96, 70, 100, 88, 60];
/** Which line of a page a citation points at. */
const CITED_LINE = 3;

const DEMO_FILE: AttachedFile = {
  name: "Q3-board-report.pdf",
  size: 4_200_000,
  pages: 12,
};

const DEMO_ANSWER: AnswerPart[] = [
  "Revenue grew 18% to $4.2M, almost all of it from the new enterprise tier",
  { page: 3 },
  ". Churn fell to 2.1% after the onboarding rework",
  { page: 6 },
  ". The one risk it flags is hiring: two senior roles are still open, which pushed the EU launch to Q1",
  { page: 9 },
  ".",
];

const mb = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

export default function AIAttachment({
  file = DEMO_FILE,
  prompt = "What changed this quarter? Keep it short.",
  answer = DEMO_ANSWER,
  uploadMs = 1400,
  pageMs = 260,
  className,
}: AIAttachmentProps) {
  const [phase, setPhase] = useState<Phase>("uploading");
  const reduce = useReducedMotion();
  const uploaded = useMotionValue(0);
  /** Pages read so far; the one being read is at this index. */
  const [read, setRead] = useState(0);
  const [lit, setLit] = useState<number | null>(null);

  // Uploads on a motion value, so the ring and byte count move every frame
  // without re-rendering the chat.
  useEffect(() => {
    if (phase !== "uploading") {
      return;
    }
    const controls = animate(uploaded, 1, {
      duration: uploadMs / 1000,
      ease: [0.33, 1, 0.68, 1],
      onComplete: () => setPhase("reading"),
    });
    return () => controls.stop();
  }, [phase, uploadMs, uploaded]);

  // Reads one page at a time.
  useEffect(() => {
    if (phase !== "reading") {
      return;
    }
    if (read >= file.pages) {
      const t = setTimeout(() => setPhase("done"), 300);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRead((n) => n + 1), pageMs);
    return () => clearTimeout(t);
  }, [phase, read, file.pages, pageMs]);

  const done = phase === "done";
  const seconds = ((file.pages * pageMs) / 1000).toFixed(1);

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("flex w-full max-w-md flex-col gap-4", className)}>
        <div className="flex flex-col items-end gap-1.5">
          <FileChip file={file} phase={phase} progress={uploaded} />
          <p className="max-w-[85%] rounded-2xl rounded-br-md bg-zinc-100 px-3.5 py-2 text-[14px] text-zinc-800 leading-snug dark:bg-zinc-800 dark:text-zinc-100">
            {prompt}
          </p>
        </div>

        <AnimatePresence>
          {phase !== "uploading" && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[22px] bg-black/[0.04] p-1 dark:bg-white/[0.06]"
              initial={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
            >
              <div className="flex h-8 items-center gap-2 overflow-hidden px-3 text-[12px]">
                <span className="relative flex size-3.5 items-center justify-center">
                  <AnimatePresence initial={false} mode="popLayout">
                    {done ? (
                      <motion.svg
                        animate={{ opacity: 1 }}
                        aria-hidden="true"
                        className="size-3.5 text-emerald-600 dark:text-emerald-400"
                        fill="none"
                        initial={{ opacity: 0 }}
                        key="done"
                        viewBox="0 0 16 16"
                      >
                        <motion.path
                          animate={{ pathLength: 1 }}
                          d="M3.5 8.5l3 3 6-7"
                          initial={{ pathLength: 0 }}
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          transition={{ duration: 0.35, ease: EASE_OUT }}
                        />
                      </motion.svg>
                    ) : (
                      <motion.span exit={{ opacity: 0 }} key="spin">
                        <Spinner />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    className="min-w-0 truncate font-medium text-zinc-700 dark:text-zinc-300"
                    exit={{ opacity: 0, y: -6, filter: "blur(2px)" }}
                    initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
                    key={done ? "read" : "reading"}
                    transition={{ duration: 0.22, ease: EASE_OUT }}
                  >
                    {done ? `Read ${file.pages} pages` : `Reading ${file.name}`}
                  </motion.span>
                </AnimatePresence>
                <span className="ml-auto shrink-0 font-mono text-[11px] text-zinc-400 tabular-nums dark:text-zinc-500">
                  {done
                    ? `${seconds}s`
                    : `${Math.min(read + 1, file.pages)} / ${file.pages}`}
                </span>
              </div>

              <div className="grid grid-cols-12 gap-1 rounded-[18px] bg-white p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-black/[0.06] sm:gap-1.5 dark:bg-zinc-900 dark:ring-white/[0.08]">
                {Array.from({ length: file.pages }, (_, i) => (
                  <Page
                    index={i}
                    // biome-ignore lint/suspicious/noArrayIndexKey: pages are a fixed, ordered list
                    key={i}
                    lit={lit === i + 1}
                    pageMs={pageMs}
                    reduce={Boolean(reduce)}
                    state={pageState(i, read, phase)}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {done && (
            <motion.p
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              className="text-[15px] text-zinc-800 leading-7 dark:text-zinc-200"
              initial={{ opacity: 0, filter: "blur(4px)", y: 4 }}
              transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.15 }}
            >
              {answer.map((part, i) =>
                typeof part === "string" ? (
                  // biome-ignore lint/suspicious/noArrayIndexKey: answer parts are static
                  <Fragment key={i}>{part}</Fragment>
                ) : (
                  <Cite
                    active={lit === part.page}
                    // biome-ignore lint/suspicious/noArrayIndexKey: answer parts are static
                    key={i}
                    onLight={setLit}
                    page={part.page}
                  />
                )
              )}
            </motion.p>
          )}
        </AnimatePresence>
        <p aria-live="polite" className="sr-only">
          {phase === "reading" ? `Reading ${file.name}` : ""}
          {done ? `Read ${file.pages} pages` : ""}
        </p>
      </div>
    </MotionConfig>
  );
}

type PageState = "waiting" | "reading" | "read";

const pageState = (i: number, read: number, phase: Phase): PageState => {
  if (phase === "done" || i < read) {
    return "read";
  }
  return i === read && phase === "reading" ? "reading" : "waiting";
};

function FileChip({
  file,
  phase,
  progress,
}: {
  file: AttachedFile;
  phase: Phase;
  progress: MotionValue<number>;
}) {
  const uploading = phase === "uploading";
  const sent = useTransform(
    progress,
    (p) => `${mb(file.size * p)} of ${mb(file.size)}`
  );
  return (
    <div className="flex w-60 max-w-[85%] items-center gap-2.5 rounded-2xl bg-white p-2 pr-3 ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10">
      <span className="relative flex h-10 w-8 shrink-0 items-end justify-center rounded-[6px] bg-red-50 pb-1 ring-1 ring-red-500/15 dark:bg-red-500/10">
        <span className="absolute top-0 right-0 size-2 rounded-bl-[3px] bg-red-500/20" />
        <span className="font-bold text-[7.5px] text-red-600 tracking-wide dark:text-red-400">
          PDF
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-[13px] text-zinc-900 dark:text-zinc-100">
          {file.name}
        </span>
        <span className="mt-0.5 block truncate text-[11.5px] text-zinc-500 tabular-nums dark:text-zinc-400">
          {uploading ? (
            <motion.span>{sent}</motion.span>
          ) : (
            `${file.pages} pages · ${mb(file.size)}`
          )}
        </span>
      </span>
      <AnimatePresence initial={false}>
        {uploading && (
          <motion.svg
            aria-hidden="true"
            className="size-4 shrink-0 -rotate-90"
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.2 }}
            viewBox="0 0 16 16"
          >
            <circle
              className="stroke-zinc-200 dark:stroke-zinc-700"
              cx="8"
              cy="8"
              fill="none"
              r="7"
              strokeWidth="1.75"
            />
            <motion.circle
              className="stroke-zinc-900 dark:stroke-zinc-100"
              cx="8"
              cy="8"
              fill="none"
              r="7"
              strokeLinecap="round"
              strokeWidth="1.75"
              style={{ pathLength: progress }}
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A page thumbnail. A scan line passes over it while it is read. */
function Page({
  index,
  state,
  lit,
  pageMs,
  reduce,
}: {
  index: number;
  state: PageState;
  lit: boolean;
  pageMs: number;
  reduce: boolean;
}) {
  const lines = index === 0 ? 5 : 7;
  return (
    <motion.div
      animate={{
        y: lit && !reduce ? -3 : 0,
        opacity: state === "waiting" ? 0.45 : 1,
      }}
      className={cn(
        "relative flex aspect-[3/4] min-w-0 flex-col gap-[2px] overflow-hidden rounded-[3px] bg-white p-[3px] ring-1 transition-[box-shadow] duration-200 dark:bg-zinc-800",
        state === "reading" && "ring-blue-500/60 dark:ring-blue-400/60",
        state !== "reading" &&
          (lit
            ? "ring-orange-500 dark:ring-orange-400"
            : "ring-black/[0.1] dark:ring-white/10")
      )}
      initial={false}
      transition={{ duration: 0.25, ease: EASE_OUT }}
    >
      {index === 0 && (
        <span className="mb-[2px] h-[3px] w-3/5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
      )}
      {Array.from({ length: lines }, (_, l) => (
        <span
          className={cn(
            "h-[1.5px] rounded-full transition-colors duration-300",
            state === "waiting"
              ? "bg-zinc-200 dark:bg-zinc-700"
              : "bg-zinc-300 dark:bg-zinc-600",
            lit && l === CITED_LINE && "bg-orange-500 dark:bg-orange-400"
          )}
          // biome-ignore lint/suspicious/noArrayIndexKey: lines are decoration
          key={l}
          style={{ width: `${LINES[(l + index) % LINES.length]}%` }}
        />
      ))}
      {state === "reading" && (
        <motion.span
          animate={{ y: "0%" }}
          className="absolute inset-0 border-blue-500 border-b bg-blue-500/[0.08] dark:border-blue-400 dark:bg-blue-400/10"
          initial={{ y: "-100%" }}
          transition={{ duration: pageMs / 1000, ease: "linear" }}
        />
      )}
    </motion.div>
  );
}

/** A page citation. Hover or focus it to light the page it points at. */
function Cite({
  page,
  active,
  onLight,
}: {
  page: number;
  active: boolean;
  onLight: (page: number | null) => void;
}) {
  return (
    <button
      aria-label={`Page ${page}`}
      className={cn(
        "mx-0.5 inline-flex h-5 translate-y-[-1px] items-center rounded-md px-1.5 align-middle font-medium text-[11px] tabular-nums outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-orange-500/40",
        active
          ? "bg-orange-100 text-orange-900 dark:bg-orange-400/20 dark:text-orange-200"
          : "bg-zinc-100 text-zinc-600 dark:bg-white/[0.08] dark:text-zinc-300"
      )}
      onBlur={() => onLight(null)}
      onFocus={() => onLight(page)}
      onPointerEnter={(e) => e.pointerType === "mouse" && onLight(page)}
      onPointerLeave={(e) => e.pointerType === "mouse" && onLight(null)}
      type="button"
    >
      p.{page}
    </button>
  );
}

function Spinner() {
  return (
    <motion.svg
      animate={{ rotate: 360 }}
      aria-hidden="true"
      className="size-3.5 text-zinc-700 dark:text-zinc-300"
      fill="none"
      transition={{
        duration: 0.6,
        ease: "linear",
        repeat: Number.POSITIVE_INFINITY,
      }}
      viewBox="0 0 16 16"
    >
      <circle
        cx="8"
        cy="8"
        opacity="0.2"
        r="6.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.75"
      />
    </motion.svg>
  );
}
