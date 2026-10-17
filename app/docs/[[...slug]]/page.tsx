import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents, { createRelativeLink } from "fumadocs-ui/mdx";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories } from "@/components/landing/home/get-categories";
import { getParts } from "@/components/landing/home/parts";
import { LEAF, META, MONO } from "@/components/landing/home/styles";
import TocProBanner from "@/components/landing/toc-pro-banner";
import { Release } from "@/components/mdx/changelog-release";
import { DocsPre } from "@/components/mdx/code-block";
import {
  AgentEndpoints,
  AgentPrompts,
  AgentRules,
  Command,
  McpSetup,
  Note,
  SetupChoice,
} from "@/components/mdx/docs-blocks";
import { Preview, type PreviewProps } from "@/components/mdx/preview";
import { PreviewClient } from "@/components/mdx/preview-client";
import PreviewTemplate from "@/components/mdx/preview-template";
import { ProPeek } from "@/components/mdx/pro-peek";
import { ProShowcase, ProShowcaseIntro } from "@/components/mdx/pro-showcase";
import { ProTemplates } from "@/components/mdx/pro-templates";
import WhatIncluded from "@/components/mdx/what-included";
import { siteConfig } from "@/config/site";
import {
  CHANGELOG_URL,
  formatReleaseDate,
  releaseAnchor,
} from "@/lib/changelog";
import { readComponentSource } from "@/lib/get-llm-text";
import { isProPeekUrl } from "@/lib/pro-peeks";
import { source } from "@/lib/source";
import { cn } from "@/lib/utils";

/**
 * The packages a demo's registry entry installs, shown on its plate, and its
 * source for Copy code. The source is public, so it ships with the page
 * rather than being fetched on click.
 */
async function plateFor({ link, isBlock }: PreviewProps) {
  const name = link.split("/").at(-1);
  const part = getParts().find((p) => p.name === name);
  if (!(part && name)) {
    return;
  }
  const source = isBlock
    ? undefined
    : await readComponentSource(name).catch(() => undefined);
  return { dependencies: part.dependencies, source };
}

async function DocsPreview(props: PreviewProps) {
  return <Preview {...props} part={await plateFor(props)} />;
}

async function DocsPreviewClient(props: PreviewProps) {
  return <PreviewClient {...props} part={await plateFor(props)} />;
}

function ogImagePath(slug: string[] = []) {
  return ["/docs-og", ...slug, "image.png"].join("/");
}

export default async function Page(props: PageProps<"/docs/[[...slug]]">) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    return notFound();
  }

  const MDX = page.data.body;

  const pageUrl = `${siteConfig.url}${page.url}`;
  const lastModified = page.data.lastModified;

  const breadcrumbData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: siteConfig.url,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Docs",
            item: `${siteConfig.url}/docs`,
          },
          // The docs index is the "Docs" crumb itself, so it stops at two.
          ...(page.url === "/docs"
            ? []
            : [
                {
                  "@type": "ListItem",
                  position: 3,
                  name: page.data.title,
                  item: pageUrl,
                },
              ]),
        ],
      },
      {
        "@type": "TechArticle",
        "@id": `${pageUrl}#article`,
        headline: page.data.title,
        description: page.data.description,
        url: pageUrl,
        image: `${siteConfig.url}${ogImagePath(params.slug)}`,
        dateModified: lastModified?.toISOString(),
        inLanguage: "en-US",
        isPartOf: { "@id": `${siteConfig.url}/#website` },
        publisher: { "@id": `${siteConfig.url}/#organization` },
        author: {
          "@type": "Person",
          name: "Dorian Baffier",
          url: siteConfig.links.twitter,
        },
      },
    ],
  });

  // A component page documents one catalog part, and its code heads the page.
  const part = getParts().find((p) => p.url === page.url);
  // A Pro component shown here as a peek: it heads the page with PRO instead.
  const proCategory = isProPeekUrl(page.url)
    ? (getCategories().find((c) => c.slug === params.slug?.[0])?.title ??
      "Components")
    : undefined;

  // Component pages are a single plate with no markdown headings, so the
  // default TOC would render nothing but its "No Headings" empty state. Those
  // pages drop the heading list and show the Pro banner on its own; pages that
  // do have headings keep the real TOC with the banner underneath.
  const hasHeadings = page.data.toc.length > 0;
  const tableOfContent = page.data.full
    ? undefined
    : {
        // Keep the TOC enabled either way — it owns the column the banner sits
        // in — but hide the "On this page" heading and its empty state when
        // there is nothing to list.
        container: hasHeadings
          ? undefined
          : { className: "toc-headings-empty" },
        footer: <TocProBanner />,
      };

  return (
    <DocsPage
      breadcrumb={{ enabled: !(part || proCategory) }}
      full={page.data.full}
      tableOfContent={tableOfContent}
      tableOfContentPopover={{ enabled: hasHeadings }}
      toc={page.data.toc}
    >
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema.org JSON-LD built from page data
        dangerouslySetInnerHTML={{ __html: breadcrumbData }}
        type="application/ld+json"
      />
      {part ? (
        <p className={cn(META, "flex items-baseline gap-3")}>
          <span className={cn(MONO, "font-medium text-[12px]", LEAF)}>
            {part.code}
          </span>
          <span>{part.category}</span>
          {part.isNew && part.added ? (
            <Link
              className="underline-offset-4 hover:text-black hover:underline dark:hover:text-white"
              href={`${CHANGELOG_URL}#${releaseAnchor(part.added)}`}
            >
              New, {formatReleaseDate(part.added)}
            </Link>
          ) : null}
        </p>
      ) : null}
      {proCategory ? (
        <p className={cn(META, "flex items-baseline gap-3")}>
          <span className={cn(MONO, "font-medium text-[#FF2D55] text-[12px]")}>
            PRO
          </span>
          <span>{proCategory}</span>
        </p>
      ) : null}
      <DocsTitle className="font-semibold text-4xl tracking-[-0.03em]">
        {page.data.title}
      </DocsTitle>
      <DocsDescription className="max-w-[62ch] text-black/60 text-lg leading-relaxed dark:text-white/60">
        {page.data.description}
      </DocsDescription>
      <DocsBody>
        <MDX
          components={{
            ...defaultMdxComponents,
            a: createRelativeLink(source, page),
            pre: DocsPre,
            AgentEndpoints,
            AgentPrompts,
            AgentRules,
            Command,
            McpSetup,
            Note,
            SetupChoice,
            Preview: DocsPreview,
            PreviewClient: DocsPreviewClient,
            PreviewTemplate,
            ProPeek,
            ProShowcase,
            ProShowcaseIntro,
            ProTemplates,
            Release,
            WhatIncluded,
          }}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return await source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    return notFound();
  }

  const ogImage = {
    url: ogImagePath(params.slug),
    width: 1200,
    height: 630,
    alt: page.data.title,
  };

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: {
      canonical: `${siteConfig.url}${page.url}`,
    },
    openGraph: {
      title: `${page.data.title} | ${siteConfig.name}`,
      description: page.data.description,
      url: page.url,
      siteName: siteConfig.name,
      type: "article",
      locale: "en_US",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      creator: "@dorianbaffier",
      title: `${page.data.title} | ${siteConfig.name}`,
      description: page.data.description,
      images: [ogImage],
    },
  };
}
