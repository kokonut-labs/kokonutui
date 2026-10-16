import type * as PageTree from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { Metadata } from "next";
import HeaderProSmall from "@/components/landing/header-pro-small";
import { getParts } from "@/components/landing/home/parts";
import { LEAF, MONO } from "@/components/landing/home/styles";
import { isProPeekUrl } from "@/lib/pro-peeks";
import { PRO_TEMPLATES_PAGE } from "@/lib/pro-templates";
import { source } from "@/lib/source";
import { cn } from "@/lib/utils";
import { baseOptions } from "../layout.config";

export const metadata: Metadata = {
  title: {
    template: "%s | Kokonut UI",
    default:
      "Kokonut UI - Open Source UI Components for React and Tailwind CSS",
  },
};

/**
 * The sidebar reads like the homepage's index: each component is listed by
 * its catalog code instead of an icon, and recent additions say "New".
 */
function withCodes(tree: PageTree.Root): PageTree.Root {
  const parts = getParts();
  const codes = new Map(parts.map((part) => [part.url, part.code]));
  const fresh = new Set(parts.filter((p) => p.isNew).map((p) => p.url));

  const visit = (node: PageTree.Node): PageTree.Node => {
    if (node.type === "folder") {
      // Folders start open, and still carry the count of new parts inside.
      const count = node.children.filter(
        (child) => child.type === "page" && fresh.has(child.url)
      ).length;
      return {
        ...node,
        defaultOpen: true,
        name:
          count > 0 ? (
            <span
              className="flex w-full items-baseline justify-between gap-2"
              key="name"
            >
              {node.name}
              <span className={cn(MONO, "text-[10.5px]", LEAF)}>
                {count} new
              </span>
            </span>
          ) : (
            node.name
          ),
        children: node.children.map(visit),
      };
    }
    // Templates and the Pro peeks are Pro, and the sidebar says so before
    // anyone clicks; the pages themselves stay on this site.
    if (
      node.type === "page" &&
      (node.url === PRO_TEMPLATES_PAGE || isProPeekUrl(node.url))
    ) {
      return {
        ...node,
        name: (
          <span
            className="flex w-full items-baseline justify-between gap-2"
            key="name"
          >
            {node.name}
            <span className={cn(MONO, "text-[#FF2D55] text-[10.5px]")}>
              PRO
            </span>
          </span>
        ),
      };
    }
    const code = node.type === "page" ? codes.get(node.url) : undefined;
    const isNew = node.type === "page" && fresh.has(node.url);
    if (!code) {
      return node;
    }
    return {
      ...node,
      name: isNew ? (
        <span
          className="flex w-full items-baseline justify-between gap-2"
          key="name"
        >
          {node.name}
          <span className={cn(MONO, "text-[10.5px]", LEAF)}>New</span>
        </span>
      ) : (
        node.name
      ),
      icon: (
        <span
          className={cn(
            MONO,
            "w-[5ch] shrink-0 text-[11px] text-black/40 dark:text-white/40"
          )}
          key={code}
        >
          {code}
        </span>
      ),
    };
  };

  return { ...tree, children: tree.children.map(visit) };
}

export default function Layout({ children }: LayoutProps<"/docs">) {
  return (
    <DocsLayout
      {...baseOptions()}
      sidebar={{ footer: <HeaderProSmall /> }}
      tree={withCodes(source.getPageTree())}
    >
      {children}
    </DocsLayout>
  );
}
