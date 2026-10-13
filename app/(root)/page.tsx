import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
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

// The catalog sets its codes, labels and commands in a monospace face.
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-home-mono" });

export default function Home() {
  return <Catalog className={mono.variable} parts={getParts()} />;
}
