"use client";

/**
 * @author: @dorianbaffier
 * @description: Focal Point Picker
 * @version: 1.0.0
 * @date: 2026-10-16
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import Image from "next/image";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface FocalPoint {
  /** 0 to 1 from the left. */
  x: number;
  /** 0 to 1 from the top. */
  y: number;
}

export interface FocalCrop {
  label: string;
  /** Width over height. */
  ratio: number;
}

export interface FocalPointPickerProps {
  src?: string;
  alt?: string;
  /** The image's natural width over height. */
  imageRatio?: number;
  defaultValue?: FocalPoint;
  /** The crops your layouts use; each previews the point live. */
  crops?: FocalCrop[];
  onValueChange?: (point: FocalPoint) => void;
  className?: string;
}

const PHOTO =
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&h=1067&fit=crop&auto=format&q=80";

const DEFAULT_CROPS: FocalCrop[] = [
  { label: "Avatar", ratio: 1 },
  { label: "Banner", ratio: 16 / 9 },
  { label: "Story", ratio: 9 / 16 },
];

const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/**
 * The window a cover-fit crop shows, as fractions of the image, centred on
 * the point as far as the edges allow; and the object-position that shows it.
 */
function cropWindow(point: FocalPoint, imageRatio: number, ratio: number) {
  const w = Math.min(1, ratio / imageRatio);
  const h = Math.min(1, imageRatio / ratio);
  const left = clamp(point.x - w / 2, 0, 1 - w);
  const top = clamp(point.y - h / 2, 0, 1 - h);
  return {
    left,
    top,
    w,
    h,
    position: `${w < 1 ? (left / (1 - w)) * 100 : 50}% ${h < 1 ? (top / (1 - h)) * 100 : 50}%`,
  };
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

const CORNERS = [
  "top-0 left-0 border-t border-l",
  "top-0 right-0 border-t border-r",
  "bottom-0 left-0 border-b border-l",
  "right-0 bottom-0 border-r border-b",
];

/** Thin L-shaped crop marks, like a viewfinder, at the corners of the parent. */
function CropCorners({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("pointer-events-none absolute", className)}>
      {CORNERS.map((corner) => (
        <span
          className={cn(
            "absolute size-2.5 border-white drop-shadow-[0_0_1px_rgb(0_0_0/0.6)]",
            corner
          )}
          key={corner}
        />
      ))}
    </span>
  );
}

