"use client";

/**
 * @author: @dorianbaffier
 * @description: Lightbox Grid
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  animate,
  type MotionValue,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import Image from "next/image";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface LightboxImage {
  src: string;
  alt: string;
  /** Natural size, used to fit the open view without waiting for a load. */
  width: number;
  height: number;
  caption?: string;
}

export interface LightboxGridProps {
  images?: LightboxImage[];
  className?: string;
}

const unsplash = (id: string, w: number, h: number) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;

const DEFAULT_IMAGES: LightboxImage[] = [
  {
    src: unsplash("1501785888041-af3ef285b470", 1600, 1067),
    alt: "A lake below mountains",
    width: 1600,
    height: 1067,
    caption: "Lake shore, early morning",
  },
  {
    src: unsplash("1506905925346-21bda4d32df4", 1200, 1600),
    alt: "Peaks above the clouds",
    width: 1200,
    height: 1600,
    caption: "Above the cloud line",
  },
  {
    src: unsplash("1470071459604-3b5ec3a7fe05", 1600, 1067),
    alt: "Misty hills",
    width: 1600,
    height: 1067,
    caption: "Fog over the hills",
  },
  {
    src: unsplash("1441974231531-c6227db76b6e", 1200, 1600),
    alt: "Light through a forest",
    width: 1200,
    height: 1600,
    caption: "Forest, late afternoon",
  },
  {
    src: unsplash("1469474968028-56623f02e42e", 1600, 1067),
    alt: "Sun setting over a valley",
    width: 1600,
    height: 1067,
    caption: "Valley at sunset",
  },
  {
    src: unsplash("1433086966358-54859d0ed716", 1200, 1600),
    alt: "A waterfall",
    width: 1200,
    height: 1600,
    caption: "Waterfall after rain",
  },
];

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];
const OPEN = { type: "spring", duration: 0.5, bounce: 0.12 } as const;
const CLOSE = { type: "spring", duration: 0.42, bounce: 0.08 } as const;
const SETTLE = { type: "spring", duration: 0.35, bounce: 0.2 } as const;
// The open image keeps this much room around it, and below for the caption.
const MARGIN = 48;
const MARGIN_SMALL = 12;
const CAPTION_ROOM = 56;
const OPEN_RADIUS = 10;
// Drag thresholds: distance in px, speed in px/ms.
const DISMISS_DISTANCE = 110;
const DISMISS_SPEED = 0.55;
const SWIPE_SPEED = 0.45;
const AXIS_LOCK = 6;

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Frame {
  x: number;
  y: number;
  scale: number;
  clip: string;
}

/** Where an image of this size sits when open, fitted to the window. */
function fitRect(image: LightboxImage): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = vw < 640 ? MARGIN_SMALL : MARGIN;
  const maxW = vw - margin * 2;
  const maxH = vh - margin * 2 - CAPTION_ROOM;
  const scale = Math.min(maxW / image.width, maxH / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    left: (vw - width) / 2,
    top: (vh - CAPTION_ROOM - height) / 2,
    width,
    height,
  };
}

const openClip = () => `inset(0px 0px 0px 0px round ${OPEN_RADIUS}px)`;

/**
 * The transform and crop that make the open image look exactly like its
 * thumbnail: scaled down to the thumbnail's cover size, moved onto it, and
 * cropped to its box. Animating from here to identity is the whole trick.
 */
function thumbFrame(
  open: Rect,
  thumb: DOMRect,
  image: LightboxImage,
  radius: number
): Frame {
  const imageRatio = image.width / image.height;
  const thumbRatio = thumb.width / thumb.height;
  const coverWidth =
    imageRatio > thumbRatio ? thumb.height * imageRatio : thumb.width;
  const scale = coverWidth / open.width;
  const insetX = (open.width - thumb.width / scale) / 2;
  const insetY = (open.height - thumb.height / scale) / 2;
  return {
    x: thumb.left + thumb.width / 2 - (open.left + open.width / 2),
    y: thumb.top + thumb.height / 2 - (open.top + open.height / 2),
    scale,
    clip: `inset(${insetY}px ${insetX}px ${insetY}px ${insetX}px round ${radius / scale}px)`,
  };
}

function isVisible(rect: DOMRect) {
  return (
    rect.bottom > 0 &&
    rect.top < window.innerHeight &&
    rect.right > 0 &&
    rect.left < window.innerWidth
  );
}

