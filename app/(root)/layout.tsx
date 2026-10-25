import type { Metadata } from "next";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: {
    template: "%s | Kokonut UI - Open Source Components",
    default: "Kokonut UI: Free Open-Source React & Tailwind Components",
  },
};

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="relative w-full bg-white pt-0 md:pt-0 dark:bg-black">
        {children}
      </main>
      <Footer />
    </>
  );
}
