"use client";

import { useEffect } from "react";
import { trackLink } from "@/lib/track";

/**
 * One listener for the whole site, mounted in the root layout: it reports
 * links out to Pro, Product Hunt, GitHub and the Open in tools as analytics
 * events, so no link needs its own handler. Middle clicks count too.
 */
export function TrackClicks() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.type === "auxclick" && event.button !== 1) {
        return;
      }
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (link instanceof HTMLAnchorElement) {
        trackLink(link.href);
      }
    };
    // Capture, so a menu that stops the click from bubbling is still seen.
    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("auxclick", onClick, true);
    };
  }, []);

  return null;
}
