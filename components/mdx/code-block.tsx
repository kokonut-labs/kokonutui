"use client";

import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import {
  type ComponentProps,
  isValidElement,
  type MouseEvent,
  type ReactNode,
} from "react";
import { announceCopy } from "@/components/copy-toast";
import { cn } from "@/lib/utils";

/**
 * Fenced code in the docs, drawn as a plate: square, hairline, no shadow, on
 * the page's own white or black. The title bar and copy button are restyled
 * through `.docs-code` in globals.css, since fumadocs owns that markup.
 */
export function DocsPre({
  label,
  ...props
}: ComponentProps<"pre"> & {
  /**
   * The region's name, worked out on the server. Children that cross from a
   * server component carry no text here, so the label would not match.
   */
  label?: string;
}) {
  return (
    <CodeBlock
      {...props}
      Actions={CopyActions}
      // The scroll area is a focusable region, and a page has several. Each
      // is named after its file, else its first line, so they can be told
      // apart in a list of landmarks.
      className={cn(
        "docs-code my-6 rounded-none border-black/[0.13] bg-white shadow-none dark:border-white/[0.14] dark:bg-black",
        props.className
      )}
      viewportProps={{ "aria-label": label ?? codeLabel(props) }}
    >
      <Pre>{props.children}</Pre>
    </CodeBlock>
  );
}

const LABEL_LENGTH = 60;

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textOf(node.props.children);
  }
  return "";
}

function codeLabel({ title, children }: ComponentProps<"pre">) {
  if (title) {
    return `Code: ${title}`;
  }
  const firstLine = textOf(children).trim().split("\n", 1)[0].trim();
  if (!firstLine) {
    return "Code";
  }
  return firstLine.length > LABEL_LENGTH
    ? `Code: ${firstLine.slice(0, LABEL_LENGTH)}…`
    : `Code: ${firstLine}`;
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
