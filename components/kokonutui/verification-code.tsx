"use client";

/**
 * @author: @dorianbaffier
 * @description: Verification Code
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, LoaderCircle } from "lucide-react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  type Variants,
} from "motion/react";
import {
  type ChangeEvent,
  type CSSProperties,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const NOT_DIGIT = /\D/g;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const BOX_WIDTH = 44;
const BOX_HEIGHT = 52;
const BOX_GAP = 8;
const PILL_HEIGHT = 40;
// Pasted or autofilled codes land one digit after another.
const PASTE_STAGGER = 0.04;
// A wrong code clears from the last box back to the first.
const CLEAR_STAGGER = 0.03;

type Status = "idle" | "checking" | "success" | "error";
type Message = { text: string; tone: "error" | "info" } | null;

/** Stands in for a server check in the demo: the code is 123456. */
const demoVerify = (code: string) =>
  new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(code === "123456"), 900);
  });

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// Once verified the boxes become the segments of one pill: the ends keep
// their outer corners and everything in between goes square.
const boxRadius = (index: number, length: number, merged: boolean) => {
  if (!merged) {
    return "10px";
  }
  const r = PILL_HEIGHT / 2;
  if (length === 1) {
    return `${r}px`;
  }
  if (index === 0) {
    return `${r}px 0 0 ${r}px`;
  }
  if (index === length - 1) {
    return `0 ${r}px ${r}px 0`;
  }
  return "0";
};

const boxTone = (status: Status, active: boolean, filled: boolean) => {
  if (status === "success") {
    return "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";
  }
  if (status === "error") {
    return "border-red-500 bg-white text-red-600 dark:border-red-500/80 dark:bg-zinc-950 dark:text-red-400";
  }
  if (active) {
    return "border-zinc-900 bg-white text-zinc-900 dark:border-zinc-300 dark:bg-zinc-950 dark:text-zinc-100";
  }
  return cn(
    "bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100",
    filled
      ? "border-zinc-300 dark:border-zinc-700"
      : "border-zinc-200 dark:border-zinc-800"
  );
};

export interface VerificationCodeProps {
  /** Number of digits. */
  length?: number;
  /**
   * Checks a complete code. Return or resolve `true` to accept it. Defaults
   * to a demo check that accepts 123456.
   */
  onVerify?: (code: string) => boolean | Promise<boolean>;
  onSuccess?: (code: string) => void;
  /** Called when the resend link is pressed. */
  onResend?: () => void;
  /** Seconds before a new code can be requested. */
  resendAfter?: number;
  label?: string;
  autoFocus?: boolean;
  className?: string;
}

