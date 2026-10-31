"use client";

/**
 * @author: @kokonutui
 * @description: AI Redact
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  ArrowUp,
  CreditCard,
  KeyRound,
  Lock,
  type LucideIcon,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  type KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export type RedactKind = "email" | "phone" | "card" | "secret" | "name";

export interface AIRedactProps {
  title?: string;
  /** Text already in the composer when it mounts. */
  defaultValue?: string;
  /** Names to mask, e.g. contacts from your CRM. Regexes cover the rest. */
  names?: string[];
  /**
   * Answers the masked prompt. It only ever sees placeholders like
   * `EMAIL_1`; any it writes back are filled in on this side.
   */
  respond?: (masked: string) => string;
  className?: string;
}

interface Match {
  start: number;
  end: number;
  kind: RedactKind;
  value: string;
  token: string;
}

type Segment = string | { token: string; value: string; kind: RedactKind };

interface Message {
  id: string;
  role: "user" | "assistant";
  segments: Segment[];
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const PATTERNS: { kind: RedactKind; pattern: RegExp }[] = [
  {
    kind: "secret",
    pattern:
      /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}|\bghp_[A-Za-z0-9]{20,}/g,
  },
  { kind: "card", pattern: /\b\d{4}(?:[ -]?\d{4}){3}\b/g },
  { kind: "email", pattern: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g },
  { kind: "phone", pattern: /\+\d[\d ().-]{7,}\d/g },
];
const TOKEN = /\b(EMAIL|PHONE|CARD|SECRET|PERSON)_\d+\b/g;
const ESCAPE = /[.*+?^${}()|[\]\\]/g;
const WORDS = /\S+\s*|\s+/g;
const PERSON_TOKEN = /PERSON_\d+/;
const CARD_TOKEN = /CARD_\d+/;
const PHONE_TOKEN = /PHONE_\d+/;
const SECRET_TOKEN = /SECRET_\d+/;

const LABEL: Record<RedactKind, string> = {
  email: "EMAIL",
  phone: "PHONE",
  card: "CARD",
  secret: "SECRET",
  name: "PERSON",
};

const ICON: Record<RedactKind, LucideIcon> = {
  email: Mail,
  phone: Phone,
  card: CreditCard,
  secret: KeyRound,
  name: User,
};

const DEMO_TEXT =
  "Draft a reply to Dana Whitfield (dana.whitfield@acme.co, +1 415 555 0132) confirming the refund to card 4242 4242 4242 4242. The charge failed with key sk_live_51Hx9aQ2vT8eLm, what does that error mean?";

const DEMO_NAMES = ["Dana Whitfield"];

/**
 * What "send as is" remembers. Tokens are numbered by position, so keying on
 * the token would unmask a different value once the text above it changes.
 */
const keepKey = (m: { kind: RedactKind; value: string }) =>
  `${m.kind}:${m.value}`;

const demoRespond = (masked: string) => {
  const person = masked.match(PERSON_TOKEN)?.[0] ?? "there";
  const card = masked.match(CARD_TOKEN)?.[0] ?? "your card";
  const phone = masked.match(PHONE_TOKEN)?.[0];
  const secret = masked.match(SECRET_TOKEN)?.[0];
  const callBack = phone ? `, or call us back on ${phone}` : "";
  const keyNote = secret
    ? ` On the error: I only saw ${secret}, not the key itself, so I can't tell which account it belongs to. A failed charge with a live key usually means the card was declined, not that the key is wrong.`
    : "";
  return `Hi ${person}, thanks for bearing with us. Your refund to ${card} is confirmed and should land within 5 to 10 business days. If anything looks off, just reply here${callBack}.${keyNote}`;
};

