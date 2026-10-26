import { getParts } from "@/components/landing/home/parts";
import { isProPeekUrl } from "@/lib/pro-peeks";
import { PRO_SHOWCASE_PAGE } from "@/lib/pro-showcase";
import { PRO_TEMPLATES_PAGE } from "@/lib/pro-templates";
import { source } from "@/lib/source";

export interface SidebarLink {
  name: string;
  url: string;
  /** Catalog code, e.g. "AI-03"; only components have one. */
  code?: string;
  isNew?: boolean;
  updated?: boolean;
  pro?: boolean;
}

export interface SidebarSection {
  name: string;
  /** Two-letter category code, e.g. "AI". */
  code: string;
  /** The category page, when it has one. */
  url?: string;
  items: SidebarLink[];
  added: number;
  updated: number;
}

export interface SidebarModel {
  guide: SidebarLink[];
  sections: SidebarSection[];
}

const isPro = (url: string) =>
  url === PRO_TEMPLATES_PAGE || url === PRO_SHOWCASE_PAGE || isProPeekUrl(url);

/** The docs tree as plain data, so the prototype sidebars can draw it freely. */
export function getSidebarModel(): SidebarModel {
  const parts = new Map(getParts().map((part) => [part.url, part]));
  const guide: SidebarLink[] = [];
  const sections: SidebarSection[] = [];

  for (const node of source.getPageTree().children) {
    if (node.type === "page") {
      guide.push({
        name: String(node.name),
        url: node.url,
        pro: isPro(node.url),
      });
      continue;
    }
    if (node.type !== "folder") {
      continue;
    }
    const items: SidebarLink[] = [];
    for (const child of node.children) {
      if (child.type !== "page") {
        continue;
      }
      const part = parts.get(child.url);
      items.push({
        name: String(child.name),
        url: child.url,
        code: part?.code,
        isNew: part?.isNew,
        updated: Boolean(part?.updated),
        pro: isPro(child.url),
      });
    }
    const code = items.find((item) => item.code)?.code?.slice(0, 2) ?? "··";
    sections.push({
      name: String(node.name),
      code,
      url: node.index?.url,
      items,
      added: items.filter((item) => item.isNew).length,
      updated: items.filter((item) => !item.isNew && item.updated).length,
    });
  }

  return { guide, sections };
}
