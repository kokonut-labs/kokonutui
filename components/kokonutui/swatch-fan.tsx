"use client";

/**
 * @author: @dorianbaffier
 * @description: Swatch Fan
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, Copy } from "lucide-react";
import {
  AnimatePresence,
  animate,
  MotionConfig,
  type MotionValue,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface SwatchHue {
  name: string;
  shades: { label: string; hex: string }[];
}

export interface SwatchColor {
  /** `hue-shade`, such as `sky-500`. */
  id: string;
  name: string;
  hex: string;
}

const DEFAULT_PALETTE: SwatchHue[] = [
  ["Slate", ["#e2e8f0", "#94a3b8", "#64748b", "#475569", "#1e293b"]],
  ["Red", ["#fecaca", "#f87171", "#ef4444", "#dc2626", "#991b1b"]],
  ["Orange", ["#fed7aa", "#fb923c", "#f97316", "#ea580c", "#9a3412"]],
  ["Amber", ["#fde68a", "#fbbf24", "#f59e0b", "#d97706", "#92400e"]],
  ["Emerald", ["#a7f3d0", "#34d399", "#10b981", "#059669", "#065f46"]],
  ["Sky", ["#bae6fd", "#38bdf8", "#0ea5e9", "#0284c7", "#075985"]],
  ["Indigo", ["#c7d2fe", "#818cf8", "#6366f1", "#4f46e5", "#3730a3"]],
  ["Violet", ["#ddd6fe", "#a78bfa", "#8b5cf6", "#7c3aed", "#5b21b6"]],
  ["Pink", ["#fbcfe8", "#f472b6", "#ec4899", "#db2777", "#9d174d"]],
].map(([name, hexes]) => ({
  name: name as string,
  shades: (hexes as string[]).map((hex, i) => ({
    label: ["200", "400", "500", "600", "800"][i],
    hex,
  })),
}));

const BLADE_WIDTH = 48;
const CHIP_HEIGHT = 30;
const LABEL_HEIGHT = 40;
// The rivet sits this far above the bottom edge of every blade.
const PIVOT = 18;
// Pixels of horizontal drag that take the fan from shut to fully open.
const DRAG_RANGE = 160;
const DRAG_THRESHOLD = 4;
// A shut deck still shows a sliver of each blade's edge.
const SHUT_STEP = 0.8;
const PULL_OUT = 16;
const PEEK = 6;
const SPRING = { type: "spring", stiffness: 320, damping: 32 } as const;

const slug = (s: string) => s.toLowerCase().replace(/\s+/g, "-");
const colorId = (hue: SwatchHue, shade: number) =>
  `${slug(hue.name)}-${hue.shades[shade].label}`;

const locate = (palette: SwatchHue[], id: string) => {
  for (let h = 0; h < palette.length; h++) {
    for (let s = 0; s < palette[h].shades.length; s++) {
      if (colorId(palette[h], s) === id) {
        return { hue: h, shade: s };
      }
    }
  }
  return { hue: 0, shade: 0 };
};

// Past either end the fan gives a little, then stops.
const resist = (p: number) => {
  if (p > 1) {
    return 1 + Math.tanh((p - 1) * 2) * 0.06;
  }
  if (p < 0) {
    return Math.tanh(p * 2) * 0.04;
  }
  return p;
};

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface SwatchFanProps {
  /** Controlled color id, such as `sky-500`. */
  value?: string;
  defaultValue?: string;
  onChange?: (color: SwatchColor) => void;
  palette?: SwatchHue[];
  /** Degrees between the outermost blades when fully open. */
  spread?: number;
  defaultOpen?: boolean;
  className?: string;
}

