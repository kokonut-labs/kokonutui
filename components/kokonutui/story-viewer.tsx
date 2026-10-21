"use client";

/**
 * @author: @dorianbaffier
 * @description: Story Viewer
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Heart, Pause, Play, SendHorizontal, X } from "lucide-react";
import {
  AnimatePresence,
  animate,
  type MotionValue,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import Image from "next/image";
import {
  type FormEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface Story {
  id: string;
  src: string;
  alt: string;
  caption?: string;
  /** When it was posted, as shown: "2h", "Yesterday". */
  time: string;
}

export interface StoryUser {
  id: string;
  name: string;
  avatar: string;
  stories: Story[];
}

export interface StoryViewerProps {
  users?: StoryUser[];
  /** How long each story shows, in ms. */
  duration?: number;
  /** Ring color for stories not seen yet. */
  accent?: string;
  className?: string;
}

const unsplash = (id: string, w: number, h: number) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;

const DEFAULT_USERS: StoryUser[] = [
  {
    id: "maya",
    name: "Maya",
    avatar: unsplash("1494790108377-be9c29b29330", 160, 160),
    stories: [
      {
        id: "maya-1",
        src: unsplash("1501785888041-af3ef285b470", 900, 1600),
        alt: "A still lake below mountains at dawn",
        caption: "Up at 5 for this. Worth it.",
        time: "2h",
      },
      {
        id: "maya-2",
        src: unsplash("1506905925346-21bda4d32df4", 900, 1600),
        alt: "Peaks rising above the clouds",
        caption: "Above the cloud line by 9",
        time: "1h",
      },
      {
        id: "maya-3",
        src: unsplash("1433086966358-54859d0ed716", 900, 1600),
        alt: "A waterfall in a green gorge",
        time: "34m",
      },
    ],
  },
  {
    id: "jun",
    name: "Jun",
    avatar: unsplash("1507003211169-0a1dd7228f2d", 160, 160),
    stories: [
      {
        id: "jun-1",
        src: unsplash("1540959733332-eab4deabeeaf", 900, 1600),
        alt: "Tokyo streets at night",
        caption: "Last night in Tokyo",
        time: "5h",
      },
      {
        id: "jun-2",
        src: unsplash("1504674900247-0877df9cc836", 900, 1600),
        alt: "A table of small plates",
        caption: "Found the place from the list",
        time: "4h",
      },
    ],
  },
  {
    id: "ava",
    name: "Ava",
    avatar: unsplash("1438761681033-6461ffad8d80", 160, 160),
    stories: [
      {
        id: "ava-1",
        src: unsplash("1507525428034-b723cf961d3e", 900, 1600),
        alt: "A quiet beach with clear water",
        caption: "Office for the week",
        time: "8h",
      },
      {
        id: "ava-2",
        src: unsplash("1469474968028-56623f02e42e", 900, 1600),
        alt: "Sun setting over a valley",
        time: "6h",
      },
    ],
  },
  {
    id: "leo",
    name: "Leo",
    avatar: unsplash("1500648767791-00dcc994a43e", 160, 160),
    stories: [
      {
        id: "leo-1",
        src: unsplash("1441974231531-c6227db76b6e", 900, 1600),
        alt: "Light through a forest",
        caption: "Trail run, 14 km",
        time: "Yesterday",
      },
      {
        id: "leo-2",
        src: unsplash("1470071459604-3b5ec3a7fe05", 900, 1600),
        alt: "Fog over green hills",
        time: "Yesterday",
      },
    ],
  },
];

// A press shorter than this is a tap; longer is a hold that pauses.
const HOLD_MS = 220;
const AXIS_LOCK = 8;
// Swipe down this far, or this fast (px/ms), to close.
const CLOSE_DISTANCE = 120;
const CLOSE_SPEED = 0.6;
// Swipe sideways this much of the card's width, or this fast, to turn.
const TURN_SHARE = 0.25;
const TURN_SPEED = 0.45;
const OPEN = { type: "spring", duration: 0.45, bounce: 0 } as const;
const TURN = { type: "spring", duration: 0.5, bounce: 0 } as const;
const SETTLE = { type: "spring", duration: 0.35, bounce: 0.15 } as const;
const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

interface Size {
  w: number;
  h: number;
}

function cardSize(): Size {
  const w = Math.min(
    380,
    window.innerWidth - 24,
    ((window.innerHeight - 32) * 9) / 16
  );
  return { w, h: (w * 16) / 9 };
}

