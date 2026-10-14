"use client";

/**
 * @author: @dorianbaffier
 * @description: Glitch Text (Signal Text). Flat text that bursts into hard-cut
 * horizontal bands with a thin red/cyan channel split, on idle, hover, or as
 * the transition to new text.
 * @version: 2.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import type { CSSProperties, PointerEvent } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

/**
 * - `idle`: a burst every 4-9s while on screen, plus on text changes.
 * - `hover`: a burst on pointer enter (or tap), plus on text changes.
 * - `change`: only text changes glitch; the burst is the transition.
 */
export type GlitchTextTrigger = "idle" | "hover" | "change";

export type GlitchTextIntensity = "subtle" | "medium" | "strong";

export interface GlitchTextProps {
  /** Text to render. Changing it glitches over to the new text. */
  text?: string;
  /** What starts a burst. Defaults to `idle`. */
  trigger?: GlitchTextTrigger;
  /** Band count, displacement and channel split. Defaults to `medium`. */
  intensity?: GlitchTextIntensity;
  /** Color of the leading channel during a burst. The other one is cyan. */
  accent?: string;
  className?: string;
  /** Root element. A span by default, so it also fits inside a heading. */
  as?: "span" | "div" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

interface Settings {
  /** Horizontal bands the text is cut into. */
  bands: number;
  /** Max sideways jump of a band, in em (so it scales with the font). */
  shift: number;
  /** Max red/cyan channel offset, in px. */
  split: number;
  /** Hard-cut frames per burst. */
  frames: number;
  /** Length of one frame, in ms. */
  frame: number;
}

const INTENSITY: Record<GlitchTextIntensity, Settings> = {
  subtle: { bands: 3, shift: 0.05, split: 1, frames: 5, frame: 55 },
  medium: { bands: 4, shift: 0.12, split: 2, frames: 6, frame: 55 },
  strong: { bands: 5, shift: 0.18, split: 3, frames: 7, frame: 50 },
};

const MAX_BANDS = 5;
const BAND_IDS = Array.from({ length: MAX_BANDS }, (_, i) => `band-${i}`);
const DEFAULT_ACCENT = "oklch(0.63 0.24 25)";
const CYAN = "oklch(0.78 0.14 205)";
// Each keyframe holds until the next one: a glitch cuts, it doesn't glide.
const HOLD = "steps(1, end)";
const FIRST_IDLE = 1200;
const IDLE_MIN = 4000;
const IDLE_SPREAD = 5000;
// Chance that a band stays put on a given frame, so the cut reads as broken
// signal rather than a uniform shake.
const STILL_CHANCE = 0.3;

const round = (n: number) => Math.round(n * 1000) / 1000;

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Keyframes that hold each value for one frame, then end on the last one. */
const held = (frames: Keyframe[]): Keyframe[] => [
  ...frames.map((k, i) => ({ ...k, offset: i / frames.length, easing: HOLD })),
  { ...frames.at(-1), offset: 1 },
];

/** Random band boundaries from 0 to 100%, no band much thinner than another. */
const randomCuts = (count: number) => {
  const weights = Array.from({ length: count }, () => 0.55 + Math.random());
  const total = weights.reduce((a, b) => a + b, 0);
  const cuts = [0];
  for (const w of weights) {
    cuts.push(round((cuts.at(-1) ?? 0) + (w / total) * 100));
  }
  return cuts;
};

const jump = (max: number) => {
  if (Math.random() < STILL_CHANCE) {
    return 0;
  }
  const sign = Math.random() < 0.5 ? -1 : 1;
  return round(sign * (0.25 + 0.75 * Math.random()) * max);
};

/** Sideways positions of one band: off on frame one, home on the last. */
const bandPath = (s: Settings, forceMove: boolean) =>
  Array.from({ length: s.frames }, (_, f) => {
    if (f === s.frames - 1) {
      return 0;
    }
    const x = jump(s.shift);
    return f === 0 && forceMove && x === 0 ? round(s.shift * 0.6) : x;
  });

interface Shown {
  /** Text the bands show first during a change burst. */
  from: string | null;
  to: string;
  /** Bumped on every text change. */
  id: number;
}

const LAYER = "col-start-1 row-start-1 grid";
const TEXT = "col-start-1 row-start-1";
const GHOST = "pointer-events-none select-none opacity-0";

function LayerText({ from, to }: { from: string | null; to: string }) {
  return (
    <>
      {from !== null && (
        <span className={cn(TEXT, "opacity-0")} data-text="from">
          {from}
        </span>
      )}
      <span className={TEXT} data-text="to">
        {to}
      </span>
    </>
  );
}

const GlitchText = ({
  text = "Signal Text",
  trigger = "idle",
  intensity = "medium",
  accent = DEFAULT_ACCENT,
  className,
  as: Root = "span",
}: GlitchTextProps) => {
  const layersRef = useRef<HTMLSpanElement>(null);
  const animsRef = useRef<Animation[]>([]);
  const runningRef = useRef(false);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  const [shown, setShown] = useState<Shown>({ from: null, to: text, id: 0 });
  if (shown.to !== text) {
    setShown({ from: shown.to, to: text, id: shown.id + 1 });
  }

  const stop = useCallback(() => {
    for (const a of animsRef.current) {
      a.cancel();
    }
    animsRef.current = [];
    runningRef.current = false;
  }, []);

  /** Runs one burst. With `swap`, the bands cut from old text to new midway. */
  const burst = useCallback(
    (swap: boolean, onDone?: () => void) => {
      const root = layersRef.current;
      if (!root) {
        return;
      }
      stop();
      const s = INTENSITY[intensityRef.current];
      const opts: KeyframeAnimationOptions = {
        duration: s.frames * s.frame,
        fill: "none",
      };
      const anims: Animation[] = [];
      const run = (el: Element, frames: Keyframe[]) => {
        anims.push(el.animate(held(frames), opts));
      };

      const base = root.querySelector('[data-layer="base"]');
      if (base) {
        run(base, [{ opacity: 0 }]);
      }

      // The bands tile the text top to bottom, so at rest they rebuild it.
      // The outer edges reach past the box to keep ascenders and descenders.
      const cuts = randomCuts(s.bands);
      const bands = root.querySelectorAll<HTMLElement>('[data-layer="band"]');
      const mover = Math.floor(Math.random() * s.bands);
      bands.forEach((band, i) => {
        if (i >= s.bands) {
          return;
        }
        const top = i === 0 ? -50 : cuts[i];
        const bottom = i === s.bands - 1 ? -50 : round(100 - cuts[i + 1]);
        band.style.clipPath = `inset(${top}% -25% ${bottom}% -25%)`;
        run(
          band,
          bandPath(s, i === mover).map((x) => ({
            opacity: 1,
            transform: `translate3d(${x}em, 0, 0)`,
          }))
        );
      });

      // Red and cyan copies sit behind the bands and peek out on either side.
      const channels = root.querySelectorAll('[data-layer="channel"]');
      const offsets = Array.from({ length: s.frames }, () =>
        Math.max(1, Math.ceil(Math.random() * s.split))
      );
      channels.forEach((channel, c) => {
        const dir = c === 0 ? -1 : 1;
        run(
          channel,
          offsets.map((d, f) => ({
            opacity: f === s.frames - 1 ? 0 : 1,
            transform: `translate3d(${dir * d}px, 0, 0)`,
          }))
        );
      });

      if (swap) {
        const half = Math.ceil(s.frames / 2);
        const flip = (selector: string, before: number) => {
          for (const el of root.querySelectorAll(selector)) {
            run(
              el,
              Array.from({ length: s.frames }, (_, f) => ({
                opacity: f < half ? before : 1 - before,
              }))
            );
          }
        };
        flip('[data-layer]:not([data-layer="base"]) [data-text="from"]', 1);
        flip('[data-layer]:not([data-layer="base"]) [data-text="to"]', 0);
      }

      animsRef.current = anims;
      runningRef.current = true;
      const last = anims.at(-1);
      if (last) {
        last.onfinish = () => {
          animsRef.current = [];
          runningRef.current = false;
          onDone?.();
        };
      }
    },
    [stop]
  );

  // Text changed: the burst is the transition. A layout effect, so the new
  // text never paints clean before the bands take over.
  useLayoutEffect(() => {
    if (shown.from === null) {
      return;
    }
    const id = shown.id;
    const settle = () =>
      setShown((s) => (s.id === id ? { ...s, from: null } : s));
    if (prefersReducedMotion()) {
      settle();
      return;
    }
    burst(true, settle);
  }, [shown.from, shown.id, burst]);

  // Idle: a rare burst every 4-9s, only while on screen and the tab is visible.
  useEffect(() => {
    const root = layersRef.current;
    if (trigger !== "idle" || !root) {
      return;
    }
    let visible = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (
          !(document.hidden || runningRef.current || prefersReducedMotion())
        ) {
          burst(false);
        }
        schedule(IDLE_MIN + Math.random() * IDLE_SPREAD);
      }, delay);
    };
    const update = () => {
      if (visible && !document.hidden) {
        if (timer === undefined) {
          schedule(FIRST_IDLE);
        }
      } else {
        clearTimeout(timer);
        timer = undefined;
      }
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      update();
    });
    io.observe(root);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
      clearTimeout(timer);
    };
  }, [trigger, burst]);

  useEffect(() => stop, [stop]);

  const onPointer = (e: PointerEvent) => {
    // Mouse bursts on enter; touch and pen burst on press, since they can't hover.
    const isMouse = e.pointerType === "mouse";
    if (
      trigger !== "hover" ||
      (e.type === "pointerenter") !== isMouse ||
      runningRef.current ||
      prefersReducedMotion()
    ) {
      return;
    }
    burst(false);
  };

  const { from, to } = shown;

  return (
    <Root
      className={cn(
        "relative inline-block text-zinc-900 dark:text-zinc-100",
        className
      )}
      onPointerDown={onPointer}
      onPointerEnter={onPointer}
      style={{ "--glitch-accent": accent } as CSSProperties}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="relative inline-grid" ref={layersRef}>
        <span
          className={cn(LAYER, GHOST)}
          data-layer="channel"
          style={{ color: "var(--glitch-accent)" }}
        >
          <LayerText from={from} to={to} />
        </span>
        <span
          className={cn(LAYER, GHOST)}
          data-layer="channel"
          style={{ color: CYAN }}
        >
          <LayerText from={from} to={to} />
        </span>
        <span className={LAYER} data-layer="base">
          <LayerText from={from} to={to} />
        </span>
        {BAND_IDS.map((id) => (
          <span className={cn(LAYER, GHOST)} data-layer="band" key={id}>
            <LayerText from={from} to={to} />
          </span>
        ))}
      </span>
    </Root>
  );
};

export default GlitchText;
