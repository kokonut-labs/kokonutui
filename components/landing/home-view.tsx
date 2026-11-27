"use client";

import { useEffect } from "react";
import { trackHome } from "@/lib/track";

/** Counts a view of the homepage, whichever version is shown at /. */
export function HomeView() {
  useEffect(() => {
    if (window.location.pathname === "/") {
      trackHome("view");
    }
  }, []);
  return null;
}
