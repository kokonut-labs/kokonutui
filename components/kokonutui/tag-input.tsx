"use client";

/**
 * @author: @dorianbaffier
 * @description: Tag Input
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { X } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  type ClipboardEvent,
  type KeyboardEvent,
  type PointerEvent,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const SPLIT = /[,;\n\t]+/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Pointer travel (px) before pressing a chip turns into dragging it.
const DRAG_THRESHOLD = 4;
// Chips from one paste come in one after another, this far apart (s).
const STAGGER = 0.03;
const LAYOUT = { type: "spring", duration: 0.3, bounce: 0.15 } as const;

export interface TagInputProps {
  value?: string[];
  defaultValue?: string[];
  onChange?: (tags: string[]) => void;
  label?: string;
  placeholder?: string;
  /** `email` marks chips that aren't an email address. */
  type?: "text" | "email";
  /** Your own check; chips that fail it stay, marked invalid. */
  validate?: (tag: string) => boolean;
  max?: number;
  className?: string;
}

export default function TagInput({
  value: valueProp,
  defaultValue = [],
  onChange,
  label,
  placeholder = "Add a tag",
  type = "text",
  validate,
  max = Number.POSITIVE_INFINITY,
  className,
}: TagInputProps) {
  const [internal, setInternal] = useState(defaultValue);
  const tags = valueProp ?? internal;
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const inputId = useId();

  const inputRef = useRef<HTMLInputElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  // Entry delay per chip, for pastes.
  const delays = useRef(new Map<string, number>());
  const drag = useRef({
    pointerId: -1,
    tag: "",
    startX: 0,
    startY: 0,
    moved: false,
  });

  // Looked up by data attribute: a ref on the chips trips AnimatePresence.
  const chipOf = (tag: string) =>
    fieldRef.current?.querySelector<HTMLElement>(
      `[data-tag="${CSS.escape(tag)}"]`
    ) ?? null;

  const isValid = (tag: string) => {
    if (validate) {
      return validate(tag);
    }
    return type === "email" ? EMAIL.test(tag) : true;
  };

  const update = (next: string[]) => {
    tagsRef.current = next;
    if (valueProp === undefined) {
      setInternal(next);
    }
    onChange?.(next);
  };

  const shake = (el: HTMLElement | null | undefined) => {
    el?.animate?.(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(3px)" },
        { transform: "translateX(-2px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 260, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
    );
  };

  /** Adds each new tag; a duplicate shakes the chip that's already there. */
  const add = (raw: string[]) => {
    const current = tagsRef.current;
    const next = [...current];
    const lower = new Set(current.map((t) => t.toLowerCase()));
    let added = 0;
    for (const part of raw) {
      const tag = part.trim();
      if (!tag) {
        continue;
      }
      if (lower.has(tag.toLowerCase())) {
        const existing = next.find(
          (t) => t.toLowerCase() === tag.toLowerCase()
        );
        shake(existing ? chipOf(existing) : null);
        continue;
      }
      if (next.length >= max) {
        shake(fieldRef.current);
        break;
      }
      delays.current.set(tag, added * STAGGER);
      next.push(tag);
      lower.add(tag.toLowerCase());
      added += 1;
    }
    if (added) {
      update(next);
      setAnnouncement(
        added === 1 ? `Added ${next.at(-1)}` : `Added ${added} tags`
      );
    }
  };

  const remove = (index: number) => {
    const tag = tagsRef.current[index];
    update(tagsRef.current.filter((_, i) => i !== index));
    setSelected(null);
    setAnnouncement(`Removed ${tag}`);
  };

  const move = (from: number, to: number) => {
    const next = [...tagsRef.current];
    const [tag] = next.splice(from, 1);
    next.splice(to, 0, tag);
    update(next);
  };

  const commitText = () => {
    if (text.trim()) {
      add([text]);
    }
    setText("");
  };

  const handleChange = (raw: string) => {
    setSelected(null);
    if (!SPLIT.test(raw)) {
      setText(raw);
      return;
    }
    // Typing a comma ends the tag; whatever follows it stays in the field.
    const parts = raw.split(SPLIT);
    const rest = parts.pop() ?? "";
    add(parts);
    setText(rest);
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text");
    if (!SPLIT.test(pasted)) {
      return;
    }
    event.preventDefault();
    add([text + pasted.split(SPLIT)[0], ...pasted.split(SPLIT).slice(1)]);
    setText("");
  };

  const handleSelectedKey = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = tagsRef.current.length;
    if (selected === null) {
      return false;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      remove(selected);
      return true;
    }
    if (event.altKey && event.key === "ArrowLeft" && selected > 0) {
      move(selected, selected - 1);
      setSelected(selected - 1);
      return true;
    }
    if (event.altKey && event.key === "ArrowRight" && selected < count - 1) {
      move(selected, selected + 1);
      setSelected(selected + 1);
      return true;
    }
    if (event.key === "ArrowLeft") {
      setSelected(Math.max(0, selected - 1));
      return true;
    }
    if (event.key === "ArrowRight") {
      setSelected(selected + 1 < count ? selected + 1 : null);
      return true;
    }
    if (event.key === "Escape") {
      setSelected(null);
      return true;
    }
    return false;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (handleSelectedKey(event)) {
      event.preventDefault();
      return;
    }
    if (event.key === "Enter" || (event.key === "Tab" && text.trim())) {
      event.preventDefault();
      commitText();
      return;
    }
    const atStart = event.currentTarget.selectionStart === 0 && !text;
    const count = tagsRef.current.length;
    // First Backspace picks the last chip, so the second one can't surprise.
    if (
      (event.key === "Backspace" || event.key === "ArrowLeft") &&
      atStart &&
      count
    ) {
      event.preventDefault();
      setSelected(count - 1);
    }
  };

  const handleChipPointerDown = (
    event: PointerEvent<HTMLElement>,
    tag: string
  ) => {
    if (event.button !== 0) {
      return;
    }
    // Keeps focus in the field, where the keyboard handling lives.
    event.preventDefault();
    inputRef.current?.focus();
    // Captured on the field, not the chip: reordering moves the chip's node,
    // and moving a node drops its pointer capture.
    fieldRef.current?.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      tag,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  };

  const handleChipPointerMove = (event: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (event.pointerId !== d.pointerId) {
      return;
    }
    if (!d.moved) {
      const distance = Math.hypot(
        event.clientX - d.startX,
        event.clientY - d.startY
      );
      if (distance < DRAG_THRESHOLD) {
        return;
      }
      d.moved = true;
      setDragging(d.tag);
      setSelected(null);
    }
    // The chip takes the slot of whichever chip the pointer is over.
    const current = tagsRef.current;
    const from = current.indexOf(d.tag);
    const own = chipOf(d.tag)?.getBoundingClientRect();
    for (const [i, tag] of current.entries()) {
      const rect = chipOf(tag)?.getBoundingClientRect();
      if (tag !== d.tag && rect && own && crosses(event, rect, own, i > from)) {
        move(from, i);
        break;
      }
    }
  };

  const handleChipPointerUp = (event: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (event.pointerId !== d.pointerId) {
      return;
    }
    d.pointerId = -1;
    if (!d.moved) {
      // A plain click selects the chip, ready for Backspace.
      const index = tagsRef.current.indexOf(d.tag);
      setSelected(selected === index ? null : index);
    }
    setDragging(null);
  };

  const invalidCount = tags.filter((t) => !isValid(t)).length;
  const full = tags.length >= max;

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("w-full max-w-md", className)}>
        {label ? (
          <label
            className="mb-2 block font-medium text-sm text-zinc-900 dark:text-zinc-100"
            htmlFor={inputId}
          >
            {label}
          </label>
        ) : null}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: clicking the padding focuses the input, which has the keyboard handling */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: the input inside takes the keys */}
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: same as above */}
        <div
          aria-invalid={invalidCount > 0}
          className={cn(
            "flex min-h-11 w-full cursor-text flex-wrap items-center gap-1.5 rounded-xl border bg-white p-1.5 text-sm transition-[border-color,box-shadow] duration-150 ease-out focus-within:ring-2 dark:bg-zinc-950",
            invalidCount
              ? "border-red-300 focus-within:ring-red-100 dark:border-red-900 dark:focus-within:ring-red-950"
              : "border-zinc-200 focus-within:border-zinc-400 focus-within:ring-zinc-200 dark:border-zinc-800 dark:focus-within:border-zinc-600 dark:focus-within:ring-zinc-800"
          )}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              inputRef.current?.focus();
            }
          }}
          onLostPointerCapture={handleChipPointerUp}
          onPointerCancel={handleChipPointerUp}
          onPointerMove={handleChipPointerMove}
          onPointerUp={handleChipPointerUp}
          ref={fieldRef}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {tags.map((tag, i) => {
              const valid = isValid(tag);
              const isSelected = selected === i;
              const delay = delays.current.get(tag) ?? 0;
              return (
                <motion.span
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  className={cn(
                    "flex h-7 max-w-full touch-none select-none items-center gap-1 rounded-lg border pr-1 pl-2 transition-colors duration-150 ease-out",
                    dragging === tag ? "cursor-grabbing" : "cursor-grab",
                    chipTone(valid, isSelected, dragging === tag)
                  )}
                  data-tag={tag}
                  exit={{
                    opacity: 0,
                    filter: "blur(2px)",
                    transition: { duration: 0.12, ease: EASE_OUT },
                  }}
                  initial={{ opacity: 0, y: 4, filter: "blur(2px)" }}
                  key={tag}
                  layout="position"
                  onPointerDown={(event) => handleChipPointerDown(event, tag)}
                  title={valid ? undefined : "Not a valid entry"}
                  transition={{
                    layout: LAYOUT,
                    default: { duration: 0.2, ease: EASE_OUT, delay },
                  }}
                >
                  <span className="truncate">{tag}</span>
                  <button
                    aria-label={`Remove ${tag}`}
                    className="flex size-5 shrink-0 items-center justify-center rounded-md opacity-60 outline-none transition-[opacity,background-color] duration-150 ease-out hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                    onClick={() => remove(tagsRef.current.indexOf(tag))}
                    onPointerDown={(event) => event.stopPropagation()}
                    tabIndex={-1}
                    type="button"
                  >
                    <X className="size-3.5" strokeWidth={2} />
                  </button>
                </motion.span>
              );
            })}
          </AnimatePresence>
          <motion.input
            autoComplete="off"
            className="h-7 min-w-24 flex-1 bg-transparent px-1.5 text-zinc-900 outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed dark:text-zinc-100 dark:placeholder:text-zinc-500"
            enterKeyHint="enter"
            id={inputId}
            inputMode={type === "email" ? "email" : "text"}
            layout="position"
            onBlur={() => {
              commitText();
              setSelected(null);
            }}
            onChange={(event) => handleChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={(() => {
              if (full) {
                return "";
              }
              return tags.length ? "" : placeholder;
            })()}
            readOnly={full}
            ref={inputRef}
            spellCheck={false}
            transition={{ layout: LAYOUT }}
            value={text}
          />
        </div>
        <p
          className={cn(
            "mt-1.5 h-4 text-xs transition-opacity duration-150 ease-out",
            invalidCount ? "text-red-600 dark:text-red-400" : "text-zinc-500",
            invalidCount || full ? "opacity-100" : "opacity-0"
          )}
        >
          {helperText(invalidCount, full, max, type)}
        </p>
        <span aria-live="polite" className="sr-only">
          {announcement}
        </span>
      </div>
    </MotionConfig>
  );
}