/** Finds everything worth masking, numbering repeats with the same token. */
const detect = (text: string, names: string[]): Match[] => {
  const found: Omit<Match, "token">[] = [];
  const taken = (start: number, end: number) =>
    found.some((m) => start < m.end && end > m.start);
  const patterns = [
    ...PATTERNS,
    ...names.map((name) => ({
      kind: "name" as const,
      pattern: new RegExp(`\\b${name.replace(ESCAPE, "\\$&")}\\b`, "g"),
    })),
  ];
  for (const { kind, pattern } of patterns) {
    for (const m of text.matchAll(pattern)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (!taken(start, end)) {
        found.push({ start, end, kind, value: m[0] });
      }
    }
  }
  found.sort((a, b) => a.start - b.start);
  const tokens = new Map<string, string>();
  const counts: Partial<Record<RedactKind, number>> = {};
  return found.map((m) => {
    const key = `${m.kind}:${m.value}`;
    let token = tokens.get(key);
    if (!token) {
      counts[m.kind] = (counts[m.kind] ?? 0) + 1;
      token = `${LABEL[m.kind]}_${counts[m.kind]}`;
      tokens.set(key, token);
    }
    return { ...m, token };
  });
};

const toSegments = (text: string, matches: Match[], kept: Set<string>) => {
  const out: Segment[] = [];
  let at = 0;
  for (const m of matches) {
    if (kept.has(keepKey(m))) {
      continue;
    }
    if (m.start > at) {
      out.push(text.slice(at, m.start));
    }
    out.push({ token: m.token, value: m.value, kind: m.kind });
    at = m.end;
  }
  out.push(text.slice(at));
  return out.filter((s) => s !== "");
};

const flatten = (segments: Segment[]) =>
  segments.map((s) => (typeof s === "string" ? s : s.token)).join("");

/** Turns placeholders in the reply back into segments with real values. */
const restore = (reply: string, matches: Match[]): Segment[] => {
  const byToken = new Map(matches.map((m) => [m.token, m]));
  const out: Segment[] = [];
  let at = 0;
  for (const m of reply.matchAll(TOKEN)) {
    const hit = byToken.get(m[0]);
    const start = m.index ?? 0;
    if (!hit) {
      continue;
    }
    out.push(reply.slice(at, start));
    out.push({ token: hit.token, value: hit.value, kind: hit.kind });
    at = start + m[0].length;
  }
  out.push(reply.slice(at));
  return out.filter((s) => s !== "");
};

/** Splits text segments into words so a reply can stream in. */
const pieces = (segments: Segment[]): Segment[] =>
  segments.flatMap((s): Segment[] =>
    typeof s === "string" ? [...(s.match(WORDS) ?? [])] : [s]
  );

let counter = 0;
const uid = () => {
  counter += 1;
  return `m${counter}`;
};

