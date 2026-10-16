"use client";

/**
 * @author: @dorianbaffier
 * @description: Path Breadcrumb
 * @version: 1.0.0
 * @date: 2026-10-16
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, ChevronsUpDown, Ellipsis } from "lucide-react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  type Transition,
} from "motion/react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface PathNode {
  id: string;
  label: string;
  children?: PathNode[];
}

export interface PathBreadcrumbProps {
  /** The top level: teams, workspaces or drives. Each crumb can switch to its siblings. */
  items: PathNode[];
  /** Ids from the top level down to the current page. */
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (path: string[]) => void;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const CRUMB: Transition = { duration: 0.2, ease: EASE_OUT };
const MENU: Transition = { duration: 0.15, ease: EASE_OUT };
// Room the "…" crumb and its separator take when middle levels collapse.
const ELLIPSIS_WIDTH = 44;
const MENU_WIDTH = 224;
const PRINTABLE = /\S/;

/** Walks the ids down the tree; stops at the first one that isn't there. */
function resolve(items: PathNode[], path: string[]): PathNode[] {
  const nodes: PathNode[] = [];
  let level: PathNode[] | undefined = items;
  for (const id of path) {
    const node: PathNode | undefined = level?.find((n) => n.id === id);
    if (!node) {
      break;
    }
    nodes.push(node);
    level = node.children;
  }
  return nodes;
}

/**
 * Switching a crumb to a sibling keeps you as deep as it can: going from
 * Website › Settings › Domains to Mobile app lands on Mobile app › Settings
 * › Domains when those pages exist there too, matched by label.
 */
function carryOver(target: PathNode, rest: PathNode[]): string[] {
  const ids: string[] = [];
  let level = target.children;
  for (const node of rest) {
    const match = level?.find((n) => n.label === node.label);
    if (!match) {
      break;
    }
    ids.push(match.id);
    level = match.children;
  }
  return ids;
}

interface MenuProps {
  /** Who the menu is for, read out as its name. */
  label: string;
  options: PathNode[];
  current?: string;
  align: "start" | "end";
  onPick: (node: PathNode) => void;
  onClose: (refocus: boolean) => void;
}

function Menu({ label, options, current, align, onPick, onClose }: MenuProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });

  // Focus starts on the current option, like a native select.
  useEffect(() => {
    const list = listRef.current;
    const start =
      list?.querySelector<HTMLElement>('[aria-checked="true"]') ??
      list?.querySelector<HTMLElement>('[role="menuitemradio"]');
    start?.focus({ preventScroll: true });
  }, []);

  // Type the first letters of an option to jump to it.
  const typeAhead = (key: string) => {
    const now = Date.now();
    const text =
      (now - typed.current.at < 600 ? typed.current.text : "") +
      key.toLowerCase();
    typed.current = { text, at: now };
    return options.findIndex((o) => o.label.toLowerCase().startsWith(text));
  };

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitemradio"]'
      ) ?? []
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") {
        event.preventDefault();
      }
      onClose(event.key === "Escape");
      return;
    }
    const steps: Record<string, number> = {
      ArrowDown: (index + 1) % items.length,
      ArrowUp: (index - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    };
    let next = steps[event.key] ?? -1;
    if (event.key.length === 1 && PRINTABLE.test(event.key)) {
      next = typeAhead(event.key);
    }
    if (next >= 0) {
      event.preventDefault();
      items[next]?.focus();
    }
  };

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      aria-label={label}
      className={cn(
        "absolute top-full z-20 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-black/5 shadow-lg dark:border-gray-800 dark:bg-gray-950 dark:shadow-black/40",
        align === "start"
          ? "left-0 origin-top-left"
          : "right-0 origin-top-right"
      )}
      exit={{ opacity: 0, scale: 0.97, y: -2 }}
      initial={{ opacity: 0, scale: 0.97, y: -2 }}
      onKeyDown={move}
      ref={listRef}
      role="menu"
      style={{ width: MENU_WIDTH }}
      transition={MENU}
    >
      {options.map((option) => {
        const selected = option.id === current;
        return (
          <button
            aria-checked={selected}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-gray-700 text-sm outline-none transition-colors duration-100 hover:bg-gray-100 focus-visible:bg-gray-100 dark:text-gray-300 dark:focus-visible:bg-gray-900 dark:hover:bg-gray-900"
            key={option.id}
            onClick={() => onPick(option)}
            role="menuitemradio"
            tabIndex={-1}
            type="button"
          >
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            {option.children?.length ? (
              <span className="text-gray-400 text-xs tabular-nums dark:text-gray-500">
                {option.children.length}
              </span>
            ) : null}
            <Check
              aria-hidden="true"
              className={cn(
                "size-3.5 shrink-0 text-gray-900 dark:text-gray-100",
                !selected && "invisible"
              )}
            />
          </button>
        );
      })}
    </motion.div>
  );
}

