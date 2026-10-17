"use client";

import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { announceCopy } from "@/components/copy-toast";
import { cn } from "@/lib/utils";

/**
 * Fenced code in the docs, drawn as a plate: square, hairline, no shadow, on
 * the page's own white or black. The title bar and copy button are restyled
 * through `.docs-code` in globals.css, since fumadocs owns that markup.
 */
export function DocsPre(props: ComponentProps<"pre">) {
  return (
    <CodeBlock
      {...props}
      Actions={CopyActions}
      className={cn(
        "docs-code my-6 rounded-none border-black/[0.13] bg-white shadow-none dark:border-white/[0.14] dark:bg-black",
        props.className
      )}
    >
      <Pre>{props.children}</Pre>
    </CodeBlock>
  );
}

/**
 * Fumadocs' own copy button, with the site toast on top. Its write is fire
 * and forget, so the toast follows the click the same way its check does.
 */
function CopyActions({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target as Element).closest("button")) {
      return;
    }
    // Name the file when the block has a title, else show its first line.
    const figure = event.currentTarget.closest("figure");
    const title = figure?.querySelector("figcaption")?.textContent;
    announceCopy(title || figure?.querySelector("pre")?.textContent || "");
  };

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: listens for the copy button's own click as it bubbles
    // biome-ignore lint/a11y/noStaticElementInteractions: same, the button inside is the control
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard activation of the button fires click too
    <div className={cn("empty:hidden", className)} onClick={onClick}>
      {children}
    </div>
  );
}
