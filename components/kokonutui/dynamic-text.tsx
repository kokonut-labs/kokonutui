"use client";

/**
 * @author: @dorianbaffier
 * @description: Dynamic Text. Morphing text where letters are physical
 * objects: shared letters travel to their new place on a spring arc, leaving
 * letters fall off the baseline, entering letters drop in and land, and digits
 * roll like a counter. Also has a `decode` mode (cells scramble and lock left
 * to right) and a `cycle` mode (the greeting rhythm).
 * @version: 2.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface Greeting {
  text: string;
  /** BCP 47 language tag, so screen readers pronounce each word correctly. */
  lang?: string;
}

export type DynamicTextMode = "morph" | "decode" | "cycle";

export interface DynamicTextProps {
  /**
   * `morph`: letters travel, fall and land. `decode`: monospace cells scramble
   * and lock left to right. `cycle`: morphs through `words` with a greeting
   * rhythm (a long first word, faster middle words, a hold on the last).
   */
  mode?: DynamicTextMode;
  /** The string to show. Change it to animate. When set, `words` is ignored. */
  text?: string;
  /** Words to rotate through when `text` is not set. */
  words?: (string | Greeting)[];
  /**
   * Milliseconds each word holds. In `cycle` mode this is the first word's
   * hold; the middle words speed up from there.
   */
  interval?: number;
  /** Start over after the last word. Defaults to true, except in `cycle`. */
  loop?: boolean;
  /** Called once the last word is shown. Never called when looping. */
  onComplete?: () => void;
  className?: string;
}

const MORPH_WORDS = ["Create", "Iterate", "Repeat", "Ship"];
const DECODE_WORDS = ["Hello, world", "Build 4096 ready", "All systems go"];
const GREETINGS: Greeting[] = [
  { text: "Hello", lang: "en" },
  { text: "こんにちは", lang: "ja" },
  { text: "Bonjour", lang: "fr" },
  { text: "Hola", lang: "es" },
  { text: "안녕하세요", lang: "ko" },
  { text: "Ciao", lang: "it" },
  { text: "Hallo", lang: "de" },
  { text: "Hello", lang: "en" },
];

const DEFAULT_WORDS: Record<DynamicTextMode, (string | Greeting)[]> = {
  morph: MORPH_WORDS,
  decode: DECODE_WORDS,
  cycle: GREETINGS,
};
const DEFAULT_INTERVAL: Record<DynamicTextMode, number> = {
  morph: 2200,
  decode: 2800,
  cycle: 900,
};

/* Text helpers ---------------------------------------------------------- */

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/** Splits into user-perceived characters, so emoji and Hangul stay whole. */
function splitGraphemes(value: string): string[] {
  return segmenter
    ? Array.from(segmenter.segment(value), (s) => s.segment)
    : Array.from(value);
}

const isDigit = (char: string) => char >= "0" && char <= "9";
const isBlank = (char: string) => char.trim() === "";
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function toGreeting(word: string | Greeting): Greeting {
  return typeof word === "string" ? { text: word } : word;
}

/** How long word `index` of `count` holds before the next one. */
function holdFor(
  mode: DynamicTextMode,
  index: number,
  count: number,
  interval: number
) {
  if (mode !== "cycle") {
    return interval;
  }
  if (index === 0) {
    return interval;
  }
  if (index === count - 1) {
    return interval * 2;
  }
  // The middle words accelerate, like someone getting into the rhythm.
  return Math.max(90, interval * 0.36 * 0.8 ** (index - 1));
}

function useReducedMotionRef() {
  const ref = useRef(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      ref.current = query.matches;
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return ref;
}

/** True while the element is on screen and the tab is visible. */
function useRunning(ref: RefObject<HTMLElement | null>) {
  const [running, setRunning] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    let inView = false;
    const sync = () =>
      setRunning(inView && document.visibilityState === "visible");
    const observer = new IntersectionObserver((entries) => {
      inView = entries.some((e) => e.isIntersecting);
      sync();
    });
    observer.observe(el);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [ref]);
  return running;
}