/**
 * True once the pointer is over a chip and past its middle, heading away from
 * the dragged chip. Waiting for the middle stops two chips of different
 * widths from swapping back and forth under a still pointer.
 */
function crosses(
  point: { clientX: number; clientY: number },
  rect: DOMRect,
  own: DOMRect,
  forward: boolean
) {
  const inside =
    point.clientX >= rect.left &&
    point.clientX <= rect.right &&
    point.clientY >= rect.top &&
    point.clientY <= rect.bottom;
  if (!inside) {
    return false;
  }
  if (Math.abs(rect.top - own.top) > 4) {
    return true;
  }
  const middle = rect.left + rect.width / 2;
  return forward ? point.clientX > middle : point.clientX < middle;
}

function chipTone(valid: boolean, selected: boolean, dragging: boolean) {
  if (selected) {
    return "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";
  }
  if (!valid) {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300";
  }
  return dragging
    ? "border-zinc-300 bg-zinc-200 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
    : "border-zinc-200 bg-zinc-100 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100";
}

function helperText(
  invalid: number,
  full: boolean,
  max: number,
  type: "text" | "email"
) {
  if (invalid) {
    const noun = type === "email" ? "address" : "entry";
    const plural = type === "email" ? "addresses" : "entries";
    return `${invalid} ${invalid === 1 ? noun : plural} to fix`;
  }
  return full ? `${max} max` : "";
}
