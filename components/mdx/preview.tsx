import { Suspense } from "react";
import { cn } from "@/lib/utils";
import Loader from "../kokonutui/loader";
import { InstallCommand } from "./package-manager-tabs";
import PreviewActions from "./preview-content";

interface PreviewProps {
  children: React.ReactNode;
  className?: string;
  isPremium?: boolean;
  link: string;
  useIframe?: boolean;
  height?: string;
  compact?: boolean;
  comment?: string[];
  isBlock?: boolean;
  /** Overlay pinned to the preview's top-right corner (e.g. a refresh button). */
  action?: React.ReactNode;
}

const PRE_PATH = "@kokonutui";

function getComponentName(link: string) {
  const [folder, filename] = link.split("/");
  return filename ? filename : folder;
}

export function Preview({
  children,
  className = "",
  link,
  useIframe = false,
  compact = false,
  comment = [],
  isBlock = false,
  action,
}: PreviewProps) {
  return (
    // Desktop reads top to bottom: install command, demo, then the actions.
    // On mobile the demo comes first so it is visible without scrolling.
    <div className={cn("my-4 flex w-full flex-col gap-3", className)}>
      <InstallCommand
        className="order-3 md:order-1"
        componentName={getComponentName(link)}
        prePath={PRE_PATH}
      />

      {useIframe ? (
        <div className="order-1 w-full rounded-lg border border-zinc-200 md:order-2 dark:border-zinc-800">
          <div className="relative h-[100dvh] w-full overflow-hidden">
            <iframe
              className="h-full w-full list-none overflow-y-auto"
              src={`${PRE_PATH}/preview/${link}`}
              style={{
                border: "none",
                transform: "scale(0.95)",
              }}
              title={link}
            />
          </div>
        </div>
      ) : (
        <div
          className={cn(
            // `preview-surface` is the hook `globals.css` uses to let the
            // preview fill the page on `full: true` docs pages.
            "preview-surface not-prose relative order-1 flex items-center justify-center overflow-hidden rounded-lg border border-zinc-200 p-2 md:order-2 md:p-8 dark:border-zinc-800",
            compact ? "preview-surface-compact min-h-[100px]" : "min-h-[400px]",
            isBlock ? "md:p-0" : ""
          )}
        >
          {action ? (
            <div className="absolute top-2 right-2 z-10">{action}</div>
          ) : null}
          <Suspense fallback={<Loader />}>{children}</Suspense>
        </div>
      )}
      <div className="order-2 flex flex-wrap items-center justify-between gap-2 md:order-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {comment.map((text) => (
            <span
              className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 font-medium text-[11px] text-purple-700 dark:border-purple-800/50 dark:bg-purple-950/30 dark:text-purple-300"
              key={text}
            >
              {text}
            </span>
          ))}
        </div>
        <PreviewActions isBlock={isBlock} link={link} />
      </div>
    </div>
  );
}
