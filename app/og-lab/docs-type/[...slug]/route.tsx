import { notFound } from "next/navigation";
import { getParts } from "@/components/landing/home/parts";
import { docsImage } from "@/lib/og/docs-image";
import { source } from "@/lib/source";

/** Prototype of the docs link preview: /og-lab/docs-type/<theme>/<page>/image.png */
export function generateStaticParams() {
  return ["light", "dark"].flatMap((theme) =>
    source.generateParams().map(({ slug }) => ({
      slug: [theme, ...(slug ?? []), "image.png"],
    }))
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  // A design bench for link-preview images, not a page for visitors.
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }
  const { slug } = await params;
  const [theme, ...rest] = slug;
  const page = source.getPage(rest.slice(0, -1));
  if (!(page && (theme === "light" || theme === "dark"))) {
    notFound();
  }
  const parts = getParts();
  return docsImage({
    title: page.data.title,
    description: page.data.description,
    url: page.url,
    part: parts.find((p) => p.url === page.url),
    count: parts.length,
    theme,
  });
}