export default function SwatchFan({
  value: valueProp,
  defaultValue = "indigo-500",
  onChange,
  palette = DEFAULT_PALETTE,
  spread = 96,
  defaultOpen = false,
  className,
}: SwatchFanProps) {
  const [internal, setInternal] = useState(defaultValue);
  const value = valueProp ?? internal;
  const selected = locate(palette, value);
  const [open, setOpen] = useState(defaultOpen);
  const [peek, setPeek] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const progress = useMotionValue(defaultOpen ? 1 : 0);

  const chips = useRef(new Map<string, HTMLButtonElement>());
  const drag = useRef({ id: -1, x: 0, from: 0, moved: false, lastDx: 0 });
  const copyTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const settle = (target: 0 | 1) => {
    setOpen(target === 1);
    animate(progress, target, reducedMotion() ? { duration: 0 } : SPRING);
  };

  const select = (hue: number, shade: number) => {
    const h = palette[hue];
    const id = colorId(h, shade);
    if (valueProp === undefined) {
      setInternal(id);
    }
    onChange?.({
      id,
      name: `${h.name} ${h.shades[shade].label}`,
      hex: h.shades[shade].hex,
    });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    progress.stop();
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      from: progress.get(),
      moved: false,
      lastDx: 0,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d.id !== event.pointerId) {
      return;
    }
    const dx = event.clientX - d.x;
    if (!d.moved && Math.abs(dx) < DRAG_THRESHOLD) {
      return;
    }
    if (!d.moved) {
      d.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setPeek(null);
    }
    d.lastDx = event.movementX || d.lastDx;
    progress.set(resist(d.from + dx / DRAG_RANGE));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d.id !== event.pointerId) {
      return;
    }
    d.id = -1;
    if (!d.moved) {
      return;
    }
    // A flick decides on its own; a slow drag goes to the nearer end.
    const p = progress.get();
    let target: 0 | 1 = p > 0.5 ? 1 : 0;
    if (Math.abs(d.lastDx) > 2) {
      target = d.lastDx > 0 ? 1 : 0;
    }
    settle(target);
  };

  const onChipClick = (hue: number, shade: number) => {
    // The click that ends a drag isn't a pick.
    if (drag.current.moved) {
      drag.current.moved = false;
      return;
    }
    // A shut deck opens first, so nothing gets picked blind.
    if (!open) {
      settle(1);
      return;
    }
    select(hue, shade);
  };

  const focusChip = (hue: number, shade: number) => {
    chips.current.get(colorId(palette[hue], shade))?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      const hue = Math.max(
        0,
        Math.min(palette.length - 1, selected.hue + move[0])
      );
      const shades = palette[hue].shades.length;
      const shade = Math.max(0, Math.min(shades - 1, selected.shade + move[1]));
      select(hue, shade);
      focusChip(hue, shade);
    } else if (event.key === "Escape" && open) {
      settle(0);
    }
  };

  const copy = () => {
    const hex = palette[selected.hue].shades[selected.shade].hex;
    navigator.clipboard?.writeText(hex).then(
      () => {
        setCopied(true);
        window.clearTimeout(copyTimer.current);
        copyTimer.current = window.setTimeout(() => setCopied(false), 1400);
      },
      () => setCopied(false)
    );
  };

  const hue = palette[selected.hue];
  const shade = hue.shades[selected.shade];
  const bladeHeight = hue.shades.length * CHIP_HEIGHT + LABEL_HEIGHT + 8;

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("flex flex-col items-center gap-5", className)}>
        <div
          aria-label="Color"
          className="relative w-[340px] max-w-full touch-pan-y select-none"
          onFocus={(event) => {
            // Tabbing in opens the deck; a press is handled by the drag.
            if (!open && event.target.matches(":focus-visible")) {
              settle(1);
            }
          }}
          onKeyDown={onKeyDown}
          onPointerCancel={onPointerUp}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          role="radiogroup"
          style={{ height: bladeHeight + PULL_OUT + 8 }}
        >
          {palette.map((h, i) => (
            <Blade
              closedAngle={(i - (palette.length - 1) / 2) * SHUT_STEP}
              height={bladeHeight}
              hue={h}
              index={i}
              key={h.name}
              lift={liftFor(i, selected.hue, peek)}
              onChipClick={onChipClick}
              onPeek={setPeek}
              openAngle={(i / (palette.length - 1) - 0.5) * spread}
              progress={progress}
              register={(id, el) => {
                if (el) {
                  chips.current.set(id, el);
                } else {
                  chips.current.delete(id);
                }
              }}
              selectedShade={i === selected.hue ? selected.shade : -1}
              zIndex={i === selected.hue ? palette.length + 1 : i}
            />
          ))}
          <button
            aria-label={open ? "Close fan" : "Open fan"}
            className="absolute left-1/2 z-50 size-4 -translate-x-1/2 translate-y-1/2 rounded-full border border-zinc-300 bg-zinc-100 shadow-sm outline-none transition-colors duration-150 ease-out hover:bg-white focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-700 dark:hover:bg-zinc-600"
            onClick={() => settle(open ? 0 : 1)}
            style={{ bottom: PIVOT }}
            tabIndex={-1}
            type="button"
          />
        </div>

        <div className="flex h-9 items-center gap-3 rounded-full border border-zinc-200 py-1 pr-1 pl-1.5 dark:border-zinc-800">
          <span
            className="size-6 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] transition-colors duration-200 ease-out"
            style={{ backgroundColor: shade.hex }}
          />
          <span className="relative flex min-w-32 items-baseline gap-2 overflow-hidden text-sm">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                className="flex items-baseline gap-2 whitespace-nowrap"
                exit={{ opacity: 0, y: -6, filter: "blur(2px)" }}
                initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
                key={value}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              >
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {hue.name} {shade.label}
                </span>
                <span className="font-mono text-xs text-zinc-500 uppercase dark:text-zinc-400">
                  {shade.hex}
                </span>
              </motion.span>
            </AnimatePresence>
          </span>
          <button
            aria-label={copied ? "Copied" : `Copy ${shade.hex}`}
            className="flex size-7 items-center justify-center rounded-full text-zinc-500 outline-none transition-colors duration-150 ease-out hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 active:bg-zinc-200 dark:text-zinc-400 dark:active:bg-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            onClick={copy}
            type="button"
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ opacity: 1, filter: "blur(0px)" }}
                className="flex"
                exit={{ opacity: 0, filter: "blur(2px)" }}
                initial={{ opacity: 0, filter: "blur(2px)" }}
                key={copied ? "check" : "copy"}
                transition={{ duration: 0.15 }}
              >
                {copied ? (
                  <Check className="size-3.5" strokeWidth={2.5} />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>
    </MotionConfig>
  );
}

