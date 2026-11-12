"use client";

import Link from "next/link";
import { type ComponentProps, useState } from "react";

/**
 * A link that prefetches its page when someone points at it or focuses it,
 * not when it scrolls into view. For long lists of links (the catalog index,
 * the footer, the changelog), where prefetching every visible row cost
 * hundreds of requests per visit and almost none were followed.
 */
export function HoverLink({
  onFocus,
  onMouseEnter,
  ...props
}: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [intent, setIntent] = useState(false);

  return (
    <Link
      {...props}
      onFocus={(event) => {
        setIntent(true);
        onFocus?.(event);
      }}
      onMouseEnter={(event) => {
        setIntent(true);
        onMouseEnter?.(event);
      }}
      prefetch={intent ? null : false}
    />
  );
}
