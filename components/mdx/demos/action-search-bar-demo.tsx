"use client";

import ActionSearchBar, {
  type CommandItem,
} from "@/components/kokonutui/action-search-bar";

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Docs demo only: actions pretend to do work for a moment so the row's
 * spinner shows; links resolve at once.
 */
function run(item: CommandItem) {
  return item.href ? undefined : wait(700);
}

export default function ActionSearchBarDemo() {
  return (
    <div className="flex min-h-[500px] w-full justify-center px-4 pt-6">
      <ActionSearchBar onSelect={run} />
    </div>
  );
}
