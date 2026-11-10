"use client";

/**
 * @author: @kokonutui
 * @description: AI Inline Edit
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  PenLine,
  RotateCw,
  Square,
} from "lucide-react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface AIInlineEditProps {
  title?: string;
  paragraphs?: string[];
  /**
   * Rewrites the selected text. `attempt` counts up with each Try again, so
   * you can ask the model for a different take.
   */
  rewrite?: (text: string, instruction: string, attempt: number) => string;
  className?: string;
}

interface Span {
  p: number;
  start: number;
  end: number;
}

interface Op {
  kind: "same" | "del" | "add";
  word: string;
  /** Whitespace after the word, kept outside the styled span. */
  gap: string;
  key: string;
}

type Phase =
  | "idle"
  | "prompt"
  | "streaming"
  | "review"
  | "settling"
  | "discarding";
type Action = "shorter" | "clearer" | "friendlier" | "grammar";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const BAR_WIDTH = 384;
const PAD = 16;
const WORD = /\S+\s*/g;
const TRAILING = /\s+$/;
const SPACE = /\s/;
const APPLE = /Mac|iPhone|iPad/;
const SENTENCE = /[^.!?]+[.!?]+\s*/g;
const SHORT_HINT = /short|concise|trim|tight|brief/;
const FRIENDLY_HINT = /friend|warm|casual|kind|human/;
const GRAMMAR_HINT = /grammar|typo|fix|spell|proof/;

const ACTIONS: { id: Action; label: string }[] = [
  { id: "shorter", label: "Shorter" },
  { id: "clearer", label: "Clearer" },
  { id: "friendlier", label: "Friendlier" },
  { id: "grammar", label: "Fix grammar" },
];

const DEMO_PARAGRAPHS = [
  "We are really excited to share that the new billing dashboard is finally ready to ship next week. In order to make the rollout as smooth as possible, we will be enabling it for a small number of workspaces first.",
  "Due to the fact that invoices are now generated in real time, some customers might notice that their totals look different then before. Support should reach out to anyone who's account has more then three seats.",
  "If you have any questions at all, please don't hesitate to reach out to the team in #billing.",
];

/** Opens on the sentence that needs the most help. */
const DEMO_SELECTION: Span = {
  p: 1,
  start: 0,
  end: DEMO_PARAGRAPHS[1].indexOf("before.") + "before.".length,
};

/** Hand-written takes for the demo sentences, two per action. */
const CANNED: Record<string, Partial<Record<Action, string[]>>> = {
  "We are really excited to share that the new billing dashboard is finally ready to ship next week.":
    {
      shorter: [
        "The new billing dashboard ships next week.",
        "The billing dashboard is ready and ships next week.",
      ],
      clearer: [
        "The new billing dashboard is ready and ships next week.",
        "Next week we ship the new billing dashboard.",
      ],
      friendlier: [
        "Good news: the new billing dashboard is ready and ships next week!",
        "We're thrilled to say the new billing dashboard ships next week.",
      ],
    },
  "In order to make the rollout as smooth as possible, we will be enabling it for a small number of workspaces first.":
    {
      shorter: [
        "To keep the rollout smooth, we'll enable it for a few workspaces first.",
        "We'll start with a few workspaces to keep the rollout smooth.",
      ],
      clearer: [
        "We'll turn it on for a few workspaces first so the rollout goes smoothly.",
        "To keep the rollout smooth, a few workspaces get it first.",
      ],
      friendlier: [
        "To keep things smooth, we'll switch it on for a handful of workspaces first.",
        "We're starting with a handful of workspaces so everything goes smoothly.",
      ],
    },
  "Due to the fact that invoices are now generated in real time, some customers might notice that their totals look different then before.":
    {
      shorter: [
        "Invoices now update in real time, so some totals may look different than before.",
        "Since invoices now update live, some totals may differ from before.",
      ],
      clearer: [
        "Invoices are now generated in real time, so some customers will see totals that differ from before.",
        "Because invoices now update in real time, some customers' totals will change from what they saw before.",
      ],
      friendlier: [
        "Heads up: invoices now update in real time, so a few customers might spot totals that look a little different than before.",
        "Invoices now update live, so don't worry if a few totals look a little different than before.",
      ],
      grammar: [
        "Due to the fact that invoices are now generated in real time, some customers might notice that their totals look different than before.",
      ],
    },
  "Support should reach out to anyone who's account has more then three seats.":
    {
      shorter: [
        "Support should contact accounts with more than three seats.",
        "Support will contact accounts over three seats.",
      ],
      clearer: [
        "Support should contact every account with more than three seats.",
        "Any account with more than three seats will hear from Support.",
      ],
      friendlier: [
        "Support will check in with anyone whose account has more than three seats.",
        "Our Support team will say hi to every account with more than three seats.",
      ],
      grammar: [
        "Support should reach out to anyone whose account has more than three seats.",
      ],
    },
  "If you have any questions at all, please don't hesitate to reach out to the team in #billing.":
    {
      shorter: [
        "Questions? Ask the team in #billing.",
        "Send questions to #billing.",
      ],
      clearer: [
        "Send any questions to the team in #billing.",
        "The team in #billing can answer any questions.",
      ],
      friendlier: [
        "Got questions? Just ping the team in #billing, we're happy to help.",
        "Questions are always welcome in #billing!",
      ],
    },
};

