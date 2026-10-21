"use client";

/**
 * @author: @kokonutui
 * @description: AI Diff Review
 * @version: 1.1.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, ChevronRight, Undo2, X } from "lucide-react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface DiffLine {
  type: "add" | "remove" | "context";
  text: string;
}

export interface DiffHunk {
  /** First line number of the hunk in the new file. */
  start: number;
  lines: DiffLine[];
}

export type FileDecision = "pending" | "accepted" | "rejected";

export interface FileChange {
  path: string;
  hunks: DiffHunk[];
  /** True for a file the agent created. */
  created?: boolean;
}

interface AIDiffReviewProps {
  /**
   * The agent's edits. When omitted, a demo edit streams in, file by file,
   * then waits for review.
   */
  files?: FileChange[];
  /** Called when a file is accepted, rejected or put back to pending. */
  onDecision?: (path: string, decision: FileDecision) => void;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const DEMO_LINE_MS = 90;
/** Pause before the demo starts writing, so a replay clears first. */
const DEMO_START_MS = 320;
/** Heights retarget on every streamed line, so they follow a spring. */
const HEIGHT_SPRING = { type: "spring", duration: 0.32, bounce: 0 } as const;
const ROW_HEIGHT = 40;
const SWAP_IN = { duration: 0.18, ease: EASE_OUT } as const;
const SWAP_OUT = { duration: 0.12, ease: EASE_OUT } as const;

const DEMO_FILES: FileChange[] = [
  {
    path: "lib/validate.ts",
    created: true,
    hunks: [
      {
        start: 1,
        lines: [
          {
            type: "add",
            text: "const POSTCODE = /^[A-Z]{1,2}\\d[A-Z\\d]? ?\\d[A-Z]{2}$/i;",
          },
          { type: "add", text: "" },
          { type: "add", text: "export function isPostcode(value: string) {" },
          { type: "add", text: "  return POSTCODE.test(value.trim());" },
          { type: "add", text: "}" },
        ],
      },
    ],
  },
  {
    path: "app/checkout/form.tsx",
    hunks: [
      {
        start: 18,
        lines: [
          { type: "context", text: "  const onSubmit = (data: Address) => {" },
          { type: "remove", text: "    if (!data.postcode) {" },
          { type: "remove", text: '      return setError("Required");' },
          { type: "add", text: "    if (!isPostcode(data.postcode)) {" },
          {
            type: "add",
            text: '      return setError("Enter a valid postcode");',
          },
          { type: "context", text: "    }" },
          { type: "context", text: "    submit(data);" },
        ],
      },
    ],
  },
  {
    path: "app/checkout/form.test.ts",
    hunks: [
      {
        start: 31,
        lines: [
          {
            type: "context",
            text: '  it("rejects an empty postcode", () => {',
          },
          {
            type: "remove",
            text: '    expect(errorFor("")).toBe("Required");',
          },
          {
            type: "add",
            text: '    expect(errorFor("")).toBe("Enter a valid postcode");',
          },
          { type: "add", text: "  });" },
          { type: "add", text: "" },
          { type: "add", text: '  it("accepts a spaced postcode", () => {' },
          { type: "add", text: '    expect(errorFor("SW1A 1AA")).toBeNull();' },
          { type: "context", text: "  });" },
        ],
      },
    ],
  },
];

const countLines = (hunks: DiffHunk[]) => {
  let added = 0;
  let removed = 0;
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === "add") {
        added += 1;
      } else if (line.type === "remove") {
        removed += 1;
      }
    }
  }
  return { added, removed };
};

/** Cuts the files down to their first `shown` lines, in order. */
const takeLines = (files: FileChange[], shown: number) => {
  let left = shown;
  const out: FileChange[] = [];
  for (const file of files) {
    if (left <= 0) {
      break;
    }
    const hunks: DiffHunk[] = [];
    for (const hunk of file.hunks) {
      if (left <= 0) {
        break;
      }
      hunks.push({ ...hunk, lines: hunk.lines.slice(0, left) });
      left -= hunk.lines.length;
    }
    out.push({ ...file, hunks });
  }
  return out;
};

