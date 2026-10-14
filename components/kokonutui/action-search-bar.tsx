"use client";

/**
 * @author: @kokonutui
 * @description: Command Palette with ⌘K, nested pages, fuzzy matching and in-row action progress
 * @version: 2.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  FilePlus,
  FolderInput,
  History,
  Keyboard,
  Link2,
  LoaderCircle,
  Search,
  SunMoon,
  UserPlus,
} from "lucide-react";
import { animate, useReducedMotion } from "motion/react";
import {
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface CommandItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Section heading on its page, such as "Actions" or "Links". */
  group?: string;
  /** Extra words the row matches on, without being shown. */
  keywords?: string[];
  /** Keys shown at the end of the row, such as ["⌘", "N"]. */
  shortcut?: string[];
  /** Marks the row as a link. `onSelect` decides how to open it. */
  href?: string;
  /** Choosing the row opens these as a nested page instead of running it. */
  children?: CommandItem[];
  /** Input placeholder while this item's page is open. */
  placeholder?: string;
}

/** @deprecated Use `CommandItem`. */
export type Action = CommandItem;

export interface ActionSearchBarProps {
  items?: CommandItem[];
  /** Ids shown under "Recent" before anything is typed. Running a row adds it. */
  defaultRecent?: string[];
  /**
   * Called when a row without children is chosen. Return a Promise to show a
   * spinner in the row until it settles; a rejection leaves the palette open.
   */
  onSelect?: (item: CommandItem, path: CommandItem[]) => unknown;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  /**
   * ⌘K / Ctrl+K toggles the palette. By default it only does so while the
   * palette is focused or hovered, so the host page keeps its own ⌘K. Set
   * `true` to take ⌘K page-wide whenever the palette is on screen.
   */
  shortcut?: boolean;
  label?: string;
  placeholder?: string;
  className?: string;
}

interface Entry {
  item: CommandItem;
  /** Ancestors below the current page, shown as a "Parent ›" prefix. */
  path: CommandItem[];
}

interface Row extends Entry {
  key: string;
  matches: number[];
  score: number;
}

interface Section {
  key: string;
  label?: string;
  rows: Row[];
}

type InputSource = "keyboard" | "pointer";

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const HOLD_MS = 400;
const RECENT_LIMIT = 3;

const ICON = "size-4";

const sampleItems: CommandItem[] = [
  {
    id: "new-document",
    label: "New document",
    icon: <FilePlus className={ICON} />,
    group: "Actions",
    keywords: ["create", "page", "file"],
    shortcut: ["⌘", "N"],
  },
  {
    id: "duplicate",
    label: "Duplicate page",
    icon: <Copy className={ICON} />,
    group: "Actions",
    keywords: ["copy", "clone"],
    shortcut: ["⌘", "D"],
  },
  {
    id: "move",
    label: "Move to…",
    icon: <FolderInput className={ICON} />,
    group: "Actions",
    keywords: ["folder", "file"],
    placeholder: "Move to which folder?",
    children: [
      {
        id: "move-inbox",
        label: "Inbox",
        icon: <FolderInput className={ICON} />,
      },
      {
        id: "move-projects",
        label: "Projects",
        icon: <FolderInput className={ICON} />,
      },
      {
        id: "move-archive",
        label: "Archive",
        icon: <FolderInput className={ICON} />,
      },
    ],
  },
  {
    id: "theme",
    label: "Change theme",
    icon: <SunMoon className={ICON} />,
    group: "Actions",
    keywords: ["appearance", "dark", "light", "mode"],
    placeholder: "Choose a theme…",
    children: [
      { id: "theme-light", label: "Light", icon: <SunMoon className={ICON} /> },
      { id: "theme-dark", label: "Dark", icon: <SunMoon className={ICON} /> },
      {
        id: "theme-system",
        label: "Match system",
        icon: <SunMoon className={ICON} />,
      },
    ],
  },
  {
    id: "invite",
    label: "Invite member",
    icon: <UserPlus className={ICON} />,
    group: "Actions",
    keywords: ["team", "share", "add"],
  },
  {
    id: "copy-link",
    label: "Copy link",
    icon: <Link2 className={ICON} />,
    group: "Actions",
    keywords: ["url", "share"],
    shortcut: ["⌘", "L"],
  },
  {
    id: "docs",
    label: "Documentation",
    icon: <BookOpen className={ICON} />,
    group: "Links",
    keywords: ["help", "guide"],
    href: "/docs",
  },
  {
    id: "changelog",
    label: "Changelog",
    icon: <History className={ICON} />,
    group: "Links",
    keywords: ["release", "updates", "new"],
    href: "/changelog",
  },
  {
    id: "status",
    label: "Status page",
    icon: <Activity className={ICON} />,
    group: "Links",
    keywords: ["uptime", "incident"],
    href: "/status",
  },
  {
    id: "shortcuts",
    label: "Keyboard shortcuts",
    icon: <Keyboard className={ICON} />,
    group: "Links",
    keywords: ["keys", "hotkeys"],
    href: "/shortcuts",
  },
];

