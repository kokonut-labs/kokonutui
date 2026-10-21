"use client";

/**
 * @author: @kokonutui
 * @description: AI Extract
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, Mail, RotateCcw, ScanText } from "lucide-react";
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface ExtractField {
  id: string;
  label: string;
  /** What the model pulled out. Leave empty when it found nothing. */
  value: string;
  /** From 0 to 1. Below `checkBelow` the field asks to be confirmed. */
  confidence: number;
  /** Why the model is unsure, shown under an unconfirmed field. */
  note?: string;
  align?: "left" | "right";
}

/** Plain text, or the words a field was read from. */
export type SourcePiece = string | { field: string; text: string };

export interface AIExtractProps {
  title?: string;
  from?: string;
  subject?: string;
  /** The message body. Use `\n\n` inside a string for a new paragraph. */
  source?: SourcePiece[];
  fields?: ExtractField[];
  checkBelow?: number;
  submitLabel?: string;
  onSubmit?: (values: Record<string, string>) => void;
  className?: string;
}

type Status = "waiting" | "reading" | "done";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const MARK_MS = 320;
const PARAGRAPH = /\n{2,}/;

const DEMO_FIELDS: ExtractField[] = [
  {
    id: "vendor",
    label: "Vendor",
    value: "Northwind Studio AB",
    confidence: 0.97,
  },
  { id: "invoice", label: "Invoice no.", value: "NW-2291", confidence: 0.99 },
  {
    id: "amount",
    label: "Amount",
    value: "€4,280.00",
    confidence: 0.95,
    align: "right",
  },
  {
    id: "due",
    label: "Due date",
    value: "Nov 13, 2026",
    confidence: 0.64,
    note: "Worked out as 30 days after Oct 14",
  },
  {
    id: "po",
    label: "PO number",
    value: "4471-B",
    confidence: 0.71,
    note: "Could be a project code, not a PO",
  },
  {
    id: "contact",
    label: "Contact",
    value: "Mara Lindqvist",
    confidence: 0.93,
  },
  { id: "phone", label: "Phone", value: "+46 70 123 45 67", confidence: 0.9 },
  {
    id: "email",
    label: "Billing email",
    value: "billing@northwind-studio.com",
    confidence: 0.98,
  },
];

const DEMO_SOURCE: SourcePiece[] = [
  "Hi Jonas,\n\nAttached is invoice ",
  { field: "invoice", text: "NW-2291" },
  " for the brand refresh we wrapped up in October. The total comes to ",
  { field: "amount", text: "€4,280.00" },
  ", VAT included.\n\nAs agreed, payment is due ",
  { field: "due", text: "30 days from the invoice date (Oct 14)" },
  ". You can reference ",
  { field: "po", text: "4471-B" },
  " on your side so finance can match it.\n\nAny questions, just reply here or call me on ",
  { field: "phone", text: "+46 70 123 45 67" },
  ".\n\nThanks,\n",
  { field: "contact", text: "Mara Lindqvist" },
  "\n",
  { field: "vendor", text: "Northwind Studio AB" },
];

/** Splits pieces into paragraphs so the email keeps its spacing. */
const paragraphs = (pieces: SourcePiece[]) => {
  const out: SourcePiece[][] = [[]];
  for (const piece of pieces) {
    if (typeof piece !== "string") {
      out.at(-1)?.push(piece);
      continue;
    }
    const parts = piece.split(PARAGRAPH);
    for (const [i, part] of parts.entries()) {
      if (i > 0) {
        out.push([]);
      }
      if (part) {
        out.at(-1)?.push(part);
      }
    }
  }
  return out;
};

