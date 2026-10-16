"use client";

/**
 * @author: @dorianbaffier
 * @description: AI Autocomplete
 * @version: 1.0.0
 * @date: 2026-10-16
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface AIAutocompleteProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /**
   * Returns how the text could go on, or null for no suggestion. Called once
   * typing pauses, only while the caret is at the end. Demo completer when
   * omitted.
   */
  suggest?: (text: string) => string | null | Promise<string | null>;
  /** How long typing has to pause before asking for a suggestion, in ms. */
  delay?: number;
  placeholder?: string;
  /** Accessible name for the text box. */
  label?: string;
  className?: string;
}

const WORD = /^\s*\S+\s?/;
const WORDS = /\s*\S+\s*/g;

/** The next word of a suggestion, with the space around it. */
function nextWord(ghost: string) {
  return ghost.match(WORD)?.[0] ?? ghost;
}

/**
 * A text box that offers how your sentence could end, in grey after the
 * caret. Tab takes all of it, → takes one word, Esc waves it off, and
 * typing the same letters keeps it instead of asking again.
 */
export function AIAutocomplete({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  suggest = demoSuggest,
  delay = 400,
  placeholder = "Start writing…",
  label = "Message",
  className,
}: AIAutocompleteProps) {
  const [ownValue, setOwnValue] = useState(defaultValue);
  const value = valueProp ?? ownValue;
  const [ghost, setGhost] = useState("");
  // Bumped for each new suggestion so its words fade in once, not on every
  // keystroke that types through them.
  const [batch, setBatch] = useState(0);
  const [atEnd, setAtEnd] = useState(true);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const request = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setValue = useCallback(
    (next: string) => {
      setOwnValue(next);
      onValueChange?.(next);
    },
    [onValueChange]
  );

  const ask = useCallback(
    (text: string) => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
      const id = ++request.current;
      timer.current = setTimeout(async () => {
        if (!text.trim()) {
          return;
        }
        const result = await suggest(text);
        // A reply to text that has since changed is thrown away.
        if (id === request.current && result) {
          setGhost(result);
          setBatch((b) => b + 1);
        }
      }, delay);
    },
    [suggest, delay]
  );

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    []
  );

  // The first suggestion for the starting text, once it's on screen.
  const asked = useRef(false);
  useEffect(() => {
    if (!asked.current) {
      asked.current = true;
      ask(value);
    }
  }, [ask, value]);

  const caretAtEnd = () => {
    const area = areaRef.current;
    return (
      !!area &&
      area.selectionStart === area.selectionEnd &&
      area.selectionEnd === area.value.length
    );
  };

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    const added = next.startsWith(value) ? next.slice(value.length) : null;
    setValue(next);
    const end = caretAtEnd();
    setAtEnd(end);
    // Typing what the suggestion says eats into it rather than replacing it.
    if (end && added && ghost.startsWith(added)) {
      const rest = ghost.slice(added.length);
      setGhost(rest);
      if (!rest) {
        ask(next);
      }
      return;
    }
    request.current++;
    setGhost("");
    if (end) {
      ask(next);
    }
  };

  const accept = (part: string) => {
    const next = value + part;
    setValue(next);
    setGhost((g) => g.slice(part.length));
    requestAnimationFrame(() => {
      const area = areaRef.current;
      if (area) {
        area.focus();
        area.setSelectionRange(next.length, next.length);
      }
    });
    if (part.length >= ghost.length) {
      ask(next);
    }
  };

  const showGhost = ghost.length > 0 && atEnd;

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showGhost) {
      return;
    }
    const plain = !(event.metaKey || event.ctrlKey || event.altKey);
    if (event.key === "Tab" && plain && !event.shiftKey) {
      event.preventDefault();
      accept(ghost);
    } else if (event.key === "ArrowRight" && plain && caretAtEnd()) {
      event.preventDefault();
      accept(nextWord(ghost));
    } else if (event.key === "Escape") {
      event.preventDefault();
      request.current++;
      setGhost("");
    }
  };

  // Moving the caret off the end hides the suggestion; back at the end, it
  // returns. Clicks and arrow keys both land here.
  const onSelect = () => setAtEnd(caretAtEnd());

  const words = ghost.match(WORDS) ?? [];

  return (
    <div className={cn("w-full", className)}>
      <div className="relative">
        {/* The mirror: the same text, laid out identically under the text
          box, with the suggestion after it. It also sets the height, so
          the box grows with the suggestion and never scrolls. */}
        <div
          aria-hidden="true"
          className="pointer-events-none min-h-32 whitespace-pre-wrap break-words px-4 py-3 text-[15px] leading-6"
        >
          <span className="text-transparent">{value || "​"}</span>
          {value.endsWith("\n") && "​"}
          {showGhost && (
            <span className="text-gray-400 dark:text-gray-500" key={batch}>
              {words.map((word, i) => {
                const last = i === words.length - 1;
                return (
                  <span
                    // The Tab hint stays on the line of the last word.
                    className={cn("fade-word", last && "whitespace-nowrap")}
                    // biome-ignore lint/suspicious/noArrayIndexKey: words of one suggestion, in order
                    key={i}
                    style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}
                  >
                    {last ? word.trimEnd() : word}
                    {last && (
                      <kbd className="ml-1.5 inline-flex h-5 translate-y-[-1px] items-center rounded border border-gray-200 px-1 align-middle font-sans text-[10px] text-gray-400 dark:border-gray-800 dark:text-gray-500">
                        Tab
                      </kbd>
                    )}
                  </span>
                );
              })}
            </span>
          )}
        </div>
        <textarea
          aria-label={label}
          className="absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent px-4 py-3 text-[15px] text-gray-900 leading-6 caret-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:caret-gray-100 dark:placeholder:text-gray-500"
          onChange={onChange}
          onFocus={onSelect}
          onKeyDown={onKeyDown}
          onSelect={onSelect}
          placeholder={placeholder}
          ref={areaRef}
          spellCheck={false}
          value={value}
        />
      </div>
      <p aria-live="polite" className="sr-only">
        {showGhost ? `Suggestion: ${ghost}. Press Tab to accept.` : ""}
      </p>
      <style>{`
        .fade-word {
          animation: ai-autocomplete-in 180ms cubic-bezier(0.23, 1, 0.32, 1) both;
        }
        @keyframes ai-autocomplete-in {
          from { opacity: 0; filter: blur(2px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .fade-word { animation-duration: 1ms; }
        }
      `}</style>
      <AcceptBar
        onAccept={() => accept(ghost)}
        onWord={() => accept(nextWord(ghost))}
        visible={showGhost}
      />
    </div>
  );
}