/* ---------------------------------------------------------------- matching */

const WORD_BREAK = /[\s\-_/.]/;
const WHITESPACE = /\s+/g;
const APPLE_PLATFORM = /mac|iphone|ipad/i;

const isWordStart = (text: string, i: number) =>
  i === 0 || WORD_BREAK.test(text[i - 1] ?? "");

/** The first word start at or after `from` that holds `ch`, else `from`. */
function nextWordStart(t: string, ch: string, from: number) {
  for (let j = from; j < t.length; j++) {
    if (t[j] === ch && isWordStart(t, j)) {
      return j;
    }
  }
  return from;
}

function subsequence(t: string, q: string, preferWordStarts: boolean) {
  const matches: number[] = [];
  let score = 0;
  let from = 0;
  for (const ch of q) {
    let i = t.indexOf(ch, from);
    if (i < 0) {
      return null;
    }
    const prev = matches.at(-1);
    // Unless it continues a run, jump ahead to a word start holding `ch`.
    if (preferWordStarts && (prev === undefined || i !== prev + 1)) {
      i = nextWordStart(t, ch, i);
    }
    score += prev !== undefined && i === prev + 1 ? 6 : 1;
    score += isWordStart(t, i) ? 8 : 0;
    score -= prev === undefined ? i * 0.5 : (i - prev - 1) * 0.2;
    matches.push(i);
    from = i + 1;
  }
  return { score, matches };
}

/**
 * Fuzzy match. Returns the matched character indices and a score that favours
 * contiguous runs, word starts and early matches; null when `query` is not a
 * subsequence of `text`.
 */
export function fuzzyMatch(
  text: string,
  query: string
): { score: number; matches: number[] } | null {
  const t = text.toLowerCase();
  const q = query.toLowerCase().replace(WHITESPACE, "");
  if (!q) {
    return { score: 0, matches: [] };
  }
  const at = t.indexOf(q);
  if (at >= 0) {
    const matches = Array.from({ length: q.length }, (_, k) => at + k);
    return { score: 100 - at + (isWordStart(t, at) ? 30 : 0), matches };
  }
  return subsequence(t, q, true) ?? subsequence(t, q, false);
}

function scoreEntry(entry: Entry, query: string) {
  const onLabel = fuzzyMatch(entry.item.label, query);
  if (onLabel) {
    return onLabel;
  }
  // Parent labels and keywords still find the row, ranked lower, unbolded.
  const extra = [
    ...entry.path.map((p) => p.label),
    ...(entry.item.keywords ?? []),
  ];
  let best: number | null = null;
  for (const word of extra) {
    const hit = fuzzyMatch(word, query);
    if (hit && (best === null || hit.score > best)) {
      best = hit.score;
    }
  }
  return best === null ? null : { score: best / 2, matches: [] };
}

/* ---------------------------------------------------------------- sections */

function flatten(items: CommandItem[], path: CommandItem[] = []): Entry[] {
  const out: Entry[] = [];
  for (const item of items) {
    out.push({ item, path });
    if (item.children) {
      out.push(...flatten(item.children, [...path, item]));
    }
  }
  return out;
}

