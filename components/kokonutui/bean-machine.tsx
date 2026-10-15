"use client";

/**
 * @author: @dorianbaffier
 * @description: Bean Machine
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
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// Simulation, in px and seconds.
const GRAVITY = 2000;
// Each peg kicks the ball up a little before it falls to the next row.
const BOUNCE = 70;
const BOUNCE_JITTER = 0.35;
// Balls leave the hopper at this rate, per second.
const POUR_RATE = 48;
// The most balls on the board; past this, each ball stands for several
// samples.
const MAX_BALLS = 240;
const PEG_RADIUS = 2;
const HOPPER_Y = 14;
const BOARD_TOP = 44;
const AXIS = 30;
const SIDE = 16;
// A peg lights up when hit, and fades on this half-life.
const FLASH_HALF_LIFE = 0.09;
// Landed balls in the slow tail take the tail colour over this long.
const TINT_TIME = 0.24;

export interface BeanMachineSeries {
  label: string;
  /** Raw samples, in the unit of the chart. */
  samples: number[];
}

export interface BeanMachineProps {
  title?: string;
  unit?: string;
  /** One or more distributions; a switch appears for two or more. */
  series?: BeanMachineSeries[];
  /** Lower and upper edge of the bins. Values past the top land in the last bin. */
  domain?: [number, number];
  bins?: number;
  className?: string;
}

type Phase = "hop" | "fall" | "rest" | "drain";

interface Ball {
  bin: number;
  /** Left or right at each row, 1 for right. */
  path: number[];
  row: number;
  phase: Phase;
  x: number;
  y: number;
  // The current hop: start, horizontal speed, vertical speed, time.
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  t: number;
  duration: number;
  slotX: number;
  slotY: number;
  tint: number;
  delay: number;
}

interface Layout {
  width: number;
  height: number;
  cx: number;
  dx: number;
  dy: number;
  rows: number;
  radius: number;
  floor: number;
  binTop: number;
  left: number;
}

interface Palette {
  ball: string;
  tail: string;
  peg: string;
  pegHit: string;
  line: string;
  text: string;
  hover: string;
  font: string;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

// Seeded, so the demo data is the same on the server and in the browser.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16_807) % 2_147_483_647;
    return s / 2_147_483_647;
  };
}

function demoSamples(
  seed: number,
  count: number,
  parts: { share: number; median: number; spread: number }[]
) {
  const random = seeded(seed);
  const gauss = () =>
    Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    let pick = random();
    const part =
      parts.find((p) => {
        pick -= p.share;
        return pick <= 0;
      }) ?? parts[0];
    out.push(Math.round(part.median * Math.exp(gauss() * part.spread)));
  }
  return out;
}

const DEFAULT_SERIES: BeanMachineSeries[] = [
  {
    label: "v2.3",
    samples: demoSamples(11, 220, [{ share: 1, median: 190, spread: 0.42 }]),
  },
  {
    label: "v2.4",
    samples: demoSamples(29, 220, [
      { share: 0.8, median: 115, spread: 0.32 },
      { share: 0.2, median: 360, spread: 0.12 },
    ]),
  },
];

