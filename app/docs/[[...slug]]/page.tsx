import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents, { createRelativeLink } from "fumadocs-ui/mdx";
import { notFound } from "next/navigation";
import TocProBanner from "@/components/landing/toc-pro-banner";
import { Preview } from "@/components/mdx/preview";
import { PreviewClient } from "@/components/mdx/preview-client";
import PreviewTemplate from "@/components/mdx/preview-template";
import WhatIncluded from "@/components/mdx/what-included";
import { siteConfig } from "@/config/site";
import { source } from "@/lib/source";

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

  // Powers "copy as Markdown" and the open-in-ChatGPT/Claude shortcuts.
  const markdownUrl = `${page.url}.md`;
  const githubUrl = `${siteConfig.links.github}/blob/main/content/docs/${page.path}`;

  // Component pages are Preview/WhatIncluded blocks with no markdown headings,
  // so the default TOC would render nothing but its "No Headings" empty state.
  // Those pages drop the heading list and show the Pro banner on its own; pages
  // that do have headings keep the real TOC with the banner underneath.
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

  const pageActions = (
    <>
      <MarkdownCopyButton markdownUrl={markdownUrl} />
      <ViewOptionsPopover githubUrl={githubUrl} markdownUrl={markdownUrl} />
    </>
  );

  return (
    <DocsPage
      full={page.data.full}
      tableOfContent={tableOfContent}
      toc={page.data.toc}
    >
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema.org JSON-LD built from page data
        dangerouslySetInnerHTML={{ __html: breadcrumbData }}
        type="application/ld+json"
      />
      {/*
        The page actions sit beside the title on desktop and move to the end of
        the page on mobile, so the component demo lands in the first screen.
      */}
      <div className="flex items-start justify-between gap-4">
        <DocsTitle className="font-semibold text-3xl md:text-4xl">
          {page.data.title}
        </DocsTitle>
        <div className="hidden shrink-0 flex-row items-center gap-2 pt-1.5 md:flex">
          {pageActions}
        </div>
      </div>
      <DocsDescription className="mb-2 text-pretty text-base md:text-lg">
        {page.data.description}
      </DocsDescription>
      <DocsBody>
        <MDX
          components={{
            ...defaultMdxComponents,
            a: createRelativeLink(source, page),
            Preview,
            PreviewClient,
            PreviewTemplate,
            WhatIncluded,
          }}
        />
      </DocsBody>
      <div className="flex flex-row items-center gap-2 md:hidden">
        {pageActions}
      </div>
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
      title: page.data.title,
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
      title: page.data.title,
      description: page.data.description,
      images: [ogImage],
    },
  };
}
