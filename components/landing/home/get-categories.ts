import { source } from "@/lib/source";
import type { Category, CategoryItem } from "./data";

const DOCS_PREFIX = "/docs/";

/** Component categories, read from the docs tree so the homepage never drifts. */
export function getCategories(): Category[] {
  const categories: Category[] = [];

  for (const node of source.getPageTree().children) {
    if (node.type !== "folder") {
      continue;
    }

    const items: CategoryItem[] = [];
    for (const child of node.children) {
      // Templates are external links to Pro, not components.
      if (child.type !== "page" || !child.url.startsWith(DOCS_PREFIX)) {
        continue;
      }
      const slugs = child.url.slice(DOCS_PREFIX.length).split("/");
      const page = source.getPage(slugs);
      items.push({
        name: slugs.at(-1) ?? child.url,
        title: page?.data.title ?? String(child.name),
        url: child.url,
        description: page?.data.description,
      });
    }

    if (items.length === 0) {
      continue;
    }

    categories.push({
      slug: items[0].url.slice(DOCS_PREFIX.length).split("/")[0],
      title: typeof node.name === "string" ? node.name : "Components",
      items,
    });
  }

  return categories;
}
