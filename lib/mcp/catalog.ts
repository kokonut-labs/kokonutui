// The components the MCP server knows about: every installable registry item
// that has a docs page, with the page's title, description and search
// keywords. Read from the registry and the docs source, so the server can
// never offer a component that `shadcn add` would 404 on.

import { siteConfig } from "@/config/site";
import { source } from "@/lib/source";
// `@/registry` alone resolves to registry.json at the root.
import { registry } from "@/registry/index";
import type { RegistryEntry } from "@/registry/schema";

export interface CatalogComponent {
  /** Registry name, e.g. `card-flip`. */
  name: string;
  title: string;
  description: string;
  keywords: string[];
  /** Docs folder, e.g. `cards`. */
  category: string;
  /** Docs folder title, e.g. `Cards`. */
  categoryTitle: string;
  /** Absolute docs URL. */
  url: string;
  item: RegistryEntry;
}

const CATEGORY_TITLES: Record<string, string> = {
  ai: "AI",
  backgrounds: "Backgrounds",
  buttons: "Buttons",
  cards: "Cards",
  components: "Sections & Blocks",
  feedback: "Feedback",
  inputs: "Inputs",
  media: "Media",
  navigation: "Navigation",
  texts: "Texts",
};

const titleOf = (category: string) =>
  CATEGORY_TITLES[category] ??
  category.charAt(0).toUpperCase() + category.slice(1);

let cached: CatalogComponent[] | undefined;

/** Every component with a docs page, in docs order within each category. */
export function getCatalog(): CatalogComponent[] {
  if (cached) {
    return cached;
  }
  const items = new Map(
    registry
      .filter((entry) => entry.type === "registry:component")
      .map((entry) => [entry.name, entry])
  );
  const components: CatalogComponent[] = [];
  for (const page of source.getPages()) {
    const [category, name] = page.slugs;
    const item = name ? items.get(name) : undefined;
    if (!(category && name && item)) {
      continue;
    }
    components.push({
      name,
      title: page.data.title,
      description: page.data.description ?? "",
      keywords: page.data.keywords ?? [],
      category,
      categoryTitle: titleOf(category),
      url: `${siteConfig.url}${page.url}`,
      item,
    });
  }
  cached = components;
  return components;
}

/** The categories, in the order their first component appears. */
export function getCategories(): { id: string; title: string }[] {
  const seen = new Map<string, string>();
  for (const component of getCatalog()) {
    seen.set(component.category, component.categoryTitle);
  }
  return [...seen].map(([id, title]) => ({ id, title }));
}

/** A registry item by name: components, hooks and the `utils` lib alike. */
export const getRegistryItem = (name: string) =>
  registry.find((entry) => entry.name === name);

const WORD = /[a-z0-9]+/g;
// Filler that would match half the descriptions ("with", "and").
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "component",
  "for",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with",
]);

/**
 * Ranks components against a plain-language query. Names and titles weigh
 * most, then the docs keywords (synonyms like "cta" or "shimmer"), then the
 * description. An empty query lists everything.
 */
export function searchCatalog(
  query: string,
  category?: string
): CatalogComponent[] {
  const pool = getCatalog().filter(
    (component) => !category || component.category === category
  );
  const words = (query.toLowerCase().match(WORD) ?? []).filter(
    (word) => !STOPWORDS.has(word)
  );
  if (words.length === 0) {
    return pool;
  }
  const scored = pool.map((component) => {
    const name = component.name;
    const title = component.title.toLowerCase();
    const keywords = component.keywords.join(" ").toLowerCase();
    const description = component.description.toLowerCase();
    let score = name === words.join("-") ? 20 : 0;
    for (const word of words) {
      if (name.includes(word)) {
        score += 6;
      }
      if (title.includes(word)) {
        score += 5;
      }
      if (keywords.includes(word)) {
        score += 4;
      }
      if (description.includes(word)) {
        score += 2;
      }
      if (component.category === word) {
        score += 2;
      }
    }
    return { component, score };
  });
  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.component);
}