export default function AIRedact({
  title = "Support assistant",
  defaultValue = DEMO_TEXT,
  names = DEMO_NAMES,
  respond = demoRespond,
  className,
}: AIRedactProps) {
  const reduceMotion = useReducedMotion();
  const [text, setText] = useState(defaultValue);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Message[]>([]);
  const [shown, setShown] = useState(0);
  const [restored, setRestored] = useState(true);
  const [modelView, setModelView] = useState(false);
  const [pointed, setPointed] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => detect(text, names), [text, names]);
  const tokens = useMemo(
    () => [...new Map(matches.map((m) => [m.token, m])).values()],
    [matches]
  );
  const masking = tokens.filter((t) => !kept.has(keepKey(t)));

  const reply = messages.at(-1);
  const replyPieces = useMemo(
    () => (reply?.role === "assistant" ? pieces(reply.segments) : []),
    [reply]
  );
  const streaming = reply?.role === "assistant" && shown < replyPieces.length;

  // Grow the composer with its text, so the highlight layer lines up.
  // biome-ignore lint/correctness/useExhaustiveDependencies: text drives the height
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  // Stream the reply with placeholders, then fill the real values back in.
  useEffect(() => {
    if (reply?.role !== "assistant") {
      return;
    }
    if (reduceMotion) {
      setShown(replyPieces.length);
      setRestored(true);
      return;
    }
    if (shown < replyPieces.length) {
      const id = setTimeout(() => setShown((n) => n + 1), 38);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setRestored(true), 420);
    return () => clearTimeout(id);
  }, [reply, replyPieces, shown, reduceMotion]);

  const messageCount = messages.length;
  useEffect(() => {
    const el = threadRef.current;
    if (messageCount > 0 && el) {
      el.scrollTo({ top: el.scrollHeight + shown, behavior: "smooth" });
    }
  }, [messageCount, shown]);

  const send = () => {
    if (!text.trim() || streaming) {
      return;
    }
    const segments = toSegments(text, matches, kept);
    const answer = restore(respond(flatten(segments)), matches);
    setMessages((list) => [
      ...list,
      { id: uid(), role: "user", segments },
      { id: uid(), role: "assistant", segments: answer },
    ]);
    setShown(0);
    setRestored(false);
    setText("");
    setKept(new Set());
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      send();
    }
  };

  const toggle = (key: string) =>
    setKept((set) => {
      const next = new Set(set);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "flex w-full max-w-lg flex-col rounded-2xl bg-white ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10",
          className
        )}
      >
        <header className="flex items-center gap-2 border-black/[0.06] border-b py-2.5 pr-2.5 pl-4 dark:border-white/[0.08]">
          <ShieldCheck
            aria-hidden="true"
            className="size-3.5 text-zinc-400 dark:text-zinc-500"
          />
          <h3 className="min-w-0 flex-1 truncate font-medium text-[13px] text-zinc-900 dark:text-zinc-100">
            {title}
          </h3>
          <ViewSwitch model={modelView} onChange={setModelView} />
        </header>

        <div
          className="h-64 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-width:thin]"
          ref={threadRef}
        >
          {messages.length === 0 && (
            <p className="mx-auto max-w-72 pt-16 text-center text-[12px] text-zinc-400 leading-relaxed dark:text-zinc-500">
              Names, emails, numbers and keys are swapped for placeholders
              before anything leaves the browser. Replies are filled back in
              here.
            </p>
          )}
          {messages.map((message) => {
            const live = message === reply && message.role === "assistant";
            return message.role === "user" ? (
              <div className="flex justify-end" key={message.id}>
                <p className="max-w-[88%] rounded-2xl rounded-br-md bg-zinc-100 px-3.5 py-2 text-[13px] text-zinc-800 leading-6 dark:bg-zinc-800 dark:text-zinc-100">
                  <Segments masked={modelView} segments={message.segments} />
                </p>
              </div>
            ) : (
              <p
                className="text-[13px] text-zinc-800 leading-6 dark:text-zinc-200"
                key={message.id}
              >
                <Segments
                  hideSecrets
                  masked={modelView || (live && !restored)}
                  segments={
                    live ? replyPieces.slice(0, shown) : message.segments
                  }
                />
              </p>
            );
          })}
        </div>

        <div className="p-2 pt-0">
          <div className="rounded-xl bg-zinc-50 ring-1 ring-black/[0.07] dark:bg-zinc-800/60 dark:ring-white/[0.08]">
            <div className="relative px-3 pt-2.5">
              {/* Highlights sit under the transparent textarea, letter for letter. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-3 top-2.5 bottom-0 overflow-hidden [scrollbar-gutter:stable]"
              >
                <div
                  className="whitespace-pre-wrap break-words text-[13px] text-transparent leading-6 [@media(pointer:coarse)]:text-base"
                  ref={highlightRef}
                >
                  <Highlights
                    kept={kept}
                    matches={matches}
                    pointed={pointed}
                    text={text}
                  />
                  {"​"}
                </div>
              </div>
              <textarea
                aria-label="Message"
                className="relative block max-h-40 min-h-12 w-full resize-none overflow-y-auto bg-transparent text-[13px] text-zinc-900 leading-6 outline-hidden [scrollbar-gutter:stable] placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500 [@media(pointer:coarse)]:text-base"
                onChange={(event) => setText(event.target.value)}
                onKeyDown={onKeyDown}
                onScroll={(event) => {
                  // Past max height the textarea scrolls; the highlights follow.
                  const layer = highlightRef.current;
                  if (layer) {
                    layer.style.transform = `translateY(${-event.currentTarget.scrollTop}px)`;
                  }
                }}
                placeholder="Paste a customer message…"
                ref={textareaRef}
                rows={2}
                value={text}
              />
            </div>
            <div className="flex items-end gap-2 p-2">
              <div className="flex min-h-7 min-w-0 flex-1 flex-wrap items-center gap-1">
                {tokens.length === 0 && (
                  <span className="px-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                    Nothing to mask
                  </span>
                )}
                <AnimatePresence initial={false} mode="popLayout">
                  {tokens.map((t) => (
                    <TokenChip
                      kept={kept.has(keepKey(t))}
                      key={t.token}
                      match={t}
                      onPoint={(on) => setPointed(on ? t.token : null)}
                      onToggle={() => toggle(keepKey(t))}
                    />
                  ))}
                </AnimatePresence>
              </div>
              <button
                aria-label="Send"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white transition-[background-color,opacity] duration-150 hover:bg-zinc-700 active:bg-zinc-600 disabled:opacity-30 dark:bg-white dark:text-zinc-900 dark:active:bg-zinc-300 dark:hover:bg-zinc-200"
                disabled={!text.trim() || streaming}
                onClick={send}
                type="button"
              >
                <ArrowUp className="size-3.5" />
              </button>
            </div>
          </div>
          <p
            aria-live="polite"
            className="flex h-7 items-center px-2 text-[11px] text-zinc-400 dark:text-zinc-500"
          >
            {masking.length > 0
              ? `${masking.length} ${masking.length === 1 ? "item" : "items"} will be masked. Click one to send it as is.`
              : "Sent exactly as written"}
          </p>
        </div>
      </div>
    </MotionConfig>
  );
}

function Highlights({
  text,
  matches,
  kept,
  pointed,
}: {
  text: string;
  matches: Match[];
  kept: Set<string>;
  /** The token whose chip is hovered or focused, lit up in the text. */
  pointed: string | null;
}) {
  const out: (string | Match)[] = [];
  let at = 0;
  for (const m of matches) {
    out.push(text.slice(at, m.start), m);
    at = m.end;
  }
  out.push(text.slice(at));
  return out.map((part) =>
    typeof part === "string" ? (
      part
    ) : (
      <mark
        className={cn(
          "rounded-[3px] text-transparent transition-[background-color,box-shadow] duration-150 [box-decoration-break:clone]",
          kept.has(keepKey(part))
            ? "bg-transparent underline decoration-zinc-400 decoration-dotted underline-offset-4"
            : "bg-orange-500/[0.16] dark:bg-orange-400/20",
          pointed === part.token &&
            (kept.has(keepKey(part))
              ? "bg-zinc-900/[0.07] dark:bg-white/10"
              : "bg-orange-500/30 shadow-[0_0_0_1px_rgb(249_115_22/0.45)] dark:bg-orange-400/35")
        )}
        key={part.start}
      >
        {part.value}
      </mark>
    )
  );
}

