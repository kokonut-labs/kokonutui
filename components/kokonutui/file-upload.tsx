"use client";

/**
 * @author: @dorianbaffier
 * @description: File Upload
 * @version: 2.0.0
 * @date: 2026-10-16
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { RotateCw, Upload, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface FileError {
  message: string;
  code: string;
}

export interface UploadHelpers {
  /** Report upload progress from 0 to 100. */
  onProgress: (percent: number) => void;
  /** Aborted when the row is removed or the component unmounts. */
  signal: AbortSignal;
}

export interface FileUploadProps {
  /**
   * Uploads one file. Called once per file, a few at a time. Resolve to mark
   * the row done, reject to show the error with a Retry button. When omitted,
   * uploads are simulated over `uploadDelay`.
   */
  onUpload?: (file: File, helpers: UploadHelpers) => Promise<void>;
  onUploadSuccess?: (file: File) => void;
  /** Called for validation errors and failed uploads. */
  onUploadError?: (error: FileError, file: File) => void;
  /** Called with every uploaded file once nothing is queued or in flight. */
  onComplete?: (files: File[]) => void;
  /** Called when a row is removed (cancelling its upload if needed). */
  onFileRemove?: (file: File) => void;
  /** MIME types ("image/png"), wildcards ("image/*") or extensions (".pdf"). */
  acceptedFileTypes?: string[];
  /** Maximum size of each file in bytes. Defaults to 5 MB. */
  maxFileSize?: number;
  /** Accept several files at once. Defaults to true. */
  multiple?: boolean;
  /** Maximum number of files in the list. Defaults to 5. */
  maxFiles?: number;
  /** Simulated upload duration per file in ms, used without `onUpload`. */
  uploadDelay?: number;
  /** Simulated uploads only: the first attempt of every third file fails. */
  simulateFailure?: boolean;
  validateFile?: (file: File) => FileError | null;
  className?: string;
}

type ItemStatus = "queued" | "uploading" | "done" | "error" | "rejected";

interface QueueItem {
  id: string;
  file: File;
  index: number;
  status: ItemStatus;
  progress: number;
  attempts: number;
  error?: FileError;
  previewUrl?: string;
}

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;
const CONCURRENCY = 3;
const SIMULATED_TICK = 80;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const FILE_SIZES = ["B", "KB", "MB", "GB", "TB"] as const;
// Module constant, so the default does not change identity every render.
const NO_ACCEPTED_TYPES: string[] = [];

const formatBytes = (bytes: number): string => {
  if (!bytes) {
    return "0 B";
  }
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    FILE_SIZES.length - 1
  );
  const value = bytes / 1024 ** i;
  return `${value >= 10 || i === 0 ? Math.round(value) : Number(value.toFixed(1))} ${FILE_SIZES[i]}`;
};

// Accepts exact MIME types ("image/png"), wildcards ("image/*") and
// extensions (".pdf"), like the input's `accept` attribute.
const matchesAcceptedType = (file: File, acceptedType: string): boolean => {
  const accepted = acceptedType.trim().toLowerCase();
  if (!accepted) {
    return false;
  }
  if (accepted.startsWith(".")) {
    return file.name.toLowerCase().endsWith(accepted);
  }
  const fileType = file.type.toLowerCase();
  if (accepted.endsWith("/*")) {
    return fileType.startsWith(accepted.slice(0, -1));
  }
  return fileType === accepted;
};

// ".pdf" -> "PDF", "image/svg+xml" -> "SVG", "image/*" -> "images".
const describeAcceptedType = (acceptedType: string): string => {
  const accepted = acceptedType.trim();
  if (accepted.startsWith(".")) {
    return accepted.slice(1).toUpperCase();
  }
  const [kind = "", subtype = ""] = accepted.split("/");
  if (subtype === "*") {
    return `${kind.toLowerCase()}s`;
  }
  return subtype.split("+")[0].toUpperCase();
};

const describeAcceptedTypes = (acceptedTypes: string[]): string => {
  const labels = acceptedTypes.map(describeAcceptedType).filter(Boolean);
  if (!labels.length) {
    return "Any file";
  }
  const text =
    labels.length > 1
      ? `${labels.slice(0, -1).join(", ")} or ${labels.at(-1)}`
      : labels[0];
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) {
    return "FILE";
  }
  return name
    .slice(dot + 1)
    .slice(0, 4)
    .toUpperCase();
};

