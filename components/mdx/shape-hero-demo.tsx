import { Pacifico } from "next/font/google";
import ShapeHero from "@/components/kokonutui/shape-hero";

const pacifico = Pacifico({
  subsets: ["latin"],
  weight: "400",
});

/**
 * Docs demo only. The site loads the script font and passes it in; the
 * component itself does not load fonts.
 */
export default function ShapeHeroDemo() {
  return <ShapeHero title2ClassName={pacifico.className} />;
}
