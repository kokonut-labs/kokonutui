"use client";

/**
 * @author: @kokonutui
 * @description: Inline Alert
 * @version: 1.0.0
 * @date: 2026-11-08
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Rocket,
  X,
} from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface AlertCheck {
  name: string;
  /** Why it failed, shown under the name. */
  detail?: string;
  ok: boolean;
}

export interface InlineAlertProps {
  checks?: AlertCheck[];
  /** Where the checks ran, shown in the message. */
  target?: string;
  /** ms each failed check takes to pass again. */
  retryMs?: number;
  onDeploy?: () => void;
  className?: string;
}

const DEMO_CHECKS: AlertCheck[] = [
  { name: "Build", ok: true },
  { name: "Unit tests", detail: "3 failing in auth.test.ts", ok: false },
  { name: "Lint", ok: true },
  { name: "Type check", detail: "2 errors in billing.ts", ok: false },
];

type Phase = "failed" | "retrying" | "passed" | "deploying" | "deployed";

const ICON_TONE: Record<Phase, string> = {
  failed: "bg-rose-500",
  retrying: "bg-sky-500",
  passed: "bg-emerald-500",
  deploying: "bg-emerald-500",
  deployed: "bg-emerald-500",
};

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const DEPLOY_MS = 1400;

export default function InlineAlert({
  checks: initialChecks = DEMO_CHECKS,
  target = "main · 4f2a91c",
  retryMs = 900,
  onDeploy,
  className,
}: InlineAlertProps) {
  const allPass = initialChecks.every((c) => c.ok);
  const [checks, setChecks] = useState(initialChecks);
  const [running, setRunning] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>(allPass ? "passed" : "failed");
  const [open, setOpen] = useState(true);
  const [visible, setVisible] = useState(true);
  const timer = useRef<number>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const failed = checks.filter((c) => !c.ok);
  const passedShare = (checks.length - failed.length) / checks.length;

  // Re-run the failed checks one after another; each one passes this time.
  const retry = () => {
    setPhase("retrying");
    setOpen(true);
    const queue = failed.map((c) => c.name);
    const step = (i: number) => {
      if (i >= queue.length) {
        setRunning(null);
        setPhase("passed");
        return;
      }
      setRunning(queue[i]);
      timer.current = window.setTimeout(() => {
        setChecks((all) =>
          all.map((c) =>
            c.name === queue[i] ? { ...c, ok: true, detail: undefined } : c
          )
        );
        step(i + 1);
      }, retryMs);
    };
    step(0);
  };

  const deploy = () => {
    setPhase("deploying");
    timer.current = window.setTimeout(() => {
      setPhase("deployed");
      setOpen(false);
      onDeploy?.();
    }, DEPLOY_MS);
  };

  const reset = () => {
    window.clearTimeout(timer.current);
    setChecks(initialChecks);
    setRunning(null);
    setPhase(allPass ? "passed" : "failed");
    setOpen(true);
    setVisible(true);
  };

  const copy: Record<Phase, [string, string]> = {
    failed: [
      "Deploy blocked",
      `${failed.length} of ${checks.length} checks failed on ${target}`,
    ],
    retrying: ["Running checks again", `${failed.length} left on ${target}`],
    passed: ["Ready to deploy", `All ${checks.length} checks passed`],
    deploying: ["Deploying", "Uploading to production"],
    deployed: ["Deployed", "Live on production · just now"],
  };
  const [title, message] = copy[phase];
  // Green wipes in as checks pass; it stays put once they all have.
  let green = 0;
  if (phase === "retrying") {
    green = passedShare;
  } else if (phase !== "failed") {
    green = 1;
  }
  const showChecks = phase !== "deployed";

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("w-full max-w-md", className)}>
        <AnimatePresence initial={false} mode="popLayout">
          {visible ? (
            <motion.div
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="relative overflow-hidden rounded-2xl text-zinc-900 dark:text-zinc-50"
              exit={{
                opacity: 0,
                y: -4,
                scale: 0.98,
                transition: { duration: 0.15 },
              }}
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              key="alert"
              role={phase === "failed" ? "alert" : "status"}
              transition={{ duration: 0.25, ease: EASE_OUT }}
            >
              <div
                aria-hidden="true"
                className="absolute inset-0 rounded-2xl border border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/40"
              />
              <motion.div
                animate={{ clipPath: `inset(0% ${(1 - green) * 100}% 0% 0%)` }}
                aria-hidden="true"
                className="absolute inset-0 rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40"
                initial={false}
                transition={{ duration: 0.6, ease: EASE_OUT }}
              />

              <div className="relative flex gap-3 p-4">
                <span
                  className={cn(
                    "relative flex size-7 shrink-0 items-center justify-center rounded-full text-white transition-colors duration-300",
                    ICON_TONE[phase]
                  )}
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, scale: 0.8, filter: "blur(2px)" }}
                      initial={{ opacity: 0, scale: 0.8, filter: "blur(2px)" }}
                      key={phase === "deploying" ? "passed" : phase}
                      transition={{ duration: 0.2, ease: EASE_OUT }}
                    >
                      <PhaseIcon phase={phase} />
                    </motion.span>
                  </AnimatePresence>
                </span>

                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-start justify-between gap-3">
                    <div aria-live="polite" className="relative min-w-0">
                      <AnimatePresence initial={false} mode="popLayout">
                        <motion.div
                          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                          exit={{ opacity: 0, y: -4, filter: "blur(2px)" }}
                          initial={{ opacity: 0, y: 4, filter: "blur(2px)" }}
                          key={`${title}${message}`}
                          transition={{ duration: 0.2, ease: EASE_OUT }}
                        >
                          <p className="font-semibold text-[14.5px] leading-5">
                            {title}
                          </p>
                          <p className="mt-0.5 text-[13px] text-zinc-600 tabular-nums dark:text-zinc-400">
                            {message}
                          </p>
                        </motion.div>
                      </AnimatePresence>
                    </div>
                    <button
                      aria-label="Dismiss"
                      className="-mt-1 -mr-1 flex size-7 shrink-0 items-center justify-center rounded-full text-zinc-500 outline-hidden transition-colors duration-150 hover:bg-black/5 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400/50 active:bg-black/10 dark:text-zinc-400 dark:active:bg-white/20 dark:hover:bg-white/10 dark:hover:text-zinc-100"
                      onClick={() => setVisible(false)}
                      type="button"
                    >
                      <X aria-hidden="true" className="size-4" />
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {showChecks && open && (
                      <motion.ul
                        animate={{
                          height: "auto",
                          opacity: 1,
                          transition: {
                            height: { duration: 0.3, ease: EASE_OUT },
                            opacity: { duration: 0.2, delay: 0.08 },
                          },
                        }}
                        className="overflow-hidden"
                        exit={{
                          height: 0,
                          opacity: 0,
                          transition: {
                            height: { duration: 0.25, ease: EASE_OUT },
                            opacity: { duration: 0.12 },
                          },
                        }}
                        initial={{ height: 0, opacity: 0 }}
                      >
                        {checks.map((check) => (
                          <CheckRow
                            check={check}
                            key={check.name}
                            running={running === check.name}
                          />
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>

                  <AnimatePresence initial={false}>
                    {phase !== "deploying" && phase !== "deployed" && (
                      <motion.div
                        animate={{ height: "auto", opacity: 1 }}
                        className="overflow-hidden"
                        exit={{ height: 0, opacity: 0 }}
                        initial={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: EASE_OUT }}
                      >
                        <div className="flex items-center gap-2 pt-3">
                          {phase === "failed" && (
                            <AlertButton onClick={retry} primary>
                              Retry {failed.length} failed
                            </AlertButton>
                          )}
                          {phase === "passed" && (
                            <AlertButton onClick={deploy} primary>
                              <Rocket aria-hidden="true" className="size-3.5" />
                              Deploy
                            </AlertButton>
                          )}
                          <AlertButton
                            ariaExpanded={open}
                            onClick={() => setOpen(!open)}
                          >
                            {open ? "Hide checks" : "Show checks"}
                            <ChevronDown
                              aria-hidden="true"
                              className={cn(
                                "size-3.5 transition-transform duration-200",
                                open && "rotate-180"
                              )}
                            />
                          </AlertButton>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Deploy progress runs along the bottom edge. */}
              <AnimatePresence>
                {phase === "deploying" && (
                  <motion.span
                    animate={{ scaleX: 1 }}
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-emerald-500"
                    exit={{ opacity: 0, transition: { duration: 0.3 } }}
                    initial={{ scaleX: 0 }}
                    transition={{
                      duration: DEPLOY_MS / 1000,
                      ease: [0.33, 0.6, 0.4, 1],
                    }}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.button
              animate={{ opacity: 1 }}
              className="h-10 w-full rounded-2xl border border-zinc-300 border-dashed text-[13px] text-zinc-500 outline-hidden transition-colors duration-150 hover:text-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
              initial={{ opacity: 0 }}
              key="restore"
              onClick={reset}
              transition={{ duration: 0.2, delay: 0.1 }}
              type="button"
            >
              Bring the alert back
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

function PhaseIcon({ phase }: { phase: Phase }) {
  if (phase === "retrying") {
    return <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />;
  }
  if (phase === "deployed") {
    return <Rocket aria-hidden="true" className="size-4" />;
  }
  if (phase === "passed" || phase === "deploying") {
    return <CircleCheck aria-hidden="true" className="size-4" />;
  }
  return <CircleAlert aria-hidden="true" className="size-4" />;
}

function CheckRow({ check, running }: { check: AlertCheck; running: boolean }) {
  let status = "Failed";
  if (running) {
    status = "Running";
  } else if (check.ok) {
    status = "Passed";
  }
  return (
    <li className="flex items-start gap-2.5 pt-2.5 first:pt-3">
      <span className="relative mt-0.5 flex size-4 shrink-0 items-center justify-center">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            className="flex"
            exit={{ opacity: 0, scale: 0.8, filter: "blur(2px)" }}
            initial={{ opacity: 0, scale: 0.8, filter: "blur(2px)" }}
            key={status}
            transition={{ duration: 0.18, ease: EASE_OUT }}
          >
            <CheckGlyph status={status} />
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="min-w-0 flex-1 text-[13px]">
        <span className="flex items-center justify-between gap-2">
          <span className="font-medium">{check.name}</span>
          <span className="relative text-[12px] text-zinc-500 dark:text-zinc-400">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ opacity: 1, y: 0 }}
                className="block"
                exit={{ opacity: 0, y: -4 }}
                initial={{ opacity: 0, y: 4 }}
                key={status}
                transition={{ duration: 0.18, ease: EASE_OUT }}
              >
                {status}
              </motion.span>
            </AnimatePresence>
          </span>
        </span>
        <AnimatePresence initial={false}>
          {check.detail && (
            <motion.span
              animate={{ height: "auto", opacity: 1 }}
              className="block overflow-hidden"
              exit={{
                height: 0,
                opacity: 0,
                transition: {
                  height: { duration: 0.25, ease: EASE_OUT },
                  opacity: { duration: 0.12 },
                },
              }}
              initial={{ height: 0, opacity: 0 }}
            >
              <span
                className={cn(
                  "block font-mono text-[11.5px] text-zinc-600 transition-opacity duration-200 dark:text-zinc-400",
                  running && "opacity-50"
                )}
              >
                {check.detail}
              </span>
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </li>
  );
}

function CheckGlyph({ status }: { status: string }) {
  if (status === "Running") {
    return (
      <LoaderCircle
        aria-hidden="true"
        className="size-4 animate-spin text-sky-500"
      />
    );
  }
  if (status === "Passed") {
    return (
      <svg
        aria-hidden="true"
        className="size-4 text-emerald-500"
        fill="none"
        viewBox="0 0 16 16"
      >
        <circle cx={8} cy={8} fill="currentColor" opacity={0.15} r={8} />
        <motion.path
          animate={{ pathLength: 1 }}
          d="M5 8.2l2 2 4-4.2"
          initial={{ pathLength: 0 }}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          transition={{ duration: 0.25, delay: 0.05, ease: EASE_OUT }}
        />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      className="size-4 text-rose-500"
      fill="none"
      viewBox="0 0 16 16"
    >
      <circle cx={8} cy={8} fill="currentColor" opacity={0.15} r={8} />
      <path
        d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={1.8}
      />
    </svg>
  );
}

function AlertButton({
  onClick,
  primary,
  ariaExpanded,
  children,
}: {
  onClick: () => void;
  primary?: boolean;
  ariaExpanded?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      aria-expanded={ariaExpanded}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full px-3 font-medium text-[12.5px] outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-zinc-400/50",
        primary
          ? "bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:active:bg-zinc-300 dark:hover:bg-zinc-200"
          : "bg-black/5 hover:bg-black/10 active:bg-black/15 dark:bg-white/10 dark:active:bg-white/20 dark:hover:bg-white/15"
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
