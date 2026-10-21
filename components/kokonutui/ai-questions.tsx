"use client";

/**
 * @author: @dorianbaffier
 * @description: AI Questions
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, CornerDownLeft, Pencil } from "lucide-react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const ADVANCE_MS = 220;
const DIGIT_KEY = /^[1-9]$/;

export interface QuestionOption {
  id: string;
  label: string;
  /** One line on what picking it means. */
  hint?: string;
}

export interface AgentQuestion {
  id: string;
  /** Short name for the answer row, such as "Framework". */
  title: string;
  prompt: string;
  options: QuestionOption[];
  /** Pick any number instead of one. */
  multiple?: boolean;
  /** Offer a free-text "Other" row. Defaults to true. */
  allowOther?: boolean;
}

export type QuestionAnswer =
  | { kind: "options"; ids: string[] }
  | { kind: "other"; text: string }
  | { kind: "agent" };

export interface AiQuestionsProps {
  questions?: AgentQuestion[];
  /** What the agent is about to do, shown under the heading. */
  task?: string;
  /** Called with every answer when the user starts the run. */
  onSubmit?: (answers: Record<string, QuestionAnswer>) => void;
  className?: string;
}

const DEFAULT_QUESTIONS: AgentQuestion[] = [
  {
    id: "framework",
    title: "Framework",
    prompt: "Which framework should the site use?",
    options: [
      {
        id: "next",
        label: "Next.js",
        hint: "App Router, server components",
      },
      { id: "astro", label: "Astro", hint: "Mostly static, islands" },
      { id: "vite", label: "Vite + React", hint: "Client only, no server" },
    ],
  },
  {
    id: "auth",
    title: "Sign in",
    prompt: "How should people sign in?",
    options: [
      { id: "magic", label: "Magic link", hint: "Email only, no passwords" },
      { id: "oauth", label: "GitHub and Google" },
      { id: "passkey", label: "Passkeys" },
      { id: "none", label: "No sign in yet" },
    ],
  },
  {
    id: "pages",
    title: "Pages",
    prompt: "Which pages besides the home page?",
    multiple: true,
    allowOther: false,
    options: [
      { id: "pricing", label: "Pricing" },
      { id: "docs", label: "Docs" },
      { id: "blog", label: "Blog" },
      { id: "changelog", label: "Changelog" },
    ],
  },
  {
    id: "deploy",
    title: "Deploy",
    prompt: "Where will it run?",
    options: [
      { id: "vercel", label: "Vercel" },
      { id: "cloudflare", label: "Cloudflare" },
      { id: "docker", label: "My own server", hint: "A Dockerfile" },
    ],
  },
];

function answerText(question: AgentQuestion, answer: QuestionAnswer) {
  if (answer.kind === "agent") {
    return "Your call";
  }
  if (answer.kind === "other") {
    return answer.text;
  }
  return question.options
    .filter((option) => answer.ids.includes(option.id))
    .map((option) => option.label)
    .join(", ");
}

function firstOpen(
  questions: AgentQuestion[],
  answers: Record<string, QuestionAnswer>
) {
  const index = questions.findIndex((q) => !answers[q.id]);
  return index === -1 ? null : index;
}

type Phase = "asking" | "review" | "sent";

const HEADINGS: Record<Phase, string> = {
  asking: "A few questions first",
  review: "Ready to start",
  sent: "Answers sent",
};

