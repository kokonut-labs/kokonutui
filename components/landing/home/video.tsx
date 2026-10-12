"use client";

import { PlayIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A YouTube embed that costs nothing until it's wanted: a thumbnail and a play
 * button, swapped for the player (already playing) on click.
 */
export function VideoCard({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-3xl bg-[#0a0a0a] shadow-[0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
        className
      )}
    >
      {playing ? (
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 size-full"
          // The play button it replaces had focus; hand it to the player so
          // keyboard users land on the video, not back at the top.
          ref={(el) => el?.focus()}
          referrerPolicy="strict-origin-when-cross-origin"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title="KokonutUI on YouTube"
        />
      ) : (
        <button
          className="group absolute inset-0 rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-inset"
          onClick={() => setPlaying(true)}
          type="button"
        >
          {thumbFailed ? null : (
            <Image
              alt=""
              className="object-cover opacity-75 transition-opacity duration-200 ease-out group-hover:opacity-90"
              fill
              onError={() => setThumbFailed(true)}
              sizes="(min-width: 1024px) 480px, 100vw"
              src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            />
          )}
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-transform duration-150 ease-out group-active:scale-[0.95]">
              <PlayIcon aria-hidden className="ml-0.5 size-5 fill-current" />
            </span>
          </span>
          <span className="absolute bottom-5 left-5 font-medium text-[14px] text-white">
            Play video
          </span>
        </button>
      )}
    </div>
  );
}