export default function FocalPointPicker({
  src = PHOTO,
  alt = "Peaks above a sea of clouds",
  imageRatio = 3 / 2,
  defaultValue = { x: 0.68, y: 0.38 },
  crops = DEFAULT_CROPS,
  onValueChange,
  className,
}: FocalPointPickerProps) {
  const [point, setPoint] = useState(defaultValue);
  const [dragging, setDragging] = useState(false);
  // The crop whose window is drawn on the source, from hovering its preview.
  const [shown, setShown] = useState<number | null>(null);
  // A click glides the point; a drag follows the finger exactly.
  const [gliding, setGliding] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const pointRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    onValueChange?.(point);
  }, [point, onValueChange]);

  const pointAt = (clientX: number, clientY: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) {
      return point;
    }
    return {
      x: clamp((clientX - rect.left) / rect.width, 0, 1),
      y: clamp((clientY - rect.top) / rect.height, 0, 1),
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const onPoint = pointRef.current?.contains(event.target as Node);
    setGliding(!onPoint);
    setDragging(true);
    setPoint(pointAt(event.clientX, event.clientY));
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) {
      return;
    }
    setGliding(false);
    setPoint(pointAt(event.clientX, event.clientY));
  };

  const endDrag = () => setDragging(false);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 0.1 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move) {
      return;
    }
    event.preventDefault();
    setGliding(false);
    setPoint((p) => ({
      x: clamp(Math.round((p.x + move[0]) * 100) / 100, 0, 1),
      y: clamp(Math.round((p.y + move[1]) * 100) / 100, 0, 1),
    }));
  };

  const glide = gliding ? `transform 280ms ${EASE}` : "none";
  const shownCrop =
    shown === null ? null : cropWindow(point, imageRatio, crops[shown].ratio);

  return (
    <div
      className={cn(
        "w-full max-w-xl select-none rounded-3xl border border-zinc-200 bg-white p-4 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        className
      )}
    >
      <div
        className="relative cursor-crosshair touch-none overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900"
        onLostPointerCapture={endDrag}
        onPointerCancel={endDrag}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        ref={frameRef}
        style={{ aspectRatio: imageRatio }}
      >
        <Image
          alt={alt}
          className="pointer-events-none object-cover"
          draggable={false}
          fill
          sizes="(max-width: 576px) 100vw, 576px"
          src={src}
          unoptimized
        />

        {/* The hovered crop's window: everything it cuts is dimmed. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute shadow-[0_0_0_9999px_rgb(0_0_0/0.45)] outline outline-1 outline-white/60 transition-[left,top,width,height,opacity] duration-200",
            shownCrop ? "opacity-100" : "opacity-0"
          )}
          style={{
            left: pct(shownCrop?.left ?? 0),
            top: pct(shownCrop?.top ?? 0),
            width: pct(shownCrop?.w ?? 1),
            height: pct(shownCrop?.h ?? 1),
            transitionTimingFunction: EASE,
          }}
        >
          <CropCorners className="inset-1.5" />
        </div>

        {/* Full-size layer moved by the point, so dragging skips layout. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            transform: `translate(${point.x * 100}%, ${point.y * 100}%)`,
            transition: glide,
          }}
        >
          <button
            aria-label={`Focal point, ${pct(point.x)} from the left, ${pct(point.y)} from the top. Move with the arrow keys.`}
            className={cn(
              "pointer-events-auto absolute top-0 left-0 size-10 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40",
              dragging && "cursor-grabbing"
            )}
            onKeyDown={handleKeyDown}
            ref={pointRef}
            type="button"
          >
            {/* Hairline crosshair, open at the centre around the dot. */}
            <span className="absolute inset-0 drop-shadow-[0_0_1px_rgb(0_0_0/0.7)]">
              <span className="absolute top-1/2 left-0 h-px w-[15px] -translate-y-1/2 bg-white" />
              <span className="absolute top-1/2 right-0 h-px w-[15px] -translate-y-1/2 bg-white" />
              <span className="absolute top-0 left-1/2 h-[15px] w-px -translate-x-1/2 bg-white" />
              <span className="absolute bottom-0 left-1/2 h-[15px] w-px -translate-x-1/2 bg-white" />
            </span>
            <span className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500 ring-1 ring-white" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-end gap-3">
        {crops.map((crop, i) => {
          const c = cropWindow(point, imageRatio, crop.ratio);
          return (
            <button
              className="group min-w-0 text-left outline-none"
              key={crop.label}
              onBlur={() => setShown(null)}
              onFocus={() => setShown(i)}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") {
                  setShown(i);
                }
              }}
              onPointerLeave={() => setShown(null)}
              style={{ flex: `${crop.ratio} 1 0` }}
              type="button"
            >
              <span
                className={cn(
                  "relative block overflow-hidden rounded-lg bg-zinc-100 ring-offset-2 transition-shadow duration-150 ease-out group-focus-visible:ring-2 group-focus-visible:ring-zinc-400 dark:bg-zinc-900 dark:ring-offset-zinc-950",
                  shown === i && "ring-2 ring-zinc-900 dark:ring-zinc-100"
                )}
                style={{ aspectRatio: crop.ratio }}
              >
                <Image
                  alt=""
                  className="pointer-events-none object-cover"
                  draggable={false}
                  fill
                  sizes="200px"
                  src={src}
                  style={{
                    objectPosition: c.position,
                    transition: gliding
                      ? `object-position 280ms ${EASE}`
                      : "none",
                  }}
                  unoptimized
                />
                <CropCorners className="inset-1" />
              </span>
              <span className="mt-1.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                {crop.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-zinc-200 border-t pt-3 text-xs dark:border-zinc-800">
        <span className="text-zinc-500 dark:text-zinc-400">
          Drag the point, or hover a crop to see it
        </span>
        <code className="shrink-0 font-mono text-zinc-900 tabular-nums dark:text-zinc-100">
          {pct(point.x)} {pct(point.y)}
        </code>
      </div>
    </div>
  );
}
