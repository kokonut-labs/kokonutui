"use client";

import { useRouter } from "next/navigation";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AGENTS } from "@/components/landing/home/agents";
import { HeroActions } from "@/components/landing/home/catalog";
import { Fit } from "@/components/landing/home/live";
import type { Part } from "@/components/landing/home/parts";
import {
  EASE_COLORS,
  FOCUS,
  FOCUS_INSET,
  INK,
  LEAF,
  META,
  MONO,
  SOFT,
} from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";
import { PartDemo } from "./demo";
import { InstallBar } from "./install";
import { matchParts } from "./match";

// The homepage is one canvas with every component on it, running, laid out
// like a design file: a group per category, an artboard per component.
// Drag to pan, pinch or ctrl-scroll to zoom, pick one to add it.

const BOARD_W = 440;
const BOARD_H: Record<string, number> = {
  buttons: 240,
  texts: 240,
  backgrounds: 330,
};
const BOARD_H_DEFAULT = 430;
const LABEL = 34;
const GAP_X = 56;
const GAP_Y = 64;
const COLS = 4;
const GROUP_HEAD = 300;
const GROUP_GAP = 360;
const GROUP_COLUMNS = 3;
const GROUP_W = COLS * BOARD_W + (COLS - 1) * GAP_X;

/** Below this zoom, artboards show their name instead of running. */
const DETAIL = 0.42;
const MIN_Z = 0.05;
const MAX_Z = 1.6;

interface Board {
  part: Part;
  x: number;
  y: number;
  h: number;
}

interface Group {
  slug: string;
  title: string;
  count: number;
  x: number;
  y: number;
  h: number;
}

interface View {
  x: number;
  y: number;
  z: number;
}

/** Groups go into the shortest of three columns, AI first. */
function layout(parts: Part[]) {
  const slugs = [...new Set(parts.map((p) => p.categorySlug))].sort(
    (a, b) => Number(b === "ai") - Number(a === "ai")
  );
  const heights = new Array<number>(GROUP_COLUMNS).fill(0);
  const boards: Board[] = [];
  const groups: Group[] = [];
  for (const slug of slugs) {
    const items = parts.filter((p) => p.categorySlug === slug);
    const h = BOARD_H[slug] ?? BOARD_H_DEFAULT;
    const rows = Math.ceil(items.length / COLS);
    const groupH = GROUP_HEAD + rows * (LABEL + h + GAP_Y) - GAP_Y;
    const column = heights.indexOf(Math.min(...heights));
    const gx = column * (GROUP_W + GROUP_GAP);
    const gy = heights[column];
    heights[column] += groupH + GROUP_GAP;
    groups.push({
      slug,
      title: items[0]?.category ?? slug,
      count: items.length,
      x: gx,
      y: gy,
      h: groupH,
    });
    items.forEach((part, i) => {
      boards.push({
        part,
        h,
        x: gx + (i % COLS) * (BOARD_W + GAP_X),
        y: gy + GROUP_HEAD + Math.floor(i / COLS) * (LABEL + h + GAP_Y),
      });
    });
  }
  return {
    boards,
    groups,
    width: GROUP_COLUMNS * GROUP_W + (GROUP_COLUMNS - 1) * GROUP_GAP,
    height: Math.max(...heights) - GROUP_GAP,
  };
}

/** cubic-bezier(x1, y1, x2, y2) as a function of time, solved with Newton. */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (s: number, a: number, b: number) =>
    3 * a * (1 - s) ** 2 * s + 3 * b * (1 - s) * s ** 2 + s ** 3;
  const slope = (s: number, a: number, b: number) =>
    3 * a * (1 - s) ** 2 + 6 * (b - a) * (1 - s) * s + 3 * (1 - b) * s ** 2;
  return (t: number) => {
    let s = t;
    for (let i = 0; i < 8; i++) {
      const err = at(s, x1, x2) - t;
      const d = slope(s, x1, x2);
      if (Math.abs(err) < 1e-5 || Math.abs(d) < 1e-6) {
        break;
      }
      s = Math.min(1, Math.max(0, s - err / d));
    }
    return at(s, y1, y2);
  };
}
/** Camera moves across the canvas: strong ease-in-out. */
const EASE_IN_OUT = bezier(0.77, 0, 0.175, 1);
/** Responses to a press (zoom buttons, the spring back at an edge). */
const EASE_OUT = bezier(0.23, 1, 0.32, 1);

/**
 * How far past an edge the canvas follows a drag: less the further you
 * pull, like iOS, instead of a wall.
 */