const clampProgress = (value: number) => Math.min(Math.max(value, 0), 100);

const isFileDrag = (e: { dataTransfer: DataTransfer | null }) =>
  Boolean(e.dataTransfer?.types.includes("Files"));

const countDraggedFiles = (dataTransfer: DataTransfer): number => {
  let count = 0;
  for (const item of dataTransfer.items) {
    if (item.kind === "file") {
      count += 1;
    }
  }
  return count;
};

// Default upload: advances in uneven steps, like a real network would.
const simulateUpload = (
  { onProgress, signal }: UploadHelpers,
  duration: number,
  shouldFail: boolean
): Promise<void> =>
  new Promise((resolve, reject) => {
    if (duration <= 0) {
      resolve();
      return;
    }
    let progress = 0;
    const interval = setInterval(() => {
      progress = Math.min(
        progress +
          (100 * SIMULATED_TICK * (0.4 + Math.random() * 1.2)) / duration,
        100
      );
      if (shouldFail && progress >= 58) {
        clearInterval(interval);
        reject(new Error("Connection lost"));
        return;
      }
      onProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        resolve();
      }
    }, SIMULATED_TICK);
    signal.addEventListener("abort", () => {
      clearInterval(interval);
      reject(new DOMException("Upload cancelled", "AbortError"));
    });
  });

const buildItems = (
  files: File[],
  {
    room,
    validate,
    nextId,
  }: {
    room: number;
    validate: (file: File) => FileError | null;
    nextId: () => { id: string; index: number };
  }
) => {
  const added: QueueItem[] = [];
  let accepted = 0;
  let skipped = 0;
  for (const file of files) {
    const error = validate(file) ?? undefined;
    if (!error && accepted >= room) {
      skipped += 1;
      continue;
    }
    if (!error) {
      accepted += 1;
    }
    const { id, index } = nextId();
    added.push({
      id,
      file,
      index,
      status: error ? "rejected" : "queued",
      progress: 0,
      attempts: 0,
      error,
      previewUrl:
        !error && file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
    });
  }
  return { added, skipped };
};

const summarize = (items: QueueItem[]) => {
  let done = 0;
  let failed = 0;
  let busy = false;
  for (const item of items) {
    if (item.status === "done") {
      done += 1;
    } else if (item.status === "error" || item.status === "rejected") {
      failed += 1;
    } else {
      busy = true;
    }
  }
  return { done, failed, busy };
};

const zoneCopy = ({
  isFull,
  overZone,
  windowDrag,
  multiple,
  limit,
  maxFileSize,
  acceptedFileTypes,
}: {
  isFull: boolean;
  overZone: number;
  windowDrag: boolean;
  multiple: boolean;
  limit: number;
  maxFileSize: number;
  acceptedFileTypes: string[];
}) => {
  const noun = multiple ? "files" : "a file";
  if (isFull) {
    return {
      title: "File limit reached",
      showBrowse: false,
      hint: "Remove a file to add another",
    };
  }
  const sizeHint =
    maxFileSize > 0 && Number.isFinite(maxFileSize)
      ? ` up to ${formatBytes(maxFileSize)}`
      : "";
  const hint = `${describeAcceptedTypes(acceptedFileTypes)}${sizeHint}${multiple ? ` · ${limit} max` : ""}`;
  if (overZone) {
    return {
      title: `Release to add ${overZone} ${overZone === 1 ? "file" : "files"}`,
      showBrowse: false,
      hint,
    };
  }
  if (windowDrag) {
    return { title: `Drop ${noun} here`, showBrowse: false, hint };
  }
  return { title: `Drop ${noun} here or `, showBrowse: true, hint };
};

