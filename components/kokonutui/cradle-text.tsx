"use client";

/**
 * @author: @dorianbaffier
 * @description: Cradle Text
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface CradleTextProps {
  /** The line of letters hung from the rail. Keep it to one line. */
  text?: string;
  className?: string;
  /** Lift the first letter and let it go once, the first time it's seen. */
  intro?: boolean;
  /** How much speed a collision keeps, 0 to 1. Steel is about 0.95. */
  bounce?: number;
}

// Every letter hangs from the rail on a thread, a pendulum of the same
// length, so it swings like the balls of a Newton's cradle: letters that
// touch pass the knock along, and the one at the far end flies out.
const SUBSTEPS = 8;
const ITERATIONS = 3;
// One full swing takes this long, whatever the font size: a desk toy with
// strings about 12 cm long.
const PERIOD = 0.72;
// Air drag, per second. Most of the energy is lost in the clacks; the last
// small sway is damped harder so the cradle comes to rest in seconds.
const DRAG = 0.3;
const SETTLE_DRAG = 1.6;
const SETTLE_BELOW = 0.02;
// Furthest a letter can be pulled out, in radians.
const MAX_ANGLE = 1.15;
// A cursor sweeping through a letter knocks it, per px/s of its speed.
const SWEEP_PUSH = 0.22;
const MAX_SWEEP = 900;
// A tap sends a letter out to about this angle.
const TAP_ANGLE = 0.38;
// The intro pulls the first letter out this far, then lets go.
const INTRO_ANGLE = 0.62;
const INTRO_PULL = 520;
// Below this energy (radians, roughly) the cradle is at rest.
const REST = 0.0004;

interface Bob {
  el: HTMLElement;
  /** Ink edges and centre, in stage px, with the letter hanging still. */
  left: number;
  right: number;
  center: number;
  top: number;
  bottom: number;
  /** Where the letter's own box sits, to rotate it about its pivot. */
  boxLeft: number;
  boxTop: number;
  /** Space to the next letter at rest; they collide when it closes. */
  gap: number;
  phi: number;
  omega: number;
  held: boolean;
}

function clamp(x: number, min: number, max: number) {
  return Math.min(Math.max(x, min), max);
}

function easeOut(t: number) {
  return 1 - (1 - t) ** 4;
}

