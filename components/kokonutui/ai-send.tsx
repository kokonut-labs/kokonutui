"use client";

/**
 * @author: @kokonutui
 * @description: AI Send
 * @version: 1.0.0
 * @date: 2026-10-31
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, Mail } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface DraftEmail {
  from: string;
  toName: string;
  toEmail: string;
  subject: string;
  body: string;
}

export interface AISendProps {
  prompt?: string;
  message?: string;
  draft?: DraftEmail;
  /** Seconds you have to undo before it really sends. */
  undoSeconds?: number;
  /** Called once the undo window has passed, with the final text. */
  onSend?: (draft: DraftEmail) => void;
  className?: string;
}

type Status = "draft" | "pending" | "sent";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const RING = 2 * Math.PI * 8;

const DEMO_DRAFT: DraftEmail = {
  from: "mara@northwind.co",
  toName: "Sam Rivera",
  toEmail: "sam@northwind.co",
  subject: "Launch review moved to Thursday",
  body: "Hi Sam,\n\nQuick heads up: the launch review is now Thursday at 2pm, same room. Design needs the extra day to finish the flows.\n\nThanks,\nMara",
};

export default function AISend({
  prompt = "Tell Sam the launch review moved to Thursday at 2",
  message = "Here’s a draft. Change anything you like before it goes.",
  draft = DEMO_DRAFT,
  undoSeconds = 5,
  onSend,
  className,
}: AISendProps) {
  const id = useId();
  const [status, setStatus] = useState<Status>("draft");
  const [body, setBody] = useState(draft.body);
  const [left, setLeft] = useState(undoSeconds);
  const sendRef = useRef<HTMLButtonElement>(null);

  // Counts down the undo window, then sends for real.
  useEffect(() => {
    if (status !== "pending") {
      return;
    }
    if (left <= 0) {
      onSend?.({ ...draft, body });
      setStatus("sent");
      return;
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [status, left, onSend, draft, body]);

  const send = () => {
    setLeft(undoSeconds);
    setStatus("pending");
  };

  const undo = () => {
    setStatus("draft");
    requestAnimationFrame(() => sendRef.current?.focus());
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("flex w-full max-w-md flex-col gap-4", className)}>
        <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-zinc-100 px-3.5 py-2 text-[14px] text-zinc-800 leading-snug dark:bg-zinc-800 dark:text-zinc-100">
          {prompt}
        </p>
        <p className="text-[15px] text-zinc-800 leading-7 dark:text-zinc-200">
          {message}
        </p>

        <AutoHeight className="rounded-2xl bg-white ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10">
          <AnimatePresence initial={false} mode="popLayout">
            {status === "sent" ? (
              <motion.div
                animate={{ opacity: 1, filter: "blur(0px)" }}
                className="flex items-center gap-3 px-4 py-3"
                initial={{ opacity: 0, filter: "blur(3px)" }}
                key="sent"
                transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.08 }}
              >
                <motion.span
                  animate={{ scale: 1 }}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white dark:bg-blue-500"
                  initial={{ scale: 0.6 }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 26,
                    delay: 0.1,
                  }}
                >
                  <Check
                    aria-hidden="true"
                    className="size-3.5"
                    strokeWidth={2.5}
                  />
                </motion.span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] text-zinc-900 dark:text-zinc-100">
                    <span className="font-medium">Sent to {draft.toName}</span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {" "}
                      · just now
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-zinc-500 dark:text-zinc-400">
                    {draft.subject}
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                exit={{ opacity: 0, filter: "blur(3px)" }}
                key="draft"
                transition={{ duration: 0.2 }}
              >
                <dl className="divide-y divide-black/[0.06] px-4 text-[13px] dark:divide-white/[0.08]">
                  <Field label="To">
                    <span className="text-zinc-900 dark:text-zinc-100">
                      {draft.toName}
                    </span>{" "}
                    <span className="text-zinc-400 dark:text-zinc-500">
                      {draft.toEmail}
                    </span>
                  </Field>
                  <Field label="Subject">
                    <span className="text-zinc-900 dark:text-zinc-100">
                      {draft.subject}
                    </span>
                  </Field>
                </dl>
                <label className="sr-only" htmlFor={id}>
                  Message
                </label>
                <textarea
                  className={cn(
                    "field-sizing-content block w-full resize-none border-black/[0.06] border-t bg-transparent px-4 pt-3 pb-4 text-[14px] text-zinc-800 leading-6 outline-hidden transition-opacity duration-200 dark:border-white/[0.08] dark:text-zinc-200",
                    status === "pending" && "opacity-50"
                  )}
                  id={id}
                  onChange={(e) => setBody(e.target.value)}
                  readOnly={status === "pending"}
                  rows={6}
                  value={body}
                />
                <div className="flex items-center gap-2 border-black/[0.06] border-t px-3 py-2.5 dark:border-white/[0.08]">
                  <span className="flex items-center gap-1.5 pl-1 text-[12px] text-zinc-500 dark:text-zinc-400">
                    <Mail aria-hidden="true" className="size-3.5" />
                    {draft.from}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <AnimatePresence initial={false}>
                      {status === "pending" && (
                        <motion.button
                          animate={{ opacity: 1, x: 0 }}
                          className="h-8 rounded-lg px-3 font-medium text-[13px] text-zinc-900 outline-hidden transition-colors duration-100 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-zinc-100 dark:hover:bg-white/[0.07]"
                          exit={{ opacity: 0, x: 6 }}
                          initial={{ opacity: 0, x: 6 }}
                          onClick={undo}
                          transition={{ duration: 0.18, ease: EASE_OUT }}
                          type="button"
                        >
                          Undo
                        </motion.button>
                      )}
                    </AnimatePresence>
                    <SendButton
                      left={left}
                      onSend={send}
                      pending={status === "pending"}
                      ref={sendRef}
                      total={undoSeconds}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </AutoHeight>
        <p aria-live="polite" className="sr-only">
          {status === "pending" ? `Sending in ${left} seconds` : ""}
          {status === "sent" ? "Sent" : ""}
        </p>
      </div>
    </MotionConfig>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-10 items-center gap-3">
      <dt className="w-14 shrink-0 text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  );
}

