"use client";

/**
 * @author: @dorianbaffier
 * @description: Bookshelf
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

type Motif = "circle" | "bars" | "arch" | "dots" | "wave";

export interface ShelfBook {
  id: string;
  title: string;
  author: string;
  year: string;
  pages: number;
  /** Pages read so far; leave out for a book not started. */
  read?: number;
  /** Cloth color of the spine and cover. */
  color: string;
  /** Type color on the cloth. */
  ink: string;
  /** Spine height in px, before scaling to the shelf. */
  height: number;
  /** Spine thickness in px. */
  thickness: number;
  motif?: Motif;
}

export interface BookshelfProps {
  books?: ShelfBook[];
  title?: string;
  onOpen?: (book: ShelfBook) => void;
  className?: string;
}

/** How a cover's width relates to its height. */
const COVER_RATIO = 0.68;
const PULL = { duration: 0.75, ease: [0.32, 0.72, 0, 1] } as const;
const PUT_BACK = { duration: 0.6, ease: [0.32, 0.72, 0, 1] } as const;
/** How far a book slides up out of its slot before it turns to you. */
const LIFT = 26;

const DEFAULT_BOOKS: ShelfBook[] = [
  {
    id: "middlemarch",
    title: "Middlemarch",
    author: "George Eliot",
    year: "1871",
    pages: 880,
    read: 512,
    color: "#2f4a3a",
    ink: "#e9dfc6",
    height: 186,
    thickness: 44,
    motif: "arch",
  },
  {
    id: "waves",
    title: "The Waves",
    author: "Virginia Woolf",
    year: "1931",
    pages: 297,
    read: 297,
    color: "#d9cdb4",
    ink: "#2b2a27",
    height: 164,
    thickness: 26,
    motif: "wave",
  },
  {
    id: "moby",
    title: "Moby-Dick",
    author: "Herman Melville",
    year: "1851",
    pages: 635,
    color: "#1f2b3d",
    ink: "#d8c9a3",
    height: 178,
    thickness: 40,
    motif: "circle",
  },
  {
    id: "walden",
    title: "Walden",
    author: "H. D. Thoreau",
    year: "1854",
    pages: 352,
    read: 88,
    color: "#a8532f",
    ink: "#f5e7d6",
    height: 158,
    thickness: 30,
    motif: "bars",
  },
  {
    id: "persuasion",
    title: "Persuasion",
    author: "Jane Austen",
    year: "1817",
    pages: 249,
    color: "#e4b8b0",
    ink: "#5a2626",
    height: 170,
    thickness: 28,
    motif: "dots",
  },
  {
    id: "dubliners",
    title: "Dubliners",
    author: "James Joyce",
    year: "1914",
    pages: 224,
    read: 224,
    color: "#3d3a36",
    ink: "#e0d6c2",
    height: 162,
    thickness: 27,
    motif: "bars",
  },
  {
    id: "siddhartha",
    title: "Siddhartha",
    author: "Hermann Hesse",
    year: "1922",
    pages: 152,
    color: "#5b6b3c",
    ink: "#f0ead2",
    height: 150,
    thickness: 22,
    motif: "circle",
  },
  {
    id: "leaves",
    title: "Leaves of Grass",
    author: "Walt Whitman",
    year: "1855",
    pages: 456,
    color: "#7a1f2b",
    ink: "#f0d9c4",
    height: 180,
    thickness: 36,
    motif: "arch",
  },
];

interface Flight {
  book: ShelfBook;
  /** Offset from the book's spot in the open view back to its slot. */
  from: { x: number; y: number };
  /** Where the open book sits, its scale, and the room beside it. */
  at: { left: number; top: number; scale: number; textLeft: number };
}

