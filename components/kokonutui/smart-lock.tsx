"use client";

/**
 * @author: @kokonutui
 * @description: Smart Lock
 * @version: 1.0.0
 * @date: 2026-11-07
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { BatteryMedium } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SmartLockProps {
  door?: string;
  /** Seconds before an open door locks itself. */
  autoLockSeconds?: number;
  battery?: number;
  onLockChange?: (locked: boolean) => void;
  className?: string;
}

type Stage = "locked" | "unlocking" | "open";

const SIZE = 200;
const C = SIZE / 2;
const R = 92;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const UNLOCK_S = 0.9;

export default function SmartLock({
  door = "Front door",
  autoLockSeconds = 15,
  battery = 82,
  onLockChange,
  className,
}: SmartLockProps) {
  const uid = useId();
  const [stage, setStage] = useState<Stage>("locked");
  const [left, setLeft] = useState(autoLockSeconds);
  const [lastEvent, setLastEvent] = useState("Locked by Mara at 08:12");
  const onChange = useRef(onLockChange);
  onChange.current = onLockChange;

  // The ring sweeps round once, then the door opens.
  useEffect(() => {
    if (stage !== "unlocking") {
      return;
    }
    const id = window.setTimeout(() => {
      setStage("open");
      setLastEvent("Unlocked by you just now");
      onChange.current?.(false);
    }, UNLOCK_S * 1000);
    return () => window.clearTimeout(id);
  }, [stage]);

  // An open door counts down, then locks itself.
  useEffect(() => {
    if (stage !== "open") {
      setLeft(autoLockSeconds);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => {
      const remaining =
        autoLockSeconds - Math.floor((Date.now() - started) / 1000);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        window.clearInterval(id);
        setStage("locked");
        setLastEvent("Locked itself just now");
        onChange.current?.(true);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [stage, autoLockSeconds]);

  const press = () => {
    if (stage === "locked") {
      setStage("unlocking");
    } else if (stage === "open") {
      setStage("locked");
      setLastEvent("Locked by you just now");
      onChange.current?.(true);
    }
  };

  const open = stage === "open";
  const gradient = `url(#${uid}-ring)`;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "relative isolate w-full max-w-sm overflow-hidden rounded-[28px] border border-zinc-200 bg-white p-5 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
      >
        <motion.div
          animate={{ opacity: open ? 0.55 : 0 }}
          aria-hidden="true"
          className="absolute inset-x-0 top-10 -z-10 mx-auto size-64 rounded-full blur-3xl"
          initial={false}
          style={{
            background:
              "conic-gradient(from 90deg, #34d399, #22d3ee, #a78bfa, #34d399)",
          }}
          transition={{ duration: 0.6 }}
        />

        <div className="flex items-center justify-between text-[13px]">
          <span className="font-medium">{door}</span>
          <span className="flex items-center gap-1.5 text-zinc-500 tabular-nums dark:text-zinc-400">
            <BatteryMedium aria-hidden="true" className="size-3.5" />
            {battery}%
          </span>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            aria-label={open ? `Lock ${door}` : `Unlock ${door}`}
            aria-pressed={!open}
            className="relative rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-zinc-950"
            disabled={stage === "unlocking"}
            onClick={press}
            style={{ width: SIZE, height: SIZE }}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="absolute inset-0 -rotate-90"
              viewBox={`0 0 ${SIZE} ${SIZE}`}
            >
              <defs>
                <linearGradient id={`${uid}-ring`} x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#34d399" />
                  <stop offset="0.5" stopColor="#22d3ee" />
                  <stop offset="1" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
              <circle
                className="fill-none stroke-zinc-100 dark:stroke-zinc-900"
                cx={C}
                cy={C}
                r={R}
                strokeWidth={6}
              />
              {stage === "unlocking" && (
                <motion.circle
                  animate={{ pathLength: 1 }}
                  cx={C}
                  cy={C}
                  fill="none"
                  initial={{ pathLength: 0 }}
                  r={R}
                  stroke={gradient}
                  strokeLinecap="round"
                  strokeWidth={6}
                  transition={{ duration: UNLOCK_S, ease: "easeInOut" }}
                />
              )}
              {open && (
                // Time left before it locks itself.
                <motion.circle
                  animate={{ pathLength: left / autoLockSeconds }}
                  cx={C}
                  cy={C}
                  fill="none"
                  initial={{ pathLength: 1 }}
                  r={R}
                  stroke={gradient}
                  strokeLinecap="round"
                  strokeWidth={6}
                  transition={{ duration: 0.3, ease: "linear" }}
                />
              )}
            </svg>

            <AnimatePresence>
              {open && (
                <motion.span
                  animate={{ scale: 1.5, opacity: 0 }}
                  aria-hidden="true"
                  className="absolute inset-4 rounded-full border-2 border-emerald-400"
                  exit={{ opacity: 0 }}
                  initial={{ scale: 1, opacity: 0.7 }}
                  transition={{ duration: 0.9, ease: EASE_OUT }}
                />
              )}
            </AnimatePresence>

            <span className="absolute inset-4 overflow-hidden rounded-full">
              <span className="absolute inset-0 bg-zinc-900 dark:bg-zinc-100" />
              <motion.span
                animate={{ opacity: open ? 1 : 0 }}
                className="absolute inset-0"
                initial={false}
                style={{
                  background:
                    "linear-gradient(140deg, #34d399, #22d3ee 55%, #a78bfa)",
                }}
                transition={{ duration: 0.5 }}
              />
              {open && (
                <motion.span
                  animate={{ rotate: 360 }}
                  aria-hidden="true"
                  className="absolute -inset-1/4 opacity-50 mix-blend-soft-light"
                  style={{
                    background:
                      "conic-gradient(from 0deg, white, transparent 35%, transparent 65%, white)",
                  }}
                  transition={{
                    duration: 6,
                    ease: "linear",
                    repeat: Number.POSITIVE_INFINITY,
                  }}
                />
              )}
              <span className="absolute inset-0 flex items-center justify-center">
                <LockGlyph open={open} />
              </span>
            </span>
          </button>
        </div>

        <div className="relative mt-6 h-12 overflow-hidden text-center">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(3px)" }}
              initial={{ opacity: 0, y: 10, filter: "blur(3px)" }}
              key={stage}
              transition={{ duration: 0.25, ease: EASE_OUT }}
            >
              <p className="font-semibold text-[20px] tracking-tight">
                {
                  {
                    locked: "Locked",
                    unlocking: "Unlocking…",
                    open: "Unlocked",
                  }[stage]
                }
              </p>
              <p className="text-[13px] text-zinc-500 tabular-nums dark:text-zinc-400">
                {subtitle(stage, left)}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-zinc-100 px-3 py-2.5 text-[12.5px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          <span
            className={cn(
              "size-1.5 rounded-full",
              open ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"
            )}
          />
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key={lastEvent}
              transition={{ duration: 0.2 }}
            >
              {lastEvent}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}

function subtitle(stage: Stage, left: number) {
  if (stage === "open") {
    return `Locks itself in ${left}s · tap to lock now`;
  }
  return stage === "unlocking" ? "Talking to the lock" : "Tap to unlock";
}

/** A padlock whose shackle lifts and swings open. */
function LockGlyph({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "size-16 transition-colors duration-300",
        open ? "text-white" : "text-white dark:text-zinc-900"
      )}
      fill="none"
      viewBox="0 0 48 48"
    >
      <motion.path
        animate={open ? { y: -4, rotate: -28 } : { y: 0, rotate: 0 }}
        d="M16 22V15a8 8 0 0 1 16 0v7"
        initial={false}
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={3.5}
        style={{ transformBox: "view-box", transformOrigin: "16px 22px" }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
      />
      <rect fill="currentColor" height={19} rx={5} width={28} x={10} y={22} />
      <motion.circle
        animate={{ opacity: open ? 0 : 1 }}
        className={
          open ? "fill-transparent" : "fill-zinc-900 dark:fill-zinc-100"
        }
        cx={24}
        cy={31}
        initial={false}
        r={2.5}
      />
    </svg>
  );
}
