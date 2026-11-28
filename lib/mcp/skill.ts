// The skill the MCP server publishes (MCP Skills extension). A host that
// supports skills loads SKILL.md when the work calls for it; the setup
// reference is read on demand. The component list stays in the tools, so the
// skill never has to repeat the registry.

import {
  memorySkillFiles,
  type SkillCatalog,
  SkillsExtension,
} from "@modelcontextprotocol/server/ext/skills";
import { siteConfig } from "@/config/site";

export const SKILL_NAME = "kokonutui";

const SKILL_MD = `---
name: ${SKILL_NAME}
description: Find, install and use Kokonut UI React components (AI chat inputs, tool calls, model pickers, cards, buttons, inputs, text effects, backgrounds) with the shadcn CLI. Use when building UI in a React and Tailwind project, before writing an animated, interactive or AI chat component from scratch, or when the user mentions Kokonut UI.
---

# Kokonut UI

Kokonut UI (${siteConfig.url}) is 100+ free, MIT-licensed React components built with Tailwind CSS v4 and Motion. It is a shadcn/ui registry: each component is copied into the project as source with \`shadcn add\`, then it is the project's own code.

## When to reach for it

Check Kokonut UI before building any of these by hand: an AI chat input, model picker, tool call or approval row, streaming or loading state, citations, a pricing or checkout card, an animated button, a text effect, a hero background. If nothing fits, say so and build it normally.

## Workflow

1. **Find the component.** Call \`search_components\` with what the user needs in plain words ("chat input with file attachments", "hold to confirm button"). Pass \`category\` to narrow it.
2. **Read it before installing.** Call \`get_component\` with the name. It returns the install command, what gets installed, the props and the import line. Add \`include_source: true\` only when you need to see the implementation.
3. **Check the project.** It needs Tailwind CSS v4 and shadcn/ui set up (a \`components.json\`). If either is missing, follow [references/setup.md](references/setup.md) first.
4. **Install with the CLI.** Run it with the project's package manager:
   \`\`\`bash
   npx shadcn@latest add @kokonutui/<name>
   \`\`\`
   Use \`bunx --bun\` or \`pnpm dlx\` in place of \`npx\` when the project uses Bun or pnpm. If \`components.json\` has no \`@kokonutui\` registry, either add it (see setup) or install from the URL: \`npx shadcn@latest add ${siteConfig.url}/r/<name>.json\`.
5. **Use it.** The file lands in \`components/kokonutui/<name>.tsx\`. Import the default export: \`import CardFlip from "@/components/kokonutui/card-flip";\`. Components ship with demo data so they render on their own; replace it with the user's real data through the props.

## Rules

- Install with \`shadcn add\`. Never paste a component's source into the project by hand: the CLI also installs its npm packages (like \`motion\` or \`lucide-react\`) and shadcn/ui primitives (like \`button\` or \`textarea\`).
- After installing, the component is project code. Edit it in place to fit the design rather than wrapping it in another component.
- Keep the \`@/\` imports the component uses. The CLI rewrites them to the project's aliases.
- Components follow the project's light and dark theme through Tailwind \`dark:\` classes. Don't add a theme provider for them.
- Don't install several components to try them. Pick one with \`get_component\`, install it, and show the user where it is used.
- Tell the user which component you installed and link its docs page, so they can see the live demo.
`;

const SETUP_MD = `# Setting up Kokonut UI in a project

Skip any step that is already done. Run commands with the project's package manager (\`npx\`, \`bunx --bun\` or \`pnpm dlx\`).

1. The project needs React 19 and Tailwind CSS v4.
2. If there is no \`components.json\`, run \`npx shadcn@latest init\`.
3. Add the registry to \`components.json\`, keeping any registries already there:
   \`\`\`json
   {
     "registries": {
       "@kokonutui": "${siteConfig.url}/r/{name}.json"
     }
   }
   \`\`\`
4. Install the \`cn\` helper the components use, if \`lib/utils.ts\` doesn't have it: \`npx shadcn@latest add ${siteConfig.url}/r/utils.json\`.

Full guide: ${siteConfig.url}/docs/agents
`;

let extension: Promise<SkillCatalog> | undefined;

/**
 * The skills extension, built once per server instance. Every file's digest
 * is computed here, so a host that approved the skill sees any later change.
 */
export function getSkillsExtension(): Promise<SkillCatalog> {
  extension ??= SkillsExtension.load(
    memorySkillFiles({
      [`${SKILL_NAME}/SKILL.md`]: SKILL_MD,
      [`${SKILL_NAME}/references/setup.md`]: SETUP_MD,
    }),
    // The files only change with a deploy.
    { cacheHint: { ttlMs: 3_600_000, cacheScope: "public" }, strict: true }
  );
  return extension;
}
