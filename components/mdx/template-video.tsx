"use client";

import { useEffect, useRef } from "react";

interface TemplateVideoProps {
  alt: string;
  poster?: string;
  src: string;
}

/**
 * A still until the reader points at its card, then the template's own
 * walkthrough plays. Nothing autoplays, so eight videos never load at once,
 * and with reduced motion it stays a still.
 */
export function TemplateVideo({ alt, poster, src }: TemplateVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    const card = video?.closest("[data-template-card]");
    if (!(video && card)) {
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    const play = () => {
      if (!reduce.matches) {
        video.play().catch(() => {
          // Autoplay can be refused (data saver); the still stays up.
        });
      }
    };
    const stop = () => {
      video.pause();
    };

    card.addEventListener("pointerenter", play);
    card.addEventListener("pointerleave", stop);
    card.addEventListener("focusin", play);
    card.addEventListener("focusout", stop);
    return () => {
      card.removeEventListener("pointerenter", play);
      card.removeEventListener("pointerleave", stop);
      card.removeEventListener("focusin", play);
      card.removeEventListener("focusout", stop);
    };
  }, []);

  return (
    <video
      aria-label={alt}
      className="aspect-[16/10] w-full bg-black/[0.03] object-cover object-top dark:bg-white/[0.04]"
      loop
      muted
      playsInline
      poster={poster}
      preload={poster ? "none" : "metadata"}
      ref={ref}
      // Without a still, the first frame stands in for one.
      src={poster ? src : `${src}#t=0.1`}
    />
  );
}
