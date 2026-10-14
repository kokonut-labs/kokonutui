// What the docs tell people and their agents: package-manager runners, the
// MCP config each editor reads, the rules file each one loads, and the
// machine-readable endpoints the site serves. The docs components and the
// `.md` endpoints both read from here, so the page and its Markdown agree.

import type { McpClient } from "@/components/landing/home/data";
import { siteConfig } from "@/config/site";

// biome-ignore lint/performance/noBarrelFile: one list of editors, shared with the homepage
export { MCP_CLIENTS, type McpClient } from "@/components/landing/home/data";

export const PACKAGE_MANAGERS = [
  { id: "bun", run: "bunx --bun" },
  { id: "npm", run: "npx" },
  { id: "pnpm", run: "pnpm dlx" },
] as const;

export type PackageManager = (typeof PACKAGE_MANAGERS)[number]["id"];

/** `shadcn@latest add …` run through the chosen package manager. */
export function runWith(manager: PackageManager, command: string): string {
  const run = PACKAGE_MANAGERS.find((m) => m.id === manager)?.run ?? "npx";
  return `${run} ${command}`;
}

export const REGISTRY_JSON = `{
  "registries": {
    "@kokonutui": "https://kokonutui.com/r/{name}.json"
  }
}`;

const MCP_JSON = `{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    }
  }
}`;

export const MCP_SETUP: Record<
  McpClient,
  { file: string; language: string; config: string; note: string }
> = {
  claude: {
    file: ".mcp.json",
    language: "json",
    config: MCP_JSON,
    note: "Restart Claude Code, then run /mcp to check that shadcn is connected.",
  },
  cursor: {
    file: ".cursor/mcp.json",
    language: "json",
    config: MCP_JSON,
    note: "Turn the server on in Cursor Settings, under MCP.",
  },
  vscode: {
    file: ".vscode/mcp.json",
    language: "json",
    config: `{
  "servers": {
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    }
  }
}`,
    note: "Open .vscode/mcp.json and click Start next to the shadcn server.",
  },
  codex: {
    file: "~/.codex/config.toml",
    language: "toml",
    config: `[mcp_servers.shadcn]
command = "npx"
args = ["shadcn@latest", "mcp"]`,
    note: "Restart Codex. It reads the server from your global config.",
  },
};

export const mcpInit = (client: McpClient) =>
  `shadcn@latest mcp init --client ${client}`;

const RULES_BODY = `# Kokonut UI

This project installs components from Kokonut UI, a shadcn/ui registry.
The registry is set in components.json as "@kokonutui".

- Before building an animated or interactive component from scratch, check
  Kokonut UI: ${siteConfig.url}/llms.txt lists every component with a
  one-line description.
- Install with the shadcn CLI, never by pasting code:
  npx shadcn@latest add @kokonutui/<name>
  It writes components/kokonutui/<name>.tsx and installs its dependencies.
- Installed components are project code. Edit them in place rather than
  wrapping them.
- Any docs page is available as Markdown, with the full source, by adding
  .md to its URL, e.g. ${siteConfig.url}/docs/buttons/particle-button.md`;

export const AGENT_RULES: Record<McpClient, { file: string; content: string }> =
  {
    claude: { file: "CLAUDE.md", content: RULES_BODY },
    cursor: {
      file: ".cursor/rules/kokonutui.mdc",
      content: `---
description: Installing and editing Kokonut UI components
alwaysApply: false
---

${RULES_BODY}`,
    },
    vscode: { file: ".github/copilot-instructions.md", content: RULES_BODY },
    codex: { file: "AGENTS.md", content: RULES_BODY },
  };

export const AGENT_PROMPTS = [
  "Show me every component in the @kokonutui registry",
  "Add @kokonutui/particle-button to my project",
  "Add an AI chat input with a model picker to the home page",
  "Build a pricing section with @kokonutui components",
];

export const AGENT_ENDPOINTS = [
  {
    path: "/llms.txt",
    description:
      "Index of every docs page, with a one-line description and a link to its Markdown.",
  },
  {
    path: "/llms-full.txt",
    description:
      "Every docs page in one file, component source included. Large; for agents that read it once.",
  },
  {
    path: "/docs/<page>.md",
    description:
      "Any docs page as Markdown, with its install command and full source. The Copy Markdown button on each page copies the same text.",
  },
  {
    path: "/r/registry.json",
    description:
      "The shadcn registry index: every component with its dependencies and files.",
  },
  {
    path: "/r/<name>.json",
    description:
      "One component's registry item, the file the CLI and the MCP server install from.",
  },
] as const;