export default function AIExtract({
  title = "New bill from email",
  from = "billing@northwind-studio.com",
  subject = "Invoice NW-2291 for October work",
  source = DEMO_SOURCE,
  fields = DEMO_FIELDS,
  checkBelow = 0.8,
  submitLabel = "Create bill",
  onSubmit,
  className,
}: AIExtractProps) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);

  // Fields fill in the order their words appear in the email.
  const order = useMemo(() => {
    const seen = new Set<string>();
    if (fields.some((f) => f.id === "email")) {
      seen.add("email");
    }
    for (const piece of source) {
      if (typeof piece !== "string") {
        seen.add(piece.field);
      }
    }
    for (const f of fields) {
      seen.add(f.id);
    }
    return [...seen].filter((id) => fields.some((f) => f.id === id));
  }, [fields, source]);

  const [run, setRun] = useState(0);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [chars, setChars] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const reading = started && step < order.length;
  const currentId = reading ? order[step] : null;
  const currentValue = fields.find((f) => f.id === currentId)?.value ?? "";

  // Start once the card is on screen.
  useEffect(() => {
    if (started) {
      return;
    }
    const el = rootRef.current;
    if (!el) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setStarted(true);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  // Mark the words in the email, then type the value into its field.
  useEffect(() => {
    if (!(reading && currentId)) {
      return;
    }
    if (reduceMotion) {
      setValues(Object.fromEntries(fields.map((f) => [f.id, f.value])));
      setStep(order.length);
      return;
    }
    if (chars >= currentValue.length) {
      const id = setTimeout(() => {
        setValues((v) => ({ ...v, [currentId]: currentValue }));
        setStep((s) => s + 1);
        setChars(0);
      }, 90);
      return () => clearTimeout(id);
    }
    const id = setTimeout(
      () => setChars((c) => c + 1),
      chars === 0 ? MARK_MS : 22
    );
    return () => clearTimeout(id);
  }, [reading, currentId, currentValue, chars, fields, order, reduceMotion]);

  const statusOf = (id: string): Status => {
    const at = order.indexOf(id);
    if (!started || at > step) {
      return "waiting";
    }
    return at === step && reading ? "reading" : "done";
  };

  const unsure = fields.filter(
    (f) =>
      f.value &&
      f.confidence < checkBelow &&
      !confirmed.has(f.id) &&
      statusOf(f.id) === "done"
  );
  const found = fields.filter((f) => f.value && statusOf(f.id) === "done");

  const restart = () => {
    setValues({});
    setConfirmed(new Set());
    setSubmitted(false);
    setStep(0);
    setChars(0);
    setRun((r) => r + 1);
    setStarted(true);
  };

  const confirm = (id: string) => setConfirmed((c) => new Set(c).add(id));

  let footerText = "Waiting to read";
  if (reading) {
    footerText = "Reading the email…";
  } else if (started) {
    footerText =
      unsure.length > 0
        ? `${found.length} fields found · ${unsure.length} to check`
        : `${found.length} fields found`;
  }

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "@container w-full max-w-3xl rounded-2xl bg-white ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10",
          className
        )}
        ref={rootRef}
      >
        <header className="flex items-center gap-2 border-black/[0.06] border-b py-2.5 pr-2.5 pl-5 dark:border-white/[0.08]">
          <ScanText
            aria-hidden="true"
            className="size-3.5 text-zinc-400 dark:text-zinc-500"
          />
          <h3 className="min-w-0 flex-1 truncate font-medium text-[13px] text-zinc-900 dark:text-zinc-100">
            {title}
          </h3>
          <button
            className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] text-zinc-600 transition-colors duration-100 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-white/[0.07] dark:hover:text-white"
            disabled={reading}
            onClick={restart}
            type="button"
          >
            <RotateCcw aria-hidden="true" className="size-3" />
            Read again
          </button>
        </header>

        <div className="grid @xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section
            aria-label="Source email"
            className="border-black/[0.06] @xl:border-r border-b @xl:border-b-0 px-5 py-4 dark:border-white/[0.08]"
          >
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <Mail aria-hidden="true" className="size-3.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-[13px] text-zinc-900 dark:text-zinc-100">
                  {subject}
                </p>
                <p className="truncate text-[12px] text-zinc-500 dark:text-zinc-400">
                  <SourceMark
                    active={active === "email"}
                    field="email"
                    onActive={setActive}
                    status={statusOf("email")}
                    unsure={false}
                  >
                    {from}
                  </SourceMark>
                </p>
              </div>
            </div>
            <div className="space-y-2.5 text-[13px] text-zinc-600 leading-6 dark:text-zinc-300">
              {paragraphs(source).map((para) => (
                <p
                  className="whitespace-pre-line"
                  key={para
                    .map((p) => (typeof p === "string" ? p : p.field))
                    .join("|")}
                >
                  {para.map((piece) => {
                    if (typeof piece === "string") {
                      return piece;
                    }
                    const field = fields.find((f) => f.id === piece.field);
                    return (
                      <SourceMark
                        active={active === piece.field}
                        field={piece.field}
                        key={piece.field}
                        onActive={setActive}
                        status={statusOf(piece.field)}
                        unsure={Boolean(
                          field &&
                            field.confidence < checkBelow &&
                            !confirmed.has(field.id)
                        )}
                      >
                        {piece.text}
                      </SourceMark>
                    );
                  })}
                </p>
              ))}
            </div>
          </section>

          <section
            aria-label="Extracted fields"
            className="flex flex-col px-2 py-2"
            key={run}
          >
            {fields.map((field) => {
              const status = statusOf(field.id);
              const typed =
                status === "reading"
                  ? field.value.slice(0, chars)
                  : (values[field.id] ?? "");
              return (
                <FieldRow
                  active={active === field.id}
                  field={field}
                  key={field.id}
                  onActive={setActive}
                  onChange={(value) =>
                    setValues((v) => ({ ...v, [field.id]: value }))
                  }
                  onConfirm={() => confirm(field.id)}
                  status={status}
                  unsure={
                    field.confidence < checkBelow &&
                    !confirmed.has(field.id) &&
                    Boolean(field.value)
                  }
                  value={typed}
                />
              );
            })}
          </section>
        </div>

        <footer className="flex min-h-12 items-center gap-3 border-black/[0.06] border-t py-2 pr-2.5 pl-5 dark:border-white/[0.08]">
          <p
            aria-live="polite"
            className="min-w-0 flex-1 truncate text-[12px] text-zinc-500 dark:text-zinc-400"
          >
            {footerText}
          </p>
          <button
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 font-medium text-[12px] transition-colors duration-150 disabled:cursor-not-allowed",
              submitted
                ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                : "bg-zinc-900 text-white hover:bg-zinc-700 disabled:bg-zinc-900/30 dark:bg-white dark:text-zinc-900 dark:disabled:bg-white/25 dark:hover:bg-zinc-200"
            )}
            disabled={!started || reading || unsure.length > 0 || submitted}
            onClick={() => {
              setSubmitted(true);
              onSubmit?.(values);
            }}
            title={
              unsure.length > 0 ? "Confirm the flagged fields first" : undefined
            }
            type="button"
          >
            {submitted && <Check aria-hidden="true" className="size-3.5" />}
            {submitted ? "Bill created" : submitLabel}
          </button>
        </footer>
      </div>
    </MotionConfig>
  );
}