const TOTAL_DEMO_LINES = DEMO_FILES.reduce(
  (sum, file) =>
    sum + file.hunks.reduce((lines, hunk) => lines + hunk.lines.length, 0),
  0
);

/** Streams the demo edit in a line at a time, pausing offscreen. */
function useDemoStream(
  enabled: boolean,
  rootRef: React.RefObject<HTMLElement | null>
) {
  const [shown, setShown] = useState(0);
  const [visible, setVisible] = useState(false);
  const [run, setRun] = useState(0);

  useEffect(() => {
    const element = rootRef.current;
    if (!(enabled && element)) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting)
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, rootRef]);

  const writing = enabled && shown < TOTAL_DEMO_LINES;

  useEffect(() => {
    if (!(writing && visible)) {
      return;
    }
    const id = setTimeout(
      () => setShown((value) => Math.min(TOTAL_DEMO_LINES, value + 1)),
      shown === 0 ? DEMO_START_MS : DEMO_LINE_MS
    );
    return () => clearTimeout(id);
  }, [writing, visible, shown]);

  return {
    files: takeLines(DEMO_FILES, shown),
    writing,
    run,
    replay: () => {
      setShown(0);
      setRun((value) => value + 1);
    },
  };
}

const blockColor = (index: number, green: number, total: number) => {
  if (total === 0) {
    return "bg-zinc-200 dark:bg-zinc-700";
  }
  return index < green ? "bg-emerald-500" : "bg-red-500";
};

/** GitHub-style five-block bar: how much of the change adds vs. removes. */
function ChangeBar({ added, removed }: { added: number; removed: number }) {
  const total = added + removed;
  const green = total === 0 ? 0 : Math.round((added / total) * 5);
  return (
    <span aria-hidden="true" className="hidden gap-px sm:flex">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          className={cn(
            "size-1.5 rounded-[1px] transition-colors duration-200",
            blockColor(i, green, total)
          )}
          // biome-ignore lint/suspicious/noArrayIndexKey: five fixed blocks
          key={i}
        />
      ))}
    </span>
  );
}

const LINE_STYLES: Record<DiffLine["type"], string> = {
  add: "bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
  remove: "bg-red-500/10 text-red-900 dark:text-red-200",
  context: "text-zinc-600 dark:text-zinc-400",
};
const LINE_SIGNS: Record<DiffLine["type"], string> = {
  add: "+",
  remove: "−",
  context: " ",
};