function rubber(over: number, dim: number) {
  return (1 - 1 / ((over * 0.55) / dim + 1)) * dim;
}
function band(v: number, lo: number, hi: number, dim: number) {
  if (v > hi) {
    return hi + rubber(v - hi, dim);
  }
  if (v < lo) {
    return lo - rubber(lo - v, dim);
  }
  return v;
}

/** Arrow keys move the camera; the canvas moves the other way. */
const PAN: Record<string, [number, number]> = {
  ArrowLeft: [1, 0],
  ArrowRight: [-1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
};

/** A 4×4 Bayer matrix: the order pixels switch on as density rises. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** World pixels per dither pixel, and how far the field runs past the parts. */
const DITHER_CELL = 5;
const DITHER_PAD = 2400;

/**
 * The background: the site's 1-bit dither over the whole canvas, drawn once
 * into a canvas and scaled with the camera like everything else. Its density
 * drifts in slow waves, so it reads as shading rather than a grid, and fades
 * to nothing before its edge.
 */
function DitherField({ width, height }: { width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!(canvas && ctx)) {
      return;
    }
    const cols = Math.ceil((width + DITHER_PAD * 2) / DITHER_CELL);
    const rows = Math.ceil((height + DITHER_PAD * 2) / DITHER_CELL);
    canvas.width = cols;
    canvas.height = rows;
    const image = ctx.createImageData(cols, rows);
    const data = image.data;
    const fade = DITHER_PAD * 0.8;
    for (let row = 0; row < rows; row++) {
      const wy = row * DITHER_CELL - DITHER_PAD;
      const edgeY = Math.min(wy + DITHER_PAD, height + DITHER_PAD - wy) / fade;
      for (let col = 0; col < cols; col++) {
        const wx = col * DITHER_CELL - DITHER_PAD;
        const edgeX = Math.min(wx + DITHER_PAD, width + DITHER_PAD - wx) / fade;
        const wave =
          0.55 * Math.sin(wx / 900 + 0.4) * Math.sin(wy / 1100 + 1.1) +
          0.45 * Math.sin((wx * 0.6 - wy * 0.8) / 1500 + 2.3);
        const t = Math.min(1, Math.max(0, (wave + 0.15) / 1.05));
        const density = t * t * (3 - 2 * t) * 0.4 * Math.min(1, edgeX, edgeY);
        if (BAYER[(row % 4) * 4 + (col % 4)] < density * 16) {
          data[(row * cols + col) * 4 + 3] = 255;
        }
      }
    }
    ctx.putImageData(image, 0, 0);
  }, [width, height]);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <canvas
        className="canvas-dither absolute"
        ref={ref}
        style={{
          left: -DITHER_PAD,
          top: -DITHER_PAD,
          width: width + DITHER_PAD * 2,
          height: height + DITHER_PAD * 2,
        }}
      />
    </div>
  );
}

/** Elements inside a running part that answer a click themselves. */
const CONTROLS =
  "a, button, input, textarea, select, label, canvas, [role=button], [role=slider], [role=switch], [role=tab], [contenteditable]";

const HANDLES = [
  "-top-[5px] -left-[5px]",
  "-top-[5px] -right-[5px]",
  "-bottom-[5px] -left-[5px]",
  "-bottom-[5px] -right-[5px]",
];

const clampZ = (z: number) => Math.min(MAX_Z, Math.max(MIN_Z, z));
const reduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Selection =
  | { kind: "one"; name: string }
  | { kind: "view"; names: string[] };

