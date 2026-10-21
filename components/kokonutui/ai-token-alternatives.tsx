"use client";

/**
 * @author: @kokonutui
 * @description: AI Token Alternatives
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, RotateCcw, X } from "lucide-react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface TokenOption {
  text: string;
  /** How likely the model was to pick this word, from 0 to 1. */
  p: number;
}

export interface TokenSlot {
  id: string;
  /** Most likely first. The first one is what the model wrote. */
  options: TokenOption[];
}

/** Plain text, or a word the model nearly wrote differently. */
export type AnswerPiece = string | { slot: string };

export interface AITokenAlternativesProps {
  prompt?: string;
  slots?: TokenSlot[];
  /** Builds the answer from the word picked in each slot. */
  compose?: (choice: Record<string, string>) => AnswerPiece[];
  className?: string;
}

interface Token {
  key: string;
  /** Whitespace before the word, kept outside the button. */
  lead: string;
  word: string;
  p: number;
  slot?: string;
}

interface Open {
  slot: string;
  index: number;
  x: number;
  y: number;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const MENU_WIDTH = 252;
const TOKEN_PATTERN = /\s+|[^\s,.?!]+|[,.?!]/g;
const SPACE = /^\s+$/;

const DEMO_SLOTS: TokenSlot[] = [
  {
    id: "greet",
    options: [
      { text: "Sure", p: 0.58 },
      { text: "Yes", p: 0.23 },
      { text: "Good call", p: 0.12 },
    ],
  },
  {
    id: "day",
    options: [
      { text: "Thursday", p: 0.41 },
      { text: "Friday", p: 0.34 },
      { text: "next Monday", p: 0.17 },
    ],
  },
  {
    id: "time",
    options: [
      { text: "2pm", p: 0.38 },
      { text: "10am", p: 0.31 },
      { text: "after lunch", p: 0.22 },
    ],
  },
  {
    id: "length",
    options: [
      { text: "30 minutes", p: 0.52 },
      { text: "an hour", p: 0.29 },
      { text: "15 minutes", p: 0.13 },
    ],
  },
];

const dayReason: Record<string, string> = {
  Friday: " since the build lands Thursday night.",
  "next Monday": ", so we get the weekend to fix the last bugs.",
};

const demoCompose = (c: Record<string, string>): AnswerPiece[] => [
  { slot: "greet" },
  ", ",
  { slot: "day" },
  " works better for me",
  dayReason[c.day] ?? ", and it gives design a day to finish the flows.",
  " Want to do ",
  { slot: "time" },
  c.time === "after lunch" ? " when everyone is back" : "",
  "? Let's keep it to ",
  { slot: "length" },
  c.length === "15 minutes"
    ? " and only go through the blockers."
    : " and walk through the launch checklist together.",
];

/** Words the model was less sure of, so the confidence view has texture. */
const SOFT: Record<string, number> = {
  design: 0.62,
  flows: 0.71,
  build: 0.68,
  bugs: 0.64,
  blockers: 0.6,
  checklist: 0.57,
  together: 0.74,
  everyone: 0.7,
};

/** A steady, high probability for a plain word, so renders match. */
const plainP = (word: string, index: number) => {
  if (SOFT[word] !== undefined) {
    return SOFT[word];
  }
  let h = index * 31;
  for (const ch of word) {
    h = (h * 33 + ch.charCodeAt(0)) % 997;
  }
  return 0.86 + (h % 13) / 100;
};

const tokenize = (
  pieces: AnswerPiece[],
  choice: Record<string, string>,
  slots: TokenSlot[]
) => {
  const tokens: Token[] = [];
  let lead = "";
  const push = (word: string, p: number, slot?: string) => {
    const index = tokens.length;
    tokens.push({ key: `${index}:${word}`, lead, word, p, slot });
    lead = "";
  };
  for (const piece of pieces) {
    if (typeof piece === "string") {
      for (const part of piece.match(TOKEN_PATTERN) ?? []) {
        if (SPACE.test(part)) {
          lead += part;
        } else {
          push(part, plainP(part, tokens.length));
        }
      }
      continue;
    }
    const slot = slots.find((s) => s.id === piece.slot);
    const picked =
      slot?.options.find((o) => o.text === choice[piece.slot]) ??
      slot?.options[0];
    if (picked) {
      push(picked.text, picked.p, piece.slot);
    }
  }
  return tokens;
};

const defaults = (slots: TokenSlot[]) =>
  Object.fromEntries(slots.map((s) => [s.id, s.options[0]?.text ?? ""]));

export default function AITokenAlternatives({
  prompt = "Sam wants to push the launch review. Can you draft a quick reply?",
  slots = DEMO_SLOTS,
  compose = demoCompose,
  className,
}: AITokenAlternativesProps) {
  const reduceMotion = useReducedMotion();
  const [choice, setChoice] = useState(() => defaults(slots));
  const [shown, setShown] = useState(0);
  const [open, setOpen] = useState<Open | null>(null);
  const [heat, setHeat] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  /** Holds the height while a rewrite streams, so the card does not jump. */
  const [minHeight, setMinHeight] = useState<number>();
  const tokenRefs = useRef(new Map<string, HTMLButtonElement>());

  const tokens = useMemo(
    () => tokenize(compose(choice), choice, slots),
    [compose, choice, slots]
  );
  const streaming = shown < tokens.length;

  // Stream the answer in a word at a time.
  useEffect(() => {
    if (!streaming) {
      return;
    }
    if (reduceMotion) {
      setShown(tokens.length);
      return;
    }
    const word = tokens[shown]?.word ?? "";
    const id = setTimeout(
      () => setShown((n) => n + 1),
      26 + Math.min(40, word.length * 6)
    );
    return () => clearTimeout(id);
  }, [shown, streaming, tokens, reduceMotion]);

  const pick = useCallback(
    (slotId: string, text: string) => {
      const index = tokens.findIndex((t) => t.slot === slotId);
      setOpen(null);
      if (choice[slotId] === text) {
        return;
      }
      setMinHeight(textRef.current?.offsetHeight);
      setChoice((c) => ({ ...c, [slotId]: text }));
      // Keep everything up to the new word, then write the rest again.
      setShown(index + 1);
      requestAnimationFrame(() =>
        tokenRefs.current.get(slotId)?.focus({ preventScroll: true })
      );
    },
    [choice, tokens]
  );

  const toggle = (token: Token, index: number) => {
    const slotId = token.slot;
    const button = slotId ? tokenRefs.current.get(slotId) : undefined;
    const box = answerRef.current;
    if (!(slotId && button && box)) {
      return;
    }
    if (open?.slot === slotId) {
      setOpen(null);
      return;
    }
    const b = button.getBoundingClientRect();
    const r = box.getBoundingClientRect();
    setOpen({
      slot: slotId,
      index,
      x: Math.max(0, Math.min(b.left - r.left - 10, r.width - MENU_WIDTH)),
      y: b.bottom - r.top + 6,
    });
  };

  const close = useCallback(() => {
    const slotId = open?.slot;
    setOpen(null);
    if (slotId) {
      tokenRefs.current.get(slotId)?.focus({ preventScroll: true });
    }
  }, [open]);

  // Click outside closes the list.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!answerRef.current?.contains(target)) {
        setOpen(null);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const edits = slots.filter((s) => choice[s.id] !== s.options[0]?.text);
  const openSlot = slots.find((s) => s.id === open?.slot);

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-md rounded-2xl bg-white ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10",
          className
        )}
      >
        <div className="flex justify-end px-4 pt-4">
          <p className="max-w-[85%] rounded-2xl rounded-br-md bg-zinc-100 px-3.5 py-2 text-[13px] text-zinc-700 leading-snug dark:bg-zinc-800 dark:text-zinc-200">
            {prompt}
          </p>
        </div>

        <div className="relative px-4 pt-4 pb-5" ref={answerRef}>
          <p
            className="text-[15px] text-zinc-800 leading-7 dark:text-zinc-200"
            ref={textRef}
            style={{ minHeight: streaming ? minHeight : undefined }}
          >
            {tokens.slice(0, shown).map((token, index) => (
              <TokenView
                active={open?.slot === token.slot && Boolean(token.slot)}
                edited={
                  Boolean(token.slot) && edits.some((s) => s.id === token.slot)
                }
                heat={heat}
                key={token.key}
                onToggle={() => toggle(token, index)}
                ref={(el) => {
                  if (token.slot && el) {
                    tokenRefs.current.set(token.slot, el);
                  }
                }}
                token={token}
              />
            ))}
            {streaming && (
              <span
                aria-hidden="true"
                className="ml-0.5 inline-block h-4 w-[7px] translate-y-[3px] animate-pulse rounded-[2px] bg-zinc-800 motion-reduce:animate-none dark:bg-zinc-200"
              />
            )}
          </p>

          <AnimatePresence>
            {open && openSlot && (
              <Alternatives
                current={choice[openSlot.id]}
                key={openSlot.id}
                onClose={close}
                onPick={(text) => pick(openSlot.id, text)}
                slot={openSlot}
                x={open.x}
                y={open.y}
              />
            )}
          </AnimatePresence>
        </div>

        <footer className="flex min-h-12 flex-wrap items-center gap-2 border-black/[0.06] border-t px-4 py-2.5 dark:border-white/[0.08]">
          <HeatSwitch on={heat} onToggle={() => setHeat((h) => !h)} />
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
            {edits.length === 0 ? (
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                Click a dotted word to swap it
              </p>
            ) : (
              <EditChips
                choice={choice}
                edits={edits}
                onReset={() => {
                  const first = tokens.findIndex(
                    (t) => t.slot && edits.some((s) => s.id === t.slot)
                  );
                  setMinHeight(textRef.current?.offsetHeight);
                  setChoice(defaults(slots));
                  setShown(Math.max(0, first));
                }}
                onRevert={(slot) => pick(slot.id, slot.options[0].text)}
              />
            )}
          </div>
        </footer>
        <p aria-live="polite" className="sr-only">
          {streaming ? "" : "Answer updated"}
        </p>
      </div>
    </MotionConfig>
  );
}

