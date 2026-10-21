"use client";

/**
 * @author: @dorianbaffier
 * @description: Tab Strip
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  Braces,
  FileCode2,
  FileText,
  type LucideIcon,
  Palette,
  Plus,
  X,
} from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const MIN_WIDTH = 104;
const MAX_WIDTH = 184;
const NEW_WIDTH = 36;
const DRAG_SLOP = 4;
const EXIT_MS = 180;

export interface StripTab {
  id: string;
  title: string;
  /** Unsaved changes: a dot sits where the close button goes. */
  dirty?: boolean;
  icon?: LucideIcon;
  content?: ReactNode;
}

export interface TabStripProps {
  tabs?: StripTab[];
  defaultActive?: string;
  onActiveChange?: (id: string | null) => void;
  onClose?: (id: string) => void;
  /** Called with the new order after a drag. */
  onReorder?: (ids: string[]) => void;
  /** Return the tab to open. Without it, "+" opens an untitled file. */
  onNew?: () => StripTab;
  className?: string;
}

const DEMO_CODE: Record<string, string[]> = {
  page: [
    'import { Hero } from "@/components/hero";',
    "",
    "export default function Page() {",
    '  return <Hero title="Ship it" />;',
    "}",
  ],
  layout: [
    'import "./globals.css";',
    "",
    "export default function RootLayout({ children }) {",
    '  return <html lang="en">{children}</html>;',
    "}",
  ],
  css: ['@import "tailwindcss";', "", ":root {", "  --radius: 0.75rem;", "}"],
  button: [
    "export function Button(props) {",
    '  return <button className="h-9 px-4" {...props} />;',
    "}",
  ],
};

const DEFAULT_TABS: StripTab[] = [
  { id: "page", title: "page.tsx" },
  { id: "layout", title: "layout.tsx", dirty: true },
  { id: "css", title: "globals.css" },
  { id: "button", title: "button.tsx", dirty: true },
];

const EXTENSION = /\.([a-z]+)$/i;

function iconFor(title: string): LucideIcon {
  const ext = EXTENSION.exec(title)?.[1]?.toLowerCase();
  if (ext === "json") {
    return Braces;
  }
  if (ext === "css") {
    return Palette;
  }
  if (ext === "md" || ext === "txt") {
    return FileText;
  }
  return FileCode2;
}

function fadeMask(start: boolean, end: boolean) {
  if (!(start || end)) {
    return;
  }
  const from = start ? "transparent, black 24px" : "black";
  const to = end ? "black calc(100% - 24px), transparent" : "black";
  return `linear-gradient(to right, ${from}, ${to})`;
}

function CodePanel({ lines }: { lines: string[] }) {
  return (
    <pre className="overflow-x-auto px-0 py-3 font-mono text-[12.5px] text-zinc-700 leading-6 dark:text-zinc-300">
      {lines.map((line, i) => (
        <div className="flex" key={`${i}-${line}`}>
          <span className="w-10 shrink-0 select-none pr-4 text-right text-zinc-300 tabular-nums dark:text-zinc-600">
            {i + 1}
          </span>
          <span className="whitespace-pre">{line}</span>
        </div>
      ))}
    </pre>
  );
}

interface Drag {
  id: string;
  pointerId: number;
  /** Where the pointer went down, in strip coordinates. */
  originX: number;
  /** The tab's left edge when the drag began. */
  startLeft: number;
  /** The tab's left edge now. */
  left: number;
  moved: boolean;
}

let untitled = 0;

