import { promises as fs } from "node:fs";
import path from "node:path";
import { cacheLife } from "next/cache";
import { readComponentSource } from "@/lib/get-llm-text";

const DOCS_DIR = path.join(process.cwd(), "content/docs");

const DEFAULT_EXPORT = /export default (?:function |class )?([A-Z]\w*)/;
const WORD_END = /[\s/]/;
// Props the docs demos set for their own stage: spacing, opening the menu
// on load, faking a slow or failing upload. A real page wouldn't copy them.
const DEMO_ONLY_PROPS =
  /\s+(?:className="[^"]*"|defaultOpen|simulateFailure|uploadDelay=\{[^}]*\})(?=[\s/])/g;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const IMPORT_LINE = /^import (.+) from "(.+)";?$/gm;
const BINDING = /[A-Za-z_$][\w$]*/g;

/** The name a component file exports by default, when it has one. */
function defaultExportName(source: string) {
  return DEFAULT_EXPORT.exec(source)?.[1];
}

/** Where the tag opened before `from` closes: its `>` outside any braces. */
function tagEnd(mdx: string, from: number) {
  let depth = 0;
  for (let i = from; i < mdx.length; i++) {
    const char = mdx[i];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
    } else if (depth === 0 && char === ">") {
      return i;
    }
  }
  return -1;
}

/**
 * The first self-closing use of `tag` in the MDX, props and all, e.g.
 * `<TearButton />`. Props can hold braces and `>` (arrow functions, JSX),
 * so the end is found by brace depth instead of a regex.
 */
function firstUse(mdx: string, tag: string) {
  let start = mdx.indexOf(`<${tag}`);
  while (start !== -1) {
    const after = start + tag.length + 1;
    // `<Tag ` or `<Tag/`, not `<TagOther`.
    if (WORD_END.test(mdx[after] ?? "")) {
      const end = tagEnd(mdx, after);
      // Only a self-closing tag stands on its own as an example.
      return end !== -1 && mdx[end - 1] === "/"
        ? mdx.slice(start, end + 1)
        : undefined;
    }
    start = mdx.indexOf(`<${tag}`, start + 1);
  }
}

/** Moves the example's later lines back by the column its tag starts at. */
function dedent(code: string, column: number) {
  const [first, ...rest] = code.split("\n");
  return [
    first,
    ...rest.map((line) => {
      const indent = line.length - line.trimStart().length;
      return line.slice(Math.min(indent, column));
    }),
  ].join("\n");
}

/**
 * A usage example for a component page: the import, and the first example
 * the page's own demo renders, renamed to the component's real export.
 */
export async function getComponentUsage(name: string, docsPath: string) {
  "use cache";
  cacheLife("max");

  const source = await readComponentSource(name).catch(() => undefined);
  const exported = source ? defaultExportName(source) : undefined;
  if (!exported) {
    return;
  }

  const mdx = await fs
    .readFile(path.join(DOCS_DIR, docsPath), "utf-8")
    .catch(() => "");
  const imported = new RegExp(
    `import (\\w+) from "@/components/kokonutui/${name}"`
  ).exec(mdx)?.[1];

  let example = `<${exported} />`;
  if (imported && IDENTIFIER.test(imported)) {
    const use = firstUse(mdx, imported);
    if (use) {
      const start = mdx.indexOf(use);
      const column = start - (mdx.lastIndexOf("\n", start) + 1);
      example = dedent(use, column)
        .replace(DEMO_ONLY_PROPS, "")
        .replace(`<${imported}`, `<${exported}`);
    }
  }

  // Icons and helpers the example uses come along with their imports.
  const imports: string[] = [];
  for (const [line, bindings, from] of mdx.matchAll(IMPORT_LINE)) {
    if (from.endsWith(`/${name}`)) {
      continue;
    }
    const used = (bindings.match(BINDING) ?? []).some(
      (binding) =>
        binding !== "as" && new RegExp(`\\b${binding}\\b`).test(example)
    );
    if (!used) {
      continue;
    }
    // Site-only demo helpers don't exist in a consumer's project.
    if (from.startsWith("@/components/mdx")) {
      return usageOf(name, exported, `<${exported} />`, []);
    }
    imports.push(line.endsWith(";") ? line : `${line};`);
  }

  return usageOf(name, exported, example, imports);
}

function usageOf(
  name: string,
  exported: string,
  example: string,
  extraImports: string[]
) {
  const imports = [
    `import ${exported} from "@/components/kokonutui/${name}";`,
    ...extraImports,
  ];

  return `${imports.join("\n")}

export default function Example() {
  return ${example.includes("\n") ? `(\n    ${example.split("\n").join("\n    ")}\n  )` : example};
}`;
}