/** Plain-language fixes for any text the demo has no hand-written take for. */
const RULES: Record<Action, [RegExp, string][]> = {
  grammar: [
    [/\bthen before\b/g, "than before"],
    [/\bmore then\b/g, "more than"],
    [/\bwho's account\b/g, "whose account"],
    [/ {2,}/g, " "],
  ],
  shorter: [
    [/^We are really excited to share that /, ""],
    [/\bIn order to\b/g, "To"],
    [/\bin order to\b/g, "to"],
    [/\bDue to the fact that\b/g, "Because"],
    [/\bas smooth as possible\b/g, "smooth"],
    [/\ba small number of\b/g, "a few"],
    [/\bwe will be enabling\b/g, "we'll enable"],
    [/\bmight notice that\b/g, "may see that"],
    [/ (really|finally|at all|just)\b/g, ""],
    [/\bplease don't hesitate to reach out to\b/g, "ask"],
  ],
  clearer: [
    [/\bDue to the fact that\b/g, "Because"],
    [/\bIn order to\b/g, "To"],
    [/\bin order to\b/g, "to"],
    [/\ba small number of\b/g, "a few"],
    [/\bthen before\b/g, "than before"],
    [/\bmore then\b/g, "more than"],
    [/\bwho's account\b/g, "whose account"],
  ],
  friendlier: [
    [/\bwe will be\b/g, "we'll be"],
    [/\bWe are\b/g, "We're"],
    [/\bShould\b/g, "Could"],
    [/\bshould reach out to\b/g, "will check in with"],
    [/\bplease don't hesitate to reach out to\b/g, "just ping"],
    [/\bsome customers\b/g, "a few folks"],
  ],
};

/** A second pass for Try again when nothing hand-written is left. */
const AGAIN: [RegExp, string][] = [
  [/\bwe will\b/g, "we'll"],
  [/\bit is\b/g, "it's"],
  [/\bdo not\b/g, "don't"],
  [/\bmight\b/g, "may"],
  [/\bshould\b/g, "will"],
];

const actionFor = (instruction: string): Action => {
  const s = instruction.toLowerCase();
  if (SHORT_HINT.test(s)) {
    return "shorter";
  }
  if (FRIENDLY_HINT.test(s)) {
    return "friendlier";
  }
  if (GRAMMAR_HINT.test(s)) {
    return "grammar";
  }
  return "clearer";
};

const applyRules = (text: string, rules: [RegExp, string][]) => {
  let out = text;
  for (const [pattern, to] of rules) {
    out = out.replace(pattern, to);
  }
  return out;
};

const capitalize = (text: string, like: string) =>
  like[0] && like[0] === like[0].toUpperCase()
    ? text.charAt(0).toUpperCase() + text.slice(1)
    : text;

const demoRewrite = (text: string, instruction: string, attempt: number) => {
  const action = actionFor(instruction);
  const sentences = (text.match(SENTENCE) ?? []).map((s) => s.trim());
  if (sentences.length > 0 && sentences.join(" ") === text.trim()) {
    const takes = sentences.map((s) => {
      const canned = CANNED[s]?.[action];
      return canned ? canned[attempt % canned.length] : undefined;
    });
    if (takes.every(Boolean)) {
      return takes.join(" ");
    }
  }
  let out = applyRules(text, RULES[action]);
  if (attempt > 0) {
    out = applyRules(out, AGAIN);
  }
  return capitalize(out.trim(), text);
};

const split = (text: string) =>
  (text.match(WORD) ?? []).map((w) => {
    const gap = w.match(TRAILING)?.[0] ?? "";
    return { word: w.slice(0, w.length - gap.length), gap };
  });

/** Word-level diff, deletions before insertions in each changed run. */
const diff = (from: string, to: string): Op[] => {
  const a = split(from);
  const b = split(to);
  const lcs = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0)
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i].word === b[j].word
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ops: Op[] = [];
  let dels: Op[] = [];
  let adds: Op[] = [];
  const flush = () => {
    ops.push(...dels, ...adds);
    dels = [];
    adds = [];
  };
  const make = (kind: Op["kind"], w: { word: string; gap: string }) => ({
    kind,
    word: w.word,
    gap: w.gap || " ",
    key: `${kind}${ops.length + dels.length + adds.length}:${w.word}`,
  });
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i].word === b[j].word) {
      flush();
      ops.push(make("same", b[j]));
      i++;
      j++;
    } else if (
      j >= b.length ||
      (i < a.length && lcs[i + 1][j] >= lcs[i][j + 1])
    ) {
      dels.push(make("del", a[i]));
      i++;
    } else {
      adds.push(make("add", b[j]));
      j++;
    }
  }
  flush();
  // The selection ends on a word, so the last op should not add a space.
  const last = ops.at(-1);
  if (last) {
    last.gap = "";
  }
  return ops;
};