// The picked blade slides out of the deck; a hovered one peeks.
function liftFor(index: number, selectedHue: number, peek: number | null) {
  if (index === selectedHue) {
    return PULL_OUT;
  }
  return index === peek ? PEEK : 0;
}

function Blade({
  hue,
  index,
  height,
  closedAngle,
  openAngle,
  progress,
  lift,
  zIndex,
  selectedShade,
  onChipClick,
  onPeek,
  register,
}: {
  hue: SwatchHue;
  index: number;
  height: number;
  closedAngle: number;
  openAngle: number;
  progress: MotionValue<number>;
  lift: number;
  zIndex: number;
  selectedShade: number;
  onChipClick: (hue: number, shade: number) => void;
  onPeek: (hue: number | null) => void;
  register: (id: string, el: HTMLButtonElement | null) => void;
}) {
  const rotate = useTransform(
    progress,
    (p) => closedAngle + (openAngle - closedAngle) * p
  );

  return (
    <motion.div
      className="absolute bottom-0 left-1/2"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          onPeek(index);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") {
          onPeek(null);
        }
      }}
      style={{
        width: BLADE_WIDTH,
        height,
        marginLeft: -BLADE_WIDTH / 2,
        rotate,
        transformOrigin: `50% calc(100% - ${PIVOT}px)`,
        zIndex,
      }}
    >
      <motion.div
        animate={{ y: -lift }}
        className="flex h-full flex-col gap-0.5 rounded-xl border border-zinc-200 bg-white p-1 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_-4px_rgb(0_0_0/0.08)] dark:border-zinc-800 dark:bg-zinc-900"
        initial={false}
        transition={SPRING}
      >
        {hue.shades.map((shade, s) => {
          const id = colorId(hue, s);
          const picked = s === selectedShade;
          return (
            // biome-ignore lint/a11y/useSemanticElements: a colored chip on a rotated blade; a native radio can't be styled to fill it
            <button
              aria-checked={picked}
              aria-label={`${hue.name} ${shade.label}, ${shade.hex}`}
              className="relative flex w-full shrink-0 items-center justify-center rounded-md outline-none first:rounded-t-lg focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 dark:focus-visible:ring-white dark:focus-visible:ring-offset-zinc-900"
              key={shade.label}
              onClick={() => onChipClick(index, s)}
              ref={(el) => register(id, el)}
              role="radio"
              style={{ height: CHIP_HEIGHT, backgroundColor: shade.hex }}
              tabIndex={picked ? 0 : -1}
              type="button"
            >
              <AnimatePresence initial={false}>
                {picked && (
                  <motion.span
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "size-2 rounded-full",
                      s < 2 ? "bg-zinc-900/70" : "bg-white"
                    )}
                    exit={{ opacity: 0, scale: 0.5 }}
                    initial={{ opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.15 }}
                  />
                )}
              </AnimatePresence>
            </button>
          );
        })}
        <span className="mt-auto flex flex-col items-center pb-5 font-medium text-[9px] text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
          {hue.name}
        </span>
      </motion.div>
    </motion.div>
  );
}