/* Morph physics --------------------------------------------------------- */

type Phase = "rest" | "travel" | "drop" | "fall" | "roll" | "fade";

interface Glyph {
  id: number;
  char: string;
  digit: boolean;
  /** Digit position counted from the right, so prices roll like counters. */
  slot: number;
  el: HTMLSpanElement | null;
  phase: Phase;
  leaving: boolean;
  delay: number;
  x: number;
  vx: number;
  tx: number;
  x0: number;
  arc: number;
  y: number;
  vy: number;
  ty: number;
  r: number;
  vr: number;
  tr: number;
  sq: number;
  vsq: number;
  o: number;
}

interface Token {
  char: string;
  x: number;
  digit: boolean;
  slot: number;
}

interface GlyphView {
  id: number;
  char: string;
}

const STEP = 1 / 120;
const damping = (k: number, zeta: number) => 2 * zeta * Math.sqrt(k);
const TRAVEL_K = 140;
const TRAVEL_C = damping(TRAVEL_K, 0.8);
const LIFT_K = 300;
const LIFT_C = damping(LIFT_K, 0.9);
const ROLL_K = 200;
const ROLL_C = damping(ROLL_K, 0.86);
const SQUASH_K = 1400;
const SQUASH_C = damping(SQUASH_K, 0.6);
const TILT_K = 140;
const TILT_C = damping(TILT_K, 0.7);
const WIDTH_K = 220;
const WIDTH_C = damping(WIDTH_K, 1);
/** Distances below are in em, so the motion scales with the font. */
const GRAVITY = 32;
const DROP = 0.7;
const FALL_FADE = 0.9;
const ROLL = 0.75;
const LAND_SQUASH = -0.16;
const ENTER_STAGGER = 0.035;
/** Long strings share this much stagger, so the last letter isn't late. */
const MAX_ENTER_SPREAD = 0.45;
const FADE_RATE = 7;

