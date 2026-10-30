"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { CopyIconSwap, useCopy } from "@/components/landing/home/client";
import { PRO_PRICE, PRO_PRICING_URL } from "@/components/landing/home/data";
import {
  CELL,
  EASE_COLORS,
  FOCUS,
  INK,
  LEAF,
  META,
  MONO,
} from "@/components/landing/home/styles";
import { useHalloween } from "@/lib/halloween";
import { cn } from "@/lib/utils";

const CATCHES = 3;
const MARKS = ["first", "second", "third"];
/** How long it stays out when nobody comes for it. */
const PEEK_MS = 4200;
/** Its reaction time once the pointer is close: catch it inside this. */
const SPOOK_MS = 380;
const NOTICE_PX = 90;

type Phase = "away" | "peek" | "spooked" | "duck" | "caught";
type Side = "left" | "right";

interface Sighting {
  slot: number;
  side: Side;
  top: number;
}

interface Hunt {
  sighting: Sighting | null;
  phase: Phase;
  caught: number;
  register: (slot: number, el: HTMLElement | null) => void;
  catchIt: () => void;
  ghostRef: React.RefObject<HTMLButtonElement | null>;
}

const HuntContext = createContext<Hunt | null>(null);

const wait = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * A ghost hides behind the plates. It leans out from behind one plate's
 * hairline, ducks back when the pointer comes close, and turns up somewhere
 * else. Catch it three times for a treat.
 */
export function GhostHunt({ children }: { children: ReactNode }) {
  const on = useHalloween("ghost");
  return on ? <Hunting>{children}</Hunting> : children;
}

function Hunting({ children }: { children: ReactNode }) {
  const slots = useRef(new Map<number, HTMLElement>());
  const ghostRef = useRef<HTMLButtonElement>(null);
  const [sighting, setSighting] = useState<Sighting | null>(null);
  const [phase, setPhase] = useState<Phase>("away");
  const [caught, setCaught] = useState(0);

  const register = useCallback((slot: number, el: HTMLElement | null) => {
    if (el) {
      slots.current.set(slot, el);
    } else {
      slots.current.delete(slot);
    }
  }, []);

  // Away: wait, then lean out of a plate that's on screen, never the last one.
  useEffect(() => {
    if (phase !== "away" || caught >= CATCHES) {
      return;
    }
    const id = window.setTimeout(
      () => {
        const seen = [...slots.current.entries()].filter(([slot, el]) => {
          const r = el.getBoundingClientRect();
          return (
            slot !== sighting?.slot &&
            r.top > 72 &&
            r.bottom < window.innerHeight - 24
          );
        });
        if (seen.length === 0) {
          // Nobody's looking at the plates yet; check again shortly.
          setPhase("duck");
          return;
        }
        const [slot, el] = seen[Math.floor(Math.random() * seen.length)];
        const height = el.getBoundingClientRect().height;
        setSighting({
          slot,
          side: Math.random() < 0.5 ? "left" : "right",
          top: Math.round(wait(56, Math.max(64, height - 150))),
        });
        setPhase("peek");
      },
      caught === 0 && !sighting ? 900 : wait(1200, 2600)
    );
    return () => window.clearTimeout(id);
  }, [phase, caught, sighting]);

  // Out: stay a while, or notice the pointer and duck.
  useEffect(() => {
    if (phase === "duck") {
      const id = window.setTimeout(() => setPhase("away"), 450);
      return () => window.clearTimeout(id);
    }
    if (phase === "spooked") {
      const id = window.setTimeout(() => setPhase("duck"), SPOOK_MS);
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
  }, [phase]);

  // Caught: let it fade, then go again.
  useEffect(() => {
    if (phase !== "caught") {
      return;
    }
    const id = window.setTimeout(() => setPhase("away"), 600);
    return () => window.clearTimeout(id);
  }, [phase]);

  const catchIt = useCallback(() => {
    setPhase((p) => {
      if (p === "peek" || p === "spooked") {
        setCaught((c) => c + 1);
        return "caught";
      }
      return p;
    });
  }, []);

  return (
    <HuntContext.Provider
      value={{ sighting, phase, caught, register, catchIt, ghostRef }}
    >
      {children}
    </HuntContext.Provider>
  );
}

/**
 * Where the ghost can appear: a clipping layer over one plate, so it seems to
 * lean out from behind the plate's own hairline.
 */
export function GhostSlot({ slot }: { slot: number }) {
  const hunt = useContext(HuntContext);
  const reduce = useReducedMotion();
  if (!hunt) {
    return null;
  }
  const here = hunt.sighting?.slot === slot ? hunt.sighting : null;
  const out = here && (hunt.phase === "peek" || hunt.phase === "spooked");
  const caught = here && hunt.phase === "caught";
  const sign = here?.side === "right" ? 1 : -1;

  let animate = { x: `${sign * 110}%`, y: 0, rotate: 0, opacity: 1 };
  if (out) {
    animate = { x: `${sign * 30}%`, y: 0, rotate: sign * -14, opacity: 1 };
  }
  if (caught) {
    animate = { x: `${sign * 30}%`, y: -28, rotate: sign * -14, opacity: 0 };
  }
  if (reduce) {
    animate = { ...animate, x: `${sign * 30}%`, y: 0, opacity: out ? 1 : 0 };
  }

  return (
    <div
      aria-hidden={!out}
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      ref={(el) => hunt.register(slot, el)}
    >
      {here ? (
        <motion.button
          animate={animate}
          aria-label="Catch the ghost"
          className={cn(
            "absolute size-[72px] cursor-pointer touch-manipulation outline-none",
            out && "pointer-events-auto",
            here.side === "left" ? "left-0" : "right-0"
          )}
          initial={{ x: `${sign * 110}%`, y: 0, rotate: 0, opacity: 1 }}
          key={`${here.slot}-${here.top}`}
          onPointerDown={hunt.catchIt}
          ref={hunt.ghostRef}
          style={{ top: here.top }}
          tabIndex={out ? 0 : -1}
          transition={
            caught
              ? { duration: 0.5, ease: [0.23, 1, 0.32, 1] }
              : { type: "spring", stiffness: 260, damping: 24 }
          }
          type="button"
        >
          <GhostGlyph spooked={hunt.phase === "spooked"} />
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
        d="M7 25C7 13.4 14.6 5 24 5S41 13.4 41 25V50Q38.2 54 35.3 50T29.7 50 24 50 18.3 50 12.7 50 7 50Z"
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

/**
 * A row along the top of the plates: the dare, a tally of catches, then the
 * treat once all three are in.
 */
export function GhostTally() {
  const hunt = useContext(HuntContext);
  const { copied, copy } = useCopy();
  if (!hunt) {
    return null;
  }
  const done = hunt.caught >= CATCHES;
  return (
    <div
      className={cn(
        "flex min-h-10 flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2 sm:col-span-2 lg:col-span-3",
        CELL
      )}
    >
      {done ? (
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
      ) : (
        <p className={META}>
          Something is hiding behind these plates. Catch it {CATCHES} times.
        </p>
      )}
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
            <TallyMark filled={i < hunt.caught} key={mark} />
          ))}
          <span className={cn(META, "ml-1.5 tabular-nums")}>
            {hunt.caught} / {CATCHES}
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
        d="M7 25C7 13.4 14.6 5 24 5S41 13.4 41 25V50Q38.2 54 35.3 50T29.7 50 24 50 18.3 50 12.7 50 7 50Z"
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