interface Indexed {
  op: Op;
  index: number;
}

/** Groups neighbouring removed or added words; kept words stand alone. */
const runs = (ops: Op[]) => {
  const out: Indexed[][] = [];
  for (const [index, op] of ops.entries()) {
    const last = out.at(-1);
    if (last && op.kind !== "same" && last[0].op.kind === op.kind) {
      last.push({ op, index });
    } else {
      out.push([{ op, index }]);
    }
  }
  return out;
};

const join = (run: Indexed[]) =>
  run.map((r, k) => r.op.word + (k < run.length - 1 ? r.op.gap : "")).join("");

/** Character offset of a DOM position inside a paragraph. */
const offsetIn = (para: HTMLElement, node: Node, at: number) => {
  const pre = document.createRange();
  pre.selectNodeContents(para);
  pre.setEnd(node, at);
  return pre.toString().length;
};

/** Grows a range to whole words and trims the spaces at its ends. */
const snap = (text: string, start: number, end: number) => {
  let from = start;
  let to = end;
  while (from > 0 && !SPACE.test(text[from - 1])) {
    from--;
  }
  while (to < text.length && !SPACE.test(text[to])) {
    to++;
  }
  while (from < to && SPACE.test(text[from])) {
    from++;
  }
  while (to > from && SPACE.test(text[to - 1])) {
    to--;
  }
  return { from, to };
};

/** The page selection as a word-snapped span of one paragraph, if any. */
const readSelection = (
  selection: Selection | null,
  root: HTMLElement,
  doc: string[]
): Span | null => {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  const start = range.startContainer;
  const el = start.nodeType === 1 ? (start as Element) : start.parentElement;
  const para = el?.closest<HTMLElement>("[data-para]");
  if (!(para && root.contains(para))) {
    return null;
  }
  const p = Number(para.dataset.para);
  const text = doc[p];
  const end = para.contains(range.endContainer)
    ? offsetIn(para, range.endContainer, range.endOffset)
    : text.length;
  const { from, to } = snap(
    text,
    offsetIn(para, start, range.startOffset),
    end
  );
  return to - from < 2 ? null : { p, start: from, end: to };
};