function TokenChip({
  match,
  kept,
  onToggle,
  onPoint,
}: {
  match: Match;
  kept: boolean;
  onToggle: () => void;
  /** Lights up this token's spans in the composer. */
  onPoint: (on: boolean) => void;
}) {
  const Icon = ICON[match.kind];
  const locked = match.kind === "secret";
  let label = `${match.value} is sent as ${match.token}. Send it as is`;
  if (locked) {
    label = `${match.token}. Keys and secrets are always masked`;
  } else if (kept) {
    label = `${match.value} is sent as is. Mask it again`;
  }
  return (
    <motion.button
      animate={{ opacity: 1, filter: "blur(0px)" }}
      aria-disabled={locked || undefined}
      aria-label={label}
      aria-pressed={!kept}
      className={cn(
        "flex h-6 items-center gap-1 rounded-md px-1.5 font-mono text-[10.5px] ring-1 transition-colors duration-150",
        kept &&
          "text-zinc-400 ring-black/[0.06] hover:text-zinc-600 active:bg-zinc-900/[0.05] dark:text-zinc-500 dark:ring-white/[0.08] dark:active:bg-white/[0.06] dark:hover:text-zinc-300",
        !kept &&
          "bg-white text-zinc-700 ring-black/[0.08] dark:bg-zinc-900 dark:text-zinc-200 dark:ring-white/10",
        !(kept || locked) &&
          "hover:bg-zinc-100 active:bg-zinc-200/80 dark:active:bg-zinc-700 dark:hover:bg-zinc-800",
        locked && "cursor-default"
      )}
      exit={{
        opacity: 0,
        filter: "blur(2px)",
        transition: { duration: 0.1 },
      }}
      initial={{ opacity: 0, filter: "blur(2px)" }}
      onBlur={() => onPoint(false)}
      onClick={locked ? undefined : onToggle}
      onFocus={() => onPoint(true)}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          onPoint(true);
        }
      }}
      onPointerLeave={() => onPoint(false)}
      title={locked ? "Keys and secrets are always masked" : match.value}
      transition={{ duration: 0.15, ease: EASE_OUT }}
      type="button"
    >
      <Icon aria-hidden="true" className="size-3" />
      <span className={cn(kept && "line-through")}>{match.token}</span>
      {locked && (
        <Lock
          aria-hidden="true"
          className="-mr-0.5 size-2.5 text-zinc-400 dark:text-zinc-500"
        />
      )}
    </motion.button>
  );
}