function Hunk({ hunk }: { hunk: DiffHunk }) {
  let number = hunk.start;
  return (
    <div className="py-1">
      {hunk.lines.map((line, index) => {
        const lineNumber = line.type === "remove" ? null : number;
        if (line.type !== "remove") {
          number += 1;
        }
        return (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex font-mono text-xs leading-5",
              LINE_STYLES[line.type]
            )}
            initial={{ opacity: 0, y: 3 }}
            // biome-ignore lint/suspicious/noArrayIndexKey: lines of a hunk only ever append
            key={index}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <span className="w-9 shrink-0 select-none pr-2 text-right text-zinc-400 tabular-nums dark:text-zinc-600">
              {lineNumber}
            </span>
            <span className="w-4 shrink-0 select-none text-center opacity-60">
              {LINE_SIGNS[line.type]}
            </span>
            <span className="whitespace-pre pr-3">{line.text || " "}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

/**
 * Animates to the measured height of its content, so a diff that grows a
 * line at a time glides open instead of stepping, and an expand that starts
 * mid-stream never snaps at the end. Content stays mounted while closed.
 */
function Collapse({
  open,
  id,
  reduce,
  children,
}: {
  open: boolean;
  id: string;
  reduce: boolean;
  children: ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const element = innerRef.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      animate={{ height: open ? height : 0, opacity: open ? 1 : 0 }}
      className="overflow-hidden"
      id={id}
      inert={!open}
      initial={false}
      transition={
        reduce
          ? { duration: 0 }
          : {
              height: HEIGHT_SPRING,
              opacity: open ? SWAP_IN : SWAP_OUT,
            }
      }
    >
      <div ref={innerRef}>{children}</div>
    </motion.div>
  );
}

function FileRow({
  file,
  decision,
  open,
  writing,
  onToggle,
  onDecide,
}: {
  file: FileChange;
  decision: FileDecision;
  open: boolean;
  writing: boolean;
  onToggle: () => void;
  onDecide: (decision: FileDecision) => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const diffId = useId();
  const { added, removed } = countLines(file.hunks);
  const slash = file.path.lastIndexOf("/");
  const dir = file.path.slice(0, slash + 1);
  const name = file.path.slice(slash + 1);
  const isOpen = open && decision === "pending";

  return (
    <motion.li
      className="overflow-hidden border-zinc-100 border-t first:border-t-0 dark:border-white/5"
      exit={{ height: 0, opacity: 0 }}
      transition={reduce ? { duration: 0 } : SWAP_IN}
    >
      <motion.div
        animate={{ height: ROW_HEIGHT, opacity: 1 }}
        className="group/row relative flex items-center gap-2 pr-1.5 pl-1"
        initial={{ height: 0, opacity: 0 }}
        style={{ height: ROW_HEIGHT }}
        transition={reduce ? { duration: 0 } : SWAP_IN}
      >
        <button
          aria-controls={diffId}
          aria-expanded={isOpen}
          className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-left outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/40 disabled:cursor-default"
          disabled={decision !== "pending" || writing}
          onClick={onToggle}
          type="button"
        >
          <ChevronRight
            aria-hidden="true"
            className={cn(
              "size-3.5 shrink-0 text-zinc-400 transition-[rotate,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
              isOpen && "rotate-90",
              decision !== "pending" && "opacity-0"
            )}
          />
          <span
            className={cn(
              "min-w-0 truncate font-mono text-[13px] transition-colors duration-200",
              decision === "rejected" &&
                "text-zinc-400 line-through decoration-zinc-300 dark:text-zinc-500 dark:decoration-zinc-600"
            )}
          >
            <span className="text-zinc-400 dark:text-zinc-500">{dir}</span>
            <span
              className={cn(
                decision !== "rejected" && "text-zinc-900 dark:text-zinc-100"
              )}
            >
              {name}
            </span>
          </span>
          {file.created && (
            <span
              className={cn(
                "shrink-0 rounded bg-emerald-500/10 px-1 text-[10px] text-emerald-700 leading-4 transition-opacity duration-200 dark:text-emerald-300",
                decision === "rejected" && "opacity-0"
              )}
            >
              new
            </span>
          )}
        </button>

        <AnimatePresence initial={false} mode="popLayout">
          {decision === "pending" ? (
            <motion.div
              animate={{ opacity: 1, filter: "blur(0px)", transition: SWAP_IN }}
              className="flex items-center gap-2"
              exit={{ opacity: 0, filter: "blur(2px)", transition: SWAP_OUT }}
              initial={{ opacity: 0, filter: "blur(2px)" }}
              key="counts"
            >
              <span className="font-mono text-[11px] tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400">
                  +{added}
                </span>{" "}
                <span className="text-red-600 dark:text-red-400">
                  −{removed}
                </span>
              </span>
              <ChangeBar added={added} removed={removed} />
              {/* Kept in the layout while writing so the counts never jump. */}
              <span
                className={cn(
                  "flex items-center gap-0.5 transition-opacity duration-200",
                  writing && "opacity-0"
                )}
                inert={writing}
              >
                <button
                  aria-label={`Reject ${file.path}`}
                  className="flex size-7 items-center justify-center rounded-md text-zinc-400 outline-hidden transition-colors duration-150 hover:bg-zinc-100 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:hover:bg-white/10 dark:hover:text-red-400"
                  onClick={() => onDecide("rejected")}
                  type="button"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
                <button
                  aria-label={`Accept ${file.path}`}
                  className="flex size-7 items-center justify-center rounded-md text-zinc-400 outline-hidden transition-colors duration-150 hover:bg-zinc-100 hover:text-emerald-600 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:hover:bg-white/10 dark:hover:text-emerald-400"
                  onClick={() => onDecide("accepted")}
                  type="button"
                >
                  <Check aria-hidden="true" className="size-3.5" />
                </button>
              </span>
            </motion.div>
          ) : (
            <motion.div
              animate={{ opacity: 1, filter: "blur(0px)", transition: SWAP_IN }}
              className="flex items-center gap-1.5"
              exit={{ opacity: 0, filter: "blur(2px)", transition: SWAP_OUT }}
              initial={{ opacity: 0, filter: "blur(2px)" }}
              key="decided"
            >
              <span
                className={cn(
                  "text-xs",
                  decision === "accepted"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-400 dark:text-zinc-500"
                )}
              >
                {decision === "accepted" ? "Accepted" : "Reverted"}
              </span>
              <button
                aria-label={`Undo for ${file.path}`}
                className="flex size-7 items-center justify-center rounded-md text-zinc-400 outline-hidden transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:hover:bg-white/10 dark:hover:text-zinc-200"
                onClick={() => onDecide("pending")}
                type="button"
              >
                <Undo2 aria-hidden="true" className="size-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <Collapse id={diffId} open={isOpen} reduce={reduce}>
        <div className="px-2 pb-2">
          <div className="overflow-x-auto rounded-lg bg-zinc-50 ring-1 ring-black/5 ring-inset dark:bg-white/[0.03] dark:ring-white/10">
            {file.hunks.map((hunk) => (
              <Hunk hunk={hunk} key={hunk.start} />
            ))}
          </div>
        </div>
      </Collapse>
    </motion.li>
  );
}

export default function AIDiffReview({
  files: filesProp,
  onDecision,
  className,
}: AIDiffReviewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const demo = useDemoStream(filesProp === undefined, rootRef);
  const files = filesProp ?? demo.files;
  const writing = filesProp === undefined && demo.writing;
  const [decisions, setDecisions] = useState<Record<string, FileDecision>>({});
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  // A replayed demo starts with a clean slate.
  useEffect(() => {
    if (demo.run > 0) {
      setDecisions({});
      setOpened({});
    }
  }, [demo.run]);

  const decide = (path: string, decision: FileDecision) => {
    setDecisions((current) => ({ ...current, [path]: decision }));
    onDecision?.(path, decision);
  };
  const decisionOf = (path: string) => decisions[path] ?? "pending";

  const totals = files.reduce(
    (sum, file) => {
      const { added, removed } = countLines(file.hunks);
      return { added: sum.added + added, removed: sum.removed + removed };
    },
    { added: 0, removed: 0 }
  );
  const pending = files.filter((file) => decisionOf(file.path) === "pending");
  const accepted = files.filter(
    (file) => decisionOf(file.path) === "accepted"
  ).length;
  const allDecided = !writing && files.length > 0 && pending.length === 0;
  // While streaming, only the file being written is open. When the demo
  // finishes, the last file stays open rather than folding the card shut.
  const writingPath = writing ? files.at(-1)?.path : undefined;
  const restingPath = filesProp === undefined ? files.at(-1)?.path : undefined;
  const isOpen = (path: string) =>
    writingPath === undefined
      ? (opened[path] ?? path === restingPath)
      : path === writingPath;
  let actions: "review" | "replay" | null = null;
  if (allDecided && filesProp === undefined) {
    actions = "replay";
  } else if (!(writing || allDecided)) {
    actions = "review";
  }

  let title = `${files.length} ${files.length === 1 ? "file" : "files"} changed`;
  if (writing) {
    title = "Editing files";
  } else if (allDecided) {
    title = `${accepted} of ${files.length} kept`;
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("w-full max-w-lg", className)} ref={rootRef}>
        <div className="rounded-2xl bg-black/5 p-1.5 dark:bg-white/5">
          <div className="flex h-9 items-center gap-2 px-2.5">
            <output className="relative font-medium text-sm text-zinc-900 dark:text-zinc-100">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  animate={{
                    opacity: 1,
                    filter: "blur(0px)",
                    transition: SWAP_IN,
                  }}
                  className="inline-block whitespace-nowrap"
                  exit={{
                    opacity: 0,
                    filter: "blur(2px)",
                    transition: SWAP_OUT,
                  }}
                  initial={{ opacity: 0, filter: "blur(2px)" }}
                  key={title}
                >
                  {title}
                </motion.span>
              </AnimatePresence>
            </output>
            <motion.span
              className="font-mono text-[11px] tabular-nums"
              layout="position"
              transition={SWAP_IN}
            >
              <span className="text-emerald-600 dark:text-emerald-400">
                +{totals.added}
              </span>{" "}
              <span className="text-red-600 dark:text-red-400">
                −{totals.removed}
              </span>
            </motion.span>
            <div className="relative ml-auto flex items-center">
              <AnimatePresence initial={false} mode="popLayout">
                {actions === "review" && (
                  <motion.div
                    animate={{
                      opacity: 1,
                      filter: "blur(0px)",
                      transition: SWAP_IN,
                    }}
                    className="flex items-center gap-1"
                    exit={{
                      opacity: 0,
                      filter: "blur(2px)",
                      transition: SWAP_OUT,
                    }}
                    initial={{ opacity: 0, filter: "blur(2px)" }}
                    key="review"
                  >
                    <button
                      className="h-7 rounded-md px-2 text-xs text-zinc-600 outline-hidden transition-colors duration-150 hover:bg-black/5 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
                      onClick={() => {
                        for (const file of pending) {
                          decide(file.path, "rejected");
                        }
                      }}
                      type="button"
                    >
                      Reject all
                    </button>
                    <button
                      className="h-7 rounded-md bg-zinc-900 px-2.5 font-medium text-white text-xs outline-hidden transition-colors duration-150 hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400/60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                      onClick={() => {
                        for (const file of pending) {
                          decide(file.path, "accepted");
                        }
                      }}
                      type="button"
                    >
                      Accept all
                    </button>
                  </motion.div>
                )}
                {actions === "replay" && (
                  <motion.button
                    animate={{
                      opacity: 1,
                      filter: "blur(0px)",
                      transition: SWAP_IN,
                    }}
                    className="h-7 rounded-md px-2 text-xs text-zinc-500 outline-hidden transition-colors duration-150 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:text-zinc-400 dark:hover:text-white"
                    exit={{
                      opacity: 0,
                      filter: "blur(2px)",
                      transition: SWAP_OUT,
                    }}
                    initial={{ opacity: 0, filter: "blur(2px)" }}
                    key="replay"
                    onClick={demo.replay}
                    type="button"
                  >
                    Replay
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
          <ul className="rounded-xl bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
            <AnimatePresence initial={false}>
              {files.map((file) => (
                <FileRow
                  decision={decisionOf(file.path)}
                  file={file}
                  key={`${demo.run}:${file.path}`}
                  onDecide={(decision) => decide(file.path, decision)}
                  onToggle={() =>
                    setOpened((current) => ({
                      ...current,
                      [file.path]: !isOpen(file.path),
                    }))
                  }
                  open={isOpen(file.path)}
                  writing={file.path === writingPath}
                />
              ))}
              {files.length === 0 && (
                <motion.li
                  animate={{ height: 44, opacity: 1 }}
                  className="flex items-center overflow-hidden px-3 text-sm text-zinc-400"
                  exit={{ height: 0, opacity: 0 }}
                  initial={{ height: 0, opacity: 0 }}
                  key="waiting"
                  style={{ height: 44 }}
                  transition={SWAP_IN}
                >
                  Waiting for edits…
                </motion.li>
              )}
            </AnimatePresence>
          </ul>
        </div>
      </div>
    </MotionConfig>
  );
}