export default function TabStrip({
  tabs: initialTabs = DEFAULT_TABS,
  defaultActive,
  onActiveChange,
  onClose,
  onReorder,
  onNew,
  className,
}: TabStripProps) {
  const [tabs, setTabs] = useState(initialTabs);
  const [active, setActive] = useState<string | null>(
    defaultActive ?? initialTabs[0]?.id ?? null
  );
  const [closing, setClosing] = useState<string[]>([]);
  const [entering, setEntering] = useState<string | null>(null);
  const [frozen, setFrozen] = useState<number | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [stripWidth, setStripWidth] = useState(0);
  const [edges, setEdges] = useState({ start: true, end: false });

  const scrollerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLDivElement>());
  const timers = useRef(new Set<number>());

  const callbacks = useRef({ onActiveChange, onClose, onReorder, onNew });
  callbacks.current = { onActiveChange, onClose, onReorder, onNew };

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const observer = new ResizeObserver(() =>
      setStripWidth(scroller.clientWidth)
    );
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const id of pending) {
        window.clearTimeout(id);
      }
    };
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);

  const live = tabs.filter((tab) => !closing.includes(tab.id));
  const fit =
    live.length > 0
      ? Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, (stripWidth - NEW_WIDTH) / live.length)
        )
      : MAX_WIDTH;
  // While the pointer stays on the strip after a close, widths hold still so
  // the next tab's close button slides in under the cursor.
  const width = frozen ?? fit;

  // The order the strip shows: during a drag, the dragged tab takes the slot
  // its middle is over.
  let order = tabs;
  if (drag?.moved) {
    const from = tabs.findIndex((tab) => tab.id === drag.id);
    const liveIndex = Math.round(drag.left / width);
    const without = tabs.filter((tab) => tab.id !== drag.id);
    let seen = 0;
    let to = without.length;
    for (let i = 0; i < without.length; i++) {
      if (seen === liveIndex) {
        to = i;
        break;
      }
      if (!closing.includes(without[i].id)) {
        seen++;
      }
    }
    order = [...without.slice(0, to), tabs[from], ...without.slice(to)];
  }

  const lefts = new Map<string, number>();
  let total = 0;
  for (const tab of order) {
    lefts.set(tab.id, total);
    if (!closing.includes(tab.id)) {
      total += width;
    }
  }

  const activate = useCallback((id: string | null) => {
    setActive(id);
    callbacks.current.onActiveChange?.(id);
  }, []);

  // Keep the active tab in view when the strip scrolls.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const left = active ? lefts.get(active) : undefined;
    if (!scroller || left === undefined || drag) {
      return;
    }
    const right = left + width;
    if (left < scroller.scrollLeft) {
      scroller.scrollTo({ left, behavior: "smooth" });
    } else if (right > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollTo({
        left: right - scroller.clientWidth + NEW_WIDTH,
        behavior: "smooth",
      });
    }
  });

  const close = (id: string, fromPointer: boolean) => {
    if (closing.includes(id)) {
      return;
    }
    if (fromPointer && frozen === null) {
      setFrozen(width);
    }
    if (id === active) {
      // Browsers hand focus to the tab on the right, else the left.
      const index = live.findIndex((tab) => tab.id === id);
      const next = live[index + 1] ?? live[index - 1] ?? null;
      activate(next?.id ?? null);
    }
    setClosing((ids) => [...ids, id]);
    callbacks.current.onClose?.(id);
    later(() => {
      setTabs((list) => list.filter((tab) => tab.id !== id));
      setClosing((ids) => ids.filter((x) => x !== id));
    }, EXIT_MS);
  };

  const openNew = () => {
    setFrozen(null);
    let tab = callbacks.current.onNew?.();
    if (!tab) {
      untitled++;
      tab = {
        id: `untitled-${untitled}`,
        title: `Untitled-${untitled}`,
        dirty: true,
        content: <CodePanel lines={[""]} />,
      };
    }
    const created = tab;
    setTabs((list) => [...list, created]);
    setEntering(created.id);
    activate(created.id);
    // One frame at zero width, then it grows into its slot.
    requestAnimationFrame(() => requestAnimationFrame(() => setEntering(null)));
  };

  const stripX = (clientX: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return 0;
    }
    return (
      clientX - scroller.getBoundingClientRect().left + scroller.scrollLeft
    );
  };

  const onTabPointerDown = (
    event: PointerEvent<HTMLDivElement>,
    id: string
  ) => {
    if (event.button === 1) {
      // Middle click closes, as in every browser.
      event.preventDefault();
      close(id, true);
      return;
    }
    if (event.button !== 0 || drag || closing.includes(id)) {
      return;
    }
    // Tabs switch on press, not release, so switching feels instant.
    activate(id);
    event.currentTarget.setPointerCapture(event.pointerId);
    const left = lefts.get(id) ?? 0;
    setDrag({
      id,
      pointerId: event.pointerId,
      originX: stripX(event.clientX),
      startLeft: left,
      left,
      moved: false,
    });
  };

  const onTabPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    const dx = stripX(event.clientX) - drag.originX;
    if (!drag.moved && Math.abs(dx) < DRAG_SLOP) {
      return;
    }
    const max = Math.max(0, (live.length - 1) * width);
    setFrozen(null);
    setDrag({
      ...drag,
      moved: true,
      left: Math.min(max, Math.max(0, drag.startLeft + dx)),
    });
  };

  const onTabPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    if (drag.moved && order.some((tab, i) => tab.id !== tabs[i]?.id)) {
      setTabs(order);
      callbacks.current.onReorder?.(order.map((tab) => tab.id));
    }
    setDrag(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, id: string) => {
    const index = live.findIndex((tab) => tab.id === id);
    const targets: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: live.length - 1,
    };
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      close(id, false);
      const next = live[index + 1] ?? live[index - 1];
      if (next) {
        tabRefs.current.get(next.id)?.focus();
      }
      return;
    }
    if (!(event.key in targets)) {
      return;
    }
    event.preventDefault();
    const next = live[(targets[event.key] + live.length) % live.length];
    if (next) {
      activate(next.id);
      tabRefs.current.get(next.id)?.focus();
    }
  };

  const activeTab = tabs.find((tab) => tab.id === active);
  const activeIndex = order.findIndex((tab) => tab.id === active);
  const hoveredIndex = order.findIndex((tab) => tab.id === hovered);

  return (
    <div
      className={cn(
        "w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10",
        className
      )}
    >
      <div className="bg-zinc-100 px-1.5 pt-1.5 dark:bg-zinc-950/60">
        <div
          className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onPointerLeave={() => setFrozen(null)}
          onScroll={(event) => {
            const el = event.currentTarget;
            setEdges({
              start: el.scrollLeft <= 1,
              end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
            });
          }}
          ref={scrollerRef}
          style={{
            // When tabs overflow, the cut edge fades so it reads as more.
            maskImage: fadeMask(
              !edges.start,
              !edges.end && total + NEW_WIDTH > stripWidth
            ),
          }}
        >
          <div
            aria-label="Open files"
            className="relative h-9"
            role="tablist"
            style={{ width: total + NEW_WIDTH }}
          >
            {order.map((tab, i) => {
              const isActive = tab.id === active;
              const isClosing = closing.includes(tab.id);
              const isDragged = drag?.moved && drag.id === tab.id;
              const left = isDragged ? drag.left : (lefts.get(tab.id) ?? 0);
              const shrunk = isClosing || tab.id === entering;
              // Separators hide beside the active and hovered tabs.
              const showSeparator =
                i > 0 &&
                !isActive &&
                i !== activeIndex + 1 &&
                i !== hoveredIndex &&
                i !== hoveredIndex + 1 &&
                !isDragged;
              return (
                <TabItem
                  active={isActive}
                  dragged={Boolean(isDragged)}
                  key={tab.id}
                  left={left}
                  onClose={() => close(tab.id, true)}
                  onKeyDown={(event) => onKeyDown(event, tab.id)}
                  onPointerDown={(event) => onTabPointerDown(event, tab.id)}
                  onPointerEnter={() => setHovered(tab.id)}
                  onPointerLeave={() =>
                    setHovered((h) => (h === tab.id ? null : h))
                  }
                  onPointerMove={onTabPointerMove}
                  onPointerUp={onTabPointerUp}
                  ref={(node) => {
                    if (node) {
                      tabRefs.current.set(tab.id, node);
                    } else {
                      tabRefs.current.delete(tab.id);
                    }
                  }}
                  separator={showSeparator}
                  shrunk={shrunk}
                  tab={tab}
                  width={width}
                />
              );
            })}
            <button
              aria-label="New tab"
              className="absolute top-0.5 left-0 flex size-8 items-center justify-center rounded-lg text-zinc-500 outline-hidden transition-[color,background-color,translate] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-zinc-200/70 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-orange-500/50 motion-reduce:transition-colors dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
              onClick={openNew}
              style={{ translate: `${total + 2}px 0` }}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        aria-labelledby={activeTab ? `tab-${activeTab.id}` : undefined}
        className="h-48 overflow-auto"
        id="tab-strip-panel"
        role="tabpanel"
      >
        {activeTab ? (
          (activeTab.content ?? (
            <CodePanel lines={DEMO_CODE[activeTab.id] ?? [""]} />
          ))
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
            No open files
            <button
              className="h-8 rounded-lg px-3 font-medium text-sm text-zinc-700 ring-1 ring-black/10 transition-colors duration-150 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/50 dark:text-zinc-200 dark:ring-white/15 dark:hover:bg-white/5 dark:hover:text-white"
              onClick={openNew}
              type="button"
            >
              New file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface TabItemProps {
  tab: StripTab;
  active: boolean;
  dragged: boolean;
  shrunk: boolean;
  separator: boolean;
  left: number;
  width: number;
  ref: (node: HTMLDivElement | null) => void;
  onClose: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

function TabItem({
  tab,
  active,
  dragged,
  shrunk,
  separator,
  left,
  width,
  ref,
  onClose,
  onKeyDown,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerEnter,
  onPointerLeave,
}: TabItemProps) {
  const Icon = tab.icon ?? iconFor(tab.title);
  return (
    <div
      aria-controls="tab-strip-panel"
      aria-selected={active}
      className={cn(
        "group/tab absolute top-0 left-0 h-9 touch-none select-none outline-hidden duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
        // The dragged tab follows the pointer; with reduced motion tabs only fade.
        dragged
          ? "transition-[width,opacity]"
          : "transition-[translate,width,opacity] motion-reduce:transition-opacity",
        dragged ? "z-20 cursor-grabbing" : "cursor-default",
        active && "z-10"
      )}
      id={`tab-${tab.id}`}
      onKeyDown={onKeyDown}
      onPointerCancel={onPointerUp}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      ref={ref}
      role="tab"
      style={{
        width: shrunk ? 0 : width,
        opacity: shrunk ? 0 : 1,
        translate: `${left}px 0`,
      }}
      tabIndex={active ? 0 : -1}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-2.5 bottom-2.5 left-0 w-px bg-zinc-300 transition-opacity duration-150 dark:bg-zinc-700",
          separator ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        className={cn(
          "absolute inset-x-0.5 top-0.5 bottom-0 flex items-center gap-1.5 overflow-hidden rounded-t-lg pr-1 pl-2.5 text-[13px] transition-colors duration-150",
          active
            ? "bg-white text-zinc-900 shadow-[0_-1px_2px_rgb(0_0_0/0.04)] dark:bg-zinc-900 dark:text-zinc-100"
            : "rounded-b-lg text-zinc-500 group-hover/tab:bg-zinc-200/60 group-hover/tab:text-zinc-800 dark:text-zinc-400 dark:group-hover/tab:bg-white/5 dark:group-hover/tab:text-zinc-200",
          !active && "mb-1",
          dragged && !active && "bg-zinc-200/80 dark:bg-white/10",
          "group-focus-visible/tab:ring-2 group-focus-visible/tab:ring-orange-500/50 group-focus-visible/tab:ring-inset"
        )}
      >
        <Icon aria-hidden="true" className="size-3.5 shrink-0 opacity-70" />
        {/* Long names fade out instead of ending in an ellipsis. */}
        <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap [mask-image:linear-gradient(to_right,black_calc(100%-14px),transparent)]">
          {tab.title}
        </span>
        <span className="relative flex size-5 shrink-0 items-center justify-center">
          {tab.dirty && (
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full bg-orange-500 transition-opacity duration-150 group-focus-within/tab:opacity-0 group-hover/tab:opacity-0"
              )}
            />
          )}
          <button
            aria-label={`Close ${tab.title}${tab.dirty ? ", unsaved" : ""}`}
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-md text-zinc-500 outline-hidden transition-[color,background-color,opacity] duration-150 hover:bg-zinc-900/10 hover:text-zinc-900 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-orange-500/50 dark:text-zinc-400 dark:hover:bg-white/15 dark:hover:text-white",
              tab.dirty || !active
                ? "opacity-0 group-hover/tab:opacity-100"
                : "opacity-100"
            )}
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            tabIndex={-1}
            type="button"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        </span>
      </div>
    </div>
  );
}