/** ⌘ on Apple devices, Ctrl elsewhere. Starts as ⌘ so the server render matches. */
const useModKey = () => {
  const [mod, setMod] = useState("⌘");
  useEffect(() => {
    if (!APPLE.test(navigator.userAgent)) {
      setMod("Ctrl ");
    }
  }, []);
  return mod;
};

const stepDelay = (op: Op) => {
  if (op.kind === "add") {
    return 34 + Math.min(42, op.word.length * 6);
  }
  return op.kind === "del" ? 26 : 16;
};

export default function AIInlineEdit({
  title = "Billing launch update",
  paragraphs = DEMO_PARAGRAPHS,
  rewrite = demoRewrite,
  className,
}: AIInlineEditProps) {
  const reduceMotion = useReducedMotion();
  const [doc, setDoc] = useState(paragraphs);
  const [span, setSpan] = useState<Span | null>(
    paragraphs === DEMO_PARAGRAPHS ? DEMO_SELECTION : null
  );
  const [phase, setPhase] = useState<Phase>(
    paragraphs === DEMO_PARAGRAPHS ? "prompt" : "idle"
  );
  const [instruction, setInstruction] = useState("");
  const [label, setLabel] = useState("");
  const [versions, setVersions] = useState<string[]>([]);
  const [version, setVersion] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [head, setHead] = useState(0);
  const [flash, setFlash] = useState<Span | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  /** Null until measured, so the bar never renders (or animates in) at 0,0. */
  const [bar, setBar] = useState<{
    x: number;
    y: number;
    width: number;
  } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);
  const discardRef = useRef<HTMLButtonElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const barRef = useRef<HTMLDivElement>(null);
  const pointerDown = useRef(false);

  const selected = span ? doc[span.p].slice(span.start, span.end) : "";
  const current = versions[version] ?? "";
  const ops = useMemo(
    () => (current ? diff(selected, current) : []),
    [selected, current]
  );
  const editing = phase !== "idle" && phase !== "prompt";
  const mod = useModKey();
  const unchanged = phase === "review" && current === selected;

  // Place the bar under the selection, clamped to the card.
  const place = useCallback(() => {
    const region = regionRef.current;
    const box = docRef.current;
    if (!(region && box)) {
      return;
    }
    const rects = Array.from(region.getClientRects());
    const lastRect = rects.at(-1);
    if (!lastRect) {
      return;
    }
    const b = box.getBoundingClientRect();
    const width = Math.min(BAR_WIDTH, b.width - PAD * 2);
    const left = Math.min(...rects.map((r) => r.left)) - b.left;
    setBar({
      x: Math.max(PAD, Math.min(left - 6, b.width - width - PAD)),
      y: lastRect.bottom - b.top + 10,
      width,
    });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: head, version and doc move the selection
  useLayoutEffect(() => {
    if (span) {
      place();
    }
  }, [span, place, head, version, doc]);

  useEffect(() => {
    const box = docRef.current;
    if (!box) {
      return;
    }
    const observer = new ResizeObserver(() => place());
    observer.observe(box);
    return () => observer.disconnect();
  }, [place]);

  // Run the write head through the diff.
  useEffect(() => {
    if (phase !== "streaming") {
      return;
    }
    if (reduceMotion || head >= ops.length) {
      setHead(ops.length);
      setPhase("review");
      return;
    }
    const id = setTimeout(() => setHead((h) => h + 1), stepDelay(ops[head]));
    return () => clearTimeout(id);
  }, [phase, head, ops, reduceMotion]);

  // Keep focus inside the bar as its controls swap, so Escape keeps working.
  useEffect(() => {
    let target: HTMLButtonElement | null = null;
    if (phase === "streaming") {
      target = skipRef.current;
    } else if (phase === "review") {
      const accept = acceptRef.current;
      target = accept && !accept.disabled ? accept : discardRef.current;
    }
    target?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // The accepted words glow for a moment, then settle into the text.
  useEffect(() => {
    if (!flash) {
      return;
    }
    const on = setTimeout(() => setFlashOn(false), 80);
    const off = setTimeout(() => setFlash(null), 1300);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [flash]);

  const clear = useCallback(() => {
    setSpan(null);
    setBar(null);
    setPhase("idle");
    setVersions([]);
    setVersion(0);
    setAttempt(0);
    setInstruction("");
  }, []);

  // Clicking away drops a selection that has not been sent yet.
  useEffect(() => {
    if (phase !== "prompt") {
      return;
    }
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        clear();
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [phase, clear]);

  const capture = useCallback(() => {
    const selection = window.getSelection();
    const next =
      docRef.current && readSelection(selection, docRef.current, doc);
    if (!next) {
      return false;
    }
    selection?.removeAllRanges();
    setSpan(next);
    setPhase("prompt");
    setInstruction("");
    requestAnimationFrame(() =>
      inputRef.current?.focus({ preventScroll: true })
    );
    return true;
  }, [doc]);

  // Touch selections settle without a pointerup, so watch them too.
  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => {
      clearTimeout(id);
      if (pointerDown.current || editing) {
        return;
      }
      id = setTimeout(capture, 450);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      clearTimeout(id);
      document.removeEventListener("selectionchange", onChange);
    };
  }, [capture, editing]);

  const run = (text: string, nextAttempt: number) => {
    const next = rewrite(selected, text, nextAttempt);
    const seen = versions.indexOf(next);
    setLabel(text);
    setAttempt(nextAttempt);
    if (seen >= 0) {
      setVersion(seen);
      setPhase("review");
      return;
    }
    setVersions((v) => [...v, next]);
    setVersion(versions.length);
    setHead(0);
    setPhase("streaming");
  };

  const accept = () => {
    if (!span || phase !== "review") {
      return;
    }
    setPhase("settling");
    timerRef.current = setTimeout(
      () => {
        const text = doc[span.p];
        const next = [...doc];
        next[span.p] =
          text.slice(0, span.start) + current + text.slice(span.end);
        setDoc(next);
        setFlash({
          p: span.p,
          start: span.start,
          end: span.start + current.length,
        });
        setFlashOn(true);
        clear();
      },
      reduceMotion ? 0 : 180
    );
  };

  /** Added words fade and struck ones come back before the text resets. */
  const discard = () => {
    if (phase !== "review") {
      return;
    }
    setPhase("discarding");
    timerRef.current = setTimeout(clear, reduceMotion ? 0 : 160);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (phase === "streaming") {
        setVersions((v) => v.slice(0, -1));
        setVersion((v) => Math.max(0, v - 1));
        setPhase(versions.length > 1 ? "review" : "prompt");
      } else if (phase === "review") {
        discard();
      } else if (phase === "prompt") {
        clear();
      }
    } else if (
      event.key === "Enter" &&
      (event.metaKey || event.ctrlKey) &&
      phase === "review"
    ) {
      event.preventDefault();
      accept();
    }
  };

  // Escape and Mod+Enter work anywhere inside the card.
  const keyRef = useRef(onKeyDown);
  useEffect(() => {
    keyRef.current = onKeyDown;
  });
  useEffect(() => {
    const root = rootRef.current;
    const onKey = (event: KeyboardEvent) => keyRef.current(event);
    root?.addEventListener("keydown", onKey);
    return () => root?.removeEventListener("keydown", onKey);
  }, []);

  const renderRegion = () => {
    if (!editing) {
      return (
        <mark className="rounded-[3px] bg-sky-500/[0.16] text-inherit [box-decoration-break:clone] dark:bg-sky-400/20">
          {selected}
        </mark>
      );
    }
    return runs(ops).map((run) => (
      <DiffRun head={head} key={run[0].op.key} phase={phase} run={run} />
    ));
  };
  const renderParagraph = (text: string, p: number) => {
    if (span?.p === p) {
      return (
        <>
          {text.slice(0, span.start)}
          <span ref={regionRef}>{renderRegion()}</span>
          {text.slice(span.end)}
        </>
      );
    }
    if (flash?.p === p) {
      return (
        <>
          {text.slice(0, flash.start)}
          <span
            className={cn(
              "rounded-[3px] transition-colors duration-1000 [box-decoration-break:clone]",
              flashOn
                ? "bg-emerald-500/[0.14] dark:bg-emerald-400/[0.16]"
                : "bg-transparent"
            )}
          >
            {text.slice(flash.start, flash.end)}
          </span>
          {text.slice(flash.end)}
        </>
      );
    }
    return text;
  };

  const lastPara = span?.p === doc.length - 1;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-lg rounded-2xl bg-white ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10",
          className
        )}
        ref={rootRef}
      >
        <header className="flex items-center gap-2 border-black/[0.06] border-b px-5 py-3 dark:border-white/[0.08]">
          <PenLine
            aria-hidden="true"
            className="size-3.5 text-zinc-400 dark:text-zinc-500"
          />
          <h3 className="min-w-0 flex-1 truncate font-medium text-[13px] text-zinc-900 dark:text-zinc-100">
            {title}
          </h3>
          <span className="text-[12px] text-zinc-400 dark:text-zinc-500">
            Draft
          </span>
        </header>

        <div
          className={cn(
            "relative px-5 pt-4 transition-[padding] duration-200",
            editing && "select-none"
          )}
          onPointerDown={() => {
            pointerDown.current = true;
          }}
          onPointerUp={(event) => {
            pointerDown.current = false;
            if (editing || barRef.current?.contains(event.target as Node)) {
              return;
            }
            if (!capture() && phase === "prompt") {
              clear();
            }
          }}
          ref={docRef}
          style={{ paddingBottom: span && lastPara ? 132 : 20 }}
        >
          {doc.map((text, p) => (
            <p
              className="mb-3 cursor-text text-[15px] text-zinc-700 leading-7 selection:bg-sky-500/[0.16] last:mb-0 dark:text-zinc-300 dark:selection:bg-sky-400/20"
              data-para={p}
              // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs never reorder
              key={p}
            >
              {renderParagraph(text, p)}
            </p>
          ))}

          <AnimatePresence>
            {span && bar && (
              <motion.div
                animate={{ opacity: 1, scale: 1, x: bar.x, y: bar.y }}
                aria-label="Edit with AI"
                className="absolute top-0 left-0 z-20 origin-top-left overflow-hidden rounded-xl bg-white shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)] ring-1 ring-black/[0.08] dark:bg-zinc-800 dark:shadow-[0_12px_32px_-12px_rgb(0_0_0/0.7)] dark:ring-white/10"
                exit={{
                  opacity: 0,
                  scale: 0.98,
                  transition: { duration: 0.12, ease: EASE_OUT },
                }}
                initial={{ opacity: 0, scale: 0.97, x: bar.x, y: bar.y - 4 }}
                key="bar"
                ref={barRef}
                role="group"
                style={{ width: bar.width }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                <BarBody
                  phase={
                    phase === "settling" || phase === "discarding"
                      ? "review"
                      : phase
                  }
                >
                  {phase === "prompt" && (
                    <PromptBar
                      inputRef={inputRef}
                      instruction={instruction}
                      onInstruction={setInstruction}
                      onRun={(text) => run(text, 0)}
                    />
                  )}
                  {phase === "streaming" && (
                    <div className="flex h-11 items-center gap-2 pr-1.5 pl-3">
                      <Dots />
                      <p className="min-w-0 flex-1 truncate text-[13px] text-zinc-600 dark:text-zinc-300">
                        Rewriting
                        <span className="text-zinc-400 dark:text-zinc-500">
                          {" "}
                          · {label}
                        </span>
                      </p>
                      <button
                        className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] text-zinc-600 transition-colors duration-100 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/[0.07] dark:hover:text-white"
                        onClick={() => {
                          setHead(ops.length);
                          setPhase("review");
                        }}
                        ref={skipRef}
                        type="button"
                      >
                        <Square
                          aria-hidden="true"
                          className="size-2.5 fill-current"
                        />
                        Skip
                      </button>
                    </div>
                  )}
                  {(phase === "review" ||
                    phase === "settling" ||
                    phase === "discarding") && (
                    <ReviewBar
                      acceptRef={acceptRef}
                      count={versions.length}
                      discardRef={discardRef}
                      label={unchanged ? "Already reads well" : label}
                      mod={mod}
                      onAccept={accept}
                      onAgain={() => run(label, attempt + 1)}
                      onDiscard={discard}
                      onVersion={setVersion}
                      unchanged={unchanged}
                      version={version}
                    />
                  )}
                </BarBody>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer className="flex h-10 items-center border-black/[0.06] border-t px-5 dark:border-white/[0.08]">
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
            Select any text to edit it with AI
          </p>
        </footer>
        <p aria-live="polite" className="sr-only">
          {phase === "review" ? "Rewrite ready. Accept or discard." : ""}
        </p>
      </div>
    </MotionConfig>
  );
}

function PromptBar({
  instruction,
  onInstruction,
  onRun,
  inputRef,
}: {
  instruction: string;
  onInstruction: (value: string) => void;
  onRun: (text: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <>
      <form
        className="flex h-11 items-center gap-2 pr-1.5 pl-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (instruction.trim()) {
            onRun(instruction.trim());
          }
        }}
      >
        <input
          aria-label="Tell AI how to edit the selection"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-zinc-900 outline-hidden placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500 [@media(pointer:coarse)]:text-base"
          onChange={(event) => onInstruction(event.target.value)}
          placeholder="Ask AI to edit…"
          ref={inputRef}
          value={instruction}
        />
        <button
          aria-label="Rewrite"
          className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white transition-[background-color,opacity] duration-150 hover:bg-zinc-700 active:bg-zinc-600 disabled:opacity-30 dark:bg-white dark:text-zinc-900 dark:active:bg-zinc-300 dark:hover:bg-zinc-200"
          disabled={!instruction.trim()}
          type="submit"
        >
          <ArrowUp className="size-3.5" />
        </button>
      </form>
      <div className="flex flex-wrap gap-1 border-black/[0.06] border-t p-1.5 dark:border-white/[0.08]">
        {ACTIONS.map((action) => (
          <button
            className="h-7 rounded-lg px-2.5 text-[12px] text-zinc-600 outline-hidden transition-colors duration-100 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:bg-zinc-100 dark:text-zinc-300 dark:focus-visible:bg-white/[0.07] dark:hover:bg-white/[0.07] dark:hover:text-white"
            key={action.id}
            onClick={() => onRun(action.label)}
            type="button"
          >
            {action.label}
          </button>
        ))}
      </div>
    </>
  );
}

