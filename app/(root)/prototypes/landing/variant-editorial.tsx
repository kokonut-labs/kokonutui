"use client";

import { ArrowDownIcon, ArrowRightIcon, ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import AIPrompt from "@/components/kokonutui/ai-prompt";
import AppleActivityCard from "@/components/kokonutui/apple-activity-card";
import BackgroundPaths from "@/components/kokonutui/background-paths";
import CardFlip from "@/components/kokonutui/card-flip";
import FileUpload from "@/components/kokonutui/file-upload";
import ParticleButton from "@/components/kokonutui/particle-button";
import ShimmerText from "@/components/kokonutui/shimmer-text";
import SmoothTab from "@/components/kokonutui/smooth-tab";
import { cn } from "@/lib/utils";
import {
  type Category,
  type CategoryItem,
  GITHUB_URL,
  installCommand,
  MCP_COMMAND,
  PRO_URL,
  QUOTES,
  type VariantProps,
} from "./data";
import { CopyIconSwap, enter, PRESS, useCopy } from "./shared";

// Direction: typography and restraint. Large type, generous whitespace, a
// catalog index, and almost no motion: the headline settles once, and that's
// the only thing on the page that moves on its own.

// One live component stands in for each section of the index.
const SIGNATURE: Record<string, { name: string; render: () => ReactNode }> = {
  backgrounds: {
    name: "background-paths",
    render: () => (
      // Backgrounds are full-viewport by design; show one at half scale.
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 h-[200%] w-[200%] origin-top-left scale-50"
        inert
      >
        <BackgroundPaths title="Background Paths" />
      </div>
    ),
  },
  cards: {
    name: "apple-activity-card",
    render: () => <AppleActivityCard className="p-0" title="Today" />,
  },
  navigation: {
    name: "smooth-tab",
    render: () => <SmoothTab className="w-full max-w-[380px]" />,
  },
  inputs: {
    name: "file-upload",
    render: () => <FileUpload className="w-full max-w-[340px]" />,
  },
  ai: {
    name: "ai-prompt",
    render: () => <AIPrompt className="w-full max-w-[400px]" />,
  },
  texts: {
    name: "shimmer-text",
    render: () => (
      <ShimmerText
        className="whitespace-nowrap text-[32px] tracking-tight"
        text="Beautiful by default"
      />
    ),
  },
  buttons: {
    name: "particle-button",
    render: () => <ParticleButton>Send</ParticleButton>,
  },
};

const pad = (n: number) => String(n).padStart(2, "0");

export function EditorialVariant({ categories, total }: VariantProps) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-40 sm:px-6">
      <Hero categories={categories} total={total} />
      <Masthead />
      <Index categories={categories} total={total} />
      <Install />
      <Voices />
      <Colophon />
    </div>
  );
}

function Hero({ categories, total }: VariantProps) {
  const fig = categories
    .flatMap((c) => c.items)
    .find((i) => i.name === "card-flip");

  return (
    <header className="pt-16 md:pt-24">
      <h1 className="font-semibold text-[clamp(56px,11vw,148px)] text-black leading-[0.9] tracking-[-0.055em] dark:text-white">
        <span className="block overflow-hidden pb-[0.06em]">
          <span className="proto-rise" style={enter(0)}>
            Beautiful
          </span>
        </span>
        <span className="block overflow-hidden pb-[0.06em]">
          <span
            className="proto-rise text-black/30 dark:text-white/35"
            style={enter(1)}
          >
            by default.
          </span>
        </span>
      </h1>

      <div className="mt-12 grid gap-12 md:mt-16 md:grid-cols-12 md:gap-6">
        <div className="proto-enter md:col-span-5" style={enter(0, 260)}>
          <p className="text-pretty text-[19px] text-black/70 leading-[1.55] dark:text-white/70">
            {total} open-source components for React, built with Tailwind CSS
            and Motion. Each one installs with a single command and lands in
            your codebase as code you own.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-full bg-black px-6 font-medium text-[15px] text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/85",
                PRESS
              )}
              href="#index"
            >
              Read the index
              <ArrowDownIcon aria-hidden className="size-4" />
            </a>
            <Link
              className="group inline-flex items-center gap-1.5 font-medium text-[15px] text-black/70 hover:text-black dark:text-white/70 dark:hover:text-white"
              href="/docs"
            >
              Documentation
              <ArrowRightIcon
                aria-hidden
                className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </div>

        <figure
          className="proto-enter md:col-span-6 md:col-start-7"
          style={enter(1, 260)}
        >
          <div className="flex h-[380px] items-center justify-center rounded-[28px] bg-black/[0.03] dark:bg-white/[0.04]">
            <CardFlip />
          </div>
          <Caption figure={1} item={fig} note="Hover to turn it over." />
        </figure>
      </div>
    </header>
  );
}

