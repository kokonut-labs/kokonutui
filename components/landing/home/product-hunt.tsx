"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { enter } from "./styles";

/**
 * Product Hunt's "Featured" badge for the November 2026 launch. It turns
 * itself on at 12:01 AM Pacific on launch day and stays after, so nothing has
 * to be merged at midnight. Preview it any day with `?ph=1`.
 */
const LAUNCH_AT = Date.parse("2026-11-14T08:01:00Z");
const POST_URL =
  "https://www.producthunt.com/products/kokonutui?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-kokonut-ui-2";
const badge = (theme: "light" | "dark") =>
  `https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1300330&theme=${theme}`;
const ALT =
  "Kokonut UI - Open-source UI components for your AI agent | Product Hunt";

/** False on the server and the first client render, so the page hydrates as usual. */
function useLaunched() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const preview = new URLSearchParams(window.location.search).get("ph");
    setOn(preview === "1" || Date.now() >= LAUNCH_AT);
  }, []);
  return on;
}

export function ProductHuntBadge() {
  const on = useLaunched();
  if (!on) {
    return null;
  }
  return (
    <a
      className="home-enter inline-flex w-fit rounded-[10px] focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2 dark:focus-visible:outline-white"
      href={POST_URL}
      rel="noopener noreferrer"
      style={enter(2)}
      target="_blank"
    >
      <Image
        alt={ALT}
        className="dark:hidden"
        height={54}
        src={badge("light")}
        unoptimized
        width={250}
      />
      <Image
        alt={ALT}
        className="hidden dark:block"
        height={54}
        src={badge("dark")}
        unoptimized
        width={250}
      />
    </a>
  );
}
