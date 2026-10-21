"use client";

/**
 * @author: @dorianbaffier
 * @description: Leaderboard
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  type UIEvent,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// Rows are one fixed height, so a rank is a position and a rank change is a
// distance.
const ROW = 56;
const VISIBLE_ROWS = 6.5;
const MOVE_MS = 560;
const EASE_MOVE = "cubic-bezier(0.65, 0, 0.35, 1)";
const DIGIT = /\d/;
const ZERO = /0/;
const TRAILING_ZERO = /\.0$/;
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export interface LeaderboardScore {
  current: number;
  /** The same person's score one period earlier, to rank the change. */
  previous: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  team: string;
  /** Scores keyed by period id. */
  scores: Record<string, LeaderboardScore>;
}

export interface LeaderboardPeriod {
  id: string;
  label: string;
  /** What the change is measured against, e.g. "last week". */
  since: string;
}

export interface LeaderboardProps {
  title?: string;
  subtitle?: string;
  entries?: LeaderboardEntry[];
  periods?: LeaderboardPeriod[];
  defaultPeriod?: string;
  /** The viewer's own entry: pinned while it is out of view. */
  youId?: string;
  currency?: string;
  className?: string;
}

const DEFAULT_PERIODS: LeaderboardPeriod[] = [
  { id: "week", label: "Week", since: "last week" },
  { id: "month", label: "Month", since: "last month" },
  { id: "quarter", label: "Quarter", since: "last quarter" },
];

const PEOPLE: [string, string, string][] = [
  ["maya", "Maya Okafor", "Enterprise"],
  ["leo", "Leo Brandt", "Mid-market"],
  ["sana", "Sana Iqbal", "Enterprise"],
  ["tom", "Tom Reyes", "SMB"],
  ["ines", "Inès Laurent", "Mid-market"],
  ["kai", "Kai Nakamura", "SMB"],
  ["ruth", "Ruth Adeyemi", "Enterprise"],
  ["you", "Alex Moreau", "Mid-market"],
  ["olga", "Olga Petrova", "SMB"],
  ["dev", "Dev Patel", "Mid-market"],
  ["hana", "Hana Kim", "SMB"],
  ["joel", "Joel Sørensen", "Enterprise"],
];

// Seeded, so server and browser rank the same people.
function demoEntries(): LeaderboardEntry[] {
  let seed = 7;
  const random = () => {
    seed = (seed * 16_807) % 2_147_483_647;
    return seed / 2_147_483_647;
  };
  const scale: Record<string, number> = { week: 1, month: 4.2, quarter: 12.6 };
  return PEOPLE.map(([id, name, team], i) => {
    const strength = 1 - i * 0.045;
    const scores: Record<string, LeaderboardScore> = {};
    for (const period of Object.keys(scale)) {
      const base = 14_000 * scale[period] * strength;
      // Short periods swing more, so the week board reshuffles the most.
      const swing = period === "week" ? 0.55 : 0.28;
      const boost = id === "you" && period === "week" ? 1.32 : 1;
      scores[period] = {
        current: Math.round(base * (1 - swing / 2 + random() * swing) * boost),
        previous: Math.round(base * (1 - swing / 2 + random() * swing)),
      };
    }
    return { id, name, team, scores };
  });
}

const DEFAULT_ENTRIES = demoEntries();

const ordinal = (n: number) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) {
    return `${n}th`;
  }
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

interface Ranked {
  entry: LeaderboardEntry;
  score: number;
  rank: number;
  /** Places gained since the last period; negative when dropped. */
  moved: number;
}

function rankFor(entries: LeaderboardEntry[], period: string): Ranked[] {
  const by = (key: "current" | "previous") =>
    [...entries].sort(
      (a, b) => (b.scores[period]?.[key] ?? 0) - (a.scores[period]?.[key] ?? 0)
    );
  const before = new Map(by("previous").map((e, i) => [e.id, i + 1]));
  return by("current").map((entry, i) => ({
    entry,
    score: entry.scores[period]?.current ?? 0,
    rank: i + 1,
    moved: (before.get(entry.id) ?? i + 1) - (i + 1),
  }));
}

