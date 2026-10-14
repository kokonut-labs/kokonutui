import type { Node } from "fumadocs-core/page-tree";
import { siteConfig } from "@/config/site";
import { source } from "@/lib/source";

/**
 * Emits an llms.txt index (https://llmstxt.org).
 *
 * Written by hand rather than using `llms(source).index()` because the spec
 * calls for absolute URLs pointing at the Markdown variants, with a
 * description per entry — the built-in helper emits relative HTML links and
 * takes no options.
 */
const ABSOLUTE_URL_REGEX = /^https?:\/\//;
const DOCS_PREFIX_REGEX = /^\/docs\/?/;

function toMarkdownUrl(url: string): string {
  return `${siteConfig.url}${url}.md`;
}

function renderNode(node: Node, lines: string[]): void {
  if (node.type === "folder") {
    const name = typeof node.name === "string" ? node.name : undefined;

    if (name) {
      lines.push("", `## ${name}`, "");
    }

    if (node.index) {
      renderNode(node.index, lines);
    }

    for (const child of node.children) {
      renderNode(child, lines);
    }

    return;
  }

  if (node.type !== "page") {
    return;
  }

  const title = typeof node.name === "string" ? node.name : node.url;

  // Links out to kokonutui.pro aren't part of this documentation and have no
  // Markdown variant — list them as-is so the index stays honest.
  if (node.external || ABSOLUTE_URL_REGEX.test(node.url)) {
    lines.push(`- [${title}](${node.url})`);
    return;
  }

  const page = source.getPage(
    node.url.replace(DOCS_PREFIX_REGEX, "").split("/")
  );
  const description = page?.data.description;

  lines.push(
    description
      ? `- [${title}](${toMarkdownUrl(node.url)}): ${description}`
      : `- [${title}](${toMarkdownUrl(node.url)})`
  );
}

export function GET() {
  const tree = source.getPageTree();
  const lines: string[] = [
    `# ${siteConfig.name}`,
    "",
    `> ${siteConfig.description}`,
    "",
    "Components are installed with the shadcn CLI, e.g.",
    "`npx shadcn@latest add @kokonutui/card-flip`. Each page below links to",
    "its Markdown source, which includes the install command and the full",
    "component source code.",
    "",
    `To set Kokonut UI up in a project, follow ${siteConfig.url}/setup.md.`,
    "",
  ];

  for (const child of tree.children) {
    renderNode(child, lines);
  }

  lines.push(
    "",
    "## Optional",
    "",
    `- [Full documentation](${siteConfig.url}/llms-full.txt): Every page concatenated into one file.`,
    `- [Component registry](${siteConfig.url}/r/registry.json): shadcn registry index.`,
    ""
  );

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, must-revalidate",
    },
  });
}
