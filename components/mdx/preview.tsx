import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { component as registryComponents } from "@/registry/registry-components";
import Loader from "../kokonutui/loader";
import { PreviewToolbar } from "./toolbar";

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

const SITE_ORIGIN = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : `https://${process.env.NEXT_PUBLIC_SITE_URL ?? "kokonutui.com"}`;

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
  const name = getComponentName(link);
  const entry = registryComponents.find((item) => item.name === name);

  return (
    // One card: the toolbar (install, requirements, actions) always sits
    // above the demo, on every screen size, so everything is in reach first.
    <div
      className={cn(
        "not-prose my-6 w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800",
        className
      )}
    >
      <PreviewToolbar
        badges={comment}
        dependencies={entry?.dependencies ?? []}
        fileCount={entry?.files?.length ?? 1}
        isBlock={isBlock}
        link={link}
        name={name}
        registryDependencies={entry?.registryDependencies ?? []}
        target={`${PRE_PATH}/${name}`}
        v0Href={`https://v0.dev/chat/api/open?url=${SITE_ORIGIN}/r/${name}.json`}
      />

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
