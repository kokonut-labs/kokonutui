import type { Category } from "@/components/landing/home/data";

/** One component, with everything the prototypes show about it. */
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

export interface PrototypeProps {
  categories: Category[];
  parts: Part[];
}

export const V0_URL = (name: string) =>
  `https://v0.dev/chat/api/open?url=https://kokonutui.com/r/${name}.json`;

export const agentPrompt = (name: string) =>
  `Add @kokonutui/${name} to my project`;