export default function AiQuestions({
  questions = DEFAULT_QUESTIONS,
  task = "Set up the marketing site",
  onSubmit,
  className,
}: AiQuestionsProps) {
  const uid = useId();
  const reduceMotion = useReducedMotion();
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});
  const [current, setCurrent] = useState<number | null>(0);
  const [phase, setPhase] = useState<Phase>("asking");
  const [picked, setPicked] = useState<string[]>([]);
  const [other, setOther] = useState<string | null>(null);
  const [focus, setFocus] = useState(0);
  const advanceRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const otherRef = useRef<HTMLInputElement>(null);
  const refocusRef = useRef(false);

  const question = current === null ? null : questions[current];

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the question changes
  useEffect(() => {
    if (!refocusRef.current) {
      return;
    }
    refocusRef.current = false;
    // The old question is still fading out, so look inside the new one.
    const selector =
      current === null
        ? "[data-start]"
        : `[data-question="${current}"] [data-option="0"]`;
    cardRef.current?.querySelector<HTMLElement>(selector)?.focus();
  }, [current, phase]);
  const answered = questions.filter((q) => answers[q.id]).length;

  useEffect(
    () => () => {
      if (advanceRef.current) {
        window.clearTimeout(advanceRef.current);
      }
    },
    []
  );

  // Opening a question loads what was answered before, so editing starts
  // from the old answer.
  const open = useCallback(
    (index: number | null, from: Record<string, QuestionAnswer>) => {
      setCurrent(index);
      setFocus(0);
      const q = index === null ? null : questions[index];
      const prev = q ? from[q.id] : undefined;
      setPicked(prev?.kind === "options" ? prev.ids : []);
      setOther(prev?.kind === "other" ? prev.text : null);
      setPhase(index === null ? "review" : "asking");
    },
    [questions]
  );

  const answer = useCallback(
    (value: QuestionAnswer) => {
      if (!question) {
        return;
      }
      const next = { ...answers, [question.id]: value };
      // Keyboard users stay in the card as the question swaps under them.
      refocusRef.current = Boolean(
        cardRef.current?.contains(document.activeElement)
      );
      setAnswers(next);
      open(firstOpen(questions, next), next);
    },
    [answers, open, question, questions]
  );

  const pick = (optionId: string) => {
    if (!question) {
      return;
    }
    setOther(null);
    if (question.multiple) {
      setPicked((ids) =>
        ids.includes(optionId)
          ? ids.filter((id) => id !== optionId)
          : [...ids, optionId]
      );
      return;
    }
    setPicked([optionId]);
    // A beat to see the choice land, then the next question.
    if (advanceRef.current) {
      window.clearTimeout(advanceRef.current);
    }
    advanceRef.current = window.setTimeout(
      () => answer({ kind: "options", ids: [optionId] }),
      reduceMotion ? 0 : ADVANCE_MS
    );
  };

  const canContinue =
    other === null ? picked.length > 0 : other.trim().length > 0;

  const submitCurrent = () => {
    if (!canContinue) {
      return;
    }
    if (other !== null) {
      answer({ kind: "other", text: other.trim() });
    } else {
      answer({ kind: "options", ids: picked });
    }
  };

  const startOther = () => {
    setPicked([]);
    setOther((text) => text ?? "");
    requestAnimationFrame(() => otherRef.current?.focus());
  };

  const optionCount =
    (question?.options.length ?? 0) + (question?.allowOther === false ? 0 : 1);

  // 1–9 pick an option; the number after the last one is "Something else".
  const pickByNumber = (index: number) => {
    const option = question?.options[index];
    if (option) {
      setFocus(index);
      pick(option.id);
      return true;
    }
    if (index === question?.options.length && optionCount > index) {
      startOther();
      return true;
    }
    return false;
  };

  const moveFocus = (step: number) => {
    const next = (focus + step + optionCount) % optionCount;
    setFocus(next);
    cardRef.current
      ?.querySelector<HTMLElement>(
        `[data-question="${current}"] [data-option="${next}"]`
      )
      ?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (DIGIT_KEY.test(event.key)) {
      if (pickByNumber(Number(event.key) - 1)) {
        event.preventDefault();
      }
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" && question?.multiple) {
      event.preventDefault();
      submitCurrent();
    }
  };

  const start = () => {
    setPhase("sent");
    onSubmit?.(answers);
  };

  const summary = questions
    .map((q, index) => ({ q, index, a: answers[q.id] }))
    .filter(({ a, index }) => a && index !== current);

  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.22, ease: EASE_OUT }}
    >
      <section
        aria-label="Questions from the agent"
        className={cn(
          "w-full max-w-md rounded-2xl bg-black/5 p-1.5 dark:bg-white/5",
          className
        )}
      >
        <header className="flex items-center gap-3 px-2.5 pt-1 pb-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
              {HEADINGS[phase]}
            </h3>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {task}
            </p>
          </div>
          <Progress done={answered} total={questions.length} />
        </header>

        <div
          className="overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
          ref={cardRef}
        >
          <motion.ul layout="position">
            <AnimatePresence initial={false}>
              {phase !== "sent" &&
                summary.map(({ q, index, a }) => (
                  <motion.li
                    animate={{ height: "auto", opacity: 1 }}
                    className="overflow-hidden"
                    exit={{ height: 0, opacity: 0 }}
                    initial={{ height: 0, opacity: 0 }}
                    key={q.id}
                  >
                    <button
                      className="group/row flex w-full items-center gap-3 border-black/5 border-b px-3.5 py-2.5 text-left text-[13px] outline-hidden transition-colors duration-150 hover:bg-zinc-50 focus-visible:bg-zinc-50 dark:border-white/5 dark:focus-visible:bg-white/5 dark:hover:bg-white/5"
                      onClick={() => open(index, answers)}
                      type="button"
                    >
                      <span className="w-20 shrink-0 text-zinc-500 dark:text-zinc-400">
                        {q.title}
                      </span>
                      <motion.span
                        className={cn(
                          "min-w-0 flex-1 truncate",
                          a?.kind === "agent"
                            ? "text-zinc-500 italic dark:text-zinc-400"
                            : "text-zinc-900 dark:text-zinc-100"
                        )}
                        layoutId={`${uid}-${q.id}`}
                      >
                        {a ? answerText(q, a) : ""}
                      </motion.span>
                      <Pencil
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-zinc-400 opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 group-focus-visible/row:opacity-100"
                      />
                      <span className="sr-only">Edit</span>
                    </button>
                  </motion.li>
                ))}
            </AnimatePresence>
          </motion.ul>

          <AnimatePresence initial={false} mode="popLayout">
            {phase === "asking" && question && (
              <motion.div
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                data-question={current}
                exit={{
                  opacity: 0,
                  transform: "translateY(-6px)",
                  transition: { duration: 0.15 },
                }}
                initial={{ opacity: 0, transform: "translateY(8px)" }}
                key={question.id}
                layout="position"
              >
                <QuestionBody
                  canContinue={canContinue}
                  focus={focus}
                  onAgent={() => answer({ kind: "agent" })}
                  onContinue={submitCurrent}
                  onKeyDown={onKeyDown}
                  onOther={startOther}
                  onOtherChange={setOther}
                  onPick={pick}
                  other={other}
                  otherRef={otherRef}
                  picked={picked}
                  question={question}
                  uid={uid}
                />
              </motion.div>
            )}

            {phase === "review" && (
              <motion.div
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 px-3.5 py-3"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="review"
                layout="position"
              >
                <p className="flex-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Click an answer to change it.
                </p>
                <button
                  className="flex h-8 items-center gap-2 rounded-lg bg-zinc-900 px-3 font-medium text-sm text-white outline-hidden transition-colors duration-150 hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-1 dark:bg-white dark:text-zinc-900 dark:focus-visible:ring-offset-zinc-900 dark:hover:bg-zinc-200"
                  data-start
                  onClick={start}
                  type="button"
                >
                  Start
                </button>
              </motion.div>
            )}

            {phase === "sent" && (
              <motion.div
                animate={{ opacity: 1 }}
                className="flex items-center gap-2.5 px-3.5 py-3 text-[13px]"
                initial={{ opacity: 0 }}
                key="sent"
                layout="position"
              >
                <Check
                  aria-hidden="true"
                  className="size-4 text-violet-600 dark:text-violet-400"
                />
                <span className="flex-1 text-zinc-700 dark:text-zinc-300">
                  Working with your {answered} answers
                </span>
                <button
                  className="rounded-md px-1.5 py-1 text-xs text-zinc-500 outline-hidden transition-colors duration-150 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-violet-500/50 dark:text-zinc-400 dark:hover:text-white"
                  onClick={() => setPhase("review")}
                  type="button"
                >
                  Edit
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </MotionConfig>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
        {done}/{total}
      </span>
      <div aria-hidden="true" className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span
            className="relative h-1 w-3 overflow-hidden rounded-full bg-zinc-900/10 dark:bg-white/15"
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed segments
            key={i}
          >
            <span
              className={cn(
                "absolute inset-0 origin-left rounded-full bg-violet-600 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] dark:bg-violet-400",
                i < done ? "scale-x-100" : "scale-x-0"
              )}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

interface QuestionBodyProps {
  question: AgentQuestion;
  picked: string[];
  other: string | null;
  focus: number;
  canContinue: boolean;
  uid: string;
  otherRef: RefObject<HTMLInputElement | null>;
  onPick: (id: string) => void;
  onOther: () => void;
  onOtherChange: (text: string | null) => void;
  onAgent: () => void;
  onContinue: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

function QuestionBody({
  question,
  picked,
  other,
  focus,
  canContinue,
  uid,
  otherRef,
  onPick,
  onOther,
  onOtherChange,
  onAgent,
  onContinue,
  onKeyDown,
}: QuestionBodyProps) {
  const allowOther = question.allowOther !== false;
  const otherIndex = question.options.length;
  return (
    <div className="p-1.5">
      <fieldset>
        <legend className="px-2 pt-1.5 pb-2.5 font-medium text-[15px] text-zinc-900 dark:text-zinc-100">
          {question.prompt}
          {question.multiple && (
            <span className="ml-1.5 font-normal text-xs text-zinc-400 dark:text-zinc-500">
              Pick any
            </span>
          )}
        </legend>
        <div className="flex flex-col gap-0.5">
          {question.options.map((option, i) => {
            const selected = picked.includes(option.id);
            return (
              <button
                aria-pressed={selected}
                className={cn(
                  "group/opt flex items-center gap-3 rounded-lg px-2 py-2 text-left outline-hidden transition-colors duration-150",
                  selected
                    ? "bg-violet-50 dark:bg-violet-500/10"
                    : "hover:bg-zinc-50 focus-visible:bg-zinc-50 dark:focus-visible:bg-white/5 dark:hover:bg-white/5"
                )}
                data-option={i}
                key={option.id}
                onClick={() => onPick(option.id)}
                onKeyDown={onKeyDown}
                tabIndex={i === focus ? 0 : -1}
                type="button"
              >
                <Key active={selected}>{i + 1}</Key>
                <span className="min-w-0 flex-1">
                  {/* The label flies up into the answer row once it's chosen. */}
                  <motion.span
                    className={cn(
                      "block truncate text-sm",
                      selected
                        ? "text-violet-950 dark:text-violet-100"
                        : "text-zinc-900 dark:text-zinc-100"
                    )}
                    layoutId={
                      selected && !question.multiple
                        ? `${uid}-${question.id}`
                        : undefined
                    }
                  >
                    {option.label}
                  </motion.span>
                  {option.hint && (
                    <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {option.hint}
                    </span>
                  )}
                </span>
                <Mark multiple={question.multiple} selected={selected} />
              </button>
            );
          })}

          {allowOther &&
            (other === null ? (
              <button
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-left outline-hidden transition-colors duration-150 hover:bg-zinc-50 focus-visible:bg-zinc-50 dark:focus-visible:bg-white/5 dark:hover:bg-white/5"
                data-option={otherIndex}
                onClick={onOther}
                onKeyDown={onKeyDown}
                tabIndex={focus === otherIndex ? 0 : -1}
                type="button"
              >
                <Key active={false}>{otherIndex + 1}</Key>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  Something else…
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-3 rounded-lg bg-violet-50 px-2 py-1.5 dark:bg-violet-500/10">
                <Key active>{otherIndex + 1}</Key>
                <input
                  aria-label="Your answer"
                  className="h-7 min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-hidden placeholder:text-zinc-400 dark:text-zinc-100"
                  data-option={otherIndex}
                  onChange={(event) => onOtherChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onContinue();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      onOtherChange(null);
                    }
                  }}
                  placeholder="Type your answer"
                  ref={otherRef}
                  value={other}
                />
              </div>
            ))}
        </div>
      </fieldset>
      <div className="mt-2 flex items-center gap-2 border-black/5 border-t px-1 pt-2 dark:border-white/5">
        <button
          className="rounded-md px-1.5 py-1 text-xs text-zinc-500 outline-hidden transition-colors duration-150 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-violet-500/50 dark:text-zinc-400 dark:hover:text-white"
          onClick={onAgent}
          type="button"
        >
          You decide
        </button>
        {question.multiple || other !== null ? (
          <button
            className="ml-auto flex h-7 items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 font-medium text-white text-xs outline-hidden transition-[background-color,opacity] duration-150 hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-30 dark:bg-white dark:text-zinc-900 dark:focus-visible:ring-offset-zinc-900 dark:hover:bg-zinc-200"
            disabled={!canContinue}
            onClick={onContinue}
            type="button"
          >
            Continue
            <CornerDownLeft aria-hidden="true" className="size-3" />
          </button>
        ) : (
          <span className="ml-auto flex h-7 items-center px-1 text-xs text-zinc-400 dark:text-zinc-500">
            Press 1–{otherIndex + (allowOther ? 1 : 0)} to pick
          </span>
        )}
      </div>
    </div>
  );
}

function Key({ children, active }: { children: number; active: boolean }) {
  return (
    <kbd
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md font-medium font-sans text-[11px] tabular-nums ring-1 transition-colors duration-150",
        active
          ? "bg-violet-600 text-white ring-violet-600 dark:bg-violet-500 dark:ring-violet-500"
          : "bg-white text-zinc-500 ring-black/10 dark:bg-white/5 dark:text-zinc-400 dark:ring-white/10"
      )}
    >
      {children}
    </kbd>
  );
}

function Mark({
  multiple,
  selected,
}: {
  multiple?: boolean;
  selected: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-4 shrink-0 items-center justify-center ring-1 transition-colors duration-150",
        multiple ? "rounded-[5px]" : "rounded-full",
        selected
          ? "bg-violet-600 text-white ring-violet-600 dark:bg-violet-500 dark:ring-violet-500"
          : "ring-black/15 dark:ring-white/20"
      )}
    >
      <Check
        className={cn(
          "size-3 transition-[opacity,scale] duration-150 ease-out",
          selected ? "scale-100 opacity-100" : "scale-75 opacity-0"
        )}
        strokeWidth={3}
      />
    </span>
  );
}
