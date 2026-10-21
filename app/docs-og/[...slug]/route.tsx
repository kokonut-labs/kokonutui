import { cacheLife } from "next/cache";
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

/**
 * The image's bytes, cached so the build prerenders every card instead of
 * drawing each one on its first request.
 */
async function renderImage(slug: string[]) {
  "use cache";
  cacheLife("max");

  const page = source.getPage(slug);
  if (!page) {
    return null;
  }
  const parts = getParts();
  const image = await docsImage({
    title: page.data.title,
    description: page.data.description,
    url: page.url,
    part: parts.find((p) => p.url === page.url),
    pro: isProPeekUrl(page.url),
    count: parts.length,
  });
  return new Uint8Array(await image.arrayBuffer());
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const png = await renderImage(slug.slice(0, -1));
  if (!png) {
    notFound();
  }

  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, immutable, no-transform, max-age=31536000",
    },
  });
}