function IconButton({
  label,
  onClick,
  className,
  children,
  buttonRef,
  unavailable,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
  buttonRef?: Ref<HTMLButtonElement>;
  /** Dimmed but still focusable, so focus never drops out of the viewer. */
  unavailable?: boolean;
}) {
  return (
    <button
      aria-disabled={unavailable || undefined}
      aria-label={label}
      className={cn(
        "flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-[background-color,opacity] duration-150 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white/70 aria-disabled:cursor-default aria-disabled:opacity-30 aria-disabled:hover:bg-white/10",
        className
      )}
      onClick={onClick}
      ref={buttonRef}
      type="button"
    >
      {children}
    </button>
  );
}

function Chevron({ flip }: { flip?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("size-4", flip && "rotate-180")}
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="m6 3.5 4.5 4.5L6 12.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

interface ViewerProps {
  images: LightboxImage[];
  index: number;
  rect: Rect;
  x: MotionValue<number>;
  y: MotionValue<number>;
  scale: MotionValue<number>;
  clip: MotionValue<string>;
  alpha: MotionValue<number>;
  fade: MotionValue<number>;
  settled: boolean;
  onClose: (velocity?: { x: number; y: number }) => void;
  onStep: (direction: 1 | -1) => void;
}

function Viewer({
  images,
  index,
  rect,
  x,
  y,
  scale,
  clip,
  alpha,
  fade,
  settled,
  onClose,
  onStep,
}: ViewerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: number;
    startX: number;
    startY: number;
    axis: "x" | "y" | null;
    samples: { x: number; y: number; t: number }[];
  } | null>(null);
  const backdrop = useTransform(fade, (v) => v * 0.92);
  const image = images[index];
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!settled || event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      axis: null,
      samples: [{ x: event.clientX, y: event.clientY, t: event.timeStamp }],
    };
  };

  // Pulling away shrinks the photo and lets the page show through.
  const followVertical = (dx: number, dy: number) => {
    const pull = Math.min(Math.abs(dy) / window.innerHeight, 1);
    x.set(dx);
    y.set(dy);
    scale.set(1 - pull * 0.45);
    fade.set(1 - Math.min(Math.abs(dy) / 360, 1) * 0.85);
  };

  // Past the first or last photo the drag only gives a little.
  const followHorizontal = (dx: number) => {
    const blocked = (dx > 0 && !hasPrev) || (dx < 0 && !hasNext);
    x.set(blocked ? dx * 0.25 : dx);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) {
      return;
    }
    const dx = event.clientX - d.startX;
    const dy = event.clientY - d.startY;
    if (!d.axis) {
      if (Math.hypot(dx, dy) < AXIS_LOCK) {
        return;
      }
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    d.samples.push({ x: event.clientX, y: event.clientY, t: event.timeStamp });
    if (d.samples.length > 5) {
      d.samples.shift();
    }
    if (d.axis === "y") {
      followVertical(dx, dy);
    } else {
      followHorizontal(dx);
    }
  };

  const releaseVertical = (dy: number, velocity: { x: number; y: number }) => {
    if (
      Math.abs(dy) > DISMISS_DISTANCE ||
      Math.abs(velocity.y) > DISMISS_SPEED
    ) {
      onClose(velocity);
      return;
    }
    animate(x, 0, SETTLE);
    animate(y, 0, SETTLE);
    animate(scale, 1, SETTLE);
    animate(fade, 1, { duration: 0.2, ease: EASE });
  };

  const releaseHorizontal = (dx: number, vx: number) => {
    const far = Math.abs(dx) > rect.width * 0.22 || Math.abs(vx) > SWIPE_SPEED;
    if (far && dx < 0 && hasNext) {
      onStep(1);
    } else if (far && dx > 0 && hasPrev) {
      onStep(-1);
    } else {
      animate(x, 0, SETTLE);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) {
      return;
    }
    drag.current = null;
    const first = d.samples[0];
    const last = d.samples.at(-1) ?? first;
    const dt = Math.max(1, last.t - first.t);
    const velocity = { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
    if (d.axis === "y") {
      releaseVertical(event.clientY - d.startY, velocity);
    } else if (d.axis === "x") {
      releaseHorizontal(event.clientX - d.startX, velocity.x);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowRight" && hasNext) {
      onStep(1);
    } else if (event.key === "ArrowLeft" && hasPrev) {
      onStep(-1);
    } else if (event.key === "Tab") {
      // Keep focus inside the viewer.
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)"
        ) ?? []
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: keys for the whole viewer: Escape, arrows and the focus trap
    <div
      aria-label={image.caption ?? image.alt}
      aria-modal="true"
      className="fixed inset-0 z-[100]"
      onKeyDown={handleKeyDown}
      ref={dialogRef}
      role="dialog"
    >
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-zinc-950"
        onClick={() => onClose()}
        style={{ opacity: backdrop }}
      />

      <motion.div
        className="absolute cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
        onLostPointerCapture={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          x,
          y,
          scale,
          clipPath: clip,
          opacity: alpha,
          willChange: "transform, clip-path",
        }}
      >
        <Image
          alt={image.alt}
          className="pointer-events-none h-full w-full object-cover"
          draggable={false}
          height={image.height}
          src={image.src}
          unoptimized
          width={image.width}
        />
      </motion.div>

      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ opacity: fade }}
      >
        <div className="pointer-events-auto absolute top-3 right-3 flex items-center gap-3 sm:top-4 sm:right-4">
          <span className="text-sm text-white/60 tabular-nums">
            {index + 1} / {images.length}
          </span>
          <IconButton
            buttonRef={closeRef}
            label="Close"
            onClick={() => onClose()}
          >
            <svg
              aria-hidden="true"
              className="size-4"
              fill="none"
              viewBox="0 0 16 16"
            >
              <path
                d="m4 4 8 8M12 4l-8 8"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.6"
              />
            </svg>
          </IconButton>
        </div>
        <IconButton
          className="pointer-events-auto absolute top-1/2 left-4 hidden -translate-y-1/2 sm:flex"
          label="Previous photo"
          onClick={() => hasPrev && onStep(-1)}
          unavailable={!hasPrev}
        >
          <Chevron flip />
        </IconButton>
        <IconButton
          className="pointer-events-auto absolute top-1/2 right-4 hidden -translate-y-1/2 sm:flex"
          label="Next photo"
          onClick={() => hasNext && onStep(1)}
          unavailable={!hasNext}
        >
          <Chevron />
        </IconButton>
        {image.caption ? (
          <p
            className="absolute inset-x-4 text-center text-sm text-white/80"
            style={{ top: rect.top + rect.height + 18 }}
          >
            {image.caption}
          </p>
        ) : null}
      </motion.div>
    </div>
  );
}

