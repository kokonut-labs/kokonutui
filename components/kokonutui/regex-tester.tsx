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
  useRef,
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

const DEMO_PATTERN = "^(?<time>\\S+) (?<level>WARN|ERROR) +(?<message>.+)$";
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
  // While the pattern doesn't compile, the diagram holds the last one that did.
  const lastValid = useRef({ pattern, groups });
  if (!error) {
    lastValid.current = { pattern, groups };
  }
  const diagram = lastValid.current;

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
          "w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
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

        <div
          className={cn(
            "overflow-x-auto border-zinc-200 border-t bg-zinc-50/70 transition-opacity duration-200 dark:border-zinc-800 dark:bg-zinc-900/40",
            error && "opacity-40"
          )}
        >
          <Railroad
            active={activeGroup}
            groups={diagram.groups}
            onGroup={setHoverGroup}
            pattern={diagram.pattern}
          />
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
          className="max-h-36 overflow-y-auto py-1.5"
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

// ── Railroad diagram ────────────────────────────────────────────────────

type TermKind = "literal" | "class" | "anchor";

type RNode =
  | { type: "seq"; items: RNode[] }
  | { type: "alt"; options: RNode[] }
  | { type: "group"; index?: number; label: string; child: RNode }
  | { type: "repeat"; child: RNode; min: number; max: number }
  | { type: "term"; kind: TermKind; text: string };

const ESCAPES: Record<string, [kind: TermKind, text: string]> = {
  d: ["class", "digit"],
  D: ["class", "not digit"],
  w: ["class", "word char"],
  W: ["class", "not word char"],
  s: ["class", "space"],
  S: ["class", "not space"],
  b: ["anchor", "word edge"],
  B: ["anchor", "not word edge"],
  n: ["class", "newline"],
  t: ["class", "tab"],
};
const SINGLE: Record<string, [kind: TermKind, text: string]> = {
  ".": ["class", "any char"],
  "^": ["anchor", "start"],
  $: ["anchor", "end"],
};
const LOOKAROUND: Record<string, string> = {
  "?=": "followed by",
  "?!": "not followed by",
  "?<=": "preceded by",
  "?<!": "not preceded by",
};
const DIGIT = /\d/;
const QUANTIFIER = /^\{(\d+)(,(\d*))?\}/;
const CLASS_BODY = /^\[((?:\\.|[^\]\\])*)\]/;
const INFINITE = Number.POSITIVE_INFINITY;

const term = (kind: TermKind, text: string): RNode => ({
  type: "term",
  kind,
  text,
});

function escapeTerm(next: string): RNode {
  const known = ESCAPES[next];
  if (known) {
    return term(known[0], known[1]);
  }
  return DIGIT.test(next)
    ? term("class", `same as #${next}`)
    : term("literal", next);
}

function classTerm(raw: string): RNode {
  const negated = raw.startsWith("^");
  const set = negated ? raw.slice(1) : raw;
  const text = set.length > 16 ? `${set.slice(0, 15)}…` : set;
  return term("class", negated ? `not ${text}` : `one of ${text}`);
}

/** `*`, `+`, `?` or `{n,m}` at the start of `rest`, with its length. */
function readQuantifier(
  rest: string
): { min: number; max: number; length: number } | null {
  const ch = rest[0];
  if (ch === "*" || ch === "+" || ch === "?") {
    return {
      min: ch === "+" ? 1 : 0,
      max: ch === "?" ? 1 : INFINITE,
      length: 1,
    };
  }
  const counted = rest.match(QUANTIFIER);
  if (!counted) {
    return null;
  }
  const min = Number(counted[1]);
  let max = min;
  if (counted[2] !== undefined) {
    max = counted[3] ? Number(counted[3]) : INFINITE;
  }
  return { min, max, length: counted[0].length };
}

const isLiteral = (node: RNode | undefined) =>
  node?.type === "term" && node.kind === "literal";

