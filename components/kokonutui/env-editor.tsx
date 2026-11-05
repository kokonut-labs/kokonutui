"use client";

/**
 * @author: @kokonutui
 * @description: Env Editor
 * @version: 1.0.0
 * @date: 2026-11-05
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, Eye, EyeOff, Plus, Undo2, X } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  type ClipboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface EnvVar {
  key: string;
  value: string;
}

export interface EnvEditorProps {
  title?: string;
  defaultVariables?: EnvVar[];
  /** Called with the full list when the reader saves. */
  onSave?: (variables: EnvVar[]) => void;
  className?: string;
}

interface Row {
  id: number;
  key: string;
  value: string;
  /** What was saved last; null for a row added since. */
  saved: EnvVar | null;
  removed: boolean;
  revealed: boolean;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const KEY_PATTERN = /^[A-Z_][A-Z0-9_]*$/;
const SECRET_KEY = /SECRET|TOKEN|PASSWORD|PRIVATE|_KEY$|^DATABASE_URL$/;
const LINE = /^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*)\s*$/;
const QUOTED = /^(["'])(.*)\1$/;
const NEWLINE = /\r?\n/;
const MASK = "••••••••••••";

const DEMO: EnvVar[] = [
  {
    key: "DATABASE_URL",
    value: "postgres://shop:p4ss@db.internal:5432/shop",
  },
  { key: "STRIPE_SECRET_KEY", value: "sk_test_51Nx8QbK2vR7wPc0" },
  { key: "NEXT_PUBLIC_SITE_URL", value: "https://acme.shop" },
  { key: "RESEND_API_KEY", value: "re_8f2c1a9e_Lk3vQ" },
  { key: "LOG_LEVEL", value: "info" },
];

let nextId = 0;
const makeRow = (variable: EnvVar, saved: boolean): Row => {
  nextId += 1;
  return {
    id: nextId,
    key: variable.key,
    value: variable.value,
    saved: saved ? variable : null,
    removed: false,
    revealed: false,
  };
};

/** `KEY=value` lines from a pasted .env file; comments and blanks skipped. */
function parseEnv(text: string): EnvVar[] {
  const variables: EnvVar[] = [];
  for (const raw of text.split(NEWLINE)) {
    if (!raw.trim() || raw.trim().startsWith("#")) {
      continue;
    }
    const match = raw.match(LINE);
    if (match) {
      const quoted = match[2].match(QUOTED);
      variables.push({ key: match[1], value: quoted ? quoted[2] : match[2] });
    }
  }
  return variables;
}

type Change = "added" | "changed" | "removed" | null;

function changeOf(row: Row): Change {
  if (row.removed) {
    return "removed";
  }
  if (!row.saved) {
    return row.key || row.value ? "added" : null;
  }
  return row.key !== row.saved.key || row.value !== row.saved.value
    ? "changed"
    : null;
}

const GUTTER: Record<Exclude<Change, null>, string> = {
  added: "bg-emerald-500",
  changed: "bg-sky-500",
  removed: "bg-red-500",
};

export default function EnvEditor({
  title = "Environment Variables",
  defaultVariables = DEMO,
  onSave,
  className,
}: EnvEditorProps) {
  const id = useId();
  const [rows, setRows] = useState<Row[]>(() =>
    defaultVariables.map((v) => makeRow(v, true))
  );
  const [flash, setFlash] = useState<number[]>([]);
  const [savedAt, setSavedAt] = useState(0);
  /** A field to focus once it renders: a new row's key, a revealed value. */
  const focusNext = useRef<string | null>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const register = (name: string) => (el: HTMLInputElement | null) => {
    if (el) {
      inputs.current.set(name, el);
    } else {
      inputs.current.delete(name);
    }
  };

  useEffect(() => {
    if (focusNext.current !== null) {
      inputs.current.get(focusNext.current)?.focus();
      focusNext.current = null;
    }
  });

  useEffect(() => {
    if (!flash.length) {
      return;
    }
    const clear = setTimeout(() => setFlash([]), 1200);
    return () => clearTimeout(clear);
  }, [flash]);

  useEffect(() => {
    if (!savedAt) {
      return;
    }
    const clear = setTimeout(() => setSavedAt(0), 1600);
    return () => clearTimeout(clear);
  }, [savedAt]);

  const changes = rows.filter((row) => changeOf(row) !== null).length;

  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    for (const row of rows) {
      if (row.key && !row.removed) {
        seen.set(row.key, (seen.get(row.key) ?? 0) + 1);
      }
    }
    return new Set([...seen].filter(([, n]) => n > 1).map(([key]) => key));
  }, [rows]);

  const problemOf = (row: Row) => {
    if (row.removed || !row.key) {
      return null;
    }
    if (!KEY_PATTERN.test(row.key)) {
      return "Use A–Z, 0–9 and _, not starting with a digit";
    }
    if (duplicates.has(row.key)) {
      return "This key is already set";
    }
    return null;
  };
  const hasProblems = rows.some((row) => problemOf(row) !== null);

  const update = (rowId: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));

  const addRow = () => {
    const row = makeRow({ key: "", value: "" }, false);
    focusNext.current = `key-${row.id}`;
    setRows((rs) => [...rs, row]);
  };

  const remove = (row: Row) => {
    if (row.saved) {
      update(row.id, { removed: true, revealed: false });
    } else {
      setRows((rs) => rs.filter((r) => r.id !== row.id));
    }
  };

  // A pasted .env file becomes rows: existing keys take the new value, the
  // rest are added, and every row it touched flashes.
  const onPaste = (row: Row, event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    const parsed = text.includes("=") ? parseEnv(text) : [];
    if (parsed.length === 0) {
      return;
    }
    event.preventDefault();
    const touched: number[] = [];
    // The empty row pasted into gives way to the pasted ones.
    let next = rows.filter(
      (r) => !(r.id === row.id && !r.saved && !r.key && !r.value)
    );
    for (const variable of parsed) {
      const existing = next.find((r) => r.key === variable.key && !r.removed);
      if (existing) {
        touched.push(existing.id);
        next = next.map((r) =>
          r.id === existing.id ? { ...r, value: variable.value } : r
        );
      } else {
        const added = makeRow(variable, false);
        touched.push(added.id);
        next = [...next, added];
      }
    }
    setRows(next);
    setFlash(touched);
  };

  const discard = () =>
    setRows((rs) =>
      rs
        .filter((r) => r.saved)
        .map((r) => ({
          ...r,
          key: r.saved?.key ?? r.key,
          value: r.saved?.value ?? r.value,
          removed: false,
        }))
    );

  const save = () => {
    const kept = rows.filter((r) => !r.removed && (r.key || r.value));
    const variables = kept.map((r) => ({ key: r.key, value: r.value }));
    setRows(kept.map((r) => ({ ...r, saved: { key: r.key, value: r.value } })));
    setSavedAt(Date.now());
    onSave?.(variables);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
      >
        <div className="flex items-center gap-2 px-4 pt-3.5 pb-1">
          <h3 className="font-medium text-[13px]">{title}</h3>
          <span className="font-mono text-[11.5px] text-zinc-400 tabular-nums dark:text-zinc-500">
            {rows.filter((r) => !r.removed).length}
          </span>
        </div>
        <p className="px-4 text-[12px] text-zinc-500 dark:text-zinc-400">
          Paste a .env file into any field to add many at once.
        </p>

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3.5rem] gap-x-2 px-4 pb-1.5 text-[11px] text-zinc-400 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_3.5rem] dark:text-zinc-500">
          <span className="pl-3">Key</span>
          <span>Value</span>
        </div>

        <ul aria-label="Variables" className="px-2 pb-2">
          <AnimatePresence initial={false}>
            {rows.map((row) => (
              <VarRow
                flashing={flash.includes(row.id)}
                key={row.id}
                onPaste={(e) => onPaste(row, e)}
                onRemove={() => remove(row)}
                onReveal={() => {
                  // Revealing a secret moves focus straight into it.
                  focusNext.current = `value-${row.id}`;
                  update(row.id, { revealed: true });
                }}
                onUpdate={(patch) => update(row.id, patch)}
                problem={problemOf(row)}
                problemId={`${id}-${row.id}-problem`}
                register={register}
                row={row}
              />
            ))}
          </AnimatePresence>
        </ul>

        <div className="px-4 pb-3">
          <button
            className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] text-zinc-500 outline-hidden transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            onClick={addRow}
            type="button"
          >
            <Plus aria-hidden="true" className="size-3.5" />
            Add variable
          </button>
        </div>

        <AnimatePresence initial={false}>
          {(changes > 0 || savedAt > 0) && (
            <motion.div
              animate={{ height: "auto" }}
              className="overflow-hidden"
              exit={{ height: 0 }}
              initial={{ height: 0 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
            >
              <div className="flex h-12 items-center gap-2 border-zinc-200 border-t bg-zinc-50 px-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                <AnimatePresence initial={false} mode="popLayout">
                  {changes > 0 ? (
                    <motion.span
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[12.5px] text-zinc-600 tabular-nums dark:text-zinc-400"
                      exit={{ opacity: 0, y: -4 }}
                      initial={{ opacity: 0, y: 4 }}
                      key="count"
                    >
                      {changes} unsaved {changes === 1 ? "change" : "changes"}
                    </motion.span>
                  ) : (
                    <motion.span
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-1.5 text-[12.5px] text-emerald-700 dark:text-emerald-400"
                      initial={{ opacity: 0, y: 4 }}
                      key="saved"
                    >
                      <Check aria-hidden="true" className="size-3.5" />
                      Saved. Redeploy to apply.
                    </motion.span>
                  )}
                </AnimatePresence>
                {changes > 0 && (
                  <span className="ml-auto flex items-center gap-1.5">
                    <button
                      className="h-7 rounded-md px-2.5 text-[12.5px] text-zinc-600 outline-hidden transition-colors duration-150 hover:bg-zinc-200/70 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      onClick={discard}
                      type="button"
                    >
                      Discard
                    </button>
                    <button
                      className="h-7 rounded-md bg-zinc-900 px-3 font-medium text-[12.5px] text-white outline-hidden transition-colors duration-150 hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400/50 disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:disabled:bg-zinc-700 dark:hover:bg-zinc-300"
                      disabled={hasProblems}
                      onClick={save}
                      type="button"
                    >
                      Save
                    </button>
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

interface VarRowProps {
  row: Row;
  problem: string | null;
  problemId: string;
  flashing: boolean;
  register: (name: string) => (el: HTMLInputElement | null) => void;
  onUpdate: (patch: Partial<Row>) => void;
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
  onReveal: () => void;
  onRemove: () => void;
}

function VarRow({
  row,
  problem,
  problemId,
  flashing,
  register,
  onUpdate,
  onPaste,
  onReveal,
  onRemove,
}: VarRowProps) {
  const change = changeOf(row);
  const secret = SECRET_KEY.test(row.key);
  const masked = secret && !row.revealed && !!row.value;
  return (
    <motion.li
      animate={{ height: "auto", opacity: 1 }}
      className="relative overflow-hidden"
      exit={{ height: 0, opacity: 0 }}
      initial={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
    >
      <div
        className={cn(
          "relative grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3.5rem] items-center gap-x-2 rounded-lg py-1 pr-1 pl-2 transition-colors duration-500 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_3.5rem]",
          flashing && "bg-emerald-500/[0.07] duration-0"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1/2 left-0.5 h-4 w-[3px] -translate-y-1/2 rounded-full transition-opacity duration-200",
            change ? GUTTER[change] : "opacity-0"
          )}
        />
        <input
          aria-describedby={problem ? problemId : undefined}
          aria-invalid={problem ? true : undefined}
          aria-label="Key"
          autoComplete="off"
          className={cn(
            "h-8 w-full min-w-0 rounded-md border border-transparent bg-zinc-50 px-2 font-mono text-[12.5px] outline-hidden transition-colors duration-150 placeholder:text-zinc-400 hover:border-zinc-200 focus:border-zinc-300 focus:bg-white dark:bg-zinc-900 dark:focus:border-zinc-700 dark:focus:bg-zinc-950 dark:hover:border-zinc-800 dark:placeholder:text-zinc-600",
            row.removed && "text-zinc-400 line-through dark:text-zinc-600",
            problem &&
              "border-red-300 text-red-600 hover:border-red-300 focus:border-red-400 dark:border-red-500/50 dark:text-red-400"
          )}
          disabled={row.removed}
          onChange={(e) =>
            onUpdate({
              key: e.target.value.toUpperCase().replace(" ", "_"),
            })
          }
          onPaste={onPaste}
          placeholder="NEW_KEY"
          ref={register(`key-${row.id}`)}
          spellCheck={false}
          value={row.key}
        />
        <div className="relative min-w-0">
          {masked ? (
            <button
              aria-label={`Show and edit ${row.key || "value"}`}
              className="flex h-8 w-full items-center rounded-md border border-transparent bg-zinc-50 px-2 text-left font-mono text-[12.5px] text-zinc-400 tracking-wider outline-hidden transition-colors duration-150 hover:border-zinc-200 hover:text-zinc-600 focus-visible:border-zinc-300 dark:bg-zinc-900 dark:text-zinc-500 dark:hover:border-zinc-800 dark:hover:text-zinc-300"
              disabled={row.removed}
              onClick={onReveal}
              type="button"
            >
              <span className={cn(row.removed && "line-through")}>{MASK}</span>
            </button>
          ) : (
            <input
              aria-label={`Value of ${row.key || "new key"}`}
              autoComplete="off"
              className={cn(
                "h-8 w-full min-w-0 rounded-md border border-transparent bg-zinc-50 px-2 font-mono text-[12.5px] outline-hidden transition-colors duration-150 placeholder:text-zinc-400 hover:border-zinc-200 focus:border-zinc-300 focus:bg-white dark:bg-zinc-900 dark:focus:border-zinc-700 dark:focus:bg-zinc-950 dark:hover:border-zinc-800 dark:placeholder:text-zinc-600",
                row.removed && "text-zinc-400 line-through dark:text-zinc-600"
              )}
              disabled={row.removed}
              onBlur={() => secret && onUpdate({ revealed: false })}
              onChange={(e) => onUpdate({ value: e.target.value })}
              onPaste={onPaste}
              placeholder="value"
              ref={register(`value-${row.id}`)}
              spellCheck={false}
              value={row.value}
            />
          )}
        </div>
        <div className="flex items-center justify-end">
          {secret && !row.removed && (
            <IconButton
              label={row.revealed ? "Hide value" : "Show value"}
              onClick={() => onUpdate({ revealed: !row.revealed })}
            >
              {row.revealed ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </IconButton>
          )}
          {row.removed ? (
            <IconButton
              label={`Keep ${row.key}`}
              onClick={() => onUpdate({ removed: false })}
            >
              <Undo2 className="size-3.5" />
            </IconButton>
          ) : (
            <IconButton label={`Remove ${row.key || "row"}`} onClick={onRemove}>
              <X className="size-3.5" />
            </IconButton>
          )}
        </div>
      </div>
      {problem && (
        <p
          className="pb-1 pl-3 text-[11.5px] text-red-600 dark:text-red-400"
          id={problemId}
        >
          {problem}
        </p>
      )}
    </motion.li>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className="flex size-7 items-center justify-center rounded-md text-zinc-400 outline-hidden transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}
