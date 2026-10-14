"use client";

/**
 * @author: @dorianbaffier
 * @description: Now Playing - music card with a spinning, scrubbable disc
 * @version: 2.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { cva, type VariantProps } from "class-variance-authority";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Glass primitives, kept for existing installs; the glass is now opt-in.    */
/* -------------------------------------------------------------------------- */

const GLASS_SHADOW_LIGHT =
  "shadow-[0_0_6px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_3px_3px_0.5px_-3px_rgba(0,0,0,0.9),inset_-3px_-3px_0.5px_-3px_rgba(0,0,0,0.85),inset_1px_1px_1px_-0.5px_rgba(0,0,0,0.6),inset_-1px_-1px_1px_-0.5px_rgba(0,0,0,0.6),inset_0_0_6px_6px_rgba(0,0,0,0.12),inset_0_0_2px_2px_rgba(0,0,0,0.06),0_0_12px_rgba(255,255,255,0.15)]";

const GLASS_SHADOW_DARK =
  "dark:shadow-[0_0_8px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_3px_3px_0.5px_-3.5px_rgba(255,255,255,0.09),inset_-3px_-3px_0.5px_-3.5px_rgba(255,255,255,0.85),inset_1px_1px_1px_-0.5px_rgba(255,255,255,0.6),inset_-1px_-1px_1px_-0.5px_rgba(255,255,255,0.6),inset_0_0_6px_6px_rgba(255,255,255,0.12),inset_0_0_2px_2px_rgba(255,255,255,0.06),0_0_12px_rgba(0,0,0,0.15)]";

const GLASS_SHADOW = `${GLASS_SHADOW_LIGHT} ${GLASS_SHADOW_DARK}`;

const DEFAULT_GLASS_FILTER_SCALE = 30;
const BUTTON_GLASS_FILTER_SCALE = 70;

interface GlassFilterProps {
  id: string;
  scale?: number;
}

const GlassFilter = React.memo(
  ({ id, scale = DEFAULT_GLASS_FILTER_SCALE }: GlassFilterProps) => (
    <svg aria-hidden="true" className="hidden" focusable={false}>
      <defs>
        <filter
          colorInterpolationFilters="sRGB"
          height="200%"
          id={id}
          width="200%"
          x="-50%"
          y="-50%"
        >
          <feTurbulence
            baseFrequency="0.05 0.05"
            numOctaves="1"
            result="turbulence"
            seed="1"
            type="fractalNoise"
          />
          <feGaussianBlur
            in="turbulence"
            result="blurredNoise"
            stdDeviation="2"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurredNoise"
            result="displaced"
            scale={scale}
            xChannelSelector="R"
            yChannelSelector="B"
          />
          <feGaussianBlur in="displaced" stdDeviation="4" />
        </filter>
      </defs>
    </svg>
  )
);
GlassFilter.displayName = "GlassFilter";

// Press feedback is colour only: no hover or press scale.
const liquidButtonVariants = cva(
  "relative transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
  {
    variants: {
      liquidVariant: {
        default: "",
        none: "",
      },
    },
    defaultVariants: {
      liquidVariant: "default",
    },
  }
);

// No `asChild`: the glass layers are extra children, which Slot rejects.
export type LiquidButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "asChild"
> &
  VariantProps<typeof liquidButtonVariants> & {
    /** Adds the inset glass shadow and SVG refraction (Chromium only). */
    glassEffect?: boolean;
  };

function LiquidButton({
  className,
  liquidVariant = "default",
  glassEffect = false,
  children,
  ...props
}: LiquidButtonProps) {
  const filterId = React.useId();

  return (
    <>
      <Button
        className={cn(liquidButtonVariants({ liquidVariant }), className)}
        {...props}
      >
        {glassEffect && (
          <>
            <span
              className={cn(
                "pointer-events-none absolute inset-0 rounded-[inherit]",
                GLASS_SHADOW
              )}
            />
            {/* backdrop-filter: url() only renders in Chromium. */}
            <span
              className="pointer-events-none absolute inset-0 isolate -z-10 overflow-hidden rounded-[inherit]"
              style={{ backdropFilter: `url("#${filterId}")` }}
            />
          </>
        )}
        <span className="relative z-10 inline-flex items-center justify-center">
          {children}
        </span>
      </Button>
      {glassEffect && (
        <GlassFilter id={filterId} scale={BUTTON_GLASS_FILTER_SCALE} />
      )}
    </>
  );
}

const liquidGlassCardVariants = cva("relative overflow-hidden", {
  variants: {
    glassSize: {
      sm: "p-4",
      default: "p-6",
      lg: "p-8",
    },
  },
  defaultVariants: {
    glassSize: "default",
  },
});

