"use client";

import type { ReactNode } from "react";
import { CopyIconSwap, useCopy } from "@/components/landing/home/client";
import {
  CELL,
  EASE_COLORS,
  FOCUS_INSET,
  GRID,
  INK,
  LEAF,
  LINE,
  MONO,
} from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";

// The pieces docs pages are drawn with, the same way the component plates
// and the changelog are: square cells on one hairline, mono for anything you
// type, and a whole row to click when the row is something to copy.

/** A stack of cells sharing one hairline. */
export function Plate({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "not-prose my-6 grid grid-cols-1 border",
        GRID,
        LINE,
        className
      )}
    >
      {children}
    </div>
  );
}

export const TAB = cn(
  MONO,
  "inline-flex h-8 items-center gap-1.5 px-3 text-[12px] text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white",
  EASE_COLORS,
  FOCUS_INSET
);

export const TAB_SELECTED =
  "bg-[#f4f4f4] text-black dark:bg-[#161616] dark:text-white";

/** A row of options, each a square tab split by the hairline. */
export function Picker<T extends string>({
  label,
  options,
  value,
  onChange,
  aside,
  grid = false,
}: {
  /** Two columns on phones, one row from `sm` up, for longer labels. */
  grid?: boolean;
  label: string;
  options: readonly { id: T; label?: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  aside?: ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-stretch justify-between", CELL)}>
      <fieldset
        className={cn(
          "m-0 flex min-w-0 flex-wrap border-0 p-0",
          grid && cn("grid w-full grid-cols-2 sm:flex sm:w-auto sm:gap-0", GRID)
        )}
      >
        <legend className="sr-only">{label}</legend>
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              aria-pressed={selected}
              className={cn(
                TAB,
                LINE,
                grid ? cn(CELL, "sm:border-r") : "border-r",
                selected && TAB_SELECTED
              )}
              key={option.id}
              onClick={() => onChange(option.id)}
              type="button"
            >
              {option.label ?? option.id}
            </button>
          );
        })}
      </fieldset>
      {aside ? <div className="flex items-stretch">{aside}</div> : null}
    </div>
  );
}

/** One line to copy; the whole row is the button. */
export function CopyRow({
  value,
  prefix = "$",
  label,
}: {
  value: string;
  prefix?: ReactNode;
  label?: string;
}) {
  const { copied, copy } = useCopy();
  return (
    <button
      aria-label={copied ? "Copied" : `Copy ${label ?? value}`}
      className={cn(
        "group flex w-full min-w-0 items-start gap-2.5 px-3 py-3 text-left text-[13px] leading-[1.6] hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
        MONO,
        INK,
        CELL,
        EASE_COLORS,
        FOCUS_INSET
      )}
      onClick={() => copy(value)}
      type="button"
    >
      {prefix ? (
        <span aria-hidden className={LEAF}>
          {prefix}
        </span>
      ) : null}
      <span className="wrap-anywhere min-w-0 flex-1">{value}</span>
      <CopyIconSwap
        className="mt-[3px] text-black/40 group-hover:text-black dark:text-white/40 dark:group-hover:text-white"
        copied={copied}
      />
    </button>
  );
}

/** A file's worth of text under a header naming it, copied from the header. */
export function CopyFile({
  file,
  content,
}: {
  file: ReactNode;
  content: string;
}) {
  const { copied, copy } = useCopy();
  return (
    <div className={cn("grid grid-cols-1", GRID)}>
      <div className={cn("flex items-stretch justify-between", CELL)}>
        <span className={cn(TAB, "pointer-events-none text-black/50")}>
          {file}
        </span>
        <button
          aria-label={copied ? "Copied" : "Copy file contents"}
          className={cn(TAB, "group border-l", LINE)}
          onClick={() => copy(content)}
          type="button"
        >
          <CopyIconSwap
            className="text-black/40 group-hover:text-black dark:text-white/40 dark:group-hover:text-white"
            copied={copied}
          />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className={cn(
          "overflow-x-auto px-4 py-3.5 text-[12.5px] leading-[1.65]",
          MONO,
          INK,
          CELL
        )}
      >
        {content}
      </pre>
    </div>
  );
}