function SourceMark({
  field,
  status,
  active,
  unsure,
  onActive,
  children,
}: {
  field: string;
  status: Status;
  active: boolean;
  unsure: boolean;
  onActive: (id: string | null) => void;
  children: string;
}) {
  const shown = status !== "waiting";
  return (
    <mark
      className={cn(
        "rounded-[3px] bg-transparent bg-no-repeat text-inherit transition-[background-size,background-color,color] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] [box-decoration-break:clone]",
        unsure
          ? "bg-linear-to-r from-orange-500/15 to-orange-500/15 dark:from-orange-400/20 dark:to-orange-400/20"
          : "bg-linear-to-r from-sky-500/[0.13] to-sky-500/[0.13] dark:from-sky-400/[0.16] dark:to-sky-400/[0.16]",
        shown ? "bg-size-[100%_100%]" : "bg-size-[0%_100%]",
        active &&
          (unsure
            ? "bg-orange-500/15 text-orange-950 dark:text-orange-100"
            : "bg-sky-500/15 text-sky-950 dark:text-sky-100")
      )}
      data-field={field}
      onPointerEnter={() => shown && onActive(field)}
      onPointerLeave={() => onActive(null)}
    >
      {children}
    </mark>
  );
}

function FieldRow({
  field,
  value,
  status,
  active,
  unsure,
  onActive,
  onChange,
  onConfirm,
}: {
  field: ExtractField;
  value: string;
  status: Status;
  active: boolean;
  unsure: boolean;
  onActive: (id: string | null) => void;
  onChange: (value: string) => void;
  onConfirm: () => void;
}) {
  const id = `extract-${field.id}`;
  const done = status === "done";
  const flagged = done && unsure;
  const missing = done && !field.value;

  return (
    <div
      className={cn(
        "rounded-lg px-3 py-1 transition-colors duration-150",
        active && !flagged && "bg-sky-500/[0.07] dark:bg-sky-400/[0.08]",
        flagged && "bg-orange-500/[0.06] dark:bg-orange-400/[0.07]"
      )}
      onPointerEnter={() => done && onActive(field.id)}
      onPointerLeave={() => onActive(null)}
    >
      <div className="flex h-8 items-center gap-3">
        <label
          className="flex w-[5.25rem] shrink-0 items-center gap-1.5 truncate text-[12px] text-zinc-500 dark:text-zinc-400"
          htmlFor={id}
        >
          {field.label}
          {flagged && (
            <span
              aria-label="Needs a check"
              className="size-1.5 shrink-0 rounded-full bg-orange-500"
              role="img"
            />
          )}
        </label>
        {status === "waiting" ? (
          <span
            aria-hidden="true"
            className="h-2 w-1/3 rounded-full bg-zinc-200/80 dark:bg-zinc-700/60"
          />
        ) : (
          <input
            aria-describedby={flagged ? `${id}-note` : undefined}
            className={cn(
              "h-7 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-[13px] text-zinc-900 outline-hidden transition-[box-shadow] duration-150 placeholder:text-zinc-400 focus:ring-1 focus:ring-zinc-900/15 dark:text-zinc-100 dark:focus:ring-white/20 dark:placeholder:text-zinc-500",
              field.align === "right" && "tabular-nums",
              status === "reading" && "text-zinc-500 dark:text-zinc-400"
            )}
            id={id}
            onBlur={() => onActive(null)}
            onChange={(event) => onChange(event.target.value)}
            onFocus={() => done && onActive(field.id)}
            placeholder={missing ? "Not found, add it" : undefined}
            readOnly={!done}
            value={value}
          />
        )}
      </div>
      {flagged && (
        <motion.div
          animate={{ opacity: 1, height: "auto" }}
          className="overflow-hidden"
          initial={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
        >
          <div className="flex items-start gap-2 pb-1 pl-[5.75rem]">
            <p
              className="min-w-0 flex-1 pt-1 text-[11px] text-orange-800/80 leading-4 dark:text-orange-200/70"
              id={`${id}-note`}
            >
              {field.note ?? "The model is not sure about this one."}
            </p>
            <button
              aria-label={`Confirm ${field.label}`}
              className="-mr-1.5 flex h-6 shrink-0 items-center gap-1 rounded-md px-2 font-medium text-[11px] text-zinc-800 transition-colors duration-100 hover:bg-zinc-900/[0.06] dark:text-zinc-100 dark:hover:bg-white/10"
              onClick={onConfirm}
              type="button"
            >
              <Check aria-hidden="true" className="size-3" />
              Confirm
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