export type LiquidGlassCardProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof liquidGlassCardVariants> & {
    /** Adds the inset glass shadow and SVG refraction (Chromium only). */
    glassEffect?: boolean;
  };

function LiquidGlassCard({
  className,
  glassSize,
  glassEffect = false,
  children,
  ...props
}: LiquidGlassCardProps) {
  const filterId = React.useId();

  return (
    <Card
      className={cn(
        liquidGlassCardVariants({ glassSize }),
        glassEffect && "bg-white/40 backdrop-blur-[2px] dark:bg-zinc-950/40",
        className
      )}
      {...props}
    >
      {glassEffect && (
        <>
          <div
            className={cn(
              "pointer-events-none absolute inset-0 rounded-[inherit]",
              GLASS_SHADOW
            )}
          />
          {/* backdrop-filter: url() only renders in Chromium. */}
          <div
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
            style={{ backdropFilter: `url("#${filterId}")` }}
          />
          <GlassFilter id={filterId} scale={DEFAULT_GLASS_FILTER_SCALE} />
        </>
      )}
      <div className="relative z-10">{children}</div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Now Playing                                                               */
/* -------------------------------------------------------------------------- */

export interface NowPlayingTrack {
  title: string;
  artist: string;
  /** Length in seconds. */
  duration: number;
  /** Which built-in label design is printed on the disc (0, 1 or 2). */
  artwork?: number;
}

const DEFAULT_TRACKS: NowPlayingTrack[] = [
  { title: "Low Tide", artist: "Pale Harbor", duration: 192, artwork: 0 },
  { title: "Static Bloom", artist: "Juniper Wire", duration: 167, artwork: 1 },
  {
    title: "Night Signal",
    artist: "The Quiet Hours",
    duration: 245,
    artwork: 2,
  },
];

// 33⅓ rpm is 200°/s, one turn every 1.8s.
const CRUISE = 200;
const CRUISE_MS = 1800;
// Fastest a flick may spin the disc (6 turns/s).
const MAX_OMEGA = 2160;
// Time constants (s) for the speed relaxing toward its target: back to
// cruise after a flick, up to speed on play, down to a stop on pause.
const COAST_TAU = 0.45;
const SPIN_UP_TAU = 0.22;
const SPIN_DOWN_TAU = 0.2;
const SETTLE_EPSILON = 2;
// Pointer movement this close to the centre gives wild angle jumps.
const DEAD_ZONE = 10;
const VELOCITY_WINDOW_MS = 80;
// A release this long after the last move is a release from rest.
const STALE_MOVE_MS = 60;
// A finger resting on the disc reads as zero speed within ~50ms.
const HOLD_SETTLE_S = 0.05;
// Level bars: resting height, the fall to rest on pause, and the attack.
const BAR_COUNT = 5;
const BAR_REST = 0.14;
const BAR_DECAY_S = 0.3;
const BAR_ATTACK_S = 0.08;
// Scrubber: how far (px) the rail may stretch past either end.
const RUBBER_MAX = 18;
const SEEK_STEP = 5;
const RESTART_THRESHOLD = 3;
const MAX_DT = 0.05;
const ROLL_MS = 220;
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const RUBBER_RETURN = "transform 450ms cubic-bezier(0.34, 1.4, 0.64, 1)";

// Shipped with the component so it needs nothing in globals.css.
const ROLL_KEYFRAMES = `@keyframes now-playing-in-up{from{transform:translateY(90%);opacity:0}to{transform:none;opacity:1}}
@keyframes now-playing-out-up{from{transform:none;opacity:1}to{transform:translateY(-90%);opacity:0}}
@keyframes now-playing-in-down{from{transform:translateY(-90%);opacity:0}to{transform:none;opacity:1}}
@keyframes now-playing-out-down{from{transform:none;opacity:1}to{transform:translateY(90%);opacity:0}}
@media (prefers-reduced-motion:reduce){.now-playing-roll{animation:none!important}.now-playing-roll-prev{display:none}}`;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function damp(distance: number, max: number) {
  return max * (1 - Math.exp(-distance / max));
}

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

// Deterministic 1D value noise. The meter is a function of track time, so
// scrubbing back over a passage replays the same levels.
function hash(n: number) {
  const s = Math.sin(n * 127.1) * 43_758.5453;
  return s - Math.floor(s);
}

function noise(x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

function barLevel(index: number, t: number) {
  return (
    0.6 * noise(t * 4.3 + index * 17.3) +
    0.4 * noise(t * 9.1 + index * 31.7 + 100)
  );
}

// Up to cruise speed the disc maps 1:1 to the track like a real record;
// faster spins accelerate, so a hard flick can cross most of a song.
function scrubGain(speed: number) {
  const excess = Math.max(0, Math.abs(speed) - CRUISE) / CRUISE;
  return 1 + 1.5 * excess ** 1.5;
}

/** Seconds of track per second, at a disc speed in deg/s. */
function trackRate(omega: number) {
  return (omega / CRUISE) * scrubGain(omega);
}

function rotate(angle: number) {
  return `rotate(${Math.round((angle % 360) * 100) / 100}deg)`;
}

interface Engine {
  angle: number;
  omega: number;
  time: number;
  duration: number;
  playing: boolean;
  held: boolean;
  barDrag: boolean;
  /** The one pointer driving the disc or the bar; others are ignored. */
  pointerId: number | null;
  visible: boolean;
  reduced: boolean;
  /** Meter envelope, 0 (rest) to 1 (full). */
  env: number;
  /** Disc speed measured from the pointer while held (deg/s). */
  scrubOmega: number;
  pointerAngle: number;
  center: { x: number; y: number };
  lastMoveAt: number;
  samples: { t: number; a: number }[];
  cruise: Animation | null;
  cruiseAngle: number;
}

function createEngine(duration: number, playing: boolean): Engine {
  return {
    angle: 0,
    omega: playing ? CRUISE : 0,
    time: 0,
    duration,
    playing,
    held: false,
    barDrag: false,
    pointerId: null,
    visible: true,
    reduced: false,
    env: 0,
    scrubOmega: 0,
    pointerAngle: 0,
    center: { x: 0, y: 0 },
    lastMoveAt: 0,
    samples: [],
    cruise: null,
    cruiseAngle: 0,
  };
}

function readAngle(e: Engine) {
  if (e.cruise && e.cruise.currentTime !== null) {
    return e.cruiseAngle + (Number(e.cruise.currentTime) / CRUISE_MS) * 360;
  }
  return e.angle;
}

function stopCruise(e: Engine, disc: HTMLElement | null) {
  if (!e.cruise) {
    return;
  }
  e.angle = readAngle(e);
  // Pin the angle inline before cancelling so the disc doesn't flash back.
  if (disc) {
    disc.style.transform = rotate(e.angle);
  }
  e.cruise.cancel();
  e.cruise = null;
}

// Steady 33⅓ runs as a WAAPI animation on the compositor, so the disc keeps
// turning smoothly even when the main thread is busy.
function startCruise(e: Engine, disc: HTMLElement | null) {
  if (e.cruise || e.reduced || !disc || typeof disc.animate !== "function") {
    return;
  }
  e.angle %= 360;
  e.cruiseAngle = e.angle;
  e.cruise = disc.animate(
    [
      { transform: `rotate(${e.angle}deg)` },
      { transform: `rotate(${e.angle + 360}deg)` },
    ],
    { duration: CRUISE_MS, iterations: Number.POSITIVE_INFINITY }
  );
  if (!e.visible) {
    e.cruise.pause();
  }
}

// Free disc: the speed relaxes toward cruise (playing) or zero (paused) and
// the track follows however far the disc turned.
function integrateDisc(e: Engine, dt: number, disc: HTMLElement | null) {
  const target = e.playing ? CRUISE : 0;
  if (e.reduced) {
    e.omega = target;
    e.time += e.playing ? dt : 0;
    return;
  }
  if (e.cruise) {
    e.omega = CRUISE;
    e.time += dt;
    return;
  }
  let tau = SPIN_UP_TAU;
  if (Math.abs(e.omega) > Math.abs(target)) {
    tau = e.playing ? COAST_TAU : SPIN_DOWN_TAU;
  }
  e.omega = target + (e.omega - target) * Math.exp(-dt / tau);
  if (Math.abs(e.omega - target) < SETTLE_EPSILON) {
    e.omega = target;
  }
  e.angle += e.omega * dt;
  e.time += trackRate(e.omega) * dt;
  if (e.playing && e.omega === CRUISE) {
    startCruise(e, disc);
  }
}

function meterTarget(e: Engine) {
  if (e.held) {
    return clamp(Math.abs(e.scrubOmega) / CRUISE, 0, 1);
  }
  return clamp(Math.abs(e.omega) / CRUISE, 0, 1);
}

function updateMeter(e: Engine, dt: number, bars: (HTMLElement | null)[]) {
  const target = meterTarget(e);
  if (e.reduced) {
    e.env = e.playing ? 1 : 0;
  } else if (target > e.env) {
    e.env = Math.min(target, e.env + dt / BAR_ATTACK_S);
  } else {
    // A linear fall: a full meter takes 300ms to come to rest.
    e.env = Math.max(target, e.env - dt / BAR_DECAY_S);
  }
  // Reduced motion shows one still frame of the meter.
  const t = e.reduced ? 0.37 : e.time;
  for (const [i, bar] of bars.entries()) {
    if (bar) {
      const level = BAR_REST + (1 - BAR_REST) * barLevel(i, t) * e.env;
      bar.style.transform = `scaleY(${level.toFixed(3)})`;
    }
  }
}

function rpmLabel(e: Engine) {
  if (e.held) {
    return `${Math.round(e.scrubOmega / 6)} rpm`;
  }
  if (e.omega === CRUISE) {
    return "33⅓ rpm";
  }
  return `${Math.round(e.omega / 6)} rpm`;
}

function paint(
  e: Engine,
  disc: HTMLElement | null,
  fill: HTMLElement | null,
  rpm: HTMLElement | null
) {
  if (disc && !e.cruise) {
    disc.style.transform = rotate(e.angle);
  }
  if (fill) {
    const p = e.duration > 0 ? clamp(e.time / e.duration, 0, 1) : 0;
    fill.style.transform = `scaleX(${p.toFixed(4)})`;
  }
  const label = rpmLabel(e);
  if (rpm && rpm.textContent !== label) {
    rpm.textContent = label;
  }
}

/* ------------------------------ Rolling time ------------------------------ */

interface RollDigitProps {
  value: string;
  direction: 1 | -1;
}

function RollDigit({ value, direction }: RollDigitProps) {
  const [state, setState] = React.useState<{
    current: string;
    previous: string | null;
    count: number;
    direction: 1 | -1;
  }>({ current: value, previous: null, count: 0, direction });

  // Derived during render: the old digit rolls out as the new one rolls in.
  if (state.current !== value) {
    setState({
      current: value,
      previous: state.current,
      count: state.count + 1,
      direction,
    });
  }

  const up = state.direction > 0;
  const timing = `${ROLL_MS}ms ${EASE_OUT} both`;

  return (
    <span className="relative inline-block h-[1lh] overflow-hidden">
      {state.previous !== null && (
        <span
          className="now-playing-roll now-playing-roll-prev absolute inset-0"
          key={`p${state.count}`}
          style={{
            animation: `${up ? "now-playing-out-up" : "now-playing-out-down"} ${timing}`,
          }}
        >
          {state.previous}
        </span>
      )}
      <span
        className="now-playing-roll block"
        key={`c${state.count}`}
        style={
          state.count > 0
            ? {
                animation: `${up ? "now-playing-in-up" : "now-playing-in-down"} ${timing}`,
              }
            : undefined
        }
      >
        {state.current}
      </span>
    </span>
  );
}

interface RollingTimeProps {
  seconds: number;
  direction: 1 | -1;
}

function RollingTime({ seconds, direction }: RollingTimeProps) {
  // Slots are counted from the right so the seconds keep their identity
  // when the minutes gain a digit.
  const chars = formatTime(seconds).split("").reverse();
  return (
    <span aria-hidden="true" className="inline-flex flex-row-reverse">
      {chars.map((char, slot) =>
        char === ":" ? (
          <span key="colon">:</span>
        ) : (
          <RollDigit
            direction={direction}
            // biome-ignore lint/suspicious/noArrayIndexKey: digit slots are positional
            key={`slot-${slot}`}
            value={char}
          />
        )
      )}
    </span>
  );
}

/* --------------------------------- Artwork -------------------------------- */

const INK = "fill-zinc-900";
const ACCENT = "fill-(--now-playing-accent)";

const DOT_GRID = Array.from({ length: 25 }, (_, i) => ({
  x: 26 + (i % 5) * 12,
  y: 26 + Math.floor(i / 5) * 12,
  lit: i === 8,
}));

// Printed labels: flat zinc plus the accent, deliberately lopsided so the
// rotation reads at a glance.
function LabelArt({ variant }: { variant: number }) {
  if (variant === 1) {
    return (
      <g>
        <path className={ACCENT} d="M50 50 L50 8 A42 42 0 0 1 92 50 Z" />
        <path className={INK} d="M50 50 L8 50 A42 42 0 0 1 50 8 Z" />
        <rect className={INK} height="6" rx="1" width="30" x="50" y="62" />
        <rect className={INK} height="6" rx="1" width="20" x="50" y="72" />
      </g>
    );
  }
  if (variant === 2) {
    return (
      <g>
        {DOT_GRID.map((dot) => (
          <circle
            className={dot.lit ? ACCENT : INK}
            cx={dot.x}
            cy={dot.y}
            key={`${dot.x}-${dot.y}`}
            r={dot.lit ? 5.5 : 2.6}
          />
        ))}
      </g>
    );
  }
  return (
    <g>
      <circle className={ACCENT} cx="64" cy="36" r="20" />
      <rect className={INK} height="5" width="64" x="18" y="60" />
      <rect className={INK} height="5" width="52" x="18" y="70" />
      <rect className={INK} height="5" width="40" x="18" y="80" />
    </g>
  );
}

const GROOVES = [28, 31, 34, 37, 40, 43, 46];

function Disc({ artwork }: { artwork: number }) {
  const clipId = React.useId();
  return (
    <svg aria-hidden="true" className="size-full" viewBox="0 0 100 100">
      <circle
        className="fill-zinc-900 dark:fill-black"
        cx="50"
        cy="50"
        r="50"
      />
      {GROOVES.map((r) => (
        <circle
          className="fill-none stroke-white/[0.08]"
          cx="50"
          cy="50"
          key={r}
          r={r}
          strokeWidth="0.6"
        />
      ))}
      <circle
        className="fill-none stroke-white/[0.16]"
        cx="50"
        cy="50"
        r="49"
        strokeWidth="0.8"
      />
      <clipPath id={clipId}>
        <circle cx="50" cy="50" r="24" />
      </clipPath>
      <circle className="fill-zinc-100" cx="50" cy="50" r="24" />
      <g clipPath={`url(#${clipId})`} transform="translate(26 26) scale(0.48)">
        <LabelArt variant={artwork} />
      </g>
      <circle
        className="fill-white dark:fill-zinc-900"
        cx="50"
        cy="50"
        r="1.8"
      />
    </svg>
  );
}

function Tonearm({ down }: { down: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute -top-1 -right-4 h-[80%] w-auto origin-[77.5%_10%] transition-transform duration-500 ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none"
      style={{ transform: down ? "rotate(11deg)" : "rotate(-8deg)" }}
      viewBox="0 0 40 110"
    >
      <circle
        className="fill-zinc-200 stroke-zinc-300 dark:fill-zinc-700 dark:stroke-zinc-600"
        cx="31"
        cy="11"
        r="8"
      />
      <circle className="fill-zinc-400" cx="31" cy="11" r="3" />
      <path
        className="fill-none stroke-zinc-400 dark:stroke-zinc-500"
        d="M31 11 L31 70 L18 92"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <rect
        className="fill-zinc-600 dark:fill-zinc-300"
        height="12"
        rx="1.5"
        transform="rotate(32 16 96)"
        width="7"
        x="12.5"
        y="90"
      />
    </svg>
  );
}

/* ------------------------------- Now Playing ------------------------------ */

export interface NowPlayingProps {
  tracks?: NowPlayingTrack[];
  /** Index of the track loaded first. */
  defaultTrack?: number;
  /** Start playing on mount. */
  autoPlay?: boolean;
  /** The one accent colour: meter, progress and label art. */
  accent?: string;
  /** Wraps the card in the glass shadow and SVG refraction (Chromium only). */
  glassEffect?: boolean;
  onTrackChange?: (index: number) => void;
  className?: string;
}

const ICON_BUTTON =
  "inline-flex size-10 items-center justify-center rounded-full text-zinc-600 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:bg-zinc-200 dark:text-zinc-400 dark:active:bg-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

const FRAME =
  "@container/now-playing w-full max-w-sm rounded-3xl border border-zinc-200 p-5 shadow-sm dark:border-zinc-800";

export function NowPlaying({
  tracks = DEFAULT_TRACKS,
  defaultTrack = 0,
  autoPlay = true,
  accent = "#f97316",
  glassEffect = false,
  onTrackChange,
  className,
}: NowPlayingProps) {
  const list = tracks.length > 0 ? tracks : DEFAULT_TRACKS;
  const [trackIndex, setTrackIndex] = React.useState(() =>
    clamp(defaultTrack, 0, list.length - 1)
  );
  const track = list[trackIndex] ?? DEFAULT_TRACKS[0];
  const [playing, setPlaying] = React.useState(autoPlay);
  const [clock, setClock] = React.useState<{ s: number; dir: 1 | -1 }>({
    s: 0,
    dir: 1,
  });

  const engineRef = React.useRef<Engine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = createEngine(track.duration, autoPlay);
  }
  const rootRef = React.useRef<HTMLDivElement>(null);
  const discRef = React.useRef<HTMLDivElement>(null);
  const fillRef = React.useRef<HTMLDivElement>(null);
  const railRef = React.useRef<HTMLDivElement>(null);
  const rpmRef = React.useRef<HTMLSpanElement>(null);
  const barRefs = React.useRef<(HTMLSpanElement | null)[]>([]);
  const wakeRef = React.useRef<() => void>(() => undefined);
  const clockRef = React.useRef(0);

  // Read through refs so the loop is set up once and never restarted.
  const listRef = React.useRef(list);
  listRef.current = list;
  const trackIndexRef = React.useRef(trackIndex);
  trackIndexRef.current = trackIndex;
  const onTrackChangeRef = React.useRef(onTrackChange);
  onTrackChangeRef.current = onTrackChange;

  const loadTrack = React.useCallback((index: number) => {
    const all = listRef.current;
    const nextIndex = ((index % all.length) + all.length) % all.length;
    const e = engineRef.current;
    if (e) {
      e.time = 0;
      e.duration = all[nextIndex]?.duration ?? 1;
    }
    trackIndexRef.current = nextIndex;
    setTrackIndex(nextIndex);
    onTrackChangeRef.current?.(nextIndex);
    wakeRef.current();
  }, []);

  // One rAF loop drives the clock, the meter and the disc whenever it is
  // off cruise. It sleeps once everything rests, and while off screen.
  React.useEffect(() => {
    const e = engineRef.current;
    if (!e) {
      return;
    }
    let raf = 0;
    let last = 0;

    const render = () => {
      paint(e, discRef.current, fillRef.current, rpmRef.current);
      const s = Math.floor(e.time);
      if (s !== clockRef.current) {
        const dir = s > clockRef.current ? 1 : -1;
        clockRef.current = s;
        setClock({ s, dir });
      }
    };

    const handleEnds = () => {
      if (e.time >= e.duration) {
        if (e.playing && !e.held && !e.barDrag) {
          loadTrack(trackIndexRef.current + 1);
          return;
        }
        e.time = e.duration;
      }
      if (e.time < 0) {
        e.time = 0;
      }
    };

    const isAwake = () =>
      e.playing || e.held || e.barDrag || e.omega !== 0 || e.env > 0;

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, MAX_DT) : 0;
      last = now;
      if (e.held) {
        e.scrubOmega *= Math.exp(-dt / HOLD_SETTLE_S);
      } else if (!e.barDrag) {
        integrateDisc(e, dt, discRef.current);
      }
      handleEnds();
      updateMeter(e, dt, barRefs.current);
      render();
      if (isAwake() && e.visible) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
        last = 0;
      }
    };

    const wake = () => {
      render();
      if (raf === 0 && e.visible) {
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    };
    wakeRef.current = wake;

    let inView = true;
    const sync = () => {
      e.visible = inView && !document.hidden;
      if (e.visible) {
        e.cruise?.play();
        wake();
      } else {
        e.cruise?.pause();
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? true;
      sync();
    });
    if (rootRef.current) {
      observer.observe(rootRef.current);
    }
    document.addEventListener("visibilitychange", sync);

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      e.reduced = media.matches;
      if (e.reduced) {
        stopCruise(e, discRef.current);
      }
      wake();
    };
    syncMotion();
    media.addEventListener("change", syncMotion);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      media.removeEventListener("change", syncMotion);
      e.cruise?.cancel();
      e.cruise = null;
    };
  }, [loadTrack]);

  const togglePlay = () => {
    const e = engineRef.current;
    if (!e) {
      return;
    }
    const nextPlaying = !e.playing;
    if (nextPlaying && e.time >= e.duration) {
      e.time = 0;
    }
    e.playing = nextPlaying;
    if (!nextPlaying) {
      // Hand the disc back to the loop so it can spin down.
      stopCruise(e, discRef.current);
    }
    setPlaying(nextPlaying);
    wakeRef.current();
  };

  const previous = () => {
    const e = engineRef.current;
    if (e && e.time > RESTART_THRESHOLD) {
      e.time = 0;
      wakeRef.current();
      return;
    }
    loadTrack(trackIndexRef.current - 1);
  };

  const next = () => loadTrack(trackIndexRef.current + 1);

  /* ---------------------------- Disc scrubbing ---------------------------- */

  const pointerAngle = (e: Engine, clientX: number, clientY: number) => {
    const dx = clientX - e.center.x;
    const dy = clientY - e.center.y;
    return {
      angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      distance: Math.hypot(dx, dy),
    };
  };

  const onDiscDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const e = engineRef.current;
    if (!e || event.button !== 0 || e.pointerId !== null) {
      return;
    }
    e.pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    e.center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    // A finger on the record stops it dead, cruise animation included.
    stopCruise(e, discRef.current);
    e.held = true;
    e.omega = 0;
    e.scrubOmega = 0;
    e.pointerAngle = pointerAngle(e, event.clientX, event.clientY).angle;
    e.lastMoveAt = performance.now();
    e.samples = [{ t: e.lastMoveAt, a: e.angle }];
    wakeRef.current();
  };

  const onDiscMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const e = engineRef.current;
    if (!e?.held || e.pointerId !== event.pointerId) {
      return;
    }
    const { angle, distance } = pointerAngle(e, event.clientX, event.clientY);
    if (distance < DEAD_ZONE) {
      e.pointerAngle = angle;
      return;
    }
    // Unwrap across the ±180° seam.
    let delta = angle - e.pointerAngle;
    delta -= Math.round(delta / 360) * 360;
    e.pointerAngle = angle;

    const now = performance.now();
    const dt = Math.max(now - e.lastMoveAt, 1) / 1000;
    e.lastMoveAt = now;
    const instant = clamp(delta / dt, -MAX_OMEGA, MAX_OMEGA);
    e.scrubOmega += (instant - e.scrubOmega) * 0.35;

    // Track time follows the angle; faster turns cover more of the song.
    e.angle += delta;
    e.time = clamp(
      e.time + (delta / CRUISE) * scrubGain(e.scrubOmega),
      0,
      e.duration
    );

    e.samples.push({ t: now, a: e.angle });
    while (
      e.samples.length > 2 &&
      now - (e.samples[0]?.t ?? now) > VELOCITY_WINDOW_MS
    ) {
      e.samples.shift();
    }
    if (discRef.current) {
      discRef.current.style.transform = rotate(e.angle);
    }
  };

  const onDiscUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const e = engineRef.current;
    if (!e?.held || e.pointerId !== event.pointerId) {
      return;
    }
    e.pointerId = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    e.held = false;
    const now = performance.now();
    const first = e.samples[0];
    let velocity = 0;
    if (first && now - e.lastMoveAt < STALE_MOVE_MS && now > first.t) {
      velocity = ((e.angle - first.a) / (now - first.t)) * 1000;
    }
    // It keeps the spin you gave it, then eases back to cruise.
    e.omega = e.reduced ? 0 : clamp(velocity, -MAX_OMEGA, MAX_OMEGA);
    e.scrubOmega = 0;
    wakeRef.current();
  };

  /* ----------------------------- Scrubber bar ----------------------------- */

  const seekFromPointer = (clientX: number) => {
    const e = engineRef.current;
    const rail = railRef.current;
    if (!(e && rail?.parentElement)) {
      return;
    }
    // The rail stretches, so measure its parent, which never moves.
    const rect = rail.parentElement.getBoundingClientRect();
    const x = clientX - rect.left;
    e.time = clamp(x / rect.width, 0, 1) * e.duration;

    // Past either end the rail stretches toward the pointer and thins,
    // giving less the further you pull.
    let over = 0;
    if (x < 0) {
      over = -damp(-x, RUBBER_MAX);
    } else if (x > rect.width) {
      over = damp(x - rect.width, RUBBER_MAX);
    }
    const stretch = 1 + Math.abs(over) / rect.width;
    const thin = 1 - (0.35 * Math.abs(over)) / RUBBER_MAX;
    rail.style.transition = "none";
    rail.style.transformOrigin = over < 0 ? "right center" : "left center";
    rail.style.transform =
      over === 0 ? "" : `scale(${stretch.toFixed(4)}, ${thin.toFixed(3)})`;
    wakeRef.current();
  };

  const onBarDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const e = engineRef.current;
    if (!e || event.button !== 0 || e.pointerId !== null) {
      return;
    }
    e.pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    e.barDrag = true;
    seekFromPointer(event.clientX);
  };

  const onBarMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const e = engineRef.current;
    if (e?.barDrag && e.pointerId === event.pointerId) {
      seekFromPointer(event.clientX);
    }
  };

  const onBarUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const e = engineRef.current;
    if (!e?.barDrag || e.pointerId !== event.pointerId) {
      return;
    }
    e.pointerId = null;
    e.barDrag = false;
    const rail = railRef.current;
    if (rail) {
      rail.style.transition = RUBBER_RETURN;
      rail.style.transform = "";
    }
    wakeRef.current();
  };

  const onBarKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const e = engineRef.current;
    if (!e) {
      return;
    }
    const targets: Record<string, number> = {
      ArrowRight: e.time + SEEK_STEP,
      ArrowUp: e.time + SEEK_STEP,
      ArrowLeft: e.time - SEEK_STEP,
      ArrowDown: e.time - SEEK_STEP,
      Home: 0,
      End: e.duration - 1,
    };
    const target = targets[event.key];
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    e.time = clamp(target, 0, e.duration);
    wakeRef.current();
  };

  const body = (
    <>
      <style>{ROLL_KEYFRAMES}</style>
      <div className="flex items-center gap-5">
        <div className="relative @[22rem]/now-playing:size-32 size-28 shrink-0">
          <div
            className="size-full cursor-grab touch-none select-none rounded-full shadow-[0_6px_16px_-6px_rgba(0,0,0,0.45)] active:cursor-grabbing"
            data-now-playing-disc=""
            onLostPointerCapture={onDiscUp}
            onPointerCancel={onDiscUp}
            onPointerDown={onDiscDown}
            onPointerMove={onDiscMove}
            onPointerUp={onDiscUp}
            ref={discRef}
            title="Spin to scrub"
          >
            <Disc artwork={track.artwork ?? trackIndex % 3} />
          </div>
          <Tonearm down={playing} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="flex h-3.5 items-end gap-0.5">
              {Array.from({ length: BAR_COUNT }, (_, i) => (
                <span
                  className="h-full w-[3px] origin-bottom rounded-[1px] bg-(--now-playing-accent)"
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed set of bars
                  key={i}
                  ref={(node) => {
                    barRefs.current[i] = node;
                  }}
                  style={{ transform: `scaleY(${BAR_REST})` }}
                />
              ))}
            </span>
            <span className="font-medium text-[11px] text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
              Now playing
            </span>
          </div>
          <h3 className="mt-2 truncate font-semibold text-base text-zinc-900 dark:text-zinc-50">
            {track.title}
          </h3>
          <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
            {track.artist}
          </p>
          <span
            className="mt-2 inline-block font-mono text-[11px] text-zinc-400 tabular-nums dark:text-zinc-500"
            ref={rpmRef}
          >
            {autoPlay ? "33⅓ rpm" : "0 rpm"}
          </span>
        </div>
      </div>

      <div className="mt-5">
        <div
          aria-label="Seek"
          aria-valuemax={track.duration}
          aria-valuemin={0}
          aria-valuenow={clock.s}
          aria-valuetext={`${formatTime(clock.s)} of ${formatTime(track.duration)}`}
          className="group/seek -my-2 cursor-pointer touch-none py-2 outline-none"
          onKeyDown={onBarKey}
          onLostPointerCapture={onBarUp}
          onPointerCancel={onBarUp}
          onPointerDown={onBarDown}
          onPointerMove={onBarMove}
          onPointerUp={onBarUp}
          role="slider"
          tabIndex={0}
        >
          <div className="h-1.5">
            <div
              className="h-full overflow-hidden rounded-full bg-zinc-200 ring-zinc-400 ring-offset-2 ring-offset-white group-focus-visible/seek:ring-2 dark:bg-zinc-800 dark:ring-offset-zinc-900"
              ref={railRef}
            >
              <div
                className="h-full w-full origin-left bg-(--now-playing-accent)"
                ref={fillRef}
                style={{ transform: "scaleX(0)" }}
              />
            </div>
          </div>
        </div>
        <div className="mt-2 flex justify-between font-medium text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          <RollingTime direction={clock.dir} seconds={clock.s} />
          <span>{formatTime(track.duration)}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          aria-label="Previous track"
          className={ICON_BUTTON}
          onClick={previous}
          type="button"
        >
          <SkipBack className="size-5" fill="currentColor" />
        </button>
        <button
          aria-label={playing ? "Pause" : "Play"}
          className="inline-flex size-12 items-center justify-center rounded-full bg-zinc-900 text-white transition-colors duration-150 hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:bg-zinc-600 dark:bg-zinc-100 dark:text-zinc-900 dark:active:bg-zinc-300 dark:focus-visible:ring-offset-zinc-900 dark:hover:bg-white"
          onClick={togglePlay}
          type="button"
        >
          {playing ? (
            <Pause className="size-5" fill="currentColor" />
          ) : (
            <Play className="size-5 translate-x-px" fill="currentColor" />
          )}
        </button>
        <button
          aria-label="Next track"
          className={ICON_BUTTON}
          onClick={next}
          type="button"
        >
          <SkipForward className="size-5" fill="currentColor" />
        </button>
      </div>
    </>
  );

  const style = { "--now-playing-accent": accent } as React.CSSProperties;

  if (glassEffect) {
    return (
      <div className="w-full max-w-sm" ref={rootRef} style={style}>
        <LiquidGlassCard
          className={cn(FRAME, "bg-white/50 dark:bg-zinc-900/50", className)}
          glassEffect
          glassSize="sm"
        >
          {body}
        </LiquidGlassCard>
      </div>
    );
  }

  return (
    <div
      className={cn(FRAME, "bg-white dark:bg-zinc-900", className)}
      ref={rootRef}
      style={style}
    >
      {body}
    </div>
  );
}

export { LiquidButton, LiquidGlassCard, NowPlaying as NotificationCenter };
export default NowPlaying;
