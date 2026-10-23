import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HeroPrototype } from "@/components/landing/home/ai-heroes";
import { Catalog } from "@/components/landing/home/catalog";
import { HERO_IDS, type HeroId } from "@/components/landing/home/hero-ids";
import { getParts } from "@/components/landing/home/parts";
import "@/components/landing/home/home.css";

// Prototype pages for comparing heroes; kept out of search.
export const metadata: Metadata = {
  title: "Hero prototypes",
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return HERO_IDS.map((variant) => ({ variant }));
}

export default async function HeroPage({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant } = await params;
  if (!HERO_IDS.includes(variant as HeroId)) {
    notFound();
  }
  const parts = getParts();
  return (
    <Catalog
      cover={<HeroPrototype id={variant as HeroId} parts={parts} />}
      parts={parts}
    />
  );
}
