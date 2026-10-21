"use client";

/**
 * @author: @kokonutui
 * @description: AI Conversation Branches
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface BranchMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Id of the message this one answers or follows. Leave out for the first. */
  parent?: string;
}

export interface AIBranchesProps {
  title?: string;
  /** Every message on every branch. Siblings form a fork. */
  messages?: BranchMessage[];
  /** Writes the reply to an edited message. Demo text when omitted. */
  reply?: (prompt: string) => string;
  className?: string;
}

interface Node {
  id: string;
  role: "root" | "user" | "assistant";
  text: string;
  parent: string | null;
  children: string[];
}

type Tree = Record<string, Node>;

const ROOT = "root";
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const ROW = 30;
const LANE = 18;
const PAD = 12;
const WORD_GAP = /(\s+)/;

const DEMO_MESSAGES: BranchMessage[] = [
  {
    id: "u1",
    role: "user",
    text: "Plan three days in Lisbon for early March.",
  },
  {
    id: "a1",
    role: "assistant",
    parent: "u1",
    text: "Day 1: Alfama, the castle at sunset, dinner in Mouraria.\nDay 2: Belém in the morning, then LX Factory.\nDay 3: the train to Sintra for Pena Palace and Quinta da Regaleira.",
  },
  {
    id: "u2",
    role: "user",
    parent: "a1",
    text: "Make day 3 less touristy.",
  },
  {
    id: "a2",
    role: "assistant",
    parent: "u2",
    text: "Skip Sintra. Take the train to Cascais, walk the coast path out to Guincho, and have grilled fish at a beach shack before heading back.",
  },
  {
    id: "u2b",
    role: "user",
    parent: "a1",
    text: "Give day 3 a food focus.",
  },
  {
    id: "a2b",
    role: "assistant",
    parent: "u2b",
    text: "Spend day 3 eating: custard tarts at Manteigaria, lunch at the Time Out Market, then a petiscos crawl through Bairro Alto.",
  },
  {
    id: "u1b",
    role: "user",
    text: "Plan three days in Porto for early March.",
  },
  {
    id: "a1b",
    role: "assistant",
    parent: "u1b",
    text: "Day 1: Ribeira and a port lodge in Gaia.\nDay 2: Livraria Lello early, then the Serralves gardens.\nDay 3: a day on the Douro valley train.",
  },
];

const TRAILING_STOP = /[.!?]+$/;

const demoReply = (prompt: string) => {
  const quoted = prompt.replace(TRAILING_STOP, "");
  const short = quoted.length > 48 ? `${quoted.slice(0, 48)}…` : quoted;
  return `Here is a version built around “${short}”. I kept it to three days and put the busiest stops in the mornings, so the afternoons stay free for wandering.`;
};

const buildTree = (messages: BranchMessage[]): Tree => {
  const tree: Tree = {
    [ROOT]: { id: ROOT, role: "root", text: "", parent: null, children: [] },
  };
  for (const m of messages) {
    tree[m.id] = {
      id: m.id,
      role: m.role,
      text: m.text,
      parent: m.parent ?? ROOT,
      children: [],
    };
  }
  for (const m of messages) {
    tree[m.parent ?? ROOT]?.children.push(m.id);
  }
  return tree;
};

/** Follow the picked child at every fork, from the top to a leaf. */
const pathOf = (tree: Tree, picked: Record<string, number>) => {
  const path: string[] = [];
  let node = tree[ROOT];
  while (node.children.length > 0) {
    const next =
      node.children[Math.min(picked[node.id] ?? 0, node.children.length - 1)];
    path.push(next);
    node = tree[next];
  }
  return path;
};

/** Rows by depth; the first child keeps its parent's lane, others branch right. */
const layout = (tree: Tree) => {
  const pos: Record<string, { row: number; lane: number }> = {};
  let lanes = 1;
  let rows = 1;
  const visit = (id: string, row: number, lane: number) => {
    pos[id] = { row, lane };
    rows = Math.max(rows, row + 1);
    tree[id].children.forEach((child, i) => {
      if (i === 0) {
        visit(child, row + 1, lane);
      } else {
        visit(child, row + 1, lanes);
        lanes += 1;
      }
    });
  };
  visit(ROOT, 0, 0);
  return { pos, lanes, rows };
};

