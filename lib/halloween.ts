"use client";

import { useEffect, useState } from "react";

/**
 * Halloween touches for the site. Each one turns itself on for October 31
 * in the visitor's own time zone and is gone on November 1, so nothing needs
 * to be reverted on the day.
 *
 * - fright: the homepage headline, accent and logo.
 * - ghost: a ghost haunting a few component pages in the docs.
 *
 * Preview any day with `?halloween=fright`, `?halloween=ghost` or
 * `?halloween=all`; `?halloween=off` turns them off on the day.
 */
export type HalloweenIdea = "fright" | "ghost";

const IDEAS: HalloweenIdea[] = ["fright", "ghost"];
/** What runs on October 31 itself. */
const ON_THE_DAY: HalloweenIdea[] = IDEAS;

const PREVIEW_KEY = "kokonut-halloween-preview";

/** A preview lasts the tab's session, so it survives moving between pages. */
function previewParam() {
  const param = new URLSearchParams(window.location.search).get("halloween");
  try {
    if (param) {
      sessionStorage.setItem(PREVIEW_KEY, param);
      return param;
    }
    return sessionStorage.getItem(PREVIEW_KEY);
  } catch {
    return param;
  }
}

function activeIdeas(): HalloweenIdea[] {
  const param = previewParam();
  if (param) {
    return param === "all"
      ? IDEAS
      : IDEAS.filter((idea) => param.split(",").includes(idea));
  }
  const now = new Date();
  return now.getMonth() === 9 && now.getDate() === 31 ? ON_THE_DAY : [];
}

/**
 * True once mounted on Halloween (or in a preview). It starts false on the
 * server and the first client render, so the page hydrates as it always does
 * and the touches arrive after.
 */
export function useHalloween(idea: HalloweenIdea) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(activeIdeas().includes(idea));
  }, [idea]);
  return on;
}
