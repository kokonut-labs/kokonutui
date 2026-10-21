"use client";

/**
 * @author: @dorianbaffier
 * @description: Seat Map
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Accessibility, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export interface SeatTier {
  name: string;
  price: number;
  /** Row letters in this tier, front to back. */
  rows: string[];
}

export interface SeatMapProps {
  title?: string;
  subtitle?: string;
  tiers?: SeatTier[];
  /** Seats per block, left to right, with an aisle between blocks. */
  blocks?: number[];
  /** Seat ids already sold, like "D7". */
  taken?: string[];
  /** Seats with wheelchair space. */
  accessible?: string[];
  defaultSelected?: string[];
  /** Most seats one booking can hold. */
  maxSeats?: number;
  currency?: string;
  onChange?: (seats: string[]) => void;
  onContinue?: (seats: string[], total: number) => void;
  className?: string;
}

const DEFAULT_TIERS: SeatTier[] = [
  { name: "Front", price: 11, rows: ["A", "B"] },
  { name: "Standard", price: 15, rows: ["C", "D", "E", "F", "G"] },
  { name: "Premium", price: 21, rows: ["H", "I"] },
];

const DEFAULT_TAKEN = [
  "A5",
  "A6",
  "B4",
  "B5",
  "B6",
  "B7",
  "C2",
  "C3",
  "C8",
  "D5",
  "D6",
  "D7",
  "D8",
  "E1",
  "E2",
  "E10",
  "F6",
  "F7",
  "G4",
  "G5",
  "G9",
  "G10",
  "H3",
  "H4",
  "H5",
  "H6",
  "I7",
  "I8",
  "I11",
  "I12",
];

interface Seat {
  id: string;
  row: string;
  /** 1-based seat number across the row. */
  number: number;
  /** Index of the block (between aisles) the seat is in. */
  block: number;
  tier: SeatTier;
}

interface Paint {
  row: string;
  from: number;
  mode: "add" | "remove";
  base: string[];
}

const seatOrder = (a: Seat, b: Seat) =>
  a.row === b.row ? a.number - b.number : a.row.localeCompare(b.row);

