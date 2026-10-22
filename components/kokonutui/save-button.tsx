"use client";

/**
 * @author: @dorianbaffier
 * @description: Save Button
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type FormEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** How long the "Saved to" strip stays up when left alone. */
const STRIP_FOR = 4000;

export interface SaveCollection {
  id: string;
  name: string;
  /** Items already in it, before this one. */
  count: number;
  /** Tailwind background class for its swatch. */
  color: string;
}

export interface SaveButtonProps {
  collections?: SaveCollection[];
  /** Where a tap saves to, by id. Defaults to the first collection. */
  defaultCollection?: string;
  defaultSaved?: boolean;
  onSave?: (collectionId: string) => void;
  onMove?: (collectionId: string) => void;
  onRemove?: () => void;
  className?: string;
}

const DEFAULT_COLLECTIONS: SaveCollection[] = [
  { id: "weekend", name: "Weekend trips", count: 12, color: "bg-orange-400" },
  { id: "tokyo", name: "Tokyo 2027", count: 31, color: "bg-sky-400" },
  { id: "food", name: "Places to eat", count: 48, color: "bg-emerald-400" },
  { id: "someday", name: "Someday", count: 7, color: "bg-violet-400" },
];

const SWATCHES = [
  "bg-rose-400",
  "bg-amber-300",
  "bg-teal-400",
  "bg-indigo-400",
];

type View = "closed" | "saved" | "picking" | "removed";

// The panel sits under AnimatePresence, so it's found by query, not ref.
const findPanel = (root: HTMLElement | null) =>
  root?.querySelector("[data-save-panel]") ?? null;

const focusInPanel = (root: HTMLElement | null) =>
  Boolean(findPanel(root)?.contains(document.activeElement));

// Whatever closes or swaps the panel's content would drop focus on <body>,
// so it goes back to the button first.
const returnFocus = (root: HTMLElement | null, button: HTMLElement | null) => {
  if (focusInPanel(root)) {
    button?.focus();
  }
};