function groupRows(rows: Row[], fallback?: string): Section[] {
  const byGroup = new Map<string, Row[]>();
  for (const row of rows) {
    const label = row.path[0]?.group ?? row.item.group ?? fallback ?? "";
    const list = byGroup.get(label) ?? [];
    list.push(row);
    byGroup.set(label, list);
  }
  return [...byGroup].map(([label, list]) => ({
    key: label || "items",
    label: label || undefined,
    rows: list,
  }));
}

function buildSections(
  page: CommandItem | undefined,
  rootItems: CommandItem[],
  query: string,
  recent: Entry[]
): Section[] {
  const items = page?.children ?? rootItems;
  const fallback = page?.label;

  if (!query.trim()) {
    const rows = items.map<Row>((item) => ({
      item,
      path: [],
      key: item.id,
      matches: [],
      score: 0,
    }));
    const sections = groupRows(rows, fallback);
    if (!page && recent.length > 0) {
      sections.unshift({
        key: "recent",
        label: "Recent",
        rows: recent.map((e) => ({
          ...e,
          key: `recent-${e.item.id}`,
          matches: [],
          score: 0,
        })),
      });
    }
    return sections;
  }

  // Searching from a page also reaches the rows nested inside it.
  const rows: Row[] = [];
  for (const entry of flatten(items)) {
    const hit = scoreEntry(entry, query);
    if (hit) {
      rows.push({ ...entry, key: entry.item.id, ...hit });
    }
  }
  const sections = groupRows(rows, fallback);
  for (const section of sections) {
    section.rows.sort((a, b) => b.score - a.score);
  }
  return sections;
}

function findEntry(items: CommandItem[], id: string): Entry | undefined {
  return flatten(items).find((e) => e.item.id === id);
}

/* ---------------------------------------------------------------- pieces */

function Highlighted({ text, matches }: { text: string; matches: number[] }) {
  if (matches.length === 0) {
    return <>{text}</>;
  }
  const hit = new Set(matches);
  const parts: { start: number; text: string; on: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const on = hit.has(i);
    const last = parts.at(-1);
    if (last && last.on === on) {
      last.text += text[i];
    } else {
      parts.push({ start: i, text: text[i] ?? "", on });
    }
  }
  return (
    <>
      {parts.map((p) =>
        p.on ? (
          <b
            className="font-semibold text-zinc-950 dark:text-white"
            key={p.start}
          >
            {p.text}
          </b>
        ) : (
          <span key={p.start}>{p.text}</span>
        )
      )}
    </>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-zinc-200 bg-zinc-50 px-1 font-sans text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
      {children}
    </kbd>
  );
}

