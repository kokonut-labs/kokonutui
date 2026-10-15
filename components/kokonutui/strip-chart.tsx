"use client";

/**
 * @author: @dorianbaffier
 * @description: Strip Chart
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// Paper feed, in px per second.
const FEED = 24;
// The pen writes this far in from the right edge; to its right is blank
// paper still to come.
const PEN_INSET = 64;
const TOP = 16;
const BOTTOM = 24;
// Grid, in px of paper: a minor line every half second, a major one every
// five minors, and a time label every second major.
const MINOR = 12;
const MAJOR = 5;
const LABEL_EVERY = 2;
const ROWS = 4;
// The pen has a little mass, so a spike overshoots by a hair.
const PEN_STIFFNESS = 260;
const PEN_DAMPING = 2 * Math.sqrt(PEN_STIFFNESS) * 0.8;
// A flicked paper coasts and slows on this half-life, in seconds.
const COAST_HALF_LIFE = 0.16;
// Reeling back to live, and seeking with the keys.
const REEL_STIFFNESS = 70;
const REEL_DAMPING = 2 * Math.sqrt(REEL_STIFFNESS);
const EDGE_STIFFNESS = 220;
const EDGE_DAMPING = 2 * Math.sqrt(EDGE_STIFFNESS);
// A flick toward now faster than this, in px per second, snaps back to live.
const FLICK_LIVE = 600;
// How much paper the chart keeps, in px (about four minutes).
const HISTORY = 6000;
// Seconds of history already on the paper when it mounts.
const PREFILL = 36;
// Longest gap filled in after the tab was hidden, in seconds.
const MAX_CATCH_UP = 120;
const STEP = 1 / 240;
const MAX_FRAME = 1 / 20;

type Mode = "live" | "held" | "coast" | "parked" | "seek" | "reel";

interface Sample {
  /** Paper position, px. */
  p: number;
  /** The value that came in. */
  v: number;
  /** Where the pen was, 0 to 1, or NaN while the pen was lifted. */
  pen: number;
  /** Ink width, px. */
  w: number;
}

interface Mark {
  p: number;
  label: string;
}

interface Palette {
  paper: string;
  grid: string;
  major: string;
  ink: string;
  text: string;
  accent: string;
  rail: string;
  font: string;
}

interface Readout {
  value: number;
  time: number;
  mode: "live" | "past" | "hover";
}

