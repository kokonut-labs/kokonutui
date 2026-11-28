"use client";

/**
 * @author: @kokonutui
 * @description: AI Upload
 * @version: 1.0.0
 * @date: 2026-11-28
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, Film, ImageIcon, LoaderCircle, X } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type DragEvent, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Where a file is: going up, ready to use, or refused. */
export type UploadStatus = "uploading" | "done" | "error";

export interface UploadItem {
  id: string;
  name: string;
  /** In bytes. */
  size: number;
  status: UploadStatus;
  /** 0 to 1, while uploading. */
  progress: number;
  isVideo: boolean;
  /** Where the file lives once uploaded. */
  url?: string;
  /** A local preview for images, revoked when the row goes. */
  preview?: string;
  error?: string;
}

export interface AIUploadProps {
  /** What the assistant says above the card. */
  message?: string;
  /** Images allowed in one post. A video always goes alone. */
  maxFiles?: number;
  /**
   * Sends one file and resolves with its URL. Call `onProgress` with 0 to 1
   * as it goes. Leave it out and the card fakes the upload, for the demo.
   */
  upload?: (
    file: File,
    onProgress: (progress: number) => void
  ) => Promise<string>;
  /** Called with every uploaded URL when the user hands them to the chat. */
  onUse?: (urls: string[]) => void;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const DEMO_MESSAGE =
  "Drop the photos for the launch post here. I'll attach them once they're up.";

const DEMO_ITEMS: UploadItem[] = [
  {
    id: "demo-1",
    name: "launch-hero.png",
    size: 1_840_000,
    status: "done",
    progress: 1,
    isVideo: false,
    url: "https://example.com/launch-hero.png",
  },
  {
    id: "demo-2",
    name: "editor-dark.png",
    size: 962_000,
    status: "uploading",
    progress: 0.2,
    isVideo: false,
  },
];

const BAR: Record<UploadStatus, string> = {
  uploading: "bg-blue-600 dark:bg-blue-500",
  done: "bg-emerald-500",
  error: "bg-red-500",
};

/** How the fake upload moves: a step of progress every tick. */
const FAKE_TICK_MS = 90;
const FAKE_STEP = 0.07;

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Why a file can't join the ones already here, or null when it can. */
function refuse(
  file: File,
  items: UploadItem[],
  maxFiles: number
): string | null {
  const isVideo = file.type.startsWith("video/");
  if (!(isVideo || file.type.startsWith("image/"))) {
    return `${file.name} isn't a photo or a video.`;
  }
  if (items.some((item) => item.isVideo)) {
    return "A video goes on its own. Remove it to add photos.";
  }
  if (isVideo && items.length > 0) {
    return "A video goes on its own. Remove the photos first.";
  }
  if (items.length >= maxFiles) {
    return `Up to ${maxFiles} photos per post.`;
  }
  return null;
}

/** The files in the card, and the uploads that move them along. */
function useUploads(
  upload: AIUploadProps["upload"],
  maxFiles: number,
  isDemo: boolean
) {
  const [items, setItems] = useState<UploadItem[]>(isDemo ? DEMO_ITEMS : []);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setInterval>>());
  const previews = useRef(new Set<string>());
  const nextId = useRef(0);

