import Image from "next/image";
import { INK, LINE, MONO, SOFT } from "@/components/landing/home/styles";
import { type UsedInApp, usedInUrl } from "@/lib/used-in";
import { cn } from "@/lib/utils";

/** The app's own blue, a shade deeper on white so the small tag reads. */
const TAG = "text-[#1A73B5] dark:text-[#3BA6F1]";

/**
 * One line under a component's demo when a real app ships it. The link
 * stays at the sentence's weight; hovering or focusing it opens a small card
 * with the app's share image and one line on what it is. Plain CSS, so the
 * line costs the page no JavaScript.
 */
export function UsedIn({ app, slug }: { app: UsedInApp; slug: string }) {
  return (
    <p
      className={cn(
        "not-prose my-6 flex items-baseline gap-3 border-y py-3 text-[14px] leading-snug",
        LINE,
        SOFT
      )}
      data-nosnippet
    >
      <span className={cn(MONO, "shrink-0 font-medium text-[12px]", TAG)}>
        IN USE
      </span>
      <span className="min-w-0 flex-1">
        This component is used in{" "}
        <span className="group/used relative inline-block">
          <a
            className="rounded-sm underline decoration-black/30 underline-offset-[3px] outline-none transition-[text-decoration-color] duration-150 ease-out hover:decoration-black/60 focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2 dark:decoration-white/30 dark:focus-visible:ring-white/35 dark:hover:decoration-white/60"
            href={usedInUrl(app, slug)}
            rel="noopener"
            target="_blank"
          >
            {app.name}
          </a>
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none invisible absolute top-[calc(100%+10px)] left-[-8px] z-20 block w-72 rounded-[14px] border bg-white p-2 opacity-0 shadow-[0_6px_16px_rgb(0_0_0/0.06)] max-sm:hidden dark:bg-zinc-950 dark:shadow-none",
              "translate-y-[-2px] motion-safe:transition-[opacity,translate,visibility] motion-safe:duration-150 motion-safe:ease-out",
              "group-focus-within/used:visible group-focus-within/used:translate-y-0 group-focus-within/used:opacity-100 group-hover/used:visible group-hover/used:translate-y-0 group-hover/used:opacity-100",
              LINE
            )}
          >
            <Image
              alt=""
              className="block aspect-[560/294] w-full rounded-lg border border-black/[0.08] dark:border-white/[0.08]"
              height={294}
              src={app.image}
              width={560}
            />
            <span className="flex items-center gap-1.5 px-1 pt-2.5 pb-0.5">
              <Image
                alt=""
                className="size-3.5"
                height={14}
                src={app.icon}
                width={14}
              />
              <span className={cn("font-medium text-[13px]", INK)}>
                {app.name}
              </span>
              <span
                className={cn(
                  MONO,
                  "ml-auto text-[11px] text-black/45 dark:text-white/45"
                )}
              >
                {app.domain}
              </span>
            </span>
            <span className="block px-1 pt-0.5 pb-1 text-[12.5px] leading-[1.45]">
              {app.pitch}
            </span>
          </span>
        </span>
        .
      </span>
    </p>
  );
}
