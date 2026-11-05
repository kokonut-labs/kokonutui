"use client";

/**
 * @author: @kokonutui
 * @description: JSON Inspector
 * @version: 1.0.0
 * @date: 2026-11-05
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, ChevronRight, Copy } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface JsonInspectorProps {
  data?: Json;
  /** The request line, e.g. "GET /v1/orders/ord_8Kq2xT". */
  request?: string;
  status?: string;
  /** Response time in ms. */
  time?: number;
  /** Paths open at first, as jq-style paths like `.items[0]`. */
  defaultExpanded?: string[];
  className?: string;
}

interface Node {
  path: string;
  label: string | number | null;
  value: Json;
  depth: number;
  /** Paths of the containers above, from the root down. */
  ancestors: string[];
  isContainer: boolean;
  isLast: boolean;
  /** The object or array holding this value. */
  parent: Json | null;
}

const ROW = 24;
const INDENT = 14;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

const DEMO: Json = {
  id: "ord_8Kq2xT",
  object: "order",
  status: "paid",
  created: 1_793_889_120,
  livemode: false,
  customer: {
    id: "cus_Q1w9Lr",
    email: "mara@acme.shop",
    name: "Mara Oyelaran",
  },
  items: [
    {
      sku: "TEE-BLK-M",
      name: "Heavyweight Tee",
      quantity: 2,
      price: { amount: 3800, currency: "eur" },
    },
    {
      sku: "CAP-OLV",
      name: "Six-panel Cap",
      quantity: 1,
      price: { amount: 2400, currency: "eur" },
    },
  ],
  shipping: {
    method: "express",
    address: {
      line1: "Rua das Flores 28",
      city: "Lisboa",
      postal_code: "1200-195",
      country: "PT",
    },
    tracking: null,
  },
  discount: null,
  total: { amount: 10_000, currency: "eur" },
  metadata: { source: "checkout", experiment: "free-shipping-50" },
};

const isObject = (v: Json): v is { [key: string]: Json } =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const entriesOf = (v: Json): [string | number, Json][] => {
  if (Array.isArray(v)) {
    return v.map((item, i) => [i, item]);
  }
  return isObject(v) ? Object.entries(v) : [];
};

const childPath = (parent: string, label: string | number) => {
  if (typeof label === "number") {
    return `${parent}[${label}]`;
  }
  return IDENTIFIER.test(label)
    ? `${parent}.${label}`
    : `${parent}[${JSON.stringify(label)}]`;
};

/** The rows on screen: every node whose ancestors are all open. */
function flatten(root: Json, expanded: Set<string>) {
  const rows: Node[] = [];
  const walk = (
    value: Json,
    path: string,
    label: Node["label"],
    depth: number,
    ancestors: string[],
    isLast: boolean,
    parent: Json | null
  ) => {
    const isContainer = typeof value === "object" && value !== null;
    rows.push({
      path,
      label,
      value,
      depth,
      ancestors,
      isContainer,
      isLast,
      parent,
    });
    if (isContainer && expanded.has(path)) {
      const entries = entriesOf(value);
      entries.forEach(([key, child], i) => {
        walk(
          child,
          childPath(path, key),
          key,
          depth + 1,
          [...ancestors, path],
          i === entries.length - 1,
          value
        );
      });
    }
  };
  walk(root, "", null, 0, [], true, null);
  return rows;
}

function allContainers(root: Json) {
  const paths: string[] = [];
  const walk = (value: Json, path: string) => {
    if (typeof value === "object" && value !== null) {
      paths.push(path);
      for (const [key, child] of entriesOf(value)) {
        walk(child, childPath(path, key));
      }
    }
  };
  walk(root, "");
  return paths;
}

const sizeOf = (data: Json) => {
  const bytes = new TextEncoder().encode(JSON.stringify(data)).length;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
};

type Token = string | number | "*";