  const patch = (id: string, change: Partial<UploadItem>) =>
    setItems((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...change } : row))
    );

  const fake = (id: string) => {
    let progress = 0;
    const timer = setInterval(() => {
      progress = Math.min(1, progress + FAKE_STEP);
      if (progress < 1) {
        patch(id, { progress });
        return;
      }
      clearInterval(timer);
      timers.current.delete(id);
      patch(id, {
        progress: 1,
        status: "done",
        url: `https://example.com/${id}`,
      });
    }, FAKE_TICK_MS);
    timers.current.set(id, timer);
  };

  const send = (id: string, file: File) => {
    if (!upload) {
      fake(id);
      return;
    }
    upload(file, (progress) => patch(id, { progress }))
      .then((url) => patch(id, { status: "done", progress: 1, url }))
      .catch((reason: unknown) =>
        patch(id, {
          status: "error",
          error: reason instanceof Error ? reason.message : "Upload failed.",
        })
      );
  };

  // The demo's second file is mid-upload when the card appears.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on mount only
  useEffect(() => {
    const running = timers.current;
    const urls = previews.current;
    if (isDemo) {
      fake("demo-2");
    }
    return () => {
      for (const timer of running.values()) {
        clearInterval(timer);
      }
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const addFiles = (files: File[]) => {
    setError(null);
    const added: UploadItem[] = [];
    for (const file of files) {
      const reason = refuse(file, [...items, ...added], maxFiles);
      if (reason) {
        setError(reason);
        break;
      }
      const isVideo = file.type.startsWith("video/");
      const preview = isVideo ? undefined : URL.createObjectURL(file);
      if (preview) {
        previews.current.add(preview);
      }
      nextId.current += 1;
      const item: UploadItem = {
        id: `file-${nextId.current}`,
        name: file.name,
        size: file.size,
        status: "uploading",
        progress: 0,
        isVideo,
        preview,
      };
      added.push(item);
      send(item.id, file);
    }
    if (added.length > 0) {
      setItems((rows) => [...rows, ...added]);
    }
  };

  const remove = (id: string) => {
    clearInterval(timers.current.get(id));
    timers.current.delete(id);
    const preview = items.find((item) => item.id === id)?.preview;
    if (preview) {
      URL.revokeObjectURL(preview);
      previews.current.delete(preview);
    }
    setError(null);
    setItems((rows) => rows.filter((row) => row.id !== id));
  };

  return { items, error, addFiles, remove };
}

export default function AIUpload({
  message,
  maxFiles = 4,
  upload,
  onUse,
  className,
}: AIUploadProps) {
  const isDemo = upload === undefined;
  const uploads = useUploads(upload, maxFiles, isDemo);
  const [sent, setSent] = useState(false);

  const urls = uploads.items.flatMap((item) =>
    item.status === "done" && item.url ? [item.url] : []
  );
  const isUploading = uploads.items.some((item) => item.status === "uploading");
  const isFull =
    uploads.items.some((item) => item.isVideo) ||
    uploads.items.length >= maxFiles;
  const shownMessage = message ?? (isDemo ? DEMO_MESSAGE : undefined);

  const use = () => {
    onUse?.(urls);
    setSent(true);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("flex w-full max-w-md flex-col gap-4", className)}>
        {shownMessage ? (
          <p className="text-pretty text-[15px] text-zinc-800 leading-7 dark:text-zinc-200">
            {shownMessage}
          </p>
        ) : null}

        <div className="rounded-[22px] bg-black/[0.04] p-1 dark:bg-white/[0.06]">
          <div className="flex h-8 items-center justify-between gap-3 px-3 text-[12px] text-zinc-500 dark:text-zinc-400">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Media
            </span>
            <span className="tabular-nums">
              {countLabel(uploads.items, maxFiles)}
            </span>
          </div>

          <div className="flex flex-col gap-3 rounded-[18px] bg-white p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-black/[0.06] dark:bg-zinc-900 dark:ring-white/[0.08]">
            <DropZone
              disabled={sent || isFull}
              maxFiles={maxFiles}
              onFiles={uploads.addFiles}
            />

            <AnimatePresence initial={false}>
              {uploads.error ? (
                <motion.p
                  animate={{ opacity: 1, height: "auto" }}
                  className="overflow-hidden px-1 text-[12.5px] text-red-600 dark:text-red-400"
                  exit={{ opacity: 0, height: 0 }}
                  initial={{ opacity: 0, height: 0 }}
                  role="alert"
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                >
                  {uploads.error}
                </motion.p>
              ) : null}
            </AnimatePresence>

            {uploads.items.length > 0 ? (
              <ul className="flex flex-col">
                <AnimatePresence initial={false}>
                  {uploads.items.map((item) => (
                    <UploadRow
                      canRemove={!sent}
                      item={item}
                      key={item.id}
                      onRemove={() => uploads.remove(item.id)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            ) : null}

            <div className="flex items-center gap-3 border-black/[0.06] border-t pt-3 dark:border-white/[0.08]">
              <p className="min-w-0 flex-1 text-[12px] text-zinc-500 dark:text-zinc-400">
                {sent
                  ? "Sent to the chat."
                  : "Nothing is posted until you confirm in the chat."}
              </p>
              <button
                className="h-8 shrink-0 rounded-full bg-blue-600 px-3.5 font-medium text-[12.5px] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(29_78_216/0.35)] outline-hidden transition-[background-color,opacity] duration-150 hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 active:bg-blue-800 disabled:pointer-events-none disabled:opacity-50 dark:bg-blue-500 dark:active:bg-blue-700 dark:focus-visible:ring-offset-zinc-900 dark:hover:bg-blue-600"
                disabled={sent || isUploading || urls.length === 0}
                onClick={use}
                type="button"
              >
                {buttonLabel(sent, isUploading)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}

function countLabel(items: UploadItem[], maxFiles: number) {
  return items.some((item) => item.isVideo)
    ? "1 video"
    : `${items.length} of ${maxFiles}`;
}

function buttonLabel(sent: boolean, isUploading: boolean) {
  if (sent) {
    return "Sent";
  }
  return isUploading ? "Uploading…" : "Use these files";
}

/**
 * A label around a hidden file input: a click opens the picker, and keyboard
 * users get the input's own focus.
 */
function DropZone({
  disabled,
  maxFiles,
  onFiles,
}: {
  disabled: boolean;
  maxFiles: number;
  onFiles: (files: File[]) => void;
}) {
  const [isOver, setIsOver] = useState(false);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setIsOver(false);
    if (!disabled) {
      onFiles(Array.from(event.dataTransfer.files));
    }
  };

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: the drag handlers only add a drop target; the file input inside is the keyboard path.
    <label
      className={cn(
        "flex cursor-pointer flex-col items-center gap-0.5 rounded-xl border border-zinc-300 border-dashed px-4 py-5 text-center text-[13px] transition-[border-color,background-color,opacity] duration-150 ease-out has-focus-visible:border-blue-500 dark:border-zinc-700",
        isOver && "border-blue-500 bg-blue-500/[0.05] dark:border-blue-400",
        disabled && "pointer-events-none opacity-50"
      )}
      onDragLeave={() => setIsOver(false)}
      onDragOver={(event) => {
        event.preventDefault();
        setIsOver(true);
      }}
      onDrop={onDrop}
    >
      <span className="text-zinc-500 dark:text-zinc-400">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          Drop photos or a video
        </span>{" "}
        or click to choose
      </span>
      <span className="text-[12px] text-zinc-500 dark:text-zinc-400">
        Up to {maxFiles} images, or 1 video
      </span>
      <input
        accept="image/*,video/*"
        className="sr-only"
        disabled={disabled}
        multiple
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
        type="file"
      />
    </label>
  );
}

/** One file: a thumbnail, its name, then progress or size. */
function UploadRow({
  item,
  canRemove,
  onRemove,
}: {
  item: UploadItem;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const Kind = item.isVideo ? Film : ImageIcon;
  return (
    <motion.li
      animate={{ opacity: 1, height: "auto" }}
      className="overflow-hidden"
      exit={{ opacity: 0, height: 0 }}
      initial={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: EASE_OUT }}
    >
      <div className="flex items-center gap-3 py-1.5">
        <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 text-zinc-400 ring-1 ring-black/[0.06] dark:bg-zinc-800 dark:text-zinc-500 dark:ring-white/[0.08]">
          {item.preview ? (
            // biome-ignore lint/performance/noImgElement: a local blob preview, no image host to optimize.
            <img
              alt=""
              className="size-full object-cover"
              draggable={false}
              height={36}
              src={item.preview}
              width={36}
            />
          ) : (
            <Kind aria-hidden="true" className="size-4" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-[13px] text-zinc-900 leading-5 dark:text-zinc-100">
            {item.name}
          </span>
          <span className="relative mt-1 block h-[3px] overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <span
              className={cn(
                "absolute inset-0 origin-left rounded-full transition-[scale,background-color] duration-150 ease-out",
                BAR[item.status]
              )}
              style={{
                scale: `${item.status === "error" ? 1 : item.progress} 1`,
              }}
            />
          </span>
        </span>
        <span className="flex h-5 w-16 shrink-0 items-center justify-end gap-1 text-[12px] text-zinc-500 tabular-nums dark:text-zinc-400">
          <RowStatus item={item} />
        </span>
        {canRemove && item.status !== "uploading" ? (
          <button
            aria-label={`Remove ${item.name}`}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-zinc-400 outline-hidden transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            onClick={onRemove}
            type="button"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}
      </div>
      {item.error ? (
        <p className="pb-1.5 pl-12 text-[12px] text-red-600 leading-snug dark:text-red-400">
          {item.error}
        </p>
      ) : null}
    </motion.li>
  );
}

function RowStatus({ item }: { item: UploadItem }) {
  if (item.status === "uploading") {
    return (
      <>
        <LoaderCircle
          aria-hidden="true"
          className="size-3 animate-spin motion-reduce:animate-none"
        />
        {Math.round(item.progress * 100)}%
      </>
    );
  }
  if (item.status === "error") {
    return <span className="text-red-600 dark:text-red-400">Failed</span>;
  }
  return (
    <>
      <Check
        aria-hidden="true"
        className="size-3 text-emerald-600 dark:text-emerald-400"
        strokeWidth={2.5}
      />
      {formatSize(item.size)}
    </>
  );
}