function RollingNumber({ value }: { value: string }) {
  const chars = value.split("");
  return (
    <span aria-hidden className="inline-flex tabular-nums">
      {chars.map((char, i) => {
        // Keyed from the right, so the units stay put as the length changes.
        const key = chars.length - i;
        if (!DIGIT.test(char)) {
          return <span key={`s${key}`}>{char}</span>;
        }
        return (
          <span
            className="relative inline-block h-[1em] overflow-hidden leading-none"
            key={`d${key}`}
          >
            <span className="invisible">0</span>
            <span
              className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-[460ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
              style={{ transform: `translateY(-${Number(char) * 10}%)` }}
            >
              {DIGITS.map((d) => (
                <span className="block h-[1em] leading-none" key={d}>
                  {d}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

function Movement({ moved }: { moved: number }) {
  if (moved === 0) {
    return (
      <span className="w-9 text-right text-xs text-zinc-400 tabular-nums dark:text-zinc-500">
        <span aria-hidden>–</span>
        <span className="sr-only">no change</span>
      </span>
    );
  }
  const up = moved > 0;
  return (
    <span
      className={cn(
        "w-9 text-right font-medium text-xs tabular-nums",
        up
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-rose-600 dark:text-rose-400"
      )}
    >
      <span aria-hidden>
        {up ? "▲" : "▼"}
        {Math.abs(moved)}
      </span>
      <span className="sr-only">
        {up ? "up" : "down"} {Math.abs(moved)}
      </span>
    </span>
  );
}

const rankStyle = (rank: number) => {
  if (rank === 1) {
    return "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900";
  }
  if (rank <= 3) {
    return "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100";
  }
  return "text-zinc-400 dark:text-zinc-500";
};

/** Where a row shows inside the list: the own row is held on the edges. */
const shownAt = (
  index: number,
  sticky: boolean,
  scrollTop: number,
  height: number
) => {
  const natural = index * ROW;
  if (!sticky) {
    return natural;
  }
  return Math.min(Math.max(natural, scrollTop), scrollTop + height - ROW);
};

/** Plays one row's trip from `dy` pixels away back to its place. */
function slide(row: HTMLElement, dy: number, layer: boolean) {
  if (Math.abs(dy) < 1) {
    return;
  }
  // Climbers pass over the rows they overtake. The own row stays on top.
  if (layer) {
    row.style.zIndex = dy > 0 ? "2" : "1";
  }
  const animation = row.animate(
    [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
    // Longer trips take a little longer, so far climbs don't jump.
    { duration: MOVE_MS + Math.min(240, Math.abs(dy) / 4), easing: EASE_MOVE }
  );
  if (layer) {
    animation.onfinish = () => {
      row.style.zIndex = "";
    };
  }
}

export default function Leaderboard({
  title = "Closed revenue",
  subtitle = "Sales team",
  entries = DEFAULT_ENTRIES,
  periods = DEFAULT_PERIODS,
  defaultPeriod,
  youId = "you",
  currency = "USD",
  className,
}: LeaderboardProps) {
  const [period, setPeriod] = useState(defaultPeriod ?? periods[0]?.id ?? "");
  const [scroll, setScroll] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  // Where every row was drawn before the period changed.
  const before = useRef<Map<string, number> | null>(null);

  const ranked = useMemo(() => rankFor(entries, period), [entries, period]);
  const money = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }),
    [currency]
  );
  // Written out by hand: compact notation differs between Node and browsers.
  const compact = (value: number) => {
    const symbol = money.format(0).replace(ZERO, "");
    if (value >= 1000) {
      return `${symbol}${(value / 1000).toFixed(1).replace(TRAILING_ZERO, "")}k`;
    }
    return money.format(value);
  };

  const leader = ranked[0]?.score ?? 1;
  const youIndex = ranked.findIndex((r) => r.entry.id === youId);
  const you = youIndex >= 0 ? ranked[youIndex] : undefined;
  const ahead = youIndex > 0 ? ranked[youIndex - 1] : undefined;
  const viewport = Math.round(ROW * VISIBLE_ROWS);
  const youNatural = youIndex * ROW;
  let stuck: "top" | "bottom" | null = null;
  if (you && youNatural > scroll + viewport - ROW) {
    stuck = "bottom";
  } else if (you && youNatural < scroll) {
    stuck = "top";
  }
  const periodIndex = Math.max(
    0,
    periods.findIndex((p) => p.id === period)
  );
  const since = periods[periodIndex]?.since ?? "";

  const choosePeriod = (id: string) => {
    if (id === period) {
      return;
    }
    const list = listRef.current;
    const at = new Map<string, number>();
    for (const [i, r] of ranked.entries()) {
      at.set(
        r.entry.id,
        shownAt(
          i,
          r.entry.id === youId,
          list?.scrollTop ?? 0,
          list?.clientHeight ?? viewport
        )
      );
    }
    before.current = at;
    setPeriod(id);
  };

  // FLIP: every row starts where it was and travels to its new rank. Rows
  // that climb pass over the ones that fall.
  useLayoutEffect(() => {
    const at = before.current;
    const list = listRef.current;
    before.current = null;
    if (!(at && list)) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    for (const [i, r] of ranked.entries()) {
      const row = rowRefs.current.get(r.entry.id);
      const from = at.get(r.entry.id);
      if (!row || from === undefined) {
        continue;
      }
      const to = shownAt(
        i,
        r.entry.id === youId,
        list.scrollTop,
        list.clientHeight
      );
      slide(row, from - to, r.entry.id !== youId);
    }
  }, [ranked, youId]);

  const handleScroll = useCallback((event: UIEvent<HTMLOListElement>) => {
    setScroll(event.currentTarget.scrollTop);
  }, []);

  const jumpToYou = () => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    list.scrollTo({
      top: Math.max(0, youNatural - (viewport - ROW) / 2),
      behavior: reduce ? "auto" : "smooth",
    });
  };

  return (
    <div
      className={cn(
        "w-full max-w-md select-none rounded-3xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 p-5 pb-4">
        <div className="min-w-0">
          <p className="font-medium text-sm">{title}</p>
          <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
            {subtitle}
          </p>
        </div>
        <div className="relative flex shrink-0 rounded-full bg-zinc-100 p-0.5 text-xs dark:bg-zinc-900">
          <span
            aria-hidden
            className="absolute top-0.5 bottom-0.5 left-0.5 w-16 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none dark:bg-zinc-700"
            style={{ transform: `translateX(${periodIndex * 100}%)` }}
          />
          {periods.map((p) => (
            <button
              aria-pressed={p.id === period}
              className={cn(
                "relative w-16 rounded-full py-1 font-medium outline-none transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-zinc-400",
                p.id === period
                  ? "text-zinc-900 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              )}
              key={p.id}
              onClick={() => choosePeriod(p.id)}
              type="button"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <ol
        aria-label={`${title}, ${periods[periodIndex]?.label ?? ""}`}
        className="relative overflow-y-auto overscroll-contain border-zinc-100 border-t [scrollbar-width:thin] dark:border-zinc-900"
        onScroll={handleScroll}
        ref={listRef}
        style={{ height: Math.min(viewport, ranked.length * ROW) }}
      >
        {ranked.map((r) => {
          const isYou = r.entry.id === youId;
          return (
            <li
              className={cn(
                "relative flex items-center gap-3 bg-white px-5 dark:bg-zinc-950",
                isYou && "sticky top-0 bottom-0 z-[3]"
              )}
              key={r.entry.id}
              ref={(node) => {
                if (node) {
                  rowRefs.current.set(r.entry.id, node);
                } else {
                  rowRefs.current.delete(r.entry.id);
                }
              }}
              style={{ height: ROW }}
            >
              {/* The own row gets a hairline on the side it is held against. */}
              {isYou && (
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-x-0 h-px bg-zinc-200 transition-opacity duration-150 ease-out dark:bg-zinc-800",
                    stuck === "top" ? "bottom-0" : "top-0",
                    stuck ? "opacity-100" : "opacity-0"
                  )}
                />
              )}
              {isYou && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-2 inset-y-1 rounded-xl bg-violet-500/[0.07] dark:bg-violet-400/10"
                />
              )}
              <span
                className={cn(
                  "relative flex size-6 shrink-0 items-center justify-center rounded-full font-medium text-xs tabular-nums",
                  rankStyle(r.rank)
                )}
              >
                {r.rank}
              </span>
              <span
                aria-hidden
                className={cn(
                  "relative hidden size-8 shrink-0 items-center justify-center rounded-full font-medium text-[11px] sm:flex",
                  isYou
                    ? "bg-violet-600 text-white dark:bg-violet-500"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                )}
              >
                {initials(r.entry.name)}
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5">
                  <span className="truncate font-medium text-sm">
                    {r.entry.name}
                  </span>
                  {isYou && (
                    <span className="shrink-0 text-violet-600 text-xs dark:text-violet-400">
                      You
                    </span>
                  )}
                </span>
                {isYou && ahead ? (
                  <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {compact(ahead.score - r.score + 1)} to pass{" "}
                    {ahead.entry.name.split(" ")[0]}
                  </span>
                ) : (
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                    {/* Share of the leader's score. */}
                    <span
                      className="block h-full origin-left rounded-full bg-zinc-300 transition-transform duration-[460ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none dark:bg-zinc-700"
                      style={{ transform: `scaleX(${r.score / leader})` }}
                    />
                  </span>
                )}
              </span>
              <span className="relative w-20 shrink-0 text-right font-medium text-sm tabular-nums">
                <span className="sr-only">{money.format(r.score)}</span>
                <RollingNumber value={money.format(r.score)} />
              </span>
              <Movement moved={r.moved} />
              {isYou && stuck && (
                <button
                  aria-label={`Scroll to your place, ${ordinal(r.rank)}`}
                  className="absolute inset-0 z-10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
                  onClick={jumpToYou}
                  type="button"
                />
              )}
            </li>
          );
        })}
      </ol>

      <p
        aria-live="polite"
        className="border-zinc-100 border-t px-5 py-3 text-xs text-zinc-500 dark:border-zinc-900 dark:text-zinc-400"
      >
        {you ? (
          <>
            You're{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {ordinal(you.rank)}
            </span>{" "}
            of {ranked.length}
            {you.moved === 0
              ? `, same as ${since}.`
              : `, ${you.moved > 0 ? "up" : "down"} ${Math.abs(you.moved)} since ${since}.`}
          </>
        ) : (
          `${ranked.length} people`
        )}
      </p>
    </div>
  );
}
