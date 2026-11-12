import Link from "next/link";
import { cn } from "@/lib/utils";
import { CheckoutIcon } from "../icons/checkout";
import { ScreenOutlineIcon } from "../icons/screen-outline";

interface PreviewTemplateProps {
  previewLink: string;
  buyLink: string;
  videoUrl: string;
  className?: string;
}

export default function PreviewTemplate({
  previewLink,
  buyLink = "https://kokonutui.pro/",
  videoUrl,
  className,
}: PreviewTemplateProps) {
  return (
    <div className={cn("flex flex-col space-y-1", className)}>
      <div className="flex items-center gap-4">
        <Link
          className="group not-prose relative hidden items-center gap-2 rounded-lg border bg-zinc-900 px-2 py-1.5 text-sm text-white transition-colors hover:bg-zinc-700 md:inline-flex dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          href={previewLink}
          rel="noopener"
          target="_blank"
        >
          Live Preview
          <ScreenOutlineIcon className="h-4 w-4" />
        </Link>
        <Link
          className="group not-prose relative hidden items-center gap-2 rounded-lg border border-orange-500 px-2 py-1.5 text-orange-500 text-sm transition-colors hover:bg-orange-100 md:inline-flex dark:border-orange-400 dark:text-orange-400 dark:hover:bg-orange-950"
          href={buyLink}
          rel="noopener"
          target="_blank"
        >
          Buy Now
          <CheckoutIcon className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-0 flex flex-col">
        <video
          aria-label="Preview Video"
          autoPlay
          className="w-full max-w-4xl rounded-lg border border-zinc-400 p-0.5 shadow-sm dark:border-zinc-800"
          loop
          muted
          playsInline
        >
          <source src={videoUrl} type="video/mp4" />
        </video>
      </div>
    </div>
  );
}
