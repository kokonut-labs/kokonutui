"use client";

/**
 * @author: @dorianbaffier
 * @description: Flick Card
 * @version: 2.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// Degrees of turn per px of drag.
const DEG_PER_PX = 0.6;
// Spring that lands the card on a face, in degrees and seconds.
const STIFFNESS = 170;
const DAMPING = 20;
// How far ahead (in seconds of release velocity) the landing face is picked.
const PROJECTION = 0.22;
// A release faster than this (deg/s) always turns at least one face.
const FLICK_SPEED = 450;
// Never spin more than this many half turns from one flick.
const MAX_HALF_TURNS = 6;
// Movement below this (px) is a click, not a drag.
const DRAG_SLOP = 4;
// How far the card lifts toward the viewer at 90°, in px.
const LIFT = 36;
// Hover pre-tilt toward the pointer, in degrees.
const TILT = 6;
// Card thickness: stacked slices between the two faces.
const THICKNESS = 6;
const SLICES = 7;
const SLICE_DEPTHS = Array.from(
  { length: SLICES },
  (_, i) => -THICKNESS / 2 + (THICKNESS * (i + 0.5)) / SLICES
);
const SUBSTEP = 1 / 240;
// Release velocity is read from the last this-many ms of the drag.
const VELOCITY_WINDOW = 80;

const INTERACTIVE = "button, a, input, select, textarea, [data-no-flip]";

type Axis = "x" | "y";

export interface CardFlipProps {
  /** Front face. Defaults to an event ticket. */
  front?: ReactNode;
  /** Back face. Defaults to the ticket's entry code and seat. */
  back?: ReactNode;
  /** Controlled side: true shows the back. */
  flipped?: boolean;
  /** Starting side when uncontrolled. */
  defaultFlipped?: boolean;
  /** Called when a drag, click or key turns the card to the other side. */
  onFlippedChange?: (flipped: boolean) => void;
  /** "y" spins left and right like a coin, "x" tumbles top over bottom. */
  axis?: Axis;
  /** Accessible name of the card. */
  label?: string;
  className?: string;
  /** Classes for both faces, such as background, border and radius. */
  faceClassName?: string;
}

const mod2 = (n: number) => ((n % 2) + 2) % 2;
const sideOf = (angle: number) => mod2(Math.round(angle / 180)) === 1;
const nearestFace = (angle: number) => Math.round(angle / 180) * 180;

interface Sim {
  angle: number;
  velocity: number;
  target: number;
  raf: number;
  last: number;
  reduceMotion: boolean;
  pointerId: number | null;
  startX: number;
  startY: number;
  startAngle: number;
  dragging: boolean;
  samples: { t: number; a: number }[];
}

function cardTransform(axis: Axis, angle: number, lift: number) {
  const rotate = axis === "y" ? "rotateY" : "rotateX";
  return `translateZ(${lift.toFixed(2)}px) ${rotate}(${angle.toFixed(2)}deg)`;
}

// A flat band of light sweeps across whichever face is showing, and the face
// dims as it turns away from the light.
function paintLight(
  axis: Axis,
  sin: number,
  bands: (HTMLDivElement | null)[],
  shades: (HTMLDivElement | null)[]
) {
  const turn = Math.abs(sin);
  const shift = `${(sin * 140).toFixed(1)}%`;
  const transform =
    axis === "y"
      ? `translateX(${shift}) rotate(18deg)`
      : `translateY(${shift}) rotate(72deg)`;
  for (const band of bands) {
    if (band) {
      band.style.opacity = (turn * 0.12).toFixed(3);
      band.style.transform = transform;
    }
  }
  for (const shade of shades) {
    if (shade) {
      shade.style.opacity = (turn * 0.14).toFixed(3);
    }
  }
}

function releaseVelocity(samples: Sim["samples"], now: number) {
  const last = samples.at(-1);
  if (!last || now - last.t > VELOCITY_WINDOW) {
    return 0;
  }
  const first = samples.find((p) => last.t - p.t <= VELOCITY_WINDOW);
  if (!first || last.t <= first.t) {
    return 0;
  }
  return ((last.a - first.a) / (last.t - first.t)) * 1000;
}

