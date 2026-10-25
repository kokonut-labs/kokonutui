import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { codeToHast } from "shiki/bundle/web";
import type { Part } from "@/components/landing/home/parts";
import { DocsPre } from "@/components/mdx/code-block";
import { getComponentUsage } from "@/lib/component-usage";

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
      pre: DocsPre,
    },
  });
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

/**
 * Installation, usage and dependencies under a component's demo. The demo
 * renders in the browser, so this is the text search engines read on the
 * page, and the answer to "how do I use it" for people.
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
  const usage = hasUsage
    ? undefined
    : await getComponentUsage(part.name, docsPath);
  const builtWith = ["React", "Tailwind CSS", ...part.dependencies];

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
      {usage ? (
        <>
          <h2 id="usage">Usage</h2>
          <Code code={usage} lang="tsx" />
        </>
      ) : null}
      <h2 id="dependencies">Dependencies</h2>
      <p>
        Built with{" "}
        {joined(builtWith, (dependency) =>
          // React and Tailwind CSS read as words; packages read as code.
          builtWith.indexOf(dependency) > 1 ? (
            <code>{dependency}</code>
          ) : (
            dependency
          )
        )}
        .
        {part.registryDependencies.length > 0 ? (
          <>
            {" "}
            The CLI also adds the shadcn/ui{" "}
            {joined(part.registryDependencies, (dependency) => (
              <code>{dependency}</code>
            ))}{" "}
            {part.registryDependencies.length > 1 ? "components" : "component"}.
          </>
        ) : null}
      </p>
    </>
  );
}
