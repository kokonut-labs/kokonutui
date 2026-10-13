import type { Metadata } from "next";
import { Geist_Mono, Instrument_Serif } from "next/font/google";
import { getCategories } from "@/components/landing/home/get-categories";
import { cn } from "@/lib/utils";
import { component as registry } from "@/registry/registry-components";
import type { Part } from "./data";
import { Harness } from "./harness";
import "@/components/landing/home/home.css";

// Prototype surface for the homepage redesign. Not linked from anywhere and
// kept out of search results; delete this folder once a direction ships.
export const metadata: Metadata = {
  title: "Homepage prototypes",
  robots: { index: false, follow: false },
};

const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-proto-mono" });
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-proto-serif",
});

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

export default function HomePrototypesPage() {
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

  return (
    <div className={cn(mono.variable, serif.variable)}>
      <Harness categories={categories} parts={parts} />
    </div>
  );
}