export default function AIBranches({
  title = "Trip planning",
  messages = DEMO_MESSAGES,
  reply = demoReply,
  className,
}: AIBranchesProps) {
  const reduceMotion = useReducedMotion();
  const [tree, setTree] = useState(() => buildTree(messages));
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [dir, setDir] = useState(1);
  const [hover, setHover] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [writing, setWriting] = useState<{ id: string; words: number } | null>(
    null
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const count = useRef(0);

  const path = useMemo(() => pathOf(tree, picked), [tree, picked]);
  const map = useMemo(() => layout(tree), [tree]);
  const leaves = Object.values(tree).filter(
    (n) => n.children.length === 0 && n.id !== ROOT
  ).length;

  // Stream an edited branch's reply in, a word at a time.
  useEffect(() => {
    if (!writing) {
      return;
    }
    const total = tree[writing.id].text.split(WORD_GAP).length;
    if (reduceMotion || writing.words >= total) {
      setWriting(null);
      return;
    }
    const id = setTimeout(
      () => setWriting((w) => w && { ...w, words: w.words + 2 }),
      45
    );
    return () => clearTimeout(id);
  }, [writing, tree, reduceMotion]);

  // Keep the newest message in view while a reply streams.
  useEffect(() => {
    if (writing) {
      const el = scrollRef.current;
      el?.scrollTo({ top: el.scrollHeight });
    }
  }, [writing]);

  /** Point every fork above `id` at it, so the chat shows that branch. */
  const show = (id: string, by?: number) => {
    const lane = (n?: string) => (n ? (map.pos[n]?.lane ?? 0) : 0);
    setDir(by ?? (lane(id) >= lane(path.at(-1)) ? 1 : -1));
    setPicked((current) => {
      const next = { ...current };
      let child = id;
      let parent = tree[id].parent;
      while (parent) {
        next[parent] = tree[parent].children.indexOf(child);
        child = parent;
        parent = tree[parent].parent;
      }
      return next;
    });
  };

  const step = (id: string, by: number) => {
    const parent = tree[id].parent ?? ROOT;
    const siblings = tree[parent].children;
    const next = siblings[siblings.indexOf(id) + by];
    if (next) {
      show(next, by);
    }
  };

  const submitEdit = (id: string, text: string) => {
    setEditing(null);
    const trimmed = text.trim();
    if (!trimmed || trimmed === tree[id].text) {
      return;
    }
    count.current += 1;
    const user = `edit-${count.current}`;
    const answer = `${user}-reply`;
    const parent = tree[id].parent ?? ROOT;
    setTree((t) => ({
      ...t,
      [parent]: { ...t[parent], children: [...t[parent].children, user] },
      [user]: {
        id: user,
        role: "user",
        text: trimmed,
        parent,
        children: [answer],
      },
      [answer]: {
        id: answer,
        role: "assistant",
        text: reply(trimmed),
        parent: user,
        children: [],
      },
    }));
    setPicked((p) => ({ ...p, [parent]: tree[parent].children.length }));
    setDir(1);
    setWriting({ id: answer, words: 0 });
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "flex h-[460px] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10",
          className
        )}
      >
        <header className="flex items-center justify-between border-black/[0.06] border-b px-4 py-3 dark:border-white/[0.08]">
          <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
            {title}
          </h3>
          <p className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
            {leaves} branches
          </p>
        </header>

        <div className="relative flex min-h-0 flex-1">
          <div
            className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
            ref={scrollRef}
          >
            <ol className="space-y-4">
              <AnimatePresence custom={dir} initial={false} mode="popLayout">
                {path.map((id) => (
                  <motion.li
                    animate="in"
                    custom={dir}
                    exit="out"
                    initial="from"
                    key={id}
                    onPointerEnter={() => setHover(id)}
                    onPointerLeave={() => setHover(null)}
                    transition={{ duration: 0.28, ease: EASE_OUT }}
                    variants={slide}
                  >
                    <MessageView
                      editing={editing === id}
                      lit={hover === id}
                      node={tree[id]}
                      onCancel={() => setEditing(null)}
                      onEdit={() => setEditing(id)}
                      onStep={(by) => step(id, by)}
                      onSubmit={(text) => submitEdit(id, text)}
                      siblings={tree[tree[id].parent ?? ROOT].children}
                      words={writing?.id === id ? writing.words : undefined}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          </div>

          <AnimatePresence>
            {hover && !path.includes(hover) && tree[hover] && (
              <motion.p
                animate={{ opacity: 1, x: 0 }}
                className="pointer-events-none absolute right-[84px] z-10 line-clamp-3 w-52 rounded-lg bg-white px-3 py-2 text-[12px] text-zinc-600 leading-snug shadow-[0_8px_24px_-10px_rgb(0_0_0/0.3)] ring-1 ring-black/[0.08] sm:right-[100px] dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10"
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                initial={{ opacity: 0, x: 4 }}
                key={hover}
                style={{ top: PAD + (map.pos[hover]?.row ?? 0) * ROW - 6 }}
                transition={{ duration: 0.15, ease: EASE_OUT }}
              >
                <span className="mb-0.5 block font-medium text-[11px] text-zinc-900 dark:text-zinc-100">
                  {tree[hover].role === "user" ? "You asked" : "Reply"}
                </span>
                {tree[hover].text}
              </motion.p>
            )}
          </AnimatePresence>
          <Rail
            hover={hover}
            map={map}
            onHover={setHover}
            onPick={show}
            path={path}
            tree={tree}
          />
        </div>
      </div>
    </MotionConfig>
  );
}

const slide = {
  from: (dir: number) => ({ opacity: 0, x: dir * 18 }),
  in: { opacity: 1, x: 0 },
  out: (dir: number) => ({ opacity: 0, x: dir * -18 }),
};

function MessageView({
  node,
  siblings,
  editing,
  lit,
  words,
  onEdit,
  onCancel,
  onSubmit,
  onStep,
}: {
  node: Node;
  siblings: string[];
  editing: boolean;
  lit: boolean;
  words?: number;
  onEdit: () => void;
  onCancel: () => void;
  onSubmit: (text: string) => void;
  onStep: (by: number) => void;
}) {
  if (node.role === "assistant") {
    const text =
      words === undefined
        ? node.text
        : node.text.split(WORD_GAP).slice(0, words).join("");
    return (
      <p
        className={cn(
          "-mx-2 whitespace-pre-line rounded-lg px-2 py-1 text-[14px] text-zinc-700 leading-relaxed transition-colors duration-150 dark:text-zinc-300",
          lit && "bg-zinc-900/[0.03] dark:bg-white/[0.04]"
        )}
      >
        {text}
        {words !== undefined && (
          <span
            aria-hidden="true"
            className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-[2px] animate-pulse rounded-[2px] bg-zinc-700 dark:bg-zinc-300"
          />
        )}
      </p>
    );
  }

  const index = siblings.indexOf(node.id);
  return (
    <div className="group flex flex-col items-end gap-1">
      {editing ? (
        <EditBox initial={node.text} onCancel={onCancel} onSubmit={onSubmit} />
      ) : (
        <p
          className={cn(
            "max-w-[85%] rounded-2xl rounded-br-md bg-zinc-100 px-3.5 py-2 text-[14px] text-zinc-800 leading-snug transition-colors duration-150 dark:bg-zinc-800 dark:text-zinc-100",
            lit && "bg-zinc-200/80 dark:bg-zinc-700/80"
          )}
        >
          {node.text}
        </p>
      )}
      {!editing && (
        <div className="flex h-6 items-center gap-0.5 text-zinc-400 dark:text-zinc-500">
          <button
            aria-label="Edit message"
            className="flex size-6 items-center justify-center rounded-md opacity-0 transition-[opacity,color,background-color] duration-150 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-white/[0.07] dark:hover:text-zinc-200 [@media(hover:none)]:opacity-100"
            onClick={onEdit}
            type="button"
          >
            <Pencil className="size-3" />
          </button>
          {siblings.length > 1 && (
            <>
              <button
                aria-label="Previous version"
                className="flex size-6 items-center justify-center rounded-md transition-colors duration-150 enabled:hover:bg-zinc-100 enabled:hover:text-zinc-700 disabled:opacity-40 dark:enabled:hover:bg-white/[0.07] dark:enabled:hover:text-zinc-200"
                disabled={index === 0}
                onClick={() => onStep(-1)}
                type="button"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <span className="min-w-7 text-center font-mono text-[11px] tabular-nums">
                {index + 1}/{siblings.length}
              </span>
              <button
                aria-label="Next version"
                className="flex size-6 items-center justify-center rounded-md transition-colors duration-150 enabled:hover:bg-zinc-100 enabled:hover:text-zinc-700 disabled:opacity-40 dark:enabled:hover:bg-white/[0.07] dark:enabled:hover:text-zinc-200"
                disabled={index === siblings.length - 1}
                onClick={() => onStep(1)}
                type="button"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EditBox({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: string;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit(draft);
    } else if (event.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="w-full max-w-[85%] rounded-2xl bg-zinc-100 p-2 dark:bg-zinc-800">
      <textarea
        aria-label="Edit message"
        className="block w-full resize-none bg-transparent px-1.5 py-1 text-[14px] text-zinc-900 leading-snug outline-hidden dark:text-zinc-100"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        ref={ref}
        rows={2}
        value={draft}
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="pl-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
          Sending starts a new branch
        </p>
        <div className="flex gap-1.5">
          <button
            className="h-7 rounded-lg px-2.5 text-[12px] text-zinc-600 transition-colors duration-150 hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/[0.07] dark:hover:text-white"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-7 rounded-lg bg-zinc-900 px-2.5 font-medium text-[12px] text-white transition-colors duration-150 hover:bg-zinc-700 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            disabled={!draft.trim()}
            onClick={() => onSubmit(draft)}
            type="button"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function Rail({
  tree,
  map,
  path,
  hover,
  onHover,
  onPick,
}: {
  tree: Tree;
  map: ReturnType<typeof layout>;
  path: string[];
  hover: string | null;
  onHover: (id: string | null) => void;
  onPick: (id: string) => void;
}) {
  const on = new Set([ROOT, ...path]);
  const width = PAD * 2 + (map.lanes - 1) * LANE;
  const height = PAD * 2 + (map.rows - 1) * ROW;
  const at = (id: string) => ({
    x: PAD + map.pos[id].lane * LANE,
    y: PAD + map.pos[id].row * ROW,
  });
  const nodes = Object.values(tree);
  const edges = nodes.flatMap((n) =>
    n.children.map((child) => ({ from: n.id, to: child }))
  );

  return (
    <nav
      aria-label="Branches"
      className="relative w-[76px] shrink-0 overflow-auto border-black/[0.06] border-l bg-zinc-50/60 [scrollbar-width:none] sm:w-[92px] dark:border-white/[0.08] dark:bg-white/[0.02]"
    >
      <div className="relative mx-auto" style={{ width, height }}>
        <svg
          aria-hidden="true"
          className="block overflow-visible"
          height={height}
          width={width}
        >
          {edges.map(({ from, to }) => {
            const a = at(from);
            const b = at(to);
            const lit = on.has(from) && on.has(to);
            const d =
              a.x === b.x
                ? `M ${a.x} ${a.y} L ${b.x} ${b.y}`
                : `M ${a.x} ${a.y} C ${a.x} ${a.y + ROW * 0.7} ${b.x} ${b.y - ROW * 0.7} ${b.x} ${b.y}`;
            return (
              <motion.path
                animate={{ pathLength: 1, opacity: 1 }}
                className={cn(
                  "fill-none transition-[stroke,stroke-width] duration-300",
                  lit
                    ? "stroke-zinc-900 dark:stroke-zinc-100"
                    : "stroke-zinc-300 dark:stroke-zinc-700"
                )}
                d={d}
                initial={{ pathLength: 0, opacity: 0 }}
                key={`${from}-${to}`}
                strokeWidth={lit ? 1.75 : 1.25}
                transition={{ duration: 0.4, ease: EASE_OUT }}
              />
            );
          })}
          {nodes.map((n) => {
            const p = at(n.id);
            const lit = on.has(n.id);
            return (
              <motion.circle
                animate={{ scale: hover === n.id ? 1.45 : 1, opacity: 1 }}
                className={cn(
                  "transition-[fill,stroke] duration-300",
                  lit
                    ? "stroke-zinc-900 dark:stroke-zinc-100"
                    : "stroke-zinc-300 dark:stroke-zinc-700",
                  n.role === "assistant" &&
                    lit &&
                    "fill-zinc-900 dark:fill-zinc-100",
                  n.role === "assistant" &&
                    !lit &&
                    "fill-zinc-300 dark:fill-zinc-700",
                  n.role !== "assistant" && "fill-zinc-50 dark:fill-zinc-900"
                )}
                cx={p.x}
                cy={p.y}
                initial={{ scale: 0, opacity: 0 }}
                key={n.id}
                r={n.role === ROOT ? 2.5 : 3.5}
                strokeWidth={1.5}
                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              />
            );
          })}
        </svg>
        {nodes
          .filter((n) => n.role !== ROOT)
          .map((n) => {
            const p = at(n.id);
            return (
              <button
                aria-current={on.has(n.id) ? "step" : undefined}
                aria-label={`${n.role === "user" ? "You" : "Reply"}: ${n.text.slice(0, 60)}`}
                className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-900/30 dark:focus-visible:ring-white/30"
                key={n.id}
                onBlur={() => onHover(null)}
                onClick={() => onPick(n.id)}
                onFocus={() => onHover(n.id)}
                onPointerEnter={() => onHover(n.id)}
                onPointerLeave={() => onHover(null)}
                style={{ left: p.x, top: p.y }}
                type="button"
              />
            );
          })}
      </div>
    </nav>
  );
}
