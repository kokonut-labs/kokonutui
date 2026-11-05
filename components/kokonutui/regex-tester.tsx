"use client";

/**
 * @author: @kokonutui
 * @description: Regex Tester
 * @version: 1.0.0
 * @date: 2026-11-05
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  type ReactNode,
  type SyntheticEvent,
  useId,
  useMemo,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface RegexTesterProps {
  defaultPattern?: string;
  defaultFlags?: string;
  defaultText?: string;
  className?: string;
}

interface Group {
  index: number;
  name?: string;
  /** Where the group opens and closes in the pattern. */
  open: number;
  close: number;
  /** Characters of `?<name>` after the opening paren. */
  nameLength: number;
}

interface Match {
  start: number;
  end: number;
  text: string;
  groups: { start: number; end: number; text: string }[];
}

const FLAGS = [
  { flag: "g", label: "global" },
  { flag: "i", label: "ignore case" },
  { flag: "m", label: "multiline" },
  { flag: "s", label: "dot matches newline" },
];

// One color per capture group, cycling after six.
const COLORS = [
  {
    text: "text-sky-700 dark:text-sky-400",
    bg: "bg-sky-500/15",
    strong: "bg-sky-500/35",
  },
  {
    text: "text-violet-700 dark:text-violet-400",
    bg: "bg-violet-500/15",
    strong: "bg-violet-500/35",
  },
  {
    text: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-500/15",
    strong: "bg-orange-500/35",
  },
  {
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-500/15",
    strong: "bg-emerald-500/35",
  },
  {
    text: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-500/15",
    strong: "bg-rose-500/35",
  },
  {
    text: "text-teal-700 dark:text-teal-400",
    bg: "bg-teal-500/15",
    strong: "bg-teal-500/35",
  },
];
const colorOf = (group: number) => COLORS[(group - 1) % COLORS.length];

const MAX_MATCHES = 200;
const NAMED = /^\(\?<([A-Za-z_$][\w$]*)>/;
const INVALID_PREFIX = /^Invalid regular expression: \/[\s\S]*\/[a-z]*: /;
const FIELD =
  "whitespace-pre-wrap break-words px-3 py-2.5 font-mono text-[12.5px] leading-[1.6]";

const DEMO_PATTERN =
  "^(?<time>\\d{2}:\\d{2}:\\d{2}) (?<level>WARN|ERROR) +(?<message>.+)$";
const DEMO_TEXT = `14:02:11 INFO  checkout started cart=8f2c
14:02:12 WARN  slow query orders.find 812ms
14:02:12 INFO  payment intent created
14:02:13 ERROR card_declined for cus_Q1w9Lr
14:02:15 INFO  retry scheduled in 30s
14:02:46 ERROR card_declined for cus_Q1w9Lr`;

/** A group opening at `i`, or null when the paren doesn't capture. */
function openGroup(pattern: string, i: number, index: number): Group | null {
  const named = pattern.slice(i).match(NAMED);
  if (!named && pattern[i + 1] === "?") {
    return null;
  }
  return {
    index,
    name: named?.[1],
    open: i,
    close: -1,
    nameLength: named ? named[0].length - 1 : 0,
  };
}

/** Capture groups in a pattern, in the order their parens open. */
function findGroups(pattern: string): Group[] {
  const groups: Group[] = [];
  const stack: (Group | null)[] = [];
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "\\") {
      i++;
      continue;
    }
    if (inClass || ch === "[") {
      inClass = ch !== "]";
      continue;
    }
    if (ch === "(") {
      const group = openGroup(pattern, i, groups.length + 1);
      if (group) {
        groups.push(group);
      }
      stack.push(group);
    } else if (ch === ")") {
      const group = stack.pop();
      if (group) {
        group.close = i;
      }
    }
  }
  return groups;
}

function run(pattern: string, flags: string, text: string) {
  if (!pattern) {
    return { matches: [] as Match[], error: null };
  }
  let regex: RegExp;
  try {
    // `d` gives each group's indices, for painting them in the text.
    regex = new RegExp(pattern, `${flags}d`);
  } catch (error) {
    return {
      matches: [] as Match[],
      // "Invalid regular expression: /…/dgm: Unterminated group" → the reason.
      error: (error as Error).message.replace(INVALID_PREFIX, ""),
    };
  }
  const found = flags.includes("g")
    ? [...text.matchAll(regex)].slice(0, MAX_MATCHES)
    : [regex.exec(text)].filter((m) => m !== null);
  const matches = found.map((m) => {
    const indices = (m as RegExpExecArray & { indices?: [number, number][] })
      .indices;
    return {
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      text: m[0],
      groups: m.slice(1).map((value, i) => {
        const at = indices?.[i + 1];
        return { start: at?.[0] ?? -1, end: at?.[1] ?? -1, text: value ?? "" };
      }),
    };
  });
  return { matches, error: null };
}

