import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getCategories } from "@/components/landing/home/get-categories";
import { CELL, GRID, INK, LINE, META } from "@/components/landing/home/styles";
import { siteConfig } from "@/config/site";
import { PRO_SHOWCASE_PAGE } from "@/lib/pro-showcase";
import { PRO_TEMPLATES_PAGE } from "@/lib/pro-templates";
import { cn } from "@/lib/utils";

/** Looked for by name, so a renamed or removed part just drops out. */
const POPULAR = [
  "ai-prompt",
  "ai-input-search",
  "ai-loading",
  "apple-activity-card",
  "attract-button",
  "wheel-picker",
  "detent-dial",
  "action-search-bar",
];

const PRO_UTM = "utm_source=kokonutui.com&utm_medium=footer";

interface FooterLink {
  external?: boolean;
  href: string;
  label: string;
}

interface FooterColumn {
  links: FooterLink[];
  title: string;
}

function getColumns(): FooterColumn[] {
  const categories = getCategories();
  const items = new Map(
    categories.flatMap((c) => c.items.map((item) => [item.name, item]))
  );

  return [
    {
      title: "Components",
      links: categories.map((c) => ({
        label: `${c.title} components`,
        href: `/docs/${c.slug}`,
      })),
    },
    {
      title: "Popular",
      links: POPULAR.flatMap((name) => {
        const item = items.get(name);
        return item ? [{ label: item.title, href: item.url }] : [];
      }),
    },
    {
      title: "Docs",
      links: [
        { label: "Installation", href: "/docs" },
        { label: "Agents and MCP", href: "/docs/agents" },
        { label: "Changelog", href: "/docs/changelog" },
        { label: "llms.txt", href: "/llms.txt" },
      ],
    },
    {
      title: "Kokonut UI Pro",
      links: [
        { label: "Pro components", href: PRO_SHOWCASE_PAGE },
        { label: "Website templates", href: PRO_TEMPLATES_PAGE },
        {
          label: "Pricing",
          href: `https://kokonutui.pro/?${PRO_UTM}#pricing`,
          external: true,
        },
      ],
    },
    {
      title: "Community",
      links: [
        { label: "GitHub", href: siteConfig.links.github, external: true },
        {
          label: "X (Twitter)",
          href: siteConfig.links.twitter,
          external: true,
        },
        {
          label: "Vercel OSS Program",
          href: "https://vercel.com/blog/spring25-oss-program#kokonutui",
          external: true,
        },
      ],
    },
  ];
}

const LINK =
  "text-[13.5px] text-black/60 underline-offset-4 transition-colors duration-150 ease-out hover:text-black hover:underline dark:text-white/60 dark:hover:text-white";

export function Footer() {
  const columns = getColumns();

  return (
    <footer className="w-full bg-white dark:bg-black">
      <div className="mx-auto w-full max-w-[1280px] px-4 pb-10 sm:px-6">
        <div
          className={cn("grid grid-cols-1 border", GRID, LINE)}
          data-nosnippet
        >
          <div
            className={cn(
              "flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6",
              CELL
            )}
          >
            <div className="flex max-w-md flex-col gap-3">
              <Link
                className={cn(
                  "inline-flex items-center gap-1.5 font-semibold text-[17px] tracking-[-0.02em]",
                  INK
                )}
                href="/"
              >
                <Image alt="" height={24} src="/logo.svg" width={24} />
                Kokonut UI
              </Link>
              <p className="text-[14px] text-black/60 leading-relaxed dark:text-white/60">
                {siteConfig.description}
              </p>
            </div>
            <a
              className={cn(
                "inline-flex items-center gap-1 text-[13.5px]",
                LINK
              )}
              href="https://dorianbaffier.com"
              rel="noopener"
              target="_blank"
            >
              Built by{" "}
              <span className={cn("font-medium", INK)}>Dorian Baffier</span>
              <ArrowUpRight aria-hidden className="size-3.5" />
            </a>
          </div>

          <nav
            aria-label="Footer"
            className={cn("grid grid-cols-2 lg:grid-cols-5", GRID)}
          >
            {columns.map((column) => (
              <div
                className={cn(
                  "flex flex-col gap-3 p-5 last:col-span-2 sm:p-6 lg:last:col-span-1",
                  CELL
                )}
                key={column.title}
              >
                <h2 className={META}>{column.title}</h2>
                <ul className="flex flex-col gap-2">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      {link.external ? (
                        <a
                          className={LINK}
                          href={link.href}
                          rel="noopener"
                          target="_blank"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link className={LINK} href={link.href}>
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div
            className={cn(
              "flex flex-col gap-1 px-5 py-3 sm:flex-row sm:justify-between sm:px-6",
              CELL
            )}
          >
            <p className={META}>
              © Kokonut UI. Free and open source under the{" "}
              <a
                className="underline underline-offset-2 hover:text-black dark:hover:text-white"
                href={`${siteConfig.links.github}/blob/main/LICENSE`}
                rel="noopener"
                target="_blank"
              >
                MIT License
              </a>
              .
            </p>
            <p className={META}>React, Tailwind CSS, Motion, shadcn/ui</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