/** Send, then a ring that drains while the undo window is open. */
function SendButton({
  pending,
  left,
  total,
  onSend,
  ref,
}: {
  pending: boolean;
  left: number;
  total: number;
  onSend: () => void;
  ref: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      className={cn(
        "flex h-8 min-w-[76px] items-center justify-center gap-2 rounded-lg px-3 font-medium text-[13px] outline-hidden transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900",
        pending
          ? "bg-zinc-100 text-zinc-700 dark:bg-white/[0.08] dark:text-zinc-200"
          : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
      )}
      disabled={pending}
      onClick={onSend}
      ref={ref}
      type="button"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {pending ? (
          <motion.span
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="pending"
            transition={{ duration: 0.15 }}
          >
            <span className="relative flex size-5 items-center justify-center">
              <svg
                aria-hidden="true"
                className="absolute inset-0 -rotate-90"
                viewBox="0 0 20 20"
              >
                <circle
                  className="stroke-zinc-300 dark:stroke-zinc-600"
                  cx="10"
                  cy="10"
                  fill="none"
                  r="8"
                  strokeWidth="1.75"
                />
                <motion.circle
                  animate={{ strokeDashoffset: RING }}
                  className="stroke-blue-600 dark:stroke-blue-400"
                  cx="10"
                  cy="10"
                  fill="none"
                  initial={{ strokeDashoffset: 0 }}
                  r="8"
                  strokeDasharray={RING}
                  strokeLinecap="round"
                  strokeWidth="1.75"
                  transition={{ duration: total, ease: "linear" }}
                />
              </svg>
              <span className="relative overflow-hidden font-mono text-[10.5px] tabular-nums">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    animate={{ y: 0, opacity: 1 }}
                    className="block"
                    exit={{ y: -6, opacity: 0 }}
                    initial={{ y: 6, opacity: 0 }}
                    key={left}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                  >
                    {left}
                  </motion.span>
                </AnimatePresence>
              </span>
            </span>
            Sending
          </motion.span>
        ) : (
          <motion.span
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="send"
            transition={{ duration: 0.15 }}
          >
            Send
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

/** Eases the card to its content's height when the content swaps. */
function AutoHeight({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) {
      return;
    }
    const observer = new ResizeObserver(() => setHeight(inner.offsetHeight));
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      animate={{ height }}
      className={cn("overflow-hidden", className)}
      initial={false}
      transition={{ duration: 0.4, ease: EASE_OUT }}
    >
      <div ref={innerRef}>{children}</div>
    </motion.div>
  );
}