export default function CradleText({
  text = "Momentum",
  className,
  intro = true,
  bounce = 0.97,
}: CradleTextProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const lettersRef = useRef<HTMLSpanElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const lettersEl = lettersRef.current;
    const rail = railRef.current;
    const ink = document.createElement("canvas").getContext("2d");
    if (!(stage && lettersEl && rail && ink)) {
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const spans = Array.from(
      lettersEl.querySelectorAll<HTMLElement>("[data-letter]")
    );
    const restitution = clamp(bounce, 0, 1);
    const w0 = (2 * Math.PI) / PERIOD;

    let bobs: Bob[] = [];
    // Pivot height and the swing radius, measured to the letters' middle.
    let railY = 0;
    let radius = 1;
    let raf = 0;
    let last = 0;
    let visible = true;
    let pull: { bob: Bob; start: number; to: number } | null = null;
    let hand: {
      id: number;
      bob: Bob;
      startX: number;
      startTime: number;
      moved: boolean;
      prev: number;
      prevTime: number;
      spin: number;
    } | null = null;
    let sweep: { x: number; t: number; over: Bob | null } | null = null;

    const measure = () => {
      const stageBox = stage.getBoundingClientRect();
      const probe = lettersEl.lastElementChild as HTMLElement;
      const baseline = probe.getBoundingClientRect().bottom - stageBox.top;
      const style = getComputedStyle(lettersEl);
      const em = Number.parseFloat(style.fontSize);
      ink.font = style.font;
      railY = rail.getBoundingClientRect().top - stageBox.top + 0.5;
      radius = Math.max(baseline - em * 0.35 - railY, 1);
      bobs = spans.map((el) => {
        el.style.transform = "";
        const box = el.getBoundingClientRect();
        const m = ink.measureText(el.dataset.letter ?? "");
        const boxLeft = box.left - stageBox.left;
        const left = boxLeft - m.actualBoundingBoxLeft;
        const right = boxLeft + m.actualBoundingBoxRight;
        const top = baseline - m.actualBoundingBoxAscent;
        const center = (left + right) / 2;
        // The thread runs from the rail to the top of the ink.
        const thread = el.firstElementChild as HTMLElement;
        thread.style.left = `${center - boxLeft - 0.5}px`;
        thread.style.top = `${railY - (box.top - stageBox.top)}px`;
        thread.style.height = `${Math.max(top - railY, 0)}px`;
        return {
          el,
          left,
          right,
          center,
          top,
          bottom: baseline + m.actualBoundingBoxDescent,
          boxLeft,
          boxTop: box.top - stageBox.top,
          gap: 0,
          phi: 0,
          omega: 0,
          held: false,
        };
      });
      for (let i = 0; i + 1 < bobs.length; i++) {
        bobs[i].gap = Math.max(bobs[i + 1].left - bobs[i].right, 0);
      }
      pull = null;
      hand = null;
    };

    const draw = () => {
      for (const bob of bobs) {
        if (bob.phi === 0) {
          bob.el.style.transform = "";
          continue;
        }
        const px = bob.center - bob.boxLeft;
        const py = railY - bob.boxTop;
        // Swinging right turns the letter counter-clockwise about the rail.
        bob.el.style.transform = `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, 0) rotate(${(-bob.phi).toFixed(4)}rad) translate3d(${(-px).toFixed(2)}px, ${(-py).toFixed(2)}px, 0)`;
      }
    };

    const energy = () =>
      bobs.reduce(
        (e, b) => e + (b.omega / w0) ** 2 + 2 * (1 - Math.cos(b.phi)),
        0
      );

    /** Bounce two touching letters apart if they're closing. */
    const bounceApart = (a: Bob, b: Bob, wa: number, wb: number) => {
      const ca = Math.max(Math.cos(a.phi), 0.2);
      const cb = Math.max(Math.cos(b.phi), 0.2);
      const va = a.omega * radius * ca;
      const vb = b.omega * radius * cb;
      const closing = va - vb;
      if (closing <= 0) {
        return;
      }
      const impulse = ((1 + restitution) * closing) / (wa + wb);
      // A held letter (weight 0) keeps the hand's speed.
      a.omega = (va - wa * impulse) / (radius * ca);
      b.omega = (vb + wb * impulse) / (radius * cb);
    };

    /** Separate two letters that overlap and bounce them if they're closing. */
    const collide = (a: Bob, b: Bob) => {
      const xa = radius * Math.sin(a.phi);
      const xb = radius * Math.sin(b.phi);
      const depth = xa - xb - a.gap;
      const wa = a.held ? 0 : 1;
      const wb = b.held ? 0 : 1;
      if (depth <= 0 || wa + wb === 0) {
        return;
      }
      const share = depth / (wa + wb);
      a.phi = Math.asin(clamp((xa - wa * share) / radius, -1, 1));
      b.phi = Math.asin(clamp((xb + wb * share) / radius, -1, 1));
      bounceApart(a, b, wa, wb);
    };

    const swing = (h: number, drag: number) => {
      for (const bob of bobs) {
        if (!bob.held) {
          bob.omega -= w0 * w0 * Math.sin(bob.phi) * h;
          bob.omega *= 1 - drag * h;
          bob.phi += bob.omega * h;
        }
      }
    };

    const step = (dt: number) => {
      const h = dt / SUBSTEPS;
      const drag = energy() < SETTLE_BELOW ? SETTLE_DRAG : DRAG;
      for (let s = 0; s < SUBSTEPS; s++) {
        swing(h, drag);
        // Sweep both ways so a knock travels the whole row in one step,
        // the way it does through a real cradle.
        for (let it = 0; it < ITERATIONS; it++) {
          for (let i = 0; i + 1 < bobs.length; i++) {
            collide(bobs[i], bobs[i + 1]);
          }
          for (let i = bobs.length - 2; i >= 0; i--) {
            collide(bobs[i], bobs[i + 1]);
          }
        }
      }
    };

    const runPull = (now: number) => {
      if (!pull) {
        return;
      }
      const t = (now - pull.start) / INTRO_PULL;
      if (t >= 1.25) {
        pull.bob.held = false;
        pull.bob.omega = 0;
        pull = null;
        return;
      }
      pull.bob.held = true;
      pull.bob.phi = pull.to * easeOut(Math.min(t, 1));
      pull.bob.omega = 0;
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible) {
        return;
      }
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      runPull(now);
      step(dt);
      draw();
      if (hand || pull || energy() > REST) {
        raf = requestAnimationFrame(frame);
        return;
      }
      for (const bob of bobs) {
        bob.phi = 0;
        bob.omega = 0;
      }
      draw();
    };

    const start = () => {
      if (!raf && visible) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    /** Pointer in stage px. */
    const local = (event: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      return { x: event.clientX - r.left, y: event.clientY - r.top };
    };

    /** The letter under the pointer, where it hangs right now. */
    const bobAt = (x: number, y: number, slack: number) =>
      bobs.find((bob) => {
        const shift = radius * Math.sin(bob.phi);
        return (
          x > bob.left + shift - slack &&
          x < bob.right + shift + slack &&
          y > bob.top - slack &&
          y < bob.bottom + slack
        );
      });

    const onDown = (event: PointerEvent) => {
      if (hand || event.button !== 0) {
        return;
      }
      const p = local(event);
      const em = Number.parseFloat(getComputedStyle(lettersEl).fontSize);
      const bob = bobAt(p.x, p.y, em * 0.1);
      if (!bob) {
        return;
      }
      stage.setPointerCapture(event.pointerId);
      pull = null;
      bob.held = true;
      bob.omega = 0;
      hand = {
        id: event.pointerId,
        bob,
        startX: p.x - radius * Math.sin(bob.phi),
        startTime: event.timeStamp,
        moved: false,
        prev: bob.phi,
        prevTime: event.timeStamp,
        spin: 0,
      };
      stage.dataset.grabbing = "";
      start();
    };

    const onMove = (event: PointerEvent) => {
      const p = local(event);
      if (hand && event.pointerId === hand.id) {
        const dx = p.x - hand.startX;
        if (Math.abs(dx) > 3) {
          hand.moved = true;
        }
        // The letter follows the finger sideways along its arc.
        const phi = Math.asin(
          clamp(dx / radius, -Math.sin(MAX_ANGLE), Math.sin(MAX_ANGLE))
        );
        const dt = Math.max(event.timeStamp - hand.prevTime, 8) / 1000;
        const spin = (phi - hand.prev) / dt;
        hand.spin = hand.spin * 0.4 + spin * 0.6;
        hand.prev = phi;
        hand.prevTime = event.timeStamp;
        hand.bob.phi = phi;
        // Carried into its neighbours, the hand pushes them along.
        hand.bob.omega = hand.spin;
        start();
        return;
      }
      if (event.pointerType !== "mouse") {
        sweep = null;
        return;
      }
      const over = bobAt(p.x, p.y, 0) ?? null;
      if (sweep && over && over !== sweep.over && !over.held) {
        // Brushing through a letter knocks it the way the cursor moved.
        const dt = Math.max(event.timeStamp - sweep.t, 8) / 1000;
        const vx = clamp((p.x - sweep.x) / dt, -MAX_SWEEP, MAX_SWEEP);
        over.omega += (SWEEP_PUSH * vx) / radius;
        pull = null;
        start();
      }
      sweep = { x: p.x, t: event.timeStamp, over };
    };

    const onUp = (event: PointerEvent) => {
      if (!hand || event.pointerId !== hand.id) {
        return;
      }
      const { bob } = hand;
      bob.held = false;
      delete stage.dataset.grabbing;
      if (hand.moved) {
        // Let go from still if the hand stopped before releasing.
        const idle = event.timeStamp - hand.prevTime > 60;
        bob.omega = idle ? 0 : clamp(hand.spin, -w0 * 1.5, w0 * 1.5);
      } else {
        // A tap knocks the letter away from the side it was tapped on.
        const p = local(event);
        const side = p.x < bob.center + radius * Math.sin(bob.phi) ? 1 : -1;
        bob.omega += side * w0 * TAP_ANGLE;
      }
      hand = null;
      start();
    };

    const onLeave = () => {
      sweep = null;
    };

    measure();
    draw();

    let width = stage.clientWidth;
    const resizeObserver = new ResizeObserver(() => {
      if (stage.clientWidth === width) {
        return;
      }
      width = stage.clientWidth;
      measure();
      draw();
    });
    resizeObserver.observe(stage);
    document.fonts?.ready.then(() => {
      measure();
      draw();
    });

    let greeted = !intro || reduceMotion;
    let greetTimer = 0;
    const intersection = new IntersectionObserver(
      ([entry]) => {
        visible =
          entry.isIntersecting && document.visibilityState === "visible";
        if (!visible) {
          return;
        }
        if (!greeted && entry.intersectionRatio > 0.6) {
          greeted = true;
          greetTimer = window.setTimeout(() => {
            const first = bobs[0];
            if (first && !hand) {
              pull = { bob: first, start: performance.now(), to: -INTRO_ANGLE };
              start();
            }
          }, 400);
        }
        start();
      },
      { threshold: [0, 0.6] }
    );
    intersection.observe(stage);
    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      if (visible) {
        start();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (!reduceMotion) {
      stage.addEventListener("pointerdown", onDown);
      stage.addEventListener("pointermove", onMove);
      stage.addEventListener("pointerup", onUp);
      stage.addEventListener("pointercancel", onUp);
      stage.addEventListener("pointerleave", onLeave);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(greetTimer);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onUp);
      stage.removeEventListener("pointerleave", onLeave);
    };
  }, [intro, bounce]);

  return (
    <div className={cn("@container flex w-full justify-center", className)}>
      <div
        className="relative cursor-grab touch-pan-y select-none px-[0.9em] pt-[1.5em] pb-[0.45em] font-semibold text-[clamp(2rem,11cqi,6rem)] text-zinc-900 leading-none tracking-tight data-[grabbing]:cursor-grabbing dark:text-zinc-100"
        ref={stageRef}
      >
        <span className="sr-only">{text}</span>
        {/* The rail the letters hang from. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-[0.3em] h-px bg-zinc-300 dark:bg-zinc-700"
          ref={railRef}
        />
        <span
          aria-hidden="true"
          className="relative block whitespace-pre"
          ref={lettersRef}
        >
          {Array.from(text).map((char, index) =>
            char === " " ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: letters repeat; their position is their identity.
              <span className="inline-block w-[0.32em]" key={index} />
            ) : (
              <span
                className="relative inline-block origin-top-left will-change-transform"
                data-letter={char}
                // biome-ignore lint/suspicious/noArrayIndexKey: letters repeat; their position is their identity.
                key={index}
              >
                <span className="absolute w-px bg-zinc-300 dark:bg-zinc-600" />
                {char}
              </span>
            )
          )}
          <span className="inline-block h-0 w-0" />
        </span>
      </div>
    </div>
  );
}
