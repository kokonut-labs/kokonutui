import { promises as fs } from "node:fs";
import path from "node:path";
import { renderPlaceholder } from "fumadocs-core/mdx-plugins/remark-llms.runtime";
import { cacheLife } from "next/cache";
import { siteConfig } from "@/config/site";
import { BLOCK_RENDERERS } from "@/lib/llm-blocks";
import type { source } from "@/lib/source";

const COMPONENTS_DIR = path.join(process.cwd(), "components/kokonutui");

/**
 * Reads a component's source directly rather than going through the
 * `"use server"` action in `lib/action.ts` — a Server Action call would opt
 * these routes out of static generation. The docs pages use it too, so Copy
 * code has the source without a round trip.
 */
export async function readComponentSource(name: string): Promise<string> {
  "use cache";
  // Source files only change with a deploy, which clears this cache anyway.
  // The default profile would re-render every docs page every 15 minutes.
  cacheLife("max");

  return await fs.readFile(path.join(COMPONENTS_DIR, `${name}.tsx`), "utf-8");
}

type Page = (typeof source)["$inferPage"];

type PlaceholderArgs = Parameters<
  Parameters<typeof renderPlaceholder>[1][string]
>[0];

/**
 * Renders a `Preview`-family placeholder as the information an LLM actually
 * needs: how to install the component, and its full source.
 */
async function renderPreview({ attributes }: PlaceholderArgs): Promise<string> {
  const link = typeof attributes.link === "string" ? attributes.link : null;

  if (!link) {
    return "";
  }

  const parts = [
    "## Installation",
    "",
    "```bash",
    `npx shadcn@latest add @kokonutui/${link}`,
    "```",
    "",
  ];

  try {
    const code = await readComponentSource(link);
    parts.push("## Source", "", "```tsx", code.trim(), "```", "");
  } catch {
    // Some previews point at demo-only components with no registry source;
    // the install command above is still useful on its own.
  }

  return parts.join("\n");
}

/**
 * Renders a docs page as clean Markdown for LLM consumption.
 *
 * Relies on `postprocess.includeProcessedMarkdown` in `source.config.ts`.
 * The `Preview` components are preserved as placeholders during compilation
 * and expanded here, since the pages themselves carry almost no prose.
 */
export async function getLLMText(page: Page): Promise<string> {
  const processed = await page.data.getText("processed");

  const body = await renderPlaceholder(processed, {
    ...BLOCK_RENDERERS,
    Preview: renderPreview,
    PreviewClient: renderPreview,
    PreviewTemplate: renderPreview,
  });

  const header = [
    `# ${page.data.title}`,
    "",
    page.data.description ? `> ${page.data.description}\n` : "",
    `Source: ${siteConfig.url}${page.url}`,
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  // Strip the stray empty `#` headings the docs use as spacing, and collapse
  // the blank lines they leave behind.
  const cleaned = body
    .replace(/^#\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return `${header}\n\n${cleaned}\n`;
}
