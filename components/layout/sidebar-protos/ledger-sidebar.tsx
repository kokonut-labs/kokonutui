"use client";

import Link from "fumadocs-core/link";
import { SidebarTrigger } from "fumadocs-ui/components/sidebar/base";
import { X } from "lucide-react";
import { Newsreader } from "next/font/google";
import Image from "next/image";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  EASE_COLORS,
  FOCUS_INSET,
  LEAF,
  LINE,
  MONO,
} from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";
import { ProtoFooter, SearchRow, useIsActive } from "./chrome";
import { useSidebarProto } from "./context";
import type { SidebarLink, SidebarSection } from "./model";
import { ProtoShell } from "./shell";

const serif = Newsreader({
  subsets: ["latin"],
  style: ["italic"],
  weight: ["400"],
});

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const SEAL_TEXT = "KOKONUT UI · FREE & OPEN SOURCE · MIT LICENSE · ";

/** A rubber-stamp seal: the leaf in the middle, the licence around it. */
function Seal() {
  const id = "ledger-seal-path";
  return (
    <span className="relative grid size-[60px] shrink-0 place-items-center">
      <svg
        className="absolute inset-0 size-full text-black/70 dark:text-white/70"
        viewBox="0 0 100 100"
      >
        <title>Kokonut UI seal</title>
        <defs>
          <path
            d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0"
            id={id}
          />
        </defs>
        <circle
          cx="50"
          cy="50"
          fill="none"
          r="48"
          stroke="currentColor"
          strokeWidth="1"
        />
        <circle
          cx="50"
          cy="50"
          fill="none"
          r="28"
          stroke="currentColor"
          strokeDasharray="1.5 2.5"
          strokeWidth="1"
        />
        <text
          className="home-mono"
          fill="currentColor"
          fontSize="8.6"
          letterSpacing="1.1"
        >
          <textPath href={`#${id}`}>{SEAL_TEXT}</textPath>
        </text>
      </svg>
      <Image alt="" height={22} src="/logo.svg" width={22} />
    </span>
  );
}

function LedgerRow({
  link,
  marker,
  active,
}: {
  link: SidebarLink;
  marker?: string;
  active: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (active) {
      ref.current?.scrollIntoView({ block: "center" });
    }
  }, [active]);
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-[30px] items-baseline gap-2 px-4 pt-[7px] text-[13.5px]",
        active
          ? "text-black dark:text-white"
          : "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white",
        EASE_COLORS,
        FOCUS_INSET
      )}
      href={link.url}
      ref={ref}
    >
      <span className={cn("shrink-0", active && "font-medium")}>
        {link.name}
      </span>
      <span
        aria-hidden
        className={cn(
          "min-w-3 flex-1 translate-y-[-3px] border-b",
          active
            ? "border-black border-solid dark:border-white"
            : "border-black/25 border-dotted group-hover:border-black/50 dark:border-white/25 dark:group-hover:border-white/50",
          EASE_COLORS
        )}
      />
      <span
        className={cn(
          MONO,
          "shrink-0 text-[11px]",
          link.pro && "text-[#FF2D55]",
          !link.pro && (active ? LEAF : "text-black/40 dark:text-white/40")
        )}
      >
        {link.pro ? "PRO" : (marker ?? link.code)}
      </span>
    </Link>
  );
}

function Chapter({
  section,
  index,
  defaultOpen,
}: {
  section: SidebarSection;
  index: number;
  defaultOpen: boolean;
}) {
  const isActive = useIsActive();
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (defaultOpen) {
      setOpen(true);
    }
  }, [defaultOpen]);
  return (
    <section className={cn("border-t", LINE)}>
      <button
        aria-expanded={open}
        className={cn(
          "flex w-full items-baseline gap-3 px-4 pt-3.5 pb-2.5 text-start",
          FOCUS_INSET
        )}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span
          className={cn(
            MONO,
            "w-6 shrink-0 text-[10.5px] text-black/40 dark:text-white/40"
          )}
        >
          {ROMAN[index] ?? index + 1}.
        </span>
        <span
          className={cn(
            serif.className,
            "flex-1 text-[21px] text-black leading-none tracking-[-0.01em] dark:text-white"
          )}
        >
          {section.name}
        </span>
        <span
          className={cn(
            MONO,
            "shrink-0 whitespace-nowrap text-[10.5px] text-black/40 dark:text-white/40"
          )}
        >
          {section.added > 0 && (
            <span className={LEAF}>{section.added} new · </span>
          )}
          {open ? "−" : `${section.items.length} pp.`}
        </span>
      </button>
      {open && (
        <div className="pb-3">
          {section.items.map((link) => (
            <LedgerRow active={isActive(link.url)} key={link.url} link={link} />
          ))}
        </div>
      )}
    </section>
  );
}

const lowerRoman = (n: number) => (ROMAN[n] ?? String(n + 1)).toLowerCase();

/**
 * B · Ledger. An archive's index: a stamped seal for a masthead, chapters
 * numbered in roman with italic titles, and every part set with a dotted
 * leader to its catalog code, like a contents page. The page being read
 * draws its leader solid.
 */
export function LedgerSidebar({ footer }: { footer?: ReactNode }) {
  const { model } = useSidebarProto();
  const isActive = useIsActive();
  const total = model.sections.reduce(
    (sum, section) => sum + section.items.filter((item) => item.code).length,
    0
  );

  return (
    <ProtoShell>
      <div className="flex shrink-0 items-center gap-3 px-4 pt-4 pb-3">
        <Seal />
        <div className="min-w-0 flex-1">
          <Link
            className={cn(
              serif.className,
              "block text-[24px] text-black leading-none dark:text-white",
              FOCUS_INSET
            )}
            href="/"
          >
            Kokonut UI
          </Link>
          <p
            className={cn(
              MONO,
              "mt-1.5 text-[10.5px] text-black/45 leading-snug dark:text-white/45"
            )}
          >
            Index of parts · {total}
            <br />
            Vol. 2026 · No. 10
          </p>
        </div>
        <SidebarTrigger
          className={cn(
            "-me-1.5 grid size-8 place-items-center self-start text-black/50 hover:text-black md:hidden dark:text-white/50 dark:hover:text-white",
            EASE_COLORS,
            FOCUS_INSET
          )}
        >
          <X aria-hidden className="size-4" />
        </SidebarTrigger>
      </div>
      <div className="px-4 pb-3">
        <SearchRow label="Look up a part" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="pb-3">
          {model.guide.map((link, i) => (
            <LedgerRow
              active={isActive(link.url)}
              key={link.url}
              link={link}
              marker={lowerRoman(i)}
            />
          ))}
        </div>
        {model.sections.map((section, i) => (
          <Chapter
            defaultOpen={section.items.some((item) => isActive(item.url))}
            index={i}
            key={section.slug}
            section={section}
          />
        ))}
        <div className={cn("border-t", LINE)} />
      </div>
      <ProtoFooter footer={footer} />
    </ProtoShell>
  );
}
