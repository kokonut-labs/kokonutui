"use client";

import { ArrowRightIcon, ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import AIPrompt from "@/components/kokonutui/ai-prompt";
import AppleActivityCard from "@/components/kokonutui/apple-activity-card";
import CardFlip from "@/components/kokonutui/card-flip";
import FileUpload from "@/components/kokonutui/file-upload";
import HoldButton from "@/components/kokonutui/hold-button";
import ParticleButton from "@/components/kokonutui/particle-button";
import Toolbar from "@/components/kokonutui/toolbar";
import { cn } from "@/lib/utils";
import {
  type Category,
  docsUrl,
  GITHUB_URL,
  installCommand,
  MCP_COMMAND,
  PRO_TEMPLATES_URL,
  PRO_URL,
  QUOTES,
  type VariantProps,
} from "./data";
import { CopyIconSwap, enter, Monogram, PRESS, useCopy } from "./shared";

// Direction: the page is a live canvas. Visitors touch real components before
// they read anything, then copy the one they liked.

const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

export function PlaygroundVariant({ categories, total }: VariantProps) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-40 sm:px-6">
      <Hero total={total} />
      <Bento categories={categories} />
      <CategoryIndex categories={categories} total={total} />
      <InstallBand />
      <Voices />
      <ProBand />
    </div>
  );
}

function Hero({ total }: { total: number }) {
  return (
    <header className="flex flex-col gap-8 pt-14 pb-10 md:flex-row md:items-end md:justify-between md:pt-20 md:pb-12">
      <div className="max-w-[640px]">
        <p
          className="proto-enter mb-5 inline-flex items-center gap-2 text-[13px] text-black/55 dark:text-white/55"
          style={enter(0)}
        >
          <span className="size-1.5 rounded-full bg-[#2CD242] dark:bg-[#3BB44B]" />
          Open source, MIT licensed
        </p>
        <h1
          className="proto-enter text-balance font-semibold text-[40px] text-black leading-[1.02] tracking-[-0.035em] sm:text-[56px] dark:text-white"
          style={enter(1)}
        >
          Try it here.{" "}
          <span className="text-black/35 dark:text-white/40">
            Ship it there.
          </span>
        </h1>
        <p
          className="proto-enter mt-5 max-w-[540px] text-pretty text-[17px] text-black/60 leading-relaxed dark:text-white/60"
          style={enter(2)}
        >
          {total} open-source React components built with Tailwind CSS and
          Motion. Every tile below is the real component: press it, type in it,
          drop a file on it, then copy one line into your project.
        </p>
      </div>
      <div
        className="proto-enter flex shrink-0 items-center gap-2"
        style={enter(3)}
      >
        <Link
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-lg bg-black px-5 font-medium text-[14px] text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/85",
            PRESS
          )}
          href="/docs"
        >
          Browse all {total}
          <ArrowRightIcon aria-hidden className="size-4" />
        </Link>
        <Link
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-lg border border-black/10 px-4 font-medium text-[14px] text-black/80 hover:bg-black/[0.04] dark:border-white/10 dark:text-white/80 dark:hover:bg-white/[0.06]",
            PRESS
          )}
          href={GITHUB_URL}
          rel="noreferrer"
          target="_blank"
        >
          GitHub
          <ArrowUpRightIcon aria-hidden className="size-4 opacity-50" />
        </Link>
      </div>
    </header>
  );
}

function Bento({ categories }: { categories: Category[] }) {
  const [sent, setSent] = useState<{ text: string; model: string } | null>(
    null
  );
  const [bursts, setBursts] = useState(0);

  return (
    <section
      aria-label="Live components"
      className="grid grid-cols-1 gap-3 md:grid-cols-12"
    >
      <Tile
        categories={categories}
        className="md:col-span-7"
        hint={
          sent
            ? `Sent “${truncate(sent.text, 28)}” to ${sent.model}`
            : "Type, then press Enter"
        }
        index={4}
        name="ai-prompt"
      >
        <AIPrompt
          className="w-full max-w-[520px]"
          onSubmit={(text, model) => {
            // The send button has no handler yet; Enter is the only submit.
            if (text.trim()) {
              setSent({ text: text.trim(), model });
            }
          }}
        />
      </Tile>
      <Tile
        categories={categories}
        className="md:col-span-5"
        hint="Rings fill as it mounts"
        index={5}
        name="apple-activity-card"
      >
        {/* The card is wider than a phone-width tile; scale it to fit. */}
        <AppleActivityCard className="p-0 max-sm:scale-[0.82]" title="Today" />
      </Tile>
      <Tile
        categories={categories}
        className="md:col-span-4 md:row-span-2"
        hint="Hover to flip"
        index={6}
        name="card-flip"
      >
        <CardFlip />
      </Tile>
      <Tile
        categories={categories}
        className="md:col-span-4 md:row-span-2"
        hint="Drop any image"
        index={7}
        name="file-upload"
      >
        <FileUpload className="w-full" />
      </Tile>
      <Tile
        categories={categories}
        className="md:col-span-4"
        hint="Press and hold"
        index={8}
        name="hold-button"
        stageClassName="min-h-[176px]"
      >
        <HoldButton holdDuration={2000} />
      </Tile>
      <Tile
        categories={categories}
        className="md:col-span-4"
        hint={bursts > 0 ? `${bursts} sent` : "Click it"}
        index={9}
        name="particle-button"
        stageClassName="min-h-[176px]"
      >
        <ParticleButton onSuccess={() => setBursts((n) => n + 1)}>
          Send
        </ParticleButton>
      </Tile>
      <Tile
        categories={categories}
        className="hidden md:col-span-12 md:flex"
        hint="Pick a tool"
        index={10}
        name="toolbar"
        stageClassName="min-h-[150px]"
      >
        <Toolbar />
      </Tile>
    </section>
  );
}