/** Tap targets for touch screens, which have no Tab key. */
function AcceptBar({
  visible,
  onAccept,
  onWord,
}: {
  visible: boolean;
  onAccept: () => void;
  onWord: () => void;
}) {
  const keep = (event: { preventDefault: () => void }) =>
    // Keep focus (and the caret) in the text box.
    event.preventDefault();
  return (
    <div
      className={cn(
        "flex items-center gap-1 px-3 pb-3 text-gray-500 text-xs transition-opacity duration-150 dark:text-gray-400",
        !visible && "pointer-events-none opacity-0"
      )}
    >
      <button
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-900 dark:hover:text-gray-100"
        onClick={onAccept}
        onMouseDown={keep}
        tabIndex={-1}
        type="button"
      >
        <kbd className="rounded border border-gray-200 px-1 font-sans text-[10px] dark:border-gray-800">
          Tab
        </kbd>
        Accept
      </button>
      <button
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-900 dark:hover:text-gray-100"
        onClick={onWord}
        onMouseDown={keep}
        tabIndex={-1}
        type="button"
      >
        <kbd className="rounded border border-gray-200 px-1 font-sans text-[10px] dark:border-gray-800">
          →
        </kbd>
        Word
      </button>
      <span className="ml-1 hidden sm:inline">
        <kbd className="rounded border border-gray-200 px-1 font-sans text-[10px] dark:border-gray-800">
          Esc
        </kbd>{" "}
        Dismiss
      </span>
    </div>
  );
}

// The reply the demo completer knows, sentence by sentence. A real app
// would call a model here; this one finds where you are in the script.
const SCRIPT = [
  "Hi Maya,\n\n",
  "Thanks for the update on the launch timeline. ",
  "Thursday works for me, so let's move the review to 3pm and keep the rest of the plan as it is. ",
  "I'll share the updated deck with the team before then. ",
  "Let me know if anything changes on your side.\n\n",
  "Best,\nSam",
];
const FULL = SCRIPT.join("");
const TRAILING_SPACE = /\s+$/;

function demoSuggest(text: string): Promise<string | null> {
  return new Promise((resolve) => {
    setTimeout(
      () => {
        // Match the end of what's written against the script, loosely.
        const tail = text.slice(-24).toLowerCase();
        const at = FULL.toLowerCase().lastIndexOf(tail);
        if (!tail.trim() || at < 0) {
          resolve(null);
          return;
        }
        const from = at + tail.length;
        // Offer up to the end of the current sentence.
        let end = from;
        let sum = 0;
        for (const part of SCRIPT) {
          sum += part.length;
          if (sum > from) {
            end = sum;
            break;
          }
        }
        const rest = FULL.slice(from, end).replace(TRAILING_SPACE, (s) =>
          s.includes("\n") ? s : " "
        );
        resolve(rest.trim() ? rest : null);
      },
      180 + Math.random() * 220
    );
  });
}

/** An email reply with an assistant finishing your sentences. */
export default function AIAutocompleteDemo({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950",
        className
      )}
    >
      <div className="divide-y divide-gray-100 border-gray-200 border-b text-sm dark:divide-gray-900 dark:border-gray-800">
        <p className="flex gap-3 px-4 py-2.5">
          <span className="w-14 text-gray-400 dark:text-gray-500">To</span>
          <span className="text-gray-900 dark:text-gray-100">Maya Chen</span>
        </p>
        <p className="flex gap-3 px-4 py-2.5">
          <span className="w-14 text-gray-400 dark:text-gray-500">Subject</span>
          <span className="truncate text-gray-900 dark:text-gray-100">
            Re: Launch review
          </span>
        </p>
      </div>
      <AIAutocomplete
        defaultValue={"Hi Maya,\n\nThanks for the update on the "}
        label="Reply to Maya"
      />
    </div>
  );
}