export default function CardFlip({
  front,
  back,
  flipped,
  defaultFlipped = false,
  onFlippedChange,
  axis = "y",
  label = "Event ticket",
  className,
  faceClassName,
}: CardFlipProps) {
  const isControlled = flipped !== undefined;
  const [internalFlipped, setInternalFlipped] = useState(defaultFlipped);
  const isFlipped = isControlled ? flipped : internalFlipped;
  // Which face is turned toward the viewer right now (changes at 90°).
  const [backVisible, setBackVisible] = useState(isFlipped);
  // Bumped when a controlled card asks to turn; see the effect below.
  const [request, setRequest] = useState(0);
  const hintId = useId();

  const rootRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const frontBandRef = useRef<HTMLDivElement>(null);
  const backBandRef = useRef<HTMLDivElement>(null);
  const frontShadeRef = useRef<HTMLDivElement>(null);
  const backShadeRef = useRef<HTMLDivElement>(null);

  // Styles React writes once; the spring owns them after that.
  const [initial] = useState(() => {
    const angle = isFlipped ? 180 : 0;
    return {
      angle,
      card: { transform: cardTransform(axis, angle, 0) },
      front: { transform: `translateZ(${THICKNESS / 2}px)` },
    };
  });

  const sim = useRef<Sim>({
    angle: initial.angle,
    velocity: 0,
    target: initial.angle,
    raf: 0,
    last: 0,
    reduceMotion: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startAngle: 0,
    dragging: false,
    samples: [],
  });

  // Latest props for the imperative handlers.
  const latest = useRef({ axis, isFlipped, isControlled, onFlippedChange });
  latest.current = { axis, isFlipped, isControlled, onFlippedChange };
  const backVisibleRef = useRef(backVisible);

  const render = useCallback(() => {
    const s = sim.current;
    const ax = latest.current.axis;
    const rad = (s.angle * Math.PI) / 180;
    const sin = Math.sin(rad);
    const turn = Math.abs(sin);
    const facing = Math.abs(Math.cos(rad));

    if (cardRef.current) {
      cardRef.current.style.transform = cardTransform(ax, s.angle, turn * LIFT);
    }
    if (shadowRef.current) {
      const narrow = (0.16 + 0.84 * facing).toFixed(3);
      const soft = (1 - turn * 0.12).toFixed(3);
      shadowRef.current.style.transform =
        ax === "y" ? `scale(${narrow}, ${soft})` : `scale(${soft}, ${narrow})`;
      shadowRef.current.style.opacity = (1 - turn * 0.45).toFixed(3);
    }
    paintLight(
      ax,
      sin,
      [frontBandRef.current, backBandRef.current],
      [frontShadeRef.current, backShadeRef.current]
    );

    const showsBack = sideOf(s.angle);
    if (showsBack !== backVisibleRef.current) {
      backVisibleRef.current = showsBack;
      setBackVisible(showsBack);
    }
  }, []);

  const step = useCallback(
    (now: number) => {
      const s = sim.current;
      const dt = Math.min(0.05, (now - s.last) / 1000);
      s.last = now;
      const n = Math.max(1, Math.ceil(dt / SUBSTEP));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        const force = -STIFFNESS * (s.angle - s.target) - DAMPING * s.velocity;
        s.velocity += force * h;
        s.angle += s.velocity * h;
      }
      if (Math.abs(s.angle - s.target) < 0.05 && Math.abs(s.velocity) < 0.5) {
        // Settled: park on 0 or 180 so the numbers never grow, then sleep.
        s.target = sideOf(s.target) ? 180 : 0;
        s.angle = s.target;
        s.velocity = 0;
        s.raf = 0;
        render();
        return;
      }
      render();
      s.raf = requestAnimationFrame(step);
    },
    [render]
  );

  const settle = useCallback(() => {
    const s = sim.current;
    if (s.reduceMotion) {
      // Reduced motion: no spin, land on the face at once.
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.target = sideOf(s.target) ? 180 : 0;
      s.angle = s.target;
      s.velocity = 0;
      render();
      return;
    }
    if (!s.raf) {
      s.last = performance.now();
      s.raf = requestAnimationFrame(step);
    }
  }, [render, step]);

  // Point the spring at a face and report a side change.
  const aim = useCallback(
    (target: number) => {
      sim.current.target = target;
      const next = sideOf(target);
      const p = latest.current;
      if (next !== p.isFlipped) {
        if (p.isControlled) {
          setRequest((n) => n + 1);
        } else {
          setInternalFlipped(next);
        }
        p.onFlippedChange?.(next);
      }
      settle();
    },
    [settle]
  );

  const flipBy = useCallback(
    (direction: number) => {
      aim(nearestFace(sim.current.target) + 180 * direction);
    },
    [aim]
  );

  useEffect(() => {
    const s = sim.current;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    s.reduceMotion = query.matches;
    const onChange = () => {
      s.reduceMotion = query.matches;
    };
    query.addEventListener("change", onChange);
    return () => {
      query.removeEventListener("change", onChange);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, []);

  // Controlled: follow the prop when it disagrees with where the card lands.
  // `request` re-runs this after every turn the card asks for, so a parent
  // that ignores onFlippedChange sends the card back to its side.
  useEffect(() => {
    if (flipped === undefined || request < 0) {
      return;
    }
    const s = sim.current;
    if (s.dragging || sideOf(s.target) === flipped) {
      return;
    }
    // The nearest face on the asked-for side, so a refused turn swings back
    // the way it came.
    const face = nearestFace(s.angle);
    if (sideOf(face) === flipped) {
      s.target = face;
    } else {
      s.target = face + (s.angle < face ? -180 : 180);
    }
    settle();
  }, [flipped, request, settle]);

  // A new axis redraws the spring-owned transforms in place.
  useEffect(() => {
    latest.current.axis = axis;
    render();
  }, [axis, render]);

  const setTilt = (x: number, y: number) => {
    if (tiltRef.current) {
      tiltRef.current.style.transform = `rotateX(${(-y * TILT).toFixed(2)}deg) rotateY(${(x * TILT).toFixed(2)}deg)`;
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    // One pointer at a time: a second finger does not steal the drag.
    if (
      s.pointerId !== null ||
      e.button !== 0 ||
      (e.target as Element).closest(INTERACTIVE)
    ) {
      return;
    }
    s.pointerId = e.pointerId;
    s.startX = e.clientX;
    s.startY = e.clientY;
    s.startAngle = s.angle;
    s.dragging = false;
    s.samples = [{ t: e.timeStamp, a: s.angle }];
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const hoverTilt = (e: PointerEvent<HTMLDivElement>) => {
    // The tilt follows the cursor: it's movement, so reduced motion skips it.
    if (
      e.pointerType !== "mouse" ||
      sim.current.reduceMotion ||
      !rootRef.current
    ) {
      return;
    }
    const r = rootRef.current.getBoundingClientRect();
    setTilt(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      ((e.clientY - r.top) / r.height) * 2 - 1
    );
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (s.pointerId !== e.pointerId) {
      hoverTilt(e);
      return;
    }
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.dragging) {
      if (Math.hypot(dx, dy) < DRAG_SLOP) {
        return;
      }
      s.dragging = true;
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.velocity = 0;
      setTilt(0, 0);
    }
    // One to one: the card stays under the finger.
    s.angle = s.startAngle + (axis === "y" ? dx : -dy) * DEG_PER_PX;
    s.samples.push({ t: e.timeStamp, a: s.angle });
    if (s.samples.length > 8) {
      s.samples.shift();
    }
    render();
  };

  const release = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const s = sim.current;
    if (s.pointerId !== e.pointerId) {
      return;
    }
    s.pointerId = null;
    if (!s.dragging) {
      if (!cancelled) {
        // A click pushes the half you pressed away from you.
        const r = e.currentTarget.getBoundingClientRect();
        const pushed =
          axis === "y"
            ? e.clientX > r.left + r.width / 2
            : e.clientY < r.top + r.height / 2;
        flipBy(pushed ? 1 : -1);
      }
      return;
    }
    s.dragging = false;

    const velocity = cancelled ? 0 : releaseVelocity(s.samples, e.timeStamp);
    const from = nearestFace(s.startAngle);
    let target = nearestFace(s.angle + velocity * PROJECTION);
    if (Math.abs(velocity) > FLICK_SPEED && target === from) {
      target = from + 180 * Math.sign(velocity);
    }
    const limit = MAX_HALF_TURNS * 180;
    target = Math.max(from - limit, Math.min(from + limit, target));
    s.velocity = velocity;
    aim(target);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) {
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      flipBy(1);
    }
  };

  const face = cn(
    "absolute inset-0 overflow-hidden rounded-2xl [backface-visibility:hidden]",
    "border border-zinc-200 bg-white text-zinc-900",
    "dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50",
    faceClassName
  );

  return (
    // biome-ignore lint/a11y/useSemanticElements: a labelled card whose faces hold their own content, not a plain button
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: drag, click and Enter or Space all turn the card
    <div
      aria-describedby={hintId}
      aria-label={label}
      aria-roledescription="flip card"
      className={cn(
        "group/flick relative aspect-[7/10] w-[260px] select-none rounded-2xl outline-hidden [perspective:1100px]",
        "focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-4 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950",
        axis === "y" ? "touch-pan-y" : "touch-pan-x",
        className
      )}
      onKeyDown={onKeyDown}
      onLostPointerCapture={(e) => release(e, true)}
      onPointerCancel={(e) => release(e, true)}
      onPointerDown={onPointerDown}
      onPointerLeave={() => {
        if (sim.current.pointerId === null) {
          setTilt(0, 0);
        }
      }}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => release(e, false)}
      ref={rootRef}
      role="group"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Enter and Space flip the card while it has focus
      tabIndex={0}
    >
      {/* Floor shadow: narrows and fades as the card turns edge-on. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[8%] -bottom-7 h-6 rounded-[50%] bg-zinc-900/25 blur-md dark:bg-black/70"
        ref={shadowRef}
      />

      <div
        className="relative h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] [transform-style:preserve-3d] motion-reduce:transition-none"
        ref={tiltRef}
      >
        <div
          className="relative h-full w-full cursor-grab rounded-2xl [transform-style:preserve-3d] group-active/flick:cursor-grabbing"
          ref={cardRef}
          style={initial.card}
        >
          {/* The edge: thin slices stacked between the two faces. */}
          {SLICE_DEPTHS.map((z) => (
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-2xl bg-zinc-300 dark:bg-zinc-700"
              key={z}
              style={{ transform: `translateZ(${z.toFixed(3)}px)` }}
            />
          ))}

          <div
            aria-hidden={backVisible || undefined}
            className={face}
            inert={backVisible}
            style={initial.front}
          >
            {front ?? <TicketFront />}
            <LightBand bandRef={frontBandRef} shadeRef={frontShadeRef} />
          </div>

          <div
            aria-hidden={!backVisible || undefined}
            className={face}
            inert={!backVisible}
            style={{
              transform: `${axis === "y" ? "rotateY" : "rotateX"}(180deg) translateZ(${THICKNESS / 2}px)`,
            }}
          >
            {back ?? <TicketBack />}
            <LightBand bandRef={backBandRef} shadeRef={backShadeRef} />
          </div>
        </div>
      </div>

      <span className="sr-only" id={hintId}>
        Showing the {isFlipped ? "back" : "front"}. Press Enter or Space, or
        drag, to turn it over.
      </span>
    </div>
  );
}

