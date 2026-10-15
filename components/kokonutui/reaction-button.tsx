"use client";

/**
 * @author: @dorianbaffier
 * @description: Reaction Button
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  Heart,
  Laugh,
  Lightbulb,
  type LucideIcon,
  PartyPopper,
  ThumbsUp,
} from "lucide-react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  type Variants,
} from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
// Press and hold this long to open the tray instead of liking.
const HOLD_DELAY = 350;
// A resting mouse opens the tray too, the way desktop feeds do.
const HOVER_DELAY = 500;
const HOVER_CLOSE_DELAY = 300;
// How far above or below the tray a sliding finger still counts as on it.
const SLOP_Y = 32;

export interface Reaction {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Text color for the icon and label once picked. */
  color: string;
  /** Background of the icon's bubble in the tray. */
  tint: string;
}

const DEFAULT_REACTIONS: Reaction[] = [
  {
    id: "like",
    label: "Like",
    icon: ThumbsUp,
    color: "text-blue-600 dark:text-blue-400",
    tint: "bg-blue-50 dark:bg-blue-500/15",
  },
  {
    id: "love",
    label: "Love",
    icon: Heart,
    color: "text-rose-600 dark:text-rose-400",
    tint: "bg-rose-50 dark:bg-rose-500/15",
  },
  {
    id: "celebrate",
    label: "Celebrate",
    icon: PartyPopper,
    color: "text-amber-600 dark:text-amber-400",
    tint: "bg-amber-50 dark:bg-amber-500/15",
  },
  {
    id: "insightful",
    label: "Insightful",
    icon: Lightbulb,
    color: "text-yellow-600 dark:text-yellow-400",
    tint: "bg-yellow-50 dark:bg-yellow-500/15",
  },
  {
    id: "funny",
    label: "Funny",
    icon: Laugh,
    color: "text-emerald-600 dark:text-emerald-400",
    tint: "bg-emerald-50 dark:bg-emerald-500/15",
  },
];

const ROLL: Variants = {
  enter: (dir: number) => ({ y: `${dir * 80}%`, opacity: 0 }),
  center: { y: "0%", opacity: 1 },
  exit: (dir: number) => ({ y: `${dir * -80}%`, opacity: 0 }),
};

const TRAY: Variants = {
  closed: { opacity: 0, y: 6, scale: 0.96, filter: "blur(2px)" },
  open: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.2,
      ease: EASE_OUT,
      when: "beforeChildren",
      staggerChildren: 0.03,
    },
  },
  exit: {
    opacity: 0,
    y: 4,
    scale: 0.98,
    filter: "blur(2px)",
    transition: { duration: 0.15, ease: EASE_OUT },
  },
};

const ITEM: Variants = {
  closed: { opacity: 0, y: 10 },
  open: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 500, damping: 28 },
  },
};

const formatCount = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n);

const inside = (rect: DOMRect, x: number, y: number) =>
  x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

export interface ReactionButtonProps {
  /** Controlled reaction id, or `null` for none. */
  reaction?: string | null;
  defaultReaction?: string | null;
  onReactionChange?: (reaction: string | null) => void;
  /** Reactions from everyone else; yours is added on top. */
  count?: number;
  reactions?: Reaction[];
  className?: string;
}

