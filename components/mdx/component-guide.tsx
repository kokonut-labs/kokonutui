import { promises as fs } from "node:fs";
import path from "node:path";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { type ComponentProps, Fragment, type ReactNode } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { codeToHast } from "shiki/bundle/web";
import type { Part } from "@/components/landing/home/parts";
import { DocsPre } from "@/components/mdx/code-block";
import {
  type ApiField,
  type ComponentApi,
  getComponentApi,
} from "@/lib/component-api";
import { getComponentUsage } from "@/lib/component-usage";
import { readComponentSource } from "@/lib/get-llm-text";

/**
 * Cached, so prerendering doesn't run Shiki (which reads the clock) for
 * every page on every build step.
 */
async function highlightToHast(code: string, lang: string) {
  "use cache";
  cacheLife("max");
  return await codeToHast(code, {
    lang,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  });
}

/** Code drawn the way the MDX code blocks are, with both themes inline. */
async function Code({ code, lang }: { code: string; lang: string }) {
  const hast = await highlightToHast(code, lang);
  return toJsxRuntime(hast, {
    Fragment,
    jsx,
    jsxs,
    components: {
      pre: (props: ComponentProps<"pre">) => (
        <DocsPre {...props} label={codeLabel(code)} />
      ),
    },
  });
}

const LABEL_LENGTH = 60;

/** Names the code region after its first line, as the MDX blocks are. */
function codeLabel(code: string) {
  const first = code.trim().split("\n", 1)[0].trim();
  if (!first) {
    return "Code";
  }
  return first.length > LABEL_LENGTH
    ? `Code: ${first.slice(0, LABEL_LENGTH)}…`
    : `Code: ${first}`;
}

/** "a", "a and b", "a, b and c", each item drawn by `render`. */
function joined(items: string[], render: (item: string) => ReactNode) {
  return items.map((item, i) => {
    let separator = "";
    if (i > 0) {
      separator = i === items.length - 1 ? " and " : ", ";
    }
    return (
      <Fragment key={item}>
        {separator}
        {render(item)}
      </Fragment>
    );
  });
}

interface Requirement {
  name: ReactNode;
  version?: string;
  from: string;
}

/** The versions the site runs, which are the ones the components are built on. */
async function siteVersions(): Promise<Record<string, string>> {
  "use cache";
  cacheLife("max");
  const pkg = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "package.json"), "utf-8")
  );
  return { ...pkg.devDependencies, ...pkg.dependencies };
}

const RANGE_PREFIX = /^[^\d]*/;
const LEADING_SLASH = /^\//;
const TRAILING_SEMICOLON = /;$/;

const major = (range?: string) =>
  range?.replace(RANGE_PREFIX, "").split(".")[0];

async function requirementsOf(part: Part): Promise<Requirement[]> {
  const versions = await siteVersions();
  const source = await readComponentSource(part.name).catch(() => "");
  const ownFile = `components/kokonutui/${part.name}.tsx`;
  return [
    ...part.dependencies.map((dependency) => ({
      name: <code>{dependency}</code>,
      version: versions[dependency],
      from: "npm, installed by the CLI",
    })),
    ...part.registryDependencies.map((dependency) => ({
      name: <code>{dependency}</code>,
      from: "shadcn/ui, added by the CLI",
    })),
    ...part.files
      .filter((file) => file.replace(LEADING_SLASH, "") !== ownFile)
      .map((file) => ({
        name: <code>{file.replace(LEADING_SLASH, "")}</code>,
        from: "Kokonut UI, copied by the CLI",
      })),
    ...(source.includes('"@/lib/utils"')
      ? [
          {
            name: (
              <>
                <code>cn</code> from <code>lib/utils.ts</code>
              </>
            ),
            from: "shadcn init",
          },
        ]
      : []),
    {
      name: "React",
      version: major(versions.react),
      from: "Your app",
    },
    {
      name: "Tailwind CSS",
      version: major(versions.tailwindcss),
      from: "Your app",
    },
  ];
}

