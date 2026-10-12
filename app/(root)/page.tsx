import type { Metadata } from "next";
import { Agents } from "@/components/landing/home/agents";
import { Bento } from "@/components/landing/home/bento";
import { Categories } from "@/components/landing/home/categories";
import { getCategories } from "@/components/landing/home/get-categories";
import { Hero } from "@/components/landing/home/hero";
import { Pro } from "@/components/landing/home/pro";
import { Voices } from "@/components/landing/home/voices";
import { siteConfig } from "@/config/site";
import "@/components/landing/home/home.css";

export const metadata: Metadata = {
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  const categories = getCategories();

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-32 sm:px-6">
      <Hero />
      <Bento categories={categories} />
      <Agents />
      <Categories categories={categories} />
      <Voices />
      <Pro />
    </div>
  );
}
