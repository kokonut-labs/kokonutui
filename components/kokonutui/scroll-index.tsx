"use client";

/**
 * @author: @dorianbaffier
 * @description: Scroll Index
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface ScrollIndexProps {
  /** The content to index. Defaults to a sample article. */
  children?: ReactNode;
  /** Which headings get a tick. */
  selector?: string;
  /**
   * `self`: the component scrolls its own box (default).
   * `window`: the page scrolls and the rail sticks beside the content.
   */
  scroller?: "self" | "window";
  className?: string;
}

interface Section {
  el: HTMLElement;
  text: string;
  level: number;
  /** Scroll position that brings the heading to the top. */
  at: number;
  /** Where its tick sits on the rail, 0 to 1. */
  pos: number;
}

// The rail is this tall at most, in px; ticks sit at the scroll position of
// their heading, so long sections leave long gaps.
const RAIL = 280;
// Headings land this far below the top edge when jumped to.
const OFFSET = 16;
// Ticks swell near the pointer like a dock: peak width and reach, in px.
const SWELL = 1.6;
const REACH = 26;
// A drag let go this close to a tick (after its momentum) settles on it.
const SNAP = 18;
// How long the flashed section name stays up after scrolling into it.
const FLASH = 900;

function easeInOut(t: number) {
  return t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2;
}

