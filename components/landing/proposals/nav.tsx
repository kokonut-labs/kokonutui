import Link from "next/link";
import { FOCUS, INK, META } from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";

const PROPOSALS = [
  { href: "/", label: "Current" },
  { href: "/landing/ask", label: "1. Ask" },
  { href: "/landing/canvas", label: "2. Canvas" },
];

/** Links between the proposals, above the cover. Not part of the design. */
export function ProposalNav({ current }: { current: string }) {
  return (
    <nav
      aria-label="Landing proposals"
      className={cn("flex h-9 flex-wrap items-center gap-x-5 gap-y-1", META)}
    >
      <span>Landing proposals</span>
      {PROPOSALS.map((p) => (
        <Link
          className={cn(
            "underline-offset-4 hover:underline",
            p.href === current && cn(INK, "underline"),
            FOCUS
          )}
          href={p.href}
          key={p.href}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