function percentile(sorted: number[], q: number) {
  if (!sorted.length) {
    return 0;
  }
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

function summarize(samples: number[], domain: [number, number], bins: number) {
  const [lo, hi] = domain;
  const width = (hi - lo) / bins;
  const counts = new Array<number>(bins).fill(0);
  for (const v of samples) {
    counts[clamp(Math.floor((v - lo) / width), 0, bins - 1)]++;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const scale = Math.max(1, Math.ceil(samples.length / MAX_BALLS));
  return {
    counts,
    balls: counts.map((n) => Math.round(n / scale)),
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    total: samples.length,
    width,
  };
}

function shuffle<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function readPalette(node: HTMLElement): Palette {
  const style = getComputedStyle(node);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    ball: read("--bean-ball", "#18181b"),
    tail: read("--bean-tail", "#f59e0b"),
    peg: read("--bean-peg", "#d4d4d8"),
    pegHit: read("--bean-peg-hit", "#18181b"),
    line: read("--bean-line", "#e4e4e7"),
    text: read("--bean-text", "#a1a1aa"),
    hover: read("--bean-hover", "#f4f4f5"),
    font: style.fontFamily,
  };
}

/** Lays the board out to fit the canvas and the tallest bin. */
function layout(
  width: number,
  height: number,
  bins: number,
  tallest: number
): Layout {
  const rows = bins - 1;
  const dx = Math.min(46, (width - SIDE * 2) / bins);
  const dy = Math.min(dx * 0.5, (height * 0.5 - BOARD_TOP) / rows);
  const binTop = BOARD_TOP + rows * dy + dy * 0.7;
  const floor = height - AXIS;
  // The biggest ball that still fits the tallest bin.
  let radius = 6;
  for (; radius > 1.6; radius -= 0.1) {
    const across = Math.floor((dx - 3) / (radius * 2));
    const perTwo = across * 2 - 1;
    const layers = Math.ceil((tallest * 2) / Math.max(1, perTwo));
    const stack = radius * 2 + (layers - 1) * radius * Math.sqrt(3);
    if (across >= 2 && stack <= floor - binTop - 6) {
      break;
    }
  }
  return {
    width,
    height,
    cx: width / 2,
    dx,
    dy,
    rows,
    radius,
    floor,
    binTop,
    left: width / 2 - (bins * dx) / 2,
  };
}

const pegX = (l: Layout, row: number, index: number) =>
  l.cx + (index - row / 2) * l.dx;
const pegY = (l: Layout, row: number) => BOARD_TOP + row * l.dy;

/** Where the nth ball in a bin comes to rest: hex packed, bottom up. */
function slot(l: Layout, bin: number, n: number) {
  const across = Math.max(2, Math.floor((l.dx - 3) / (l.radius * 2)));
  const pair = across * 2 - 1;
  const layerPair = Math.floor(n / pair);
  const within = n % pair;
  const odd = within >= across;
  const layer = layerPair * 2 + (odd ? 1 : 0);
  const column = odd ? within - across : within;
  const count = odd ? across - 1 : across;
  const span = (count - 1) * l.radius * 2;
  const center = l.left + (bin + 0.5) * l.dx;
  return {
    x: center - span / 2 + column * l.radius * 2,
    y: l.floor - l.radius - layer * l.radius * Math.sqrt(3),
  };
}

/** A projectile from one point to another, kicked up by `kick` first. */
function hop(
  ball: Ball,
  from: { x: number; y: number },
  to: { x: number; y: number },
  kick: number
) {
  const dy = to.y - from.y;
  const vy = -kick;
  const t =
    (-vy + Math.sqrt(vy * vy + 2 * GRAVITY * Math.max(dy, 0.5))) / GRAVITY;
  ball.x0 = from.x;
  ball.y0 = from.y;
  ball.vx = (to.x - from.x) / t;
  ball.vy = vy;
  ball.t = 0;
  ball.duration = t;
}

/** Moves one ball along; true while it's still going somewhere. */
function moveBall(
  ball: Ball,
  l: Layout,
  dt: number,
  tail: number,
  filled: number[],
  flashes: Map<string, number>
) {
  if (ball.phase === "rest") {
    if (ball.bin >= tail && ball.tint < 1) {
      ball.tint = Math.min(1, ball.tint + dt / TINT_TIME);
      return true;
    }
    return false;
  }
  if (ball.phase === "drain") {
    if (ball.delay > 0) {
      ball.delay -= dt;
    } else {
      ball.vy += GRAVITY * dt;
      ball.y += ball.vy * dt;
    }
    return true;
  }
  ball.t += dt;
  const t = Math.min(ball.t, ball.duration);
  ball.x = ball.x0 + ball.vx * t;
  ball.y = ball.y0 + ball.vy * t + 0.5 * GRAVITY * t * t;
  if (ball.t >= ball.duration) {
    arrive(ball, l, filled, flashes);
  }
  return true;
}

/** At the next peg, or in the bin: settle, or bounce on to the next row. */
function arrive(
  ball: Ball,
  l: Layout,
  filled: number[],
  flashes: Map<string, number>
) {
  if (ball.phase === "fall") {
    ball.phase = "rest";
    ball.x = ball.slotX;
    ball.y = ball.slotY;
    return;
  }
  ball.row += 1;
  const index = ball.path.slice(0, ball.row).reduce((sum, v) => sum + v, 0);
  if (ball.row < l.rows) {
    flashes.set(`${ball.row}:${index}`, 1);
  }
  const kick = BOUNCE * (1 + (Math.random() - 0.5) * 2 * BOUNCE_JITTER);
  if (ball.row < l.rows - 1) {
    const next = index + ball.path[ball.row];
    hop(
      ball,
      { x: ball.x, y: ball.y },
      {
        x: pegX(l, ball.row + 1, next),
        y: pegY(l, ball.row + 1) - PEG_RADIUS - l.radius,
      },
      kick
    );
    return;
  }
  // Off the last row and into the next free spot in its bin.
  const at = slot(l, ball.bin, filled[ball.bin]);
  filled[ball.bin] += 1;
  ball.phase = "fall";
  ball.slotX = at.x;
  ball.slotY = at.y;
  hop(ball, { x: ball.x, y: ball.y }, at, kick * 0.6);
}

function fadeFlashes(flashes: Map<string, number>, dt: number) {
  let busy = false;
  for (const [key, value] of flashes) {
    const next = value * 0.5 ** (dt / FLASH_HALF_LIFE);
    if (next < 0.02) {
      flashes.delete(key);
    } else {
      flashes.set(key, next);
      busy = true;
    }
  }
  return busy;
}

/** The hopper, the pegs (lit where balls just struck), and the bins. */
function drawBoard(
  ctx: CanvasRenderingContext2D,
  l: Layout,
  c: Palette,
  flashes: Map<string, number>,
  bins: number,
  hover: number
) {
  if (hover >= 0) {
    ctx.fillStyle = c.hover;
    ctx.fillRect(l.left + hover * l.dx, l.binTop, l.dx, l.floor - l.binTop);
  }
  ctx.strokeStyle = c.line;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(l.cx - 22, 2);
  ctx.lineTo(l.cx - 6, HOPPER_Y + 8);
  ctx.moveTo(l.cx + 22, 2);
  ctx.lineTo(l.cx + 6, HOPPER_Y + 8);
  ctx.stroke();

  for (let row = 0; row < l.rows; row++) {
    for (let i = 0; i <= row; i++) {
      const flash = flashes.get(`${row}:${i}`) ?? 0;
      const lit = flash > 0.5;
      ctx.fillStyle = lit ? c.pegHit : c.peg;
      ctx.globalAlpha = lit ? 0.35 + flash * 0.65 : 1;
      ctx.beginPath();
      ctx.arc(
        pegX(l, row, i),
        pegY(l, row),
        PEG_RADIUS + flash * 0.6,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = c.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let b = 0; b <= bins; b++) {
    const x = Math.round(l.left + b * l.dx) + 0.5;
    ctx.moveTo(x, l.binTop);
    ctx.lineTo(x, l.floor);
  }
  ctx.moveTo(l.left, l.floor + 0.5);
  ctx.lineTo(l.left + bins * l.dx, l.floor + 0.5);
  ctx.stroke();
}

/** Balls. Draining ones drop through the floor and out of sight. */
function drawBalls(
  ctx: CanvasRenderingContext2D,
  l: Layout,
  c: Palette,
  balls: Ball[]
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, l.width, l.floor);
  ctx.clip();
  for (const ball of balls) {
    ctx.fillStyle = c.ball;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, l.radius, 0, Math.PI * 2);
    ctx.fill();
    if (ball.tint > 0) {
      ctx.globalAlpha = ball.tint;
      ctx.fillStyle = c.tail;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

/** Bin edges under the floor, and p50 and p95 once the pour has landed. */
function drawAxis(
  ctx: CanvasRenderingContext2D,
  l: Layout,
  c: Palette,
  bins: number,
  domain: [number, number],
  st: { width: number; p50: number; p95: number },
  markers: number
) {
  ctx.fillStyle = c.text;
  ctx.font = `10px ${c.font}`;
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  // Every other edge when the bins are tight.
  const every = l.dx < 34 ? 2 : 1;
  for (let b = 0; b <= bins; b += every) {
    const value = domain[0] + b * st.width;
    ctx.fillText(
      b === bins ? `${value}+` : `${value}`,
      l.left + b * l.dx,
      l.floor + 6
    );
  }
  if (markers <= 0) {
    return;
  }
  ctx.globalAlpha = markers;
  ctx.textBaseline = "bottom";
  const span = domain[1] - domain[0];
  for (const [name, value, color] of [
    ["p50", st.p50, c.ball],
    ["p95", st.p95, c.tail],
  ] as const) {
    const x = l.left + clamp((value - domain[0]) / span, 0, 1) * bins * l.dx;
    ctx.strokeStyle = color;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, l.binTop - 4);
    ctx.lineTo(Math.round(x) + 0.5, l.floor);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.fillText(name, x, l.binTop - 6);
  }
  ctx.globalAlpha = 1;
}

export default function BeanMachine({
  title = "Response time",
  unit = "ms",
  series = DEFAULT_SERIES,
  domain = [0, 500],
  bins = 10,
  className,
}: BeanMachineProps) {
  const [lo, hi] = domain;
  const range = useMemo((): [number, number] => [lo, hi], [lo, hi]);
  const [active, setActive] = useState(series.length - 1);
  const [hovered, setHovered] = useState(-1);
  const current = series[Math.min(active, series.length - 1)];
  const stats = useMemo(
    () => summarize(current?.samples ?? [], range, bins),
    [current, range, bins]
  );
  const tallest = useMemo(() => {
    let most = 1;
    for (const s of series) {
      most = Math.max(most, ...summarize(s.samples, range, bins).balls);
    }
    return most;
  }, [series, range, bins]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paletteRef = useRef<Palette | null>(null);
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const hoveredRef = useRef(hovered);
  hoveredRef.current = hovered;
  const activeRef = useRef(active);
  activeRef.current = active;

  const sim = useRef({
    l: null as Layout | null,
    width: 0,
    height: 0,
    dpr: 1,
    balls: [] as Ball[],
    queue: [] as number[],
    filled: [] as number[],
    pourClock: 0,
    pourDelay: 0,
    flashes: new Map<string, number>(),
    markers: 0,
    raf: 0,
    last: 0,
    visible: false,
    reduceMotion: false,
    poured: -1,
  });

  const tailFrom = useCallback(() => {
    const st = statsRef.current;
    // Bins whose middle sits past p95 make up the slow tail.
    return clamp(Math.ceil((st.p95 - range[0]) / st.width - 0.5), 0, bins);
  }, [bins, range]);

  const launch = useCallback((bin: number) => {
    const s = sim.current;
    const l = s.l;
    if (!l) {
      return;
    }
    // Any order of lefts and rights with `bin` rights lands in that bin.
    const path = shuffle(
      Array.from({ length: l.rows }, (_, i) => (i < bin ? 1 : 0))
    );
    const ball: Ball = {
      bin,
      path,
      row: -1,
      phase: "hop",
      x: l.cx,
      y: HOPPER_Y,
      x0: 0,
      y0: 0,
      vx: 0,
      vy: 0,
      t: 0,
      duration: 0,
      slotX: 0,
      slotY: 0,
      tint: 0,
      delay: 0,
    };
    hop(
      ball,
      { x: l.cx + (Math.random() - 0.5) * 2, y: HOPPER_Y },
      { x: l.cx, y: pegY(l, 0) - PEG_RADIUS - l.radius },
      0
    );
    s.balls.push(ball);
  }, []);

  /** Lands every ball at once, for reduced motion and resizes. */
  const settleAll = useCallback(() => {
    const s = sim.current;
    const l = s.l;
    if (!l) {
      return;
    }
    const tail = tailFrom();
    const st = statsRef.current;
    s.queue = [];
    s.filled = new Array<number>(bins).fill(0);
    s.balls = [];
    st.balls.forEach((count, bin) => {
      for (let n = 0; n < count; n++) {
        const at = slot(l, bin, n);
        s.balls.push({
          bin,
          path: [],
          row: l.rows,
          phase: "rest",
          x: at.x,
          y: at.y,
          x0: 0,
          y0: 0,
          vx: 0,
          vy: 0,
          t: 0,
          duration: 0,
          slotX: at.x,
          slotY: at.y,
          tint: bin >= tail ? 1 : 0,
          delay: 0,
        });
      }
      s.filled[bin] = count;
    });
    s.markers = 1;
  }, [bins, tailFrom]);

  /** Lets balls out of the hopper; true while there are more to come. */
  const pourStep = useCallback(
    (dt: number) => {
      const s = sim.current;
      if (s.pourDelay > 0) {
        s.pourDelay -= dt;
        return true;
      }
      if (!s.queue.length) {
        return false;
      }
      s.pourClock += dt * POUR_RATE;
      while (s.pourClock >= 1 && s.queue.length) {
        s.pourClock -= 1;
        launch(s.queue.pop() as number);
      }
      return true;
    },
    [launch]
  );

  const step = useCallback(
    (dt: number) => {
      const s = sim.current;
      const l = s.l;
      if (!l) {
        return false;
      }
      let busy = pourStep(dt);
      const tail = tailFrom();
      for (const ball of s.balls) {
        busy = moveBall(ball, l, dt, tail, s.filled, s.flashes) || busy;
      }
      s.balls = s.balls.filter(
        (b) => b.phase !== "drain" || b.y < l.floor + l.radius
      );
      busy = fadeFlashes(s.flashes, dt) || busy;
      // Percentile markers fade in once the pour is done.
      const pouring =
        s.queue.length > 0 ||
        s.balls.some((b) => b.phase === "hop" || b.phase === "fall");
      const target = pouring ? 0 : 1;
      if (s.markers !== target) {
        s.markers = clamp(s.markers + (target ? dt : -dt) / 0.2, 0, 1);
        busy = true;
      }
      return busy;
    },
    [pourStep, tailFrom]
  );

  const draw = useCallback(() => {
    const s = sim.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const l = s.l;
    if (!(canvas && ctx && l)) {
      return;
    }
    paletteRef.current ??= readPalette(canvas);
    const c = paletteRef.current;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, l.width, l.height);
    drawBoard(ctx, l, c, s.flashes, bins, hoveredRef.current);
    drawBalls(ctx, l, c, s.balls);
    drawAxis(ctx, l, c, bins, range, statsRef.current, s.markers);
  }, [bins, range]);

  const tick = useCallback(
    (now: number) => {
      const s = sim.current;
      s.raf = 0;
      const dt = s.last ? Math.min((now - s.last) / 1000, 1 / 30) : 1 / 60;
      s.last = now;
      const busy = step(dt);
      draw();
      if (busy && s.visible) {
        s.raf = requestAnimationFrame(tick);
      } else {
        s.last = 0;
      }
    },
    [draw, step]
  );

  const wake = useCallback(() => {
    const s = sim.current;
    if (!s.raf && s.visible) {
      s.raf = requestAnimationFrame(tick);
    }
  }, [tick]);

  /** Drains whatever is on the board and pours the current series. */
  const pour = useCallback(
    (drain: boolean) => {
      const s = sim.current;
      const l = s.l;
      if (!l) {
        return;
      }
      const st = statsRef.current;
      if (s.reduceMotion) {
        settleAll();
        draw();
        return;
      }
      if (drain && s.balls.length) {
        // The floor gives way: the bottom of each stack goes first.
        for (const ball of s.balls) {
          ball.delay =
            ball.phase === "rest"
              ? ((l.floor - ball.y) / (l.floor - l.binTop)) * 0.18 +
                Math.random() * 0.04
              : 0;
          ball.vy = ball.phase === "rest" ? 0 : Math.max(ball.vy, 0);
          ball.phase = "drain";
        }
        s.pourDelay = 0.32;
      }
      s.filled = new Array<number>(bins).fill(0);
      s.queue = shuffle(
        st.balls.flatMap((count, bin) => new Array<number>(count).fill(bin))
      );
      s.pourClock = 1;
      wake();
    },
    [bins, draw, settleAll, wake]
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
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width === s.width && height === s.height) {
        return;
      }
      s.width = width;
      s.height = height;
      s.dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * s.dpr);
      canvas.height = Math.round(height * s.dpr);
      const fresh = !s.l;
      s.l = layout(width, height, bins, tallest);
      if (!fresh && s.poured >= 0) {
        // A new size moves every slot, so land everything where it belongs.
        settleAll();
      }
      draw();
    });
    resize.observe(canvas);

    let onScreen = false;
    const update = () => {
      s.visible = onScreen && !document.hidden;
      if (s.visible) {
        if (s.poured < 0 && s.l) {
          // Pour the first time it scrolls into view.
          s.poured = activeRef.current;
          pour(false);
        }
        wake();
      } else if (s.raf) {
        cancelAnimationFrame(s.raf);
        s.raf = 0;
        s.last = 0;
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
    };
  }, [bins, draw, pour, settleAll, tallest, wake]);

  // Switching series drains the board and pours the new one.
  const choose = (index: number) => {
    if (index === active) {
      return;
    }
    setActive(index);
  };
  useEffect(() => {
    const s = sim.current;
    if (s.poured < 0 || !s.l) {
      return;
    }
    if (s.poured !== active) {
      s.poured = active;
      pour(true);
    }
  }, [active, pour]);

  const binAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const l = sim.current.l;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!(l && rect)) {
      return -1;
    }
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (y < l.binTop - 12) {
      return -1;
    }
    const bin = Math.floor((x - l.left) / l.dx);
    return bin >= 0 && bin < bins ? bin : -1;
  };

  const showBin = (bin: number) => {
    setHovered(bin);
    hoveredRef.current = bin;
    draw();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const from = hovered < 0 ? Math.floor(bins / 2) : hovered;
      const move = event.key === "ArrowLeft" ? -1 : 1;
      showBin(clamp(hovered < 0 ? from : from + move, 0, bins - 1));
    } else if (event.key === "Escape") {
      showBin(-1);
    }
  };

  const fmt = (v: number) => Math.round(v).toLocaleString("en-US");
  let readout = `p50 ${fmt(stats.p50)} ${unit} · p95 ${fmt(stats.p95)} ${unit} · ${fmt(stats.total)} requests`;
  if (hovered >= 0) {
    const from = range[0] + hovered * stats.width;
    const count = stats.counts[hovered];
    const span =
      hovered === bins - 1
        ? `${fmt(from)}+ ${unit}`
        : `${fmt(from)}–${fmt(from + stats.width)} ${unit}`;
    readout = `${span} · ${fmt(count)} ${count === 1 ? "request" : "requests"} (${Math.round((count / Math.max(1, stats.total)) * 100)}%)`;
  }

  return (
    <div
      className={cn(
        "w-full max-w-md select-none rounded-3xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        "[--bean-ball:#27272a] [--bean-hover:#f4f4f5] [--bean-line:#e4e4e7] [--bean-peg-hit:#18181b] [--bean-peg:#d4d4d8] [--bean-tail:#f59e0b] [--bean-text:#a1a1aa]",
        "dark:[--bean-ball:#e4e4e7] dark:[--bean-hover:#18181b] dark:[--bean-line:#27272a] dark:[--bean-peg-hit:#fafafa] dark:[--bean-peg:#3f3f46] dark:[--bean-tail:#fbbf24] dark:[--bean-text:#71717a]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4 p-5 pb-0">
        <div className="min-w-0">
          <p className="font-medium text-sm">{title}</p>
          <p
            aria-live="polite"
            className="mt-0.5 truncate text-sm text-zinc-500 tabular-nums dark:text-zinc-400"
          >
            {readout}
          </p>
        </div>
        {series.length > 1 && (
          <div className="flex shrink-0 rounded-full bg-zinc-100 p-0.5 text-xs dark:bg-zinc-900">
            {series.map((s, index) => (
              <button
                aria-pressed={index === active}
                className={cn(
                  "rounded-full px-3 py-1 font-medium outline-none transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-zinc-400",
                  index === active
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                )}
                key={s.label}
                onClick={() => choose(index)}
                type="button"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <canvas
        aria-label={`${title} histogram for ${current?.label ?? ""}: ${readout}. Use the arrow keys to read each bin.`}
        className="block h-[23rem] w-full rounded-b-3xl outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
        onBlur={() => showBin(-1)}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => showBin(binAt(event))}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") {
            showBin(-1);
          }
        }}
        onPointerMove={(event) => {
          if (event.pointerType === "mouse") {
            const bin = binAt(event);
            if (bin !== hoveredRef.current) {
              showBin(bin);
            }
          }
        }}
        ref={canvasRef}
        role="img"
        tabIndex={0}
      />
    </div>
  );
}