/** Reads a pattern into the tree the diagram draws. Assumes it compiles. */
function parsePattern(pattern: string, groups: Group[]): RNode {
  let i = 0;
  let captured = 0;

  const group = (): RNode => {
    const named = pattern.slice(i).match(NAMED);
    i++;
    const look = Object.keys(LOOKAROUND).find((k) => pattern.startsWith(k, i));
    let node: RNode;
    if (pattern.startsWith("?:", i)) {
      i += 2;
      node = alternation();
    } else if (look) {
      i += look.length;
      node = { type: "group", label: LOOKAROUND[look], child: alternation() };
    } else {
      captured++;
      const index = captured;
      i += named ? named[0].length - 1 : 0;
      const name = groups[index - 1]?.name;
      node = {
        type: "group",
        index,
        label: name ? `${index} ${name}` : `${index}`,
        child: alternation(),
      };
    }
    if (pattern[i] === ")") {
      i++;
    }
    return node;
  };

  const atom = (): RNode => {
    const ch = pattern[i];
    if (ch === "(") {
      return group();
    }
    if (ch === "[") {
      const body = pattern.slice(i).match(CLASS_BODY);
      i += body ? body[0].length : 1;
      return classTerm(body ? body[1] : "");
    }
    if (ch === "\\") {
      i += 2;
      return escapeTerm(pattern[i - 1] ?? "");
    }
    i++;
    const single = SINGLE[ch];
    return single ? term(single[0], single[1]) : term("literal", ch);
  };

  const quantify = (node: RNode): RNode => {
    const q = readQuantifier(pattern.slice(i));
    if (!q) {
      return node;
    }
    i += q.length;
    // A lazy marker changes how much it takes, not what it can match.
    if (pattern[i] === "?") {
      i++;
    }
    return { type: "repeat", child: node, min: q.min, max: q.max };
  };

  const sequence = (): RNode => {
    const items: RNode[] = [];
    while (i < pattern.length && pattern[i] !== "|" && pattern[i] !== ")") {
      const node = quantify(atom());
      const prev = items.at(-1);
      // Plain characters in a row read as one word.
      if (isLiteral(node) && isLiteral(prev)) {
        (prev as { text: string }).text += (node as { text: string }).text;
      } else {
        items.push(node);
      }
    }
    return items.length === 1 ? items[0] : { type: "seq", items };
  };

  const alternation = (): RNode => {
    const options = [sequence()];
    while (pattern[i] === "|") {
      i++;
      options.push(sequence());
    }
    return options.length === 1 ? options[0] : { type: "alt", options };
  };

  return alternation();
}

const BOX = 22;
const GAP = 12;
const ARC = 7;
const CHAR = 6.6;
const GROUP_TOP = 20;
const GROUP_PAD = 9;
const RAIL = "stroke-zinc-300 dark:stroke-zinc-600";

interface Box {
  w: number;
  /** Height above and below the rail. */
  up: number;
  down: number;
}

const shownLiteral = (text: string) => `"${text.replaceAll(" ", "␣")}"`;

function repeatLabel(node: { min: number; max: number }) {
  if (node.max === INFINITE) {
    return node.min > 1 ? `${node.min}+ times` : "";
  }
  if (node.max === 1) {
    return "";
  }
  return node.min === node.max
    ? `${node.max} times`
    : `${node.min}–${node.max} times`;
}

function measure(node: RNode): Box {
  if (node.type === "term") {
    const text = node.kind === "literal" ? shownLiteral(node.text) : node.text;
    return {
      w: Math.max(BOX, text.length * CHAR + 18),
      up: BOX / 2,
      down: BOX / 2,
    };
  }
  if (node.type === "seq") {
    const boxes = node.items.map(measure);
    const w = boxes.reduce((sum, b) => sum + b.w + GAP, -GAP);
    return {
      w: Math.max(w, GAP),
      up: Math.max(0, ...boxes.map((b) => b.up)),
      down: Math.max(0, ...boxes.map((b) => b.down)),
    };
  }
  if (node.type === "alt") {
    const boxes = node.options.map(measure);
    const below = boxes.slice(1).reduce((s, b) => s + GAP + b.up + b.down, 0);
    return {
      w: Math.max(...boxes.map((b) => b.w)) + ARC * 4,
      up: boxes[0].up,
      down: boxes[0].down + below,
    };
  }
  const b = measure(node.child);
  if (node.type === "group") {
    return {
      w: b.w + GROUP_PAD * 2,
      up: b.up + GROUP_TOP,
      down: b.down + GROUP_PAD,
    };
  }
  const loop = node.max > 1 ? ARC * 2 + (repeatLabel(node) ? 12 : 0) : 0;
  return {
    w: b.w + ARC * 4,
    up: node.min === 0 ? b.up + ARC * 2 : b.up,
    down: b.down + loop,
  };
}

