"use client";

/**
 * @author: @kokonutui
 * @description: AI Connect
 * @version: 1.0.0
 * @date: 2026-10-31
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, GitPullRequest, Pause } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface AIConnectProps {
  prompt?: string;
  /** The app the tool needs, e.g. "GitHub". */
  app?: string;
  /** Its mark, about 16px. */
  logo?: ReactNode;
  /** Why the agent needs it, e.g. "To open pull requests on acme/web". */
  reason?: string;
  /** The tool call, while running and once done. */
  running?: string;
  done?: string;
  /** Shown on the right of the call once done, e.g. "#142". */
  result?: string;
  answer?: string;
  /** Runs your OAuth flow. Resolve once connected, throw if cancelled. */
  onConnect?: () => Promise<void>;
  className?: string;
}

type Step =
  | "running"
  | "blocked"
  | "authorizing"
  | "connected"
  | "resumed"
  | "done"
  | "skipped";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

const demoConnect = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 1400));

/** How long each automatic step lasts in the demo. */
const AUTO: Partial<Record<Step, [number, Step]>> = {
  running: [900, "blocked"],
  connected: [800, "resumed"],
  resumed: [1100, "done"],
};

export default function AIConnect({
  prompt = "Open a PR with the theme fix",
  app = "GitHub",
  logo,
  reason = "To open pull requests on kokonut/web",
  running = "Opening a pull request",
  done = "Opened a pull request",
  result = "#142",
  answer = "Opened #142, “Fix theme flash on load”, against main. CI is running now.",
  onConnect = demoConnect,
  className,
}: AIConnectProps) {
  const [step, setStep] = useState<Step>("running");
  const mark = logo ?? <GitHubMark className="size-4" />;

  useEffect(() => {
    const auto = AUTO[step];
    if (!auto) {
      return;
    }
    const t = setTimeout(() => setStep(auto[1]), auto[0]);
    return () => clearTimeout(t);
  }, [step]);

  const connect = async () => {
    setStep("authorizing");
    try {
      await onConnect();
      setStep("connected");
    } catch {
      setStep("blocked");
    }
  };

  const asking =
    step === "blocked" || step === "authorizing" || step === "connected";
  const busy = step === "running" || step === "resumed";
  const connected = step === "resumed" || step === "done";

  let label = running;
  if (step === "done") {
    label = done;
  } else if (step === "blocked" || step === "authorizing") {
    label = `Needs ${app} to continue`;
  } else if (step === "skipped") {
    label = "Stopped";
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("flex w-full max-w-md flex-col gap-3", className)}>
        <p className="mb-1 max-w-[85%] self-end rounded-2xl rounded-br-md bg-zinc-100 px-3.5 py-2 text-[14px] text-zinc-800 leading-snug dark:bg-zinc-800 dark:text-zinc-100">
          {prompt}
        </p>

        <div className="flex h-7 items-center gap-2 text-[13px]">
          <span className="flex size-5 items-center justify-center text-zinc-900 dark:text-zinc-100">
            <StateIcon step={step} />
          </span>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ opacity: 1, filter: "blur(0px)" }}
              className={cn(
                step === "done" || step === "skipped"
                  ? "text-zinc-600 dark:text-zinc-400"
                  : "text-zinc-900 dark:text-zinc-100"
              )}
              exit={{ opacity: 0, filter: "blur(2px)" }}
              initial={{ opacity: 0, filter: "blur(2px)" }}
              key={label}
              transition={{ duration: 0.18 }}
            >
              {label}
            </motion.span>
          </AnimatePresence>
          <AnimatePresence>
            {connected && (
              <motion.span
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1 text-[12px] text-zinc-400 dark:text-zinc-500"
                initial={{ opacity: 0, x: -4 }}
                transition={{ duration: 0.25, ease: EASE_OUT, delay: 0.2 }}
              >
                via{" "}
                <span className="text-zinc-700 dark:text-zinc-300">{mark}</span>
              </motion.span>
            )}
          </AnimatePresence>
          {step === "done" && (
            <motion.span
              animate={{ opacity: 1 }}
              className="ml-auto flex items-center gap-1 font-mono text-[12px] text-zinc-600 dark:text-zinc-300"
              initial={{ opacity: 0 }}
            >
              <GitPullRequest aria-hidden="true" className="size-3.5" />
              {result}
            </motion.span>
          )}
          {busy && <Busy />}
        </div>

        <AnimatePresence initial={false}>
          {asking && (
            <motion.div
              animate={{ height: "auto", opacity: 1 }}
              className="overflow-hidden"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
            >
              <ConnectCard
                app={app}
                logo={mark}
                onConnect={connect}
                onSkip={() => setStep("skipped")}
                reason={reason}
                step={step}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {step === "done" && (
            <motion.p
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              className="mt-1 text-[15px] text-zinc-800 leading-7 dark:text-zinc-200"
              initial={{ opacity: 0, filter: "blur(4px)", y: 4 }}
              transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.15 }}
            >
              {answer}
            </motion.p>
          )}
          {step === "skipped" && (
            <motion.p
              animate={{ opacity: 1 }}
              className="mt-1 text-[15px] text-zinc-800 leading-7 dark:text-zinc-200"
              initial={{ opacity: 0 }}
            >
              No problem. The branch is pushed, so you can open the PR from{" "}
              {app} whenever you like.
            </motion.p>
          )}
        </AnimatePresence>
        <p aria-live="polite" className="sr-only">
          {label}
        </p>
      </div>
    </MotionConfig>
  );
}

