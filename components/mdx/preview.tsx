import { Suspense } from "react";
import { cn } from "@/lib/utils";
import Loader from "../kokonutui/loader";
import PreviewContent from "./preview-content";

type PreviewProps = {
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
};

const PRE_PATH = "@kokonutui";

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
    // On mobile the demo comes first and the install bar follows it, so the
    // component is visible without scrolling; from `md` up the bar leads.
    <div className={cn("flex w-full flex-col overflow-hidden", className)}>
      <div className="order-2 md:order-1">
        <PreviewContent isBlock={isBlock} link={link} prePath={PRE_PATH} />
      </div>

      {useIframe ? (
        <div className="order-1 my-4 w-full rounded-md border border-zinc-200 md:order-2 dark:border-zinc-800">
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
            "preview-surface not-prose relative order-1 my-4 flex items-center justify-center rounded-md border border-zinc-200 p-2 md:order-2 md:p-8 dark:border-zinc-800",
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
      {comment.length > 0 && (
        <div className="order-3 mt-2 mb-4 flex flex-wrap gap-3">
          {comment.map((text) => (
            <div
              className="rounded-md border border-purple-200 bg-purple-100 px-4 py-2 font-medium text-purple-700 text-sm shadow-xs transition-colors hover:bg-purple-200/70 dark:border-purple-800/50 dark:bg-purple-950/30 dark:text-purple-300 dark:hover:bg-purple-950/50"
              key={text}
            >
              {text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