/** Where the card sits, scaled and clipped, to look like an avatar. */
function flyFrom(rect: DOMRect | null, s: Size) {
  if (!rect) {
    return null;
  }
  return {
    x: rect.left + rect.width / 2 - window.innerWidth / 2,
    y: rect.top + rect.height / 2 - window.innerHeight / 2,
    scale: rect.width / s.w,
    clip: `inset(${(s.h - s.w) / 2}px 0px round ${s.w / 2}px)`,
  };
}

/** The ring round an avatar: one arc per story, grey once seen. */
function StoryRing({
  count,
  seen,
  accent,
}: {
  count: number;
  seen: number;
  accent: string;
}) {
  const r = 31;
  const c = 2 * Math.PI * r;
  const gap = count > 1 ? 4 : 0;
  const arc = c / count - gap;
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 size-full -rotate-90"
      viewBox="0 0 68 68"
    >
      {Array.from({ length: count }, (_, i) => (
        <circle
          className={cn(
            "transition-[stroke] duration-300",
            i < seen && "stroke-zinc-300 dark:stroke-zinc-700"
          )}
          cx="34"
          cy="34"
          fill="none"
          // biome-ignore lint/suspicious/noArrayIndexKey: one arc per story, fixed order
          key={i}
          r={r}
          stroke={i < seen ? undefined : accent}
          strokeDasharray={`${arc} ${c - arc}`}
          strokeDashoffset={-(i * (arc + gap)) - gap / 2}
          strokeLinecap="round"
          strokeWidth="2.5"
        />
      ))}
    </svg>
  );
}