const QUERY_TOKEN = /\.([^.[\]]*)|\[(\d*|\*|"[^"]*")\]/g;

/** `.items[].price` → ["items", "*", "price"]; null when it isn't a path. */
function parseQuery(query: string): Token[] | null {
  if (!(query.startsWith(".") || query.startsWith("["))) {
    return null;
  }
  const tokens: Token[] = [];
  for (const m of query.matchAll(QUERY_TOKEN)) {
    if (m[1] !== undefined) {
      tokens.push(m[1] === "*" ? "*" : m[1]);
    } else if (m[2] === "" || m[2] === "*") {
      tokens.push("*");
    } else {
      tokens.push(m[2].startsWith('"') ? m[2].slice(1, -1) : Number(m[2]));
    }
  }
  // A lone "." asks for the root.
  return tokens.length === 1 && tokens[0] === "" ? [] : tokens;
}

/** A node's own path as tokens: its ancestors' labels, then its own. */
const tokensOf = (node: Node, byPath: Map<string, Node>): Token[] =>
  [...node.ancestors.slice(1), node.path].map(
    (path) => byPath.get(path)?.label ?? ""
  );

/**
 * Whether a node answers the query. Paths match token by token, with `[]`
 * for any index and the last key matching as you type it; anything else
 * searches keys and values.
 */
function answers(node: Node, query: string, all: Map<string, Node>) {
  const tokens = parseQuery(query);
  if (!tokens) {
    const q = query.toLowerCase();
    const key = typeof node.label === "string" ? node.label.toLowerCase() : "";
    const value =
      typeof node.value === "object" ? "" : String(node.value).toLowerCase();
    return key.includes(q) || value.includes(q);
  }
  const own = tokensOf(node, all);
  if (own.length !== tokens.length || node.path === "") {
    return tokens.length === 0 && node.path === "";
  }
  return tokens.every((token, i) => {
    if (token === "*") {
      return typeof own[i] === "number";
    }
    const last = i === tokens.length - 1;
    if (last && typeof token === "string" && typeof own[i] === "string") {
      return (own[i] as string).startsWith(token);
    }
    return own[i] === token;
  });
}

export default function JsonInspector({
  data = DEMO,
  request = "GET /v1/orders/ord_8Kq2xT",
  status = "200 OK",
  time = 182,
  defaultExpanded = ["", ".items", ".items[0]", ".total"],
  className,
}: JsonInspectorProps) {
  const id = useId();
  const tree = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(() => new Set(defaultExpanded));
  const [selected, setSelected] = useState(".items[0].price");
  const [hovered, setHovered] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  /** What's typed in the path bar; null while it just shows the path. */
  const [query, setQuery] = useState<string | null>(null);

  const containers = useMemo(() => allContainers(data), [data]);
  const everything = useMemo(
    () => flatten(data, new Set(containers)),
    [data, containers]
  );
  const allByPath = useMemo(
    () => new Map(everything.map((node) => [node.path, node])),
    [everything]
  );
  const matches = useMemo(() => {
    if (!query?.trim()) {
      return [];
    }
    return everything
      .filter((node) => answers(node, query.trim(), allByPath))
      .map((node) => node.path);
  }, [query, everything, allByPath]);
  const matchSet = useMemo(() => new Set(matches), [matches]);

  // While querying, every match's containers open so it can be seen.
  const open = useMemo(() => {
    if (!matches.length) {
      return expanded;
    }
    const next = new Set(expanded);
    for (const path of matches) {
      for (const a of allByPath.get(path)?.ancestors ?? []) {
        next.add(a);
      }
    }
    return next;
  }, [expanded, matches, allByPath]);

  const rows = useMemo(() => flatten(data, open), [data, open]);
  const byPath = useMemo(
    () => new Map(rows.map((row) => [row.path, row])),
    [rows]
  );
  const selectedRow = byPath.get(selected) ?? rows[0];
  const shownPath = hovered ?? selectedRow.path;

  // The scope whose guide lights up: the selected container, or the one
  // holding the selected value.
  const scope =
    selectedRow.isContainer && open.has(selectedRow.path)
      ? selectedRow.path
      : selectedRow.ancestors.at(-1);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const reset = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(reset);
  }, [copied]);

  // Keep the selected row in view as the keyboard moves it.
  useEffect(() => {
    const el = tree.current;
    const index = rows.findIndex((row) => row.path === selectedRow.path);
    if (!el || index < 0) {
      return;
    }
    // Off screen, the row comes to the middle rather than the edge.
    const top = index * ROW;
    if (top < el.scrollTop || top + ROW > el.scrollTop + el.clientHeight) {
      el.scrollTop = top - el.clientHeight / 2 + ROW / 2;
    }
  }, [rows, selectedRow.path]);

  const toggle = (path: string, deep = false) => {
    setExpanded((current) => {
      const next = new Set(current);
      const opening = !next.has(path);
      const targets = deep
        ? containers.filter(
            (p) =>
              p === path || p.startsWith(`${path}.`) || p.startsWith(`${path}[`)
          )
        : [path];
      for (const target of targets) {
        if (opening) {
          next.add(target);
        } else {
          next.delete(target);
        }
      }
      return next;
    });
  };

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(selectedRow.path || ".");
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  // Typing moves the selection to the first match, which scrolls it in.
  useEffect(() => {
    if (matches.length && !matches.includes(selected)) {
      setSelected(matches[0]);
    }
  }, [matches, selected]);

  const startQuery = () => setQuery(selectedRow.path || ".");
  // Leaving the bar keeps what the query opened, so the pick stays in view.
  const endQuery = () => {
    setExpanded(open);
    setQuery(null);
  };
  const jump = (step: number) => {
    if (!matches.length) {
      return;
    }
    const at = matches.indexOf(selectedRow.path);
    const next = at < 0 ? 0 : (at + step + matches.length) % matches.length;
    setSelected(matches[next]);
  };
  const onQueryKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "ArrowDown") {
      event.preventDefault();
      jump(event.shiftKey ? -1 : 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      jump(-1);
    } else if (event.key === "Escape") {
      event.currentTarget.blur();
    }
  };

  /** The row a key moves the selection to, or null for keys we don't take. */
  const target = (key: string, index: number): string | null => {
    const row = rows[index];
    const open = row.isContainer && expanded.has(row.path);
    switch (key) {
      case "ArrowDown":
        return rows[Math.min(index + 1, rows.length - 1)].path;
      case "ArrowUp":
        return rows[Math.max(index - 1, 0)].path;
      case "Home":
        return rows[0].path;
      case "End":
        return rows.at(-1)?.path ?? row.path;
      case "ArrowRight":
        if (row.isContainer && !open) {
          toggle(row.path);
          return row.path;
        }
        return open ? (rows[index + 1]?.path ?? row.path) : row.path;
      case "ArrowLeft":
        if (open) {
          toggle(row.path);
          return row.path;
        }
        return row.ancestors.at(-1) ?? row.path;
      default:
        return null;
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = rows.findIndex((row) => row.path === selectedRow.path);
    if (event.key === "Enter" && selectedRow.isContainer) {
      event.preventDefault();
      toggle(selectedRow.path, event.altKey);
      return;
    }
    if (event.key === "c" && (event.metaKey || event.ctrlKey)) {
      copyPath();
      return;
    }
    const next = target(event.key, index);
    if (next !== null) {
      event.preventDefault();
      setSelected(next);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-lg overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
      >
        <div className="flex h-11 items-center gap-2 border-zinc-200 border-b px-3.5 font-mono text-[12px] dark:border-zinc-800">
          <span className="truncate text-zinc-700 dark:text-zinc-300">
            {request}
          </span>
          <span className="ml-auto shrink-0 text-emerald-700 dark:text-emerald-400">
            {status}
          </span>
          <span className="shrink-0 text-zinc-400 tabular-nums dark:text-zinc-500">
            {time} ms · {sizeOf(data)}
          </span>
        </div>

        <div className="flex h-9 items-center gap-1 border-zinc-100 border-b pr-1.5 pl-3.5 dark:border-zinc-800/70">
          <input
            aria-label="Path, type to filter"
            className={cn(
              "h-full min-w-0 flex-1 bg-transparent font-mono text-[12px] outline-hidden placeholder:text-zinc-400",
              query === null
                ? "text-zinc-900 dark:text-zinc-100"
                : "text-sky-700 dark:text-sky-300"
            )}
            onBlur={endQuery}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={(e) => {
              startQuery();
              requestAnimationFrame(() => e.target.select());
            }}
            onKeyDown={onQueryKey}
            placeholder=".items[].price"
            spellCheck={false}
            value={query ?? (shownPath || ".")}
          />
          <AnimatePresence initial={false}>
            {query?.trim() && (
              <motion.span
                animate={{ opacity: 1 }}
                className="shrink-0 pr-1 text-[11.5px] text-zinc-500 tabular-nums dark:text-zinc-400"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
              >
                {matches.length === 0
                  ? "No match"
                  : `${Math.max(matches.indexOf(selectedRow.path) + 1, 1)} of ${matches.length}`}
              </motion.span>
            )}
          </AnimatePresence>
          <button
            aria-label={copied ? "Path copied" : "Copy path"}
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12px] text-zinc-500 outline-hidden transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            onClick={copyPath}
            type="button"
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ opacity: 1, filter: "blur(0px)" }}
                className="flex"
                exit={{ opacity: 0, filter: "blur(2px)" }}
                initial={{ opacity: 0, filter: "blur(2px)" }}
                key={copied ? "done" : "copy"}
                transition={{ duration: 0.15 }}
              >
                {copied ? (
                  <Check
                    aria-hidden="true"
                    className="size-3.5 text-emerald-600 dark:text-emerald-400"
                  />
                ) : (
                  <Copy aria-hidden="true" className="size-3.5" />
                )}
              </motion.span>
            </AnimatePresence>
            Path
          </button>
        </div>

        <div
          aria-activedescendant={`${id}-${rows.indexOf(selectedRow)}`}
          aria-label="Response body"
          className="relative h-80 overflow-y-auto py-1.5 font-mono text-[12.5px] outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/30 focus-visible:ring-inset"
          onKeyDown={onKeyDown}
          onPointerLeave={() => setHovered(null)}
          ref={tree}
          role="tree"
          tabIndex={0}
        >
          {rows.map((row, i) => (
            <TreeRow
              expanded={open.has(row.path)}
              id={`${id}-${i}`}
              key={row.path || "root"}
              matched={matchSet.has(row.path)}
              onHover={() => setHovered(row.path)}
              onSelect={(deep) => {
                setSelected(row.path);
                if (row.isContainer) {
                  toggle(row.path, deep);
                }
              }}
              row={row}
              scope={scope}
              selected={row.path === selectedRow.path}
            />
          ))}
        </div>

        <div className="flex h-8 items-center gap-3 border-zinc-100 border-t px-3.5 text-[11px] text-zinc-400 dark:border-zinc-800/70 dark:text-zinc-500">
          <span>↑↓ move</span>
          <span>←→ fold</span>
          <span>type a path like .items[].price to find it</span>
        </div>
      </div>
    </MotionConfig>
  );
}

