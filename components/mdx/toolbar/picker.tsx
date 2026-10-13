"use client";

import "./picker.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  setToolbarVariant,
  TOOLBAR_VARIANTS,
  useToolbarVariant,
} from "./variant-store";

const EDITABLE_TAG = /^(INPUT|TEXTAREA|SELECT)$/;

/**
 * Prototype picker for the preview toolbar directions. Exploration harness
 * only: it renders on pages that have a preview and goes away once a
 * direction is chosen.
 */
export function ToolbarPicker() {
  const current = useToolbarVariant();
  const [hasPreview, setHasPreview] = useState(false);
  const [ready, setReady] = useState(false);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setHasPreview(Boolean(document.querySelector("[data-toolbar-variant]")));
  }, []);

  useLayoutEffect(() => {
    if (!hasPreview) {
      return;
    }
    const move = () => {
      const el = itemRefs.current[current];
      const highlight = highlightRef.current;
      if (el && highlight) {
        highlight.style.width = `${el.offsetWidth}px`;
        highlight.style.transform = `translateX(${el.offsetLeft}px)`;
      }
    };
    move();
    window.addEventListener("resize", move);
    return () => window.removeEventListener("resize", move);
  }, [current, hasPreview]);

  useEffect(() => {
    if (!hasPreview) {
      return;
    }
    // Enable the slide only after first paint, so load doesn't animate.
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setReady(true))
    );

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        EDITABLE_TAG.test(target.tagName) ||
        target.isContentEditable ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }
      const count = TOOLBAR_VARIANTS.length;
      const num = Number.parseInt(e.key, 10);
      const index = Number.parseInt(
        new URLSearchParams(window.location.search).get("v") ?? "1",
        10
      );
      const now = Math.min(Math.max(index - 1, 0), count - 1);
      if (num >= 1 && num <= count) {
        setToolbarVariant(num - 1);
      } else if (e.key === "ArrowRight") {
        setToolbarVariant((now + 1) % count);
      } else if (e.key === "ArrowLeft") {
        setToolbarVariant((now - 1 + count) % count);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("keydown", onKey);
    };
  }, [hasPreview]);

  if (!hasPreview) {
    return null;
  }

  return (
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
      {TOOLBAR_VARIANTS.map((name, i) => (
        <button
          aria-current={i === current ? "true" : undefined}
          className="proto-picker-item"
          data-active={i === current ? "" : undefined}
          key={name}
          onClick={() => setToolbarVariant(i)}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          type="button"
        >
          {name}
        </button>
      ))}
    </nav>
  );
}