export default function StoryViewer({
  users = DEFAULT_USERS,
  duration = 5000,
  accent = "#e11d48",
  className,
}: StoryViewerProps) {
  const [openUser, setOpenUser] = useState<number | null>(null);
  // Whose story is on screen; their avatar is hidden while the card is up,
  // since the card is that avatar grown large.
  const [showing, setShowing] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const trayRef = useRef<HTMLDivElement>(null);

  const markSeen = useCallback((id: string) => {
    setSeen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const avatarRect = (user: number) =>
    trayRef.current
      ?.querySelector<HTMLElement>(`[data-story-user="${user}"]`)
      ?.getBoundingClientRect() ?? null;

  return (
    <div className={cn("w-full max-w-md", className)}>
      <div
        className="flex gap-4 overflow-x-auto px-1 py-2 [scrollbar-width:none]"
        ref={trayRef}
      >
        {users.map((user, i) => {
          const seenCount = user.stories.filter((s) => seen.has(s.id)).length;
          const allSeen = seenCount === user.stories.length;
          return (
            <button
              aria-label={`${user.name}'s story, ${user.stories.length} ${
                user.stories.length === 1 ? "post" : "posts"
              }${allSeen ? ", seen" : ""}`}
              className="group/story flex w-[68px] shrink-0 flex-col items-center gap-1.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              key={user.id}
              onClick={() => {
                setOpenUser(i);
                setShowing(i);
              }}
              type="button"
            >
              <span className="relative size-[68px]">
                <StoryRing
                  accent={accent}
                  count={user.stories.length}
                  seen={seenCount}
                />
                <span
                  className={cn(
                    "absolute inset-[5px] overflow-hidden rounded-full bg-zinc-200 transition-opacity duration-200 dark:bg-zinc-800",
                    showing === i && "opacity-0"
                  )}
                  data-story-user={i}
                >
                  <Image
                    alt=""
                    className="size-full object-cover"
                    draggable={false}
                    height={160}
                    src={user.avatar}
                    unoptimized
                    width={160}
                  />
                </span>
              </span>
              <span
                className={cn(
                  "max-w-full truncate text-xs",
                  allSeen
                    ? "text-zinc-400 dark:text-zinc-500"
                    : "font-medium text-zinc-800 dark:text-zinc-200"
                )}
              >
                {user.name}
              </span>
            </button>
          );
        })}
      </div>

      {openUser !== null && typeof document !== "undefined"
        ? createPortal(
            <Viewer
              avatarRect={avatarRect}
              duration={duration}
              onClose={(last) => {
                setOpenUser(null);
                setShowing(null);
                trayRef.current
                  ?.querySelector<HTMLElement>(`[data-story-user="${last}"]`)
                  ?.closest("button")
                  ?.focus();
              }}
              onSeen={markSeen}
              onUserChange={setShowing}
              seen={seen}
              startUser={openUser}
              users={users}
            />,
            document.body
          )
        : null}
    </div>
  );
}

interface ViewerProps {
  users: StoryUser[];
  startUser: number;
  seen: Set<string>;
  duration: number;
  onSeen: (id: string) => void;
  onClose: (lastUser: number) => void;
  onUserChange: (user: number) => void;
  avatarRect: (user: number) => DOMRect | null;
}

function firstUnseen(user: StoryUser, seen: Set<string>) {
  const i = user.stories.findIndex((s) => !seen.has(s.id));
  return i === -1 ? 0 : i;
}

function Viewer({
  users,
  startUser,
  seen,
  duration,
  onSeen,
  onClose,
  onUserChange,
  avatarRect,
}: ViewerProps) {
  const reduced = useReducedMotion();
  const [size, setSize] = useState<Size | null>(null);
  const [user, setUser] = useState(startUser);
  // Where each user's stories are up to, so turning back resumes there.
  const [positions, setPositions] = useState<number[]>(() =>
    users.map((u) => firstUnseen(u, seen))
  );
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const [closing, setClosing] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  // The card's flight from and back to an avatar.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const clip = useMotionValue("inset(0px 0px round 16px)");
  const backdrop = useMotionValue(0);
  // How far the cube has turned towards the next (+1) or previous (-1) user.
  const turn = useMotionValue(0);
  // How far through the current story, 0 to 1.
  const elapsed = useMotionValue(0);
  const dragY = useMotionValue(0);

  const story = users[user].stories[positions[user]];
  const playing =
    !(paused || holding || typing || busy || closing) &&
    size !== null &&
    loaded.has(story.id);

  useLayoutEffect(() => {
    const measure = () => setSize(cardSize());
    measure();
    window.addEventListener("resize", measure);
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", measure);
      root.style.overflow = previous;
    };
  }, []);

  const opened = useRef(false);
  useLayoutEffect(() => {
    if (!size || opened.current) {
      return;
    }
    opened.current = true;
    dialogRef.current?.focus();
    const from = flyFrom(avatarRect(startUser), size);
    animate(backdrop, 1, { duration: 0.25, ease: EASE });
    if (!from || reduced) {
      return;
    }
    x.jump(from.x);
    y.jump(from.y);
    scale.jump(from.scale);
    clip.jump(from.clip);
    setBusy(true);
    Promise.all([
      animate(x, 0, OPEN),
      animate(y, 0, OPEN),
      animate(scale, 1, OPEN),
      animate(clip, "inset(0px 0px round 16px)", OPEN),
    ]).then(() => {
      // Let the cube's edge swing past the card while turning.
      clip.jump("none");
      setBusy(false);
    });
  });

  const close = useCallback(() => {
    if (closing) {
      return;
    }
    setClosing(true);
    clip.jump("inset(0px 0px round 16px)");
    const s = size ?? cardSize();
    const to = flyFrom(avatarRect(user), s);
    animate(backdrop, 0, { duration: 0.22, ease: EASE });
    if (!to || reduced) {
      onClose(user);
      return;
    }
    // Close into the avatar of whoever is showing now, not whoever was
    // opened, so the card lands where its story lives in the tray.
    Promise.all([
      animate(x, to.x, OPEN),
      animate(y, to.y, OPEN),
      animate(dragY, 0, OPEN),
      animate(scale, to.scale, OPEN),
      animate(clip, to.clip, OPEN),
    ]).then(() => onClose(user));
  }, [
    closing,
    size,
    user,
    reduced,
    onClose,
    avatarRect,
    backdrop,
    clip,
    dragY,
    scale,
    x,
    y,
  ]);

  useEffect(() => {
    onUserChange(user);
  }, [user, onUserChange]);

  // Mark each story seen as soon as it shows.
  useEffect(() => {
    onSeen(story.id);
  }, [story.id, onSeen]);

  const goUser = useCallback(
    (step: 1 | -1) => {
      const next = user + step;
      if (next < 0) {
        animate(turn, 0, SETTLE);
        return;
      }
      if (next >= users.length) {
        close();
        return;
      }
      setBusy(true);
      animate(turn, step, reduced ? { duration: 0 } : TURN).then(() => {
        // The faces are re-laid around the new user, so resetting the turn
        // in the same frame shows exactly the same picture.
        setUser(next);
        if (step === 1) {
          setPositions((p) => {
            const copy = [...p];
            copy[next] = firstUnseen(users[next], seen);
            return copy;
          });
        }
        turn.jump(0);
        elapsed.jump(0);
        setBusy(false);
      });
    },
    [user, users, close, reduced, seen, turn, elapsed]
  );

  const goStory = useCallback(
    (step: 1 | -1) => {
      const at = positions[user] + step;
      if (at < 0) {
        if (user === 0) {
          elapsed.jump(0);
          return;
        }
        goUser(-1);
        return;
      }
      if (at >= users[user].stories.length) {
        goUser(1);
        return;
      }
      elapsed.jump(0);
      setPositions((p) => {
        const copy = [...p];
        copy[user] = at;
        return copy;
      });
    },
    [positions, user, users, goUser, elapsed]
  );

  // The clock. It only runs while the story is on screen, loaded and nobody
  // is holding, typing or turning.
  const goStoryRef = useRef(goStory);
  goStoryRef.current = goStory;
  useEffect(() => {
    if (!playing) {
      return;
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = elapsed.get() + (now - last) / duration;
      last = now;
      if (next >= 1) {
        elapsed.set(1);
        goStoryRef.current(1);
        return;
      }
      elapsed.set(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration, elapsed]);

  // Pause when the tab is hidden.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Gestures on the card: tap a side, hold to pause, swipe sideways to turn
  // the cube, swipe down to close.
  const gesture = useRef({
    id: -1,
    x: 0,
    y: 0,
    t: 0,
    axis: "" as "" | "x" | "y",
    lastX: 0,
    lastY: 0,
    lastT: 0,
    vx: 0,
    vy: 0,
    timer: 0,
  });

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (busy || closing || event.button !== 0) {
      return;
    }
    const g = gesture.current;
    window.clearTimeout(g.timer);
    Object.assign(g, {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      t: event.timeStamp,
      axis: "",
      lastX: event.clientX,
      lastY: event.clientY,
      lastT: event.timeStamp,
      vx: 0,
      vy: 0,
      timer: window.setTimeout(() => setHolding(true), HOLD_MS),
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (g.id !== event.pointerId || !size) {
      return;
    }
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    if (!g.axis) {
      if (Math.hypot(dx, dy) < AXIS_LOCK) {
        return;
      }
      g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      window.clearTimeout(g.timer);
      setHolding(true);
    }
    const dt = Math.max(1, event.timeStamp - g.lastT);
    g.vx = 0.8 * ((event.clientX - g.lastX) / dt) + 0.2 * g.vx;
    g.vy = 0.8 * ((event.clientY - g.lastY) / dt) + 0.2 * g.vy;
    g.lastX = event.clientX;
    g.lastY = event.clientY;
    g.lastT = event.timeStamp;
    if (g.axis === "x") {
      let t = -dx / size.w;
      // Nothing to turn to past the first user: resist.
      if (user === 0 && t < 0) {
        t *= 0.25;
      }
      turn.set(Math.max(-1, Math.min(1, t)));
    } else {
      const down = Math.max(0, dy);
      dragY.set(down);
      backdrop.set(1 - Math.min(0.6, down / 400));
    }
  };

  const endTurn = (vx: number) => {
    const t = turn.get();
    const flick = Math.abs(vx) > TURN_SPEED;
    // Commit when far or fast enough, unless the flick goes back the other way.
    if (
      (Math.abs(t) > TURN_SHARE || flick) &&
      Math.sign(-vx || t) === Math.sign(t)
    ) {
      goUser(t > 0 ? 1 : -1);
    } else {
      animate(turn, 0, SETTLE);
    }
  };

  const endPull = (vy: number) => {
    if (dragY.get() > CLOSE_DISTANCE || vy > CLOSE_SPEED) {
      close();
    } else {
      animate(dragY, 0, SETTLE);
      animate(backdrop, 1, { duration: 0.2 });
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (g.id !== event.pointerId) {
      return;
    }
    g.id = -1;
    window.clearTimeout(g.timer);
    const wasHold = event.timeStamp - g.t >= HOLD_MS;
    setHolding(false);

    if (g.axis === "x") {
      endTurn(g.vx);
      return;
    }
    if (g.axis === "y") {
      endPull(g.vy);
      return;
    }
    if (wasHold || event.type === "pointercancel") {
      return;
    }
    // A tap: the left third goes back, the rest goes forward.
    const rect = event.currentTarget.getBoundingClientRect();
    goStory(event.clientX - rect.left < rect.width / 3 ? -1 : 1);
  };

  const onKeyDown = (event: globalThis.KeyboardEvent) => {
    if (typing) {
      if (event.key === "Escape") {
        (event.target as HTMLElement).blur();
      }
      return;
    }
    if (event.key === "Escape") {
      close();
    } else if (event.key === "ArrowRight") {
      goStory(1);
    } else if (event.key === "ArrowLeft") {
      goStory(-1);
    } else if (event.key === " ") {
      event.preventDefault();
      setPaused((p) => !p);
    }
  };

  const onKeyDownRef = useRef(onKeyDown);
  onKeyDownRef.current = onKeyDown;
  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) =>
      onKeyDownRef.current(event);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const cubeTransform = useTransform(turn, (t) =>
    size ? `translateZ(${-size.w / 2}px) rotateY(${-t * 90}deg)` : "none"
  );
  const cardY = useTransform(
    [y, dragY],
    ([a, b]) => (a as number) + (b as number)
  );
  const dragScale = useTransform(dragY, [0, 400], [1, 0.86]);
  const cardScale = useTransform(
    [scale, dragScale],
    ([a, b]) => (a as number) * (b as number)
  );
  const backdropOpacity = useTransform(backdrop, (b) => b);

  const faces = [user - 1, user, user + 1].filter(
    (i) => i >= 0 && i < users.length
  );

  return (
    <div
      aria-label={`${users[user].name}'s story`}
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center outline-none"
      ref={dialogRef}
      role="dialog"
      tabIndex={-1}
    >
      <motion.button
        aria-label="Close stories"
        className="absolute inset-0 cursor-default bg-zinc-950/90"
        onClick={close}
        style={{ opacity: backdropOpacity }}
        tabIndex={-1}
        type="button"
      />
      {size ? (
        <motion.div
          className="relative"
          style={{
            width: size.w,
            height: size.h,
            x,
            y: cardY,
            scale: cardScale,
            clipPath: clip,
            perspective: 1200,
          }}
        >
          <motion.div
            className="relative size-full"
            style={{ transformStyle: "preserve-3d", transform: cubeTransform }}
          >
            {faces.map((i) => (
              <Face
                active={i === user}
                elapsed={elapsed}
                holding={holding}
                index={i - user}
                key={users[i].id}
                liked={liked}
                onClose={close}
                onLike={(id) =>
                  setLiked((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) {
                      next.delete(id);
                    } else {
                      next.add(id);
                    }
                    return next;
                  })
                }
                onLoad={(id) => setLoaded((prev) => new Set(prev).add(id))}
                onPointerCancel={onPointerUp}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onTogglePause={() => setPaused((p) => !p)}
                onTyping={setTyping}
                paused={paused}
                position={positions[i]}
                size={size}
                turn={turn}
                user={users[i]}
              />
            ))}
          </motion.div>
        </motion.div>
      ) : null}
    </div>
  );
}

interface FaceProps {
  user: StoryUser;
  /** -1, 0 or 1: which side of the cube this face is on. */
  index: number;
  active: boolean;
  position: number;
  size: Size;
  turn: MotionValue<number>;
  elapsed: MotionValue<number>;
  paused: boolean;
  holding: boolean;
  liked: Set<string>;
  onLike: (id: string) => void;
  onLoad: (id: string) => void;
  onClose: () => void;
  onTogglePause: () => void;
  onTyping: (typing: boolean) => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
}

function Face({
  user,
  index,
  active,
  position,
  size,
  turn,
  elapsed,
  paused,
  holding,
  liked,
  onLike,
  onLoad,
  onClose,
  onTogglePause,
  onTyping,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: FaceProps) {
  const story = user.stories[position];
  const [reply, setReply] = useState("");
  const [sent, setSent] = useState(false);
  // A face darkens as it turns away from you, like the side of a box.
  const shade = useTransform(turn, (t) =>
    Math.min(0.6, Math.abs(index - t) * 0.6)
  );

  const send = (event: FormEvent) => {
    event.preventDefault();
    if (!reply.trim()) {
      return;
    }
    setReply("");
    setSent(true);
    (document.activeElement as HTMLElement | null)?.blur();
    window.setTimeout(() => setSent(false), 1600);
  };

  return (
    <div
      aria-hidden={!active}
      className="absolute inset-0 overflow-hidden rounded-2xl bg-zinc-900 [backface-visibility:hidden]"
      inert={!active}
      style={{
        transform: `rotateY(${index * 90}deg) translateZ(${size.w / 2}px)`,
      }}
    >
      <div
        className="absolute inset-0 touch-none select-none"
        onPointerCancel={onPointerCancel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <AnimatePresence initial={false}>
          <motion.div
            animate={{ opacity: 1 }}
            className="absolute inset-0"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key={story.id}
            transition={{ duration: 0.18 }}
          >
            <Image
              alt={story.alt}
              className="pointer-events-none size-full object-cover"
              draggable={false}
              height={1600}
              onError={() => onLoad(story.id)}
              onLoad={() => onLoad(story.id)}
              src={story.src}
              unoptimized
              width={900}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex flex-col justify-between transition-opacity duration-200",
          holding ? "opacity-0" : "opacity-100"
        )}
      >
        <div className="bg-[linear-gradient(to_bottom,rgba(0,0,0,0.45),transparent)] px-3 pt-3 pb-8">
          <div className="flex gap-1">
            {user.stories.map((s, i) => (
              <Segment
                elapsed={elapsed}
                key={s.id}
                state={(() => {
                  if (i < position) {
                    return "done";
                  }
                  if (i === position && active) {
                    return "now";
                  }
                  return "todo";
                })()}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2.5 text-white">
            <span className="size-8 overflow-hidden rounded-full bg-white/20">
              <Image
                alt=""
                className="size-full object-cover"
                height={160}
                src={user.avatar}
                unoptimized
                width={160}
              />
            </span>
            <span className="font-semibold text-sm">{user.name}</span>
            <span className="text-sm text-white/70">{story.time}</span>
            <span className="ml-auto flex items-center gap-0.5">
              <button
                aria-label={paused ? "Play" : "Pause"}
                className="pointer-events-auto flex size-8 items-center justify-center rounded-full text-white/90 outline-none transition-colors duration-150 hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70"
                onClick={onTogglePause}
                type="button"
              >
                {paused ? (
                  <Play className="size-4" fill="currentColor" />
                ) : (
                  <Pause className="size-4" fill="currentColor" />
                )}
              </button>
              <button
                aria-label="Close"
                className="pointer-events-auto flex size-8 items-center justify-center rounded-full text-white/90 outline-none transition-colors duration-150 hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70"
                onClick={onClose}
                type="button"
              >
                <X className="size-5" />
              </button>
            </span>
          </div>
        </div>

        <div className="bg-[linear-gradient(to_top,rgba(0,0,0,0.5),transparent)] px-3 pt-10 pb-3">
          {story.caption ? (
            <p className="mb-3 text-balance px-1 font-medium text-[15px] text-white leading-snug">
              {story.caption}
            </p>
          ) : null}
          <form className="flex items-center gap-2" onSubmit={send}>
            <input
              aria-label={`Reply to ${user.name}`}
              className="pointer-events-auto h-10 min-w-0 flex-1 rounded-full border border-white/40 bg-transparent px-4 text-sm text-white outline-none transition-colors duration-150 placeholder:text-white/70 focus:border-white/80"
              onBlur={() => onTyping(false)}
              onChange={(e) => setReply(e.target.value)}
              onFocus={() => onTyping(true)}
              placeholder={sent ? "Sent" : `Reply to ${user.name}…`}
              value={reply}
            />
            {reply ? (
              <button
                aria-label="Send reply"
                className="pointer-events-auto flex size-10 items-center justify-center rounded-full text-white outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70"
                type="submit"
              >
                <SendHorizontal className="size-5" />
              </button>
            ) : (
              <button
                aria-label={liked.has(story.id) ? "Unlike" : "Like"}
                aria-pressed={liked.has(story.id)}
                className="pointer-events-auto flex size-10 items-center justify-center rounded-full text-white outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70"
                onClick={() => onLike(story.id)}
                type="button"
              >
                <Heart
                  className={cn(
                    "size-6 transition-colors duration-150",
                    liked.has(story.id) && "fill-rose-500 text-rose-500"
                  )}
                />
              </button>
            )}
          </form>
        </div>
      </div>

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-black"
        style={{ opacity: shade }}
      />
    </div>
  );
}

function Segment({
  state,
  elapsed,
}: {
  state: "done" | "now" | "todo";
  elapsed: MotionValue<number>;
}) {
  const live = useTransform(elapsed, (e) => `scaleX(${e})`);
  let transform: MotionValue<string> | string = "scaleX(0)";
  if (state === "done") {
    transform = "scaleX(1)";
  } else if (state === "now") {
    transform = live;
  }
  return (
    <span className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35">
      <motion.span
        className="block h-full origin-left bg-white"
        style={{ transform }}
      />
    </span>
  );
}