export default function Bookshelf({
  books = DEFAULT_BOOKS,
  title = "Reading list",
  onOpen,
  className,
}: BookshelfProps) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef(new Map<string, HTMLButtonElement>());
  const putBackRef = useRef<HTMLButtonElement>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  /** The book still out of its slot, open or on its way back. */
  const [out, setOut] = useState<string | null>(null);

  const reading = books.filter(
    (book) => book.read !== undefined && book.read < book.pages
  ).length;

  const open = (book: ShelfBook) => {
    const root = rootRef.current;
    const slot = slotRefs.current.get(book.id);
    if (!(root && slot) || out) {
      return;
    }
    const r = root.getBoundingClientRect();
    const s = slot.getBoundingClientRect();
    const coverW = book.height * COVER_RATIO;
    const scale = Math.min(1.15, (r.height * 0.72) / book.height);
    const narrow = r.width < 480;
    const centerX = narrow ? r.width * 0.27 : r.width * 0.26;
    const centerY = r.height / 2;
    const left = centerX - coverW / 2;
    const top = centerY - book.height / 2;
    setFlight({
      book,
      from: {
        x: s.left + s.width / 2 - r.left - centerX,
        y: s.top + s.height / 2 - r.top - centerY,
      },
      at: {
        left,
        top,
        scale,
        textLeft: centerX + (coverW * scale) / 2 + (narrow ? 16 : 32),
      },
    });
    setOut(book.id);
    onOpen?.(book);
  };

  const close = useCallback(() => setFlight(null), []);

  useEffect(() => {
    if (!flight) {
      return;
    }
    putBackRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flight, close]);

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "relative h-[300px] w-full max-w-2xl overflow-hidden rounded-2xl bg-[#f7f4ee] ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10",
          className
        )}
        ref={rootRef}
      >
        <header className="flex items-baseline justify-between px-5 pt-4">
          <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
            {title}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {books.length} books · {reading} in progress
          </p>
        </header>

        {/* The shelf */}
        <div className="absolute inset-x-0 bottom-9 flex justify-center">
          <ul className="flex max-w-full items-end gap-[3px] overflow-x-auto px-6 pt-4 [scrollbar-width:none]">
            {books.map((book) => (
              <li className="shrink-0" key={book.id}>
                <Spine
                  book={book}
                  hidden={out === book.id}
                  onOpen={() => open(book)}
                  ref={(el) => {
                    if (el) {
                      slotRefs.current.set(book.id, el);
                    } else {
                      slotRefs.current.delete(book.id);
                    }
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-x-4 bottom-6 h-3 rounded-[3px] bg-[#e6dccb] shadow-[0_6px_10px_-6px_rgb(60_40_20/0.45),inset_0_1px_0_rgb(255_255_255/0.6)] dark:bg-stone-700 dark:shadow-[0_6px_10px_-6px_rgb(0_0_0/0.8),inset_0_1px_0_rgb(255_255_255/0.08)]"
        />

        <AnimatePresence onExitComplete={() => setOut(null)}>
          {flight && (
            <OpenBook
              flight={flight}
              key={flight.book.id}
              onClose={close}
              putBackRef={putBackRef}
              reduceMotion={Boolean(reduceMotion)}
            />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

function Spine({
  book,
  hidden,
  onOpen,
  ref,
}: {
  book: ShelfBook;
  hidden: boolean;
  onOpen: () => void;
  ref: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      aria-label={`${book.title} by ${book.author}`}
      className={cn(
        "relative block rounded-[3px] outline-hidden transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-2 focus-visible:-translate-y-2 focus-visible:ring-2 focus-visible:ring-zinc-900/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f4ee] motion-reduce:transition-none dark:focus-visible:ring-white/40 dark:focus-visible:ring-offset-zinc-900",
        hidden && "invisible"
      )}
      onClick={onOpen}
      ref={ref}
      style={{ width: book.thickness, height: book.height }}
      type="button"
    >
      <SpineFace book={book} />
    </button>
  );
}

/** The cloth spine: bands, title running down, author at the foot. */
function SpineFace({ book }: { book: ShelfBook }) {
  return (
    <span
      className="absolute inset-0 flex flex-col items-center overflow-hidden rounded-[3px] py-2 shadow-[inset_2px_0_2px_rgb(255_255_255/0.12),inset_-2px_0_3px_rgb(0_0_0/0.18)]"
      style={{ backgroundColor: book.color, color: book.ink }}
    >
      <span className="h-px w-[70%] shrink-0 bg-current opacity-40" />
      <span className="mt-0.5 h-px w-[70%] shrink-0 bg-current opacity-40" />
      <span
        className="mt-3 min-h-0 flex-1 truncate font-semibold text-[11px] tracking-wide [writing-mode:vertical-rl]"
        style={{ fontSize: Math.min(12, book.thickness * 0.38) }}
      >
        {book.title}
      </span>
      <span
        className="mt-2 shrink-0 text-[8px] uppercase tracking-[0.12em] opacity-70 [writing-mode:vertical-rl]"
        style={{ fontSize: Math.min(8, book.thickness * 0.26) }}
      >
        {book.author.split(" ").at(-1)}
      </span>
      <span className="mt-2 h-px w-[70%] shrink-0 bg-current opacity-40" />
    </span>
  );
}

function OpenBook({
  flight,
  onClose,
  putBackRef,
  reduceMotion,
}: {
  flight: Flight;
  onClose: () => void;
  putBackRef: RefObject<HTMLButtonElement | null>;
  reduceMotion: boolean;
}) {
  const { book, from, at } = flight;
  const coverW = book.height * COVER_RATIO;
  const t = book.thickness;
  const progress = book.read === undefined ? 0 : book.read / book.pages;
  const finished = book.read === book.pages;

  // Off the shelf: up out of its slot, then across while it turns to face you.
  const shelved = {
    x: [from.x, from.x, 0],
    y: [from.y, from.y - LIFT, 0],
    z: [-coverW / 2, -coverW / 2, 0],
    rotateY: [90, 90, 0],
    scale: [1, 1, at.scale],
  };

  return (
    <>
      <motion.button
        animate={{ opacity: 1 }}
        aria-label="Put the book back"
        className="absolute inset-0 z-10 cursor-default bg-[#f7f4ee]/95 dark:bg-zinc-900/95"
        exit={{ opacity: 0, transition: { duration: 0.3, delay: 0.15 } }}
        initial={{ opacity: 0 }}
        onClick={onClose}
        tabIndex={-1}
        transition={{ duration: 0.25 }}
        type="button"
      />
      <div className="pointer-events-none absolute inset-0 z-20 [perspective:1100px]">
        <motion.div
          animate={
            reduceMotion
              ? { x: 0, y: 0, z: 0, rotateY: 0, scale: at.scale }
              : shelved
          }
          className="absolute [transform-style:preserve-3d]"
          exit={{
            x: [0, from.x, from.x],
            y: [0, from.y - LIFT, from.y],
            z: [0, -coverW / 2, -coverW / 2],
            rotateY: [0, 90, 90],
            scale: [at.scale, 1, 1],
            transition: reduceMotion
              ? { duration: 0 }
              : { ...PUT_BACK, times: [0, 0.75, 1] },
          }}
          initial={
            reduceMotion
              ? false
              : {
                  x: from.x,
                  y: from.y,
                  z: -coverW / 2,
                  rotateY: 90,
                  scale: 1,
                }
          }
          style={{
            left: at.left,
            top: at.top,
            width: coverW,
            height: book.height,
          }}
          // The lift takes the first quarter; the turn takes the rest.
          transition={
            reduceMotion ? { duration: 0 } : { ...PULL, times: [0, 0.25, 1] }
          }
        >
          <BookBox book={book} coverW={coverW} thickness={t} />
        </motion.div>
      </div>

      <motion.div
        animate={{ opacity: 1, x: 0 }}
        className="absolute inset-y-0 right-5 z-30 flex flex-col justify-center"
        exit={{ opacity: 0, x: 6, transition: { duration: 0.15 } }}
        initial={{ opacity: 0, x: 10 }}
        style={{ left: at.textLeft }}
        transition={{ duration: 0.3, delay: 0.4, ease: [0.23, 1, 0.32, 1] }}
      >
        <p className="text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400">
          {book.year} · {book.pages} pages
        </p>
        <h4 className="mt-1 font-semibold text-lg text-zinc-900 leading-tight tracking-tight dark:text-zinc-50">
          {book.title}
        </h4>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {book.author}
        </p>
        <div className="mt-4 max-w-56">
          <div className="h-1 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/10">
            <motion.div
              animate={{ scaleX: progress }}
              className="h-full origin-left rounded-full"
              initial={{ scaleX: 0 }}
              style={{ backgroundColor: book.color }}
              transition={{
                duration: 0.6,
                delay: 0.55,
                ease: [0.23, 1, 0.32, 1],
              }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400">
            {statusLine(book, finished)}
          </p>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            className="h-8 whitespace-nowrap rounded-lg bg-zinc-900 px-3 font-medium text-[13px] text-white transition-colors duration-150 hover:bg-zinc-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-900/40 focus-visible:ring-offset-2 dark:bg-white dark:text-zinc-900 dark:focus-visible:ring-offset-zinc-900 dark:hover:bg-zinc-200"
            type="button"
          >
            {readLabel(book, finished)}
          </button>
          <button
            className="h-8 whitespace-nowrap rounded-lg px-3 text-[13px] text-zinc-600 ring-1 ring-black/10 transition-colors duration-150 hover:bg-white hover:text-zinc-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-900/40 dark:text-zinc-300 dark:ring-white/15 dark:hover:bg-white/5 dark:hover:text-white"
            onClick={onClose}
            ref={putBackRef}
            type="button"
          >
            Put back
          </button>
        </div>
      </motion.div>
    </>
  );
}

function statusLine(book: ShelfBook, finished: boolean) {
  if (finished) {
    return "Finished";
  }
  if (book.read === undefined) {
    return "Not started";
  }
  return `Page ${book.read} of ${book.pages}`;
}

function readLabel(book: ShelfBook, finished: boolean) {
  if (finished) {
    return "Read again";
  }
  return book.read === undefined ? "Start reading" : "Continue";
}

/** A book as a box: cover in front, spine on the left, page block on the right. */
function BookBox({
  book,
  coverW,
  thickness,
}: {
  book: ShelfBook;
  coverW: number;
  thickness: number;
}) {
  const face: CSSProperties = { position: "absolute", top: 0, height: "100%" };
  return (
    <>
      <div
        className="overflow-hidden rounded-r-[4px] rounded-l-[2px] shadow-[inset_3px_0_4px_rgb(0_0_0/0.18),0_20px_30px_-16px_rgb(40_25_10/0.5)]"
        style={{
          ...face,
          left: 0,
          width: coverW,
          transform: `translateZ(${thickness / 2}px)`,
          backgroundColor: book.color,
          color: book.ink,
        }}
      >
        <Cover book={book} />
      </div>
      <div
        className="rounded-[3px]"
        style={{
          ...face,
          left: (coverW - thickness) / 2,
          width: thickness,
          transform: `rotateY(-90deg) translateZ(${coverW / 2}px)`,
        }}
      >
        <SpineFace book={book} />
      </div>
      <div
        className="bg-[#efe9dc] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.05)] dark:bg-[#d9d2c3]"
        style={{
          ...face,
          top: "2%",
          height: "96%",
          left: (coverW - thickness) / 2,
          width: thickness,
          transform: `rotateY(90deg) translateZ(${coverW / 2 - 2}px)`,
        }}
      />
      <div
        style={{
          ...face,
          left: 0,
          width: coverW,
          transform: `rotateY(180deg) translateZ(${thickness / 2}px)`,
          backgroundColor: book.color,
        }}
      />
    </>
  );
}

function Cover({ book }: { book: ShelfBook }) {
  return (
    <div className="flex size-full flex-col p-[10%]">
      <p className="font-semibold text-[15px] leading-tight tracking-tight">
        {book.title}
      </p>
      <p className="mt-1 text-[9px] uppercase tracking-[0.16em] opacity-75">
        {book.author}
      </p>
      <div className="mt-auto flex justify-center pb-[6%] opacity-80">
        <MotifArt motif={book.motif ?? "circle"} />
      </div>
    </div>
  );
}

function MotifArt({ motif }: { motif: Motif }) {
  return (
    <svg
      aria-hidden="true"
      className="w-[70%]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      viewBox="0 0 64 48"
    >
      <MotifShapes motif={motif} />
    </svg>
  );
}

function MotifShapes({ motif }: { motif: Motif }) {
  switch (motif) {
    case "bars":
      return <path d="M8 40h48M8 32h40M8 24h48M8 16h32" />;
    case "arch":
      return (
        <path d="M14 46V24a18 18 0 0 1 36 0v22M22 46V26a10 10 0 0 1 20 0v20" />
      );
    case "dots":
      return (
        <g fill="currentColor" stroke="none">
          {[12, 24, 36, 48].flatMap((x) =>
            [12, 24, 36].map((y) => (
              <circle cx={x + 2} cy={y} key={`${x}-${y}`} r={2} />
            ))
          )}
        </g>
      );
    case "wave":
      return (
        <path d="M4 18q7-8 14 0t14 0 14 0 14 0M4 28q7-8 14 0t14 0 14 0 14 0M4 38q7-8 14 0t14 0 14 0 14 0" />
      );
    default:
      return (
        <>
          <circle cx="32" cy="24" r="18" />
          <circle cx="32" cy="24" r="9" />
        </>
      );
  }
}