export default function VerificationCode({
  length = 6,
  onVerify = demoVerify,
  onSuccess,
  onResend,
  resendAfter = 30,
  label = "Verification code",
  autoFocus = false,
  className,
}: VerificationCodeProps) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<Message>(null);
  const [focused, setFocused] = useState(false);
  const [countdown, setCountdown] = useState(resendAfter);
  const [entry, setEntry] = useState({ from: 0, stagger: false });
  const [clearing, setClearing] = useState(false);
  const [pillWidth, setPillWidth] = useState(140);

  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const attempt = useRef(0);
  const timers = useRef<number[]>([]);
  const statusId = useId();

  const merged = status === "success";
  const locked = status === "checking" || status === "success";

  // The pill hugs its "Verified" label.
  useLayoutEffect(() => {
    if (labelRef.current) {
      setPillWidth(labelRef.current.offsetWidth + 40);
    }
  }, []);

  useEffect(() => {
    if (countdown <= 0 || merged) {
      return;
    }
    const timer = window.setTimeout(() => setCountdown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, merged]);

  useEffect(
    () => () => {
      attempt.current += 1;
      for (const timer of timers.current) {
        window.clearTimeout(timer);
      }
    },
    []
  );

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const shake = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    rowRef.current?.animate?.(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(5px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(2px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 360, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
    );
  };

  const reject = () => {
    setStatus("error");
    setMessage({ text: "That code didn't work. Try again.", tone: "error" });
    shake();
    later(() => {
      setClearing(true);
      setValue("");
      setStatus("idle");
      inputRef.current?.focus();
    }, 520);
  };

  const verify = async (code: string) => {
    const id = ++attempt.current;
    setStatus("checking");
    setMessage(null);
    let ok = false;
    try {
      ok = await onVerify(code);
    } catch {
      ok = false;
    }
    if (id !== attempt.current) {
      return;
    }
    if (ok) {
      setStatus("success");
      inputRef.current?.blur();
      onSuccess?.(code);
    } else {
      reject();
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (locked) {
      return;
    }
    const next = event.target.value.replace(NOT_DIGIT, "").slice(0, length);
    // Typing one digit lands at once; a paste or autofill cascades in.
    setEntry({ from: value.length, stagger: next.length - value.length > 1 });
    setClearing(false);
    setValue(next);
    if (next.length > 0) {
      setMessage(null);
    }
    if (next.length === length) {
      // Wait for a pasted code to finish landing before checking it.
      const landing =
        next.length - value.length > 1 ? next.length * 40 + 120 : 0;
      later(() => verify(next), landing);
    }
  };

  // Keep the caret at the end so every edit happens on the last box.
  const pinCaret = () => {
    const input = inputRef.current;
    if (input && input.selectionStart !== input.value.length) {
      input.setSelectionRange(input.value.length, input.value.length);
    }
  };

  const resend = () => {
    onResend?.();
    attempt.current += 1;
    setCountdown(resendAfter);
    setClearing(true);
    setValue("");
    setStatus("idle");
    setMessage({ text: "We sent a new code.", tone: "info" });
    inputRef.current?.focus();
  };

  const activeIndex = Math.min(value.length, length - 1);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("flex flex-col items-center gap-3", className)}>
        <div className="relative" ref={rowRef}>
          <div
            className="flex transition-[gap] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
            style={{ gap: merged ? 0 : BOX_GAP }}
          >
            {digits.map((digit, i) => (
              <CodeBox
                active={focused && status === "idle" && i === activeIndex}
                caret={focused && status === "idle" && i === value.length}
                digit={digit}
                enterDelay={
                  entry.stagger
                    ? Math.max(0, i - entry.from) * PASTE_STAGGER
                    : 0
                }
                exitDelay={clearing ? (length - 1 - i) * CLEAR_STAGGER : 0}
                index={i}
                // biome-ignore lint/suspicious/noArrayIndexKey: boxes are fixed positions, not list items
                key={i}
                length={length}
                pillWidth={pillWidth}
                status={status}
              />
            ))}
          </div>

          <span
            aria-hidden={!merged}
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center",
              "transition-[opacity,filter] duration-200 ease-out",
              merged
                ? "opacity-100 blur-0 delay-300 motion-reduce:delay-0"
                : "opacity-0 blur-[2px]"
            )}
          >
            <span
              className="flex items-center gap-1.5 whitespace-nowrap font-medium text-sm text-white dark:text-zinc-900"
              ref={labelRef}
            >
              <Check className="size-4" strokeWidth={2.5} />
              Verified
            </span>
          </span>

          <input
            aria-describedby={statusId}
            aria-invalid={status === "error"}
            aria-label={label}
            autoComplete="one-time-code"
            autoFocus={autoFocus}
            className={cn(
              "absolute inset-0 w-full bg-transparent text-base text-transparent caret-transparent outline-none selection:bg-transparent",
              merged && "pointer-events-none"
            )}
            disabled={merged}
            inputMode="numeric"
            maxLength={length}
            onBlur={() => setFocused(false)}
            onChange={handleChange}
            onFocus={() => {
              setFocused(true);
              pinCaret();
            }}
            onSelect={pinCaret}
            readOnly={locked}
            ref={inputRef}
            spellCheck={false}
            type="text"
            value={value}
          />
        </div>

        <div
          aria-live="polite"
          className="relative flex h-5 items-center justify-center text-sm"
          id={statusId}
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              className="flex items-center gap-1.5 whitespace-nowrap"
              exit={{ opacity: 0, y: -4, filter: "blur(2px)" }}
              initial={{ opacity: 0, y: 4, filter: "blur(2px)" }}
              key={message?.text ?? status}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            >
              <StatusLine
                countdown={countdown}
                message={message}
                onResend={resend}
                status={status}
              />
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}

