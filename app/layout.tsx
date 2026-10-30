import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./fonts.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { RootProvider } from "fumadocs-ui/provider/next";
import { ThemeProvider } from "next-themes";
import { preload } from "react-dom";
import { CopyToast } from "@/components/copy-toast";
import LazySearchDialog from "@/components/search-dialog-lazy";
import { META_THEME_COLORS, siteConfig } from "@/config/site";
import { fontPreloads } from "@/lib/fonts";

export const metadata: Metadata = {
  title: `${siteConfig.name}: Free Open-Source React & Tailwind Components`,
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  keywords: [
    "ui",
    "components",
    "Tailwind CSS",
    "Next.js",
    "shadcn",
    "motion",
    "react design",
  ],
  robots: "index, follow",
  alternates: {
    canonical: siteConfig.url,
  },
  authors: [{ name: "Dorian Baffier", url: "https://x.com/dorianbaffier" }],
  creator: "Dorian Baffier",
  openGraph: {
    title: `${siteConfig.name}: Components that feel right`,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    creator: "@dorianbaffier",
    title: `${siteConfig.name}: Components that feel right`,
    description: siteConfig.description,
  },
};

const structuredData = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteConfig.url}/#website`,
      name: siteConfig.name,
      url: siteConfig.url,
      description: siteConfig.description,
      publisher: { "@id": `${siteConfig.url}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${siteConfig.url}/#organization`,
      name: siteConfig.name,
      url: siteConfig.url,
      logo: `${siteConfig.url}/icon.png`,
      sameAs: [siteConfig.links.twitter, siteConfig.links.github],
    },
  ],
});

export const viewport: Viewport = {
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: META_THEME_COLORS.light,
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: META_THEME_COLORS.dark,
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Geist for text and Geist Mono for codes, labels and commands, cut down to
  // what the site uses by scripts/subset-fonts.py (app/fonts.css). Pages
  // preload the small core files; the extended ones load only for the
  // characters they cover.
  for (const href of fontPreloads) {
    preload(href, { as: "font", type: "font/woff2", crossOrigin: "" });
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="site-fonts antialiased">
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema.org JSON-LD built from siteConfig
          dangerouslySetInnerHTML={{ __html: structuredData }}
          type="application/ld+json"
        />
        <RootProvider search={{ SearchDialog: LazySearchDialog }}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            disableTransitionOnChange
            enableSystem
          >
            {children}
          </ThemeProvider>
        </RootProvider>
        <CopyToast />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
