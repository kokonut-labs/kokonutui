"use client";

import { useSyncExternalStore } from "react";

export const TOOLBAR_VARIANTS = ["Command", "Spec", "Ink"] as const;

const EVENT = "kokonutui:toolbar-variant";

function read() {
  const v = Number.parseInt(
    new URLSearchParams(window.location.search).get("v") ?? "1",
    10
  );
  return v >= 1 && v <= TOOLBAR_VARIANTS.length ? v - 1 : 0;
}

export function setToolbarVariant(index: number) {
  const url = new URL(window.location.href);
  url.searchParams.set("v", String(index + 1));
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new CustomEvent(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("popstate", onChange);
  };
}

/** Selected prototype variant, persisted in the `?v=` URL param. */
export function useToolbarVariant() {
  return useSyncExternalStore(subscribe, read, () => 0);
}
