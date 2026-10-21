"use client";

/**
 * @author: @dorianbaffier
 * @description: Invite Envelope
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { animate, useReducedMotion } from "motion/react";
import { type RefObject, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type InviteAnswer = "going" | "declined";

export interface Invite {
  /** Small line above the title. */
  eyebrow: string;
  title: string;
  note: string;
  when: string;
  where: string;
  /** Who it's from, for the envelope's label. */
  from: string;
  /** Initials pressed into the seal. */
  monogram: string;
}

export interface InviteEnvelopeProps {
  invite?: Invite;
  onRespond?: (answer: InviteAnswer) => void;
  className?: string;
}

type Phase = "sealed" | "moving" | "open" | "answered";

const DEFAULT_INVITE: Invite = {
  eyebrow: "You're invited",
  title: "Ten years of Studio Ferro",
  note: "Dinner on the roof, then drinks until late.",
  when: "Fri, June 12 · 7:00 pm",
  where: "48 Rue Oberkampf, Paris",
  from: "Studio Ferro",
  monogram: "SF",
};

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
/** How far the card climbs to clear the pocket, as a share of the envelope's height. */
const OUT_OF_POCKET = -0.97;
/** Where the card rests in front, as a share of the envelope's height. */
const IN_FRONT = -0.5;
/**
 * Sealed, the envelope sits in the middle of the room above it; it drops to
 * the bottom as the card comes out. A share of its own height.
 */
const SEALED_Y = -0.42;

const STAMP: Record<InviteAnswer, string> = {
  going: "Going",
  declined: "Regrets",
};

