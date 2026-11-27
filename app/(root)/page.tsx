import type { Metadata } from "next";
import { Catalog } from "@/components/landing/home/catalog";
import { getParts } from "@/components/landing/home/parts";
import { siteConfig } from "@/config/site";
import "@/components/landing/home/home.css";

export const metadata: Metadata = {
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return <Catalog parts={getParts()} />;
}