function TreeRow({
  row,
  id,
  matched,
  expanded,
  selected,
  scope,
  onSelect,
  onHover,
}: {
  row: Node;
  id: string;
  matched: boolean;
  expanded: boolean;
  selected: boolean;
  scope: string | undefined;
  onSelect: (deep: boolean) => void;
  onHover: () => void;
}) {
  const count = row.isContainer ? entriesOf(row.value).length : 0;
  const isArray = Array.isArray(row.value);
  const open = row.isContainer && expanded;
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: focus stays on the tree, rows are its active descendants
    // biome-ignore lint/a11y/useKeyWithClickEvents: the tree handles keys for every row
    <div
      aria-expanded={row.isContainer ? expanded : undefined}
      aria-level={row.depth + 1}
      aria-selected={selected}
      className={cn(
        "relative flex cursor-default items-center whitespace-nowrap pr-3 transition-colors duration-100",
        "hover:bg-zinc-50 dark:hover:bg-zinc-900",
        matched &&
          "bg-sky-500/[0.07] hover:bg-sky-500/10 dark:hover:bg-sky-500/10",
        selected && "bg-zinc-100 hover:bg-zinc-100 dark:bg-zinc-800/70",
        selected &&
          matched &&
          "bg-sky-500/15 hover:bg-sky-500/15 dark:bg-sky-500/20"
      )}
      id={id}
      onClick={(e) => onSelect(e.altKey)}
      onPointerEnter={onHover}
      role="treeitem"
      style={{ height: ROW, paddingLeft: 10 + row.depth * INDENT }}
    >
      {row.ancestors.map((path, level) => (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 w-px transition-colors duration-150",
            path === scope
              ? "bg-zinc-400 dark:bg-zinc-500"
              : "bg-zinc-200/80 dark:bg-zinc-800"
          )}
          key={path}
          style={{ left: 17 + level * INDENT }}
        />
      ))}
      <span className="flex w-3.5 shrink-0 justify-center">
        {row.isContainer && (
          <ChevronRight
            aria-hidden="true"
            className={cn(
              "size-3 text-zinc-400 transition-transform duration-150 dark:text-zinc-500",
              open && "rotate-90"
            )}
          />
        )}
      </span>
      {row.label !== null && (
        <span
          className={cn(
            "shrink-0 pl-0.5",
            typeof row.label === "number"
              ? "text-zinc-400 dark:text-zinc-500"
              : "text-zinc-800 dark:text-zinc-200",
            matched && "text-sky-700 dark:text-sky-300"
          )}
        >
          {row.label}
          <span className="text-zinc-400 dark:text-zinc-600">:</span>
        </span>
      )}
      <span className="min-w-0 truncate pl-1.5">
        {row.isContainer ? (
          <span className="text-zinc-400 dark:text-zinc-500">
            {isArray ? "[" : "{"}
            {!open && (
              <span className="px-1 font-sans text-[11.5px]">
                {count} {isArray ? "items" : "keys"}
              </span>
            )}
            {!open && (isArray ? "]" : "}")}
          </span>
        ) : (
          <>
            <Value value={row.value} />
            <Lens row={row} />
          </>
        )}
      </span>
    </div>
  );
}