function Caption({
  figure,
  item,
  note,
  from,
}: {
  figure: number;
  item?: CategoryItem;
  note?: string;
  from?: string;
}) {
  if (!item) {
    return null;
  }
  return (
    <figcaption className="mt-4 flex gap-4 text-[13px] text-black/55 leading-relaxed dark:text-white/55">
      <span className="shrink-0 font-mono text-black/40 dark:text-white/40">
        Fig. {figure}
      </span>
      <span className="min-w-0">
        <Link
          className="font-medium text-black underline decoration-black/20 underline-offset-4 hover:decoration-black dark:text-white dark:decoration-white/25 dark:hover:decoration-white"
          href={item.url}
        >
          {item.title}
        </Link>
        {from ? `, from ${from}.` : "."} {note ?? item.description}
      </span>
    </figcaption>
  );
}

const FACTS = [
  ["License", "MIT, free forever"],
  ["Stack", "React, Tailwind CSS, Motion"],
  ["Install", "shadcn CLI or MCP"],
  ["Selected for", "Vercel OSS Program 2025"],
] as const;

function Masthead() {
  return (
    <dl
      className="proto-enter mt-20 grid grid-cols-2 gap-y-6 border-black/10 border-y py-6 md:mt-28 md:grid-cols-4 dark:border-white/10"
      style={enter(2, 260)}
    >
      {FACTS.map(([label, value]) => (
        <div className="flex flex-col gap-1" key={label}>
          <dt className="text-[12px] text-black/45 dark:text-white/45">
            {label}
          </dt>
          <dd className="text-[15px] text-black dark:text-white">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SectionLabel({
  number,
  title,
  aside,
}: {
  number: number;
  title: string;
  aside?: string;
}) {
  return (
    <div className="mb-10 flex items-baseline justify-between gap-6 md:mb-14">
      <h2 className="flex items-baseline gap-4 font-semibold text-[32px] text-black tracking-[-0.035em] md:text-[44px] dark:text-white">
        <span className="font-mono font-normal text-[14px] text-black/35 tracking-normal dark:text-white/35">
          {pad(number)}
        </span>
        {title}
      </h2>
      {aside ? (
        <p className="hidden text-[14px] text-black/50 sm:block dark:text-white/50">
          {aside}
        </p>
      ) : null}
    </div>
  );
}

function Index({ categories, total }: VariantProps) {
  const [active, setActive] = useState(categories[0]?.slug);
  const activeCategory =
    categories.find((c) => c.slug === active) ?? categories[0];
  const signature = activeCategory ? SIGNATURE[activeCategory.slug] : undefined;
  const signatureItem = activeCategory?.items.find(
    (i) => i.name === signature?.name
  );

  return (
    <section className="scroll-mt-28 pt-28 md:pt-40" id="index">
      <SectionLabel
        aside={`${total} components in ${categories.length} sections`}
        number={1}
        title="Index"
      />
      <div className="grid gap-10 md:grid-cols-12 md:gap-6">
        <ol className="md:col-span-7">
          {categories.map((category, i) => (
            <IndexRow
              active={category.slug === activeCategory?.slug}
              category={category}
              index={i + 1}
              key={category.slug}
              onActivate={() => setActive(category.slug)}
            />
          ))}
        </ol>

        {/* Hover changes the plate tens of times a visit, so the swap is
            instant: no fade to wait through. */}
        <figure className="hidden md:sticky md:top-28 md:col-span-5 md:block md:self-start">
          <div className="relative flex h-[440px] items-center justify-center overflow-hidden rounded-[28px] bg-black/[0.03] p-8 after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:bg-white/[0.04] dark:after:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]">
            {signature ? (
              <div className="contents" key={activeCategory.slug}>
                {signature.render()}
              </div>
            ) : null}
          </div>
          <Caption
            figure={2}
            from={activeCategory?.title}
            item={signatureItem}
          />
        </figure>
      </div>
    </section>
  );
}

function IndexRow({
  category,
  index,
  active,
  onActivate,
}: {
  category: Category;
  index: number;
  active: boolean;
  onActivate: () => void;
}) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: hover and focus only pick the preview; the row's links stay the interactive elements
    <li
      className="group/row border-black/10 border-t py-6 last:border-b dark:border-white/10"
      onFocus={onActivate}
      onPointerEnter={onActivate}
    >
      <div className="flex items-baseline gap-5">
        <span className="w-6 shrink-0 font-mono text-[13px] text-black/35 dark:text-white/35">
          {pad(index)}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            className={cn(
              "inline-flex items-baseline gap-3 font-semibold text-[30px] tracking-[-0.03em] transition-colors duration-150 ease-[ease] md:text-[38px]",
              active
                ? "text-black dark:text-white"
                : "text-black md:text-black/30 dark:text-white md:dark:text-white/30"
            )}
            href={category.items[0].url}
          >
            {category.title}
            <sup className="font-mono font-normal text-[13px] text-black/40 tracking-normal dark:text-white/40">
              {category.items.length}
            </sup>
          </Link>
          <p className="mt-2 text-[14px] text-black/50 leading-relaxed dark:text-white/50">
            {category.items.map((item, i) => (
              <span key={item.url}>
                <Link
                  className="hover:text-black hover:underline hover:underline-offset-4 dark:hover:text-white"
                  href={item.url}
                >
                  {item.title}
                </Link>
                {i < category.items.length - 1 ? ", " : null}
              </span>
            ))}
          </p>
        </div>
      </div>
    </li>
  );
}

function Install() {
  const command = installCommand("card-flip");
  const { copied, copy } = useCopy();

  return (
    <section className="pt-28 md:pt-40">
      <SectionLabel number={2} title="Install" />
      <button
        aria-label={copied ? "Copied" : `Copy ${command}`}
        className="group flex w-full min-w-0 items-center gap-4 border-black/10 border-y py-6 text-left font-mono text-[15px] text-black sm:text-[22px] md:text-[28px] dark:border-white/10 dark:text-white"
        onClick={() => copy(command)}
        type="button"
      >
        <span aria-hidden className="text-black/25 dark:text-white/25">
          $
        </span>
        <span className="min-w-0 flex-1 truncate">{command}</span>
        <span className="flex shrink-0 items-center gap-2 font-sans text-[13px] text-black/45 group-hover:text-black dark:text-white/45 dark:group-hover:text-white">
          <CopyIconSwap copied={copied} />
          {copied ? "Copied" : "Copy"}
        </span>
      </button>
      <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
        <Note title="You own the code">
          The source lands in your repository, next to your own components.
          Change anything; there is no package to update.
        </Note>
        <Note title="Your agent can install it">
          Run <code className="font-mono text-[13px]">{MCP_COMMAND}</code> and
          Claude Code, Cursor, VS Code or Codex can search and add components
          for you.
        </Note>
        <Note title="Every page reads as text">
          Add <code className="font-mono text-[13px]">.md</code> to any docs URL
          for its Markdown, or point a model at{" "}
          <a
            className="underline decoration-black/20 underline-offset-4 hover:decoration-black dark:decoration-white/25 dark:hover:decoration-white"
            href="/llms.txt"
          >
            /llms.txt
          </a>
          .
        </Note>
      </div>
    </section>
  );
}

function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 font-medium text-[15px] text-black dark:text-white">
        {title}
      </h3>
      <p className="text-pretty text-[15px] text-black/60 leading-relaxed dark:text-white/60">
        {children}
      </p>
    </div>
  );
}

function Voices() {
  const pull = QUOTES.find((q) => q.handle === "shadcn");
  const rest = QUOTES.filter((q) =>
    ["rjv_im", "Mehdi_B_25", "rexan_wong"].includes(q.handle)
  );

  return (
    <section className="scroll-mt-28 pt-28 md:pt-40" id="testimonials">
      <SectionLabel number={3} title="Voices" />
      {pull ? (
        <figure className="border-black/10 border-t pt-10 dark:border-white/10">
          <blockquote className="font-semibold text-[clamp(64px,12vw,160px)] text-black leading-[0.9] tracking-[-0.055em] dark:text-white">
            “{pull.text}”
          </blockquote>
          <figcaption className="mt-6 text-[15px] text-black/55 dark:text-white/55">
            <span className="font-medium text-black dark:text-white">
              {pull.name}
            </span>
            , creator of shadcn/ui, replying to the Open in v0 launch on{" "}
            {pull.date}.
          </figcaption>
        </figure>
      ) : null}
      <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-6">
        {rest.map((quote) => (
          <figure key={quote.handle}>
            <blockquote className="text-pretty text-[17px] text-black/80 leading-relaxed dark:text-white/80">
              “{quote.text}”
            </blockquote>
            <figcaption className="mt-3 text-[13px] text-black/50 dark:text-white/50">
              <a
                className="hover:text-black dark:hover:text-white"
                href={`https://x.com/${quote.handle}`}
                rel="noreferrer"
                target="_blank"
              >
                {quote.name}, @{quote.handle}
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Colophon() {
  return (
    <section className="pt-28 md:pt-40">
      <SectionLabel number={4} title="Colophon" />
      <div className="grid gap-10 border-black/10 border-t pt-10 md:grid-cols-2 md:gap-6 dark:border-white/10">
        <div>
          <h3 className="font-semibold text-[24px] text-black tracking-[-0.03em] dark:text-white">
            Free, and staying that way.
          </h3>
          <p className="mt-3 max-w-[460px] text-pretty text-[15px] text-black/60 leading-relaxed dark:text-white/60">
            Every component here is MIT licensed and developed in the open.
            Issues, ideas and pull requests are welcome.
          </p>
          <a
            className="group mt-5 inline-flex items-center gap-1.5 font-medium text-[15px] text-black dark:text-white"
            href={GITHUB_URL}
            rel="noreferrer"
            target="_blank"
          >
            kokonut-labs/kokonutui
            <ArrowUpRightIcon
              aria-hidden
              className="size-4 opacity-50 transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </a>
        </div>
        <div>
          <h3 className="font-semibold text-[24px] text-black tracking-[-0.03em] dark:text-white">
            When you need the whole page.
          </h3>
          <p className="mt-3 max-w-[460px] text-pretty text-[15px] text-black/60 leading-relaxed dark:text-white/60">
            Kokonut UI Pro adds premium components and complete templates, made
            with the same care and ready for Claude Code, Cursor and more.
          </p>
          <a
            className="group mt-5 inline-flex items-center gap-1.5 font-medium text-[#FF2D55] text-[15px]"
            href={PRO_URL}
            rel="noreferrer"
            target="_blank"
          >
            Explore Kokonut UI Pro
            <ArrowUpRightIcon
              aria-hidden
              className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </a>
        </div>
      </div>
    </section>
  );
}