function ToolButton({
  children,
  label,
  onClick,
  className,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "flex h-8 min-w-8 items-center justify-center rounded-[9px] px-2 text-[13px] text-black/70 hover:bg-black/[0.06] hover:text-black dark:text-white/70 dark:hover:bg-white/[0.08] dark:hover:text-white",
        EASE_COLORS,
        FOCUS_INSET,
        className
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

const PANEL =
  "rounded-[16px] border border-black/[0.1] bg-white dark:border-white/[0.12] dark:bg-[#0b0b0b]";

export function Canvas({ parts }: { parts: Part[] }) {
  const router = useRouter();
  const { boards, groups, width, height } = useMemo(
    () => layout(parts),
    [parts]
  );
  const byName = useMemo(
    () => new Map(boards.map((b) => [b.part.name, b])),
    [boards]
  );

  const viewport = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const zoomLabel = useRef<HTMLSpanElement>(null);
  const view = useRef<View>({ x: 0, y: 0, z: 1 });
  const frame = useRef(0);
  const motion = useRef(0);
  const space = useRef(false);

  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState("");
  const [detail, setDetail] = useState(true);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [intro, setIntro] = useState(true);
  const [query, setQuery] = useState("");

  const live = useMemo(() => new Set(visible.split("|")), [visible]);
  const found = useMemo(
    () => (query.trim() ? matchParts(parts, query, 6) : []),
    [parts, query]
  );

  /** Writes the camera to the DOM, then culls what's on screen. */
  const apply = useCallback(() => {
    const el = viewport.current;
    const w = world.current;
    if (!(el && w)) {
      return;
    }
    const { x, y, z } = view.current;
    w.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${z})`;

    if (zoomLabel.current) {
      zoomLabel.current.textContent = `${Math.round(z * 100)}%`;
    }

    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const { width: vw, height: vh } = el.getBoundingClientRect();
      const margin = 160 / z;
      const left = -x / z - margin;
      const top = -y / z - margin;
      const right = (vw - x) / z + margin;
      const bottom = (vh - y) / z + margin;
      const names = boards
        .filter(
          (b) =>
            b.x < right &&
            b.x + BOARD_W > left &&
            b.y < bottom &&
            b.y + LABEL + b.h > top
        )
        .map((b) => b.part.name);
      setVisible(names.join("|"));
      setDetail(z >= DETAIL);
    });
  }, [boards]);

  /** How far the camera may go: some of the canvas always stays on screen. */
  const bounds = useCallback(
    (z: number) => {
      const el = viewport.current;
      const keep = 200;
      const vw = el?.clientWidth ?? 1280;
      const vh = el?.clientHeight ?? 800;
      return {
        minX: keep - width * z,
        maxX: vw - keep,
        minY: keep - height * z,
        maxY: vh - keep,
        vw,
        vh,
      };
    },
    [width, height]
  );

  const clamp = useCallback(() => {
    const v = view.current;
    v.z = clampZ(v.z);
    const b = bounds(v.z);
    v.x = Math.min(b.maxX, Math.max(b.minX, v.x));
    v.y = Math.min(b.maxY, Math.max(b.minY, v.y));
  }, [bounds]);

  const stop = useCallback(() => cancelAnimationFrame(motion.current), []);

  /** Where a focused thing should land: the middle of the free space. */
  const anchor = useCallback(
    (withPanel: boolean) => {
      const el = viewport.current;
      const vw = el?.clientWidth ?? 1280;
      const vh = el?.clientHeight ?? 800;
      const wide = vw >= 1024;
      const left = wide && intro ? 392 : 0;
      const right = wide && withPanel ? 392 : 0;
      return {
        ax: (left + vw - right) / 2,
        ay: wide ? vh / 2 : vh * 0.42,
        w: vw - left - right,
        h: vh,
      };
    },
    [intro]
  );

  /** Moves the camera so world point (cx, cy) sits at the anchor, at zoom z. */
  const flyTo = useCallback(
    (
      cx: number,
      cy: number,
      z: number,
      withPanel: boolean,
      instant = false
    ) => {
      stop();
      const { ax, ay } = anchor(withPanel);
      const from = view.current;
      const fz = from.z;
      const fcx = (ax - from.x) / fz;
      const fcy = (ay - from.y) / fz;
      const tz = clampZ(z);
      // Short hops are quick; crossing the canvas takes a little longer, so
      // the eye can follow where it went. 360 to 640ms.
      const travel =
        Math.hypot(cx - fcx, cy - fcy) * Math.min(fz, tz) +
        Math.abs(Math.log(tz / fz)) * 400;
      const ms = instant ? 0 : Math.min(640, 360 + travel * 0.25);
      const set = (t: number) => {
        const k = Math.exp(Math.log(fz) + (Math.log(tz) - Math.log(fz)) * t);
        const px = fcx + (cx - fcx) * t;
        const py = fcy + (cy - fcy) * t;
        view.current = { x: ax - px * k, y: ay - py * k, z: k };
        apply();
      };
      if (ms === 0 || reduced()) {
        set(1);
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / ms);
        set(EASE_IN_OUT(t));
        if (t < 1) {
          motion.current = requestAnimationFrame(tick);
        }
      };
      motion.current = requestAnimationFrame(tick);
    },
    [anchor, apply, stop]
  );

  /** Zooms keeping the world point under (sx, sy) where it is. */
  const zoomAt = useCallback(
    (sx: number, sy: number, z: number, ms = 0) => {
      stop();
      const v = view.current;
      const from = v.z;
      const next = clampZ(z);
      const wx = (sx - v.x) / v.z;
      const wy = (sy - v.y) / v.z;
      const set = (t: number) => {
        const k = Math.exp(
          Math.log(from) + (Math.log(next) - Math.log(from)) * t
        );
        view.current = { x: sx - wx * k, y: sy - wy * k, z: k };
        clamp();
        apply();
      };
      if (ms === 0 || reduced()) {
        set(1);
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / ms);
        set(EASE_OUT(t));
        if (t < 1) {
          motion.current = requestAnimationFrame(tick);
        }
      };
      motion.current = requestAnimationFrame(tick);
    },
    [apply, clamp, stop]
  );

  const focusBoard = useCallback(
    (name: string) => {
      const b = byName.get(name);
      if (!b) {
        return;
      }
      setSelection({ kind: "one", name });
      const { w, h } = anchor(true);
      const z = Math.min(1, (w - 80) / BOARD_W, (h - 120) / (b.h + LABEL));
      flyTo(b.x + BOARD_W / 2, b.y + (LABEL + b.h) / 2, z, true);
    },
    [anchor, byName, flyTo]
  );

  /** A click on an artboard opens that component's docs page. */
  const openDocs = useCallback(
    (name: string) => {
      const b = byName.get(name);
      if (b) {
        setSelection({ kind: "one", name });
        router.push(b.part.url);
      }
    },
    [byName, router]
  );

  const focusGroup = useCallback(
    (slug: string) => {
      const g = groups.find((item) => item.slug === slug);
      if (!g) {
        return;
      }
      const { w, h } = anchor(false);
      const z = Math.min(
        0.9,
        (w - 80) / GROUP_W,
        (h - 80) / Math.min(g.h, 1500)
      );
      // Big groups land on their first rows, not their middle.
      const cy = g.y + Math.min(g.h, 1500) / 2;
      flyTo(g.x + GROUP_W / 2, cy, z, false);
    },
    [anchor, flyTo, groups]
  );

  const fitAll = useCallback(
    (instant = false) => {
      const { w, h } = anchor(false);
      flyTo(
        width / 2,
        height / 2,
        Math.min((w - 48) / width, (h - 120) / height),
        false,
        instant
      );
    },
    [anchor, flyTo, height, width]
  );

  /** Buttons ease the zoom (200ms); the keyboard jumps, it repeats. */
  const zoomBy = useCallback(
    (factor: number, ms = 0) => {
      const el = viewport.current;
      if (!el) {
        return;
      }
      zoomAt(
        el.clientWidth / 2,
        el.clientHeight / 2,
        view.current.z * factor,
        ms
      );
    },
    [zoomAt]
  );

  const inView = useCallback(() => {
    const el = viewport.current;
    if (!el) {
      return;
    }
    const { x, y, z } = view.current;
    const names = boards
      .filter(
        (b) =>
          b.x * z + x >= -40 &&
          (b.x + BOARD_W) * z + x <= el.clientWidth + 40 &&
          b.y * z + y >= -40 &&
          (b.y + LABEL + b.h) * z + y <= el.clientHeight + 40
      )
      .slice(0, 12)
      .map((b) => b.part.name);
    if (names.length) {
      setSelection({ kind: "view", names });
    }
  }, [boards]);

  // First frame: open on the AI group, beside the intro.
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) {
      return;
    }
    const wide = el.clientWidth >= 1024;
    const z = wide ? 0.78 : Math.min(0.66, (el.clientWidth - 32) / BOARD_W);
    const ai = groups[0];
    view.current = {
      x: (wide ? 412 : 16) - (ai?.x ?? 0) * z,
      y: (wide ? 28 : 300) - (ai?.y ?? 0) * z,
      z,
    };
    apply();
    setReady(true);
  }, [apply, groups]);

  // Wheel: ctrl or a trackpad pinch zooms at the pointer, the rest pans.
  // Native so it can prevent the page from scrolling under the canvas.
  useEffect(() => {
    const el = viewport.current;
    if (!el) {
      return;
    }
    const onWheel = (e: WheelEvent) => {
      if ((e.target as Element).closest("[data-ui]")) {
        return;
      }
      e.preventDefault();
      stop();
      const line = e.deltaMode === 1 ? 16 : 1;
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        const d = Math.max(-60, Math.min(60, e.deltaY * line));
        zoomAt(
          e.clientX - r.left,
          e.clientY - r.top,
          view.current.z * Math.exp(-d * 0.01)
        );
        return;
      }
      const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
      const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
      view.current.x -= dx * line;
      view.current.y -= dy * line;
      clamp();
      apply();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      const typing = (e.target as Element).closest(
        "input, textarea, [contenteditable]"
      );
      if (e.key === " " && !typing && el.matches(":hover")) {
        if (e.type === "keydown") {
          e.preventDefault();
        }
        space.current = e.type === "keydown";
        el.dataset.grab = space.current ? "true" : "";
      }
    };
    const onResize = () => {
      clamp();
      apply();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frame.current);
      cancelAnimationFrame(motion.current);
    };
  }, [apply, clamp, stop, zoomAt]);

  // Dragging. One pointer pans from anywhere that isn't a running component
  // (or anywhere, holding space); two touches pinch, wherever they land.
  const drag = useRef<{
    id: number;
    sx: number;
    sy: number;
    lx: number;
    ly: number;
    lt: number;
    vx: number;
    vy: number;
    /** Where the camera would be without the edges' resistance. */
    rx: number;
    ry: number;
    moved: boolean;
    board: string | null;
  } | null>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const press = useRef<{ x: number; y: number; board: string | null } | null>(
    null
  );

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    const p = press.current;
    press.current = null;
    if (!p?.board) {
      return;
    }
    const r = viewport.current?.getBoundingClientRect();
    const x = e.clientX - (r?.left ?? 0);
    const y = e.clientY - (r?.top ?? 0);
    // The part's own controls keep working; a click anywhere else on the
    // artboard opens its docs.
    if (
      Math.hypot(x - p.x, y - p.y) < 6 &&
      !(e.target as Element).closest(CONTROLS)
    ) {
      openDocs(p.board);
    }
  };
  const pinch = useRef<{ d: number; z: number; mx: number; my: number } | null>(
    null
  );

  const local = (e: PointerEvent) => {
    const r = viewport.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  const pinchState = () => {
    const [a, b] = [...touches.current.values()];
    return {
      d: Math.hypot(a.x - b.x, a.y - b.y),
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2,
    };
  };

  const onPointerDownCapture = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") {
      return;
    }
    touches.current.set(e.pointerId, local(e));
    if (touches.current.size === 2) {
      stop();
      drag.current = null;
      const s = pinchState();
      pinch.current = { ...s, z: view.current.z };
      for (const id of touches.current.keys()) {
        viewport.current?.setPointerCapture(id);
      }
      e.stopPropagation();
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (pinch.current) {
      return;
    }
    const target = e.target as Element;
    if (target.closest("[data-ui]")) {
      return;
    }
    const pan = space.current || e.button === 1;
    const live = target.closest("[data-live]");
    if (!pan && live) {
      // A running part keeps its own pointer; a click on it (not a drag
      // inside it) still selects its artboard, on release.
      const p = local(e);
      press.current = {
        x: p.x,
        y: p.y,
        board: live.closest("[data-board]")?.getAttribute("data-board") ?? null,
      };
      return;
    }
    if (!pan && e.button !== 0) {
      return;
    }
    e.preventDefault();
    stop();
    const p = local(e);
    drag.current = {
      id: e.pointerId,
      sx: p.x,
      sy: p.y,
      lx: p.x,
      ly: p.y,
      lt: e.timeStamp,
      vx: 0,
      vy: 0,
      rx: view.current.x,
      ry: view.current.y,
      moved: false,
      board: target.closest("[data-board]")?.getAttribute("data-board") ?? null,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (pinch.current && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, local(e));
      const start = pinch.current;
      const now = pinchState();
      const v = view.current;
      const z = clampZ(start.z * (now.d / start.d));
      // The world point under the fingers' midpoint stays under it.
      const wx = (start.mx - v.x) / v.z;
      const wy = (start.my - v.y) / v.z;
      view.current = { x: now.mx - wx * z, y: now.my - wy * z, z };
      pinch.current = { ...start, mx: now.mx, my: now.my, z, d: now.d };
      clamp();
      apply();
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) {
      return;
    }
    const p = local(e);
    if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) > 4) {
      d.moved = true;
      viewport.current?.setAttribute("data-dragging", "true");
    }
    if (!d.moved) {
      return;
    }
    const dt = Math.max(1, e.timeStamp - d.lt);
    d.vx = (p.x - d.lx) / dt;
    d.vy = (p.y - d.ly) / dt;
    d.rx += p.x - d.lx;
    d.ry += p.y - d.ly;
    const b = bounds(view.current.z);
    view.current.x = band(d.rx, b.minX, b.maxX, b.vw);
    view.current.y = band(d.ry, b.minY, b.maxY, b.vh);
    d.lx = p.x;
    d.ly = p.y;
    d.lt = e.timeStamp;
    apply();
  };

  /** Pulled past an edge: settle back inside, quickly. */
  const settle = () => {
    const from = { ...view.current };
    clamp();
    const to = { ...view.current };
    view.current = from;
    if (from.x === to.x && from.y === to.y) {
      return false;
    }
    if (reduced()) {
      view.current = to;
      apply();
      return true;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 300);
      const k = EASE_OUT(t);
      view.current = {
        x: from.x + (to.x - from.x) * k,
        y: from.y + (to.y - from.y) * k,
        z: from.z,
      };
      apply();
      if (t < 1) {
        motion.current = requestAnimationFrame(tick);
      }
    };
    motion.current = requestAnimationFrame(tick);
    return true;
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (touches.current.delete(e.pointerId) && touches.current.size < 2) {
      pinch.current = null;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) {
      return;
    }
    drag.current = null;
    viewport.current?.removeAttribute("data-dragging");
    if (!d.moved) {
      if (d.board) {
        openDocs(d.board);
      }
      return;
    }
    if (settle()) {
      return;
    }
    // A flick keeps going, and slows the way a page does.
    if (reduced() || e.timeStamp - d.lt > 60) {
      return;
    }
    let { vx, vy } = d;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      view.current.x += vx * dt;
      view.current.y += vy * dt;
      const decay = 0.94 ** (dt / 16);
      vx *= decay;
      vy *= decay;
      clamp();
      apply();
      if (Math.hypot(vx, vy) > 0.02) {
        motion.current = requestAnimationFrame(tick);
      }
    };
    motion.current = requestAnimationFrame(tick);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) {
      return;
    }
    const pan = PAN[e.key];
    if (pan) {
      e.preventDefault();
      stop();
      view.current.x += pan[0] * 120;
      view.current.y += pan[1] * 120;
      clamp();
      apply();
    } else if (e.key === "+" || e.key === "=") {
      zoomBy(1.25);
    } else if (e.key === "-") {
      zoomBy(0.8);
    } else if (e.key === "0") {
      fitAll(true);
    }
  };

  const picked =
    selection?.kind === "view"
      ? selection.names.flatMap((n) => byName.get(n)?.part ?? [])
      : [];

  return (
    <div className="relative">
      <h1 className="sr-only">Kokonut UI: every component on one canvas</h1>
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: the canvas is the control; it pans and zooms with the pointer and keys */}
      <div
        aria-label="Component canvas. Arrow keys pan, plus and minus zoom, 0 shows everything."
        aria-roledescription="canvas"
        className={cn(
          "canvas-surface relative h-[calc(100svh-140px)] min-h-[540px] w-full touch-none select-none overflow-hidden border-black/[0.1] border-t dark:border-white/[0.12]",
          FOCUS_INSET
        )}
        onClickCapture={onClickCapture}
        onKeyDown={onKeyDown}
        onPointerCancel={onPointerUp}
        onPointerDown={onPointerDown}
        onPointerDownCapture={onPointerDownCapture}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={viewport}
        role="application"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so the arrow and zoom keys reach it
        tabIndex={0}
      >
        <div
          className={cn(
            "absolute top-0 left-0 origin-top-left transition-opacity duration-200 ease-out",
            ready ? "opacity-100" : "opacity-0"
          )}
          ref={world}
          style={{ width, height }}
        >
          <DitherField height={height} width={width} />
          {groups.map((g) => (
            <div
              className="pointer-events-none absolute"
              key={g.slug}
              style={{ left: g.x, top: g.y, width: GROUP_W }}
            >
              <p
                className={cn(
                  "font-semibold leading-none tracking-[-0.04em]",
                  INK
                )}
                style={{ fontSize: 150 }}
              >
                {g.title}
              </p>
              <p className={cn(MONO, "mt-6", SOFT)} style={{ fontSize: 34 }}>
                {g.count} components
              </p>
            </div>
          ))}
          {boards.map((b) => {
            const running = detail && live.has(b.part.name);
            const isSelected =
              selection?.kind === "one"
                ? selection.name === b.part.name
                : selection?.names.includes(b.part.name);
            return (
              <div
                className="absolute"
                data-board={b.part.name}
                key={b.part.name}
                style={{ left: b.x, top: b.y, width: BOARD_W }}
              >
                <button
                  className={cn(
                    "flex h-[34px] w-full items-center gap-2 text-left text-[13px]",
                    isSelected ? cn(INK, "font-medium") : SOFT,
                    FOCUS_INSET
                  )}
                  onClick={(e) => {
                    // Pointer clicks are handled on release, so a drag that
                    // starts on a label doesn't select it.
                    if (e.detail === 0) {
                      openDocs(b.part.name);
                    }
                  }}
                  type="button"
                >
                  <span className={cn(MONO, "text-[11.5px]", LEAF)}>
                    {b.part.code}
                  </span>
                  <span className="truncate">{b.part.title}</span>
                </button>
                <div
                  className={cn(
                    "relative bg-white outline-solid dark:bg-[#0b0b0b]",
                    isSelected
                      ? "outline-2 outline-black dark:outline-white"
                      : "outline-1 outline-black/[0.1] hover:outline-black/30 dark:outline-white/[0.12] dark:hover:outline-white/35",
                    "transition-[outline-color] duration-150 ease-out"
                  )}
                  data-live={running ? "" : undefined}
                  style={{ height: b.h }}
                >
                  {isSelected ? (
                    // Handles on the corners, as in a design tool: the
                    // selection reads at any zoom without a new color.
                    <span aria-hidden="true">
                      {HANDLES.map((corner) => (
                        <span
                          className={cn(
                            "absolute z-10 size-[9px] border-[1.5px] border-black bg-white dark:border-white dark:bg-black",
                            corner
                          )}
                          key={corner}
                        />
                      ))}
                    </span>
                  ) : null}
                  <div className="absolute inset-0 overflow-hidden">
                    {running ? (
                      // Arrives from a blur as it comes into view, so panning
                      // reveals parts instead of popping them in.
                      <div className="canvas-live-in absolute inset-0">
                        <Fit className="p-6">
                          <PartDemo part={b.part} />
                        </Fit>
                      </div>
                    ) : (
                      <div className="flex h-full cursor-pointer flex-col items-center justify-center gap-3 px-8 text-center">
                        <span
                          className="font-semibold text-black/30 leading-tight dark:text-white/30"
                          style={{ fontSize: 40 }}
                        >
                          {b.part.title}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {intro ? (
          <aside
            className={cn(
              PANEL,
              "canvas-panel-in absolute top-3 right-3 left-3 flex max-h-[calc(100%-96px)] flex-col overflow-y-auto p-5 md:right-auto md:w-[372px]"
            )}
            data-ui
          >
            <div className="flex items-start justify-between gap-4">
              <p className={META}>Kokonut UI · Free and open source</p>
              <button
                aria-label="Hide intro"
                className={cn(
                  "-mt-1 -mr-1 flex size-7 items-center justify-center rounded-full text-black/50 hover:bg-black/[0.06] hover:text-black dark:text-white/50 dark:hover:bg-white/[0.08] dark:hover:text-white",
                  EASE_COLORS,
                  FOCUS
                )}
                onClick={() => setIntro(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <p
              className={cn(
                "mt-3 font-semibold text-[26px] leading-[1.1] tracking-[-0.025em]",
                INK
              )}
            >
              Every component, running on one canvas.
            </p>
            <p className={cn("mt-3 text-[14px] leading-[1.55]", SOFT)}>
              Try any of the {parts.length} parts right here, then click one to
              open its docs: props, source and the line that installs it.
            </p>
            <div className="mt-5">
              <HeroActions count={parts.length} />
            </div>
            <p
              className={cn(
                META,
                "mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5"
              )}
            >
              <span>Works with</span>
              {AGENTS.filter((a) => a.id !== "vscode").map(
                ({ id, label, Mark, color }) => (
                  <span className="inline-flex items-center gap-1.5" key={id}>
                    <Mark className={cn("size-3.5 shrink-0", color)} />
                    {label}
                  </span>
                )
              )}
            </p>
            <p className={cn(META, "mt-4 hidden md:block")}>
              Drag to move · Scroll or pinch to zoom · Click for docs
            </p>
            <nav
              aria-label="Groups"
              className="mt-6 hidden flex-col border-black/[0.08] border-t pt-3 md:flex dark:border-white/[0.1]"
            >
              {groups.map((g) => (
                <button
                  className={cn(
                    "-mx-2 flex h-8 items-center justify-between rounded-[8px] px-2 text-[13px] hover:bg-black/[0.05] dark:hover:bg-white/[0.07]",
                    INK,
                    EASE_COLORS,
                    FOCUS_INSET
                  )}
                  key={g.slug}
                  onClick={() => focusGroup(g.slug)}
                  type="button"
                >
                  <span>{g.title}</span>
                  <span className={META}>{g.count}</span>
                </button>
              ))}
            </nav>
          </aside>
        ) : (
          <button
            className={cn(
              PANEL,
              "canvas-panel-in absolute top-3 left-3 h-9 px-3.5 font-medium text-[13px]",
              INK,
              FOCUS
            )}
            data-ui
            onClick={() => setIntro(true)}
            type="button"
          >
            Kokonut UI
          </button>
        )}

        {picked.length ? (
          <aside
            className={cn(
              PANEL,
              "canvas-panel-in absolute right-3 bottom-[68px] left-3 z-10 flex max-h-[60%] flex-col gap-4 overflow-y-auto p-5 md:top-3 md:bottom-auto md:left-auto md:max-h-[calc(100%-96px)] md:w-[372px]"
            )}
            data-ui
          >
            <div className="flex items-start justify-between gap-4">
              <p className={cn(META, "flex gap-3")}>
                <span>{picked.length} in view</span>
              </p>
              <button
                aria-label="Close"
                className={cn(
                  "-mt-1 -mr-1 flex size-7 items-center justify-center rounded-full text-black/50 hover:bg-black/[0.06] hover:text-black dark:text-white/50 dark:hover:bg-white/[0.08] dark:hover:text-white",
                  EASE_COLORS,
                  FOCUS
                )}
                onClick={() => setSelection(null)}
                type="button"
              >
                ×
              </button>
            </div>

            <p
              className={cn(
                "font-semibold text-[20px] leading-[1.2] tracking-[-0.02em]",
                INK
              )}
            >
              Everything on screen, in one ask.
            </p>
            <p className={cn("text-[13px] leading-[1.6]", SOFT)}>
              {picked.map((p) => p.title).join(", ")}
            </p>
            <InstallBar
              defaultWay="claude"
              key={picked.map((p) => p.name).join()}
              names={picked.map((p) => p.name)}
            />
          </aside>
        ) : null}

        <div
          className="absolute bottom-3 left-1/2 z-20 w-max max-w-[calc(100%-24px)] -translate-x-1/2"
          data-ui
        >
          {found.length ? (
            <ul
              className={cn(
                PANEL,
                "canvas-pop absolute right-0 bottom-full left-0 mb-2 flex flex-col p-1"
              )}
            >
              {found.map((p) => (
                <li key={p.name}>
                  <button
                    className={cn(
                      "flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13px] hover:bg-black/[0.05] dark:hover:bg-white/[0.07]",
                      INK,
                      EASE_COLORS,
                      FOCUS_INSET
                    )}
                    onClick={() => {
                      setQuery("");
                      focusBoard(p.name);
                    }}
                    type="button"
                  >
                    <span className={cn(MONO, "text-[11px]", LEAF)}>
                      {p.code}
                    </span>
                    <span className="truncate">{p.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className={cn(PANEL, "flex items-center gap-0.5 p-1")}>
            <ToolButton label="Zoom out" onClick={() => zoomBy(0.8, 200)}>
              −
            </ToolButton>
            <span
              className={cn(
                MONO,
                "w-11 text-center text-[11.5px] tabular-nums",
                SOFT
              )}
            >
              <span ref={zoomLabel}>100%</span>
            </span>
            <ToolButton label="Zoom in" onClick={() => zoomBy(1.25, 200)}>
              +
            </ToolButton>
            <ToolButton label="Show everything" onClick={() => fitAll()}>
              Fit
            </ToolButton>
            <span className="mx-1 h-5 w-px bg-black/[0.1] dark:bg-white/[0.12]" />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const first = found[0];
                if (first) {
                  setQuery("");
                  focusBoard(first.name);
                }
              }}
            >
              <label className="sr-only" htmlFor="canvas-find">
                Find a component
              </label>
              <input
                autoComplete="off"
                className={cn(
                  "h-8 w-[112px] rounded-[9px] bg-black/[0.04] px-2.5 text-[13px] outline-none placeholder:text-black/45 focus:bg-black/[0.07] sm:w-[200px] dark:bg-white/[0.06] dark:focus:bg-white/[0.1] dark:placeholder:text-white/45",
                  INK,
                  EASE_COLORS
                )}
                id="canvas-find"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setQuery("");
                  }
                }}
                placeholder="Find: seat, toast, pay…"
                value={query}
              />
            </form>
            <span className="mx-1 h-5 w-px bg-black/[0.1] dark:bg-white/[0.12]" />
            <ToolButton
              className="whitespace-nowrap font-medium text-black dark:text-white"
              label="Add everything in view"
              onClick={inView}
            >
              <span className="sm:hidden">Add view</span>
              <span className="hidden sm:inline">Add what's in view</span>
            </ToolButton>
          </div>
        </div>
      </div>
    </div>
  );
}