function Tile({
  name,
  hint,
  index,
  className,
  stageClassName,
  categories,
  children,
}: {
  name: string;
  hint: string;
  index: number;
  className?: string;
  stageClassName?: string;
  categories: Category[];
  children: ReactNode;
}) {
  const { copied, copy } = useCopy();

  return (
    <figure
      className={cn(
        "proto-enter flex flex-col overflow-hidden rounded-2xl border border-black/[0.07] bg-white dark:border-white/[0.08] dark:bg-white/[0.02]",
        className
      )}
      style={enter(index)}
    >
      <div
        className={cn(
          // A faint dot grid marks the stage as a canvas you can touch.
          "relative flex flex-1 items-center justify-center bg-[radial-gradient(circle,rgba(0,0,0,0.07)_1px,transparent_1px)] bg-[size:16px_16px] p-6 dark:bg-[radial-gradient(circle,rgba(255,255,255,0.07)_1px,transparent_1px)]",
          stageClassName
        )}
      >
        {children}
      </div>
      <figcaption className="flex h-11 items-center gap-3 border-black/[0.06] border-t px-4 dark:border-white/[0.07]">
        <Link
          className="font-mono text-[12px] text-black/70 underline-offset-4 hover:text-black hover:underline dark:text-white/70 dark:hover:text-white"
          href={docsUrl(categories, name)}
        >
          {name}
        </Link>
        <span
          aria-live="polite"
          className="min-w-0 flex-1 truncate text-[12px] text-black/40 dark:text-white/40"
        >
          {hint}
        </span>
        <button
          aria-label={copied ? "Copied" : `Copy install command for ${name}`}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-2 font-mono text-[11px] text-black/55 hover:bg-black/[0.05] hover:text-black dark:text-white/55 dark:hover:bg-white/[0.07] dark:hover:text-white",
            PRESS
          )}
          onClick={() => copy(installCommand(name))}
          title={installCommand(name)}
          type="button"
        >
          <CopyIconSwap className="size-3" copied={copied} />
          {copied ? "Copied" : "Install"}
        </button>
      </figcaption>
    </figure>
  );
}