function LightBand({
  bandRef,
  shadeRef,
}: {
  bandRef: Ref<HTMLDivElement>;
  shadeRef: Ref<HTMLDivElement>;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <div className="absolute inset-0 bg-black opacity-0" ref={shadeRef} />
      <div
        className="h-[220%] w-1/3 shrink-0 bg-white opacity-0"
        ref={bandRef}
      />
    </div>
  );
}

/* Demo faces: an event ticket. Pass your own front and back to replace them. */

const TICKET = {
  event: "Fieldwork Sessions",
  edition: "Vol. 04",
  date: "Sat 21 Nov",
  time: "19:30",
  venue: "Hall B, Pier 7",
  holder: "Jordan Vale",
  number: "004182",
  gate: "C",
  section: "Floor",
  row: "F",
  seat: "14",
};

function TicketFront() {
  return (
    <div className="flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <span className="font-medium text-[11px] text-zinc-500 uppercase tracking-[0.14em] dark:text-zinc-400">
          Admit one
        </span>
        <span className="rounded-md bg-orange-500 px-1.5 py-0.5 font-medium text-[11px] text-white tracking-wide">
          GA
        </span>
      </div>

      <div className="mt-6">
        <p className="font-medium text-orange-600 text-xs tabular-nums dark:text-orange-400">
          {TICKET.edition}
        </p>
        <h3 className="mt-1 font-semibold text-[26px] leading-[1.05] tracking-tight">
          {TICKET.event}
        </h3>
      </div>

      <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-3">
        <TicketField label="Date" value={TICKET.date} />
        <TicketField label="Doors" value={TICKET.time} />
        <TicketField label="Venue" value={TICKET.venue} wide />
      </dl>

      <div className="-mx-5 my-4 border-zinc-300 border-t border-dashed dark:border-zinc-700" />

      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Holder</p>
          <p className="font-medium text-sm">{TICKET.holder}</p>
        </div>
        <p className="font-mono text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          No. {TICKET.number}
        </p>
      </div>
    </div>
  );
}