function Separator() {
  return (
    <span
      aria-hidden="true"
      className="select-none px-1 text-gray-300 dark:text-gray-700"
    >
      /
    </span>
  );
}

/**
 * A breadcrumb for deep app navigation. Each crumb can switch to its
 * siblings without going back up, and the middle of a long path folds into
 * a "…" crumb so the bar never wraps.
 */
export function PathBreadcrumb({
  items,
  value,
  defaultValue,
  onValueChange,
  className,
}: PathBreadcrumbProps) {
  const [ownPath, setOwnPath] = useState<string[]>(
    () => defaultValue ?? (items[0] ? [items[0].id] : [])
  );
  const nodes = resolve(items, value ?? ownPath);
  const navRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLOListElement>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement | null>());
  // How many levels after the first are folded into the "…" crumb.
  const [folded, setFolded] = useState(0);
  const [open, setOpen] = useState<{
    key: string;
    align: "start" | "end";
  } | null>(null);

  const go = useCallback(
    (path: string[]) => {
      setOwnPath(path);
      onValueChange?.(path);
    },
    [onValueChange]
  );

  // Fold from the second level onward until the row fits. The first and
  // the last level always stay; the last truncates if even that's too wide.
  useLayoutEffect(() => {
    const nav = navRef.current;
    const measure = measureRef.current;
    if (!(nav && measure)) {
      return;
    }
    const refit = () => {
      const widths = Array.from(measure.children).map(
        (child) => (child as HTMLElement).getBoundingClientRect().width
      );
      const available = nav.clientWidth;
      const total = widths.reduce((a, b) => a + b, 0);
      if (total <= available || widths.length <= 2) {
        setFolded(0);
        return;
      }
      let width = total + ELLIPSIS_WIDTH;
      let count = 0;
      // Never fold the last level.
      while (width > available && count < widths.length - 2) {
        width -= widths[count + 1] ?? 0;
        count++;
      }
      setFolded(count);
    };
    refit();
    // The copy changes size when the path does; the bar when its box does.
    const observer = new ResizeObserver(refit);
    observer.observe(nav);
    observer.observe(measure);
    return () => observer.disconnect();
  }, []);

  // Clicking anywhere else closes a menu.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) {
        setOpen(null);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const toggle = (menuKey: string) => {
    if (open?.key === menuKey) {
      setOpen(null);
      return;
    }
    // A menu near the right edge opens leftward so it stays on screen.
    const trigger = triggers.current.get(menuKey);
    const nav = navRef.current;
    let align: "start" | "end" = "start";
    const crumb = trigger?.closest("li");
    if (crumb && nav) {
      const from =
        crumb.getBoundingClientRect().left - nav.getBoundingClientRect().left;
      if (from + MENU_WIDTH > nav.clientWidth) {
        align = "end";
      }
    }
    setOpen({ key: menuKey, align });
  };

  const close = (menuKey: string, refocus: boolean) => {
    setOpen(null);
    if (refocus) {
      triggers.current.get(menuKey)?.focus();
    }
  };

  const siblingsOf = (level: number) =>
    level === 0 ? items : (nodes[level - 1]?.children ?? []);

  const switchTo = (level: number, node: PathNode) => {
    const head = nodes.slice(0, level).map((n) => n.id);
    go([...head, node.id, ...carryOver(node, nodes.slice(level + 1))]);
    setOpen(null);
  };

  const visible = nodes
    .map((node, level) => ({ node, level }))
    .filter(({ level }) => level === 0 || level > folded);
  const hidden = nodes.slice(1, folded + 1);
  const current = nodes.at(-1);
  const below = current?.children ?? [];

  const crumbClass =
    "rounded-md px-1.5 py-1 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-gray-400";

  return (
    <MotionConfig reducedMotion="user">
      <nav
        aria-label="Breadcrumb"
        className={cn("relative w-full min-w-0 text-sm", className)}
        ref={navRef}
      >
        {/* An invisible copy of every crumb, measured to decide what folds. */}
        <ol
          aria-hidden="true"
          className="pointer-events-none invisible absolute top-0 left-0 flex whitespace-nowrap"
          ref={measureRef}
        >
          {nodes.map((node, level) => (
            <li className="flex items-center" key={node.id}>
              {level > 0 && <Separator />}
              <span className={cn(crumbClass, "font-medium")}>
                {node.label}
              </span>
              <span className="w-3" />
            </li>
          ))}
          {below.length > 0 && (
            <li className="flex items-center">
              <Separator />
              <span className="w-7" />
            </li>
          )}
        </ol>

        <ol className="flex min-w-0 items-center whitespace-nowrap">
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map(({ node, level }, index) => {
              const isLast = level === nodes.length - 1;
              const siblings = siblingsOf(level);
              const canSwitch = siblings.length > 1;
              const menuKey = `level-${level}`;
              return (
                <motion.li
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "relative flex items-center",
                    isLast && "min-w-0"
                  )}
                  exit={{ opacity: 0, x: -6 }}
                  initial={{ opacity: 0, x: 8 }}
                  key={node.id}
                  layout="position"
                  transition={CRUMB}
                >
                  {level > 0 && <Separator />}
                  {index === 1 && hidden.length > 0 && (
                    <>
                      <span className="relative flex items-center">
                        <button
                          aria-expanded={open?.key === "folded"}
                          aria-haspopup="menu"
                          aria-label={`${hidden.length} more levels`}
                          className={cn(
                            crumbClass,
                            "flex items-center text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-100"
                          )}
                          onClick={() => toggle("folded")}
                          ref={(el) => {
                            triggers.current.set("folded", el);
                          }}
                          type="button"
                        >
                          <Ellipsis aria-hidden="true" className="size-4" />
                        </button>
                        <AnimatePresence>
                          {open?.key === "folded" && (
                            <Menu
                              align="start"
                              label="Folded levels"
                              onClose={(refocus) => close("folded", refocus)}
                              onPick={(picked) => {
                                const at = nodes.indexOf(picked);
                                go(nodes.slice(0, at + 1).map((n) => n.id));
                                setOpen(null);
                              }}
                              options={hidden}
                            />
                          )}
                        </AnimatePresence>
                      </span>
                      <Separator />
                    </>
                  )}
                  {isLast ? (
                    <span
                      aria-current="page"
                      className={cn(
                        crumbClass,
                        "min-w-0 truncate font-medium text-gray-900 dark:text-gray-100"
                      )}
                    >
                      {node.label}
                    </span>
                  ) : (
                    <button
                      className={cn(
                        crumbClass,
                        "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                      )}
                      onClick={() =>
                        go(nodes.slice(0, level + 1).map((n) => n.id))
                      }
                      type="button"
                    >
                      {node.label}
                    </button>
                  )}
                  {canSwitch && (
                    <button
                      aria-expanded={open?.key === menuKey}
                      aria-haspopup="menu"
                      aria-label={`Switch ${node.label}`}
                      className="-ml-1 flex size-4 shrink-0 items-center justify-center rounded text-gray-400 outline-none transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-400 aria-expanded:bg-gray-100 aria-expanded:text-gray-900 dark:text-gray-500 dark:aria-expanded:bg-gray-900 dark:aria-expanded:text-gray-100 dark:hover:bg-gray-900 dark:hover:text-gray-100"
                      onClick={() => toggle(menuKey)}
                      ref={(el) => {
                        triggers.current.set(menuKey, el);
                      }}
                      type="button"
                    >
                      <ChevronsUpDown aria-hidden="true" className="size-3" />
                    </button>
                  )}
                  <AnimatePresence>
                    {open?.key === menuKey && (
                      <Menu
                        align={open.align}
                        current={node.id}
                        label={`Switch ${node.label}`}
                        onClose={(refocus) => close(menuKey, refocus)}
                        onPick={(picked) => switchTo(level, picked)}
                        options={siblings}
                      />
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
            {below.length > 0 && current && (
              <motion.li
                animate={{ opacity: 1 }}
                className="relative flex items-center"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key={`below-${current.id}`}
                layout="position"
                transition={CRUMB}
              >
                <Separator />
                <button
                  aria-expanded={open?.key === "below"}
                  aria-haspopup="menu"
                  aria-label={`Open a page in ${current.label}`}
                  className={cn(
                    crumbClass,
                    "flex items-center text-gray-400 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-500 dark:hover:bg-gray-900 dark:hover:text-gray-100"
                  )}
                  onClick={() => toggle("below")}
                  ref={(el) => {
                    triggers.current.set("below", el);
                  }}
                  type="button"
                >
                  <ChevronsUpDown aria-hidden="true" className="size-3.5" />
                </button>
                <AnimatePresence>
                  {open?.key === "below" && (
                    <Menu
                      align={open.align}
                      label={`Pages in ${current.label}`}
                      onClose={(refocus) => close("below", refocus)}
                      onPick={(picked) => switchTo(nodes.length, picked)}
                      options={below}
                    />
                  )}
                </AnimatePresence>
              </motion.li>
            )}
          </AnimatePresence>
        </ol>
      </nav>
    </MotionConfig>
  );
}

const DEMO_PAGES = (prefix: string): PathNode[] => [
  { id: `${prefix}-deployments`, label: "Deployments" },
  { id: `${prefix}-analytics`, label: "Analytics" },
  {
    id: `${prefix}-settings`,
    label: "Settings",
    children: [
      { id: `${prefix}-general`, label: "General" },
      { id: `${prefix}-domains`, label: "Domains" },
      { id: `${prefix}-env`, label: "Environment variables" },
      { id: `${prefix}-members`, label: "Members" },
    ],
  },
];

const DEMO_ITEMS: PathNode[] = [
  {
    id: "acme",
    label: "Acme Inc",
    children: [
      { id: "website", label: "Website", children: DEMO_PAGES("website") },
      { id: "mobile", label: "Mobile app", children: DEMO_PAGES("mobile") },
      { id: "docs", label: "Docs", children: DEMO_PAGES("docs") },
      { id: "api", label: "Public API", children: DEMO_PAGES("api") },
    ],
  },
  {
    id: "personal",
    label: "Personal",
    children: [
      { id: "blog", label: "Blog", children: DEMO_PAGES("blog") },
      { id: "dotfiles", label: "Dotfiles", children: DEMO_PAGES("dotfiles") },
    ],
  },
];

/**
 * A project dashboard header. Switch the project from its crumb and you stay
 * on the same settings page; narrow the window and the middle folds away.
 */
export default function PathBreadcrumbDemo({
  className,
}: {
  className?: string;
}) {
  const [path, setPath] = useState([
    "acme",
    "website",
    "website-settings",
    "website-domains",
  ]);
  const nodes = resolve(DEMO_ITEMS, path);
  const current = nodes.at(-1);
  const below = current?.children ?? [];

  return (
    <div
      className={cn(
        "w-full max-w-xl rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950",
        className
      )}
    >
      <div className="border-gray-200 border-b px-3 py-2.5 dark:border-gray-800">
        <PathBreadcrumb
          items={DEMO_ITEMS}
          onValueChange={setPath}
          value={path}
        />
      </div>
      <div className="px-5 py-5">
        <p className="font-medium text-gray-900 text-lg tracking-tight dark:text-gray-100">
          {current?.label}
        </p>
        <p className="mt-1 text-gray-500 text-sm dark:text-gray-400">
          {nodes
            .slice(0, -1)
            .map((n) => n.label)
            .join(" · ") || "Workspace"}
        </p>
        {below.length > 0 ? (
          <ul className="mt-4 divide-y divide-gray-100 border-gray-200 border-y dark:divide-gray-900 dark:border-gray-800">
            {below.map((child) => (
              <li key={child.id}>
                <button
                  className="flex w-full items-center justify-between py-2.5 text-left text-gray-700 text-sm transition-colors duration-150 hover:text-gray-950 dark:text-gray-300 dark:hover:text-white"
                  onClick={() => setPath([...path, child.id])}
                  type="button"
                >
                  {child.label}
                  <span aria-hidden="true" className="text-gray-400">
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div aria-hidden="true" className="mt-4 space-y-2">
            <div className="h-2.5 w-2/3 rounded-full bg-gray-100 dark:bg-gray-900" />
            <div className="h-2.5 w-1/2 rounded-full bg-gray-100 dark:bg-gray-900" />
            <div className="h-2.5 w-3/5 rounded-full bg-gray-100 dark:bg-gray-900" />
          </div>
        )}
      </div>
    </div>
  );
}
