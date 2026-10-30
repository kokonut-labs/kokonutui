"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CopyIconSwap, useCopy } from "@/components/landing/home/client";
import { PRO_PRICE, PRO_PRICING_URL } from "@/components/landing/home/data";
import {
  EASE_COLORS,
  FOCUS,
  INK,
  LEAF,
  LINE,
  META,
  MONO,
} from "@/components/landing/home/styles";
import { useHalloween } from "@/lib/halloween";
import { cn } from "@/lib/utils";

// On Halloween a ghost haunts a few component pages. It leans out from behind
// the demo's frame, ducks when the pointer comes close, and turns up again a
// moment later. Catch it on three of these pages for a treat.

const HAUNTED = [
  { name: "ai-prompt", title: "AI Input Selector", href: "/docs/ai/ai-prompt" },
  {
    name: "detent-dial",
    title: "Detent Dial",
    href: "/docs/inputs/detent-dial",
  },
  {
    name: "tear-button",
    title: "Tear Button",
    href: "/docs/buttons/tear-button",
  },
  {
    name: "apple-activity-card",
    title: "Apple Activity Card",
    href: "/docs/cards/apple-activity-card",
  },
  {
    name: "plucked-text",
    title: "Plucked Text",
    href: "/docs/texts/plucked-text",
  },
];
const CATCHES = 3;
const MARKS = ["first", "second", "third"];
/** How long it stays out when nobody comes for it. */
const PEEK_MS = 4200;
/** Its reaction time once the pointer is close: catch it inside this. */
const SPOOK_MS = 380;
const NOTICE_PX = 90;

/* Catches, kept across pages ------------------------------------------- */

const STORE_KEY = "kokonut-ghosts-2026";
const NONE: string[] = [];
const listeners = new Set<() => void>();
let caughtCache: string[] | null = null;

function readCaught(): string[] {
  if (caughtCache) {
    return caughtCache;
  }
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]");
    caughtCache = Array.isArray(saved)
      ? HAUNTED.map((h) => h.name).filter((name) => saved.includes(name))
      : NONE;
  } catch {
    caughtCache = NONE;
  }
  return caughtCache;
}

function addCaught(name: string) {
  const caught = readCaught();
  if (caught.includes(name)) {
    return;
  }
  caughtCache = [...caught, name];
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(caughtCache));
  } catch {
    // Storage can be blocked; the catch still counts for this visit.
  }
  for (const listener of listeners) {
    listener();
  }
}

function useCaught() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readCaught,
    () => NONE
  );
}

/** True when this page is haunted today and its ghost is still loose. */
function useHaunt(name: string) {
  const on = useHalloween("ghost");
  const haunted = on && HAUNTED.some((h) => h.name === name);
  return { haunted, caught: useCaught() };
}

/* The ghost ------------------------------------------------------------- */

type Phase = "away" | "peek" | "spooked" | "duck" | "caught" | "gone";
type Side = "left" | "right";

const wait = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Sits over a preview's demo area as a clipping layer, so the ghost seems to
 * lean out from behind the frame's own hairline.
 */
export function HauntedSurface({ name }: { name: string }) {
  const { haunted, caught } = useHaunt(name);
  if (!haunted || caught.includes(name)) {
    return null;
  }
  return <Ghost name={name} />;
}

function Ghost({ name }: { name: string }) {
  const reduce = useReducedMotion();
  const layerRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>("away");
  const [spot, setSpot] = useState<{ side: Side; top: number } | null>(null);
  const first = useRef(true);

  // Away: wait, then lean out somewhere along the frame, if it's on screen.
  useEffect(() => {
    if (phase !== "away") {
      return;
    }
    const id = window.setTimeout(
      () => {
        const r = layerRef.current?.getBoundingClientRect();
        if (!r || r.bottom < 120 || r.top > window.innerHeight - 120) {
          setPhase("duck");
          return;
        }
        first.current = false;
        setSpot((last) => ({
          // Never the same side twice running.
          side: last?.side === "left" ? "right" : "left",
          top: Math.round(wait(24, Math.max(32, r.height - 96))),
        }));
        setPhase("peek");
      },
      first.current ? 1200 : wait(1500, 3200)
    );
    return () => window.clearTimeout(id);
  }, [phase]);

  // Out: stay a while, or notice the pointer and duck.
  useEffect(() => {
    const after = (next: Phase, ms: number) => {
      const id = window.setTimeout(() => setPhase(next), ms);
      return () => window.clearTimeout(id);
    };
    if (phase === "duck") {
      return after("away", 450);
    }
    if (phase === "spooked") {
      return after("duck", SPOOK_MS);
    }
    if (phase === "caught") {
      // Count it once the poof has played; the page then lets it go.
      const id = window.setTimeout(() => addCaught(name), 600);
      return () => window.clearTimeout(id);
    }
    if (phase !== "peek") {
      return;
    }
    const id = window.setTimeout(() => setPhase("duck"), PEEK_MS);
    const onMove = (event: PointerEvent) => {
      const r = ghostRef.current?.getBoundingClientRect();
      if (!r || event.pointerType !== "mouse") {
        return;
      }
      const dx = Math.max(r.left - event.clientX, 0, event.clientX - r.right);
      const dy = Math.max(r.top - event.clientY, 0, event.clientY - r.bottom);
      if (Math.hypot(dx, dy) < NOTICE_PX) {
        setPhase("spooked");
      }
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointermove", onMove);
    };
  }, [phase, name]);

  const out = phase === "peek" || phase === "spooked";
  const sign = spot?.side === "right" ? 1 : -1;
  let animate = { x: `${sign * 110}%`, y: 0, rotate: 0, opacity: 1 };
  if (out) {
    animate = { x: `${sign * 30}%`, y: 0, rotate: sign * -14, opacity: 1 };
  }
  if (phase === "caught") {
    animate = { x: `${sign * 30}%`, y: -28, rotate: sign * -14, opacity: 0 };
  }
  if (reduce) {
    animate = { ...animate, x: `${sign * 30}%`, y: 0, opacity: out ? 1 : 0 };
  }

  return (
    <div
      aria-hidden={!out}
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      ref={layerRef}
    >
      {spot ? (
        <motion.button
          animate={animate}
          aria-label="Catch the ghost"
          className={cn(
            "absolute size-[72px] cursor-pointer touch-manipulation outline-none",
            out && "pointer-events-auto",
            spot.side === "left" ? "left-0" : "right-0"
          )}
          initial={{ x: `${sign * 110}%`, y: 0, rotate: 0, opacity: 1 }}
          key={`${spot.side}-${spot.top}`}
          onPointerDown={() => {
            if (out) {
              setPhase("caught");
            }
          }}
          ref={ghostRef}
          style={{ top: spot.top }}
          tabIndex={out ? 0 : -1}
          transition={
            phase === "caught"
              ? { duration: 0.5, ease: [0.23, 1, 0.32, 1] }
              : { type: "spring", stiffness: 260, damping: 24 }
          }
          type="button"
        >
          <GhostGlyph spooked={phase === "spooked"} />
        </motion.button>
      ) : null}
    </div>
  );
}

