"use client";

/**
 * @author dorianbaffier
 * @description Feature grid with aurora ambient, magnetic 3D tilt, and focus-dim siblings.
 * @version 2.0.0
 * @date 2025-02-20
 * @license MIT
 * @website https://kokonutui.com
 * @github https://github.com/kokonut-labs/kokonutui
 */

import type { LucideIcon } from "lucide-react";
import { Cloud, Code, Cpu, Globe, Lock, Zap } from "lucide-react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

const TILT_MAX = 9;
const TILT_SPRING = { stiffness: 300, damping: 28 } as const;
const GLOW_SPRING = { stiffness: 180, damping: 22 } as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export interface SpotlightItem {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
}

const DEFAULT_ITEMS: SpotlightItem[] = [
  {
    icon: Zap,
    title: "Instant",
    description:
      "Sub-100ms latency on every request, globally distributed across every region.",
    color: "#f59e0b",
  },
  {
    icon: Lock,
    title: "Secure",
    description:
      "Zero-trust by default. SOC 2 certified with end-to-end encryption throughout.",
    color: "#60a5fa",
  },
  {
    icon: Globe,
    title: "Global",
    description:
      "Edge-deployed to 300+ locations. Your users always hit a nearby server.",
    color: "#34d399",
  },
  {
    icon: Code,
    title: "Developer first",
    description:
      "Type-safe SDKs in five languages, a complete REST API, and honest docs.",
    color: "#a78bfa",
  },
  {
    icon: Cpu,
    title: "Scalable",
    description:
      "From side project to Series B without touching your infrastructure config.",
    color: "#38bdf8",
  },
  {
    icon: Cloud,
    title: "Serverless",
    description:
      "No servers to provision, patch, or babysit. Just deploy and move on.",
    color: "#f472b6",
  },
];

interface CardProps {
  item: SpotlightItem;
  dimmed: boolean;
  reduceMotion: boolean;
  onHoverStart: () => void;
}

function Card({ item, dimmed, reduceMotion, onHoverStart }: CardProps) {
  const Icon = item.icon;
  const cardRef = useRef<HTMLDivElement>(null);

  const normX = useMotionValue(0.5);
  const normY = useMotionValue(0.5);

  const rawRotateX = useTransform(normY, [0, 1], [TILT_MAX, -TILT_MAX]);
  const rawRotateY = useTransform(normX, [0, 1], [-TILT_MAX, TILT_MAX]);

  const rotateX = useSpring(rawRotateX, TILT_SPRING);
  const rotateY = useSpring(rawRotateY, TILT_SPRING);
  const glowOpacity = useSpring(0, GLOW_SPRING);

  // Tilt follows a mouse only: on touch, tap-generated events would leave the
  // card tilted. Motion's onHoverStart/End already ignore touch.
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (e.pointerType !== "mouse" || reduceMotion || !el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    normX.set((e.clientX - rect.left) / rect.width);
    normY.set((e.clientY - rect.top) / rect.height);
  };

  const handleHoverStart = () => {
    glowOpacity.set(1);
    onHoverStart();
  };

  const handleHoverEnd = () => {
    normX.set(0.5);
    normY.set(0.5);
    glowOpacity.set(0);
  };

  return (
    <motion.div
      animate={{
        scale: dimmed && !reduceMotion ? 0.96 : 1,
        opacity: dimmed ? 0.5 : 1,
      }}
      className={cn(
        "group relative flex flex-col gap-5 overflow-hidden rounded-2xl border p-6",
        // Light
        "border-zinc-200 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
        // Dark
        "dark:border-white/6 dark:bg-white/3 dark:shadow-none",
        "transition-[border-color] duration-300",
        "hover:border-zinc-300 dark:hover:border-white/14"
      )}
      onHoverEnd={handleHoverEnd}
      onHoverStart={handleHoverStart}
      onPointerMove={handlePointerMove}
      ref={cardRef}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 900,
      }}
      transition={{ duration: 0.18, ease: EASE_OUT }}
    >
      {/* Static accent tint — always visible */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background: `radial-gradient(ellipse at 20% 20%, ${item.color}14, transparent 65%)`,
        }}
      />

      {/* Hover glow layer */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          opacity: glowOpacity,
          background: `radial-gradient(ellipse at 20% 20%, ${item.color}2e, transparent 65%)`,
        }}
      />

      {/* Shimmer sweep: transitions on hover-in only, so it resets off-card
          instead of sweeping back on leave. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-[55%] -translate-x-full -skew-x-12 bg-linear-to-r from-transparent via-white/4.5 to-transparent group-hover:translate-x-[280%] group-hover:transition-transform group-hover:duration-700 group-hover:ease-out motion-reduce:hidden"
      />

      {/* Icon badge */}
      <div
        className="relative z-10 flex h-10 w-10 items-center justify-center rounded-xl"
        style={{
          background: `${item.color}18`,
          boxShadow: `inset 0 0 0 1px ${item.color}30`,
        }}
      >
        <Icon size={17} strokeWidth={1.9} style={{ color: item.color }} />
      </div>

      {/* Text */}
      <div className="relative z-10 flex flex-col gap-2">
        <h3 className="font-semibold text-[14px] text-zinc-900 tracking-tight dark:text-white">
          {item.title}
        </h3>
        <p className="text-[12.5px] text-zinc-500 leading-relaxed dark:text-white/40">
          {item.description}
        </p>
      </div>

      {/* Accent bottom line */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 rounded-full transition-transform duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-x-100 motion-reduce:transition-none"
        style={{
          background: `linear-gradient(to right, ${item.color}80, transparent)`,
        }}
      />
    </motion.div>
  );
}

export interface SpotlightCardsProps {
  items?: SpotlightItem[];
  eyebrow?: string;
  heading?: string;
  className?: string;
}

export default function SpotlightCards({
  items = DEFAULT_ITEMS,
  eyebrow = "Features",
  heading = "Everything you need",
  className,
}: SpotlightCardsProps) {
  const [hoveredTitle, setHoveredTitle] = useState<string | null>(null);
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl px-8 pt-9 pb-10",
        "bg-white dark:bg-[#06060f]",
        className
      )}
    >
      {/* Dot grid — light mode only */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 dark:hidden"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0,0,0,0.055) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      {/* Header */}
      <div className="relative mb-8 flex flex-col gap-1.5">
        <p className="font-semibold text-[10px] text-indigo-600 uppercase tracking-[0.22em] dark:text-indigo-400/80">
          {eyebrow}
        </p>
        <h2 className="font-semibold text-[22px] text-zinc-900 tracking-tight dark:text-white">
          {heading}
        </h2>
      </div>

      {/* Card grid. Hover clears on leaving the grid, not each card, so
          crossing the gap between cards doesn't briefly undim the siblings. */}
      <motion.div
        className="relative grid grid-cols-2 gap-3 sm:grid-cols-3"
        onHoverEnd={() => setHoveredTitle(null)}
      >
        {items.map((item) => (
          <Card
            dimmed={hoveredTitle !== null && hoveredTitle !== item.title}
            item={item}
            key={item.title}
            onHoverStart={() => setHoveredTitle(item.title)}
            reduceMotion={reduceMotion}
          />
        ))}
      </motion.div>
    </div>
  );
}
