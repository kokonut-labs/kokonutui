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

// Cursor and VS Code install an MCP server from a link; the config is the
// same `npx shadcn@latest mcp` the files below hold.
const CURSOR_INSTALL_URL =
  "cursor://anysphere.cursor-deeplink/mcp/install?name=shadcn&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyJzaGFkY25AbGF0ZXN0IiwibWNwIl19";
const VSCODE_INSTALL_URL =
  "vscode:mcp/install?%7B%22name%22%3A%22shadcn%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22shadcn%40latest%22%2C%22mcp%22%5D%7D";

export const MCP_SETUP: Record<
  McpClient,
  {
    file: string;
    language: string;
    config: string;
    note: string;
    install?: { label: string; href: string };
  }
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
    install: { label: "Add to Cursor", href: CURSOR_INSTALL_URL },
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
    install: { label: "Add to VS Code", href: VSCODE_INSTALL_URL },
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

const indent = (text: string) =>
  text
    .split("\n")
    .map((line) => (line ? `   ${line}` : line))
    .join("\n");

export const SETUP_URL = `${siteConfig.url}/setup.md`;

/** The one line a person gives their agent; the steps live at SETUP_URL. */
export const SETUP_PROMPT = `Set up Kokonut UI in this project by following ${SETUP_URL}`;

/**
 * The setup, written for an agent to carry out, served at /setup.md. Editor
 * agnostic: the agent knows which client and package manager it runs with.
 */
export const SETUP_GUIDE = `# Set up Kokonut UI

Kokonut UI (${siteConfig.url}) is a shadcn/ui component registry. You are an AI agent setting it up in the user's project. Run each command with the project's package manager (bunx, pnpm dlx or npx), skip any step that is already done, and don't change unrelated files.

1. If the project has no components.json, run:
   npx shadcn@latest init
2. Add the registry to components.json, keeping any registries already there:
   "registries": { "@kokonutui": "https://kokonutui.com/r/{name}.json" }
3. Install the cn helper the components use:
   npx shadcn@latest add https://kokonutui.com/r/utils.json
4. Connect the shadcn MCP server for the editor you are running in, so you can browse and install components later:
   npx shadcn@latest mcp init --client <claude|cursor|vscode|codex>
5. Add the rules below to the project's agent instructions file: CLAUDE.md, AGENTS.md, .cursor/rules/kokonutui.mdc or .github/copilot-instructions.md, whichever the project already uses. Create AGENTS.md if there is none.

${indent(RULES_BODY)}

When you're done, tell the user in a few lines what you changed, whether they need to restart their editor for the MCP server, and suggest one component they could add next (the list is at ${siteConfig.url}/llms.txt).

Full guide for people: ${siteConfig.url}/docs/agents
`;

/** Per component: a prompt that installs it straight from its registry URL. */
export const componentPrompt = (name: string) =>
  `Add the ${name} component from Kokonut UI to this project with npx shadcn@latest add ${siteConfig.url}/r/${name}.json, then show me how to use it.`;

export const AGENT_PROMPTS = [
  "Show me every component in the @kokonutui registry",
  "Add @kokonutui/particle-button to my project",
  "Add an AI chat input with a model picker to the home page",
  "Build a pricing section with @kokonutui components",
];

export const AGENT_ENDPOINTS = [
  {
    path: "/setup.md",
    description:
      "Setup steps written for an agent: registry, MCP server and rules file. The setup prompt points here.",
  },
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
