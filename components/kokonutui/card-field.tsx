"use client";

/**
 * @author: @dorianbaffier
 * @description: Card Field
 * @version: 1.0.0
 * @date: 2026-10-22
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, CreditCard, Lock } from "lucide-react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const NOT_DIGIT = /\D/g;
const TEST_CARD = "4242424242424242";

type Brand = "visa" | "mastercard" | "amex" | "discover" | "unknown";

interface BrandSpec {
  brand: Brand;
  match: RegExp;
  groups: number[];
  cvc: number;
}

const BRANDS: BrandSpec[] = [
  { brand: "amex", match: /^3[47]/, groups: [4, 6, 5], cvc: 4 },
  { brand: "visa", match: /^4/, groups: [4, 4, 4, 4], cvc: 3 },
  {
    brand: "mastercard",
    match: /^(5[1-5]|2[2-7])/,
    groups: [4, 4, 4, 4],
    cvc: 3,
  },
  {
    brand: "discover",
    match: /^(6011|65|64[4-9])/,
    groups: [4, 4, 4, 4],
    cvc: 3,
  },
];
const UNKNOWN: BrandSpec = {
  brand: "unknown",
  match: /^/,
  groups: [4, 4, 4, 4],
  cvc: 3,
};

const BRAND_NAMES: Record<Brand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  unknown: "Card",
};

export interface CardDetails {
  brand: Brand;
  last4: string;
  /** MM/YY */
  expiry: string;
}

export interface CardFieldProps {
  /** What the button charges. */
  amount?: number;
  currency?: string;
  /** Charge the card. Return a promise and the button waits for it. */
  onPay?: (card: CardDetails) => Promise<void> | void;
  /** Shows a "Use test card" link that types 4242… in for you. */
  testMode?: boolean;
  className?: string;
}

const specFor = (digits: string) =>
  BRANDS.find((spec) => spec.match.test(digits)) ?? UNKNOWN;

const lengthOf = (spec: BrandSpec) =>
  spec.groups.reduce((sum, size) => sum + size, 0);

/** Cuts digits into the brand's groups: Amex is 4-6-5, the rest 4-4-4-4. */
function groupsOf(digits: string, spec: BrandSpec) {
  const out: string[] = [];
  let at = 0;
  for (const size of spec.groups) {
    if (at >= digits.length) {
      break;
    }
    out.push(digits.slice(at, at + size));
    at += size;
  }
  return out;
}

function luhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits.at(-1 - i));
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) {
        d -= 9;
      }
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** "1" waits for the second digit; "4" means April, so it becomes "04". */
function formatExpiry(digits: string) {
  let d = digits;
  if (d.length === 1 && Number(d) > 1) {
    d = `0${d}`;
  }
  if (d.length <= 2) {
    return d.length === 2 ? `${d} / ` : d;
  }
  return `${d.slice(0, 2)} / ${d.slice(2, 4)}`;
}

function expiryProblem(digits: string) {
  if (digits.length < 4) {
    return null;
  }
  const month = Number(digits.slice(0, 2));
  const year = 2000 + Number(digits.slice(2, 4));
  if (month < 1 || month > 12) {
    return "That month doesn't exist";
  }
  const now = new Date();
  const thisMonth = now.getFullYear() * 12 + now.getMonth();
  if (year * 12 + month - 1 < thisMonth) {
    return "This card has expired";
  }
  return null;
}

