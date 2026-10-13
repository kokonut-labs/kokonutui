"use client";

/**
 * @author: @dorianbaffier
 * @description: Clip Tabs
 * @version: 1.0.0
 * @date: 2026-10-13
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Code, Eye, Settings2, Terminal } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface ClipTab {
  id: string;
  label: string;
  icon?: ReactNode;
}

const DEFAULT_TABS: ClipTab[] = [
  { id: "preview", label: "Preview", icon: <Eye className="size-4" /> },
  { id: "code", label: "Code", icon: <Code className="size-4" /> },
  { id: "cli", label: "CLI", icon: <Terminal className="size-4" /> },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings2 className="size-4" />,
  },
];

export interface ClipTabsProps {
  tabs?: ClipTab[];
  /** Controlled active tab id. */
  value?: string;
  /** Initial tab id when uncontrolled. Defaults to the first tab. */
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** Accessible name for the tab list. */
  label?: string;
  className?: string;
}

interface Clip {
  left: number;
  right: number;
}

/**
 * The tab list is rendered twice. The bottom copy is the real, interactive
 * one in its resting colors. The top copy is styled as "active" and clipped
 * with `clip-path: inset()` so only the selected tab shows through. Moving
 * the clip moves the pill, and because the clip cuts through text and icons
 * the colors change exactly at the pill's edge, which separate color
 * transitions on each tab can't do.
 */
export default function ClipTabs({
  tabs = DEFAULT_TABS,
  value: valueProp,
  defaultValue,
  onValueChange,
  label = "Views",
  className,
}: ClipTabsProps) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const [internalValue, setInternalValue] = useState(
    defaultValue ?? tabs[0]?.id
  );
  const value = valueProp ?? internalValue;

  // Null until measured, so the server and first client render agree and
  // the pill doesn't animate in from the edge on load.
  const [clip, setClip] = useState<Clip | null>(null);
  // Keyboard selection moves the pill instantly. Arrow keys get pressed in
  // quick runs, and a slide after each press would lag behind the focus.
  const [instant, setInstant] = useState(true);

  const measure = useCallback(() => {
    const list = listRef.current;
    const tab = value ? tabRefs.current.get(value) : undefined;
    if (!(list && tab)) {
      return;
    }
    const width = list.offsetWidth;
    setClip({
      left: (tab.offsetLeft / width) * 100,
      right: ((width - tab.offsetLeft - tab.offsetWidth) / width) * 100,
    });
  }, [value]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    // Labels can reflow when fonts load or the container resizes. Re-measure
    // without animating so the pill never drifts off its tab.
    const observer = new ResizeObserver(() => {
      setInstant(true);
      measure();
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure]);

  const select = (id: string, fromKeyboard: boolean) => {
    setInstant(fromKeyboard);
    if (valueProp === undefined) {
      setInternalValue(id);
    }
    if (id !== value) {
      onValueChange?.(id);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === value);
    const moves: Record<string, number> = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!(event.key in moves)) {
      return;
    }
    event.preventDefault();
    const nextIndex = (moves[event.key] + tabs.length) % tabs.length;
    const next = tabs[nextIndex];
    select(next.id, true);
    tabRefs.current.get(next.id)?.focus();
  };

  const tabClass =
    "flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 font-medium text-sm";

  return (
    <div
      className={cn(
        "relative inline-flex rounded-full border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900",
        className
      )}
    >
      <div
        aria-label={label}
        className="relative flex"
        onKeyDown={handleKeyDown}
        ref={listRef}
        role="tablist"
      >
        {tabs.map((tab) => {
          const selected = tab.id === value;
          return (
            <button
              aria-selected={selected}
              className={cn(
                tabClass,
                "text-zinc-500 outline-none transition-colors duration-150 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                "focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
              )}
              id={`${baseId}-tab-${tab.id}`}
              key={tab.id}
              onClick={() => select(tab.id, false)}
              ref={(node) => {
                if (node) {
                  tabRefs.current.set(tab.id, node);
                } else {
                  tabRefs.current.delete(tab.id);
                }
              }}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}

        {/* The "active" copy. Purely visual: clicks fall through to the real
            tabs underneath. */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 flex rounded-full bg-zinc-900 dark:bg-white",
            !instant &&
              "transition-[clip-path] duration-[250ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
          )}
          style={{
            clipPath: clip
              ? `inset(0 ${clip.right}% 0 ${clip.left}% round 9999px)`
              : "inset(0 100% 0 0)",
          }}
        >
          {tabs.map((tab) => (
            <span
              className={cn(tabClass, "text-white dark:text-zinc-900")}
              key={tab.id}
            >
              {tab.icon}
              {tab.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
