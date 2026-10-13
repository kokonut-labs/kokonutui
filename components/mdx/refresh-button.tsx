"use client";

import { RefreshCw } from "lucide-react";

interface RefreshButtonProps {
  onRefresh: () => void;
}

export function RefreshButton({ onRefresh }: RefreshButtonProps) {
  return (
    <button
      aria-label="Replay preview"
      className="flex h-7 items-center gap-1.5 rounded-md border border-zinc-200 bg-background/80 px-2 text-xs text-zinc-600 backdrop-blur-sm transition-[color,background-color,scale] duration-150 ease-out hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.97] dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
      onClick={onRefresh}
      title="Replay preview"
      type="button"
    >
      <RefreshCw className="h-3.5 w-3.5" />
      <span className="font-medium">Replay</span>
    </button>
  );
}