export default function ReactionButton({
  reaction: reactionProp,
  defaultReaction = null,
  onReactionChange,
  count = 24,
  reactions = DEFAULT_REACTIONS,
  className,
}: ReactionButtonProps) {
  const [internal, setInternal] = useState<string | null>(defaultReaction);
  const reaction = reactionProp === undefined ? internal : reactionProp;
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [direction, setDirection] = useState(1);
  // Where the picked icon was in the tray, so it can fly into the button.
  const [flight, setFlight] = useState<{ x: number; y: number } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const items = useRef(new Map<string, HTMLButtonElement>());
  const press = useRef({ timer: 0, dragging: false, active: false });
  const hover = useRef({ open: 0, close: 0 });

  const current = reactions.find((r) => r.id === reaction) ?? null;
  const like = reactions[0];
  const total = count + (reaction ? 1 : 0);

  useEffect(
    () => () => {
      window.clearTimeout(press.current.timer);
      window.clearTimeout(hover.current.open);
      window.clearTimeout(hover.current.close);
    },
    []
  );

  // A press anywhere else closes the tray.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (event: globalThis.PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setHovered(null);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const commit = (next: string | null) => {
    if (next === reaction) {
      return;
    }
    setDirection(next && !reaction ? 1 : -1);
    if (reactionProp === undefined) {
      setInternal(next);
    }
    onReactionChange?.(next);
  };

  const close = () => {
    setOpen(false);
    setHovered(null);
    press.current.dragging = false;
  };

  const pick = (id: string) => {
    const from = items.current.get(id)?.getBoundingClientRect();
    const to = iconRef.current?.getBoundingClientRect();
    setFlight(
      from && to
        ? {
            x: from.left + from.width / 2 - (to.left + to.width / 2),
            y: from.top + from.height / 2 - (to.top + to.height / 2),
          }
        : null
    );
    // Picking the reaction you already have takes it back.
    commit(id === reaction ? null : id);
    // A keyboard pick hands focus back before the tray unmounts.
    if (trayRef.current?.contains(document.activeElement)) {
      buttonRef.current?.focus();
    }
    close();
  };

  const toggle = () => {
    setFlight(null);
    commit(reaction ? null : like.id);
    close();
  };

  const itemAt = (x: number, y: number) => {
    const tray = trayRef.current?.getBoundingClientRect();
    if (!tray || y < tray.top - SLOP_Y || y > tray.bottom + SLOP_Y) {
      return null;
    }
    for (const [id, el] of items.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left - 2 && x <= r.right + 2) {
        return id;
      }
    }
    return null;
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    window.clearTimeout(hover.current.open);
    press.current = { timer: 0, dragging: false, active: true };
    press.current.timer = window.setTimeout(() => {
      press.current.dragging = true;
      setOpen(true);
    }, HOLD_DELAY);
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (press.current.dragging) {
      setHovered(itemAt(event.clientX, event.clientY));
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (!press.current.active) {
      return;
    }
    window.clearTimeout(press.current.timer);
    press.current.active = false;
    if (!press.current.dragging) {
      toggle();
      return;
    }
    press.current.dragging = false;
    const target = itemAt(event.clientX, event.clientY);
    const onButton = buttonRef.current
      ? inside(
          buttonRef.current.getBoundingClientRect(),
          event.clientX,
          event.clientY
        )
      : false;
    if (target) {
      pick(target);
    } else if (onButton) {
      // Let go without sliding: the tray stays for a tap or a click.
      setHovered(null);
    } else {
      close();
    }
  };

  const onPointerCancel = () => {
    window.clearTimeout(press.current.timer);
    press.current.active = false;
    close();
  };

  const onHoverEnter = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") {
      return;
    }
    window.clearTimeout(hover.current.close);
    if (!open) {
      hover.current.open = window.setTimeout(() => setOpen(true), HOVER_DELAY);
    }
  };

  const onHoverLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || press.current.active) {
      return;
    }
    window.clearTimeout(hover.current.open);
    hover.current.close = window.setTimeout(close, HOVER_CLOSE_DELAY);
  };

  const focusItem = (index: number) => {
    const id = reactions[(index + reactions.length) % reactions.length].id;
    items.current.get(id)?.focus();
    setHovered(id);
  };

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    setOpen(true);
    const start = Math.max(
      0,
      reactions.findIndex((r) => r.id === reaction)
    );
    requestAnimationFrame(() => focusItem(start));
  };

  const onTrayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = reactions.findIndex((r) => r.id === hovered);
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      focusItem(index + (event.key === "ArrowRight" ? 1 : -1));
    } else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      close();
      buttonRef.current?.focus();
    }
  };

  const Icon = current?.icon ?? like.icon;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn("relative inline-flex", className)}
        onPointerEnter={onHoverEnter}
        onPointerLeave={onHoverLeave}
        ref={wrapRef}
      >
        <AnimatePresence>
          {open && (
            <motion.div
              animate="open"
              aria-label="Reactions"
              className="absolute bottom-full left-0 z-10 mb-2 flex origin-bottom-left gap-0.5 rounded-full border border-zinc-200 bg-white p-1 shadow-lg shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20"
              exit="exit"
              initial="closed"
              onKeyDown={onTrayKeyDown}
              ref={trayRef}
              role="menu"
              variants={TRAY}
            >
              {reactions.map((r) => (
                <TrayItem
                  checked={r.id === reaction}
                  hovered={hovered === r.id}
                  key={r.id}
                  onHover={setHovered}
                  onPick={pick}
                  reaction={r}
                  register={(el) => {
                    if (el) {
                      items.current.set(r.id, el);
                    } else {
                      items.current.delete(r.id);
                    }
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`${current?.label ?? "Like"}, ${total} reactions. Press and hold, or arrow up, for more reactions.`}
          aria-pressed={reaction !== null}
          className="flex h-9 touch-none select-none items-center gap-2 rounded-full border border-zinc-200 bg-white pr-3 pl-2.5 text-sm outline-none transition-colors duration-150 ease-out [-webkit-touch-callout:none] hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 active:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:active:bg-zinc-800 dark:hover:bg-zinc-900"
          onClick={(event) => {
            // Keyboard presses click without a pointer.
            if (event.detail === 0) {
              toggle();
            }
          }}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={onButtonKeyDown}
          onPointerCancel={onPointerCancel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          ref={buttonRef}
          type="button"
        >
          <span className="relative flex size-4" ref={iconRef}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                className={cn(
                  "flex",
                  current ? current.color : "text-zinc-500 dark:text-zinc-400"
                )}
                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.1 } }}
                initial={
                  flight
                    ? { x: flight.x, y: flight.y, opacity: 1, scale: 1.25 }
                    : { opacity: 0, scale: 0.8, rotate: current ? -15 : 0 }
                }
                key={current?.id ?? "none"}
                transition={
                  flight
                    ? { type: "spring", stiffness: 420, damping: 30 }
                    : { duration: 0.2, ease: EASE_OUT }
                }
              >
                <Icon
                  className="size-4"
                  fill={current ? "currentColor" : "none"}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </motion.span>
            </AnimatePresence>
          </span>
          <span
            className={cn(
              "font-medium transition-colors duration-200 ease-out",
              current ? current.color : "text-zinc-700 dark:text-zinc-300"
            )}
          >
            {current?.label ?? "Like"}
          </span>
          <span className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
          <span className="relative flex overflow-hidden text-zinc-500 tabular-nums dark:text-zinc-400">
            <AnimatePresence
              custom={direction}
              initial={false}
              mode="popLayout"
            >
              <motion.span
                animate="center"
                custom={direction}
                exit="exit"
                initial="enter"
                key={total}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                variants={ROLL}
              >
                {formatCount(total)}
              </motion.span>
            </AnimatePresence>
          </span>
        </button>
      </div>
    </MotionConfig>
  );
}

function TrayItem({
  reaction,
  hovered,
  checked,
  onHover,
  onPick,
  register,
}: {
  reaction: Reaction;
  hovered: boolean;
  checked: boolean;
  onHover: (id: string | null) => void;
  onPick: (id: string) => void;
  register: (el: HTMLButtonElement | null) => void;
}) {
  const Icon = reaction.icon;
  return (
    <motion.button
      aria-checked={checked}
      aria-label={reaction.label}
      className="relative flex size-10 items-center justify-center rounded-full outline-none"
      onBlur={() => onHover(null)}
      onClick={() => onPick(reaction.id)}
      onFocus={() => onHover(reaction.id)}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          onHover(reaction.id);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") {
          onHover(null);
        }
      }}
      ref={register}
      role="menuitemradio"
      tabIndex={-1}
      type="button"
      variants={ITEM}
    >
      <motion.span
        animate={{ y: hovered ? -6 : 0 }}
        className={cn(
          "flex size-9 items-center justify-center rounded-full transition-shadow duration-150 ease-out",
          reaction.tint,
          reaction.color,
          checked && "ring-1 ring-current/30"
        )}
        transition={{ type: "spring", stiffness: 600, damping: 30 }}
      >
        <Icon className="size-[18px]" strokeWidth={2} />
      </motion.span>
      <AnimatePresence>
        {hovered && (
          <motion.span
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute bottom-full mb-3 whitespace-nowrap rounded-full bg-zinc-900 px-2 py-0.5 font-medium text-[11px] text-white dark:bg-zinc-100 dark:text-zinc-900"
            exit={{ opacity: 0, y: 2, transition: { duration: 0.1 } }}
            initial={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: EASE_OUT }}
          >
            {reaction.label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