function Segments({
  segments,
  masked,
  hideSecrets = false,
}: {
  segments: Segment[];
  masked: boolean;
  /** Keys never come back into a reply, even on your side. */
  hideSecrets?: boolean;
}) {
  let offset = 0;
  let order = 0;
  return segments.map((segment) => {
    const key = `${offset}`;
    offset +=
      typeof segment === "string" ? segment.length : segment.token.length;
    if (typeof segment === "string") {
      return <span key={key}>{segment}</span>;
    }
    // Swaps ripple through the message one placeholder at a time.
    const delay = Math.min(order, 6) * 0.06;
    order += 1;
    return (
      <span className="inline-block" key={key}>
        <AnimatePresence initial={false} mode="wait">
          {masked || (hideSecrets && segment.kind === "secret") ? (
            <motion.span
              animate={{ opacity: 1, filter: "blur(0px)" }}
              className="inline-flex translate-y-[-1px] items-center rounded-[5px] bg-zinc-900/[0.07] px-1 align-middle font-mono text-[11px] text-zinc-600 leading-5 dark:bg-white/10 dark:text-zinc-300"
              exit={{
                opacity: 0,
                filter: "blur(2px)",
                transition: { duration: 0.12, delay, ease: EASE_OUT },
              }}
              initial={{ opacity: 0, filter: "blur(2px)" }}
              key="token"
              transition={{ duration: 0.16, ease: EASE_OUT }}
            >
              {segment.token}
            </motion.span>
          ) : (
            <motion.span
              animate={{ opacity: 1, filter: "blur(0px)" }}
              className="underline decoration-zinc-400/70 decoration-dotted underline-offset-4 dark:decoration-zinc-500"
              exit={{
                opacity: 0,
                filter: "blur(2px)",
                transition: { duration: 0.12, delay, ease: EASE_OUT },
              }}
              initial={{ opacity: 0, filter: "blur(2px)" }}
              key="value"
              title={`Sent as ${segment.token}`}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            >
              {segment.value}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    );
  });
}

function ViewSwitch({
  model,
  onChange,
}: {
  model: boolean;
  onChange: (model: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex h-7 items-center rounded-lg bg-zinc-100 p-0.5 text-[12px] dark:bg-zinc-800">
      {[
        { value: false, label: "You see" },
        { value: true, label: "Model sees" },
      ].map((option) => (
        <button
          aria-pressed={model === option.value}
          className={cn(
            "relative h-6 rounded-md px-2 transition-colors duration-150",
            model === option.value
              ? "text-zinc-900 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          )}
          key={option.label}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {model === option.value && (
            <motion.span
              className="absolute inset-0 rounded-md bg-white shadow-xs dark:bg-zinc-700"
              layoutId={`${id}-view`}
              transition={{ duration: 0.22, ease: EASE_OUT }}
            />
          )}
          <span className="relative">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
