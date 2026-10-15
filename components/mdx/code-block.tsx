import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import type { ComponentProps } from "react";
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
      className={cn(
        "docs-code my-6 rounded-none border-black/[0.13] bg-white shadow-none dark:border-white/[0.14] dark:bg-black",
        props.className
      )}
    >
      <Pre>{props.children}</Pre>
    </CodeBlock>
  );
}