function TicketBack() {
  return (
    <div className="flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <span className="font-medium text-[11px] text-zinc-500 uppercase tracking-[0.14em] dark:text-zinc-400">
          Scan at entry
        </span>
        <span className="font-mono text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          #{TICKET.number}
        </span>
      </div>

      <div className="mx-auto mt-4 w-[62%] rounded-xl bg-white p-2.5 ring-1 ring-zinc-200 dark:ring-0">
        <svg
          aria-label={`Entry code ${TICKET.number}`}
          className="block h-auto w-full"
          role="img"
          shapeRendering="crispEdges"
          viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`}
        >
          <path d={QR_PATH} fill="#18181b" />
        </svg>
      </div>

      <dl className="mt-auto grid grid-cols-4 gap-2 text-center">
        <TicketField label="Gate" value={TICKET.gate} />
        <TicketField label="Section" value={TICKET.section} />
        <TicketField label="Row" value={TICKET.row} />
        <TicketField label="Seat" value={TICKET.seat} />
      </dl>

      <p className="mt-4 border-zinc-200 border-t pt-3 text-[11px] text-zinc-500 leading-snug dark:border-zinc-800 dark:text-zinc-400">
        Valid for one entry. Re-entry with wristband only.
      </p>
    </div>
  );
}

function TicketField({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={cn(wide && "col-span-2")}>
      <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="font-medium text-sm">{value}</dd>
    </div>
  );
}

// A deterministic, QR-like code: three finder squares and seeded modules.
const QR_SIZE = 21;
const QR_PATH = buildQrPath(QR_SIZE, 4182);

function buildQrPath(size: number, seed: number) {
  let state = seed;
  const random = () => {
    state = (state * 16_807) % 2_147_483_647;
    return state / 2_147_483_647;
  };
  const far = size - 7;
  const inFinder = (x: number, y: number) =>
    (x < 8 && y < 8) || (x >= far - 1 && y < 8) || (x < 8 && y >= far - 1);
  const finderCell = (x: number, y: number) => {
    const fx = x >= far ? x - far : x;
    const fy = y >= far ? y - far : y;
    if (fx > 6 || fy > 6 || fx < 0 || fy < 0) {
      return false;
    }
    return Math.max(Math.abs(fx - 3), Math.abs(fy - 3)) !== 2;
  };
  let d = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const on = inFinder(x, y) ? finderCell(x, y) : random() > 0.52;
      if (on) {
        d += `M${x} ${y}h1v1h-1z`;
      }
    }
  }
  return d;
}