/**
 * A photo grid whose thumbnails grow into a full view. The open photo is the
 * same element at every moment: a transform and a crop take it from its
 * slot to the middle of the screen and back, wherever it was dragged to.
 */
export default function LightboxGrid({
  images = DEFAULT_IMAGES,
  className,
}: LightboxGridProps) {
  const [active, setActive] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [settled, setSettled] = useState(false);
  const [closing, setClosing] = useState(false);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const closeTimer = useRef(0);
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const clip = useMotionValue(openClip());
  const alpha = useMotionValue(1);
  const fade = useMotionValue(0);

  const frameFor = useCallback(
    (index: number, open: Rect): Frame | null => {
      const thumb = thumbs.current[index];
      if (!thumb) {
        return null;
      }
      const box = thumb.getBoundingClientRect();
      if (!isVisible(box)) {
        return null;
      }
      const radius =
        Number.parseFloat(getComputedStyle(thumb).borderTopLeftRadius) || 0;
      return thumbFrame(open, box, images[index], radius);
    },
    [images]
  );

  const open = useCallback(
    (index: number) => {
      const target = fitRect(images[index]);
      const from = frameFor(index, target);
      setActive(index);
      setRect(target);
      setClosing(false);
      setSettled(false);
      alpha.set(1);
      if (!from || reduceMotion) {
        x.set(0);
        y.set(0);
        scale.set(1);
        clip.set(openClip());
        fade.set(0);
        alpha.set(0);
        animate(alpha, 1, { duration: 0.18 });
        animate(fade, 1, { duration: 0.18 }).then(() => setSettled(true));
        return;
      }
      x.set(from.x);
      y.set(from.y);
      scale.set(from.scale);
      clip.set(from.clip);
      fade.set(0);
      animate(x, 0, OPEN);
      animate(y, 0, OPEN);
      animate(scale, 1, OPEN);
      animate(clip, openClip(), OPEN);
      animate(fade, 1, { duration: 0.3, ease: EASE }).then(() =>
        setSettled(true)
      );
    },
    [alpha, clip, fade, frameFor, images, reduceMotion, scale, x, y]
  );

  const close = useCallback(
    (velocity?: { x: number; y: number }) => {
      if (active === null || !rect || closing) {
        return;
      }
      setClosing(true);
      const index = active;
      // Instant, so the slot is measured where it will be (pages often scroll smoothly).
      thumbs.current[index]?.scrollIntoView({
        behavior: "instant",
        block: "nearest",
        inline: "nearest",
      });
      const to = frameFor(index, rect);
      const finish = () => {
        setActive(null);
        setRect(null);
        setClosing(false);
        thumbs.current[index]?.focus({ preventScroll: true });
      };
      if (!to || reduceMotion) {
        animate(alpha, 0, { duration: 0.16 });
        animate(fade, 0, { duration: 0.16 }).then(finish);
        return;
      }
      // A flick carries its speed into the flight home.
      const vx = (velocity?.x ?? 0) * 1000;
      const vy = (velocity?.y ?? 0) * 1000;
      animate(x, to.x, { ...CLOSE, velocity: vx });
      animate(y, to.y, { ...CLOSE, velocity: vy });
      animate(scale, to.scale, CLOSE);
      animate(clip, to.clip, CLOSE);
      animate(fade, 0, { duration: 0.28, ease: EASE });
      // The clip spring settles last; reveal the thumbnail when it lands.
      closeTimer.current = window.setTimeout(finish, 420);
    },
    [
      active,
      alpha,
      clip,
      closing,
      fade,
      frameFor,
      rect,
      reduceMotion,
      scale,
      x,
      y,
    ]
  );

  const step = useCallback(
    (direction: 1 | -1) => {
      // Mid-close, the photo is already flying home to this slot.
      if (active === null || closing) {
        return;
      }
      const next = active + direction;
      if (next < 0 || next >= images.length) {
        return;
      }
      setActive(next);
      setRect(fitRect(images[next]));
      y.set(0);
      scale.set(1);
      clip.set(openClip());
      fade.set(1);
      if (reduceMotion) {
        x.set(0);
        alpha.set(1);
        return;
      }
      // The next photo slides in from the side it was swiped from.
      x.set(direction * 72);
      alpha.set(0);
      animate(x, 0, { duration: 0.32, ease: EASE });
      animate(alpha, 1, { duration: 0.22, ease: EASE });
    },
    [active, alpha, clip, closing, fade, images, reduceMotion, scale, x, y]
  );

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // Lock the page behind the viewer and keep the open photo fitted.
  useEffect(() => {
    if (active === null) {
      return;
    }
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    const onResize = () => setRect(fitRect(images[active]));
    window.addEventListener("resize", onResize);
    return () => {
      root.style.overflow = previous;
      window.removeEventListener("resize", onResize);
    };
  }, [active, images]);

  return (
    <div className={cn("w-full max-w-xl", className)}>
      <ul className="grid grid-cols-3 gap-2">
        {images.map((image, index) => (
          <li
            className={cn(index === 0 && "col-span-2 row-span-2")}
            key={image.src}
          >
            <button
              aria-label={`Open ${image.alt}`}
              className="relative block aspect-square w-full overflow-hidden rounded-xl bg-zinc-100 outline-offset-2 focus-visible:outline-2 focus-visible:outline-zinc-900 dark:bg-zinc-800 dark:focus-visible:outline-white"
              onClick={() => open(index)}
              ref={(node) => {
                thumbs.current[index] = node;
              }}
              // The open photo has left its slot; the slot stays empty until it returns.
              style={{ opacity: active === index ? 0 : 1 }}
              type="button"
            >
              <Image
                alt=""
                className="h-full w-full object-cover transition-[filter] duration-200 hover:brightness-95"
                draggable={false}
                fill
                sizes="(max-width: 640px) 66vw, 384px"
                src={image.src}
                unoptimized
              />
            </button>
          </li>
        ))}
      </ul>
      {active !== null && rect
        ? createPortal(
            <Viewer
              alpha={alpha}
              clip={clip}
              fade={fade}
              images={images}
              index={active}
              onClose={close}
              onStep={step}
              rect={rect}
              scale={scale}
              settled={settled && !closing}
              x={x}
              y={y}
            />,
            document.body
          )
        : null}
    </div>
  );
}
