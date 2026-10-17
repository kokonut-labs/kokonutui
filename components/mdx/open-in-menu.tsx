"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";
import {
  ArrowUpRightIcon,
  ChevronDownIcon,
  CopyIcon,
  FileTextIcon,
} from "lucide-react";
import { type ComponentType, type SVGProps, useRef } from "react";
import { announceCopy } from "@/components/copy-toast";
import {
  CELL,
  EASE_COLORS,
  FOCUS_INSET,
  LINE,
  MONO,
} from "@/components/landing/home/styles";
import { Claude } from "@/components/ui/svgs/claude";
import { Cursor } from "@/components/ui/svgs/cursor";
import { OpenAI } from "@/components/ui/svgs/openai";
import { V0 } from "@/components/ui/svgs/v0";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

const markdown = new Map<string, Promise<string>>();

/** Fetches a page's Markdown once; a failed fetch is retried next time. */
function loadMarkdown(url: string) {
  let text = markdown.get(url);
  if (!text) {
    text = fetch(url).then((res) => {
      if (!res.ok) {
        throw new Error(`Markdown fetch failed: ${res.status}`);
      }
      return res.text();
    });
    text.catch(() => markdown.delete(url));
    markdown.set(url, text);
  }
  return text;
}

function copyMarkdown(url: string) {
  const text = loadMarkdown(url);
  // Safari only allows clipboard writes inside the click, so hand it a
  // pending item rather than waiting for the fetch first.
  const write =
    typeof ClipboardItem === "undefined"
      ? text.then((value) => navigator.clipboard.writeText(value))
      : navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": text.then(
              (value) => new Blob([value], { type: "text/plain" })
            ),
          }),
        ]);
  announceCopy(url.split("/").at(-1), write);
  // A failed copy leaves the page as it was.
  write.catch(() => undefined);
}

interface Destination {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  href: string;
}

/** Where a component can be opened, each with the page's Markdown to read. */
function destinations(name: string, markdownUrl: string): Destination[] {
  const registry = `${siteConfig.url}/r/${name}.json`;
  const prompt = `Read ${siteConfig.url}${markdownUrl}, the Kokonut UI docs for ${name}. Then help me add it to my project with npx shadcn@latest add ${registry} and use it.`;
  return [
    {
      label: "Claude",
      icon: Claude,
      href: `https://claude.ai/new?${new URLSearchParams({ q: prompt })}`,
    },
    {
      label: "ChatGPT",
      icon: OpenAI,
      href: `https://chatgpt.com/?${new URLSearchParams({ prompt, hints: "search" })}`,
    },
    {
      label: "Cursor",
      icon: Cursor,
      href: `https://cursor.com/link/prompt?${new URLSearchParams({ text: prompt })}`,
    },
    // v0 reads the registry entry itself, so it gets the JSON, not a prompt.
    {
      label: "v0",
      icon: V0,
      href: `https://v0.dev/chat/api/open?${new URLSearchParams({ url: registry })}`,
    },
  ];
}

const ITEM = cn(
  "flex h-8 cursor-default select-none items-center gap-2.5 px-2.5 text-[13px] text-black/75 outline-none data-[highlighted]:bg-black/[0.045] data-[highlighted]:text-black dark:text-white/75 dark:data-[highlighted]:bg-white/[0.07] dark:data-[highlighted]:text-white",
  EASE_COLORS
);

/**
 * Opens the component in an AI tool with a prompt that points at the page's
 * Markdown, or copies that Markdown for any other one.
 */
export function OpenInMenu({
  name,
  markdownUrl,
  className,
}: {
  name: string;
  /** Site path of the page's Markdown, such as /docs/buttons/x.md. */
  markdownUrl: string;
  className?: string;
}) {
  // Opened with the mouse, the menu doesn't hand focus back to the trigger,
  // so no keyboard ring lingers on it after a pick.
  const byPointer = useRef(false);
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className={cn(
          "group inline-flex h-8 items-center gap-1.5 px-3 text-[12px] text-black/55 hover:text-black data-[state=open]:text-black dark:text-white/55 dark:data-[state=open]:text-white dark:hover:text-white",
          MONO,
          EASE_COLORS,
          FOCUS_INSET,
          className
        )}
        onFocus={() => loadMarkdown(markdownUrl)}
        onKeyDown={() => {
          byPointer.current = false;
        }}
        onPointerDown={() => {
          byPointer.current = true;
        }}
        onPointerEnter={() => loadMarkdown(markdownUrl)}
      >
        Open in
        <ChevronDownIcon
          aria-hidden
          className="size-3 transition-transform duration-150 ease-out group-data-[state=open]:rotate-180"
        />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          align="end"
          className={cn(
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[side=bottom]:slide-in-from-top-1 z-50 min-w-[13rem] border py-1 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:duration-100 data-[state=open]:duration-150 dark:shadow-none",
            LINE,
            CELL
          )}
          onCloseAutoFocus={(event) => {
            if (byPointer.current) {
              event.preventDefault();
            }
          }}
          sideOffset={6}
        >
          {destinations(name, markdownUrl).map(
            ({ label, icon: Icon, href }) => (
              <DropdownMenuItem asChild key={label}>
                <a className={ITEM} href={href} rel="noopener" target="_blank">
                  <Icon aria-hidden className="size-3.5 shrink-0" />
                  <span className="flex-1">{label}</span>
                  <ArrowUpRightIcon
                    aria-hidden
                    className="size-3 text-black/35 dark:text-white/35"
                  />
                </a>
              </DropdownMenuItem>
            )
          )}
          <DropdownMenuSeparator className={cn("my-1 border-t", LINE)} />
          <DropdownMenuItem
            className={ITEM}
            onSelect={() => copyMarkdown(markdownUrl)}
          >
            <CopyIcon aria-hidden className="size-3.5 shrink-0" />
            Copy page as Markdown
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              className={ITEM}
              href={markdownUrl}
              rel="noopener"
              target="_blank"
            >
              <FileTextIcon aria-hidden className="size-3.5 shrink-0" />
              View as Markdown
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
