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
    // One card: the toolbar (install command, badges, actions) always sits
    // above the demo, on every screen size, so everything is in reach first.
    <div
      className={cn(
        "not-prose my-6 w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800",
        className
      )}
    >
      <div className="flex flex-col gap-2 border-zinc-200 border-b bg-zinc-50/80 p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
        <InstallCommand
          componentName={getComponentName(link)}
          prePath={PRE_PATH}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 pl-1">
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

      {useIframe ? (
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
      ) : (
        <div
          className={cn(
            // `preview-surface` is the hook `globals.css` uses to let the
            // preview fill the page on `full: true` docs pages.
            "preview-surface relative flex items-center justify-center overflow-hidden p-2 md:p-8",
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
    </div>
  );
}