function CategoryIndex({
  categories,
  total,
}: {
  categories: Category[];
  total: number;
}) {
  return (
    <section className="pt-28" id="browse">
      <SectionHeading
        description={`${categories.length} categories, every one of them free.`}
        title={`All ${total} components`}
      />
      <div className="columns-1 gap-3 sm:columns-2 lg:columns-4">
        {categories.map((category) => (
          <div
            className="mb-3 break-inside-avoid rounded-2xl border border-black/[0.07] p-5 dark:border-white/[0.08]"
            key={category.slug}
          >
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="font-medium text-[15px] text-black dark:text-white">
                {category.title}
              </h3>
              <span className="font-mono text-[12px] text-black/40 tabular-nums dark:text-white/40">
                {category.items.length}
              </span>
            </div>
            <ul className="flex flex-col">
              {category.items.map((item) => (
                <li key={item.url}>
                  <Link
                    className="group -mx-2 flex items-center justify-between rounded-md px-2 py-1.5 text-[14px] text-black/65 hover:bg-black/[0.04] hover:text-black dark:text-white/65 dark:hover:bg-white/[0.06] dark:hover:text-white"
                    href={item.url}
                  >
                    {item.title}
                    <ArrowRightIcon
                      aria-hidden
                      className="size-3.5 -translate-x-1 opacity-0 transition-[opacity,transform] duration-150 ease-out group-hover:translate-x-0 group-hover:opacity-60"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function CommandChip({ command }: { command: string }) {
  const { copied, copy } = useCopy();
  return (
    <button
      aria-label={copied ? "Copied" : `Copy ${command}`}
      className={cn(
        "flex h-11 w-full min-w-0 items-center gap-3 rounded-xl border border-black/[0.08] bg-white px-4 text-left font-mono text-[13px] text-black/80 hover:border-black/15 dark:border-white/[0.1] dark:bg-black dark:text-white/80 dark:hover:border-white/20",
        PRESS
      )}
      onClick={() => copy(command)}
      type="button"
    >
      <span aria-hidden className="text-black/30 dark:text-white/30">
        $
      </span>
      <span className="min-w-0 flex-1 truncate">{command}</span>
      <CopyIconSwap
        className="text-black/40 dark:text-white/40"
        copied={copied}
      />
    </button>
  );
}

function InstallBand() {
  return (
    <section className="pt-28">
      <div className="grid gap-8 rounded-3xl bg-black/[0.03] p-6 md:grid-cols-2 md:items-center md:p-10 dark:bg-white/[0.04]">
        <div>
          <h2 className="font-semibold text-[28px] text-black tracking-[-0.03em] dark:text-white">
            One line, and it's yours.
          </h2>
          <p className="mt-3 max-w-[440px] text-[15px] text-black/60 leading-relaxed dark:text-white/60">
            The shadcn CLI adds the component's source and its dependencies to
            your project. There's no package to update and nothing to eject.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <CommandChip command={installCommand("ai-prompt")} />
          <p className="mt-2 mb-1 text-[13px] text-black/50 dark:text-white/50">
            Using Claude Code, Cursor, VS Code or Codex? Let your agent install
            them:
          </p>
          <CommandChip command={MCP_COMMAND} />
        </div>
      </div>
    </section>
  );
}

function Voices() {
  return (
    <section className="scroll-mt-28 pt-28" id="testimonials">
      <SectionHeading
        description="What people say when they find it."
        title="Seen on X"
      />
      <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
        {QUOTES.map((quote) => (
          <a
            className="mb-3 block break-inside-avoid rounded-2xl border border-black/[0.07] p-5 transition-colors duration-150 hover:border-black/15 dark:border-white/[0.08] dark:hover:border-white/20"
            href={`https://x.com/${quote.handle}`}
            key={quote.handle}
            rel="noreferrer"
            target="_blank"
          >
            <div className="mb-3 flex items-center gap-2.5">
              <Monogram name={quote.name} />
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-[14px] text-black dark:text-white">
                  {quote.name}
                </span>
                <span className="text-[12px] text-black/45 dark:text-white/45">
                  @{quote.handle}
                </span>
              </div>
            </div>
            <p className="text-pretty text-[15px] text-black/75 leading-relaxed dark:text-white/75">
              {quote.text}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}

function ProBand() {
  return (
    <section className="pt-28">
      <div className="flex flex-col gap-6 rounded-3xl border border-black/[0.07] p-6 md:flex-row md:items-center md:justify-between md:p-10 dark:border-white/[0.08]">
        <div className="max-w-[560px]">
          <p className="mb-3 inline-flex items-center gap-2 font-medium text-[#FF2D55] text-[13px]">
            <span className="size-1.5 rounded-full bg-[#FF2D55]" />
            Kokonut UI Pro
          </p>
          <h2 className="font-semibold text-[28px] text-black tracking-[-0.03em] dark:text-white">
            Need a whole page, not just a part?
          </h2>
          <p className="mt-3 text-[15px] text-black/60 leading-relaxed dark:text-white/60">
            Pro adds premium components and complete templates, built the same
            way and ready for Claude Code, Cursor and more.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-lg bg-black px-5 font-medium text-[14px] text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/85",
              PRESS
            )}
            href={PRO_URL}
            rel="noreferrer"
            target="_blank"
          >
            Explore Pro
            <ArrowUpRightIcon aria-hidden className="size-4" />
          </a>
          <a
            className={cn(
              "inline-flex h-10 items-center rounded-lg px-4 font-medium text-[14px] text-black/70 hover:bg-black/[0.04] dark:text-white/70 dark:hover:bg-white/[0.06]",
              PRESS
            )}
            href={PRO_TEMPLATES_URL}
            rel="noreferrer"
            target="_blank"
          >
            See templates
          </a>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-2">
      <h2 className="font-semibold text-[28px] text-black tracking-[-0.03em] dark:text-white">
        {title}
      </h2>
      <p className="text-[15px] text-black/55 dark:text-white/55">
        {description}
      </p>
    </div>
  );
}