const EXIT: Variants = {
  exit: (delay: number) => ({
    opacity: 0,
    y: "-30%",
    filter: "blur(4px)",
    transition: { duration: 0.15, delay },
  }),
};

function CodeBox({
  digit,
  index,
  length,
  status,
  active,
  caret,
  enterDelay,
  exitDelay,
  pillWidth,
}: {
  digit: string;
  index: number;
  length: number;
  status: Status;
  active: boolean;
  caret: boolean;
  enterDelay: number;
  exitDelay: number;
  pillWidth: number;
}) {
  const merged = status === "success";
  const style: CSSProperties = {
    width: merged ? pillWidth / length : BOX_WIDTH,
    height: merged ? PILL_HEIGHT : BOX_HEIGHT,
    borderRadius: boxRadius(index, length, merged),
    // Overlap the borders so the joined pill has no seams.
    marginLeft: merged && index > 0 ? -1 : 0,
    // The boxes slide together first, then fill in as one pill.
    transitionDelay: merged ? "0ms, 0ms, 0ms, 180ms, 180ms, 180ms" : undefined,
  };

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden border font-medium text-xl tabular-nums",
        "transition-[width,height,border-radius,background-color,border-color,color] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-[background-color,border-color,color]",
        boxTone(status, active, digit !== "")
      )}
      style={style}
    >
      <AnimatePresence custom={exitDelay} initial={false}>
        {digit && (
          <motion.span
            animate={{
              opacity: merged ? 0 : 1,
              y: "0%",
              filter: merged ? "blur(4px)" : "blur(0px)",
            }}
            className="absolute"
            exit="exit"
            initial={{ opacity: 0, y: "40%", filter: "blur(4px)" }}
            key={digit}
            transition={{
              duration: merged ? 0.15 : 0.22,
              ease: EASE_OUT,
              delay: merged ? 0 : enterDelay,
            }}
            variants={EXIT}
          >
            {status === "checking" ? (
              // While the code is checked, a soft wave runs across the digits.
              <motion.span
                animate={{ opacity: [1, 0.35, 1] }}
                className="block"
                transition={{
                  duration: 0.9,
                  delay: index * 0.08,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }}
              >
                {digit}
              </motion.span>
            ) : (
              digit
            )}
          </motion.span>
        )}
      </AnimatePresence>
      {caret && (
        <motion.span
          animate={{ opacity: [1, 1, 0, 0] }}
          aria-hidden="true"
          className="h-5 w-px bg-zinc-900 dark:bg-zinc-100"
          transition={{
            duration: 1,
            times: [0, 0.5, 0.5, 1],
            repeat: Number.POSITIVE_INFINITY,
          }}
        />
      )}
    </div>
  );
}

function StatusLine({
  status,
  message,
  countdown,
  onResend,
}: {
  status: Status;
  message: Message;
  countdown: number;
  onResend: () => void;
}) {
  if (status === "checking") {
    return (
      <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
        <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" />
        Checking
      </span>
    );
  }
  if (status === "success") {
    return <span className="sr-only">Code verified</span>;
  }
  if (message?.tone === "error") {
    return (
      <span className="text-red-600 dark:text-red-400">{message.text}</span>
    );
  }
  return (
    <span className="text-zinc-500 dark:text-zinc-400">
      {message?.text ?? "Didn't get a code?"}{" "}
      {countdown > 0 ? (
        <span className="tabular-nums">Resend in {formatTime(countdown)}</span>
      ) : (
        <button
          className="rounded-sm font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 outline-none transition-colors duration-150 ease-out hover:decoration-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-100"
          onClick={onResend}
          type="button"
        >
          Resend code
        </button>
      )}
    </span>
  );
}
