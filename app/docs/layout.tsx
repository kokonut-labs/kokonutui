import type * as PageTree from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { Metadata } from "next";
import HeaderProSmall from "@/components/landing/header-pro-small";
import { getParts } from "@/components/landing/home/parts";
import { MONO } from "@/components/landing/home/styles";
import { source } from "@/lib/source";
import { cn } from "@/lib/utils";
import { baseOptions } from "../layout.config";

export const metadata: Metadata = {
  title: {
    template: "%s | KokonutUI",
    default:
      "KokonutUI - Open Source UI Components to build beautiful websites",
  },
};

/**
 * The sidebar reads like the homepage's index: each component is listed by
 * its catalog code instead of an icon.
 */
function withCodes(tree: PageTree.Root): PageTree.Root {
  const codes = new Map(getParts().map((part) => [part.url, part.code]));

  const visit = (node: PageTree.Node): PageTree.Node => {
    if (node.type === "folder") {
      return { ...node, children: node.children.map(visit) };
    }
    const code = node.type === "page" ? codes.get(node.url) : undefined;
    if (!code) {
      return node;
    }
    return {
      ...node,
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
