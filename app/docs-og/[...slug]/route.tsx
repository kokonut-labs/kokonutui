import { notFound } from "next/navigation";
import { getParts } from "@/components/landing/home/parts";
import { docsImage } from "@/lib/og/docs-image";
import { isProPeekUrl } from "@/lib/pro-peeks";
import { source } from "@/lib/source";

export function generateStaticParams() {
  return source.generateParams().map(({ slug }) => ({
    slug: [...(slug ?? []), "image.png"],
  }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) {
    notFound();
  }

  const parts = getParts();
  return docsImage({
    title: page.data.title,
    description: page.data.description,
    url: page.url,
    part: parts.find((p) => p.url === page.url),
    pro: isProPeekUrl(page.url),
    count: parts.length,
  });
}