const FileThumb = ({ item }: { item: QueueItem }) => {
  if (item.previewUrl) {
    return (
      <span
        aria-hidden="true"
        className="size-9 shrink-0 rounded-md bg-center bg-cover bg-zinc-100 ring-1 ring-black/5 ring-inset dark:bg-zinc-800 dark:ring-white/10"
        style={{ backgroundImage: `url("${item.previewUrl}")` }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 font-medium font-mono text-[9px] text-zinc-500 tracking-wide dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
    >
      {extensionOf(item.file.name)}
    </span>
  );
};

const DoneCheck = ({ reduceMotion }: { reduceMotion: boolean | null }) => (
  <svg
    aria-hidden="true"
    className="size-4 text-emerald-600 dark:text-emerald-400"
    fill="none"
    viewBox="0 0 16 16"
  >
    <motion.path
      animate={{ pathLength: 1 }}
      d="M3.5 8.5 6.5 11.5 12.5 4.5"
      initial={{ pathLength: reduceMotion ? 1 : 0 }}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      transition={{ duration: 0.32, ease: EASE_OUT, delay: 0.05 }}
    />
  </svg>
);

const statusLine = (item: QueueItem): string => {
  switch (item.status) {
    case "queued":
      return "Waiting";
    case "uploading":
      return `${Math.round(item.progress)}%`;
    case "done":
      return "Uploaded";
    case "error":
    case "rejected":
      return item.error?.message ?? "Upload failed";
    default:
      return "";
  }
};

const iconButton =
  "flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-400 outline-none transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900/20 active:bg-zinc-200 dark:text-zinc-500 dark:active:bg-zinc-700 dark:focus-visible:ring-white/25 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

const QueueRow = ({
  item,
  reduceMotion,
  onRemove,
  onRetry,
}: {
  item: QueueItem;
  reduceMotion: boolean | null;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}) => {
  const failed = item.status === "error" || item.status === "rejected";
  const inFlight = item.status === "uploading" || item.status === "queued";
  const name = item.file.name;

  return (
    <motion.li
      animate={{ height: "auto", opacity: 1 }}
      className="overflow-hidden"
      exit={{
        height: 0,
        opacity: 0,
        transition: {
          height: { duration: reduceMotion ? 0 : 0.2, ease: EASE_OUT },
          opacity: { duration: 0.12, ease: EASE_OUT },
        },
      }}
      initial={{ height: 0, opacity: 0 }}
      transition={{
        height: reduceMotion
          ? { duration: 0 }
          : { type: "spring", duration: 0.35, bounce: 0 },
        opacity: {
          duration: 0.2,
          ease: EASE_OUT,
          delay: reduceMotion ? 0 : 0.05,
        },
      }}
    >
      <div className="group/row relative flex items-center gap-3 px-1 py-2.5">
        <FileThumb item={item} />

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-[13px] text-zinc-900 leading-5 dark:text-zinc-100">
            {name}
          </p>
          <p
            className={cn(
              "truncate text-xs tabular-nums leading-4",
              failed
                ? "text-red-600 dark:text-red-400"
                : "text-zinc-500 dark:text-zinc-400"
            )}
          >
            <span className="text-zinc-500 dark:text-zinc-400">
              {formatBytes(item.file.size)}
            </span>
            <span
              aria-hidden="true"
              className="px-1 text-zinc-300 dark:text-zinc-600"
            >
              ·
            </span>
            {statusLine(item)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {item.status === "done" && (
            <span className="flex size-7 items-center justify-center">
              <DoneCheck reduceMotion={reduceMotion} />
            </span>
          )}
          {item.status === "error" && (
            <button
              aria-label={`Retry ${name}`}
              className={cn(iconButton, "w-auto gap-1 px-2 text-xs")}
              onClick={() => onRetry(item.id)}
              type="button"
            >
              <RotateCw aria-hidden="true" className="size-3" />
              Retry
            </button>
          )}
          <button
            aria-label={inFlight ? `Cancel ${name}` : `Remove ${name}`}
            className={iconButton}
            onClick={() => onRemove(item.id)}
            type="button"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        </div>

        {/* The row's hairline divider doubles as its progress bar. */}
        <div className="absolute inset-x-1 bottom-0 h-px bg-zinc-100 dark:bg-zinc-800/80">
          <div
            aria-label={`Uploading ${name}`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(item.progress)}
            className={cn(
              "h-full origin-left transition-[transform,opacity,background-color] duration-200 ease-linear",
              // A retry starts from zero at once instead of rewinding.
              item.progress === 0 && "transition-none",
              item.status === "done" &&
                "bg-emerald-500 opacity-0 delay-300 duration-300 ease-out dark:bg-emerald-400",
              failed && "bg-red-500 dark:bg-red-400",
              inFlight && "bg-zinc-900 dark:bg-zinc-100"
            )}
            role="progressbar"
            style={{ transform: `scaleX(${item.progress / 100})` }}
          />
        </div>
      </div>
    </motion.li>
  );
};

export default function FileUpload({
  onUpload,
  onUploadSuccess,
  onUploadError,
  onComplete,
  onFileRemove,
  acceptedFileTypes = NO_ACCEPTED_TYPES,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  multiple = true,
  maxFiles = 5,
  uploadDelay = 2000,
  simulateFailure = false,
  validateFile,
  className,
}: FileUploadProps) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [windowDrag, setWindowDrag] = useState(false);
  const [overZone, setOverZone] = useState(0);
  const reduceMotion = useReducedMotion();
  const baseId = useId();
  const hintId = `${baseId}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const nextIndex = useRef(0);
  const controllers = useRef(new Map<string, AbortController>());
  const previewUrls = useRef(new Map<string, string>());
  const wasBusy = useRef(false);

  // Latest callbacks, read from async upload code without re-running effects.
  const latest = useRef({
    onUpload,
    onUploadSuccess,
    onUploadError,
    onComplete,
    uploadDelay,
    simulateFailure,
  });
  useEffect(() => {
    latest.current = {
      onUpload,
      onUploadSuccess,
      onUploadError,
      onComplete,
      uploadDelay,
      simulateFailure,
    };
  });

  const limit = multiple ? Math.max(1, maxFiles) : 1;
  const counted = items.filter((item) => item.status !== "rejected").length;
  const isFull = counted >= limit;

  const updateItem = useCallback(
    (id: string, patch: Partial<QueueItem>) =>
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
      ),
    []
  );

  const runUpload = useCallback(
    (item: QueueItem) => {
      const controller = new AbortController();
      controllers.current.set(item.id, controller);
      const { signal } = controller;
      const cb = latest.current;

      const onProgress = (percent: number) => {
        if (!signal.aborted) {
          updateItem(item.id, { progress: clampProgress(percent) });
        }
      };
      const succeed = () => {
        if (signal.aborted) {
          return;
        }
        controllers.current.delete(item.id);
        updateItem(item.id, { status: "done", progress: 100 });
        latest.current.onUploadSuccess?.(item.file);
      };
      const fail = (reason: unknown) => {
        if (signal.aborted) {
          return;
        }
        controllers.current.delete(item.id);
        const error = {
          message:
            reason instanceof Error && reason.message
              ? reason.message
              : "Upload failed",
          code: "UPLOAD_FAILED",
        };
        updateItem(item.id, { status: "error", error });
        latest.current.onUploadError?.(error, item.file);
      };

      if (cb.onUpload) {
        const upload = cb.onUpload;
        Promise.resolve()
          .then(() => upload(item.file, { onProgress, signal }))
          .then(succeed, fail);
        return;
      }
      const shouldFail =
        cb.simulateFailure && item.attempts === 1 && item.index % 3 === 1;
      simulateUpload({ onProgress, signal }, cb.uploadDelay, shouldFail).then(
        succeed,
        fail
      );
    },
    [updateItem]
  );

  // Scheduler: keep up to CONCURRENCY uploads in flight.
  useEffect(() => {
    const active = items.filter((item) => item.status === "uploading").length;
    const toStart = items
      .filter((item) => item.status === "queued")
      .slice(0, Math.max(0, CONCURRENCY - active))
      .filter((item) => !controllers.current.has(item.id))
      .map((item) => ({ ...item, attempts: item.attempts + 1 }));
    if (!toStart.length) {
      return;
    }
    const started = new Map(toStart.map((item) => [item.id, item]));
    setItems((prev) =>
      prev.map((item) => {
        const next = started.get(item.id);
        return next ? { ...next, status: "uploading", progress: 0 } : item;
      })
    );
    for (const item of toStart) {
      runUpload(item);
    }
  }, [items, runUpload]);

  // Settle: report once nothing is queued or in flight.
  useEffect(() => {
    const busy = items.some(
      (item) => item.status === "queued" || item.status === "uploading"
    );
    if (wasBusy.current && !busy) {
      latest.current.onComplete?.(
        items.filter((item) => item.status === "done").map((item) => item.file)
      );
    }
    wasBusy.current = busy;
  }, [items]);

  // Abort uploads and free previews on unmount.
  useEffect(() => {
    const ctrl = controllers.current;
    const urls = previewUrls.current;
    return () => {
      for (const controller of ctrl.values()) {
        controller.abort();
      }
      ctrl.clear();
      for (const url of urls.values()) {
        URL.revokeObjectURL(url);
      }
      urls.clear();
    };
  }, []);

  // A file dragged anywhere over the window wakes the drop zone, and a drop
  // that misses it does not make the browser navigate away to the file.
  useEffect(() => {
    let depth = 0;
    const onEnter = (e: globalThis.DragEvent) => {
      if (!isFileDrag(e)) {
        return;
      }
      depth += 1;
      setWindowDrag(true);
    };
    const onLeave = (e: globalThis.DragEvent) => {
      if (!isFileDrag(e)) {
        return;
      }
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        setWindowDrag(false);
      }
    };
    const onOver = (e: globalThis.DragEvent) => {
      if (isFileDrag(e)) {
        e.preventDefault();
      }
    };
    const onEnd = (e: globalThis.DragEvent) => {
      if (isFileDrag(e)) {
        e.preventDefault();
      }
      depth = 0;
      setWindowDrag(false);
      setOverZone(0);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onEnd);
    window.addEventListener("dragend", onEnd);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onEnd);
      window.removeEventListener("dragend", onEnd);
    };
  }, []);

  const validate = useCallback(
    (file: File): FileError | null => {
      if (
        acceptedFileTypes.length &&
        !acceptedFileTypes.some((type) => matchesAcceptedType(file, type))
      ) {
        return {
          message: `Not ${describeAcceptedTypes(acceptedFileTypes)}`,
          code: "INVALID_FILE_TYPE",
        };
      }
      if (file.size > maxFileSize) {
        return {
          message: `Larger than ${formatBytes(maxFileSize)}`,
          code: "FILE_TOO_LARGE",
        };
      }
      return validateFile?.(file) ?? null;
    },
    [acceptedFileTypes, maxFileSize, validateFile]
  );

  const addFiles = useCallback(
    (fileList: FileList | File[] | null) => {
      const files = Array.from(fileList ?? []);
      if (!files.length) {
        return;
      }
      const { added, skipped } = buildItems(files, {
        room: Math.max(0, limit - counted),
        validate,
        nextId: () => {
          const index = nextIndex.current;
          nextIndex.current += 1;
          return { id: `${baseId}-${index}`, index };
        },
      });
      for (const item of added) {
        if (item.previewUrl) {
          previewUrls.current.set(item.id, item.previewUrl);
        }
        if (item.error) {
          onUploadError?.(item.error, item.file);
        }
      }
      setNotice(
        skipped
          ? `${skipped} ${skipped === 1 ? "file was" : "files were"} not added. The limit is ${limit}.`
          : null
      );
      if (added.length) {
        setItems((prev) => [...prev, ...added]);
      }
    },
    [baseId, counted, limit, onUploadError, validate]
  );

  const removeItem = useCallback(
    (id: string) => {
      controllers.current.get(id)?.abort();
      controllers.current.delete(id);
      const url = previewUrls.current.get(id);
      if (url) {
        URL.revokeObjectURL(url);
        previewUrls.current.delete(id);
      }
      const item = items.find((i) => i.id === id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setNotice(null);
      if (item) {
        onFileRemove?.(item.file);
      }
    },
    [items, onFileRemove]
  );

  const clearAll = useCallback(() => {
    for (const item of items) {
      removeItem(item.id);
    }
  }, [items, removeItem]);

  const retryItem = useCallback(
    (id: string) =>
      updateItem(id, { status: "queued", progress: 0, error: undefined }),
    [updateItem]
  );

  const openPicker = () => {
    if (!isFull) {
      inputRef.current?.click();
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const handleZoneDrag = (e: DragEvent<HTMLButtonElement>) => {
    if (!isFileDrag(e)) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = isFull ? "none" : "copy";
    setOverZone(Math.max(1, countDraggedFiles(e.dataTransfer)));
  };

  const handleZoneLeave = (e: DragEvent<HTMLButtonElement>) => {
    if (
      e.relatedTarget instanceof Node &&
      e.currentTarget.contains(e.relatedTarget)
    ) {
      return;
    }
    setOverZone(0);
  };

  const handleZoneDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setOverZone(0);
    setWindowDrag(false);
    if (!isFull) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLButtonElement>) => {
    if (e.clipboardData.files.length) {
      e.preventDefault();
      addFiles(e.clipboardData.files);
    }
  };

  const { done, failed, busy } = summarize(items);
  const { title, showBrowse, hint } = zoneCopy({
    isFull,
    overZone,
    windowDrag,
    multiple,
    limit,
    maxFileSize,
    acceptedFileTypes,
  });

  const armed = windowDrag && !isFull;
  const over = overZone > 0 && !isFull;

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-2 shadow-xs dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
    >
      <button
        aria-describedby={hintId}
        aria-disabled={isFull || undefined}
        className={cn(
          "group/zone flex w-full flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-6 text-center outline-none transition-colors duration-150 ease-out",
          "focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900/10 dark:focus-visible:border-zinc-500 dark:focus-visible:ring-white/15",
          isFull
            ? "cursor-not-allowed border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/30"
            : "cursor-pointer border-zinc-300 bg-zinc-50/60 hover:border-zinc-400 hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/40 dark:active:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-900/70",
          armed &&
            "border-zinc-500 bg-zinc-50 dark:border-zinc-500 dark:bg-zinc-900/70",
          over &&
            "border-zinc-900 border-solid bg-zinc-100 dark:border-zinc-200 dark:bg-zinc-900"
        )}
        onClick={openPicker}
        onDragEnter={handleZoneDrag}
        onDragLeave={handleZoneLeave}
        onDragOver={handleZoneDrag}
        onDrop={handleZoneDrop}
        onPaste={handlePaste}
        type="button"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-9 items-center justify-center rounded-lg border bg-white shadow-xs transition-colors duration-150 dark:bg-zinc-950",
            armed || over
              ? "border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:text-zinc-100"
              : "border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
          )}
        >
          <Upload
            className={cn(
              "size-4 transition-[translate] duration-200 ease-out",
              (armed || over) && "motion-safe:-translate-y-0.5"
            )}
          />
        </span>
        <span className="flex flex-col gap-1">
          <span
            className={cn(
              "font-medium text-sm transition-colors duration-150",
              isFull
                ? "text-zinc-500 dark:text-zinc-400"
                : "text-zinc-900 dark:text-zinc-100"
            )}
          >
            {title}
            {showBrowse && (
              <span className="underline decoration-zinc-300 underline-offset-[3px] transition-colors duration-150 group-hover/zone:decoration-zinc-900 dark:decoration-zinc-600 dark:group-hover/zone:decoration-zinc-100">
                browse
              </span>
            )}
          </span>
          <span
            className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400"
            id={hintId}
          >
            {hint}
          </span>
        </span>
      </button>

      <input
        accept={acceptedFileTypes.join(",") || undefined}
        className="hidden"
        multiple={multiple}
        onChange={handleInputChange}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />

      {notice && (
        <p
          className="mt-2 px-1 text-red-600 text-xs dark:text-red-400"
          role="alert"
        >
          {notice}
        </p>
      )}

      <ul aria-label="Files" className="mt-1 px-1">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <QueueRow
              item={item}
              key={item.id}
              onRemove={removeItem}
              onRetry={retryItem}
              reduceMotion={reduceMotion}
            />
          ))}
        </AnimatePresence>
      </ul>

      <AnimatePresence initial={false}>
        {items.length > 0 && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{
              duration: reduceMotion ? 0 : 0.2,
              ease: EASE_OUT,
            }}
          >
            <div className="flex items-center justify-between px-2 pt-2 pb-0.5">
              <output
                aria-live="polite"
                className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400"
              >
                <span className="text-zinc-900 dark:text-zinc-100">{done}</span>{" "}
                of {items.length} uploaded
                {failed > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    {" "}
                    · {failed} failed
                  </span>
                )}
              </output>
              <button
                className="-mr-1 rounded-md px-1.5 py-1 text-xs text-zinc-500 outline-none transition-colors duration-150 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900/20 active:text-zinc-600 dark:text-zinc-400 dark:active:text-zinc-300 dark:focus-visible:ring-white/25 dark:hover:text-zinc-100"
                onClick={clearAll}
                type="button"
              >
                {busy ? "Cancel all" : "Clear"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

FileUpload.displayName = "FileUpload";
