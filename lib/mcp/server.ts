// The Kokonut UI MCP server: two tools to find and read components, and the
// `kokonutui` skill that tells the agent how to install and use them.

import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { apiToMarkdown, getComponentApi } from "@/lib/component-api";
import { readComponentSource } from "@/lib/get-llm-text";
import {
  type CatalogComponent,
  getCatalog,
  getCategories,
  getRegistryItem,
  searchCatalog,
} from "@/lib/mcp/catalog";
import { getSkillsExtension, SKILL_NAME } from "@/lib/mcp/skill";

const INSTRUCTIONS = `Kokonut UI is a shadcn/ui registry of 100+ React components (AI chat, buttons, cards, inputs, text effects, backgrounds). Use search_components to find one, get_component to read its install command and props, then install it with \`npx shadcn@latest add @kokonutui/<name>\`. The "${SKILL_NAME}" skill has the full workflow.`;

const DEFAULT_LIMIT = 10;
const COMPONENTS_PATH = "components/kokonutui/";
const WORD_START = /(^|-)([a-z0-9])/g;

const text = (value: string) => ({
  content: [{ type: "text" as const, text: value }],
});

const pascalCase = (name: string) =>
  name.replace(WORD_START, (_, _dash, letter: string) => letter.toUpperCase());

const summaryLine = (component: CatalogComponent) =>
  `- ${component.name} (${component.categoryTitle}): ${component.title}. ${component.description}`;

async function describeComponent(name: string, includeSource: boolean) {
  const item = getRegistryItem(name);
  if (!item) {
    const close = searchCatalog(name.replaceAll("-", " ")).slice(0, 5);
    return {
      ...text(
        [
          `No Kokonut UI component is called "${name}".`,
          close.length > 0
            ? `Closest matches:\n${close.map(summaryLine).join("\n")}`
            : "Call search_components to find one.",
        ].join("\n\n")
      ),
      isError: true,
    };
  }

  const docs = getCatalog().find((component) => component.name === name);
  const files = (item.files ?? []).map((file) =>
    typeof file === "string" ? file : file.path
  );
  const isComponent = files.some((file) => file.startsWith(COMPONENTS_PATH));
  const api = isComponent
    ? await getComponentApi(name).catch(() => undefined)
    : undefined;
  const exportName = api?.component ?? pascalCase(name);

  const parts = [
    `# ${docs?.title ?? name} (\`${name}\`)`,
    "",
    docs?.description ?? item.description ?? "",
    "",
    docs ? `Docs and live demo: ${docs.url} (as Markdown: ${docs.url}.md)` : "",
    "",
    "## Install",
    "",
    "```bash",
    `npx shadcn@latest add @kokonutui/${name}`,
    "```",
    "",
    `Without the @kokonutui registry in components.json: \`npx shadcn@latest add ${siteConfig.url}/r/${name}.json\``,
    "",
    `Writes: ${files.join(", ") || "nothing"}`,
    `npm packages: ${item.dependencies?.join(", ") || "none"}`,
    `shadcn/ui primitives: ${item.registryDependencies?.join(", ") || "none"}`,
  ];

  if (isComponent) {
    parts.push(
      "",
      "## Usage",
      "",
      "```tsx",
      `import ${exportName} from "@/components/kokonutui/${name}";`,
      "",
      `<${exportName} />`,
      "```",
      "",
      "It renders with demo data on its own. Pass the props below to show real data."
    );
  }
  if (api) {
    parts.push("", apiToMarkdown(api));
  }
  if (includeSource && isComponent) {
    const code = await readComponentSource(name).catch(() => undefined);
    if (code) {
      parts.push("", "## Source", "", "```tsx", code.trim(), "```");
    }
  }

  return text(
    parts
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** A fresh server per request: the handler is stateless. */
export async function createKokonutServer(): Promise<McpServer> {
  const server = new McpServer(
    { name: "kokonutui", title: "Kokonut UI", version: "1.0.0" },
    { instructions: INSTRUCTIONS }
  );

  const categories = getCategories().map((category) => category.id);

  server.registerTool(
    "search_components",
    {
      title: "Search Kokonut UI components",
      description: `Find Kokonut UI React components by what they do, e.g. "chat input with model picker" or "hold to confirm". Returns names, categories and one-line descriptions. Leave query empty to list every component. Categories: ${categories.join(", ")}.`,
      inputSchema: z.object({
        query: z
          .string()
          .default("")
          .describe("What the component should do or look like."),
        category: z
          .enum(categories as [string, ...string[]])
          .optional()
          .describe("Only search this category."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe(
            `How many results to return. Default ${DEFAULT_LIMIT}, or all when the query is empty.`
          ),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ query, category, limit }) => {
      const results = searchCatalog(query, category);
      const shown = results.slice(
        0,
        limit ?? (query.trim() ? DEFAULT_LIMIT : results.length)
      );
      if (shown.length === 0) {
        return text(
          `No Kokonut UI component matches "${query}". Try other words, or leave the query empty to list everything.`
        );
      }
      return text(
        [
          `${shown.length} of ${results.length} matching components. Call get_component with a name for its install command and props.`,
          "",
          ...shown.map(summaryLine),
        ].join("\n")
      );
    }
  );

  server.registerTool(
    "get_component",
    {
      title: "Get a Kokonut UI component",
      description:
        "Everything needed to install and use one Kokonut UI component: the shadcn add command, the files and packages it installs, the import line, its props and its docs URL. Set include_source to also get the full source.",
      inputSchema: z.object({
        name: z
          .string()
          .describe(
            'The registry name from search_components, e.g. "card-flip".'
          ),
        include_source: z
          .boolean()
          .default(false)
          .describe("Also return the component's full source code."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ name, include_source }) =>
      describeComponent(name.trim().toLowerCase(), include_source)
  );

  (await getSkillsExtension()).attach(server);

  return server;
}