function Value({ value }: { value: Json }) {
  if (typeof value === "string") {
    return (
      <span className="text-emerald-700 dark:text-emerald-400">"{value}"</span>
    );
  }
  if (typeof value === "number") {
    return <span className="text-sky-700 dark:text-sky-400">{value}</span>;
  }
  if (typeof value === "boolean") {
    return (
      <span className="text-violet-700 dark:text-violet-400">
        {String(value)}
      </span>
    );
  }
  return <span className="text-zinc-400 italic dark:text-zinc-500">null</span>;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const TIME_KEY = /^(created|updated|deleted|expires)$|_at$|time/i;
const CURRENCY = /^[a-z]{3}$/i;
const REGION = /^[A-Z]{2}$/;
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Plain-language reading of a raw value, when its key says what it is. */
function lensFor(row: Node): string | null {
  const key = typeof row.label === "string" ? row.label : "";
  const { value, parent } = row;
  if (
    typeof value === "number" &&
    TIME_KEY.test(key) &&
    value > 1e9 &&
    value < 1e10
  ) {
    // Spelled out by hand in UTC so server and browser agree.
    const d = new Date(value * 1000);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} · ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
  }
  const currency =
    parent && typeof parent === "object" && !Array.isArray(parent)
      ? parent.currency
      : undefined;
  if (
    typeof value === "number" &&
    key === "amount" &&
    typeof currency === "string" &&
    CURRENCY.test(currency)
  ) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(value / 100);
  }
  if (typeof value === "string" && key === "country" && REGION.test(value)) {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(value) ?? null;
  }
  return null;
}

function Lens({ row }: { row: Node }) {
  const text = lensFor(row);
  if (!text) {
    return null;
  }
  return (
    <span className="ml-2.5 font-sans text-[11px] text-zinc-400 dark:text-zinc-500">
      {text}
    </span>
  );
}
