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

import { Ban, Check, Eye, GitPullRequest, Lock, Pause } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface ConnectScope {
  label: string;
  /** A limit rather than a permission, shown struck through in grey. */
  denied?: boolean;
  icon?: ReactNode;
}

export interface AIConnectProps {
  prompt?: string;
  /** Your product's name, as the person knows it. */
  agent?: string;
  /** Your product's mark, about 18px. */
  agentLogo?: ReactNode;
  /** The app the tool needs, e.g. "GitHub". */
  app?: string;
  /** Its mark, about 18px. */
  appLogo?: ReactNode;
  /** Background of the app's tile and button, its brand colour. */
  appColor?: string;
  /** Why it's needed, e.g. "to open a pull request on acme/web". */
  reason?: string;
  scopes?: ConnectScope[];
  /** The tool call, while running and once done. */
  running?: string;
  done?: string;
  /** What the call works on, e.g. a repo. */
  target?: string;
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

type Link = "idle" | "waiting" | "linked";

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

const DEMO_SCOPES: ConnectScope[] = [
  { label: "Read code in kokonut/web", icon: <Eye className="size-3.5" /> },
  {
    label: "Open and update pull requests",
    icon: <GitPullRequest className="size-3.5" />,
  },
  {
    label: "Push to main or change settings",
    denied: true,
    icon: <Ban className="size-3.5" />,
  },
];

const demoConnect = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 1600));

/** Steps that move on by themselves, and after how long. */
const AUTO: Partial<Record<Step, [number, Step]>> = {
  running: [900, "blocked"],
  connected: [1000, "resumed"],
  resumed: [1200, "done"],
};