function paint(g: Glyph) {
  if (!g.el) {
    return;
  }
  const sy = 1 + g.sq;
  const sx = 1 - g.sq * 0.6;
  g.el.style.transform = `translate3d(${g.x.toFixed(2)}px, ${g.y.toFixed(2)}px, 0) rotate(${g.r.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
  g.el.style.opacity = g.o.toFixed(3);
}

function stepSquash(g: Glyph, h: number) {
  if (g.sq === 0 && g.vsq === 0) {
    return;
  }
  g.vsq += (-SQUASH_K * g.sq - SQUASH_C * g.vsq) * h;
  g.sq += g.vsq * h;
  if (Math.abs(g.sq) < 0.001 && Math.abs(g.vsq) < 0.01) {
    g.sq = 0;
    g.vsq = 0;
  }
}

function stepTravel(g: Glyph, h: number) {
  // Lift along a shallow arc that peaks halfway, so crossing letters pass
  // over and under each other instead of through.
  const span = Math.abs(g.tx - g.x0);
  const p = span < 0.5 ? 1 : clamp01(1 - Math.abs(g.tx - g.x) / span);
  g.ty = g.arc * 4 * p * (1 - p);
  g.vx += (-TRAVEL_K * (g.x - g.tx) - TRAVEL_C * g.vx) * h;
  g.x += g.vx * h;
  g.vy += (-LIFT_K * (g.y - g.ty) - LIFT_C * g.vy) * h;
  g.y += g.vy * h;
  g.o = Math.min(1, g.o + FADE_RATE * h);
}

function stepDrop(g: Glyph, h: number, em: number) {
  g.vy += GRAVITY * em * h;
  g.y += g.vy * h;
  if (g.y >= 0) {
    // Landing: one squash, then the spring takes it back.
    g.y = 0;
    g.vy = 0;
    g.sq = LAND_SQUASH;
    g.phase = "rest";
  }
  g.o = clamp01(1 + g.y / (DROP * em));
}

function stepFall(g: Glyph, h: number, em: number) {
  g.vy += GRAVITY * em * h;
  g.y += g.vy * h;
  g.x += g.vx * h;
  g.vr += (-TILT_K * (g.r - g.tr) - TILT_C * g.vr) * h;
  g.r += g.vr * h;
  g.o = Math.min(g.o, clamp01(1 - g.y / (FALL_FADE * em)));
}

function stepRoll(g: Glyph, h: number, em: number) {
  g.vy += (-ROLL_K * (g.y - g.ty) - ROLL_C * g.vy) * h;
  g.y += g.vy * h;
  g.o = clamp01(1 - Math.abs(g.y) / (ROLL * em));
}

function stepFade(g: Glyph, h: number) {
  g.o = clamp01(g.o + (g.leaving ? -FADE_RATE : FADE_RATE) * h);
}

function stepGlyph(g: Glyph, h: number, em: number) {
  switch (g.phase) {
    case "travel":
      stepTravel(g, h);
      break;
    case "drop":
      stepDrop(g, h, em);
      break;
    case "fall":
      stepFall(g, h, em);
      break;
    case "roll":
      stepRoll(g, h, em);
      break;
    case "fade":
      stepFade(g, h);
      break;
    default:
      break;
  }
  stepSquash(g, h);
}

const isGone = (g: Glyph) => g.leaving && g.o <= 0.002;

/** Moves a glyph into rest once it has arrived. Returns true while moving. */
function settle(g: Glyph): boolean {
  if (g.leaving) {
    return !isGone(g);
  }
  const arrived =
    Math.abs(g.x - g.tx) < 0.05 &&
    Math.abs(g.vx) < 0.5 &&
    Math.abs(g.y) < 0.05 &&
    Math.abs(g.vy) < 0.5;
  const done =
    (g.phase === "travel" && arrived) ||
    (g.phase === "roll" && arrived) ||
    (g.phase === "fade" && g.o >= 1);
  if (done) {
    g.x = g.tx;
    g.y = 0;
    g.vx = 0;
    g.vy = 0;
    g.o = 1;
    g.phase = "rest";
  }
  return g.phase !== "rest" || g.sq !== 0;
}

/** Direction digits roll: 1 when the number grew (old goes up, new comes up). */
function rollDirection(previous: Glyph[], tokens: Token[]) {
  const before = Number(
    previous
      .filter((g) => g.digit)
      .map((g) => g.char)
      .join("")
  );
  const after = Number(
    tokens
      .filter((t) => t.digit)
      .map((t) => t.char)
      .join("")
  );
  return after < before ? -1 : 1;
}

/** Squeezes the entering stagger so a long string doesn't trickle in. */
function capStagger(glyphs: Glyph[], entering: number) {
  const spread = entering * ENTER_STAGGER;
  if (spread <= MAX_ENTER_SPREAD) {
    return;
  }
  for (const g of glyphs) {
    g.delay *= MAX_ENTER_SPREAD / spread;
  }
}

class MorphEngine {
  glyphs: Glyph[] = [];
  /** The glyphs that spell the current text, in order. */
  order: Glyph[] = [];
  root: HTMLSpanElement | null = null;
  onChange: (() => void) | null = null;
  reduced = false;
  started = false;
  em = 16;
  w = 0;
  vw = 0;
  tw = 0;
  private nextId = 0;
  private raf = 0;
  private last = 0;
  private readonly refs = new Map<
    number,
    (el: HTMLSpanElement | null) => void
  >();

  views(): GlyphView[] {
    return this.glyphs.map((g) => ({ id: g.id, char: g.char }));
  }

  refFor(id: number) {
    let ref = this.refs.get(id);
    if (!ref) {
      ref = (el: HTMLSpanElement | null) => {
        const glyph = this.glyphs.find((g) => g.id === id);
        if (glyph) {
          glyph.el = el;
          paint(glyph);
        }
      };
      this.refs.set(id, ref);
    }
    return ref;
  }

  private create(t: Token): Glyph {
    const glyph: Glyph = {
      id: this.nextId++,
      char: t.char,
      digit: t.digit,
      slot: t.slot,
      el: null,
      phase: "rest",
      leaving: false,
      delay: 0,
      x: t.x,
      vx: 0,
      tx: t.x,
      x0: t.x,
      arc: 0,
      y: 0,
      vy: 0,
      ty: 0,
      r: 0,
      vr: 0,
      tr: 0,
      sq: 0,
      vsq: 0,
      o: 1,
    };
    this.glyphs.push(glyph);
    return glyph;
  }

  private move(g: Glyph, t: Token, instant: boolean) {
    g.slot = t.slot;
    g.tx = t.x;
    if (instant) {
      g.x = t.x;
      g.y = 0;
      g.vx = 0;
      g.vy = 0;
      g.phase = g.o < 1 ? "fade" : "rest";
      return;
    }
    if (g.phase === "rest" && Math.abs(t.x - g.x) < 0.5) {
      g.x = t.x;
      return;
    }
    // Redirects keep the current position and velocity: no restart.
    g.x0 = g.x;
    g.delay = 0;
    const distance = t.x - g.x;
    g.arc =
      -Math.sign(distance) *
      Math.min(0.22 * this.em, Math.abs(distance) * 0.14);
    g.phase = "travel";
  }

  private enter(g: Glyph, dir: number, instant: boolean, index: number) {
    g.o = 0;
    if (instant) {
      g.phase = "fade";
      return;
    }
    if (g.digit) {
      g.y = dir * ROLL * this.em;
      g.ty = 0;
      g.phase = "roll";
      return;
    }
    g.y = -DROP * this.em;
    g.phase = "drop";
    g.delay = index * ENTER_STAGGER;
  }

  private leave(g: Glyph, dir: number, instant: boolean) {
    g.leaving = true;
    g.delay = 0;
    if (instant) {
      g.phase = "fade";
      return;
    }
    if (g.digit) {
      g.phase = "roll";
      g.ty = -dir * ROLL * 1.2 * this.em;
      return;
    }
    // Tip toward the side it sits on, 5-15°, and drift that way a little.
    const side = g.x + this.em * 0.3 < this.tw / 2 ? -1 : 1;
    g.tr = side * (5 + ((g.id * 7) % 11));
    g.vx = side * 0.4 * this.em;
    g.vy = Math.max(g.vy, 0);
    g.phase = "fall";
  }

  /** Re-places the current text after a resize or a font load. */
  place(tokens: Token[], width: number) {
    if (tokens.length !== this.order.length) {
      return;
    }
    tokens.forEach((t, i) => {
      const g = this.order[i];
      if (g) {
        g.tx = t.x;
        if (g.phase === "rest") {
          g.x = t.x;
          paint(g);
        }
      }
    });
    this.tw = width;
    if (!this.raf) {
      this.w = width;
      this.paintWidth();
    }
  }

  update(tokens: Token[], width: number) {
    if (!this.started) {
      // First paint: put everything in place, no animation.
      this.started = true;
      this.order = tokens.map((t) => this.create(t));
      this.w = width;
      this.tw = width;
      this.paintWidth();
      return;
    }
    const instant = this.reduced;
    const letters = new Map<string, Glyph[]>();
    const slots = new Map<number, Glyph>();
    for (const g of this.order) {
      if (g.digit) {
        slots.set(g.slot, g);
      } else {
        letters.set(g.char, [...(letters.get(g.char) ?? []), g]);
      }
    }
    const dir = rollDirection(this.order, tokens);
    const next: Glyph[] = [];
    let entering = 0;
    for (const t of tokens) {
      let old: Glyph | undefined;
      if (t.digit) {
        old = slots.get(t.slot);
        slots.delete(t.slot);
      } else {
        old = letters.get(t.char)?.shift();
      }
      if (old && old.char === t.char) {
        this.move(old, t, instant);
        next.push(old);
        continue;
      }
      if (old) {
        this.leave(old, dir, instant);
      }
      const g = this.create(t);
      this.enter(g, dir, instant, entering++);
      next.push(g);
    }
    capStagger(next, entering);
    for (const list of letters.values()) {
      for (const g of list) {
        this.leave(g, dir, instant);
      }
    }
    for (const g of slots.values()) {
      this.leave(g, dir, instant);
    }
    this.order = next;
    this.tw = width;
    if (instant) {
      this.w = width;
      this.vw = 0;
      this.paintWidth();
    }
  }

  private paintWidth() {
    if (this.root) {
      this.root.style.width = `${this.w.toFixed(2)}px`;
    }
  }

  private stepWidth(dt: number) {
    if (Math.abs(this.w - this.tw) < 0.1 && Math.abs(this.vw) < 0.1) {
      if (this.w !== this.tw) {
        this.w = this.tw;
        this.vw = 0;
        this.paintWidth();
      }
      return false;
    }
    let t = dt;
    while (t > 1e-6) {
      const h = Math.min(STEP, t);
      this.vw += (-WIDTH_K * (this.w - this.tw) - WIDTH_C * this.vw) * h;
      this.w += this.vw * h;
      t -= h;
    }
    this.paintWidth();
    return true;
  }

  private stepAll(dt: number) {
    let moving = false;
    for (const g of this.glyphs) {
      if (g.delay > 0) {
        g.delay -= dt;
        moving = true;
        continue;
      }
      let t = dt;
      while (t > 1e-6) {
        const h = Math.min(STEP, t);
        stepGlyph(g, h, this.em);
        t -= h;
      }
      if (settle(g)) {
        moving = true;
      }
      paint(g);
    }
    return moving;
  }

  private readonly tick = (now: number) => {
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    const moving = this.stepAll(dt);
    const resizing = this.stepWidth(dt);
    if (this.glyphs.some(isGone)) {
      for (const g of this.glyphs) {
        if (isGone(g)) {
          this.refs.delete(g.id);
        }
      }
      this.glyphs = this.glyphs.filter((g) => !isGone(g));
      this.onChange?.();
    }
    // Sleep once everything has settled.
    this.raf = moving || resizing ? requestAnimationFrame(this.tick) : 0;
  };

  kick() {
    if (!this.raf) {
      this.last = 0;
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}

/** Reads where each character of `text` sits, from the hidden measure row. */
function measureTokens(measure: HTMLElement, text: string) {
  const chars = splitGraphemes(text);
  const cells = measure.children;
  const tokens: Token[] = [];
  chars.forEach((char, i) => {
    const cell = cells[i] as HTMLElement | undefined;
    if (!cell || isBlank(char)) {
      return;
    }
    tokens.push({ char, x: cell.offsetLeft, digit: isDigit(char), slot: 0 });
  });
  let slot = 0;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (t?.digit) {
      t.slot = slot++;
    }
  }
  return { tokens, width: measure.offsetWidth };
}

function MorphLayer({
  text,
  reducedRef,
}: {
  text: string;
  reducedRef: RefObject<boolean>;
}) {
  const chars = splitGraphemes(text);
  const rootRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const engineRef = useRef<MorphEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new MorphEngine();
  }
  const engine = engineRef.current;
  // Server and first client render lay the text out in flow; after mount the
  // glyphs switch to absolutely positioned, physics-driven spans.
  const [live, setLive] = useState(false);
  const [views, setViews] = useState<GlyphView[]>([]);

  useLayoutEffect(() => {
    engine.root = rootRef.current;
    engine.onChange = () => setViews(engine.views());
    setLive(true);
    return () => engine.stop();
  }, [engine]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const measure = measureRef.current;
    if (!(live && root && measure)) {
      return;
    }
    engine.em = Number.parseFloat(getComputedStyle(root).fontSize) || 16;
    engine.reduced = reducedRef.current;
    const { tokens, width } = measureTokens(measure, text);
    engine.update(tokens, width);
    setViews(engine.views());
    engine.kick();
  }, [engine, live, text, reducedRef]);

  // Fonts loading or the font size changing move the letters: re-place them.
  useEffect(() => {
    const root = rootRef.current;
    const measure = measureRef.current;
    if (!(live && root && measure)) {
      return;
    }
    const observer = new ResizeObserver(() => {
      engine.em = Number.parseFloat(getComputedStyle(root).fontSize) || 16;
      const { tokens, width } = measureTokens(measure, text);
      engine.place(tokens, width);
    });
    observer.observe(measure);
    return () => observer.disconnect();
  }, [engine, live, text]);

  return (
    <span className="relative inline-block align-baseline" ref={rootRef}>
      <span
        aria-hidden="true"
        className="pointer-events-none invisible absolute top-0 left-0"
        ref={measureRef}
      >
        {chars.map((char, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: characters are positional.
          <span key={i}>{char}</span>
        ))}
      </span>
      {live ? (
        <>
          <span aria-hidden="true" className="inline-block w-0">
            {"​"}
          </span>
          {views.map((view) => (
            <span
              aria-hidden="true"
              className="absolute top-0 left-0 origin-[50%_80%]"
              key={view.id}
              ref={engine.refFor(view.id)}
            >
              {view.char}
            </span>
          ))}
        </>
      ) : (
        <span aria-hidden="true">
          {chars.map((char, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: characters are positional.
            <span key={i}>{char}</span>
          ))}
        </span>
      )}
    </span>
  );
}

/* Decode ---------------------------------------------------------------- */

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*+=<>/";
const LOWER = "abcdefghijklmnopqrstuvwxyz#%&*+=<>/";
const DIGITS = "0123456789";
const SWAP_EVERY = 0.05;
const FLASH_FOR = 0.05;

function poolFor(char: string) {
  if (isDigit(char)) {
    return DIGITS;
  }
  return char.toLowerCase() === char ? LOWER : UPPER;
}

const randomFrom = (pool: string) =>
  pool[Math.floor(Math.random() * pool.length)] ?? "";

function writeCell(cell: Element | undefined, char: string) {
  const node = cell?.firstChild;
  if (node && node.nodeValue !== char) {
    node.nodeValue = char;
  }
}

interface DecodeCell {
  el: HTMLElement;
  char: string;
  lockAt: number;
  swapAt: number;
  state: "scramble" | "flash" | "done";
}

function stepCell(cell: DecodeCell, t: number) {
  if (cell.state === "flash") {
    if (t >= cell.lockAt + FLASH_FOR) {
      cell.el.removeAttribute("data-flash");
      cell.state = "done";
    }
    return;
  }
  if (t >= cell.lockAt) {
    writeCell(cell.el, cell.char);
    cell.el.removeAttribute("data-scramble");
    cell.el.setAttribute("data-flash", "");
    cell.state = "flash";
    return;
  }
  if (t >= cell.swapAt) {
    writeCell(cell.el, randomFrom(poolFor(cell.char)));
    cell.swapAt = t + SWAP_EVERY;
  }
}

function DecodeLayer({
  text,
  running,
  reducedRef,
}: {
  text: string;
  running: boolean;
  reducedRef: RefObject<boolean>;
}) {
  const chars = splitGraphemes(text);
  const hostRef = useRef<HTMLSpanElement>(null);
  /** What the cells settled on last time, so only changed cells scramble. */
  const shownRef = useRef<string[] | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!(host && running)) {
      return;
    }
    const next = splitGraphemes(text);
    const previous = shownRef.current;
    shownRef.current = next;
    const els = Array.from(host.children) as HTMLElement[];
    // A previous run may have left scrambled glyphs behind: reset to the text.
    els.forEach((el, i) => {
      writeCell(el, next[i] ?? "");
      el.removeAttribute("data-scramble");
      el.removeAttribute("data-flash");
    });
    const changed = next
      .map((char, i) => ({ char, i }))
      .filter(({ char, i }) => !isBlank(char) && previous?.[i] !== char);
    if (changed.length === 0) {
      return;
    }
    if (reducedRef.current) {
      host.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 160,
        easing: "ease-out",
      });
      return;
    }
    const stagger = Math.min(0.05, 0.75 / changed.length);
    const cells: DecodeCell[] = [];
    changed.forEach(({ char, i }, rank) => {
      const el = els[i];
      if (el) {
        el.setAttribute("data-scramble", "");
        cells.push({
          el,
          char,
          lockAt: 0.15 + rank * stagger,
          swapAt: 0,
          state: "scramble",
        });
      }
    });
    // One rAF writes every cell: no React render per tick, no layout shift.
    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      start ||= now;
      const t = (now - start) / 1000;
      for (const cell of cells) {
        stepCell(cell, t);
      }
      raf = cells.every((c) => c.state === "done")
        ? 0
        : requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      for (const cell of cells) {
        writeCell(cell.el, cell.char);
        cell.el.removeAttribute("data-scramble");
        cell.el.removeAttribute("data-flash");
      }
    };
  }, [text, running, reducedRef]);

  return (
    <span aria-hidden="true" className="font-mono" ref={hostRef}>
      {chars.map((char, i) => (
        <span
          className="inline-block w-[1ch] text-center data-flash:text-(--dynamic-text-accent) data-scramble:opacity-45"
          // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional.
          key={i}
        >
          {char}
        </span>
      ))}
    </span>
  );
}

/* Component ------------------------------------------------------------- */

const DynamicText = ({
  mode = "morph",
  text,
  words,
  interval,
  loop,
  onComplete,
  className,
}: DynamicTextProps) => {
  const list = (words ?? DEFAULT_WORDS[mode]).map(toGreeting);
  const count = list.length;
  const hold = interval ?? DEFAULT_INTERVAL[mode];
  const repeat = loop ?? mode !== "cycle";
  const controlled = text !== undefined;
  const rootRef = useRef<HTMLSpanElement>(null);
  const reducedRef = useReducedMotionRef();
  const running = useRunning(rootRef);
  // Counts every advance; the shown word is derived from it.
  const [step, setStep] = useState(0);
  const index = repeat ? step % Math.max(count, 1) : Math.min(step, count - 1);
  const isLast = index === count - 1;
  const isDone = !(controlled || repeat) && isLast;
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (controlled || isDone || !running || count < 2) {
      return;
    }
    const id = setTimeout(
      () => setStep((s) => s + 1),
      holdFor(mode, index, count, hold)
    );
    return () => clearTimeout(id);
  }, [controlled, isDone, running, count, mode, index, hold]);

  useEffect(() => {
    if (isDone) {
      onCompleteRef.current?.();
    }
  }, [isDone]);

  const current: Greeting = controlled
    ? { text }
    : (list[index] ?? { text: "" });

  return (
    <span
      className={cn(
        "inline-block whitespace-pre tabular-nums [--dynamic-text-accent:var(--color-emerald-600)] dark:[--dynamic-text-accent:var(--color-emerald-400)]",
        className
      )}
      lang={current.lang}
      ref={rootRef}
    >
      {/* Only announce text the app sets; words rotating on their own would
          talk over the reader every couple of seconds. */}
      <span aria-live={controlled ? "polite" : "off"} className="sr-only">
        {current.text}
      </span>
      {mode === "decode" ? (
        <DecodeLayer
          reducedRef={reducedRef}
          running={running}
          text={current.text}
        />
      ) : (
        <MorphLayer reducedRef={reducedRef} text={current.text} />
      )}
    </span>
  );
};

export default DynamicText;