export default function InviteEnvelope({
  invite = DEFAULT_INVITE,
  onRespond,
  className,
}: InviteEnvelopeProps) {
  const reduceMotion = useReducedMotion();
  const linerId = `liner${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [phase, setPhase] = useState<Phase>("sealed");
  const [answer, setAnswer] = useState<InviteAnswer | null>(null);
  const [cardFront, setCardFront] = useState(false);
  const [flapBehind, setFlapBehind] = useState(false);

  const envelopeRef = useRef<HTMLDivElement>(null);
  const flapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const sealLeftRef = useRef<HTMLSpanElement>(null);
  const sealRightRef = useRef<HTMLSpanElement>(null);
  const stampRef = useRef<HTMLDivElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (phase !== "open") {
      return;
    }
    (answer ? changeRef : acceptRef).current?.focus({ preventScroll: true });
  }, [phase, answer]);

  const speed = (seconds: number) => (reduceMotion ? 0 : seconds);
  const height = () => envelopeRef.current?.offsetHeight ?? 0;
  const restY = () => height() * SEALED_Y;

  const lift = (deg: number) => {
    const flap = flapRef.current;
    if (phase === "sealed" && flap && !busyRef.current && !reduceMotion) {
      animate(flap, { rotateX: deg }, { duration: 0.2, ease: EASE_OUT });
    }
  };

  const open = async () => {
    const flap = flapRef.current;
    const card = cardRef.current;
    if (busyRef.current || !(flap && card)) {
      return;
    }
    busyRef.current = true;
    setPhase("moving");
    const h = height();
    // The seal gives first, then the flap swings up and over.
    await Promise.all([
      sealLeftRef.current &&
        animate(
          sealLeftRef.current,
          { x: -3, rotate: -10 },
          { duration: speed(0.14), ease: EASE_OUT }
        ),
      sealRightRef.current &&
        animate(
          sealRightRef.current,
          { x: 3, rotate: 10 },
          { duration: speed(0.14), ease: EASE_OUT }
        ),
    ]);
    if (stampRef.current) {
      animate(stampRef.current, { opacity: 0 }, { duration: speed(0.15) });
    }
    if (envelopeRef.current) {
      animate(
        envelopeRef.current,
        { y: [restY(), 0] },
        { duration: speed(0.8), ease: EASE_IN_OUT }
      );
    }
    const swing = animate(
      flap,
      { rotateX: 180 },
      { duration: speed(0.42), ease: EASE_IN_OUT }
    );
    // Past upright, the flap falls in behind the card.
    setTimeout(() => setFlapBehind(true), speed(0.21) * 1000);
    await swing;
    await animate(
      card,
      { y: h * OUT_OF_POCKET },
      { duration: speed(0.42), ease: EASE_OUT }
    );
    setCardFront(true);
    await animate(
      card,
      { y: h * IN_FRONT },
      reduceMotion
        ? { duration: 0 }
        : { type: "spring", duration: 0.5, bounce: 0.18 }
    );
    busyRef.current = false;
    setPhase("open");
  };

  const close = async (next: InviteAnswer) => {
    const flap = flapRef.current;
    const card = cardRef.current;
    if (busyRef.current || !(flap && card)) {
      return;
    }
    busyRef.current = true;
    setPhase("moving");
    const h = height();
    await animate(
      card,
      { y: h * OUT_OF_POCKET },
      { duration: speed(0.32), ease: EASE_IN_OUT }
    );
    setCardFront(false);
    await animate(card, { y: 0 }, { duration: speed(0.36), ease: EASE_OUT });
    const swing = animate(
      flap,
      { rotateX: 0 },
      { duration: speed(0.36), ease: EASE_IN_OUT }
    );
    setTimeout(() => setFlapBehind(false), speed(0.18) * 1000);
    if (envelopeRef.current) {
      animate(
        envelopeRef.current,
        { y: [0, restY()] },
        { duration: speed(0.5), ease: EASE_IN_OUT }
      );
    }
    await swing;
    for (const half of [sealLeftRef.current, sealRightRef.current]) {
      if (half) {
        animate(half, { x: 0, rotate: 0 }, { duration: speed(0.12) });
      }
    }
    setPhase("answered");
    setAnswer(next);
    // The stamp lands with a little weight, and the envelope takes it.
    const stamp = stampRef.current;
    const envelope = envelopeRef.current;
    if (stamp) {
      await animate(
        stamp,
        { opacity: [0, 0.92], scale: [1.18, 1] },
        { duration: speed(0.16), ease: [0.5, 0, 0.75, 0] }
      );
    }
    if (envelope && !reduceMotion) {
      const y = restY();
      animate(
        envelope,
        { y: [y, y + 3, y] },
        { duration: 0.28, ease: EASE_OUT }
      );
    }
    busyRef.current = false;
    openButtonRef.current?.focus({ preventScroll: true });
  };

  const respond = (next: InviteAnswer) => {
    setAnswer(next);
    onRespond?.(next);
    // A beat to read the answer on the card before it goes back in.
    setTimeout(() => close(next), reduceMotion ? 0 : 650);
  };

  const sealed = phase === "sealed" || phase === "answered";

  return (
    <div
      className={cn(
        "relative mx-auto aspect-[16/21] w-full max-w-sm select-none",
        className
      )}
    >
      <svg aria-hidden="true" className="absolute size-0">
        <title>Envelope lining</title>
        <defs>
          <pattern
            height="10"
            id={linerId}
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
            width="10"
          >
            <rect className="fill-[#7a1f2b]" height="10" width="10" />
            <rect className="fill-[#8f2a37]" height="10" width="5" />
          </pattern>
        </defs>
      </svg>

      <div
        className="absolute inset-x-0 bottom-0 aspect-[16/11] [perspective:900px]"
        ref={envelopeRef}
        style={{ transform: `translateY(${SEALED_Y * 100}%)` }}
      >
        {/* Inside of the back, seen once the flap is up */}
        <div className="absolute inset-0 rounded-[10px] bg-[#e9e1d3] shadow-[0_18px_40px_-18px_rgb(60_40_20/0.45)] dark:bg-stone-900 dark:shadow-[0_18px_40px_-18px_rgb(0_0_0/0.8)]" />

        {/* The flap: outside face down, lining inside */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-[58%] origin-top [transform-style:preserve-3d]",
            flapBehind ? "z-[5]" : "z-30"
          )}
          ref={flapRef}
        >
          <div className="absolute inset-0 [backface-visibility:hidden] [clip-path:polygon(0_0,100%_0,52%_96%,50%_100%,48%_96%)]">
            <div className="size-full rounded-t-[10px] bg-[#f3ede2] dark:bg-[#69625a]" />
          </div>
          <div className="absolute inset-0 [backface-visibility:hidden] [clip-path:polygon(0_0,100%_0,52%_96%,50%_100%,48%_96%)] [transform:rotateX(180deg)]">
            <svg
              aria-hidden="true"
              className="size-full"
              preserveAspectRatio="none"
            >
              <title>Lining</title>
              <rect fill={`url(#${linerId})`} height="100%" width="100%" />
            </svg>
          </div>
          {/* Wax seal on the flap's tip, in two halves that part when it opens */}
          <div className="absolute top-full left-1/2 size-11 -translate-x-1/2 -translate-y-[62%] [backface-visibility:hidden]">
            <span
              className="absolute inset-0 [clip-path:inset(0_50%_0_0)]"
              ref={sealLeftRef}
            >
              <Seal monogram={invite.monogram} />
            </span>
            <span
              className="absolute inset-0 [clip-path:inset(0_0_0_50%)]"
              ref={sealRightRef}
            >
              <Seal monogram={invite.monogram} />
            </span>
          </div>
        </div>

        {/* The card */}
        <div
          className={cn(
            "absolute inset-x-[4%] top-[4%] h-[92%]",
            cardFront ? "z-40" : "z-10"
          )}
          ref={cardRef}
        >
          <Card
            acceptRef={acceptRef}
            answer={answer}
            changeRef={changeRef}
            interactive={phase === "open"}
            invite={invite}
            onChange={() => setAnswer(null)}
            onRespond={respond}
          />
        </div>

        {/* The pocket: two side panels and the bottom one over them */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 size-full overflow-visible"
          preserveAspectRatio="none"
          viewBox="0 0 160 105"
        >
          <title>Envelope</title>
          <path
            className="fill-[#efe7da] stroke-black/[0.06] dark:fill-stone-700 dark:stroke-white/5"
            d="M0 6 Q0 0 6 0 L78 56 Q80 58 78 60 L6 105 Q0 105 0 99 Z"
            strokeWidth="0.4"
          />
          <path
            className="fill-[#efe7da] stroke-black/[0.06] dark:fill-stone-700 dark:stroke-white/5"
            d="M160 6 Q160 0 154 0 L82 56 Q80 58 82 60 L154 105 Q160 105 160 99 Z"
            strokeWidth="0.4"
          />
          <path
            className="fill-[#f6f1e8] stroke-black/[0.07] dark:fill-stone-600 dark:stroke-white/5"
            d="M0 99 Q0 105 6 105 L154 105 Q160 105 160 99 L84 50 Q80 47.5 76 50 Z"
            strokeWidth="0.4"
          />
        </svg>

        {/* Address side: who it's from, and the stamp once answered */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[9%] z-20 text-center">
          <p className="text-[11px] text-stone-500 dark:text-zinc-300">
            From {invite.from}
          </p>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-[7%] bottom-[14%] z-20 rotate-[-9deg] opacity-0"
          ref={stampRef}
        >
          {answer && (
            <span
              className={cn(
                "block rounded-md border-2 px-2.5 py-1 font-bold text-[13px] uppercase tracking-[0.18em] mix-blend-multiply dark:mix-blend-normal",
                answer === "going"
                  ? "border-[#7a1f2b] text-[#7a1f2b] dark:border-rose-300 dark:text-rose-300"
                  : "border-stone-500 text-stone-500 dark:border-zinc-300 dark:text-zinc-300"
              )}
            >
              {STAMP[answer]}
            </span>
          )}
        </div>

        {/* While sealed, the whole envelope opens it */}
        {sealed && (
          <button
            aria-label={
              answer
                ? `Invitation from ${invite.from}, answered ${STAMP[answer]}. Open to change`
                : `Open invitation from ${invite.from}`
            }
            className="absolute inset-0 z-50 cursor-pointer rounded-[10px] outline-hidden focus-visible:ring-2 focus-visible:ring-[#7a1f2b]/50 focus-visible:ring-offset-4 dark:focus-visible:ring-rose-300/50 dark:focus-visible:ring-offset-zinc-950"
            onClick={open}
            onPointerEnter={(event) =>
              event.pointerType === "mouse" && lift(22)
            }
            onPointerLeave={() => lift(0)}
            ref={openButtonRef}
            type="button"
          />
        )}
      </div>
    </div>
  );
}

function Seal({ monogram }: { monogram: string }) {
  return (
    <span className="flex size-full items-center justify-center rounded-full bg-[#8f2a37] font-semibold text-[#f6e3d8] text-[11px] tracking-wide shadow-[inset_0_0_0_3px_#7a1f2b,inset_0_0_0_4px_rgb(255_255_255/0.12),0_2px_4px_rgb(60_20_20/0.35)]">
      {monogram}
    </span>
  );
}

function Card({
  invite,
  answer,
  interactive,
  onRespond,
  onChange,
  acceptRef,
  changeRef,
}: {
  invite: Invite;
  answer: InviteAnswer | null;
  interactive: boolean;
  onRespond: (answer: InviteAnswer) => void;
  onChange: () => void;
  acceptRef: RefObject<HTMLButtonElement | null>;
  changeRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div
      aria-hidden={!interactive}
      className="flex h-full flex-col rounded-lg bg-white px-5 pt-4 pb-4 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_10px_30px_-12px_rgb(60_40_20/0.35)] ring-1 ring-black/5 dark:bg-zinc-900 dark:shadow-[0_10px_30px_-12px_rgb(0_0_0/0.8)] dark:ring-white/10"
      inert={!interactive}
    >
      <p className="font-medium text-[#7a1f2b] text-[10px] uppercase tracking-[0.2em] dark:text-rose-300">
        {invite.eyebrow}
      </p>
      <p className="mt-1.5 font-semibold text-lg text-zinc-900 leading-tight tracking-tight dark:text-zinc-50">
        {invite.title}
      </p>
      <p className="mt-1 text-[13px] text-zinc-500 leading-snug dark:text-zinc-400">
        {invite.note}
      </p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
        <dt className="text-zinc-400 dark:text-zinc-500">When</dt>
        <dd className="text-zinc-800 dark:text-zinc-200">{invite.when}</dd>
        <dt className="text-zinc-400 dark:text-zinc-500">Where</dt>
        <dd className="text-zinc-800 dark:text-zinc-200">{invite.where}</dd>
      </dl>
      <div className="mt-auto flex items-center gap-2 pt-3">
        {answer ? (
          <>
            <p className="text-[13px] text-zinc-700 dark:text-zinc-200">
              {answer === "going"
                ? "You're going. We'll save you a seat."
                : "You can't make it. We'll miss you."}
            </p>
            <button
              className="ml-auto h-8 shrink-0 rounded-lg px-3 text-[13px] text-zinc-500 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#7a1f2b]/40 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
              onClick={onChange}
              ref={changeRef}
              type="button"
            >
              Change
            </button>
          </>
        ) : (
          <>
            <button
              className="h-8 flex-1 rounded-lg text-[13px] text-zinc-700 ring-1 ring-black/10 transition-colors duration-150 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#7a1f2b]/40 dark:text-zinc-200 dark:ring-white/15 dark:hover:bg-white/5 dark:hover:text-white"
              onClick={() => onRespond("declined")}
              type="button"
            >
              Can't make it
            </button>
            <button
              className="h-8 flex-1 rounded-lg bg-[#7a1f2b] font-medium text-[13px] text-white transition-colors duration-150 hover:bg-[#6a1a25] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#7a1f2b]/40 focus-visible:ring-offset-2 dark:bg-rose-300 dark:text-zinc-950 dark:focus-visible:ring-offset-zinc-900 dark:hover:bg-rose-200"
              onClick={() => onRespond("going")}
              ref={acceptRef}
              type="button"
            >
              I'll be there
            </button>
          </>
        )}
      </div>
    </div>
  );
}