function GhostGlyph({ spooked }: { spooked: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="block size-full text-black dark:text-white"
      fill="none"
      viewBox="0 0 48 56"
    >
      <path
        className="fill-white dark:fill-black"
        d={GHOST_PATH}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
      <ellipse
        cx={18.5}
        cy={23}
        fill="currentColor"
        rx={2.3}
        ry={spooked ? 4.2 : 3}
      />
      <ellipse
        cx={29.5}
        cy={23}
        fill="currentColor"
        rx={2.3}
        ry={spooked ? 4.2 : 3}
      />
      {spooked ? (
        <ellipse cx={24} cy={33} fill="currentColor" rx={2} ry={2.6} />
      ) : null}
    </svg>
  );
}

const GHOST_PATH =
  "M7 25C7 13.4 14.6 5 24 5S41 13.4 41 25V50Q38.2 54 35.3 50T29.7 50 24 50 18.3 50 12.7 50 7 50Z";

/* The note under the demo ---------------------------------------------- */

/**
 * A row at the foot of a haunted preview: the dare, then where the other
 * ghosts are, then the treat once three are caught.
 */
export function HauntedNote({ name }: { name: string }) {
  const { haunted, caught } = useHaunt(name);
  const { copied, copy } = useCopy();
  if (!haunted) {
    return null;
  }
  const done = caught.length >= CATCHES;
  const loose = HAUNTED.filter(
    (h) => h.name !== name && !caught.includes(h.name)
  );
  const left = CATCHES - caught.length;

  let message = (
    <p className={META}>A ghost is hiding behind this demo. Catch it.</p>
  );
  if (caught.includes(name) && !done) {
    message = (
      <p className={META}>
        Caught. {left} more {left === 1 ? "hides" : "hide"} in{" "}
        {loose.slice(0, 2).map((h, i) => (
          <span key={h.name}>
            {i > 0 ? " or " : null}
            <Link
              className={cn(
                "underline decoration-black/25 underline-offset-4 hover:text-black hover:decoration-black dark:decoration-white/25 dark:hover:text-white dark:hover:decoration-white",
                EASE_COLORS,
                FOCUS
              )}
              href={h.href}
            >
              {h.title}
            </Link>
          </span>
        ))}
      </p>
    );
  }
  if (done) {
    message = (
      <p className={cn("text-[13px]", INK)}>
        Treat: {PRO_PRICE.percent}% off{" "}
        <a
          className={cn(
            "underline decoration-black/30 underline-offset-4 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white",
            FOCUS
          )}
          href={PRO_PRICING_URL}
          rel="noreferrer"
          target="_blank"
        >
          Kokonut UI Pro
        </a>{" "}
        with the code
      </p>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-10 flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t px-4 py-2",
        LINE
      )}
    >
      {message}
      {done ? (
        <button
          aria-label={copied ? "Copied" : `Copy the code ${PRO_PRICE.code}`}
          className={cn(
            "inline-flex items-center gap-2 text-[13px]",
            MONO,
            LEAF,
            EASE_COLORS,
            FOCUS
          )}
          onClick={() => copy(PRO_PRICE.code)}
          type="button"
        >
          {PRO_PRICE.code}
          <CopyIconSwap className="size-3.5" copied={copied} />
        </button>
      ) : (
        <span className="flex items-center gap-1.5">
          {MARKS.map((mark, i) => (
            <TallyMark filled={i < caught.length} key={mark} />
          ))}
          <span className={cn(META, "ml-1.5 tabular-nums")}>
            {Math.min(caught.length, CATCHES)} / {CATCHES}
          </span>
        </span>
      )}
    </div>
  );
}

function TallyMark({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "size-4 transition-colors duration-200 ease-out",
        filled ? "text-[color:var(--leaf)]" : "text-black/25 dark:text-white/25"
      )}
      viewBox="0 0 48 56"
    >
      <path
        d={GHOST_PATH}
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={3.5}
      />
      <ellipse
        className={filled ? "fill-white dark:fill-black" : "fill-current"}
        cx={18.5}
        cy={23}
        rx={3.2}
        ry={4.2}
      />
      <ellipse
        className={filled ? "fill-white dark:fill-black" : "fill-current"}
        cx={29.5}
        cy={23}
        rx={3.2}
        ry={4.2}
      />
    </svg>
  );
}