function BrandMark({ brand, back }: { brand: Brand; back: boolean }) {
  if (back) {
    // Where the security code lives: the back for most cards, the front for Amex.
    return brand === "amex" ? (
      <svg aria-hidden="true" className="h-5 w-8" viewBox="0 0 32 20">
        <rect
          className="fill-zinc-100 stroke-zinc-300 dark:fill-zinc-800 dark:stroke-zinc-600"
          height="19"
          rx="3"
          width="31"
          x="0.5"
          y="0.5"
        />
        <rect
          className="fill-zinc-300 dark:fill-zinc-600"
          height="2"
          rx="1"
          width="12"
          x="4"
          y="12"
        />
        <rect
          className="fill-orange-500"
          height="5"
          rx="1.5"
          width="9"
          x="19"
          y="4"
        />
      </svg>
    ) : (
      <svg aria-hidden="true" className="h-5 w-8" viewBox="0 0 32 20">
        <rect
          className="fill-zinc-100 stroke-zinc-300 dark:fill-zinc-800 dark:stroke-zinc-600"
          height="19"
          rx="3"
          width="31"
          x="0.5"
          y="0.5"
        />
        <rect
          className="fill-zinc-700 dark:fill-zinc-400"
          height="4"
          width="31"
          x="0.5"
          y="3"
        />
        <rect
          className="fill-white dark:fill-zinc-900"
          height="4"
          rx="1"
          width="16"
          x="4"
          y="10"
        />
        <rect
          className="fill-orange-500"
          height="5"
          rx="1.5"
          width="7"
          x="21"
          y="9.5"
        />
      </svg>
    );
  }
  switch (brand) {
    case "visa":
      return (
        <svg aria-hidden="true" className="h-5 w-8" viewBox="0 0 32 20">
          <rect
            className="fill-white stroke-zinc-200 dark:stroke-zinc-700"
            height="19"
            rx="3"
            width="31"
            x="0.5"
            y="0.5"
          />
          <text
            fill="#1a1f71"
            fontFamily="Arial, sans-serif"
            fontSize="9"
            fontStyle="italic"
            fontWeight="800"
            textAnchor="middle"
            x="16"
            y="13.4"
          >
            VISA
          </text>
        </svg>
      );
    case "mastercard":
      return (
        <svg aria-hidden="true" className="h-5 w-8" viewBox="0 0 32 20">
          <rect
            className="fill-zinc-900 dark:fill-zinc-800"
            height="20"
            rx="3.5"
            width="32"
          />
          <circle cx="13" cy="10" fill="#eb001b" r="5.5" />
          <circle cx="19" cy="10" fill="#f79e1b" r="5.5" />
          <path
            d="M16 5.4a5.5 5.5 0 0 1 0 9.2a5.5 5.5 0 0 1 0-9.2z"
            fill="#ff5f00"
          />
        </svg>
      );
    case "amex":
      return (
        <svg aria-hidden="true" className="h-5 w-8" viewBox="0 0 32 20">
          <rect fill="#1f72cd" height="20" rx="3.5" width="32" />
          <text
            fill="white"
            fontFamily="Arial, sans-serif"
            fontSize="7.4"
            fontWeight="800"
            letterSpacing="0.2"
            textAnchor="middle"
            x="16"
            y="12.6"
          >
            AMEX
          </text>
        </svg>
      );
    case "discover":
      return (
        <svg aria-hidden="true" className="h-5 w-8" viewBox="0 0 32 20">
          <rect
            className="fill-white stroke-zinc-200 dark:stroke-zinc-700"
            height="19"
            rx="3"
            width="31"
            x="0.5"
            y="0.5"
          />
          <circle cx="23.5" cy="10" fill="#f58220" r="3.6" />
          <text
            fill="#231f20"
            fontFamily="Arial, sans-serif"
            fontSize="5.4"
            fontWeight="800"
            x="4"
            y="12"
          >
            DISC
          </text>
        </svg>
      );
    default:
      return (
        <CreditCard
          aria-hidden
          className="h-5 w-8 text-zinc-400 dark:text-zinc-500"
          strokeWidth={1.5}
        />
      );
  }
}

interface Fade {
  duration: number;
  ease: typeof EASE_OUT;
}
type Slide =
  | { duration: number }
  | { type: "spring"; duration: number; bounce: number };

function rowTone(error: boolean, focused: boolean) {
  if (error) {
    return "border-red-400 dark:border-red-500/70";
  }
  return focused
    ? "border-zinc-400 ring-4 ring-zinc-900/5 dark:border-zinc-600 dark:ring-white/5"
    : "border-zinc-200 dark:border-zinc-800";
}

function BrandSlot({
  brand,
  back,
  fade,
}: {
  brand: Brand;
  back: boolean;
  fade: Fade;
}) {
  return (
    <span className="relative flex h-5 w-8 shrink-0 items-center justify-center">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          className="absolute inset-0 flex items-center justify-center"
          exit={{ opacity: 0, y: -6, filter: "blur(2px)" }}
          initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
          key={back ? `back-${brand}` : brand}
          transition={fade}
        >
          <BrandMark back={back} brand={brand} />
        </motion.span>
      </AnimatePresence>
      <span aria-live="polite" className="sr-only">
        {brand === "unknown" ? "" : BRAND_NAMES[brand]}
      </span>
    </span>
  );
}