export default function SeatMap({
  title = "Dune: Part Three",
  subtitle = "Today · 19:30 · Screen 4",
  tiers = DEFAULT_TIERS,
  blocks = [3, 6, 3],
  taken = DEFAULT_TAKEN,
  accessible = ["A1", "A12"],
  defaultSelected = [],
  maxSeats = 8,
  currency = "$",
  onChange,
  onContinue,
  className,
}: SeatMapProps) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [focused, setFocused] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState(false);
  const limitTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reduceMotion = useReducedMotion();
  const paintRef = useRef<Paint | null>(null);

  useEffect(() => () => clearTimeout(limitTimer.current), []);
  const gridRef = useRef<HTMLFieldSetElement>(null);

  const perRow = blocks.reduce((a, b) => a + b, 0);
  const takenSet = useMemo(() => new Set(taken), [taken]);
  const accessibleSet = useMemo(() => new Set(accessible), [accessible]);

  const seats = useMemo(() => {
    const map = new Map<string, Seat>();
    for (const tier of tiers) {
      for (const row of tier.rows) {
        let number = 1;
        blocks.forEach((size, block) => {
          for (let i = 0; i < size; i++) {
            map.set(`${row}${number}`, {
              id: `${row}${number}`,
              row,
              number,
              block,
              tier,
            });
            number += 1;
          }
        });
      }
    }
    return map;
  }, [tiers, blocks]);

  const rows = tiers.flatMap((tier) => tier.rows);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const picked = selected
    .map((id) => seats.get(id))
    .filter((seat): seat is Seat => Boolean(seat))
    .sort(seatOrder);
  const total = picked.reduce((sum, seat) => sum + seat.tier.price, 0);

  // A free seat boxed in by the booking on one side and a sold seat, the
  // booking or the aisle on the other is one nobody will buy.
  const stranded = useMemo(() => {
    const blocked = (id: string, block: number) => {
      const seat = seats.get(id);
      return (
        !seat || seat.block !== block || takenSet.has(id) || selectedSet.has(id)
      );
    };
    const result: string[] = [];
    for (const seat of seats.values()) {
      if (takenSet.has(seat.id) || selectedSet.has(seat.id)) {
        continue;
      }
      const left = `${seat.row}${seat.number - 1}`;
      const right = `${seat.row}${seat.number + 1}`;
      const touchesBooking = selectedSet.has(left) || selectedSet.has(right);
      if (
        touchesBooking &&
        blocked(left, seat.block) &&
        blocked(right, seat.block)
      ) {
        result.push(seat.id);
      }
    }
    return result;
  }, [seats, takenSet, selectedSet]);

  const update = (next: string[]) => {
    setSelected(next);
    onChange?.(next);
  };

  const paintRange = (paint: Paint, to: number) => {
    const low = Math.min(paint.from, to);
    const high = Math.max(paint.from, to);
    const ids: string[] = [];
    for (let n = low; n <= high; n++) {
      const id = `${paint.row}${n}`;
      if (!takenSet.has(id)) {
        ids.push(id);
      }
    }
    if (paint.mode === "remove") {
      update(paint.base.filter((id) => !ids.includes(id)));
      return;
    }
    const next = [...new Set([...paint.base, ...ids])];
    if (next.length > maxSeats) {
      setLimitHit(true);
      clearTimeout(limitTimer.current);
      limitTimer.current = setTimeout(() => setLimitHit(false), 2000);
      return;
    }
    update(next);
  };

  const seatFrom = (target: EventTarget | null) => {
    const element =
      target instanceof Element
        ? target.closest<HTMLElement>("[data-seat]")
        : null;
    return element ? seats.get(element.dataset.seat ?? "") : undefined;
  };

  // The grid holds the pointer, not the seat, so the drag survives crossing
  // from one seat to the next.
  const onPointerDown = (event: PointerEvent<HTMLFieldSetElement>) => {
    const seat = seatFrom(event.target);
    if (!seat || takenSet.has(seat.id) || event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const paint: Paint = {
      row: seat.row,
      from: seat.number,
      mode: selectedSet.has(seat.id) ? "remove" : "add",
      base: selected,
    };
    paintRef.current = paint;
    paintRange(paint, seat.number);
  };

  const onPointerMove = (event: PointerEvent<HTMLFieldSetElement>) => {
    const paint = paintRef.current;
    if (!paint) {
      return;
    }
    const seat = seatFrom(
      document.elementFromPoint(event.clientX, event.clientY)
    );
    if (seat && seat.row === paint.row) {
      paintRange(paint, seat.number);
    }
  };

  const endPaint = () => {
    paintRef.current = null;
  };

  // Clicks from a pointer are handled by the paint above; this is Enter and
  // Space on a focused seat.
  const onSeatClick = (event: MouseEvent<HTMLButtonElement>, seat: Seat) => {
    if (event.detail !== 0) {
      return;
    }
    const mode = selectedSet.has(seat.id) ? "remove" : "add";
    paintRange(
      { row: seat.row, from: seat.number, mode, base: selected },
      seat.number
    );
  };

  const onGridKeyDown = (event: KeyboardEvent<HTMLFieldSetElement>) => {
    const seat = seatFrom(event.target);
    if (!seat) {
      return;
    }
    const rowIndex = rows.indexOf(seat.row);
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
    };
    const move = moves[event.key];
    if (!move) {
      return;
    }
    event.preventDefault();
    const row =
      rows[Math.min(rows.length - 1, Math.max(0, rowIndex + move[0]))];
    const number = Math.min(perRow, Math.max(1, seat.number + move[1]));
    const id = `${row}${number}`;
    setFocused(id);
    gridRef.current?.querySelector<HTMLElement>(`[data-seat="${id}"]`)?.focus();
  };

  const tabStop =
    focused ?? picked[0]?.id ?? `${rows.at(-1)}${Math.ceil(perRow / 2)}`;

  const columns = blocks
    .map((size) => `repeat(${size}, minmax(0, 1fr))`)
    .join(" 0.75rem ");

  const money = (value: number) =>
    `${currency}${value.toLocaleString("en-US")}`;

  return (
    <div
      className={cn(
        "w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
            {title}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        </div>
        <p className="shrink-0 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          {perRow * rows.length - taken.length - selected.length} left
        </p>
      </div>

      {/* The screen, curved toward the seats. */}
      <div className="relative mx-auto mt-6 w-[86%]">
        <svg
          aria-hidden
          className="h-4 w-full overflow-visible"
          preserveAspectRatio="none"
          viewBox="0 0 100 10"
        >
          <title>Screen</title>
          <path
            className="stroke-zinc-300 dark:stroke-zinc-700"
            d="M0 9 Q50 0 100 9"
            fill="none"
            strokeLinecap="round"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <p className="text-center text-[10px] text-zinc-400 tracking-[0.2em] dark:text-zinc-500">
          SCREEN
        </p>
      </div>

      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: the grid only routes drags and arrow keys to the seat buttons inside it. */}
      <fieldset
        className="mt-4 touch-pan-y select-none"
        onKeyDown={onGridKeyDown}
        onLostPointerCapture={endPaint}
        onPointerCancel={endPaint}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPaint}
        ref={gridRef}
      >
        <legend className="sr-only">Seats</legend>
        {tiers.map((tier, tierIndex) => (
          <div className={cn(tierIndex > 0 && "mt-3")} key={tier.name}>
            <p className="mb-1.5 flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500">
              <span className="h-px flex-1 bg-zinc-100 dark:bg-zinc-900" />
              {tier.name} · {money(tier.price)}
              <span className="h-px flex-1 bg-zinc-100 dark:bg-zinc-900" />
            </p>
            <div className="space-y-1">
              {tier.rows.map((row) => (
                <div className="flex items-center gap-2" key={row}>
                  <span className="w-3 text-center font-medium text-[10px] text-zinc-400 dark:text-zinc-500">
                    {row}
                  </span>
                  <div
                    className="grid flex-1 gap-1"
                    style={{ gridTemplateColumns: columns }}
                  >
                    {Array.from({ length: perRow }, (_, i) => {
                      const id = `${row}${i + 1}`;
                      const seat = seats.get(id);
                      if (!seat) {
                        return null;
                      }
                      // Aisles are empty grid tracks between blocks.
                      const column = i + 1 + seat.block;
                      return (
                        <SeatButton
                          column={column}
                          isAccessible={accessibleSet.has(id)}
                          isSelected={selectedSet.has(id)}
                          isStranded={stranded.includes(id)}
                          isTaken={takenSet.has(id)}
                          key={id}
                          label={`Row ${row}, seat ${seat.number}, ${tier.name}, ${money(tier.price)}${accessibleSet.has(id) ? ", wheelchair space" : ""}`}
                          onClick={(event) => onSeatClick(event, seat)}
                          onFocus={() => setFocused(id)}
                          seat={seat}
                          tabIndex={tabStop === id ? 0 : -1}
                        />
                      );
                    })}
                  </div>
                  <span className="w-3 text-center font-medium text-[10px] text-zinc-400 dark:text-zinc-500">
                    {row}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
        <Legend
          className="bg-zinc-100 ring-1 ring-zinc-200 ring-inset dark:bg-zinc-900 dark:ring-zinc-800"
          label="Free"
        />
        <Legend className="bg-zinc-900 dark:bg-zinc-100" label="Yours" />
        <Legend
          className="bg-[repeating-linear-gradient(135deg,var(--tw-gradient-from)_0_2px,transparent_2px_4px)] from-zinc-300 dark:from-zinc-700"
          label="Sold"
        />
        <span className="ml-auto">Drag along a row to pick several</span>
      </div>

      <div className="mt-4 border-zinc-200 border-t pt-4 dark:border-zinc-800">
        <div className="flex min-h-7 flex-wrap gap-1.5">
          <AnimatePresence initial={false} mode="popLayout">
            {picked.length === 0 && (
              <motion.p
                animate={{ opacity: 1 }}
                className="text-sm text-zinc-400 leading-7 dark:text-zinc-500"
                exit={{ opacity: 0, transition: { duration: 0.08 } }}
                initial={{ opacity: 0 }}
                key="empty"
              >
                No seats yet
              </motion.p>
            )}
            {picked.map((seat) => (
              <motion.button
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                aria-label={`Remove ${seat.id}`}
                className="group/chip inline-flex h-7 items-center gap-1 rounded-full bg-zinc-100 pr-1.5 pl-2.5 font-medium text-xs text-zinc-900 tabular-nums transition-colors duration-150 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                exit={{
                  opacity: 0,
                  y: 6,
                  filter: "blur(2px)",
                  transition: { duration: 0.12 },
                }}
                initial={{ opacity: 0, y: -8, filter: "blur(2px)" }}
                key={seat.id}
                layout={reduceMotion ? false : "position"}
                onClick={() => update(selected.filter((id) => id !== seat.id))}
                transition={{ duration: 0.22, ease: EASE_OUT }}
                type="button"
              >
                {seat.id}
                <X
                  aria-hidden
                  className="size-3 text-zinc-400 group-hover/chip:text-zinc-600 dark:group-hover/chip:text-zinc-300"
                />
              </motion.button>
            ))}
          </AnimatePresence>
        </div>

        <Notice limitHit={limitHit} maxSeats={maxSeats} stranded={stranded} />

        <button
          className={cn(
            "mt-3 flex h-11 w-full items-center justify-between rounded-2xl px-4 font-medium text-sm outline-none transition-colors duration-150",
            "focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
            picked.length > 0
              ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              : "bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600"
          )}
          disabled={picked.length === 0}
          onClick={() =>
            onContinue?.(
              picked.map((seat) => seat.id),
              total
            )
          }
          type="button"
        >
          <span>
            {picked.length > 0
              ? `${picked.length} ${picked.length === 1 ? "seat" : "seats"}`
              : "Pick your seats"}
          </span>
          <span className="tabular-nums">
            {picked.length > 0 ? `Continue · ${money(total)}` : ""}
          </span>
        </button>
      </div>
    </div>
  );
}

function SeatButton({
  seat,
  column,
  label,
  isTaken,
  isSelected,
  isStranded,
  isAccessible,
  tabIndex,
  onClick,
  onFocus,
}: {
  seat: Seat;
  column: number;
  label: string;
  isTaken: boolean;
  isSelected: boolean;
  isStranded: boolean;
  isAccessible: boolean;
  tabIndex: number;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  onFocus: () => void;
}) {
  return (
    <button
      aria-disabled={isTaken}
      aria-label={isTaken ? `${label}, sold` : label}
      aria-pressed={isSelected}
      className={cn(
        "group/seat relative flex aspect-[1/0.92] items-center justify-center rounded-t-[7px] rounded-b-[4px] outline-none",
        "transition-[background-color,box-shadow,color] duration-150 ease-out",
        "focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-950",
        isTaken &&
          "cursor-not-allowed bg-[repeating-linear-gradient(135deg,var(--tw-gradient-from)_0_2px,transparent_2px_4px)] from-zinc-200 dark:from-zinc-800",
        !(isTaken || isSelected) &&
          "cursor-pointer bg-zinc-100 text-zinc-400 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)] hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-500 dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)] dark:hover:bg-zinc-800",
        isSelected &&
          "cursor-pointer bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
        isStranded &&
          "shadow-[inset_0_0_0_1.5px_rgb(234_88_12)] dark:shadow-[inset_0_0_0_1.5px_rgb(251_146_60)]"
      )}
      data-seat={seat.id}
      onClick={onClick}
      onFocus={onFocus}
      style={{ gridColumn: column }}
      tabIndex={tabIndex}
      type="button"
    >
      {isAccessible && !isTaken && (
        <Accessibility aria-hidden className="size-[60%]" strokeWidth={2} />
      )}
      {/* The seat number shows on yours, rising in as it is picked. */}
      {!isAccessible && (
        <span
          className={cn(
            "font-medium text-[9px] tabular-nums leading-none transition-[opacity,translate] ease-out",
            "duration-200 motion-reduce:duration-0",
            isSelected
              ? "translate-y-0 opacity-100"
              : "translate-y-0.5 opacity-0"
          )}
        >
          {seat.number}
        </span>
      )}
    </button>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn("size-3 rounded-t-[4px] rounded-b-[2px]", className)}
      />
      {label}
    </span>
  );
}

function Notice({
  stranded,
  limitHit,
  maxSeats,
}: {
  stranded: string[];
  limitHit: boolean;
  maxSeats: number;
}) {
  let message: string | null = null;
  if (limitHit) {
    message = `Up to ${maxSeats} seats per booking`;
  }
  if (stranded.length > 0) {
    message = `${stranded.join(", ")} would be left on its own. Try moving over one.`;
    if (stranded.length > 1) {
      message = `${stranded.join(", ")} would be left on their own. Try moving over one.`;
    }
  }
  return (
    <div aria-live="polite" className="relative mt-2 min-h-4">
      <AnimatePresence initial={false} mode="popLayout">
        {message && (
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="text-orange-600 text-xs dark:text-orange-400"
            exit={{ opacity: 0, y: -4 }}
            initial={{ opacity: 0, y: 4 }}
            key={message}
            transition={{ duration: 0.18, ease: EASE_OUT }}
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