export default function ScrollIndex({
  children,
  selector = "h2, h3",
  scroller = "self",
  className,
}: ScrollIndexProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const tickRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [sections, setSections] = useState<
    { text: string; level: number; pos: number }[]
  >([]);
  // The effect below reads and writes these without re-rendering.
  const api = useRef<{
    jump: (index: number) => void;
    show: (i: number) => void;
  }>({ jump: () => undefined, show: () => undefined });

  useEffect(() => {
    const box = boxRef.current;
    const content = contentRef.current;
    const rail = railRef.current;
    const head = headRef.current;
    const label = labelRef.current;
    if (!(box && content && rail && head && label)) {
      return;
    }
    const usesWindow = scroller === "window";
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let list: Section[] = [];
    let start = 0;
    let end = 1;
    let active = -1;
    let height = RAIL;
    let raf = 0;
    let tween = 0;
    let flashTimer = 0;
    let painted = false;
    let hover: number | null = null;
    let drag: {
      id: number;
      moved: boolean;
      y: number;
      t: number;
      v: number;
    } | null = null;
    const swell: number[] = [];

    const getScroll = () => (usesWindow ? window.scrollY : box.scrollTop);
    const setScroll = (value: number) => {
      if (usesWindow) {
        window.scrollTo(0, value);
      } else {
        box.scrollTop = value;
      }
    };

    const measure = () => {
      const scroll = getScroll();
      if (usesWindow) {
        const top = content.getBoundingClientRect().top + scroll;
        start = Math.max(top - OFFSET, 0);
        end = Math.max(
          top + content.offsetHeight - window.innerHeight,
          start + 1
        );
      } else {
        start = 0;
        end = Math.max(box.scrollHeight - box.clientHeight, 1);
      }
      const origin = usesWindow ? 0 : box.getBoundingClientRect().top - scroll;
      list = Array.from(content.querySelectorAll<HTMLElement>(selector)).map(
        (el) => {
          const at = Math.min(
            Math.max(
              el.getBoundingClientRect().top + scroll - origin - OFFSET,
              start
            ),
            end
          );
          return {
            el,
            text: el.textContent?.trim() ?? "",
            level: Number(el.tagName.slice(1)) || 2,
            at,
            pos: (at - start) / (end - start),
          };
        }
      );
      height = rail.clientHeight || RAIL;
      setSections(list.map(({ text, level, pos }) => ({ text, level, pos })));
    };

    const fraction = () =>
      Math.min(Math.max((getScroll() - start) / (end - start), 0), 1);

    const nearest = (y: number) => {
      let best = -1;
      let distance = Number.POSITIVE_INFINITY;
      list.forEach((s, i) => {
        const d = Math.abs(s.pos * height - y);
        if (d < distance) {
          distance = d;
          best = i;
        }
      });
      return { index: best, distance };
    };

    const placeLabel = (index: number, visible: boolean) => {
      const section = list[index];
      if (!section) {
        label.style.opacity = "0";
        return;
      }
      if (label.textContent !== section.text) {
        label.textContent = section.text;
      }
      label.style.transform = `translate3d(0, ${(section.pos * height).toFixed(1)}px, 0) translateY(-50%)`;
      label.style.opacity = visible ? "1" : "0";
    };

    /** Section the reader is in: the last heading at or above the top. */
    const current = () => {
      const scroll = getScroll() + 1;
      let index = -1;
      for (let i = 0; i < list.length; i++) {
        if (list[i].at <= scroll) {
          index = i;
        }
      }
      return index;
    };

    const paint = () => {
      raf = 0;
      head.style.transform = `translate3d(0, ${(fraction() * height).toFixed(1)}px, 0)`;
      const now = current();
      if (now !== active) {
        active = now;
        tickRefs.current.forEach((tick, i) => {
          if (tick) {
            tick.dataset.passed = i <= active ? "true" : "false";
          }
        });
        // Scrolling into a new section names it briefly.
        if (painted && hover === null && !drag && active >= 0) {
          placeLabel(active, true);
          window.clearTimeout(flashTimer);
          flashTimer = window.setTimeout(() => {
            if (hover === null && !drag) {
              label.style.opacity = "0";
            }
          }, FLASH);
        }
      }
      // Ticks ease toward their swell, so the magnification follows the
      // pointer smoothly instead of jumping.
      let moving = false;
      tickRefs.current.forEach((tick, i) => {
        if (!tick) {
          return;
        }
        const y = (list[i]?.pos ?? 0) * height;
        const target =
          hover === null || reduceMotion
            ? 1
            : 1 + SWELL * Math.exp(-((hover - y) ** 2) / (2 * REACH * REACH));
        const value = (swell[i] ?? 1) + (target - (swell[i] ?? 1)) * 0.35;
        swell[i] = Math.abs(value - target) < 0.005 ? target : value;
        moving ||= swell[i] !== target;
        tick.style.setProperty("--swell", swell[i].toFixed(3));
      });
      painted = true;
      if (moving) {
        schedule();
      }
    };

    function schedule() {
      if (!raf) {
        raf = requestAnimationFrame(paint);
      }
    }

    const stopTween = () => {
      cancelAnimationFrame(tween);
      tween = 0;
    };

    const scrollTo = (target: number) => {
      stopTween();
      const from = getScroll();
      const to = Math.min(Math.max(target, 0), usesWindow ? 1e9 : end);
      if (reduceMotion || Math.abs(to - from) < 2) {
        setScroll(to);
        return;
      }
      const duration = Math.min(
        Math.max(260 + Math.abs(to - from) * 0.12, 300),
        650
      );
      const begin = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - begin) / duration, 1);
        setScroll(from + (to - from) * easeInOut(t));
        tween = t < 1 ? requestAnimationFrame(step) : 0;
      };
      tween = requestAnimationFrame(step);
    };

    api.current = {
      jump: (index) => {
        const section = list[index];
        if (section) {
          scrollTo(section.at);
        }
      },
      show: (index) => {
        hover = (list[index]?.pos ?? 0) * height;
        placeLabel(index, true);
        schedule();
      },
    };

    const railY = (event: PointerEvent) =>
      Math.min(
        Math.max(event.clientY - rail.getBoundingClientRect().top, 0),
        height
      );

    const scrub = (y: number) =>
      setScroll(start + (y / height) * (end - start));

    const onDown = (event: PointerEvent) => {
      if (drag || event.button !== 0) {
        return;
      }
      event.preventDefault();
      rail.setPointerCapture(event.pointerId);
      stopTween();
      const y = railY(event);
      drag = { id: event.pointerId, moved: false, y, t: event.timeStamp, v: 0 };
      hover = y;
      rail.dataset.dragging = "";
      placeLabel(nearest(y).index, true);
      schedule();
    };

    const onMove = (event: PointerEvent) => {
      const y = railY(event);
      if (drag && event.pointerId === drag.id) {
        const dt = Math.max(event.timeStamp - drag.t, 1);
        drag.v = drag.v * 0.4 + ((y - drag.y) / dt) * 0.6;
        drag.moved ||= Math.abs(y - drag.y) > 3;
        drag.y = y;
        drag.t = event.timeStamp;
        if (drag.moved) {
          // Dragging the rail scrubs the page under it.
          scrub(y);
        }
      } else if (event.pointerType !== "mouse") {
        return;
      }
      hover = y;
      placeLabel(nearest(y).index, true);
      schedule();
    };

    const onUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) {
        return;
      }
      const { moved, y, v } = drag;
      drag = null;
      delete rail.dataset.dragging;
      if (event.pointerType !== "mouse") {
        hover = null;
        placeLabel(-1, false);
      }
      // Where the flick was heading, then the tick nearest that.
      const projected = moved ? y + v * 120 : y;
      const hit = nearest(projected);
      if (hit.index >= 0 && (!moved || hit.distance < SNAP)) {
        api.current.jump(hit.index);
      }
      schedule();
    };

    const onLeave = () => {
      if (drag) {
        return;
      }
      hover = null;
      placeLabel(-1, false);
      schedule();
    };

    const scrollTarget: HTMLElement | Window = usesWindow ? window : box;
    const onScroll = () => schedule();
    // Any scroll input of the reader's own cancels a jump in progress.
    const onInput = () => stopTween();

    measure();
    paint();
    const resize = new ResizeObserver(() => {
      measure();
      schedule();
    });
    resize.observe(content);
    resize.observe(box);
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    scrollTarget.addEventListener("wheel", onInput, { passive: true });
    scrollTarget.addEventListener("touchstart", onInput, { passive: true });
    rail.addEventListener("pointerdown", onDown);
    rail.addEventListener("pointermove", onMove);
    rail.addEventListener("pointerup", onUp);
    rail.addEventListener("pointercancel", onUp);
    rail.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      stopTween();
      window.clearTimeout(flashTimer);
      resize.disconnect();
      scrollTarget.removeEventListener("scroll", onScroll);
      scrollTarget.removeEventListener("wheel", onInput);
      scrollTarget.removeEventListener("touchstart", onInput);
      rail.removeEventListener("pointerdown", onDown);
      rail.removeEventListener("pointermove", onMove);
      rail.removeEventListener("pointerup", onUp);
      rail.removeEventListener("pointercancel", onUp);
      rail.removeEventListener("pointerleave", onLeave);
    };
  }, [selector, scroller]);

  const onTickKey = (index: number, event: KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    const next = Math.min(
      Math.max(index + (event.key === "ArrowDown" ? 1 : -1), 0),
      sections.length - 1
    );
    tickRefs.current[next]?.focus();
  };

  const self = scroller === "self";

  return (
    <div
      className={cn(
        "relative w-full",
        self &&
          "h-[520px] overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
        !self && "grid grid-cols-[minmax(0,1fr)_3rem] gap-6",
        className
      )}
    >
      <div
        className={cn(self && "h-full overflow-y-auto overscroll-contain")}
        ref={boxRef}
      >
        <div
          className={cn(self && "py-8 pr-16 pl-6 sm:pl-10")}
          ref={contentRef}
        >
          {children ?? <SampleArticle />}
        </div>
      </div>

      <nav
        aria-label="Sections"
        className={cn(
          "z-10 flex w-12 justify-end",
          self
            ? "absolute top-1/2 right-3 -translate-y-1/2"
            : "sticky top-[calc(50vh-140px)] h-fit self-start"
        )}
      >
        <div
          className="relative w-full cursor-pointer touch-none select-none data-[dragging]:cursor-grabbing"
          ref={railRef}
          style={{ height: RAIL }}
        >
          {sections.map((section, index) => (
            <button
              aria-label={section.text}
              className={cn(
                "absolute right-0 h-4 -translate-y-1/2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-zinc-400",
                section.level <= 2 ? "w-3.5" : "w-2"
              )}
              data-passed="false"
              key={`${index}-${section.text}`}
              onBlur={() => labelRef.current?.style.setProperty("opacity", "0")}
              onClick={(event) => {
                // Pointer clicks are handled by the rail; this is the keyboard.
                if (event.detail === 0) {
                  api.current.jump(index);
                }
              }}
              onFocus={() => api.current.show(index)}
              onKeyDown={(event) => onTickKey(index, event)}
              ref={(el) => {
                tickRefs.current[index] = el;
              }}
              style={{ top: `${(section.pos * 100).toFixed(3)}%` }}
              tabIndex={0}
              type="button"
            >
              <span className="absolute top-1/2 right-0 h-[1.5px] w-full origin-right -translate-y-1/2 scale-x-[var(--swell,1)] rounded-full bg-zinc-300 in-data-[passed=true]:bg-zinc-900 transition-colors duration-200 ease-out dark:bg-zinc-700 dark:in-data-[passed=true]:bg-zinc-100" />
            </button>
          ))}
          {/* Where the reader is, between ticks too. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-0 h-[2px] w-6 -translate-y-1/2 rounded-full bg-zinc-900 will-change-transform dark:bg-zinc-100"
            ref={headRef}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-9 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-1 font-medium text-xs text-zinc-700 opacity-0 shadow-sm transition-[opacity,transform] duration-150 ease-out dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            ref={labelRef}
          />
        </div>
      </nav>
    </div>
  );
}

function SampleArticle() {
  const p = "mt-3 text-[15px] text-zinc-600 leading-relaxed dark:text-zinc-400";
  const h2 =
    "mt-12 font-semibold text-xl text-zinc-900 tracking-tight first:mt-0 dark:text-zinc-100";
  const h3 = "mt-8 font-medium text-base text-zinc-900 dark:text-zinc-100";
  return (
    <article className="mx-auto max-w-xl">
      <p className="font-medium text-xs text-zinc-400 dark:text-zinc-500">
        Field notes · 8 min read
      </p>
      <h2 className={cn(h2, "mt-2 text-2xl")}>Building a component library</h2>
      <p className={p}>
        A component library is a promise: that the next screen will be faster to
        build than the last, and that it will feel like the same product. These
        notes cover what we learned keeping that promise for two years.
      </p>
      <p className={p}>
        Most of it is about saying no. Every prop is a decision someone else has
        to make, and every variant is a screen that drifts.
      </p>
      <h2 className={h2}>Principles</h2>
      <p className={p}>
        Three rules settled most arguments before they started. Write them down
        early, and point to them often.
      </p>
      <h3 className={h3}>Restraint</h3>
      <p className={p}>
        Ship the smallest component that solves the problem in front of you. A
        button with four sizes is easier to live with than one with nine, and
        nobody has ever asked for the fifth.
      </p>
      <h3 className={h3}>Motion with a purpose</h3>
      <p className={p}>
        Animation explains where something came from and where it went. Anything
        else is decoration, and decoration ages quickly. Keep interface motion
        under 300 ms and let people interrupt it.
      </p>
      <h2 className={h2}>Tokens</h2>
      <p className={p}>
        Tokens are the vocabulary. Color, type, spacing and radius live in one
        place, so a rebrand is a pull request rather than a quarter.
      </p>
      <h3 className={h3}>Color</h3>
      <p className={p}>
        Name colors by job, not by hue. A surface, a border and a muted label
        survive a palette change; a zinc-150 never does.
      </p>
      <h3 className={h3}>Type</h3>
      <p className={p}>
        Two families and five sizes cover nearly everything. Line height is part
        of the size, never a separate choice.
      </p>
      <h2 className={h2}>Components</h2>
      <p className={p}>
        Build from the inside out: primitives first, then the pieces that
        compose them. A dialog is a portal, a focus trap and a surface before it
        is ever a confirmation box.
      </p>
      <p className={p}>
        Keep the API close to the platform. If it behaves like a button, it is a
        button element, with every attribute a button takes.
      </p>
      <h2 className={h2}>Accessibility</h2>
      <p className={p}>
        Keyboard first. If a component can't be used without a mouse, it is not
        finished. Test with a screen reader before review, not after launch, and
        treat reduced motion as a real setting.
      </p>
      <h2 className={h2}>Shipping</h2>
      <p className={p}>
        Release small and often. A changelog people actually read is worth more
        than a migration guide nobody finds.
      </p>
      <p className={p}>
        Every release gets a short note: what changed, why, and what to do about
        it, in that order.
      </p>
      <h2 className={h2}>What's next</h2>
      <p className={p}>
        Theming per product, a token pipeline that feeds design and code from
        the same file, and fewer components, not more.
      </p>
      <p className={cn(p, "pb-40")}>
        Thanks for reading. Drag the rail on the right to move through these
        notes, or hover it to see where each section starts.
      </p>
    </article>
  );
}