const INLINE_CODE = /`([^`]+)`/g;

/** JSDoc text with its `backticks` drawn as code. */
function Prose({ text }: { text: string }) {
  const pieces = text.split(INLINE_CODE);
  return (
    <>
      {pieces.map((piece, i) =>
        i % 2 === 1 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: split of static text
          <code className={INLINE} key={i}>
            {piece}
          </code>
        ) : (
          piece
        )
      )}
    </>
  );
}

const INLINE =
  "rounded-[5px] bg-black/[0.05] px-1 py-px font-mono text-[0.86em] text-black/80 dark:bg-white/[0.08] dark:text-white/80";

/** Long unions read better one member per line. */
function formatTypeCode(code: string) {
  const cleaned = code.replace("= | ", "= ");
  if (cleaned.length <= 72 || !cleaned.includes(" | ")) {
    return cleaned;
  }
  const [head, body] = cleaned.split(" = ");
  return `${head} =\n  | ${body.replace(TRAILING_SEMICOLON, "").split(" | ").join("\n  | ")};`;
}

/**
 * Props as a list rather than a four-column table: a type like
 * `(query, { tool, signal }) => Promise<void>` needs the width, and the
 * description reads as a sentence under it.
 */
function FieldList({
  fields,
  withDefaults,
}: {
  fields: ApiField[];
  withDefaults: boolean;
}) {
  return (
    <div className="not-prose my-6 border-black/[0.08] border-t dark:border-white/10">
      {fields.map((field) => (
        <div
          className="grid gap-x-6 gap-y-1.5 border-black/[0.08] border-b py-3.5 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] dark:border-white/10"
          key={field.name}
        >
          <div className="flex items-baseline gap-2">
            <code className="font-medium font-mono text-[13px] text-black dark:text-white">
              {field.name}
            </code>
            {field.required ? (
              <span className="font-mono text-[11px] text-black/40 dark:text-white/40">
                required
              </span>
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <code className="break-words font-mono text-[#0550ae] text-[12.5px] dark:text-[#79c0ff]">
                {field.type}
              </code>
              {withDefaults && field.defaultValue ? (
                <span className="text-[12px] text-black/45 dark:text-white/45">
                  Default{" "}
                  <code className="font-mono text-black/70 dark:text-white/70">
                    {field.defaultValue === "demo"
                      ? "demo data"
                      : field.defaultValue}
                  </code>
                </span>
              ) : null}
            </div>
            {field.description ? (
              <p className="mt-1.5 text-[14px] text-black/60 leading-relaxed dark:text-white/60">
                <Prose text={field.description} />
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function ApiTables({ api }: { api: ComponentApi }) {
  return (
    <>
      <h2 id="props">Props</h2>
      {api.props.length > 0 ? (
        <FieldList fields={api.props} withDefaults />
      ) : null}
      {api.extendsFrom.length > 0 ? (
        <p>
          Also takes every prop of{" "}
          {joined(api.extendsFrom, (type) => (
            <code>{type}</code>
          ))}
          .
        </p>
      ) : null}
      {api.types.map((type) => (
        <Fragment key={type.name}>
          <h3 id={`type-${type.name.toLowerCase()}`}>{type.name}</h3>
          {type.description ? (
            <p>
              <Prose text={type.description} />
            </p>
          ) : null}
          {type.fields ? (
            <FieldList fields={type.fields} withDefaults={false} />
          ) : (
            <Code code={formatTypeCode(type.code ?? "")} lang="ts" />
          )}
        </Fragment>
      ))}
    </>
  );
}

/**
 * Installation, usage, props and dependencies under a component's demo.
 * The demo renders in the browser, so this is the text search engines read
 * on the page, and the answer to "how do I use it" for people.
 */
export async function ComponentGuide({
  part,
  docsPath,
  hasUsage,
}: {
  part: Part;
  docsPath: string;
  /** The page writes its own Usage section, so this one steps aside. */
  hasUsage: boolean;
}) {
  const [usage, api, requirements] = await Promise.all([
    hasUsage ? undefined : getComponentUsage(part.name, docsPath),
    getComponentApi(part.name),
    requirementsOf(part),
  ]);

  return (
    <>
      <h2 id="installation">Installation</h2>
      <p>
        {part.title} is a free, open-source React component in the Kokonut UI{" "}
        <Link href={`/docs/${part.categorySlug}`}>
          {part.category} collection
        </Link>
        . Add it with the shadcn CLI, which copies the source into{" "}
        <code>components/kokonutui/{part.name}.tsx</code>, so the code is yours
        to change.
      </p>
      <Code
        code={`npx shadcn@latest add @kokonutui/${part.name}`}
        lang="bash"
      />
      {part.dependencies.length > 0 ? (
        <>
          <p>
            Or add it by hand: install its packages, then copy the source from
            Copy code above into{" "}
            <code>components/kokonutui/{part.name}.tsx</code>.
          </p>
          <Code
            code={`npm install ${part.dependencies.join(" ")}`}
            lang="bash"
          />
        </>
      ) : null}
      {usage ? (
        <>
          <h2 id="usage">Usage</h2>
          <Code code={usage} lang="tsx" />
        </>
      ) : null}
      {api ? <ApiTables api={api} /> : null}
      <h2 id="dependencies">Dependencies</h2>
      <table>
        <thead>
          <tr>
            <th>Needs</th>
            <th>Version</th>
            <th>Comes from</th>
          </tr>
        </thead>
        <tbody>
          {requirements.map((requirement, i) => (
            // Names repeat across kinds (a package and a file), so the
            // position is the stable key.
            // biome-ignore lint/suspicious/noArrayIndexKey: static list
            <tr key={i}>
              <td>{requirement.name}</td>
              <td>
                {requirement.version ? (
                  <code>{requirement.version}</code>
                ) : null}
              </td>
              <td>{requirement.from}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        No provider, font or global CSS to set up: the file works as soon as it
        lands.
      </p>
    </>
  );
}