export default function AIConnect({
  prompt = "Open a PR with the theme fix",
  agent = "Kokonut",
  agentLogo,
  app = "GitHub",
  appLogo,
  appColor = "#1f2328",
  reason = "to open a pull request on kokonut/web",
  scopes = DEMO_SCOPES,
  running = "Opening a pull request",
  done = "Opened a pull request",
  target = "kokonut/web",
  result = "#142",
  answer = "Opened #142, “Fix theme flash on load”, against main. CI is running now.",
  onConnect = demoConnect,
  className,
}: AIConnectProps) {
  const [step, setStep] = useState<Step>("running");
  const logo = appLogo ?? <GitHubMark className="size-[18px]" />;

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

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("flex w-full max-w-md flex-col gap-4", className)}>
        <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-zinc-100 px-3.5 py-2 text-[14px] text-zinc-800 leading-snug dark:bg-zinc-800 dark:text-zinc-100">
          {prompt}
        </p>

        <AutoHeight className="rounded-[22px] bg-black/[0.04] dark:bg-white/[0.06]">
          <CallBand
            app={app}
            done={done}
            logo={logo}
            result={result}
            running={running}
            step={step}
            target={target}
          />
          <AnimatePresence initial={false}>
            {asking && (
              <motion.div
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(4px)" }}
                initial={{ opacity: 0, filter: "blur(4px)" }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
              >
                <AccessCard
                  agent={agent}
                  agentLogo={agentLogo}
                  app={app}
                  appColor={appColor}
                  logo={logo}
                  onConnect={connect}
                  onSkip={() => setStep("skipped")}
                  reason={reason}
                  scopes={scopes}
                  step={step}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </AutoHeight>

        <AnimatePresence>
          {(step === "done" || step === "skipped") && (
            <motion.p
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              className="text-[15px] text-zinc-800 leading-7 dark:text-zinc-200"
              initial={{ opacity: 0, filter: "blur(4px)", y: 4 }}
              transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.15 }}
            >
              {step === "done"
                ? answer
                : `No problem. The branch is pushed, so you can open the PR on ${app} whenever you like.`}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

/** The tool call itself, in the frame above the access card. */
function CallBand({
  step,
  app,
  logo,
  running,
  done,
  target,
  result,
}: {
  step: Step;
  app: string;
  logo: ReactNode;
  running: string;
  done: string;
  target: string;
  result: string;
}) {
  const paused = step === "blocked" || step === "authorizing";
  const via = step === "resumed" || step === "done";

  let label = running;
  if (step === "done") {
    label = done;
  } else if (step === "skipped") {
    label = "Stopped before the pull request";
  }

  return (
    <div className="flex h-10 items-center gap-2 px-4 text-[13px]">
      <span className="flex size-4 items-center justify-center text-zinc-900 dark:text-zinc-100">
        <StateIcon step={step} />
      </span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ opacity: 1, filter: "blur(0px)" }}
          className={cn(
            "shrink-0",
            step === "done" || step === "skipped"
              ? "text-zinc-600 dark:text-zinc-400"
              : "font-medium text-zinc-900 dark:text-zinc-100"
          )}
          exit={{ opacity: 0, filter: "blur(2px)" }}
          initial={{ opacity: 0, filter: "blur(2px)" }}
          key={label}
          transition={{ duration: 0.18 }}
        >
          {label}
        </motion.span>
      </AnimatePresence>
      {step !== "skipped" && (
        <span className="min-w-0 truncate font-mono text-[11.5px] text-zinc-400 dark:text-zinc-500">
          {target}
        </span>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-2 pl-2">
        <AnimatePresence initial={false} mode="popLayout">
          {paused && (
            <motion.span
              animate={{ opacity: 1 }}
              className="text-[12px] text-zinc-500 dark:text-zinc-400"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key="paused"
            >
              Needs {app}
            </motion.span>
          )}
          {via && (
            <motion.span
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1.5 text-[12px]"
              initial={{ opacity: 0, x: 4 }}
              key="via"
              transition={{ duration: 0.25, ease: EASE_OUT }}
            >
              <span className="text-zinc-800 dark:text-zinc-200 [&_svg]:size-3.5">
                {logo}
              </span>
              {step === "done" && (
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  {result}
                </span>
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </div>
  );
}

function AccessCard({
  agent,
  agentLogo,
  app,
  appColor,
  logo,
  reason,
  scopes,
  step,
  onConnect,
  onSkip,
}: {
  agent: string;
  agentLogo?: ReactNode;
  app: string;
  appColor: string;
  logo: ReactNode;
  reason: string;
  scopes: ConnectScope[];
  step: Step;
  onConnect: () => void;
  onSkip: () => void;
}) {
  const waiting = step === "authorizing";
  const linked = step === "connected";
  let link: Link = "idle";
  if (linked) {
    link = "linked";
  } else if (waiting) {
    link = "waiting";
  }

  return (
    <div className="m-1 mt-0 rounded-[18px] bg-white px-4 pt-5 pb-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-black/[0.06] dark:bg-zinc-900 dark:ring-white/[0.08]">
      <div className="flex items-center justify-center">
        <span className="flex size-10 items-center justify-center rounded-xl bg-zinc-100 font-semibold text-[15px] text-zinc-900 ring-1 ring-black/[0.06] dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/10">
          {agentLogo ?? agent.slice(0, 1)}
        </span>
        <Handshake state={link} />
        <span
          className="flex size-10 items-center justify-center rounded-xl text-white dark:ring-1 dark:ring-white/15"
          style={{ backgroundColor: appColor }}
        >
          {logo}
        </span>
      </div>

      <div className="mt-4 text-center">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="font-medium text-[15px] text-zinc-900 dark:text-zinc-100"
            exit={{ opacity: 0, y: -4 }}
            initial={{ opacity: 0, y: 4 }}
            key={linked ? "linked" : "ask"}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            {linked ? `${app} connected` : `Connect ${app} to continue`}
          </motion.p>
        </AnimatePresence>
        <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400">
          {linked
            ? "Picking up where it stopped…"
            : `${agent} needs access ${reason}.`}
        </p>
      </div>

      <ul className="mt-4 space-y-2 rounded-xl bg-zinc-50 px-3 py-2.5 text-[12.5px] ring-1 ring-black/[0.04] dark:bg-white/[0.03] dark:ring-white/[0.06]">
        {scopes.map((scope) => (
          <li
            className={cn(
              "flex items-center gap-2",
              scope.denied
                ? "text-zinc-400 dark:text-zinc-500"
                : "text-zinc-700 dark:text-zinc-300"
            )}
            key={scope.label}
          >
            <span className="flex size-4 shrink-0 items-center justify-center text-zinc-400 dark:text-zinc-500">
              {scope.icon ?? <Check className="size-3.5" />}
            </span>
            <span
              className={cn(
                scope.denied &&
                  "line-through decoration-zinc-300 dark:decoration-zinc-600"
              )}
            >
              {scope.label}
            </span>
            {scope.denied && (
              <span className="ml-auto shrink-0 text-[11px]">Not asked</span>
            )}
          </li>
        ))}
      </ul>

      <button
        aria-busy={waiting}
        className="mt-4 flex h-10 w-full items-center justify-center rounded-xl font-medium text-[14px] text-white outline-hidden transition-[filter,background-color] duration-300 hover:brightness-125 focus-visible:ring-2 focus-visible:ring-zinc-400/60 focus-visible:ring-offset-2 disabled:pointer-events-none dark:ring-1 dark:ring-white/15 dark:focus-visible:ring-offset-zinc-900"
        disabled={step !== "blocked"}
        onClick={onConnect}
        style={{ backgroundColor: linked ? "#059669" : appColor }}
        type="button"
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 [&_svg]:size-4"
            exit={{ opacity: 0, y: -6 }}
            initial={{ opacity: 0, y: 6 }}
            key={link}
            transition={{ duration: 0.18, ease: EASE_OUT }}
          >
            <ButtonFace app={app} link={link} logo={logo} />
          </motion.span>
        </AnimatePresence>
      </button>
      <div className="mt-1 flex justify-center">
        <button
          className="rounded-md px-2 py-1 text-[12.5px] text-zinc-500 outline-hidden transition-[color,opacity] duration-150 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400/50 disabled:opacity-0 dark:text-zinc-400 dark:hover:text-zinc-100"
          disabled={step !== "blocked"}
          onClick={onSkip}
          type="button"
        >
          Not now
        </button>
      </div>
      <p aria-live="polite" className="sr-only">
        {waiting ? `Waiting for ${app}` : ""}
        {linked ? `${app} connected` : ""}
      </p>
    </div>
  );
}

function ButtonFace({
  link,
  app,
  logo,
}: {
  link: Link;
  app: string;
  logo: ReactNode;
}) {
  if (link === "waiting") {
    return (
      <>
        <Spinner />
        Waiting for {app}…
      </>
    );
  }
  if (link === "linked") {
    return (
      <>
        <Check aria-hidden="true" />
        Connected
      </>
    );
  }
  return (
    <>
      {logo}
      Continue with {app}
    </>
  );
}

/**
 * The line between the two tiles: dashed while it waits, dashes flowing while
 * the person approves, then drawn solid green with a check in the middle.
 */
function Handshake({ state }: { state: Link }) {
  const waiting = state === "waiting";
  return (
    <span className="relative mx-2 flex h-10 w-20 items-center justify-center">
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        fill="none"
        viewBox="0 0 80 40"
      >
        <motion.line
          animate={{ strokeDashoffset: waiting ? [0, -12] : 0 }}
          className="stroke-zinc-300 dark:stroke-zinc-600"
          strokeDasharray="3 3"
          strokeLinecap="round"
          strokeWidth="1.5"
          transition={
            waiting
              ? {
                  duration: 0.6,
                  ease: "linear",
                  repeat: Number.POSITIVE_INFINITY,
                }
              : { duration: 0 }
          }
          x1="2"
          x2="78"
          y1="20"
          y2="20"
        />
        <motion.line
          animate={{
            pathLength: state === "linked" ? 1 : 0,
            opacity: state === "linked" ? 1 : 0,
          }}
          className="stroke-emerald-500"
          initial={false}
          strokeLinecap="round"
          strokeWidth="1.5"
          transition={{ duration: 0.45, ease: EASE_OUT }}
          x1="2"
          x2="78"
          y1="20"
          y2="20"
        />
      </svg>
      <span
        className={cn(
          "relative flex size-6 items-center justify-center rounded-full ring-1 transition-colors duration-300",
          state === "linked"
            ? "bg-emerald-500 text-white ring-emerald-500"
            : "bg-white text-zinc-500 ring-black/10 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-white/15"
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            initial={{ opacity: 0, scale: 0.5 }}
            key={state === "linked" ? "check" : "lock"}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
          >
            {state === "linked" ? (
              <Check className="size-3" strokeWidth={3} />
            ) : (
              <Lock className="size-3" />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
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

/** Eases the frame to its content's height when the card opens or folds. */
function AutoHeight({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) {
      return;
    }
    const observer = new ResizeObserver(() => setHeight(inner.offsetHeight));
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      animate={{ height }}
      className={cn("overflow-hidden", className)}
      initial={false}
      transition={{ duration: 0.45, ease: EASE_OUT }}
    >
      <div ref={innerRef}>{children}</div>
    </motion.div>
  );
}