interface DrawContext {
  active: number | null;
  onGroup: (index: number | null) => void;
}

type Drawn<T extends RNode["type"]> = Extract<RNode, { type: T }>;

function drawTerm(node: Drawn<"term">, x: number, y: number) {
  const { w } = measure(node);
  const literal = node.kind === "literal";
  return (
    <g key={`t${x}-${y}`}>
      <rect
        className={cn(
          "stroke-zinc-300 dark:stroke-zinc-600",
          literal && "fill-white dark:fill-zinc-900",
          node.kind === "class" && "fill-zinc-100 dark:fill-zinc-800",
          node.kind === "anchor" && "fill-transparent"
        )}
        height={BOX}
        rx={literal ? BOX / 2 : 4}
        strokeDasharray={node.kind === "anchor" ? "3 2" : undefined}
        width={w}
        x={x}
        y={y - BOX / 2}
      />
      <text
        className={
          literal
            ? "fill-zinc-800 dark:fill-zinc-200"
            : "fill-zinc-500 dark:fill-zinc-400"
        }
        dominantBaseline="central"
        textAnchor="middle"
        x={x + w / 2}
        y={y}
      >
        {literal ? shownLiteral(node.text) : node.text}
      </text>
    </g>
  );
}

function drawSeq(node: Drawn<"seq">, x: number, y: number, ctx: DrawContext) {
  let cx = x;
  const parts: ReactNode[] = [];
  for (const item of node.items) {
    if (cx > x) {
      parts.push(
        <path className={RAIL} d={`M${cx - GAP} ${y}H${cx}`} key={`l${cx}`} />
      );
    }
    parts.push(draw(item, cx, y, ctx));
    cx += measure(item).w + GAP;
  }
  if (node.items.length === 0) {
    parts.push(<path className={RAIL} d={`M${x} ${y}h${GAP}`} key={`e${x}`} />);
  }
  return <g key={`s${x}-${y}`}>{parts}</g>;
}

function drawAlt(node: Drawn<"alt">, x: number, y: number, ctx: DrawContext) {
  const right = x + measure(node).w;
  const left = x + ARC * 2;
  const parts: ReactNode[] = [];
  let oy = y;
  node.options.forEach((option, n) => {
    const b = measure(option);
    oy += n > 0 ? b.up : 0;
    const end = left + b.w;
    const d =
      n === 0
        ? `M${x} ${y}H${left}M${end} ${y}H${right}`
        : `M${x} ${y}Q${x + ARC} ${y} ${x + ARC} ${y + ARC}V${oy - ARC}Q${x + ARC} ${oy} ${left} ${oy}M${end} ${oy}H${right - ARC * 2}Q${right - ARC} ${oy} ${right - ARC} ${oy - ARC}V${y + ARC}Q${right - ARC} ${y} ${right} ${y}`;
    parts.push(<path className={RAIL} d={d} fill="none" key={`r${oy}`} />);
    parts.push(draw(option, left, oy, ctx));
    oy += b.down + GAP;
  });
  return <g key={`a${x}-${y}`}>{parts}</g>;
}

function drawGroup(
  node: Drawn<"group">,
  x: number,
  y: number,
  ctx: DrawContext
) {
  const box = measure(node);
  const inner = measure(node.child);
  const index = node.index ?? null;
  const lit = index !== null && ctx.active === index;
  const dim = index !== null && ctx.active !== null && !lit;
  return (
    <g
      className={cn(
        "transition-opacity duration-150",
        index !== null && colorOf(index).text,
        dim && "opacity-40"
      )}
      key={`g${x}-${y}`}
      onPointerEnter={index === null ? undefined : () => ctx.onGroup(index)}
      onPointerLeave={index === null ? undefined : () => ctx.onGroup(null)}
    >
      <rect
        className={cn(
          "transition-[fill-opacity] duration-150",
          index === null
            ? "fill-none stroke-zinc-300 dark:stroke-zinc-600"
            : "fill-current stroke-current"
        )}
        fillOpacity={lit ? 0.12 : 0.03}
        height={box.up + box.down - 2}
        rx={7}
        strokeDasharray={index === null ? "4 3" : undefined}
        strokeOpacity={index === null ? 1 : 0.7}
        width={box.w}
        x={x}
        y={y - box.up + 2}
      />
      <text
        className={
          index === null ? "fill-zinc-400 dark:fill-zinc-500" : "fill-current"
        }
        fontSize={10.5}
        x={x + 8}
        y={y - box.up + 14}
      >
        {node.label}
      </text>
      <path
        className={RAIL}
        d={`M${x} ${y}H${x + GROUP_PAD}M${x + GROUP_PAD + inner.w} ${y}H${x + box.w}`}
      />
      {draw(node.child, x + GROUP_PAD, y, ctx)}
    </g>
  );
}

