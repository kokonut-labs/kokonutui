"use client";

import "./picker.css";
import "./prototype.css";
import {
  type ComponentType,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { VariantProps } from "./data";
import { EditorialVariant } from "./variant-editorial";
import { PlaygroundVariant } from "./variant-playground";
import { TerminalVariant } from "./variant-terminal";

const VARIANTS: { name: string; Component: ComponentType<VariantProps> }[] = [
  { name: "Playground", Component: PlaygroundVariant },
  { name: "Editorial", Component: EditorialVariant },
  { name: "Terminal", Component: TerminalVariant },
];

const IGNORED_TAGS = /^(INPUT|TEXTAREA|SELECT)$/;

function readVariantFromUrl() {
  const v = Number.parseInt(
    new URLSearchParams(window.location.search).get("v") ?? "",
    10
  );
  return v >= 1 && v <= VARIANTS.length ? v - 1 : 0;
}

/** Maps a key press to a variant index, "replay", or null to ignore it. */
function keyAction(e: KeyboardEvent, index: number): number | "replay" | null {
  const target = e.target as HTMLElement;
  if (IGNORED_TAGS.test(target.tagName) || target.isContentEditable) {
    return null;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) {
    return null;
  }
  const num = Number.parseInt(e.key, 10);
  if (num >= 1 && num <= VARIANTS.length) {
    return num - 1;
  }
  if (e.key === "ArrowRight") {
    return (index + 1) % VARIANTS.length;
  }
  if (e.key === "ArrowLeft") {
    return (index - 1 + VARIANTS.length) % VARIANTS.length;
  }
  if (e.key === "r" || e.key === "R") {
    return "replay";
  }
  return null;
}

export function Harness(props: VariantProps) {
  // null until mounted: the selection lives in the URL, which the server
  // render can't see, so nothing renders until we've read it.
  const [current, setCurrent] = useState<number | null>(null);
  const [mountKey, setMountKey] = useState(0);
  const [ready, setReady] = useState(false);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const moveHighlight = useCallback(() => {
    if (current === null) {
      return;
    }
    const el = itemRefs.current[current];
    const highlight = highlightRef.current;
    if (!(el && highlight)) {
      return;
    }
    highlight.style.width = `${el.offsetWidth}px`;
    highlight.style.transform = `translateX(${el.offsetLeft}px)`;
  }, [current]);

  const select = useCallback((i: number) => {
    if (i < 0 || i >= VARIANTS.length) {
      return;
    }
    setCurrent(i);
    // A new key re-mounts the variant, so entrance animations re-run.
    setMountKey((k) => k + 1);
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(i + 1));
    window.history.replaceState(null, "", url);
  }, []);

  const replay = useCallback(() => setMountKey((k) => k + 1), []);

  useEffect(() => {
    setCurrent(readVariantFromUrl());
    // Enable the slide only after first paint, so load doesn't animate.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);

  useLayoutEffect(() => {
    moveHighlight();
  }, [moveHighlight]);

  useEffect(() => {
    window.addEventListener("resize", moveHighlight);
    return () => window.removeEventListener("resize", moveHighlight);
  }, [moveHighlight]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const action = keyAction(e, current ?? 0);
      if (action === "replay") {
        replay();
      } else if (action !== null) {
        select(action);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [current, select, replay]);

  const Variant = current === null ? null : VARIANTS[current].Component;

  return (
    <>
      {Variant ? <Variant key={mountKey} {...props} /> : null}
      <nav
        aria-label="Prototype variants"
        className="proto-picker"
        data-ready={ready ? "" : undefined}
      >
        <span
          aria-hidden="true"
          className="proto-picker-highlight"
          ref={highlightRef}
        />
        {VARIANTS.map((variant, i) => (
          <button
            aria-current={i === current ? "true" : undefined}
            className="proto-picker-item"
            data-active={i === current ? "" : undefined}
            key={variant.name}
            onClick={() => select(i)}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            type="button"
          >
            {variant.name}
          </button>
        ))}
        <span aria-hidden="true" className="proto-picker-divider" />
        <button
          aria-label="Replay animation (R)"
          className="proto-picker-item proto-picker-replay"
          onClick={replay}
          type="button"
        >
          ↻
        </button>
      </nav>
    </>
  );
}