/**
 * Runs steps a keystroke apart, with a pause after `pauseAfter` so the
 * number has time to slide away before expiry is typed.
 */
function playSteps(
  steps: (() => void)[],
  timer: RefObject<ReturnType<typeof setTimeout> | undefined>,
  pauseAfter: number
) {
  const run = (i: number) => {
    if (i >= steps.length) {
      return;
    }
    steps[i]();
    timer.current = setTimeout(() => run(i + 1), i === pauseAfter ? 260 : 45);
  };
  run(0);
}

/** What typing into the expiry field leaves, as up to four digits. */
function nextExpiry(previous: string, raw: string, inputType: string) {
  let digits = raw.replace(NOT_DIGIT, "").slice(0, 4);
  // Deleting the " / " takes the month digit with it.
  if (
    inputType === "deleteContentBackward" &&
    previous.length === 2 &&
    digits.length === 2
  ) {
    digits = digits.slice(0, 1);
  }
  if (digits.length === 1 && Number(digits) > 1) {
    digits = `0${digits}`;
  }
  return digits;
}

/** Backspace in an empty field, or ← at its start, goes to the field before. */
function stepsBack(event: KeyboardEvent<HTMLInputElement>, value: string) {
  const input = event.currentTarget;
  const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
  return (
    (event.key === "Backspace" && value.length === 0) ||
    (event.key === "ArrowLeft" && atStart)
  );
}

/** Ghost digits show what's still to type, in the brand's grouping. */
function ghostsFor(spec: BrandSpec, typedLength: number) {
  let typed = typedLength;
  return spec.groups.map((size) => {
    const used = Math.min(size, typed);
    typed -= used;
    return "0".repeat(size - used);
  });
}

/** The drawn copy of the number, under a clear input, so groups can fade and slide. */
function NumberMirror({
  spec,
  groups,
  typedLength,
  collapsed,
  hideGhost,
  shift,
  slide,
  fade,
  groupRefs,
}: {
  spec: BrandSpec;
  groups: string[];
  typedLength: number;
  collapsed: boolean;
  hideGhost: boolean;
  shift: number;
  slide: Slide;
  fade: Fade;
  groupRefs: RefObject<(HTMLSpanElement | null)[]>;
}) {
  const ghost = ghostsFor(spec, typedLength);
  return (
    <motion.div
      animate={{ transform: `translateX(${-shift}px)` }}
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 flex items-center whitespace-pre text-[15px] text-zinc-900 tabular-nums tracking-wide dark:text-zinc-100"
      initial={false}
      transition={slide}
    >
      {spec.groups.map((size, i) => {
        const typed = groups[i] ?? "";
        const isLast = i === spec.groups.length - 1;
        return (
          <motion.span
            animate={{ opacity: collapsed && !isLast ? 0 : 1 }}
            initial={false}
            key={`${spec.brand}-${size}-${i.toString()}`}
            ref={(el) => {
              groupRefs.current[i] = el;
            }}
            transition={fade}
          >
            {typed}
            <span
              className={cn(
                "text-zinc-300 transition-opacity duration-150 dark:text-zinc-700",
                hideGhost && "opacity-0"
              )}
            >
              {ghost[i]}
            </span>
            {isLast ? "" : " "}
          </motion.span>
        );
      })}
    </motion.div>
  );
}

function Hint({
  id,
  error,
  onCvc,
  spec,
  fade,
}: {
  id: string;
  error: string | null;
  onCvc: boolean;
  spec: BrandSpec;
  fade: Fade;
}) {
  let key = "secure";
  let body: ReactNode = (
    <>
      <Lock aria-hidden className="size-3" />
      Encrypted end to end
    </>
  );
  if (error) {
    key = error;
    body = error;
  } else if (onCvc) {
    key = "cvc";
    body = `${spec.cvc} digits, ${spec.brand === "amex" ? "on the front" : "on the back"} of your card`;
  }
  return (
    <div className="relative mt-2 h-4 text-xs" id={id}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.p
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "flex items-center gap-1.5",
            error
              ? "text-red-600 dark:text-red-400"
              : "text-zinc-500 dark:text-zinc-400"
          )}
          exit={{ opacity: 0, y: -4 }}
          initial={{ opacity: 0, y: 4 }}
          key={key}
          transition={fade}
        >
          {body}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

