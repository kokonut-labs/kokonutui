import type { renderPlaceholder } from "fumadocs-core/mdx-plugins/remark-llms.runtime";
import { getParts } from "@/components/landing/home/parts";
import { siteConfig } from "@/config/site";
import {
  AGENT_ENDPOINTS,
  AGENT_PROMPTS,
  AGENT_RULES,
  MCP_CLIENTS,
  MCP_SETUP,
  mcpInit,
  SETUP_PROMPT,
  SETUP_URL,
} from "@/lib/agents";
import { RELEASES } from "@/lib/changelog";
import { getProPeek, proPeekUrl } from "@/lib/pro-peeks";
import { PRO_TEMPLATE_LIST, proTemplateUrl } from "@/lib/pro-templates";

// Markdown for the docs' own MDX blocks, so the `.md` pages agents read carry
// the same commands and files as the page, never raw JSX.

type Renderer = Parameters<typeof renderPlaceholder>[1][string];
type Args = Parameters<Renderer>[0];

const attr = ({ attributes }: Args, name: string) => {
  const value = attributes[name];
  return typeof value === "string" ? value : undefined;
};

const fence = (language: string, code: string, title?: string) =>
  [
    title ? `\`\`\`${language} title="${title}"` : `\`\`\`${language}`,
    code,
    "```",
    "",
  ].join("\n");

const command: Renderer = (args) => {
  const run = attr(args, "run");
  return run ? fence("bash", `npx ${run}`) : "";
};

const note: Renderer = (args) => {
  const title = attr(args, "title") ?? "Note";
  const body = args.children.trim().replace(/\n/g, "\n> ");
  return `> **${title}**\n>\n> ${body}\n`;
};

const mcpSetup: Renderer = () =>
  MCP_CLIENTS.map(({ id, label }) => {
    const setup = MCP_SETUP[id];
    return [
      `### ${label}`,
      "",
      fence("bash", `npx ${mcpInit(id)}`),
      ...(setup.install
        ? [`${setup.install.label}: ${setup.install.href}`, ""]
        : []),
      `Or add it by hand to \`${setup.file}\`:`,
      "",
      fence(setup.language, setup.config, setup.file),
      setup.note,
      "",
    ].join("\n");
  }).join("\n");

const agentRules: Renderer = () =>
  MCP_CLIENTS.map(({ id, label }) => {
    const rules = AGENT_RULES[id];
    return [
      `### ${label}: \`${rules.file}\``,
      "",
      fence("markdown", rules.content, rules.file),
    ].join("\n");
  }).join("\n");

const agentPrompts: Renderer = () =>
  `${AGENT_PROMPTS.map((prompt) => `- "${prompt}"`).join("\n")}\n`;

const agentEndpoints: Renderer = () =>
  `${AGENT_ENDPOINTS.map(
    ({ path, description }) => `- \`${siteConfig.url}${path}\`: ${description}`
  ).join("\n")}\n`;

const release: Renderer = (args) => {
  const found = RELEASES.find((r) => r.date === attr(args, "date"));
  if (!found) {
    return "";
  }
  const parts = new Map(getParts().map((p) => [p.name, p]));
  const pr = (n: number) => `[#${n}](${siteConfig.links.github}/pull/${n})`;
  const lines: string[] = [];
  const group = (
    label: string,
    entries: typeof found.added,
    text: (name: string, note?: string) => string | undefined
  ) => {
    const rows = entries.flatMap((entry) => {
      const part = parts.get(entry.name);
      if (!part) {
        return [];
      }
      const about = text(entry.name, entry.note);
      return [
        `- [${part.title}](${siteConfig.url}${part.url}.md) (${part.category}, ${pr(entry.pr)})${about ? `: ${about}` : ""}`,
      ];
    });
    if (rows.length > 0) {
      lines.push(`**${label}**`, "", ...rows, "");
    }
  };
  group("New components", found.added, (name) => parts.get(name)?.description);
  group("Improved", found.improved, (_name, note) => note);
  if (found.library?.length) {
    lines.push("**Across the library**", "");
    for (const change of found.library) {
      lines.push(`- ${change.note} (${change.prs.map(pr).join(", ")})`);
    }
    lines.push("");
  }
  return lines.join("\n");
};

const setupChoice: Renderer = () =>
  [
    "To have an agent do the whole setup, give it this prompt:",
    "",
    fence("text", SETUP_PROMPT),
    `If you are an agent setting up Kokonut UI, follow ${SETUP_URL}. Otherwise, follow the steps below.`,
    "",
  ].join("\n");

const proTemplates: Renderer = () =>
  PRO_TEMPLATE_LIST.map(
    (t) =>
      `- **${t.name}** (${t.category}, $${t.price}): ${t.blurb} Live preview: ${t.previewLink} · Get it: ${proTemplateUrl(t.slug)}`
  ).join("\n");

const proPeek: Renderer = (args) => {
  const peek = getProPeek(attr(args, "name") ?? "");
  if (!peek) {
    return "";
  }
  return [
    "This component is part of Kokonut UI Pro, so it isn't in the free `@kokonutui` registry. With a Pro key it installs from the Pro registry:",
    "",
    fence("bash", `npx shadcn@latest add @kokonutui-pro/${peek.name}`),
    "What it does:",
    "",
    ...peek.features.map((line) => `- ${line}`),
    "",
    `Get it with Kokonut UI Pro: ${proPeekUrl(peek, "llms")}`,
    "",
  ].join("\n");
};

export const BLOCK_RENDERERS: Record<string, Renderer> = {
  Command: command,
  Note: note,
  McpSetup: mcpSetup,
  AgentRules: agentRules,
  AgentPrompts: agentPrompts,
  AgentEndpoints: agentEndpoints,
  Release: release,
  SetupChoice: setupChoice,
  ProTemplates: proTemplates,
  ProPeek: proPeek,
};
