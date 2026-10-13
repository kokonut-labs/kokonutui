import { component as registry } from "@/registry/registry-components";
import { getCategories } from "./get-categories";

/** One component, with everything the catalog shows about it. */
export interface Part {
  /** Catalog code, e.g. "BT-05": category prefix and position in it. */
  code: string;
  name: string;
  title: string;
  description?: string;
  url: string;
  category: string;
  categorySlug: string;
  /** npm packages the registry installs alongside it. */
  dependencies: string[];
  /** shadcn/ui primitives it builds on. */
  registryDependencies: string[];
  /** Files the CLI writes into your project. */
  files: string[];
}

// Two letters per docs category, for the catalog's part codes.
const CODES: Record<string, string> = {
  ai: "AI",
  backgrounds: "BG",
  buttons: "BT",
  cards: "CD",
  inputs: "IN",
  navigation: "NV",
  texts: "TX",
};

/** Every component in docs order, with its catalog code and registry facts. */
export function getParts(): Part[] {
  const categories = getCategories();
  const entries = new Map(registry.map((entry) => [entry.name, entry]));

  const parts: Part[] = categories.flatMap((category) =>
    category.items.map((item, i) => {
      const entry = entries.get(item.name);
      const prefix =
        CODES[category.slug] ?? category.slug.slice(0, 2).toUpperCase();
      return {
        code: `${prefix}-${String(i + 1).padStart(2, "0")}`,
        name: item.name,
        title: item.title,
        description: item.description,
        url: item.url,
        category: category.title,
        categorySlug: category.slug,
        dependencies: entry?.dependencies ?? [],
        registryDependencies: entry?.registryDependencies ?? [],
        files:
          entry?.files?.map((file) =>
            typeof file === "string" ? file : file.path
          ) ?? [],
      };
    })
  );

  return parts;
}