const PAY_TONES = {
  off: "bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600",
  ready:
    "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
  paid: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950",
};

function PayButton({
  ready,
  status,
  money,
  fade,
  onPay,
}: {
  ready: boolean;
  status: "idle" | "paying" | "paid";
  money: string;
  fade: Fade;
  onPay: () => void;
}) {
  let payTone = ready ? PAY_TONES.ready : PAY_TONES.off;
  if (status === "paid") {
    payTone = PAY_TONES.paid;
  }
  let announcement = "";
  if (status === "paying") {
    announcement = "Processing payment";
  } else if (status === "paid") {
    announcement = `Paid ${money}`;
  }
  return (
    <>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
      <button
        aria-disabled={!ready}
        className={cn(
          "mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl font-medium text-sm outline-none",
          "transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
          payTone
        )}
        onClick={onPay}
        type="button"
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2"
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: 8 }}
            key={status}
            transition={fade}
          >
            {status === "idle" && `Pay ${money}`}
            {status === "paying" && (
              <>
                <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
                Processing
              </>
            )}
            {status === "paid" && (
              <>
                <Check aria-hidden className="size-4" strokeWidth={2.5} />
                Paid {money}
              </>
            )}
          </motion.span>
        </AnimatePresence>
      </button>
    </>
  );
}

/**
 * A one-row card input for checkout. The number groups the way the brand
 * prints it, and once it checks out it slides away to its last four digits,
 * making room for expiry and security code in the same row.
 */
