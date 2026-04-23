import { ArrowUpRight, Check } from "lucide-react";
import Link from "next/link";
import Motion from "@/components/icons/motion";
import Nextjs from "@/components/icons/nextjs";
import ReactIcon from "@/components/icons/react";
import TailwindCSS from "@/components/icons/tailwindcss";

const FEATURES = [
  "100+ templates, blocks and components",
  "One click deployment templates",
  "Built with React, TypeScript and Tailwind CSS v4",
  "Animations with Motion",
  "One command installation with shadcn/cli",
] as const;

const STACK = [
  { icon: ReactIcon, label: "React" },
  { icon: Nextjs, label: "Next.js" },
  { icon: TailwindCSS, label: "Tailwind" },
  { icon: Motion, label: "Motion" },
] as const;

export default function TocProBanner() {
  return (
    <Link
      className="group relative mt-4 flex flex-col gap-4 overflow-hidden rounded-xl border border-[#FF2D55]/25 p-4 transition-colors duration-200 ease-out hover:border-[#FF2D55]/45"
      href="https://kokonutui.pro?utm_source=kokonutui.com&utm_medium=toc"
      rel="noopener"
      target="_blank"
    >
      {/* Background gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 10% 0%, #FF2D5520, transparent 70%), radial-gradient(ellipse at 90% 100%, #FF2D5510, transparent 60%)",
        }}
      />

      {/* Shimmer sweep */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-1/2 -translate-x-full -skew-x-12 bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[280%]"
      />

      {/* Header */}
      <div className="relative">
        <span className="font-semibold text-[17px] text-foreground leading-snug tracking-tight">
          Ship beautiful products and build websites faster
        </span>
      </div>

      {/* Feature bullets */}
      <ul className="relative flex flex-col gap-4">
        {FEATURES.map((f) => (
          <li className="flex items-center gap-2" key={f}>
            <Check
              className="h-3 w-3 shrink-0"
              strokeWidth={2.5}
              style={{ color: "#FF2D55" }}
            />
            <span className="text-muted-foreground text-sm leading-none">
              {f}
            </span>
          </li>
        ))}
      </ul>

      {/* Tech stack icons */}
      <div className="relative flex items-center gap-2">
        {STACK.map(({ icon: Icon, label }) => (
          <div
            className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-muted transition-colors duration-200 group-hover:border-border/80"
            key={label}
            title={label}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="relative flex flex-col gap-2">
        <div className="flex items-center gap-1.5 self-start rounded-lg bg-[#FF2D55] px-3 py-1.5 font-semibold text-[12px] text-white tracking-tight transition-opacity duration-200 group-hover:opacity-90">
          Explore Pro
          <ArrowUpRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
        <span className="text-[11px] text-muted-foreground">
          Trusted by 10k+ users worldwide
        </span>
      </div>

      {/* Accent bottom line */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 h-[2px] w-0 rounded-full transition-[width] duration-500 ease-out group-hover:w-full"
        style={{
          background: "linear-gradient(to right, #FF2D55, transparent)",
        }}
      />
    </Link>
  );
}
