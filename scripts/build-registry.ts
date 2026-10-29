import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { glob } from "glob";
import type { z } from "zod";
import type { registryItemFileSchema } from "@/registry/schema";
import { registry } from "../registry/index";

const REGISTRY_BASE_PATH = process.cwd();
const PUBLIC_FOLDER_BASE_PATH = "public/r";
const SKILLS_FOLDER_BASE_PATH = "public/.well-known/agent-skills";
const SITE_URL = "https://kokonutui.com";

// Agent Skills Discovery RFC v0.2.0 (https://agentskills.io).
const SKILLS_SCHEMA_URL =
  "https://schemas.agentskills.io/discovery/0.2.0/schema.json";

/**
 * Skills published for agent discovery. Each entry points at a SKILL.md that
 * lives under `public/.well-known/agent-skills/`; its digest is computed from
 * the file itself at build time so the index can never drift from what is
 * actually served.
 */
const AGENT_SKILLS = [
  {
    name: "install-kokonutui-component",
    dir: "install-component",
    description:
      "Find and install a KokonutUI React component into a project using the shadcn CLI, and read its source and documentation.",
  },
] as const;

const BACKSLASH_REGEX = /\\/g;
const DOCS_PREFIX_REGEX = /^content\/docs\//;
const MDX_EXTENSION_REGEX = /\.mdx$/;

// Console colors and symbols
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
} as const;

const symbols = {
  success: "✓",
  arrow: "→",
  error: "✗",
  dot: "•",
} as const;

function printDivider() {
  console.log(`${colors.dim}${"─".repeat(80)}${colors.reset}\n`);
}

// const REGISTRY_TYPE_FOLDERS: Record<string, string> = {
//     "registry:component": "components",
//     "registry:hook": "hooks",
//     "registry:lib": "lib",
//     "registry:block": "blocks",
// };

/**
 * bun run ./scripts/build-registry.ts
 *
 */
type File = z.infer<typeof registryItemFileSchema>;

async function writeFileRecursive(filePath: string, data: string) {
  const dir = path.dirname(filePath);

  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, data, "utf-8");
    console.log(
      `  ${colors.green}${symbols.success}${colors.reset} Output written to ${colors.cyan}${filePath}${colors.reset}`
    );
  } catch (error) {
    console.log();
    console.error(
      `  ${colors.red}${symbols.error} Error writing file ${filePath}${colors.reset}`
    );
    console.error(error);
    console.log();
  }
}

/**
 * Writes the agent skills discovery index, hashing each SKILL.md so the
 * `sha256:` digests match the bytes served at the skill's URL.
 */
async function generateAgentSkillsIndex() {
  const skills: {
    name: string;
    type: string;
    description: string;
    url: string;
    digest: string;
  }[] = [];

  for (const skill of AGENT_SKILLS) {
    const skillPath = path.join(
      REGISTRY_BASE_PATH,
      SKILLS_FOLDER_BASE_PATH,
      skill.dir,
      "SKILL.md"
    );
    const contents = await fs.readFile(skillPath);
    const digest = createHash("sha256").update(contents).digest("hex");

    skills.push({
      name: skill.name,
      type: "skill-md",
      description: skill.description,
      url: `${SITE_URL}/.well-known/agent-skills/${skill.dir}/SKILL.md`,
      digest: `sha256:${digest}`,
    });
  }

  await writeFileRecursive(
    `${SKILLS_FOLDER_BASE_PATH}/index.json`,
    `${JSON.stringify({ $schema: SKILLS_SCHEMA_URL, skills }, null, 2)}\n`
  );
}