function TokenView({
  token,
  heat,
  active,
  edited,
  onToggle,
  ref,
}: {
  token: Token;
  heat: boolean;
  active: boolean;
  edited: boolean;
  onToggle: () => void;
  ref: (el: HTMLButtonElement | null) => void;
}) {
  // The less sure the model was, the warmer the word in the confidence view.
  const warmth = heat ? Math.max(0, (0.95 - token.p) / 0.75) : 0;
  const style = {
    backgroundColor: `rgb(234 88 12 / ${(warmth * 0.32).toFixed(3)})`,
  };
  const enter = {
    initial: { opacity: 0, filter: "blur(3px)" },
    animate: { opacity: 1, filter: "blur(0px)" },
    transition: { duration: 0.28, ease: EASE_OUT },
  };

  if (!token.slot) {
    return (
      <>
        {token.lead}
        <motion.span
          {...enter}
          className="rounded-[3px] transition-[background-color] duration-300 [box-decoration-break:clone]"
          style={style}
        >
          {token.word}
        </motion.span>
      </>
    );
  }

  return (
    <>
      {token.lead}
      <motion.button
        {...enter}
        aria-expanded={active}
        aria-haspopup="listbox"
        aria-label={`${token.word}, ${Math.round(token.p * 100)}% likely. Show alternatives`}
        className={cn(
          "-mx-0.5 cursor-pointer rounded-[4px] px-0.5 underline decoration-[1.5px] underline-offset-[5px] outline-hidden transition-[background-color,text-decoration-color] duration-150 [box-decoration-break:clone] focus-visible:ring-2 focus-visible:ring-orange-600/40",
          edited
            ? "decoration-orange-600 decoration-solid dark:decoration-orange-400"
            : "decoration-zinc-400 decoration-dotted dark:decoration-zinc-500",
          active
            ? "bg-zinc-900/[0.07] dark:bg-white/10"
            : "hover:bg-zinc-900/[0.05] dark:hover:bg-white/[0.07]"
        )}
        onClick={onToggle}
        ref={ref}
        style={heat ? style : undefined}
        type="button"
      >
        {token.word}
      </motion.button>
    </>
  );
}