function ConnectCard({
  app,
  logo,
  reason,
  step,
  onConnect,
  onSkip,
}: {
  app: string;
  logo: ReactNode;
  reason: string;
  step: Step;
  onConnect: () => void;
  onSkip: () => void;
}) {
  const waiting = step === "authorizing";
  const linked = step === "connected";

  return (
    <div className="mt-1 rounded-2xl bg-white p-4 ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10">
      <div className="flex items-start gap-3">
        <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
          {logo}
          <AnimatePresence>
            {linked && (
              <motion.span
                animate={{ scale: 1, opacity: 1 }}
                className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-emerald-600 text-white ring-2 ring-white dark:bg-emerald-500 dark:ring-zinc-900"
                initial={{ scale: 0.4, opacity: 0 }}
                transition={{ type: "spring", stiffness: 520, damping: 24 }}
              >
                <Check className="size-2.5" strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[14px] text-zinc-900 dark:text-zinc-100">
            {linked ? `${app} connected` : `Connect ${app}`}
          </p>
          <p className="mt-0.5 text-[13px] text-zinc-500 leading-snug dark:text-zinc-400">
            {linked ? "Picking up where it stopped…" : reason}
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          className="h-9 rounded-lg px-3 text-[13px] text-zinc-600 outline-hidden transition-colors duration-100 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400/50 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-white/[0.07]"
          disabled={step !== "blocked"}
          onClick={onSkip}
          type="button"
        >
          Not now
        </button>
        <button
          aria-busy={waiting}
          className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 font-medium text-[13px] text-white outline-hidden transition-colors duration-150 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400/60 focus-visible:ring-offset-2 disabled:pointer-events-none dark:bg-white dark:text-zinc-900 dark:focus-visible:ring-offset-zinc-900 dark:hover:bg-zinc-200"
          disabled={step !== "blocked"}
          onClick={onConnect}
          type="button"
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2"
              exit={{ opacity: 0, y: -6 }}
              initial={{ opacity: 0, y: 6 }}
              key={step}
              transition={{ duration: 0.18, ease: EASE_OUT }}
            >
              {waiting && <Spinner />}
              {linked && <Check aria-hidden="true" className="size-4" />}
              {waiting && `Waiting for ${app}…`}
              {linked && "Connected"}
              {!(waiting || linked) && "Connect"}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
    </div>
  );
}

function StateIcon({ step }: { step: Step }) {
  let icon: ReactNode = <Spinner />;
  let key = "spin";
  if (step === "done") {
    icon = (
      <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
    );
    key = "done";
  } else if (
    step === "blocked" ||
    step === "authorizing" ||
    step === "connected"
  ) {
    icon = (
      <Pause className="size-3 fill-current text-zinc-500 dark:text-zinc-400" />
    );
    key = "pause";
  } else if (step === "skipped") {
    icon = (
      <span className="size-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
    );
    key = "skip";
  }
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center justify-center"
        exit={{ opacity: 0, scale: 0.6 }}
        initial={{ opacity: 0, scale: 0.6 }}
        key={key}
        transition={{ duration: 0.2, ease: EASE_OUT }}
      >
        {icon}
      </motion.span>
    </AnimatePresence>
  );
}

/** A faint bar that runs under the label while the call works. */
function Busy() {
  return (
    <span className="relative ml-auto h-px w-14 overflow-hidden bg-zinc-200 dark:bg-zinc-700">
      <motion.span
        animate={{ x: ["-100%", "250%"] }}
        className="absolute inset-y-0 w-6 bg-zinc-500 dark:bg-zinc-300"
        transition={{
          duration: 1.1,
          ease: "easeInOut",
          repeat: Number.POSITIVE_INFINITY,
        }}
      />
    </span>
  );
}

function Spinner() {
  return (
    <motion.svg
      animate={{ rotate: 360 }}
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      transition={{
        duration: 0.8,
        ease: "linear",
        repeat: Number.POSITIVE_INFINITY,
      }}
      viewBox="0 0 16 16"
    >
      <circle
        cx="8"
        cy="8"
        opacity="0.2"
        r="6.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </motion.svg>
  );
}
