"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { announceCopy } from "@/components/copy-toast";
import { CopyIconSwap } from "@/components/landing/home/client";
import { cn } from "@/lib/utils";

const COPIED_MS = 1600;
const cache = new Map<string, Promise<string>>();

/** Fetches the page's Markdown once; a failed fetch is retried next time. */
function load(url: string) {
  let text = cache.get(url);
  if (!text) {
    text = fetch(url).then((res) => {
      if (!res.ok) {
        throw new Error(`Markdown fetch failed: ${res.status}`);
      }
      return res.text();
    });
    text.catch(() => cache.delete(url));
    cache.set(url, text);
  }
  return text;
}

/**
 * Copies the page as Markdown, like fumadocs' MarkdownCopyButton, with the
 * site's icon swap and toast. The Markdown is fetched on hover or focus, so
 * the click itself copies straight away.
 */
export function CopyMarkdownButton({
  markdownUrl,
  className,
}: {
  markdownUrl: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    },
    []
  );

  const copy = useCallback(() => {
    const text = load(markdownUrl);
    setLoading(true);
    // Safari only allows clipboard writes inside the click, so hand it a
    // pending item rather than waiting for the fetch first.
    const write =
      typeof ClipboardItem === "undefined"
        ? text.then((value) => navigator.clipboard.writeText(value))
        : navigator.clipboard.write([
            new ClipboardItem({ "text/plain": text }),
          ]);

    write
      .then(
        () => {
          setCopied(true);
          announceCopy(markdownUrl.split("/").at(-1));
          if (timer.current !== null) {
            window.clearTimeout(timer.current);
          }
          timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
        },
        // A failed copy leaves the button as it was.
        () => undefined
      )
      .finally(() => setLoading(false));
  }, [markdownUrl]);

  return (
    <button
      className={cn(
        // fumadocs' secondary button, so it pairs with the view options next to it
        "inline-flex items-center justify-center gap-2 rounded-md border bg-fd-secondary px-2 py-1.5 font-medium text-fd-secondary-foreground text-xs transition-colors duration-100 hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      disabled={loading}
      onClick={copy}
      onFocus={() => load(markdownUrl)}
      onPointerEnter={() => load(markdownUrl)}
      type="button"
    >
      <CopyIconSwap className="size-3.5" copied={copied} />
      {copied ? "Copied" : "Copy Markdown"}
    </button>
  );
}