/** Runs of text that share a match and innermost group. */
function paint(text: string, matches: Match[]) {
  const match = new Array<number>(text.length).fill(-1);
  const group = new Array<number>(text.length).fill(0);
  matches.forEach((m, mi) => {
    for (let i = m.start; i < m.end; i++) {
      match[i] = mi;
    }
    // Later groups nest inside earlier ones, so they paint last.
    m.groups.forEach((g, gi) => {
      for (let i = g.start; i >= 0 && i < g.end; i++) {
        group[i] = gi + 1;
      }
    });
  });
  const runs: { text: string; match: number; group: number }[] = [];
  for (let i = 0; i < text.length; i++) {
    const tail = runs.at(-1);
    if (tail && tail.match === match[i] && tail.group === group[i]) {
      tail.text += text[i];
    } else {
      runs.push({ text: text[i], match: match[i], group: group[i] });
    }
  }
  return runs;
}

/** A run's fill: its group's color, or a plain tint for the rest of a match. */
function runBackground(
  run: { match: number; group: number },
  active: number | null
) {
  if (run.match < 0) {
    return null;
  }
  if (run.group > 0 && active === run.group) {
    return colorOf(run.group).strong;
  }
  if (run.group > 0 && active === null) {
    return colorOf(run.group).bg;
  }
  return "bg-zinc-900/[0.06] dark:bg-white/[0.08]";
}

