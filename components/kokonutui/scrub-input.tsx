"use client";

/**
 * @author: @dorianbaffier
 * @description: Scrub Input
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// Pointer travel (px) before a press on the label counts as a scrub, so a
// plain click still focuses the field.
const DRAG_THRESHOLD = 3;
// How far (px) the field gives when you scrub past min or max.
const MAX_STRETCH = 5;
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const TOKEN = /\s*(\d+\.?\d*|\.\d+|[()+\-*/])/y;

function decimalsOf(step: number) {
  const text = String(step);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

/**
 * Reads what was typed as arithmetic, so "120*2" or "48 + 16" work the way
 * they do in design tools. No eval: + - * / and brackets, nothing else.
 */
function evaluate(input: string): number | null {
  const tokens: string[] = [];
  TOKEN.lastIndex = 0;
  const source = input.replace(/,/g, ".").trim();
  while (TOKEN.lastIndex < source.length) {
    const start = TOKEN.lastIndex;
    const match = TOKEN.exec(source);
    if (!match || TOKEN.lastIndex === start) {
      return null;
    }
    tokens.push(match[1]);
  }
  let i = 0;
  const peek = () => tokens[i];
  const factor = (): number | null => {
    const token = tokens[i++];
    if (token === "-") {
      const inner = factor();
      return inner === null ? null : -inner;
    }
    if (token === "(") {
      const inner = sum();
      return tokens[i++] === ")" ? inner : null;
    }
    const n = Number(token);
    return Number.isFinite(n) ? n : null;
  };
  const product = (): number | null => {
    let left = factor();
    while (left !== null && (peek() === "*" || peek() === "/")) {
      const op = tokens[i++];
      const right = factor();
      if (right === null) {
        return null;
      }
      left = op === "*" ? left * right : left / right;
    }
    return left;
  };
  const sum = (): number | null => {
    let left = product();
    while (left !== null && (peek() === "+" || peek() === "-")) {
      const op = tokens[i++];
      const right = product();
      if (right === null) {
        return null;
      }
      left = op === "+" ? left + right : left - right;
    }
    return left;
  };
  if (!tokens.length) {
    return null;
  }
  const result = sum();
  return i === tokens.length && result !== null && Number.isFinite(result)
    ? result
    : null;
}

export interface ScrubInputProps {
  /** Shown at the start of the field. Drag it to change the value. */
  label: ReactNode;
  /** Read out for screen readers when the label is an icon or a letter. */
  name?: string;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Shown after the number, like px, %, or °. */
  unit?: string;
  /** Runs past max back to min, for angles. Needs min and max. */
  wrap?: boolean;
  /** Value change per pixel dragged. Defaults to half a step. */
  sensitivity?: number;
  disabled?: boolean;
  className?: string;
}

export default function ScrubInput({
  label,
  name,
  value: valueProp,
  defaultValue = 0,
  onChange,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  unit,
  wrap = false,
  sensitivity,
  disabled = false,
  className,
}: ScrubInputProps) {
  const [internal, setInternal] = useState(defaultValue);
  const value = valueProp ?? internal;
  const [draft, setDraft] = useState<string | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const inputId = useId();

  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drag = useRef({
    pointerId: -1,
    startX: 0,
    anchorX: 0,
    anchorValue: 0,
    moved: false,
    modifier: 1,
    stretch: 0,
  });

  const bounded = Number.isFinite(min) && Number.isFinite(max);
  const decimals = decimalsOf(step);
  const perPx = sensitivity ?? step / 2;

  const format = (n: number, extra = 0) => {
    const fixed = n.toFixed(decimals + extra);
    // Fine steps can add a decimal; drop it again when it's a zero.
    return extra ? String(Number(fixed)) : fixed;
  };

  const commit = (raw: number, precision: number) => {
    let next = raw;
    if (wrap && bounded) {
      const span = max - min;
      next = ((((next - min) % span) + span) % span) + min;
    } else {
      next = Math.min(max, Math.max(min, next));
    }
    next = Number((Math.round(next / precision) * precision).toFixed(10));
    if (next !== value) {
      if (valueProp === undefined) {
        setInternal(next);
      }
      onChange?.(next);
    }
    return next;
  };

  const nudge = () => {
    fieldRef.current?.animate?.(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(3px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 200, easing: EASE_OUT }
    );
  };

  const setStretch = (px: number) => {
    const d = drag.current;
    d.stretch = px;
    const field = fieldRef.current;
    if (!field) {
      return;
    }
    field.style.transition = px === 0 ? `transform 220ms ${EASE_OUT}` : "";
    field.style.transform = px === 0 ? "" : `translateX(${px.toFixed(2)}px)`;
  };

  // Restores the page cursor if the component goes away mid-scrub.
  useEffect(
    () => () => {
      document.documentElement.style.removeProperty("cursor");
      document.documentElement.style.removeProperty("user-select");
    },
    []
  );

  const modifierOf = (event: { shiftKey: boolean; altKey: boolean }) => {
    if (event.shiftKey) {
      return 10;
    }
    return event.altKey ? 0.1 : 1;
  };

  const handlePointerDown = (event: PointerEvent<HTMLLabelElement>) => {
    if (disabled || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const d = drag.current;
    d.pointerId = event.pointerId;
    d.startX = event.clientX;
    d.anchorX = event.clientX;
    d.anchorValue = value;
    d.moved = false;
    d.modifier = modifierOf(event);
  };

  const handlePointerMove = (event: PointerEvent<HTMLLabelElement>) => {
    const d = drag.current;
    if (event.pointerId !== d.pointerId) {
      return;
    }
    if (!d.moved) {
      if (Math.abs(event.clientX - d.startX) < DRAG_THRESHOLD) {
        return;
      }
      d.moved = true;
      d.anchorX = event.clientX;
      setScrubbing(true);
      setDraft(null);
      inputRef.current?.blur();
      // Keeps the cursor while the pointer wanders off the label.
      document.documentElement.style.cursor = "ew-resize";
      document.documentElement.style.userSelect = "none";
    }
    const modifier = modifierOf(event);
    if (modifier !== d.modifier) {
      // Re-anchor on a modifier change, so the value doesn't jump.
      d.anchorValue = value;
      d.anchorX = event.clientX;
      d.modifier = modifier;
    }
    const raw =
      d.anchorValue + (event.clientX - d.anchorX) * perPx * d.modifier;
    const precision = step * (d.modifier < 1 ? 0.1 : 1);
    commit(raw, precision);
    if (!wrap) {
      // Past an end, the field leans that way and slows, then stops.
      const over = raw > max ? raw - max : Math.min(0, raw - min);
      const px = over / (perPx * d.modifier);
      setStretch(MAX_STRETCH * Math.tanh(px / (MAX_STRETCH * 6)));
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLLabelElement>) => {
    const d = drag.current;
    if (event.pointerId !== d.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    d.pointerId = -1;
    setScrubbing(false);
    setStretch(0);
    document.documentElement.style.removeProperty("cursor");
    document.documentElement.style.removeProperty("user-select");
  };

  // A scrub ends in a click on the label; only a plain click focuses the field.
  const handleLabelClick = (event: MouseEvent<HTMLLabelElement>) => {
    if (drag.current.moved) {
      event.preventDefault();
      drag.current.moved = false;
    }
  };

  const submit = () => {
    if (draft === null) {
      return;
    }
    const parsed = evaluate(draft);
    setDraft(null);
    if (parsed === null) {
      nudge();
      return;
    }
    commit(parsed, step / 10 ** Math.min(2, decimalsOf(parsed)));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
      inputRef.current?.select();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(null);
      inputRef.current?.blur();
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return;
    }
    event.preventDefault();
    const modifier = modifierOf(event);
    const base = draft === null ? value : (evaluate(draft) ?? value);
    const direction = event.key === "ArrowUp" ? 1 : -1;
    setDraft(null);
    commit(base + direction * step * modifier, step * (modifier < 1 ? 0.1 : 1));
    requestAnimationFrame(() => inputRef.current?.select());
  };

  const fill = bounded ? (value - min) / (max - min) : 0;
  const shown = draft ?? format(value, decimalsOf(value) > decimals ? 1 : 0);

  return (
    <div
      className={cn(
        "group/scrub relative flex h-9 w-36 items-center overflow-hidden rounded-lg border bg-white text-sm transition-[border-color,box-shadow] duration-150 ease-out focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-200 dark:bg-zinc-950 dark:focus-within:border-zinc-600 dark:focus-within:ring-zinc-800",
        scrubbing
          ? "border-zinc-400 dark:border-zinc-600"
          : "border-zinc-200 dark:border-zinc-800",
        disabled && "opacity-50",
        className
      )}
      ref={fieldRef}
    >
      {bounded ? (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-full origin-left duration-150 ease-out",
            // Follows the pointer directly while scrubbing; eases otherwise.
            scrubbing
              ? "transition-[background-color]"
              : "transition-[transform,background-color]",
            scrubbing
              ? "bg-zinc-100 dark:bg-zinc-800/80"
              : "bg-zinc-50 dark:bg-zinc-900"
          )}
          style={{ transform: `scaleX(${fill})` }}
        />
      ) : null}

      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: dragging the label is a pointer shortcut; the field takes arrow keys and typing */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the click only cancels the label's focus after a scrub */}
      <label
        className={cn(
          "relative flex h-full shrink-0 select-none items-center pr-1.5 pl-2.5 font-medium transition-colors duration-150 ease-out",
          disabled ? "cursor-not-allowed" : "cursor-ew-resize",
          scrubbing
            ? "text-zinc-900 dark:text-zinc-100"
            : "text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
        )}
        htmlFor={inputId}
        onClick={handleLabelClick}
        onLostPointerCapture={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ touchAction: "none" }}
      >
        {label}
      </label>

      <input
        aria-label={name}
        aria-valuemax={bounded ? max : undefined}
        aria-valuemin={bounded ? min : undefined}
        aria-valuenow={value}
        aria-valuetext={unit ? `${format(value)} ${unit}` : undefined}
        autoComplete="off"
        className="relative h-full min-w-0 flex-1 bg-transparent text-zinc-900 tabular-nums outline-none selection:bg-zinc-200 disabled:cursor-not-allowed dark:text-zinc-100 dark:selection:bg-zinc-700"
        disabled={disabled}
        id={inputId}
        inputMode="decimal"
        onBlur={submit}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          setDraft(event.target.value)
        }
        onFocus={(event) => event.target.select()}
        onKeyDown={handleKeyDown}
        ref={inputRef}
        role="spinbutton"
        spellCheck={false}
        type="text"
        value={shown}
      />

      {unit ? (
        <span
          aria-hidden="true"
          className="relative shrink-0 pr-2.5 pl-1 text-zinc-400 dark:text-zinc-500"
        >
          {unit}
        </span>
      ) : null}
    </div>
  );
}