function drawRepeat(
  node: Drawn<"repeat">,
  x: number,
  y: number,
  ctx: DrawContext
) {
  const inner = measure(node.child);
  const left = x + ARC * 2;
  const right = x + measure(node).w;
  const end = left + inner.w;
  const top = y - inner.up - ARC;
  const bottom = y + inner.down + ARC;
  const label = repeatLabel(node);
  return (
    <g key={`q${x}-${y}`}>
      <path
        className={RAIL}
        d={`M${x} ${y}H${left}M${end} ${y}H${right}`}
        fill="none"
      />
      {node.min === 0 && (
        <path
          className={RAIL}
          d={`M${x} ${y}Q${x + ARC} ${y} ${x + ARC} ${y - ARC}V${top + ARC}Q${x + ARC} ${top} ${left} ${top}H${end}Q${right - ARC} ${top} ${right - ARC} ${top + ARC}V${y - ARC}Q${right - ARC} ${y} ${right} ${y}`}
          fill="none"
        />
      )}
      {node.max > 1 && (
        <path
          className={RAIL}
          d={`M${end} ${y}Q${right - ARC} ${y} ${right - ARC} ${y + ARC}V${bottom - ARC}Q${right - ARC} ${bottom} ${end} ${bottom}H${left}Q${x + ARC} ${bottom} ${x + ARC} ${bottom - ARC}V${y + ARC}Q${x + ARC} ${y} ${left} ${y}`}
          fill="none"
        />
      )}
      {label && (
        <text
          className="fill-zinc-400 dark:fill-zinc-500"
          fontSize={10}
          textAnchor="middle"
          x={x + measure(node).w / 2}
          y={bottom + 11}
        >
          {label}
        </text>
      )}
      {draw(node.child, left, y, ctx)}
    </g>
  );
}

/** Draws `node` with its rail entering at (x, y). */
function draw(node: RNode, x: number, y: number, ctx: DrawContext): ReactNode {
  switch (node.type) {
    case "term":
      return drawTerm(node, x, y);
    case "seq":
      return drawSeq(node, x, y, ctx);
    case "alt":
      return drawAlt(node, x, y, ctx);
    case "group":
      return drawGroup(node, x, y, ctx);
    default:
      return drawRepeat(node, x, y, ctx);
  }
}

// The diagram shrinks to fit down to this scale, then scrolls.
const MIN_SCALE = 0.8;

function Railroad({
  pattern,
  groups,
  active,
  onGroup,
}: {
  pattern: string;
  groups: Group[];
  active: number | null;
  onGroup: (index: number | null) => void;
}) {
  const tree = useMemo(() => parsePattern(pattern, groups), [pattern, groups]);
  const box = measure(tree);
  const pad = 14;
  const width = box.w + pad * 2 + 24;
  const height = box.up + box.down + pad * 2;
  const y = pad + box.up;
  const start = pad + 12;
  return (
    <svg
      aria-label="Railroad diagram of the pattern"
      className="mx-auto block font-mono text-[11px]"
      role="img"
      strokeWidth={1.25}
      style={{ width: "100%", maxWidth: width, minWidth: width * MIN_SCALE }}
      viewBox={`0 0 ${width} ${height}`}
    >
      <circle
        className="fill-zinc-400 dark:fill-zinc-500"
        cx={pad + 3}
        cy={y}
        r={3}
      />
      <path className={RAIL} d={`M${pad + 3} ${y}H${start}`} />
      {draw(tree, start, y, { active, onGroup })}
      <path className={RAIL} d={`M${start + box.w} ${y}H${width - pad - 3}`} />
      <circle
        className="fill-zinc-400 dark:fill-zinc-500"
        cx={width - pad - 3}
        cy={y}
        r={3}
      />
    </svg>
  );
}