/** A bookmark whose ink drops in from the top like a ribbon when saved. */
function Ribbon({
  saved,
  reduceMotion,
}: {
  saved: boolean;
  reduceMotion: boolean;
}) {
  const clip = useId();
  let ribbonTransition: object = { duration: 0.18, ease: EASE_OUT };
  if (reduceMotion) {
    ribbonTransition = { duration: 0 };
  } else if (saved) {
    ribbonTransition = { type: "spring", stiffness: 520, damping: 24 };
  }
  return (
    <svg
      aria-hidden
      className="size-4 overflow-visible"
      fill="none"
      viewBox="0 0 16 16"
    >
      <title>Bookmark</title>
      <defs>
        <clipPath id={clip}>
          <path d="M3.5 2.5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v11.2l-4.5-3-4.5 3z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <motion.rect
          animate={{ y: saved ? 0 : -16 }}
          className="fill-current"
          height="16"
          initial={false}
          transition={ribbonTransition}
          width="16"
          x="0"
          y="0"
        />
      </g>
      <path
        className="stroke-current"
        d="M3.5 2.5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v11.2l-4.5-3-4.5 3z"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export default function SaveButton({
  collections: initialCollections = DEFAULT_COLLECTIONS,
  defaultCollection,
  defaultSaved = false,
  onSave,
  onMove,
  onRemove,
  className,
}: SaveButtonProps) {
  const [collections, setCollections] = useState(initialCollections);
  const [savedTo, setSavedTo] = useState<string | null>(
    defaultSaved
      ? (defaultCollection ?? initialCollections[0]?.id ?? null)
      : null
  );
  const [lastUsed, setLastUsed] = useState(
    defaultCollection ?? initialCollections[0]?.id ?? ""
  );
  const [view, setView] = useState<View>("closed");
  const [draft, setDraft] = useState("");
  const [moved, setMoved] = useState(false);
  const reduceMotion = Boolean(useReducedMotion());

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hoverRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const contentRef = useRef<HTMLDivElement>(null);
  const isOpen = view !== "closed";
  const [contentHeight, setContentHeight] = useState<number>();

  // The strip grows into the picker and back by its measured height.
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!(isOpen && content)) {
      setContentHeight(undefined);
      return;
    }
    const observer = new ResizeObserver(() =>
      setContentHeight(content.offsetHeight)
    );
    observer.observe(content);
    return () => observer.disconnect();
  }, [isOpen]);

  const saved = savedTo !== null;
  const current = collections.find((c) => c.id === savedTo);

  // The strip closes on its own unless it is being read or used.
  const schedule = (ms = STRIP_FOR) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!(hoverRef.current || focusInPanel(rootRef.current))) {
        setView((v) => (v === "picking" ? v : "closed"));
      }
    }, ms);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    if (view === "closed") {
      return;
    }
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setView("closed");
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        returnFocus(rootRef.current, buttonRef.current);
        setView("closed");
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [view]);

  // Opening the picker moves focus onto the collection it's saved in.
  useEffect(() => {
    if (view === "picking") {
      findPanel(rootRef.current)
        ?.querySelector<HTMLButtonElement>('[aria-current="true"]')
        ?.focus();
    }
  }, [view]);

  const toggle = () => {
    if (saved) {
      setSavedTo(null);
      setView("removed");
      onRemove?.();
      schedule(1600);
      return;
    }
    setSavedTo(lastUsed);
    setMoved(false);
    setView("saved");
    onSave?.(lastUsed);
    schedule();
  };

  const moveTo = (id: string) => {
    returnFocus(rootRef.current, buttonRef.current);
    setSavedTo(id);
    setLastUsed(id);
    setMoved(id !== savedTo);
    setView("saved");
    if (id !== savedTo) {
      onMove?.(id);
    }
    schedule();
  };

  const create = (event: FormEvent) => {
    event.preventDefault();
    const name = draft.trim();
    if (!name) {
      return;
    }
    const id = `${name.toLowerCase().replace(/\s+/g, "-")}-${collections.length}`;
    const color = SWATCHES[collections.length % SWATCHES.length];
    setCollections((list) => [...list, { id, name, count: 0, color }]);
    setDraft("");
    moveTo(id);
  };

  const countFor = (collection: SaveCollection) =>
    collection.count + (savedTo === collection.id ? 1 : 0);

  const swap = reduceMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: EASE_OUT };

  return (
    <div
      className={cn("relative inline-flex", className)}
      onPointerEnter={() => {
        hoverRef.current = true;
      }}
      onPointerLeave={() => {
        hoverRef.current = false;
        if (view === "saved" || view === "removed") {
          schedule(1800);
        }
      }}
      ref={rootRef}
    >
      <button
        aria-pressed={saved}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full border pr-4 pl-3.5 font-medium text-sm outline-none",
          "transition-colors duration-150 ease-out",
          "focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
          saved
            ? "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
        )}
        onClick={toggle}
        ref={buttonRef}
        type="button"
      >
        <Ribbon reduceMotion={reduceMotion} saved={saved} />
        <span className="relative inline-flex overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: saved ? -14 : 14, opacity: 0 }}
              initial={{ y: saved ? 14 : -14, opacity: 0 }}
              key={saved ? "saved" : "save"}
              transition={swap}
            >
              {saved ? "Saved" : "Save"}
            </motion.span>
          </AnimatePresence>
        </span>
      </button>

      <AnimatePresence>
        {view !== "closed" && (
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute top-full left-1/2 z-20 mt-2 w-72 origin-top -translate-x-1/2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_24px_-8px_rgb(0_0_0/0.18)] dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_8px_24px_-8px_rgb(0_0_0/0.6)]"
            data-save-panel
            exit={{
              opacity: 0,
              y: -4,
              scale: 0.98,
              transition: { duration: 0.12 },
            }}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={
              reduceMotion ? { duration: 0 } : { duration: 0.2, ease: EASE_OUT }
            }
          >
            <motion.div
              animate={{ height: contentHeight ?? "auto" }}
              initial={false}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.26, ease: EASE_OUT }
              }
            >
              <div ref={contentRef}>
                {view === "picking" ? (
                  <Picker
                    collections={collections}
                    countFor={countFor}
                    create={create}
                    draft={draft}
                    moveTo={moveTo}
                    savedTo={savedTo}
                    setDraft={setDraft}
                  />
                ) : (
                  <div
                    aria-live="polite"
                    className="flex h-12 items-center gap-2.5 pr-2 pl-3 text-sm"
                  >
                    {view === "removed" || !current ? (
                      <span className="text-zinc-500 dark:text-zinc-400">
                        Removed from saved
                      </span>
                    ) : (
                      <>
                        <span
                          className={cn(
                            "size-5 shrink-0 rounded-md",
                            current.color
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate text-zinc-500 dark:text-zinc-400">
                          {moved ? "Moved to " : "Saved to "}
                          <span className="relative inline-flex align-bottom">
                            <AnimatePresence initial={false} mode="popLayout">
                              <motion.span
                                animate={{ y: 0, opacity: 1 }}
                                className="font-medium text-zinc-900 dark:text-zinc-100"
                                exit={{ y: -10, opacity: 0 }}
                                initial={{ y: 10, opacity: 0 }}
                                key={current.id}
                                transition={swap}
                              >
                                {current.name}
                              </motion.span>
                            </AnimatePresence>
                          </span>
                        </span>
                        <button
                          className="h-8 shrink-0 rounded-full px-3 font-medium text-xs text-zinc-900 transition-colors duration-150 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-900"
                          onClick={() => {
                            clearTimeout(timerRef.current);
                            setView("picking");
                          }}
                          type="button"
                        >
                          Change
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Picker({
  collections,
  savedTo,
  countFor,
  moveTo,
  draft,
  setDraft,
  create,
}: {
  collections: SaveCollection[];
  savedTo: string | null;
  countFor: (collection: SaveCollection) => number;
  moveTo: (id: string) => void;
  draft: string;
  setDraft: (value: string) => void;
  create: (event: FormEvent) => void;
}) {
  return (
    <div className="p-1.5">
      <p className="px-2 pt-1.5 pb-1 text-[11px] text-zinc-400 dark:text-zinc-500">
        Save to
      </p>
      <ul className="max-h-56 overflow-y-auto">
        {collections.map((collection) => {
          const active = collection.id === savedTo;
          return (
            <li key={collection.id}>
              <button
                aria-current={active}
                className="flex h-11 w-full items-center gap-2.5 rounded-xl px-2 text-left text-sm outline-none transition-colors duration-150 hover:bg-zinc-100 focus-visible:bg-zinc-100 dark:focus-visible:bg-zinc-900 dark:hover:bg-zinc-900"
                onClick={() => moveTo(collection.id)}
                type="button"
              >
                <span
                  className={cn("size-7 shrink-0 rounded-lg", collection.color)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-zinc-900 dark:text-zinc-100">
                    {collection.name}
                  </span>
                  <span className="block text-[11px] text-zinc-400 tabular-nums dark:text-zinc-500">
                    {countFor(collection)} saved
                  </span>
                </span>
                {active && (
                  <Check
                    aria-hidden
                    className="size-4 text-zinc-900 dark:text-zinc-100"
                    strokeWidth={2.5}
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <form
        className="mt-1 flex h-11 items-center gap-2.5 rounded-xl border-zinc-100 border-t px-2 pt-1 dark:border-zinc-900"
        onSubmit={create}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-zinc-300 border-dashed text-zinc-400 dark:border-zinc-700">
          <Plus aria-hidden className="size-3.5" />
        </span>
        <input
          aria-label="New collection"
          className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="New collection"
          value={draft}
        />
        <AnimatePresence initial={false}>
          {draft.trim() && (
            <motion.button
              animate={{ opacity: 1, x: 0 }}
              className="h-7 shrink-0 rounded-full bg-zinc-900 px-2.5 font-medium text-[11px] text-white dark:bg-zinc-100 dark:text-zinc-900"
              exit={{ opacity: 0, x: 4 }}
              initial={{ opacity: 0, x: 4 }}
              transition={{ duration: 0.14, ease: EASE_OUT }}
              type="submit"
            >
              Create
            </motion.button>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
