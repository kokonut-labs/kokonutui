"use client";

/**
 * @author: @kokonutui
 * @description: AI Diff Review
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, ChevronRight, Undo2, X } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
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
    const id = setInterval(
      () => setShown((value) => Math.min(TOTAL_DEMO_LINES, value + 1)),
      DEMO_LINE_MS
    );
    return () => clearInterval(id);
  }, [writing, visible]);

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
    return "bg-gray-200 dark:bg-gray-700";
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
  context: "text-gray-600 dark:text-gray-400",
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
            animate={{ opacity: 1 }}
            className={cn(
              "flex font-mono text-xs leading-5",
              LINE_STYLES[line.type]
            )}
            initial={{ opacity: 0 }}
            // biome-ignore lint/suspicious/noArrayIndexKey: lines of a hunk only ever append
            key={index}
            transition={{ duration: 0.18, ease: EASE_OUT }}
          >
            <span className="w-9 shrink-0 select-none pr-2 text-right text-gray-400 tabular-nums dark:text-gray-600">
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

function FileRow({
  file,
  decision,
  writing,
  onDecide,
}: {
  file: FileChange;
  decision: FileDecision;
  writing: boolean;
  onDecide: (decision: FileDecision) => void;
}) {
  const [open, setOpen] = useState(false);
  const diffId = useId();
  const { added, removed } = countLines(file.hunks);
  const slash = file.path.lastIndexOf("/");
  const dir = file.path.slice(0, slash + 1);
  const name = file.path.slice(slash + 1);
  const isOpen = (open || writing) && decision === "pending";

  return (
    <li className="border-gray-100 border-t first:border-t-0 dark:border-white/5">
      <div className="group/row flex items-center gap-2 py-1.5 pr-1.5 pl-1">
        <button
          aria-controls={diffId}
          aria-expanded={isOpen}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left outline-hidden focus-visible:ring-2 focus-visible:ring-gray-400/40 disabled:cursor-default"
          disabled={decision !== "pending" || writing}
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <ChevronRight
            aria-hidden="true"
            className={cn(
              "size-3.5 shrink-0 text-gray-400 transition-[rotate,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
              isOpen && "rotate-90",
              decision !== "pending" && "opacity-0"
            )}
          />
          <span
            className={cn(
              "min-w-0 truncate font-mono text-[13px] transition-colors duration-200",
              decision === "rejected" &&
                "text-gray-400 line-through decoration-gray-300 dark:text-gray-500 dark:decoration-gray-600"
            )}
          >
            <span className="text-gray-400 dark:text-gray-500">{dir}</span>
            <span
              className={cn(
                decision !== "rejected" && "text-gray-900 dark:text-gray-100"
              )}
            >
              {name}
            </span>
          </span>
          {file.created && decision !== "rejected" && (
            <span className="shrink-0 rounded bg-emerald-500/10 px-1 text-[10px] text-emerald-700 leading-4 dark:text-emerald-300">
              new
            </span>
          )}
        </button>

        <AnimatePresence initial={false} mode="popLayout">
          {decision === "pending" ? (
            <motion.div
              animate={{ opacity: 1 }}
              className="flex items-center gap-2"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key="counts"
              transition={{ duration: 0.15 }}
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
              {!writing && (
                <span className="flex items-center gap-0.5">
                  <button
                    aria-label={`Reject ${file.path}`}
                    className="flex size-7 items-center justify-center rounded-md text-gray-400 outline-hidden transition-colors duration-150 hover:bg-gray-100 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-gray-400/50 dark:hover:bg-white/10 dark:hover:text-red-400"
                    onClick={() => onDecide("rejected")}
                    type="button"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                  <button
                    aria-label={`Accept ${file.path}`}
                    className="flex size-7 items-center justify-center rounded-md text-gray-400 outline-hidden transition-colors duration-150 hover:bg-gray-100 hover:text-emerald-600 focus-visible:ring-2 focus-visible:ring-gray-400/50 dark:hover:bg-white/10 dark:hover:text-emerald-400"
                    onClick={() => onDecide("accepted")}
                    type="button"
                  >
                    <Check aria-hidden="true" className="size-3.5" />
                  </button>
                </span>
              )}
            </motion.div>
          ) : (
            <motion.div
              animate={{ opacity: 1, filter: "blur(0px)" }}
              className="flex items-center gap-1.5"
              exit={{ opacity: 0, filter: "blur(2px)" }}
              initial={{ opacity: 0, filter: "blur(2px)" }}
              key="decided"
              transition={{ duration: 0.18, ease: EASE_OUT }}
            >
              <span
                className={cn(
                  "text-xs",
                  decision === "accepted"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-gray-400 dark:text-gray-500"
                )}
              >
                {decision === "accepted" ? "Accepted" : "Reverted"}
              </span>
              <button
                aria-label={`Undo for ${file.path}`}
                className="flex size-7 items-center justify-center rounded-md text-gray-400 outline-hidden transition-colors duration-150 hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-gray-400/50 dark:hover:bg-white/10 dark:hover:text-gray-200"
                onClick={() => onDecide("pending")}
                type="button"
              >
                <Undo2 aria-hidden="true" className="size-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            id={diffId}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE_OUT }}
          >
            <div className="mx-2 mb-2 overflow-x-auto rounded-lg bg-gray-50 ring-1 ring-black/5 dark:bg-white/[0.03] dark:ring-white/10">
              {file.hunks.map((hunk) => (
                <Hunk hunk={hunk} key={hunk.start} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
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

  // A replayed demo starts with a clean slate.
  useEffect(() => {
    if (demo.run > 0) {
      setDecisions({});
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
  // While streaming, only the file being written is open.
  const writingPath = writing ? files.at(-1)?.path : undefined;

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
            <output className="font-medium text-gray-900 text-sm dark:text-gray-100">
              {title}
            </output>
            <span className="font-mono text-[11px] tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400">
                +{totals.added}
              </span>{" "}
              <span className="text-red-600 dark:text-red-400">
                −{totals.removed}
              </span>
            </span>
            <div className="ml-auto flex items-center gap-1">
              {!(writing || allDecided) && (
                <>
                  <button
                    className="h-7 rounded-md px-2 text-gray-600 text-xs outline-hidden transition-colors duration-150 hover:bg-black/5 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-400/50 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
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
                    className="h-7 rounded-md bg-gray-900 px-2.5 font-medium text-white text-xs outline-hidden transition-colors duration-150 hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-gray-400/60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                    onClick={() => {
                      for (const file of pending) {
                        decide(file.path, "accepted");
                      }
                    }}
                    type="button"
                  >
                    Accept all
                  </button>
                </>
              )}
              {allDecided && filesProp === undefined && (
                <button
                  className="h-7 rounded-md px-2 text-gray-500 text-xs outline-hidden transition-colors duration-150 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-400/50 dark:text-gray-400 dark:hover:text-white"
                  onClick={demo.replay}
                  type="button"
                >
                  Replay
                </button>
              )}
            </div>
          </div>
          <ul className="rounded-xl bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
            {files.map((file) => (
              <FileRow
                decision={decisionOf(file.path)}
                file={file}
                key={file.path}
                onDecide={(decision) => decide(file.path, decision)}
                writing={file.path === writingPath}
              />
            ))}
            {files.length === 0 && (
              <li className="px-3 py-3 text-gray-400 text-sm">
                Waiting for edits…
              </li>
            )}
          </ul>
        </div>
      </div>
    </MotionConfig>
  );
}