function Alternatives({
  slot,
  current,
  x,
  y,
  onPick,
  onClose,
}: {
  slot: TokenSlot;
  current: string;
  x: number;
  y: number;
  onPick: (text: string) => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const options = [...slot.options].sort((a, b) => b.p - a.p);

  useEffect(() => {
    const selected = listRef.current?.querySelector<HTMLButtonElement>(
      '[aria-selected="true"]'
    );
    selected?.focus({ preventScroll: true });
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [
      ...(listRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="option"]'
      ) ?? []),
    ];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items.at((at + step + items.length) % items.length)?.focus();
    } else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      aria-label="Other words the model considered"
      className="absolute z-20 origin-top-left rounded-xl bg-white p-1.5 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)] ring-1 ring-black/[0.08] dark:bg-zinc-800 dark:shadow-[0_12px_32px_-12px_rgb(0_0_0/0.7)] dark:ring-white/10"
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
      initial={{ opacity: 0, scale: 0.97, y: -4 }}
      onKeyDown={onKeyDown}
      ref={listRef}
      role="listbox"
      style={{ left: x, top: y, width: MENU_WIDTH }}
      transition={{ duration: 0.16, ease: EASE_OUT }}
    >
      <p className="px-2 pt-1 pb-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
        Words it weighed here
      </p>
      {options.map((option) => {
        const selected = option.text === current;
        return (
          <button
            aria-selected={selected}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-hidden transition-colors duration-100 hover:bg-zinc-100 focus-visible:bg-zinc-100 dark:focus-visible:bg-white/[0.07] dark:hover:bg-white/[0.07]"
            key={option.text}
            onClick={() => onPick(option.text)}
            role="option"
            type="button"
          >
            <span className="min-w-0 flex-1 truncate font-medium text-[13px] text-zinc-900 dark:text-zinc-100">
              {option.text}
            </span>
            <span className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-zinc-900/[0.07] dark:bg-white/10">
              <motion.span
                animate={{ scaleX: option.p }}
                className={cn(
                  "block h-full origin-left rounded-full",
                  selected
                    ? "bg-orange-600 dark:bg-orange-400"
                    : "bg-zinc-400 dark:bg-zinc-500"
                )}
                initial={{ scaleX: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.05 }}
              />
            </span>
            <span className="w-8 shrink-0 text-right font-mono text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400">
              {Math.round(option.p * 100)}%
            </span>
            <Check
              aria-hidden="true"
              className={cn(
                "size-3.5 shrink-0 text-zinc-900 dark:text-zinc-100",
                !selected && "invisible"
              )}
            />
          </button>
        );
      })}
    </motion.div>
  );
}

function HeatSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      aria-checked={on}
      className="group flex items-center gap-2 rounded-md py-1 text-[12px] text-zinc-600 outline-hidden focus-visible:ring-2 focus-visible:ring-orange-600/40 dark:text-zinc-300"
      onClick={onToggle}
      role="switch"
      type="button"
    >
      <span
        className={cn(
          "relative h-4 w-7 rounded-full transition-colors duration-200",
          on
            ? "bg-orange-600 dark:bg-orange-500"
            : "bg-zinc-300 dark:bg-zinc-600"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-3 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
            on && "translate-x-3"
          )}
        />
      </span>
      Confidence
    </button>
  );
}

function EditChips({
  edits,
  choice,
  onRevert,
  onReset,
}: {
  edits: TokenSlot[];
  choice: Record<string, string>;
  onRevert: (slot: TokenSlot) => void;
  onReset: () => void;
}) {
  return (
    <>
      <AnimatePresence initial={false} mode="popLayout">
        {edits.map((slot) => (
          <motion.span
            animate={{ opacity: 1 }}
            className="flex h-6 items-center gap-1 rounded-full bg-zinc-100 pr-1 pl-2 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key={slot.id}
            layout
            transition={{ duration: 0.18, ease: EASE_OUT }}
          >
            <span className="text-zinc-400 line-through decoration-zinc-400/70 dark:text-zinc-500">
              {slot.options[0].text}
            </span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {choice[slot.id]}
            </span>
            <button
              aria-label={`Back to ${slot.options[0].text}`}
              className="flex size-4 items-center justify-center rounded-full text-zinc-400 transition-colors duration-100 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-100"
              onClick={() => onRevert(slot)}
              type="button"
            >
              <X className="size-3" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      {edits.length > 1 && (
        <button
          className="flex h-6 items-center gap-1 rounded-full px-2 text-[11px] text-zinc-500 transition-colors duration-100 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-white"
          onClick={onReset}
          type="button"
        >
          <RotateCcw className="size-3" />
          Reset
        </button>
      )}
    </>
  );
}