export default function CardField({
  amount = 48,
  currency = "$",
  onPay,
  testMode = true,
  className,
}: CardFieldProps) {
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [editingNumber, setEditingNumber] = useState(true);
  const [focus, setFocus] = useState<"number" | "expiry" | "cvc" | null>(null);
  const [numberError, setNumberError] = useState(false);
  const [status, setStatus] = useState<"idle" | "paying" | "paid">("idle");
  const reduceMotion = Boolean(useReducedMotion());
  const shakeX = useMotionValue(0);

  const numberRef = useRef<HTMLInputElement>(null);
  const expiryRef = useRef<HTMLInputElement>(null);
  const cvcRef = useRef<HTMLInputElement>(null);
  const groupRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const caretRef = useRef<number | null>(null);
  const fillTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [shift, setShift] = useState(0);
  const id = useId();
  const numberId = `${id}-number`;
  const hintId = `${id}-hint`;

  const spec = specFor(number);
  const full = lengthOf(spec);
  const numberDone = number.length === full && luhn(number);
  const collapsed = numberDone && !editingNumber;
  const groups = groupsOf(number, spec);
  const expiryError = expiryProblem(expiry);
  const expiryDone = expiry.length === 4 && !expiryError;
  const cvcDone = cvc.length === spec.cvc;
  const ready = numberDone && expiryDone && cvcDone;

  const error = numberError
    ? "That card number doesn't look right"
    : expiryError;

  useEffect(
    () => () => {
      clearTimeout(fillTimer.current);
      clearTimeout(resetTimer.current);
    },
    []
  );

  // Keep the caret next to the digit it was after, across the spaces that
  // formatting adds and removes.
  useLayoutEffect(() => {
    const input = numberRef.current;
    if (caretRef.current === null || !input) {
      return;
    }
    // Setting a selection on a field that isn't focused can pull focus to it.
    if (document.activeElement !== input) {
      caretRef.current = null;
      return;
    }
    const want = caretRef.current;
    caretRef.current = null;
    let seen = 0;
    let at = 0;
    const value = input.value;
    while (at < value.length && seen < want) {
      if (value[at] !== " ") {
        seen += 1;
      }
      at += 1;
    }
    input.setSelectionRange(at, at);
  });

  // How far to slide the number so only its last group shows.
  useLayoutEffect(() => {
    if (!collapsed) {
      setShift(0);
      return;
    }
    const last = groupRefs.current[groups.length - 1];
    setShift(last ? last.offsetLeft : 0);
  }, [collapsed, groups.length]);

  const collapse = () => {
    setEditingNumber(false);
    requestAnimationFrame(() => expiryRef.current?.focus());
  };

  // Editing after a payment keeps the new input: the pending reset would
  // otherwise wipe it.
  const touch = () => {
    clearTimeout(resetTimer.current);
    setStatus((current) => (current === "paying" ? current : "idle"));
  };

  const writeNumber = (digits: string, caretDigits: number | null) => {
    const nextSpec = specFor(digits);
    const clipped = digits.slice(0, lengthOf(nextSpec));
    caretRef.current = caretDigits;
    setNumber(clipped);
    // A code typed for Amex is one digit too long for the other brands.
    setCvc((current) => current.slice(0, nextSpec.cvc));
    touch();
    const complete = clipped.length === lengthOf(nextSpec);
    const bad = complete && !luhn(clipped);
    setNumberError(bad);
    if (bad && !reduceMotion) {
      animate(shakeX, [0, -8, 7, -4, 2, 0], {
        duration: 0.36,
        ease: "easeOut",
      });
    } else if (complete && !bad) {
      collapse();
    }
  };

  const onNumber = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    const caret = event.target.selectionStart ?? raw.length;
    const before = raw.slice(0, caret).replace(NOT_DIGIT, "").length;
    writeNumber(raw.replace(NOT_DIGIT, ""), before);
  };

  const onExpiry = (event: ChangeEvent<HTMLInputElement>) => {
    const digits = nextExpiry(
      expiry,
      event.target.value,
      (event.nativeEvent as InputEvent).inputType
    );
    setExpiry(digits);
    touch();
    if (digits.length === 4 && !expiryProblem(digits)) {
      cvcRef.current?.focus();
    }
  };

  const onCvc = (event: ChangeEvent<HTMLInputElement>) => {
    setCvc(event.target.value.replace(NOT_DIGIT, "").slice(0, spec.cvc));
    touch();
  };

  const editNumber = () => {
    setEditingNumber(true);
    requestAnimationFrame(() => {
      const input = numberRef.current;
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });
  };

  const onExpiryKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (stepsBack(event, expiry)) {
      event.preventDefault();
      editNumber();
    }
  };

  const onCvcKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (stepsBack(event, cvc)) {
      event.preventDefault();
      const target = expiryRef.current;
      target?.focus();
      target?.setSelectionRange(target.value.length, target.value.length);
    }
    if (event.key === "Enter" && ready) {
      pay();
    }
  };

  const onNumberBlur = () => {
    setFocus(null);
    if (numberDone) {
      setEditingNumber(false);
    }
  };

  // Types the test card in like a person would, so you see the brand land
  // and the number slide away.
  const fillTestCard = () => {
    clearTimeout(fillTimer.current);
    setExpiry("");
    setCvc("");
    setEditingNumber(true);
    numberRef.current?.focus();
    const year = String((new Date().getFullYear() + 3) % 100).padStart(2, "0");
    const steps = [
      ...[...TEST_CARD].map(
        (_, i) => () => writeNumber(TEST_CARD.slice(0, i + 1), i + 1)
      ),
      () => setExpiry("1"),
      () => setExpiry("12"),
      () => setExpiry(`12${year[0]}`),
      () => {
        setExpiry(`12${year}`);
        cvcRef.current?.focus();
      },
      () => setCvc("1"),
      () => setCvc("12"),
      () => setCvc("123"),
    ];
    playSteps(steps, fillTimer, TEST_CARD.length - 1);
  };

  const pay = async () => {
    if (!ready || status !== "idle") {
      return;
    }
    setStatus("paying");
    const details = {
      brand: spec.brand,
      last4: number.slice(-4),
      expiry: `${expiry.slice(0, 2)}/${expiry.slice(2)}`,
    };
    try {
      await (onPay?.(details) ??
        new Promise((resolve) => setTimeout(resolve, 1100)));
    } catch {
      // A declined charge leaves the card as typed, ready to try again.
      setStatus("idle");
      return;
    }
    setStatus("paid");
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setNumber("");
      setExpiry("");
      setCvc("");
      setEditingNumber(true);
      setStatus("idle");
    }, 2400);
  };

  const slide = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.45, bounce: 0 };
  const fade = { duration: reduceMotion ? 0 : 0.2, ease: EASE_OUT };
  const money = `${currency}${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
    >
      <div className="flex items-baseline justify-between">
        <label
          className="font-medium text-sm text-zinc-900 dark:text-zinc-100"
          htmlFor={numberId}
        >
          Card
        </label>
        {testMode && (
          <button
            className="rounded text-xs text-zinc-500 underline decoration-zinc-300 underline-offset-2 outline-none transition-colors duration-150 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:decoration-zinc-700 dark:hover:text-zinc-100"
            onClick={fillTestCard}
            type="button"
          >
            Use test card
          </button>
        )}
      </div>

      <motion.div
        className={cn(
          "mt-2 flex h-12 items-center gap-3 rounded-xl border bg-white px-3 transition-[border-color,box-shadow] duration-150 dark:bg-zinc-950",
          rowTone(Boolean(error), focus !== null)
        )}
        style={{ x: shakeX }}
      >
        <BrandSlot back={focus === "cvc"} brand={spec.brand} fade={fade} />

        {/* The number. A clear input over a drawn copy, so the groups can
            fade and slide while the caret stays native. */}
        <div className="relative h-full min-w-0 flex-1 overflow-hidden">
          <NumberMirror
            collapsed={collapsed}
            fade={fade}
            groupRefs={groupRefs}
            groups={groups}
            hideGhost={collapsed || (number.length === 0 && focus !== "number")}
            shift={shift}
            slide={slide}
            spec={spec}
            typedLength={number.length}
          />
          {number.length === 0 && focus !== "number" && (
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-[15px] text-zinc-400 dark:text-zinc-500">
              Card number
            </span>
          )}
          <input
            aria-describedby={hintId}
            aria-invalid={numberError}
            autoComplete="cc-number"
            className={cn(
              "absolute inset-0 h-full w-full bg-transparent text-[15px] text-transparent tabular-nums tracking-wide caret-zinc-900 outline-none dark:caret-zinc-100",
              collapsed && "pointer-events-none"
            )}
            id={numberId}
            inputMode="numeric"
            onBlur={onNumberBlur}
            onChange={onNumber}
            onFocus={() => {
              setFocus("number");
              setEditingNumber(true);
            }}
            onKeyDown={(event) => {
              // Tab from a finished number lands in expiry, not past the row.
              if (event.key === "Tab" && !event.shiftKey && numberDone) {
                event.preventDefault();
                collapse();
              }
            }}
            ref={numberRef}
            spellCheck={false}
            tabIndex={collapsed ? -1 : 0}
            value={groups.join(" ")}
          />
          {collapsed && (
            <button
              aria-label={`Edit card number ending ${number.slice(-4)}`}
              className="absolute inset-0 cursor-text rounded-md outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
              onClick={editNumber}
              type="button"
            />
          )}
        </div>

        <AnimatePresence initial={false}>
          {collapsed && (
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="flex shrink-0 items-center gap-3"
              exit={{
                opacity: 0,
                x: 12,
                transition: { duration: reduceMotion ? 0 : 0.12 },
              }}
              initial={{ opacity: 0, x: 16 }}
              key="rest"
              transition={{ ...slide, opacity: fade }}
            >
              <input
                aria-invalid={Boolean(expiryError)}
                aria-label="Expiry, month and year"
                autoComplete="cc-exp"
                className={cn(
                  "h-10 w-[4.6rem] bg-transparent text-[15px] tabular-nums outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
                  expiryError
                    ? "text-red-600 dark:text-red-400"
                    : "text-zinc-900 dark:text-zinc-100"
                )}
                inputMode="numeric"
                onBlur={() => setFocus(null)}
                onChange={onExpiry}
                onFocus={() => setFocus("expiry")}
                onKeyDown={onExpiryKey}
                placeholder="MM / YY"
                ref={expiryRef}
                value={formatExpiry(expiry)}
              />
              <input
                aria-label="Security code"
                autoComplete="cc-csc"
                className="h-10 w-[2.6rem] bg-transparent text-[15px] text-zinc-900 tabular-nums outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                inputMode="numeric"
                onBlur={() => setFocus(null)}
                onChange={onCvc}
                onFocus={() => setFocus("cvc")}
                onKeyDown={onCvcKey}
                placeholder={spec.cvc === 4 ? "CVV" : "CVC"}
                ref={cvcRef}
                value={cvc}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <Hint
        error={error}
        fade={fade}
        id={hintId}
        onCvc={focus === "cvc"}
        spec={spec}
      />

      <PayButton
        fade={fade}
        money={money}
        onPay={pay}
        ready={ready}
        status={status}
      />
    </div>
  );
}
