"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const SIDEBARS = "#nd-sidebar, #nd-sidebar-mobile";

// Long enough that sweeping the pointer down the list doesn't prefetch every
// row it crosses, short next to the usual gap between pointing and clicking.
const HOVER_DELAY_MS = 60;

function sidebarHref(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }
  const link = target.closest("a[href^='/']");
  return link?.closest(SIDEBARS) ? link.getAttribute("href") : null;
}

/**
 * Sidebar rows don't prefetch as they scroll into view (that was about 80
 * requests per page view), and `prefetch: false` on a Next link also turns
 * off its hover prefetch, so every click waited for the next page's data
 * with the old page frozen on screen. This prefetches a row when the pointer
 * rests on it or it gets focus, which is usually done before the click lands.
 */
export function SidebarIntentPrefetch() {
  const router = useRouter();

  useEffect(() => {
    let pending: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onPointerOver = (event: PointerEvent) => {
      const href = sidebarHref(event.target);
      if (href === pending) {
        return;
      }
      clearTimeout(timer);
      pending = href;
      if (href) {
        timer = setTimeout(() => router.prefetch(href), HOVER_DELAY_MS);
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      const href = sidebarHref(event.target);
      if (href) {
        router.prefetch(href);
      }
    };

    document.addEventListener("pointerover", onPointerOver, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [router]);

  return null;
}