interface ComponentInfo {
  name: string;
  title: string;
  description: string;
  /** Canonical docs route, e.g. "/docs/buttons/gradient-button" */
  route: string;
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;
const TITLE_RE = /title:\s*(.+)/;
const DESCRIPTION_RE = /description:\s*(.+)/;

const extractFrontmatter = (
  content: string
): { title?: string; description?: string } => {
  const frontmatterMatch = content.match(FRONTMATTER_RE);
  if (!frontmatterMatch) {
    return {};
  }

  const frontmatter = frontmatterMatch[1];
  const titleMatch = frontmatter.match(TITLE_RE);
  const descriptionMatch = frontmatter.match(DESCRIPTION_RE);

  return {
    title: titleMatch?.[1]?.trim(),
    description: descriptionMatch?.[1]?.trim(),
  };
};

const getComponentsInfo = async (): Promise<ComponentInfo[]> => {
  try {
    const mdxFiles = await glob("content/docs/**/*.mdx", {
      cwd: REGISTRY_BASE_PATH,
      ignore: ["content/docs/index.mdx", "content/docs/agents.mdx"],
    });
    const components: ComponentInfo[] = [];

    for (const mdxFile of mdxFiles) {
      try {
        const content = await fs.readFile(
          path.join(REGISTRY_BASE_PATH, mdxFile),
          "utf-8"
        );
        const frontmatter = extractFrontmatter(content);

        if (frontmatter.title && frontmatter.description) {
          const name = path.basename(mdxFile, ".mdx");
          const route = `/docs/${mdxFile
            .replace(BACKSLASH_REGEX, "/")
            .replace(DOCS_PREFIX_REGEX, "")
            .replace(MDX_EXTENSION_REGEX, "")}`;
          components.push({
            name,
            title: frontmatter.title,
            description: frontmatter.description,
            route,
          });
        }
      } catch {
        console.error(
          `    ${colors.red}${symbols.error} Error reading MDX file ${mdxFile}${colors.reset}`
        );
      }
    }

    return components.sort((a, b) => a.title.localeCompare(b.title));
  } catch {
    console.error(
      `  ${colors.red}${symbols.error} Error getting component info${colors.reset}`
    );
    return [];
  }
};

const REGISTRY_INDEX_SCHEMA_URL = "https://ui.shadcn.com/schema/registry.json";

const titleFromName = (name: string): string =>
  name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/**
 * Writes the registry index served at `/r/registry.json`, which the shadcn
 * CLI and MCP server read to list every installable item. Titles and
 * descriptions come from each component's docs frontmatter (falling back to
 * the registry entry itself for hooks and lib items without docs pages), so
 * the index can never drift from the registry or the documentation.
 */
const generateRegistryIndex = async (
  components: ComponentInfo[]
): Promise<void> => {
  const docsByName = new Map(
    components.map((component) => [component.name, component])
  );

  const items = registry.map((entry) => {
    const docs = docsByName.get(entry.name);
    return {
      name: entry.name,
      type: entry.type,
      title: docs?.title ?? titleFromName(entry.name),
      description: docs?.description ?? entry.description,
      dependencies: entry.dependencies,
      registryDependencies: entry.registryDependencies,
      files: (entry.files ?? []).map((file) =>
        typeof file === "string"
          ? { path: file, type: entry.type }
          : { path: file.path, type: file.type }
      ),
    };
  });

  const index = `${JSON.stringify(
    {
      $schema: REGISTRY_INDEX_SCHEMA_URL,
      name: "kokonut-ui",
      homepage: SITE_URL,
      items,
    },
    null,
    2
  )}\n`;

  // The root copy is the canonical source in the repo; the public copy is
  // what actually gets served at kokonutui.com/r/registry.json.
  await writeFileRecursive("registry.json", index);
  await writeFileRecursive(`${PUBLIC_FOLDER_BASE_PATH}/registry.json`, index);
};

const generateLLMsFile = async (components: ComponentInfo[]): Promise<void> => {
  const llmsContent = `# KokonutUI - Component Registry Index

Collection of ${components.length} UI components free and open source built with Next.js, React, Tailwind CSS, and Motion.

Install any component with: npx shadcn@latest add @kokonutui/<component-name>

Agents can also browse and install components through the shadcn MCP server
(npx shadcn@latest mcp) once the @kokonutui registry is configured in
components.json. Setup guide: https://kokonutui.com/docs/agents

The documentation index for LLMs lives at https://kokonutui.com/llms.txt

## Components

${components
  .map(
    (component) =>
      `- [${component.title}](https://kokonutui.com${component.route}.md): ${component.description} Install: \`npx shadcn@latest add @kokonutui/${component.name}\``
  )
  .join("\n")}

## Templates and Premium Components (Kokonut UI Pro)

Templates and premium components are available on the premium version of Kokonut UI.
https://kokonutui.pro/templates

## Premium Components (Kokonut UI Pro)

Premium components are available on the premium version of Kokonut UI.
https://kokonutui.pro/components

## Links

- Website: https://kokonutui.com
- Github: https://github.com/kokonut-labs/kokonutui
- Sitemap: https://kokonutui.com/sitemap.xml

`;

  try {
    // Served at /r/llms.txt. The site-wide /llms.txt and /llms-full.txt are
    // generated at request time from the docs tree (app/llms.txt/route.ts),
    // so they can never drift from the actual documentation.
    await fs.writeFile(
      path.join(REGISTRY_BASE_PATH, "public/r/llms.txt"),
      llmsContent,
      "utf-8"
    );
    console.log(
      `  ${colors.green}${symbols.success}${colors.reset} r/llms.txt registry index updated with ${components.length} components`
    );
  } catch (error) {
    console.error(
      `  ${colors.red}${symbols.error} Error writing LLMs.txt file${colors.reset}`
    );
    console.error(error);
  }
};

const getComponentFiles = async (files: File[], registryType: string) => {
  const filesArrayPromises = (files ?? []).map(async (file) => {
    try {
      if (typeof file === "string") {
        const normalizedPath = file.startsWith("/") ? file : `/${file}`;
        const filePath = path.join(REGISTRY_BASE_PATH, normalizedPath);
        const fileContent = await fs.readFile(filePath, "utf-8");

        const fileName = normalizedPath.split("/").pop() || "";
        console.log(
          `    ${colors.yellow}${symbols.dot}${colors.reset} Processing ${colors.cyan}${fileName}${colors.reset}`
        );

        return {
          type: registryType,
          content: fileContent,
          path: normalizedPath,
          target: `components/kokonutui/${fileName}`,
        };
      }
      const normalizedPath = file.path.startsWith("/")
        ? file.path
        : `/${file.path}`;
      const filePath = path.join(REGISTRY_BASE_PATH, normalizedPath);
      const fileContent = await fs.readFile(filePath, "utf-8");

      const fileName = normalizedPath.split("/").pop() || "";
      console.log(
        `    ${colors.yellow}${symbols.dot}${colors.reset} Processing ${colors.cyan}${fileName}${colors.reset}`
      );

      const getTargetPath = (type: string) => {
        switch (type) {
          case "registry:hook":
            return `hooks/${fileName}`;
          case "registry:lib":
            return `lib/${fileName}`;
          case "registry:block":
            return `blocks/${fileName}`;
          default:
            return `components/kokonutui/${fileName}`;
        }
      };

      const fileType =
        typeof file === "string" ? registryType : file.type || registryType;

      return {
        type: fileType,
        content: fileContent,
        path: normalizedPath,
        target:
          typeof file === "string"
            ? getTargetPath(registryType)
            : file.target || getTargetPath(fileType),
      };
    } catch (error) {
      console.error(
        `    ${colors.red}${symbols.error} Error processing file: ${typeof file === "string" ? file : file.path}${colors.reset}`
      );
      throw error;
    }
  });

  const filesArray = await Promise.all(filesArrayPromises);
  return filesArray;
};

const main = async () => {
  console.log(`\n${colors.cyan}Registry Build Process${colors.reset}`);
  printDivider();

  const totalComponents = registry.length;

  for (let i = 0; i < registry.length; i++) {
    const component = registry[i];
    const files = component.files;
    if (!files) {
      throw new Error("No files found for component");
    }

    console.log(
      `${colors.yellow}${symbols.arrow} Component ${i + 1}/${totalComponents}: ${colors.reset}${component.name}`
    );

    const filesArray = await getComponentFiles(files, component.type);
    const jsonPath = `${PUBLIC_FOLDER_BASE_PATH}/${component.name}.json`;

    await writeFileRecursive(
      jsonPath,
      JSON.stringify({ ...component, files: filesArray }, null, 2)
    );

    if (i < registry.length - 1) {
      console.log(); // Add space between components
    }
  }

  printDivider();

  // Generate LLMs.txt file
  console.log(
    `${colors.yellow}${symbols.arrow} Generating LLMs.txt file${colors.reset}`
  );
  const componentsInfo = await getComponentsInfo();
  await generateLLMsFile(componentsInfo);

  printDivider();

  // Generate the registry index for the shadcn CLI and MCP server
  console.log(
    `${colors.yellow}${symbols.arrow} Generating registry index${colors.reset}`
  );
  await generateRegistryIndex(componentsInfo);

  printDivider();

  // Generate agent skills discovery index
  console.log(
    `${colors.yellow}${symbols.arrow} Generating agent skills index${colors.reset}`
  );
  await generateAgentSkillsIndex();

  printDivider();
};

main()
  .then(() => {
    console.log(
      `${colors.green}${symbols.success} Registry build completed successfully!${colors.reset}\n`
    );
  })
  .catch((err) => {
    console.log();
    console.error(
      `${colors.red}${symbols.error} Registry build failed:${colors.reset}`
    );
    console.error(err);
    console.log();
    process.exit(1);
  });