export default function RegexTester({
  defaultPattern = DEMO_PATTERN,
  defaultFlags = "gm",
  defaultText = DEMO_TEXT,
  className,
}: RegexTesterProps) {
  const id = useId();
  const [pattern, setPattern] = useState(defaultPattern);
  const [flags, setFlags] = useState(defaultFlags);
  const [text, setText] = useState(defaultText);
  /** The group lit by the caret in the pattern or a hovered chip. */
  const [caretGroup, setCaretGroup] = useState<number | null>(null);
  const [hoverGroup, setHoverGroup] = useState<number | null>(null);
  const [hoverMatch, setHoverMatch] = useState<number | null>(null);
  const activeGroup = hoverGroup ?? caretGroup;

  const groups = useMemo(() => findGroups(pattern), [pattern]);
  const { matches, error } = useMemo(
    () => run(pattern, flags, text),
    [pattern, flags, text]
  );
  const runs = useMemo(() => paint(text, matches), [text, matches]);

  const toggleFlag = (flag: string) =>
    setFlags((f) => (f.includes(flag) ? f.replace(flag, "") : f + flag));

  // The innermost group around the caret lights up its captures.
  const onCaret = (event: SyntheticEvent<HTMLTextAreaElement>) => {
    const at = event.currentTarget.selectionStart;
    const inside = groups.filter(
      (g) => g.open < at && (g.close < 0 || at <= g.close)
    );
    setCaretGroup(inside.at(-1)?.index ?? null);
  };

  const label = (index: number) => groups[index - 1]?.name ?? String(index);

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
      >
        <div className="p-3">
          <div
            className={cn(
              "flex items-start gap-1 rounded-lg border border-zinc-200 bg-zinc-50 transition-colors duration-150 focus-within:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-zinc-600",
              error &&
                "border-red-300 focus-within:border-red-400 dark:border-red-500/50 dark:focus-within:border-red-500/70"
            )}
          >
            <span
              aria-hidden="true"
              className="py-2.5 pl-3 font-mono text-[12.5px] text-zinc-400 leading-[1.6] dark:text-zinc-500"
            >
              /
            </span>
            <HighlightField
              ariaLabel="Pattern"
              invalid={!!error}
              onCaret={onCaret}
              onChange={setPattern}
              value={pattern}
            >
              <PatternPaint
                active={activeGroup}
                groups={groups}
                pattern={pattern}
              />
            </HighlightField>
            <span
              aria-hidden="true"
              className="py-2.5 pr-3 font-mono text-[12.5px] text-zinc-400 leading-[1.6] dark:text-zinc-500"
            >
              /{flags}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {FLAGS.map(({ flag, label: name }) => {
              const on = flags.includes(flag);
              return (
                <button
                  aria-label={name}
                  aria-pressed={on}
                  className={cn(
                    "flex h-6 items-center rounded-md border px-1.5 font-mono text-[11.5px] outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400/50",
                    on
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 text-zinc-500 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                  )}
                  key={flag}
                  onClick={() => toggleFlag(flag)}
                  title={name}
                  type="button"
                >
                  {flag}
                </button>
              );
            })}
            <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
            {groups.map((group) => (
              <button
                className={cn(
                  "flex h-6 items-center gap-1 rounded-md px-1.5 font-mono text-[11.5px] outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400/50",
                  colorOf(group.index).text,
                  activeGroup === group.index
                    ? colorOf(group.index).strong
                    : colorOf(group.index).bg
                )}
                key={group.open}
                onBlur={() => setHoverGroup(null)}
                onFocus={() => setHoverGroup(group.index)}
                onPointerEnter={() => setHoverGroup(group.index)}
                onPointerLeave={() => setHoverGroup(null)}
                type="button"
              >
                <span className="opacity-60">{group.index}</span>
                {group.name}
              </button>
            ))}
          </div>

          <p
            aria-live="polite"
            className={cn(
              "mt-2 min-h-[1.25rem] text-[12px]",
              error
                ? "text-red-600 dark:text-red-400"
                : "text-zinc-500 dark:text-zinc-400"
            )}
            id={`${id}-status`}
          >
            {error ??
              `${matches.length} ${matches.length === 1 ? "match" : "matches"}`}
          </p>
        </div>

        <div className="border-zinc-200 border-y dark:border-zinc-800">
          <HighlightField
            ariaLabel="Test text"
            describedBy={`${id}-status`}
            onChange={setText}
            value={text}
          >
            {runs.map((run, i) => (
              <span
                className={cn(
                  "rounded-[2px] transition-colors duration-150",
                  runBackground(run, activeGroup),
                  hoverMatch !== null &&
                    run.match >= 0 &&
                    run.match !== hoverMatch &&
                    "opacity-40"
                )}
                // Runs are rebuilt on every edit; their order is their identity.
                // biome-ignore lint/suspicious/noArrayIndexKey: see above
                key={i}
              >
                {run.text}
              </span>
            ))}
          </HighlightField>
        </div>

        <ol
          aria-label="Matches"
          className="max-h-44 overflow-y-auto py-1.5"
          onPointerLeave={() => setHoverMatch(null)}
        >
          <AnimatePresence initial={false}>
            {matches.map((match, mi) => (
              <motion.li
                animate={{ opacity: 1 }}
                className="flex min-h-7 items-center gap-3 px-3 py-0.5 font-mono text-[12px] transition-colors duration-100 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key={`${match.start}-${match.text}`}
                onPointerEnter={() => setHoverMatch(mi)}
                transition={{ duration: 0.15 }}
              >
                <span className="w-5 shrink-0 text-right text-zinc-400 tabular-nums dark:text-zinc-600">
                  {mi + 1}
                </span>
                {match.groups.length === 0 ? (
                  <span className="truncate text-zinc-800 dark:text-zinc-200">
                    {match.text || "(empty)"}
                  </span>
                ) : (
                  <span className="flex min-w-0 gap-3">
                    {match.groups.map((g, gi) => (
                      <span
                        className={cn(
                          "min-w-0 shrink-0 truncate transition-opacity duration-150 last:shrink",
                          activeGroup !== null &&
                            activeGroup !== gi + 1 &&
                            "opacity-35"
                        )}
                        // Groups have a fixed order within a match.
                        // biome-ignore lint/suspicious/noArrayIndexKey: see above
                        key={gi}
                      >
                        <span className="text-zinc-400 dark:text-zinc-500">
                          {label(gi + 1)}{" "}
                        </span>
                        <span className={colorOf(gi + 1).text}>
                          {g.start < 0 ? "–" : g.text}
                        </span>
                      </span>
                    ))}
                  </span>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
          {matches.length === 0 && (
            <li className="px-3 py-1.5 text-[12px] text-zinc-400 dark:text-zinc-500">
              {error
                ? "Fix the pattern to see matches."
                : "Nothing matches yet."}
            </li>
          )}
        </ol>
      </div>
    </MotionConfig>
  );
}

/**
 * A textarea over a painted copy of its own text. The copy sets the height
 * and shows the colors; the textarea on top keeps the caret and selection.
 */
function HighlightField({
  value,
  onChange,
  onCaret,
  ariaLabel,
  describedBy,
  invalid,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  onCaret?: (event: SyntheticEvent<HTMLTextAreaElement>) => void;
  ariaLabel: string;
  describedBy?: string;
  invalid?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <div
        aria-hidden="true"
        className={cn(FIELD, "text-zinc-800 dark:text-zinc-200")}
      >
        {children}
        {/* Keeps a trailing newline's line in the height. */}
        {"​"}
      </div>
      <textarea
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-label={ariaLabel}
        className={cn(
          FIELD,
          "absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent text-transparent caret-zinc-900 outline-hidden selection:bg-zinc-900/15 dark:caret-zinc-100 dark:selection:bg-white/20"
        )}
        onChange={(e) => {
          onChange(e.target.value);
          onCaret?.(e);
        }}
        onClick={onCaret}
        onKeyUp={onCaret}
        onSelect={onCaret}
        spellCheck={false}
        value={value}
      />
    </div>
  );
}

function PatternPaint({
  pattern,
  groups,
  active,
}: {
  pattern: string;
  groups: Group[];
  active: number | null;
}) {
  // Each capture group's parens and name take its color.
  const owner = new Array<number>(pattern.length).fill(0);
  for (const g of groups) {
    for (let i = g.open; i <= g.open + g.nameLength; i++) {
      owner[i] = g.index;
    }
    if (g.close >= 0) {
      owner[g.close] = g.index;
    }
  }
  const parts: { text: string; group: number; start: number }[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const tail = parts.at(-1);
    if (tail && tail.group === owner[i]) {
      tail.text += pattern[i];
    } else {
      parts.push({ text: pattern[i], group: owner[i], start: i });
    }
  }
  return parts.map((part) => (
    <span
      className={cn(
        part.group > 0 && colorOf(part.group).text,
        part.group > 0 &&
          active === part.group &&
          cn("rounded-[2px]", colorOf(part.group).bg)
      )}
      key={part.start}
    >
      {part.text}
    </span>
  ));
}
