import type { Metadata } from "next";
import { Canvas } from "@/components/landing/canvas/canvas";
import { getParts } from "@/components/landing/home/parts";
import { HomeView } from "@/components/landing/home-view";
import "@/components/landing/home/home.css";
import "@/components/landing/canvas/canvas.css";

// The canvas homepage, shown at / to half of desktop visitors while the
// homepage test runs (see proxy.ts). Not indexed: search engines get /.
export const metadata: Metadata = {
  title: "Canvas",
  robots: { index: false, follow: false },
};

export default function CanvasPage() {
  return (
    <>
      <HomeView />
      <Canvas parts={getParts()} />
    </>
  );
}
