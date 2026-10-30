import { type ReactNode, Suspense } from "react";
import Loader from "@/components/kokonutui/loader";
import { CELL, LINE, META } from "@/components/landing/home/styles";
import { HauntedNote, HauntedSurface } from "@/components/mdx/haunted";
import { cn } from "@/lib/utils";
import { InstallBar } from "./install-bar";

/** What the page knows about the part it documents, from the catalog. */
export interface PreviewPart {
  dependencies: string[];
  /** The component's source, so Copy code needs no round trip. */
  source?: string;
}

export interface PreviewProps {
  children: ReactNode;
  className?: string;
  isPremium?: boolean;
  link: string;
  useIframe?: boolean;
  height?: string;
  compact?: boolean;
  /** Superseded by the registry's own dependency list; kept so MDX still parses. */
  comment?: string[];
  isBlock?: boolean;
  /** Filled in by the docs page from the registry entry. */
  part?: PreviewPart;
  /** Controls for the demo's head row, such as Replay. */
  actions?: ReactNode;
}

const PRE_PATH = "@kokonutui";

/**
 * A component page's plate, drawn like the homepage's: one hairline frame
 * with the install row on top, then the packages it brings, then the live
 * demo.
 */
export function Preview({
  children,
  className,
  link,
  useIframe = false,
  compact = false,
  isBlock = false,
  part,
  actions,
}: PreviewProps) {
  const name = link.split("/").at(-1) ?? link;
  let spec: string | undefined;
  if (part) {
    spec = part.dependencies.length
      ? part.dependencies.join(", ")
      : "no extra packages";
  }

  return (
    <figure
      className={cn("not-prose my-6 w-full border", LINE, CELL, className)}
    >
      <InstallBar
        name={name}
        prePath={PRE_PATH}
        showSource={!isBlock}
        source={part?.source}
      />
      {spec || actions ? (
        <div className="flex items-baseline justify-between gap-4 px-4 pt-3.5">
          <span className={cn(META, "truncate")}>{spec}</span>
          {actions}
        </div>
      ) : null}
      {useIframe ? (
        <div className="relative h-[100dvh] w-full overflow-hidden">
          <iframe
            className="h-full w-full border-0"
            src={`${PRE_PATH}/preview/${link}`}
            title={link}
          />
        </div>
      ) : (
        <div
          className={cn(
            // `preview-surface` is the hook `globals.css` uses to let the
            // preview fill the page on `full: true` docs pages.
            "preview-surface relative flex items-center justify-center p-2 md:p-8",
            compact ? "preview-surface-compact min-h-[100px]" : "min-h-[400px]",
            isBlock && "md:p-0"
          )}
        >
          <Suspense fallback={<Loader />}>{children}</Suspense>
          <HauntedSurface name={name} />
        </div>
      )}
      <HauntedNote name={name} />
    </figure>
  );
}
