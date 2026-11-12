"use client";

import type { SharedProps } from "fumadocs-ui/contexts/search";
import { lazy, Suspense, useEffect } from "react";

const loadSearchDialog = () => import("@/components/search-dialog");

// The search client and its index reader are about 100 KB. With
// `preload: false` on the provider (app/layout.tsx) this only mounts on the
// first open, so a visitor who never searches never downloads them.
const StaticSearchDialog = lazy(loadSearchDialog);

export default function LazySearchDialog(props: SharedProps) {
  return (
    <Suspense fallback={null}>
      <StaticSearchDialog {...props} />
    </Suspense>
  );
}

const SEARCH_TRIGGERS =
  "[data-search], [data-search-full], [data-search-intent]";

/**
 * Starts the download as soon as a search looks likely: the pointer or focus
 * reaches a search button, or Cmd/Ctrl goes down (the first half of Cmd+K).
 * By the time the dialog is asked for, its code is usually there.
 */
export function SearchIntent() {
  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      controller.abort();
      loadSearchDialog().catch(() => {
        // Offline or a stale deploy: opening the dialog will try again.
      });
    };
    const onPoint = (event: Event) => {
      if (
        event.target instanceof Element &&
        event.target.closest(SEARCH_TRIGGERS)
      ) {
        load();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Meta" || event.key === "Control") {
        load();
      }
    };
    const options = { signal: controller.signal, passive: true };
    document.addEventListener("pointerover", onPoint, options);
    document.addEventListener("focusin", onPoint, options);
    document.addEventListener("touchstart", onPoint, options);
    window.addEventListener("keydown", onKey, options);
    return () => controller.abort();
  }, []);

  return null;
}