function RowEnd({
  item,
  status,
}: {
  item: CommandItem;
  status: "pending" | "done" | undefined;
}) {
  if (status === "pending") {
    return (
      <LoaderCircle
        aria-hidden="true"
        className="size-4 animate-spin text-zinc-500 dark:text-zinc-400"
      />
    );
  }
  if (status === "done") {
    return (
      <Check
        aria-hidden="true"
        className="size-4 text-zinc-900 dark:text-zinc-100"
      />
    );
  }
  if (item.children) {
    return <ChevronRight aria-hidden="true" className="size-4 text-zinc-400" />;
  }
  if (item.href) {
    return <ArrowUpRight aria-hidden="true" className="size-4 text-zinc-400" />;
  }
  if (item.shortcut) {
    return (
      <span aria-hidden="true" className="flex gap-0.5">
        {item.shortcut.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </span>
    );
  }
  return null;
}

function isPaletteCombo(e: globalThis.KeyboardEvent) {
  return (
    (e.metaKey || e.ctrlKey) &&
    !e.altKey &&
    !e.shiftKey &&
    e.key.toLowerCase() === "k"
  );
}

/** Focus sits in an open modal dialog that does not hold the palette. */
function inOtherModal(focused: Element | null, root: HTMLElement) {
  const modal = focused?.closest('[aria-modal="true"]');
  return Boolean(modal && !modal.contains(root));
}

function useIsMac() {
  const [mac, setMac] = useState(true);
  useEffect(() => {
    setMac(APPLE_PLATFORM.test(navigator.userAgent));
  }, []);
  return mac;
}

/* ---------------------------------------------------------------- palette */

function ActionSearchBar({
  items = sampleItems,
  defaultRecent = ["copy-link", "theme-dark"],
  onSelect,
  onOpenChange,
  defaultOpen = false,
  shortcut = false,
  label = "Search commands",
  placeholder = "Search or jump to…",
  className,
}: ActionSearchBarProps) {
  const uid = useId();
  const inputId = `${uid}-input`;
  const listboxId = `${uid}-listbox`;
  const optionId = (index: number) => `${uid}-option-${index}`;

  const reduce = useReducedMotion();
  const isMac = useIsMac();

  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const [stack, setStack] = useState<CommandItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [running, setRunning] = useState<{
    key: string;
    phase: "pending" | "done";
  } | null>(null);
  const [recentIds, setRecentIds] = useState(defaultRecent);
  const [announcement, setAnnouncement] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const onScreenRef = useRef(true);
  const hoverRef = useRef(false);
  const fadeNextOpen = useRef(false);
  const slideNext = useRef<0 | 1 | -1>(0);
  const springUntil = useRef(0);
  const returnFocus = useRef<HTMLElement | null>(null);
  const holdTimer = useRef<number | undefined>(undefined);
  const runToken = useRef(0);

  const page = stack.at(-1);
  const recent = useMemo(
    () =>
      recentIds
        .map((id) => findEntry(items, id))
        .filter((e): e is Entry => e !== undefined && !e.item.children)
        .slice(0, RECENT_LIMIT),
    [recentIds, items]
  );
  const sections = useMemo(
    () => buildSections(page, items, query, recent),
    [page, items, query, recent]
  );
  const rows = useMemo(() => sections.flatMap((s) => s.rows), [sections]);
  const highlighted = Math.min(activeIndex, rows.length - 1);
  const activeRow = open ? rows[highlighted] : undefined;

  /* -- open / close -- */

  const setOpenState = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange]
  );

  const openPalette = useCallback(
    (source: InputSource) => {
      if (open) {
        return;
      }
      fadeNextOpen.current = source === "pointer";
      setActiveIndex(0);
      setOpenState(true);
    },
    [open, setOpenState]
  );

  const closePalette = useCallback(
    (restoreFocus: boolean) => {
      window.clearTimeout(holdTimer.current);
      runToken.current += 1;
      setRunning(null);
      setOpenState(false);
      setQuery("");
      setStack([]);
      setActiveIndex(0);
      const target = returnFocus.current;
      returnFocus.current = null;
      if (restoreFocus && target?.isConnected) {
        target.focus();
      }
    },
    [setOpenState]
  );

  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  /* -- ⌘K, only while the palette is on screen -- */

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const io = new IntersectionObserver(([entry]) => {
      onScreenRef.current = entry?.isIntersecting ?? true;
    });
    io.observe(root);
    return () => io.disconnect();
  }, []);

  const hotkeyState = useRef({ open, openPalette, closePalette });
  useEffect(() => {
    hotkeyState.current = { open, openPalette, closePalette };
  });

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const root = rootRef.current;
      if (
        !(isPaletteCombo(e) && root && onScreenRef.current) ||
        e.defaultPrevented
      ) {
        return;
      }
      const focused = document.activeElement;
      const focusedInside = focused instanceof Node && root.contains(focused);
      if (!(shortcut || focusedInside || hoverRef.current)) {
        return;
      }
      if (inOtherModal(focused, root)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const state = hotkeyState.current;
      if (state.open) {
        state.closePalette(true);
        return;
      }
      if (focused instanceof HTMLElement && !focusedInside) {
        returnFocus.current = focused;
      }
      inputRef.current?.focus();
      inputRef.current?.select();
      state.openPalette("keyboard");
    };
    // Capture, so the host page's ⌘K does not also fire when this one takes it.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [shortcut]);

  /* -- motion: fade on pointer open; slide + spring on pointer page change -- */

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!(open && panel && fadeNextOpen.current)) {
      return;
    }
    fadeNextOpen.current = false;
    panel.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 120,
      easing: EASE_OUT,
    });
  }, [open]);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    const content = contentRef.current;
    if (!(open && body && content)) {
      return;
    }
    let controls: ReturnType<typeof animate> | undefined;
    const fitHeight = () => {
      const h = `${content.offsetHeight}px`;
      controls?.stop();
      if (!reduce && performance.now() < springUntil.current) {
        controls = animate(
          body,
          { height: h },
          { type: "spring", bounce: 0, duration: 0.32 }
        );
      } else {
        body.style.height = h;
      }
    };
    fitHeight();
    const ro = new ResizeObserver(fitHeight);
    ro.observe(content);
    return () => {
      ro.disconnect();
      controls?.stop();
    };
  }, [open, reduce]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the page changes
  useLayoutEffect(() => {
    const list = listRef.current;
    const dir = slideNext.current;
    slideNext.current = 0;
    if (!list || dir === 0) {
      return;
    }
    list.animate(
      [
        {
          transform: reduce ? "none" : `translateX(${dir * 14}px)`,
          opacity: 0,
        },
        { transform: "none", opacity: 1 },
      ],
      { duration: 200, easing: EASE_OUT }
    );
  }, [stack.length]);

  // Keep the highlighted row inside the list's scroll box (never the page).
  // biome-ignore lint/correctness/useExhaustiveDependencies: optionId is derived from uid
  useLayoutEffect(() => {
    const list = listRef.current;
    const row = document.getElementById(optionId(highlighted));
    if (!(open && list && row)) {
      return;
    }
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < list.scrollTop + 6) {
      list.scrollTop = top - 30;
    } else if (bottom > list.scrollTop + list.clientHeight - 6) {
      list.scrollTop = bottom - list.clientHeight + 6;
    }
  }, [open, highlighted, sections]);

  /* -- pages -- */

  const pushPage = (item: CommandItem, source: InputSource) => {
    if (source === "pointer") {
      slideNext.current = 1;
      springUntil.current = performance.now() + 150;
    }
    setStack((s) => [...s, item]);
    setQuery("");
    setActiveIndex(0);
    setAnnouncement(`${item.label}, ${item.children?.length ?? 0} options`);
  };

  const popPage = (source: InputSource) => {
    const left = stack.at(-1);
    if (!left) {
      return;
    }
    if (source === "pointer") {
      slideNext.current = -1;
      springUntil.current = performance.now() + 150;
    }
    const nextStack = stack.slice(0, -1);
    setStack(nextStack);
    setQuery("");
    // Land back on the row that opened the page.
    const back = buildSections(nextStack.at(-1), items, "", recent)
      .flatMap((s) => s.rows)
      .findIndex((r) => r.key === left.id);
    setActiveIndex(Math.max(0, back));
    setAnnouncement(nextStack.at(-1)?.label ?? "All commands");
    inputRef.current?.focus();
  };

  /* -- running -- */

  const finishRun = (row: Row, token: number) => {
    if (token !== runToken.current) {
      return;
    }
    setRunning({ key: row.key, phase: "done" });
    setAnnouncement(`${row.item.label}, done`);
    holdTimer.current = window.setTimeout(() => {
      if (token !== runToken.current) {
        return;
      }
      setRecentIds((ids) =>
        [row.item.id, ...ids.filter((id) => id !== row.item.id)].slice(
          0,
          RECENT_LIMIT
        )
      );
      closePalette(returnFocus.current !== null);
    }, HOLD_MS);
  };

  const runRow = (row: Row) => {
    runToken.current += 1;
    const token = runToken.current;
    const result = onSelect?.(row.item, [...stack, ...row.path]);
    if (!(result instanceof Promise)) {
      finishRun(row, token);
      return;
    }
    setRunning({ key: row.key, phase: "pending" });
    setAnnouncement(`Running ${row.item.label}`);
    result.then(
      () => finishRun(row, token),
      () => {
        if (token === runToken.current) {
          setRunning(null);
          setAnnouncement(`${row.item.label} failed`);
        }
      }
    );
  };

  const choose = (row: Row, source: InputSource) => {
    if (running) {
      return;
    }
    if (row.item.children) {
      pushPage(row.item, source);
    } else {
      runRow(row);
    }
  };

  /* -- input -- */

  const moveHighlight = (step: number) => {
    const count = rows.length;
    if (count > 0) {
      setActiveIndex((Math.max(highlighted, 0) + step + count) % count);
    }
  };

  const handleNavKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      e.preventDefault();
      openPalette("keyboard");
      return;
    }
    if (rows.length === 0) {
      return;
    }
    e.preventDefault();
    if (e.key === "Home" || e.key === "End") {
      setActiveIndex(e.key === "Home" ? 0 : rows.length - 1);
    } else {
      moveHighlight(e.key === "ArrowDown" ? 1 : -1);
    }
  };

  const handleEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (!open) {
      openPalette("keyboard");
    } else if (activeRow) {
      choose(activeRow, "keyboard");
    }
  };

  const handleEscape = (e: KeyboardEvent<HTMLInputElement>) => {
    if (open) {
      e.preventDefault();
      closePalette(true);
    } else if (query) {
      setQuery("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (running && e.key !== "Tab") {
      e.preventDefault();
      return;
    }
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
      case "Home":
      case "End":
        handleNavKey(e);
        break;
      case "Enter":
        handleEnter(e);
        break;
      case "Backspace":
        if (open && query === "" && stack.length > 0) {
          e.preventDefault();
          popPage("keyboard");
        }
        break;
      case "Escape":
        handleEscape(e);
        break;
      default:
        break;
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setActiveIndex(0);
    openPalette("keyboard");
  };

  const handleInputPointerDown = (e: PointerEvent<HTMLInputElement>) => {
    if (e.button === 0) {
      openPalette("pointer");
    }
  };

  // Close when focus leaves the whole palette (Tab away, click outside).
  const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget;
    if (open && !(next instanceof Node && e.currentTarget.contains(next))) {
      returnFocus.current = null;
      closePalette(false);
    }
  };

  const pagePlaceholder = page
    ? (page.placeholder ?? `Search ${page.label.toLowerCase()}…`)
    : placeholder;

  let rowIndex = -1;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: focusout from the whole palette closes it
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: same focusout handler
    <div
      className={cn("relative h-[46px] w-full max-w-md", className)}
      onBlur={handleBlur}
      onPointerEnter={(e) => {
        hoverRef.current = e.pointerType === "mouse";
      }}
      onPointerLeave={() => {
        hoverRef.current = false;
      }}
      ref={rootRef}
    >
      <div
        className={cn(
          "@container/palette absolute inset-x-0 top-0 z-30 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
          open
            ? "shadow-[0_16px_40px_-16px_rgb(0_0_0/0.2)] dark:shadow-[0_16px_40px_-16px_rgb(0_0_0/0.7)]"
            : "shadow-xs"
        )}
      >
        <div className="flex h-11 items-center gap-2 px-3">
          <Search
            aria-hidden="true"
            className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500"
          />
          {stack.map((p, i) => (
            <button
              aria-label={`Back from ${p.label}`}
              className="inline-flex h-6 shrink-0 items-center rounded-md bg-zinc-100 px-2 font-medium text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              key={p.id}
              onClick={() => {
                if (i === stack.length - 1 && !running) {
                  popPage("pointer");
                }
              }}
              // Keep focus in the input; Backspace is the keyboard path.
              onPointerDown={(e) => e.preventDefault()}
              tabIndex={-1}
              type="button"
            >
              {p.label}
            </button>
          ))}
          <label className="sr-only" htmlFor={inputId}>
            {label}
          </label>
          <input
            aria-activedescendant={
              activeRow ? optionId(highlighted) : undefined
            }
            aria-autocomplete="list"
            aria-controls={open ? listboxId : undefined}
            aria-expanded={open}
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            id={inputId}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPointerDown={handleInputPointerDown}
            placeholder={pagePlaceholder}
            readOnly={running !== null}
            ref={inputRef}
            role="combobox"
            spellCheck={false}
            type="text"
            value={query}
          />
          {!open && (
            <span aria-hidden="true" className="flex shrink-0 gap-0.5">
              <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
              <Kbd>K</Kbd>
            </span>
          )}
        </div>

        {open && (
          <div
            // Keep focus in the input while pressing inside the list, so its
            // blur never closes the palette before the click lands.
            onPointerDown={(e) => e.preventDefault()}
            ref={panelRef}
          >
            <div className="border-zinc-100 border-t dark:border-zinc-800/80" />
            <div className="overflow-hidden" ref={bodyRef}>
              <div ref={contentRef}>
                <div
                  aria-busy={running?.phase === "pending"}
                  aria-label={page ? page.label : "Commands"}
                  className="relative max-h-72 overflow-y-auto overscroll-contain p-1.5"
                  id={listboxId}
                  ref={listRef}
                  role="listbox"
                >
                  {sections.map((section) => (
                    // biome-ignore lint/a11y/useSemanticElements: ARIA listbox groups, not a form fieldset
                    <div
                      aria-labelledby={
                        section.label ? `${uid}-${section.key}` : undefined
                      }
                      key={section.key}
                      role="group"
                    >
                      {section.label && (
                        <div
                          className="px-2 pt-2 pb-1 font-medium text-[11px] text-zinc-500 dark:text-zinc-400"
                          id={`${uid}-${section.key}`}
                          role="presentation"
                        >
                          {section.label}
                        </div>
                      )}
                      {section.rows.map((row) => {
                        rowIndex += 1;
                        const index = rowIndex;
                        const status =
                          running?.key === row.key ? running.phase : undefined;
                        return (
                          // biome-ignore lint/a11y/useFocusableInteractive: combobox pattern, focus stays in the input (aria-activedescendant)
                          // biome-ignore lint/a11y/useKeyWithClickEvents: keys are handled by the input
                          <div
                            aria-disabled={running !== null && !status}
                            aria-selected={index === highlighted}
                            className="group/row flex h-9 cursor-default items-center gap-2.5 rounded-md px-2 text-sm text-zinc-700 aria-disabled:opacity-50 aria-selected:bg-zinc-100 dark:text-zinc-300 dark:aria-selected:bg-zinc-800/70"
                            id={optionId(index)}
                            key={row.key}
                            onClick={() => choose(row, "pointer")}
                            onPointerMove={(e) => {
                              if (
                                e.pointerType === "mouse" &&
                                !running &&
                                index !== highlighted
                              ) {
                                setActiveIndex(index);
                              }
                            }}
                            role="option"
                          >
                            <span
                              aria-hidden="true"
                              className="flex size-4 shrink-0 items-center justify-center text-zinc-400 group-aria-selected/row:text-zinc-700 dark:text-zinc-500 dark:group-aria-selected/row:text-zinc-200"
                            >
                              {row.item.icon}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              {row.path.map((p) => (
                                <span
                                  className="text-zinc-400 dark:text-zinc-500"
                                  key={p.id}
                                >
                                  {p.label}
                                  <span aria-hidden="true"> › </span>
                                </span>
                              ))}
                              <Highlighted
                                matches={row.matches}
                                text={row.item.label}
                              />
                              {row.item.children && (
                                <span className="sr-only">, opens a page</span>
                              )}
                            </span>
                            <span className="flex shrink-0 items-center">
                              <RowEnd item={row.item} status={status} />
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {rows.length === 0 && (
                  <p className="px-3 pt-1 pb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    No results for “{query.trim()}”
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-zinc-100 border-t px-3 py-2 text-[11px] text-zinc-500 dark:border-zinc-800/80 dark:text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="@xs/palette:flex hidden items-center gap-1.5">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                  <span className="mr-1.5">Navigate</span>
                </span>
                <Kbd>↵</Kbd>
                <span>{activeRow?.item.children ? "Open" : "Run"}</span>
              </span>
              <span className="flex items-center gap-1.5">
                {stack.length > 0 && (
                  <>
                    <Kbd>⌫</Kbd>
                    <span className="mr-1.5">Back</span>
                  </>
                )}
                <Kbd>esc</Kbd>
                <span>Close</span>
              </span>
            </div>
          </div>
        )}
      </div>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}

export default ActionSearchBar;
