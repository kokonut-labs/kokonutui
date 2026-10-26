import type * as PageTree from "fumadocs-core/page-tree";
import type { Metadata } from "next";
import HeaderProSmall from "@/components/landing/header-pro-small";
import { getParts } from "@/components/landing/home/parts";
import { LEAF, MONO } from "@/components/landing/home/styles";
import { SidebarProtoProvider } from "@/components/layout/sidebar-protos/context";
import { getSidebarModel } from "@/components/layout/sidebar-protos/model";
import { ProtoDocsLayout } from "@/components/layout/sidebar-protos/slots";
import { isProPeekUrl } from "@/lib/pro-peeks";
import { PRO_SHOWCASE_PAGE } from "@/lib/pro-showcase";
import { PRO_TEMPLATES_PAGE } from "@/lib/pro-templates";
import { source } from "@/lib/source";
import { cn } from "@/lib/utils";
import { baseOptions } from "../layout.config";

export const metadata: Metadata = {
  title: {
    template: "%s | Kokonut UI",
    default: "Kokonut UI: Free Open-Source React & Tailwind Components",
  },
};

/** A sidebar row's name with a small mono tag on the right. */
function tagged(name: PageTree.Node["name"], tag: string, color = LEAF) {
  return (
    <span
      className="flex w-full min-w-0 items-baseline justify-between gap-2"
      key="name"
    >
      <span className="min-w-0 truncate">{name}</span>
      <span
        className={cn(MONO, "shrink-0 whitespace-nowrap text-[10.5px]", color)}
      >
        {tag}
      </span>
    </span>
  );
}

/** A folder's tag: how many of its pages are new, else how many updated. */
function folderTag(
  children: PageTree.Node[],
  tags: Map<string, "New" | "Updated">
) {
  let added = 0;
  let updated = 0;
  for (const child of children) {
    const tag = child.type === "page" ? tags.get(child.url) : undefined;
    if (tag === "New") {
      added += 1;
    } else if (tag === "Updated") {
      updated += 1;
    }
  }
  if (added > 0) {
    return `${added} new`;
  }
  return updated > 0 ? `${updated} updated` : undefined;
}

/**
 * The sidebar reads like the homepage's index: each component is listed by
 * its catalog code instead of an icon. Only the category says how many of
 * its parts are new or updated; the rows themselves stay plain, and the
 * category page tags each one.
 */
function withCodes(tree: PageTree.Root): PageTree.Root {
  const parts = getParts();
  const codes = new Map(parts.map((part) => [part.url, part.code]));
  const tags = new Map<string, "New" | "Updated">();
  for (const part of parts) {
    if (part.isNew) {
      tags.set(part.url, "New");
    } else if (part.updated) {
      tags.set(part.url, "Updated");
    }
  }

  const visit = (node: PageTree.Node): PageTree.Node => {
    if (node.type === "folder") {
      // Folders start open, and still carry the count of new or updated
      // parts inside.
      const tag = folderTag(node.children, tags);
      return {
        ...node,
        defaultOpen: true,
        name: tag ? tagged(node.name, tag) : node.name,
        children: node.children.map(visit),
      };
    }
    // Templates and the Pro peeks are Pro, and the sidebar says so before
    // anyone clicks; the pages themselves stay on this site.
    if (
      node.type === "page" &&
      (node.url === PRO_TEMPLATES_PAGE ||
        node.url === PRO_SHOWCASE_PAGE ||
        isProPeekUrl(node.url))
    ) {
      return { ...node, name: tagged(node.name, "PRO", "text-[#FF2D55]") };
    }
    const code = node.type === "page" ? codes.get(node.url) : undefined;
    if (!code || node.type !== "page") {
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
  // Sidebar prototypes: pick one with ?sidebar=current|a|b|c or the switch
  // in the bottom right corner.
  return (
    <SidebarProtoProvider model={getSidebarModel()}>
      <ProtoDocsLayout
        {...baseOptions()}
        sidebar={{ footer: <HeaderProSmall /> }}
        tree={withCodes(source.getPageTree())}
      >
        {children}
      </ProtoDocsLayout>
    </SidebarProtoProvider>
  );
}