function ReviewBar({
  label,
  count,
  version,
  unchanged,
  acceptRef,
  discardRef,
  onVersion,
  onAgain,
  onDiscard,
  onAccept,
  mod,
}: {
  label: string;
  mod: string;
  count: number;
  version: number;
  unchanged: boolean;
  acceptRef: RefObject<HTMLButtonElement | null>;
  discardRef: RefObject<HTMLButtonElement | null>;
  onVersion: (v: number) => void;
  onAgain: () => void;
  onDiscard: () => void;
  onAccept: () => void;
}) {
  const ghost =
    "flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] text-zinc-600 outline-hidden transition-colors duration-100 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900/15 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-300 dark:focus-visible:ring-white/20 dark:hover:bg-white/[0.07] dark:hover:text-white";
  return (
    <div className="flex h-11 items-center gap-1 pr-1.5 pl-2">
      {count > 1 && (
        <div className="flex shrink-0 items-center text-[12px] text-zinc-500 tabular-nums dark:text-zinc-400">
          <button
            aria-label="Previous version"
            className={cn(ghost, "px-1")}
            disabled={version === 0}
            onClick={() => onVersion(version - 1)}
            type="button"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          {version + 1}/{count}
          <button
            aria-label="Next version"
            className={cn(ghost, "px-1")}
            disabled={version === count - 1}
            onClick={() => onVersion(version + 1)}
            type="button"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}
      <p
        className={cn(
          "min-w-0 truncate text-[12px] text-zinc-500 dark:text-zinc-400",
          count > 1 ? "pl-0.5" : "pl-1"
        )}
      >
        {label}
      </p>
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <button
          aria-label="Try again"
          className={ghost}
          onClick={onAgain}
          title="Try again"
          type="button"
        >
          <RotateCw className="size-3.5" />
        </button>
        <button
          className={ghost}
          onClick={onDiscard}
          ref={discardRef}
          type="button"
        >
          Discard
        </button>
        <button
          className="flex h-7 items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 font-medium text-[12px] text-white outline-hidden transition-colors duration-150 hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-900/30 focus-visible:ring-offset-1 active:bg-zinc-600 dark:bg-white dark:text-zinc-900 dark:active:bg-zinc-300 dark:focus-visible:ring-white/40 dark:focus-visible:ring-offset-zinc-800 dark:hover:bg-zinc-200"
          disabled={unchanged}
          onClick={onAccept}
          ref={acceptRef}
          type="button"
        >
          Accept
          <kbd className="font-sans text-[11px] opacity-60">{mod}↵</kbd>
        </button>
      </div>
    </div>
  );
}

function DiffRun({
  run,
  head,
  phase,
}: {
  run: Indexed[];
  head: number;
  phase: Phase;
}) {
  const streaming = phase === "streaming";
  const settling = phase === "settling";
  const discarding = phase === "discarding";
  const done = run.filter((r) => !streaming || r.index < head);
  const pending = run.filter((r) => streaming && r.index >= head);
  const caret =
    streaming && done.some((r) => r.index === head - 1) ? <Caret /> : null;
  const kind = run[0].op.kind;
  const gap = run.at(-1)?.op.gap ?? "";

  if (kind === "same") {
    return (
      <span>
        {run[0].op.word}
        {caret}
        {gap}
      </span>
    );
  }
  if (kind === "del") {
    return (
      <span
        className={cn(
          "transition-opacity duration-150",
          settling && "opacity-0"
        )}
      >
        {done.length > 0 && (
          <del
            className={cn(
              "transition-[color,text-decoration-color] duration-150",
              discarding
                ? "text-inherit no-underline decoration-transparent"
                : "text-zinc-400 decoration-red-500/60 dark:text-zinc-500 dark:decoration-red-400/60"
            )}
          >
            {join(done)}
          </del>
        )}
        {caret}
        {done.length > 0 && pending.length > 0 && " "}
        {join(pending)}
        {gap}
      </span>
    );
  }
  if (done.length === 0) {
    return null;
  }
  return (
    <span>
      <ins
        className={cn(
          "rounded-[3px] no-underline transition-[background-color,color,opacity] duration-300 [box-decoration-break:clone]",
          discarding && "opacity-0 duration-150",
          settling
            ? "bg-transparent"
            : "bg-emerald-500/[0.14] text-emerald-950 dark:bg-emerald-400/[0.16] dark:text-emerald-100"
        )}
      >
        {done.map((r, k) => (
          <motion.span
            animate={{ opacity: 1, filter: "blur(0px)" }}
            initial={{ opacity: 0, filter: "blur(3px)" }}
            key={r.op.key}
            transition={{ duration: 0.24, ease: EASE_OUT }}
          >
            {r.op.word}
            {k < done.length - 1 ? r.op.gap : ""}
          </motion.span>
        ))}
      </ins>
      {caret}
      {gap}
    </span>
  );
}

/** Grows and shrinks with its content, and crossfades between phases. */
function BarBody({ phase, children }: { phase: Phase; children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      animate={{ height }}
      initial={false}
      transition={{ duration: 0.2, ease: EASE_OUT }}
    >
      <div ref={innerRef}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(2px)" }}
            initial={{ opacity: 0, filter: "blur(2px)" }}
            key={phase}
            transition={{ duration: 0.15, ease: EASE_OUT }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function Caret() {
  return (
    <span
      aria-hidden="true"
      className="ml-px inline-block h-[1.05em] w-[2px] translate-y-[3px] rounded-full bg-zinc-900 dark:bg-zinc-100"
    />
  );
}

function Dots() {
  return (
    <span aria-hidden="true" className="flex gap-[3px]">
      {[0, 1, 2].map((i) => (
        <motion.span
          animate={{ opacity: [0.25, 1, 0.25] }}
          className="size-1 rounded-full bg-zinc-500 dark:bg-zinc-400"
          key={i}
          transition={{
            duration: 1,
            repeat: Number.POSITIVE_INFINITY,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}
