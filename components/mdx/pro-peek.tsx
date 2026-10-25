import { LockIcon } from "lucide-react";
import Image from "next/image";
import {
  CELL,
  EASE_COLORS,
  FOCUS_INSET,
  LINE,
  META,
  MONO,
  SOFT,
} from "@/components/landing/home/styles";
import {
  getProPeek,
  PRO_PRICING_URL,
  peekStill,
  proPeekUrl,
} from "@/lib/pro-peeks";
import { cn } from "@/lib/utils";

const PRO_RED = "text-[#FF2D55]";

const ACTION = cn(
  "flex h-10 flex-1 items-center justify-between px-3.5 font-medium text-[13px]",
  CELL,
  EASE_COLORS,
  FOCUS_INSET
);

/**
 * A Pro component on a free docs page: the same plate as a free one, but the
 * install row names the Pro registry, the stage is a still that fades out
 * (the fade is baked into the image, as on kokonutui.pro), and every way
 * forward leads to Pro. Nothing here runs the component.
 */
export function ProPeek({ name }: { name: string }) {
  const peek = getProPeek(name);
  if (!peek) {
    return null;
  }
  const href = proPeekUrl(peek);
  const { still } = peek;

  // Pro teasers stay out of search snippets, so a page is summed up by its
  // own component rather than "Part of Kokonut UI Pro".
  return (
    <div data-nosnippet>
      <figure className={cn("not-prose my-6 w-full border", LINE, CELL)}>
        <a
          className={cn(
            "flex h-10 items-center justify-between gap-4 border-b px-3.5",
            LINE,
            "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
            EASE_COLORS,
            FOCUS_INSET
          )}
          href={href}
          rel="noopener"
          target="_blank"
        >
          <span
            className={cn(
              MONO,
              "truncate text-[12px] text-black/45 dark:text-white/45"
            )}
          >
            npx shadcn@latest add @kokonutui-pro/{peek.name}
          </span>
          <span
            className={cn(
              MONO,
              "inline-flex shrink-0 items-center gap-1.5 text-[11.5px]",
              PRO_RED
            )}
          >
            <LockIcon aria-hidden className="size-3" />
            PRO
          </span>
        </a>

        <div className="p-2 md:p-4">
          <a
            aria-label="See it in Kokonut UI Pro"
            className={cn(
              "group relative block overflow-clip rounded-xl",
              FOCUS_INSET
            )}
            href={href}
            rel="noopener"
            target="_blank"
          >
            <Image
              alt=""
              className="block h-auto w-full dark:hidden"
              height={still.height}
              sizes="(min-width: 1024px) 808px, 100vw"
              src={peekStill(peek.name, "light")}
              unoptimized
              width={still.width}
            />
            <Image
              alt=""
              className="hidden h-auto w-full dark:block"
              height={still.height}
              sizes="(min-width: 1024px) 808px, 100vw"
              src={peekStill(peek.name, "dark")}
              unoptimized
              width={still.width}
            />
            <span
              // Over the fade on wide screens; under the still on phones,
              // where it would cover a small component.
              className="mt-2 flex justify-center md:absolute md:inset-x-0 md:mt-0 md:-translate-y-1/2"
              style={{ top: `${still.pill * 100}%` }}
            >
              <span
                className={cn(
                  MONO,
                  "inline-flex h-7 items-center gap-1.5 rounded-full bg-white px-3 text-[11.5px] text-black/65 ring-1 ring-black/[0.08] group-hover:bg-black group-hover:text-white dark:bg-[#1a1a1a] dark:text-white/65 dark:ring-white/[0.12] dark:group-hover:bg-white dark:group-hover:text-black",
                  EASE_COLORS
                )}
              >
                <LockIcon aria-hidden className="size-3" />
                Unlock with Pro
              </span>
            </span>
          </a>
        </div>

        <div className={cn("border-t", LINE)}>
          <p className={cn(META, "px-3.5 pt-3")}>In Pro</p>
          <ul className="m-0 flex list-none flex-col p-0 px-3.5 pt-1.5 pb-3.5">
            {peek.features.map((line) => (
              <li
                className={cn(
                  "border-b py-2 text-[13.5px] leading-snug last:border-b-0",
                  LINE,
                  SOFT
                )}
                key={line}
              >
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className={cn("flex border-t", LINE)}>
          <a
            className={cn(ACTION, PRO_RED, "hover:bg-[#FF2D55]/[0.06]")}
            href={PRO_PRICING_URL}
            rel="noopener"
            target="_blank"
          >
            Get Kokonut UI Pro
            <span className={cn(MONO, "text-[11px]")}>PRO</span>
          </a>
        </div>
      </figure>
    </div>
  );
}
