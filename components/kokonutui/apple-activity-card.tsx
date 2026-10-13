"use client";

/**
 * @author: @kokonutui
 * @description: Apple Activity Card
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  MotionConfig,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import { type CSSProperties, useId, useRef } from "react";
import { cn } from "@/lib/utils";

export interface ActivityData {
  label: string;
  color: string;
  colorEnd: string;
  size: number;
  current: number;
  target: number;
  unit: string;
}

interface CircleProgressProps {
  data: ActivityData;
  index: number;
  inView: boolean;
  reduceMotion: boolean;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const SAMPLE_ACTIVITIES: ActivityData[] = [
  {
    label: "MOVE",
    color: "#FF2D55",
    colorEnd: "#FF6B8B",
    size: 200,
    current: 479,
    target: 800,
    unit: "CAL",
  },
  {
    label: "EXERCISE",
    color: "#A3F900",
    colorEnd: "#C5FF4D",
    size: 160,
    current: 24,
    target: 30,
    unit: "MIN",
  },
  {
    label: "STAND",
    color: "#04C7DD",
    colorEnd: "#4DDFED",
    size: 120,
    current: 6,
    target: 12,
    unit: "HR",
  },
];

const CircleProgress = ({
  data,
  index,
  inView,
  reduceMotion,
}: CircleProgressProps) => {
  const strokeWidth = 16;
  const radius = (data.size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  // Derived from the numbers shown next to the rings, so they always agree.
  const percent =
    data.target > 0 ? Math.min(data.current / data.target, 1) * 100 : 0;
  const progress = ((100 - percent) / 100) * circumference;
  const progressLabel = `${data.label} Activity Progress - ${Math.round(percent)}%`;

  const gradientId = useId();
  const gradientUrl = `url(#${gradientId})`;

  return (
    <motion.div
      animate={inView ? { opacity: 1, scale: 1 } : undefined}
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.2, ease: EASE_OUT }}
    >
      <div className="relative">
        <svg
          aria-label={progressLabel}
          className="-rotate-90"
          height={data.size}
          viewBox={`0 0 ${data.size} ${data.size}`}
          width={data.size}
        >
          <title>{progressLabel}</title>

          <defs>
            <linearGradient id={gradientId} x1="0%" x2="100%" y1="0%" y2="100%">
              <stop
                offset="0%"
                style={{
                  stopColor: data.color,
                  stopOpacity: 1,
                }}
              />
              <stop
                offset="100%"
                style={{
                  stopColor: data.colorEnd,
                  stopOpacity: 1,
                }}
              />
            </linearGradient>
          </defs>

          <circle
            className="text-zinc-200/50 dark:text-zinc-800/50"
            cx={data.size / 2}
            cy={data.size / 2}
            fill="none"
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
          />

          <motion.circle
            animate={{ strokeDashoffset: inView ? progress : circumference }}
            cx={data.size / 2}
            cy={data.size / 2}
            fill="none"
            initial={{ strokeDashoffset: circumference }}
            r={radius}
            stroke={gradientUrl}
            strokeDasharray={circumference}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            transition={
              // MotionConfig only skips transforms; the draw isn't one.
              reduceMotion
                ? { duration: 0 }
                : { duration: 1.1, delay: index * 0.2, ease: EASE_OUT }
            }
          />
        </svg>
      </div>
    </motion.div>
  );
};

const DetailedActivityInfo = ({
  activities,
  inView,
}: {
  activities: ActivityData[];
  inView: boolean;
}) => {
  return (
    <motion.div
      animate={inView ? { opacity: 1, x: 0 } : undefined}
      className="flex flex-col gap-6"
      initial={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.5, delay: 0.3, ease: EASE_OUT }}
    >
      {activities.map((activity) => (
        <div className="flex flex-col" key={activity.label}>
          <span className="font-medium text-sm text-zinc-600 dark:text-zinc-400">
            {activity.label}
          </span>
          {/* The ring hues are too light for text on white, so light mode
              darkens them (3:1 or better for this large text). */}
          <span
            className="font-semibold text-2xl text-[color-mix(in_oklab,var(--activity-color)_70%,black)] dark:text-(--activity-color)"
            style={{ "--activity-color": activity.color } as CSSProperties}
          >
            {activity.current}/{activity.target}
            <span className="ml-1 text-base text-zinc-600 dark:text-zinc-400">
              {activity.unit}
            </span>
          </span>
        </div>
      ))}
    </motion.div>
  );
};

export default function AppleActivityCard({
  title = "Activity Rings",
  titleAs = "h2",
  activities = SAMPLE_ACTIVITIES,
  className,
}: {
  title?: string;
  /** Heading level for the title, to fit the page outline. */
  titleAs?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  /** Rings, outermost first. Defaults to sample data. */
  activities?: ActivityData[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const Heading = motion[titleAs];
  const boxSize = activities.length
    ? Math.max(...activities.map((activity) => activity.size))
    : 0;
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-3xl rounded-3xl p-8",
        "text-zinc-900 dark:text-white",
        className
      )}
      ref={ref}
    >
      {/* Reduced motion keeps the fades and drops the scale/slide. */}
      <MotionConfig reducedMotion="user">
        <div className="flex flex-col items-center gap-8">
          <Heading
            animate={inView ? { opacity: 1, y: 0 } : undefined}
            className="font-medium text-2xl text-zinc-900 dark:text-white"
            initial={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
          >
            {title}
          </Heading>

          <div className="flex flex-col items-center gap-8 sm:flex-row">
            <div
              className="relative shrink-0"
              style={{ width: boxSize, height: boxSize }}
            >
              {activities.map((activity, index) => (
                <CircleProgress
                  data={activity}
                  index={index}
                  inView={inView}
                  key={activity.label}
                  reduceMotion={reduceMotion}
                />
              ))}
            </div>
            <DetailedActivityInfo activities={activities} inView={inView} />
          </div>
        </div>
      </MotionConfig>
    </div>
  );
}