export interface StripChartProps {
  title?: string;
  unit?: string;
  min?: number;
  max?: number;
  /**
   * Feed your own metric: the pen follows the latest value. Leave it out to
   * run the built-in demo feed.
   */
  value?: number;
  className?: string;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

// Past an edge, the paper moves less the further you pull.
function rubber(value: number, lo: number, hi: number) {
  const give = 48;
  if (value < lo) {
    return lo - give * (1 - Math.exp((value - lo) / give));
  }
  if (value > hi) {
    return hi + give * (1 - Math.exp((hi - value) / give));
  }
  return value;
}

function gauss() {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * A believable traffic feed: a drifting baseline, a little chatter, bursts
 * that decay, and now and then a deploy that moves the baseline.
 */
function createSource(min: number, max: number) {
  const range = max - min;
  let mean = min + range * 0.42;
  let base = mean;
  let burst = 0;
  let chatter = 0;
  let chatterTarget = 0;
  let chatterClock = 0;
  let nextEvent = 9 + Math.random() * 8;
  let dip = 0;
  return (dt: number) => {
    let mark: string | null = null;
    base += (mean - base) * 0.35 * dt + gauss() * range * 0.035 * Math.sqrt(dt);
    burst *= Math.exp(-dt / 1.1);
    if (Math.random() < 0.09 * dt) {
      burst += range * (0.12 + Math.random() * 0.22);
    }
    chatterClock -= dt;
    if (chatterClock <= 0) {
      chatterClock = 0.12 + Math.random() * 0.12;
      chatterTarget = gauss() * range * 0.025;
    }
    chatter += (chatterTarget - chatter) * Math.min(1, dt * 14);
    dip *= Math.exp(-dt / 0.5);
    nextEvent -= dt;
    if (nextEvent <= 0) {
      nextEvent = 16 + Math.random() * 14;
      const up = mean < min + range * 0.4;
      mean = clamp(
        mean + (up ? 1 : -1) * range * (0.06 + Math.random() * 0.08),
        min + range * 0.25,
        min + range * 0.6
      );
      dip = range * 0.18;
      mark = Math.random() < 0.6 ? "Deploy" : "Scale up";
    }
    return { value: base + burst + chatter - dip, mark };
  };
}

function readPalette(node: HTMLElement): Palette {
  const style = getComputedStyle(node);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    paper: read("--strip-paper", "#ffffff"),
    grid: read("--strip-grid", "#f4f4f5"),
    major: read("--strip-major", "#e4e4e7"),
    ink: read("--strip-ink", "#18181b"),
    text: read("--strip-text", "#a1a1aa"),
    accent: read("--strip-accent", "#10b981"),
    rail: read("--strip-rail", "#d4d4d8"),
    font: style.fontFamily,
  };
}

const formatClock = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

function formatAxis(value: number) {
  if (Math.abs(value) >= 1000) {
    const k = value / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return `${Math.round(value)}`;
}

/** Index of the last sample at or before paper position p. */
function indexAt(samples: Sample[], p: number) {
  let lo = 0;
  let hi = samples.length - 1;
  if (hi < 0 || p < samples[0].p) {
    return -1;
  }
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (samples[mid].p <= p) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

interface ViewState {
  view: number;
  viewSpeed: number;
  feed: number;
  seekTo: number;
  mode: Mode;
  reduceMotion: boolean;
}

/** A flicked paper coasting to a stop; returns the next mode, if any. */
function coast(s: ViewState, dt: number, earliest: number): Mode | null {
  s.viewSpeed *= 0.5 ** (dt / COAST_HALF_LIFE);
  let edge = Number.NaN;
  if (s.view > s.feed) {
    edge = s.feed;
  } else if (s.view < earliest) {
    edge = earliest;
  }
  if (!Number.isNaN(edge)) {
    s.viewSpeed +=
      ((edge - s.view) * EDGE_STIFFNESS - s.viewSpeed * EDGE_DAMPING) * dt;
  }
  s.view += s.viewSpeed * dt;
  if (s.view >= s.feed - 1 && s.viewSpeed > 0) {
    return "reel";
  }
  if (Math.abs(s.viewSpeed) < 4 && Number.isNaN(edge)) {
    s.viewSpeed = 0;
    return "parked";
  }
  return null;
}

/** Springs the paper to a seek target, or reels it back to live. */
function reel(s: ViewState, dt: number): Mode | null {
  const target = s.mode === "reel" ? s.feed : s.seekTo;
  if (s.reduceMotion) {
    s.view = target;
    s.viewSpeed = 0;
  } else {
    s.viewSpeed +=
      ((target - s.view) * REEL_STIFFNESS - s.viewSpeed * REEL_DAMPING) * dt;
    s.view += s.viewSpeed * dt;
  }
  if (Math.abs(target - s.view) < 0.5 && Math.abs(s.viewSpeed) < 8) {
    s.view = target;
    s.viewSpeed = 0;
    return s.mode === "reel" ? "live" : "parked";
  }
  return null;
}

interface Frame {
  ctx: CanvasRenderingContext2D;
  c: Palette;
  w: number;
  h: number;
  penX: number;
  bottom: number;
  leftP: number;
  rightP: number;
  toX: (p: number) => number;
  plotY: (u: number) => number;
}

function vline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y0: number,
  y1: number
) {
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
}

/** Time lines travel with the paper; value lines stay put. */
function drawGrid(f: Frame, start: number) {
  const { ctx, c } = f;
  ctx.lineWidth = 1;
  ctx.font = `10px ${c.font}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const last = Math.ceil(f.rightP / MINOR);
  for (let k = Math.floor(f.leftP / MINOR); k <= last; k++) {
    const x = Math.round(f.toX(k * MINOR)) + 0.5;
    const major = k % MAJOR === 0;
    ctx.strokeStyle = major ? c.major : c.grid;
    vline(ctx, x, TOP, f.bottom);
    if (major && k % (MAJOR * LABEL_EVERY) === 0 && k >= 0) {
      ctx.fillStyle = c.text;
      ctx.fillText(
        formatClock(start + ((k * MINOR) / FEED) * 1000),
        x + 4,
        f.h - 8
      );
    }
  }
  for (let r = 0; r <= ROWS * 2; r++) {
    const y = Math.round(TOP + (r / (ROWS * 2)) * (f.bottom - TOP)) + 0.5;
    ctx.strokeStyle = r % 2 === 0 ? c.major : c.grid;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(f.w, y);
    ctx.stroke();
  }
}

/** Event marks: a tick at the top edge and a faint line down the paper. */
function drawMarks(f: Frame, marks: Mark[], inked: number) {
  const { ctx, c } = f;
  ctx.textBaseline = "top";
  ctx.strokeStyle = c.accent;
  ctx.fillStyle = c.accent;
  for (const mark of marks) {
    if (mark.p > inked || mark.p < f.leftP - 80 || mark.p > f.rightP) {
      continue;
    }
    const x = Math.round(f.toX(mark.p)) + 0.5;
    ctx.globalAlpha = 0.28;
    ctx.setLineDash([2, 3]);
    vline(ctx, x, TOP, f.bottom);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    vline(ctx, x, TOP - 6, TOP + 2);
    ctx.lineWidth = 1;
    // Near the left edge the label would sit on the scale numbers.
    if (x > 44) {
      ctx.fillText(mark.label, x + 4, 3);
    }
  }
}

/** The trace, in runs of equal width so it strokes in few calls. */
function drawTrace(f: Frame, samples: Sample[]) {
  const { ctx } = f;
  ctx.strokeStyle = f.c.ink;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  let run = -1;
  let open = false;
  const end = () => {
    if (open) {
      ctx.stroke();
      open = false;
    }
  };
  for (
    let i = Math.max(0, indexAt(samples, f.leftP - 2));
    i < samples.length;
    i++
  ) {
    const sample = samples[i];
    if (sample.p > f.rightP + 1) {
      break;
    }
    if (Number.isNaN(sample.pen)) {
      end();
      continue;
    }
    const x = f.toX(sample.p);
    const y = f.plotY(sample.pen);
    const width = Math.round(sample.w * 4) / 4;
    if (open) {
      ctx.lineTo(x, y);
    }
    if (!open || width !== run) {
      end();
      ctx.lineWidth = width;
      run = width;
      ctx.beginPath();
      ctx.moveTo(x, y);
      open = true;
    }
  }
  end();
}

/** Scale numbers sit on top of the ink, with a paper halo to stay legible. */
function drawScale(f: Frame, lo: number, hi: number) {
  const { ctx, c } = f;
  ctx.textBaseline = "bottom";
  ctx.textAlign = "left";
  ctx.lineWidth = 3;
  ctx.strokeStyle = c.paper;
  ctx.fillStyle = c.text;
  for (let r = 0; r < ROWS * 2; r += 2) {
    const y = Math.round(TOP + (r / (ROWS * 2)) * (f.bottom - TOP)) - 1.5;
    const label = formatAxis(hi - (r / (ROWS * 2)) * (hi - lo));
    ctx.strokeText(label, 6, y);
    ctx.fillText(label, 6, y);
  }
}

/** Hover: a hairline and a dot on the trace. */
function drawHover(f: Frame, samples: Sample[], p: number) {
  const { ctx, c } = f;
  const index = indexAt(samples, p);
  const sample = index >= 0 ? samples[index] : null;
  if (!sample || Number.isNaN(sample.pen)) {
    return;
  }
  const x = Math.round(f.toX(sample.p)) + 0.5;
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 1;
  vline(ctx, x, TOP, f.bottom);
  ctx.fillStyle = c.paper;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, f.plotY(sample.pen), 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** The pen: a rail on the right, an arm out to the nib. */
function drawPen(f: Frame, pen: number, lift: number) {
  const { ctx, c, w, h, penX } = f;
  const railX = w - 18;
  const y = f.plotY(pen);
  ctx.fillStyle = c.paper;
  ctx.fillRect(railX - 6, 0, w - railX + 6, h);
  ctx.strokeStyle = c.rail;
  ctx.lineWidth = 1;
  vline(ctx, railX + 0.5, TOP - 6, f.bottom + 6);
  // Lifted, the arm rises a touch and its shadow falls away from it.
  const raise = lift * 3;
  ctx.strokeStyle = c.ink;
  if (lift > 0.02) {
    ctx.globalAlpha = 0.12 * lift;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(railX, y + 2);
    ctx.lineTo(penX + 2, y + 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(railX, y - raise);
  ctx.lineTo(penX, y - raise);
  ctx.stroke();
  ctx.fillStyle = c.ink;
  ctx.beginPath();
  ctx.roundRect(railX - 5, y - raise - 7, 10, 14, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(penX, y - raise, 3, 0, Math.PI * 2);
  if (lift > 0.5) {
    ctx.fillStyle = c.paper;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.fill();
  }
}

export default function StripChart({
  title = "Requests",
  unit = "req/s",
  min = 0,
  max = 2000,
  value,
  className,
}: StripChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paletteRef = useRef<Palette | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const rangeRef = useRef({ min, max });
  rangeRef.current = { min, max };
  const [readout, setReadout] = useState<Readout | null>(null);
  const [mode, setMode] = useState<Mode>("live");
  const [grabbing, setGrabbing] = useState(false);

  const sim = useRef({
    width: 0,
    height: 0,
    dpr: 1,
    // Wall-clock time at paper position 0.
    start: 0,
    clock: 0,
    // Paper position under the pen at this moment (the live edge).
    feed: 0,
    // Paper position currently under the pen line on screen.
    view: 0,
    viewSpeed: 0,
    seekTo: 0,
    // Paper up to here has been written on.
    inked: 0,
    mode: "live" as Mode,
    pen: 0.4,
    penSpeed: 0,
    lifted: 0,
    latest: 0,
    samples: [] as Sample[],
    marks: [] as Mark[],
    source: null as
      | null
      | ((dt: number) => { value: number; mark: string | null }),
    hoverX: -1,
    drag: null as null | {
      id: number;
      x: number;
      view: number;
      moved: boolean;
      samples: { t: number; x: number }[];
    },
    raf: 0,
    last: 0,
    hiddenAt: 0,
    visible: false,
    reduceMotion: false,
    readoutAt: 0,
    readoutKey: "",
  });

  const norm = useCallback((v: number) => {
    const { min: lo, max: hi } = rangeRef.current;
    return clamp((v - lo) / (hi - lo || 1), 0, 1);
  }, []);

  const plotY = useCallback((u: number) => {
    const s = sim.current;
    return TOP + (1 - u) * (s.height - TOP - BOTTOM);
  }, []);

  const valueAt = useCallback((p: number) => {
    const s = sim.current;
    const i = indexAt(s.samples, p);
    if (i < 0) {
      return s.samples[0]?.v ?? s.latest;
    }
    return s.samples[i].v;
  }, []);

  const setModeBoth = useCallback((next: Mode) => {
    sim.current.mode = next;
    setMode(next);
  }, []);

  const stepPen = useCallback((target: number, dt: number) => {
    const s = sim.current;
    if (s.reduceMotion) {
      s.pen = target;
      s.penSpeed = 0;
      return;
    }
    for (let t = 0; t < dt - 1e-9; t += STEP) {
      const h = Math.min(STEP, dt - t);
      s.penSpeed +=
        ((target - s.pen) * PEN_STIFFNESS - s.penSpeed * PEN_DAMPING) * h;
      s.pen += s.penSpeed * h;
    }
  }, []);

  const inkWidth = useCallback(() => {
    const s = sim.current;
    if (s.reduceMotion) {
      return 1.6;
    }
    // Ink thins where the pen moves fast, like a real nib.
    const speed = Math.abs(s.penSpeed) * (s.height - TOP - BOTTOM);
    return clamp(2 - speed / 520, 0.8, 2);
  }, []);

  /** Takes the next reading and lays it on the paper as it feeds. */
  const record = useCallback((dt: number) => {
    const s = sim.current;
    s.clock += dt;
    let reading = valueRef.current;
    if (reading === undefined) {
      const { min: lo, max: hi } = rangeRef.current;
      s.source ??= createSource(lo, hi);
      const next = s.source(dt);
      reading = next.value;
      if (next.mark) {
        s.marks.push({ p: s.clock * FEED, label: next.mark });
      }
    }
    s.latest = reading;
    // Reduced motion: the paper steps once a second instead of gliding.
    s.feed = s.reduceMotion ? Math.floor(s.clock) * FEED : s.clock * FEED;
    const last = s.samples.at(-1);
    for (let p = last ? last.p + 1 : s.feed; p <= s.feed; p += 1) {
      s.samples.push({ p, v: reading, pen: Number.NaN, w: 1.6 });
    }
    if (s.samples.length > HISTORY + 600) {
      s.samples.splice(0, 600);
      const first = s.samples[0].p;
      s.marks = s.marks.filter((m) => m.p >= first);
    }
  }, []);

  /** Moves the paper under the pen: held, coasting, seeking or reeling. */
  const moveView = useCallback(
    (dt: number) => {
      const s = sim.current;
      if (s.mode === "live") {
        s.view = s.feed;
        return;
      }
      let next: Mode | null = null;
      if (s.mode === "coast") {
        next = coast(s, dt, s.samples[0]?.p ?? 0);
      } else if (s.mode === "seek" || s.mode === "reel") {
        next = reel(s, dt);
      }
      if (next) {
        setModeBoth(next);
      }
    },
    [setModeBoth]
  );

  /** Writes the paper passing under the pen, or lets the pen ride lifted. */
  const ink = useCallback(
    (dt: number) => {
      const s = sim.current;
      const writing =
        (s.mode === "live" || s.mode === "reel") && s.view >= s.inked - 0.5;
      // The pen lifts off the paper while you hold or look back.
      s.lifted = s.reduceMotion
        ? Number(!writing)
        : s.lifted + (Number(!writing) - s.lifted) * Math.min(1, dt * 18);
      if (!(writing && s.view > s.inked)) {
        // Lifted, the pen rides over whatever is under it, as a reader.
        stepPen(norm(s.mode === "live" ? s.latest : valueAt(s.view)), dt);
        return;
      }
      // Live, the pen chases the latest value; reeling back, it replays the
      // stretch you missed, chasing each value as it would have live.
      const live = s.mode === "live";
      if (live) {
        stepPen(norm(s.latest), dt);
      }
      let i = indexAt(s.samples, s.inked) + 1;
      while (i < s.samples.length && s.samples[i].p <= s.view) {
        const sample = s.samples[i];
        if (!live) {
          stepPen(norm(sample.v), 1 / FEED);
        }
        sample.pen = s.pen;
        sample.w = inkWidth();
        i++;
      }
      s.inked = s.view;
    },
    [inkWidth, norm, stepPen, valueAt]
  );

  /** Advances the feed, the data and the pen by dt seconds. */
  const advance = useCallback(
    (dt: number) => {
      record(dt);
      moveView(dt);
      ink(dt);
    },
    [ink, moveView, record]
  );

  const draw = useCallback(() => {
    const s = sim.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!(canvas && ctx && s.width)) {
      return;
    }
    paletteRef.current ??= readPalette(canvas);
    const penX = s.width - PEN_INSET;
    const f: Frame = {
      ctx,
      c: paletteRef.current,
      w: s.width,
      h: s.height,
      penX,
      bottom: s.height - BOTTOM,
      leftP: s.view - penX,
      rightP: s.view + PEN_INSET,
      toX: (p) => penX - (s.view - p),
      plotY,
    };
    const { min: lo, max: hi } = rangeRef.current;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, f.w, f.h);
    ctx.fillStyle = f.c.paper;
    ctx.fillRect(0, 0, f.w, f.h);
    drawGrid(f, s.start);
    drawMarks(f, s.marks, s.inked);
    drawTrace(f, s.samples);
    drawScale(f, lo, hi);
    if (s.hoverX >= 0 && s.hoverX <= penX && !s.drag) {
      drawHover(f, s.samples, s.view - (penX - s.hoverX));
    }
    drawPen(f, s.pen, s.lifted);
  }, [plotY]);

  const publish = useCallback(
    (now: number, force = false) => {
      const s = sim.current;
      const penX = s.width - PEN_INSET;
      let next: Readout;
      if (s.hoverX >= 0 && s.hoverX <= penX && !s.drag) {
        const p = s.view - (penX - s.hoverX);
        next = {
          value: valueAt(p),
          time: s.start + (p / FEED) * 1000,
          mode: "hover",
        };
      } else if (s.mode === "live") {
        next = {
          value: s.latest,
          time: s.start + s.clock * 1000,
          mode: "live",
        };
      } else {
        next = {
          value: valueAt(s.view),
          time: s.start + (s.view / FEED) * 1000,
          mode: "past",
        };
      }
      // Live numbers update a few times a second, not every frame.
      const key = `${next.mode}:${Math.round(next.value)}:${Math.round(next.time / 1000)}`;
      if (
        force ||
        (key !== s.readoutKey &&
          (next.mode !== "live" || now - s.readoutAt > 140))
      ) {
        s.readoutKey = key;
        s.readoutAt = now;
        setReadout(next);
      }
    },
    [valueAt]
  );

  const tick = useCallback(
    (now: number) => {
      const s = sim.current;
      s.raf = 0;
      const dt = s.last ? Math.min((now - s.last) / 1000, MAX_FRAME) : 1 / 60;
      s.last = now;
      advance(dt);
      draw();
      publish(now);
      if (s.visible) {
        s.raf = requestAnimationFrame(tick);
      }
    },
    [advance, draw, publish]
  );

  useEffect(() => {
    const s = sim.current;
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    s.reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    // Start with some history already written.
    if (!s.samples.length) {
      s.start = Date.now() - PREFILL * 1000;
      const reduce = s.reduceMotion;
      s.reduceMotion = false;
      for (let t = 0; t < PREFILL; t += 1 / 60) {
        advance(1 / 60);
      }
      s.reduceMotion = reduce;
    }

    const resize = new ResizeObserver(([entry]) => {
      s.width = entry.contentRect.width;
      s.height = entry.contentRect.height;
      s.dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(s.width * s.dpr);
      canvas.height = Math.round(s.height * s.dpr);
      draw();
    });
    resize.observe(canvas);

    // Fill in the time it was away, so the clock on the paper stays true.
    const catchUp = () => {
      if (!s.hiddenAt) {
        return;
      }
      const gap = Math.min((Date.now() - s.hiddenAt) / 1000, MAX_CATCH_UP);
      for (let t = 0; t < gap; t += 1 / 30) {
        advance(1 / 30);
      }
      if (gap >= MAX_CATCH_UP) {
        s.start = Date.now() - s.clock * 1000;
      }
      s.hiddenAt = 0;
    };

    let onScreen = false;
    const update = () => {
      const visible = onScreen && !document.hidden;
      if (visible === s.visible) {
        return;
      }
      s.visible = visible;
      if (visible) {
        catchUp();
        s.last = 0;
        s.raf = requestAnimationFrame(tick);
      } else {
        s.hiddenAt = Date.now();
        cancelAnimationFrame(s.raf);
        s.raf = 0;
      }
    };
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    });
    intersection.observe(canvas);
    document.addEventListener("visibilitychange", update);

    const repaint = () => {
      paletteRef.current = null;
      draw();
    };
    const theme = new MutationObserver(repaint);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", repaint);

    return () => {
      resize.disconnect();
      intersection.disconnect();
      theme.disconnect();
      scheme.removeEventListener("change", repaint);
      document.removeEventListener("visibilitychange", update);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.visible = false;
    };
  }, [advance, draw, tick]);

  const goLive = useCallback(() => {
    const s = sim.current;
    if (s.mode === "live") {
      return;
    }
    s.drag = null;
    setGrabbing(false);
    setModeBoth("reel");
  }, [setModeBoth]);

  const seek = (by: number) => {
    const s = sim.current;
    const earliest = s.samples[0]?.p ?? 0;
    const from = s.mode === "seek" ? s.seekTo : s.view;
    s.seekTo = clamp(from + by, earliest, s.feed);
    if (s.mode === "live") {
      s.view = s.feed;
    }
    setModeBoth("seek");
  };

  const localX = (event: PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return rect ? event.clientX - rect.left : 0;
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const s = sim.current;
    if (s.drag || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    s.drag = {
      id: event.pointerId,
      x: event.clientX,
      view: s.view,
      moved: false,
      samples: [{ t: event.timeStamp, x: event.clientX }],
    };
    s.hoverX = -1;
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const s = sim.current;
    const drag = s.drag;
    if (!drag) {
      if (event.pointerType === "mouse") {
        s.hoverX = localX(event);
      }
      return;
    }
    if (drag.id !== event.pointerId) {
      return;
    }
    const dx = event.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < 4) {
        return;
      }
      // Grabbing the paper stops it under your hand.
      drag.moved = true;
      drag.view = s.view;
      drag.x = event.clientX;
      s.viewSpeed = 0;
      setModeBoth("held");
      setGrabbing(true);
      return;
    }
    const earliest = s.samples[0]?.p ?? 0;
    s.view = rubber(drag.view - dx, earliest, s.feed);
    drag.samples.push({ t: event.timeStamp, x: event.clientX });
    if (drag.samples.length > 5) {
      drag.samples.shift();
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const s = sim.current;
    const drag = s.drag;
    if (!drag || drag.id !== event.pointerId) {
      return;
    }
    s.drag = null;
    setGrabbing(false);
    if (!drag.moved) {
      return;
    }
    const first = drag.samples[0];
    const last = drag.samples.at(-1) ?? first;
    const span = Math.max((last.t - first.t) / 1000, 0.016);
    const recent = event.timeStamp - last.t < 80;
    // Dragging right pulls older paper under the pen.
    const speed = recent ? -(last.x - first.x) / span : 0;
    if (speed > FLICK_LIVE) {
      s.viewSpeed = speed;
      setModeBoth("reel");
      return;
    }
    s.viewSpeed = s.reduceMotion ? 0 : speed;
    setModeBoth("coast");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const step = event.shiftKey ? FEED * 10 : FEED * 2;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      seek(-step);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      seek(step);
    } else if (event.key === "Home") {
      event.preventDefault();
      seek(-Number.MAX_SAFE_INTEGER / 2);
    } else if (event.key === "End" || event.key === "Escape") {
      event.preventDefault();
      goLive();
    }
  };

  const live = mode === "live";
  const shown = readout ?? { value: 0, time: 0, mode: "live" };
  let caption = "Live";
  if (readout && shown.mode !== "live") {
    const ago = Math.max(
      0,
      Math.round(
        (sim.current.start + sim.current.clock * 1000 - shown.time) / 1000
      )
    );
    caption = `${formatClock(shown.time)} · ${ago}s ago`;
  }

  return (
    <div
      className={cn(
        "w-full max-w-2xl select-none rounded-3xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        "[--strip-accent:#10b981] [--strip-grid:#f4f4f5] [--strip-ink:#18181b] [--strip-major:#e4e4e7] [--strip-paper:#ffffff] [--strip-rail:#d4d4d8] [--strip-text:#a1a1aa]",
        "dark:[--strip-accent:#34d399] dark:[--strip-grid:#18181b] dark:[--strip-ink:#f4f4f5] dark:[--strip-major:#27272a] dark:[--strip-paper:#09090b] dark:[--strip-rail:#3f3f46] dark:[--strip-text:#71717a]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4 p-5 pb-3">
        <div className="min-w-0">
          <p className="font-medium text-sm">{title}</p>
          <p className="mt-1 flex items-baseline gap-1.5 tabular-nums">
            <span className="font-semibold text-2xl tracking-tight">
              {readout ? Math.round(shown.value).toLocaleString("en-US") : "—"}
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {unit}
            </span>
          </p>
          <p
            aria-live={shown.mode === "live" ? "off" : "polite"}
            className="mt-0.5 text-xs text-zinc-500 tabular-nums dark:text-zinc-400"
          >
            {caption}
          </p>
        </div>
        <button
          aria-hidden={live}
          className={cn(
            "shrink-0 rounded-full border border-zinc-200 px-3 py-1 font-medium text-xs outline-none transition-[opacity,background-color,color] duration-200 ease-out hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-800 dark:hover:bg-zinc-900",
            live ? "pointer-events-none opacity-0" : "opacity-100"
          )}
          onClick={goLive}
          tabIndex={live ? -1 : 0}
          type="button"
        >
          Back to live
        </button>
      </div>

      <canvas
        aria-label={`${title} chart recorder. Drag the paper sideways or use the arrow keys to look back; End returns to live.`}
        className={cn(
          "block h-60 w-full touch-pan-y rounded-b-3xl border-zinc-100 border-t outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset dark:border-zinc-900",
          grabbing ? "cursor-grabbing" : "cursor-grab"
        )}
        onDoubleClick={goLive}
        onKeyDown={handleKeyDown}
        onLostPointerCapture={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerLeave={() => {
          sim.current.hoverX = -1;
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={canvasRef}
        role="img"
        tabIndex={0}
      />
    </div>
  );
}
