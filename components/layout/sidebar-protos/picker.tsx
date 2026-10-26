"use client";

import { MONO } from "@/components/landing/home/styles";
import { cn } from "@/lib/utils";
import { useSidebarProto, VARIANTS } from "./context";

/** A review-only switch between the sidebar prototypes, bottom right. */
export function SidebarPicker() {
  const { variant, setVariant } = useSidebarProto();
  return (
    <fieldset
      aria-label="Sidebar prototype"
      className={cn(
        MONO,
        "fixed right-4 bottom-4 z-50 flex border border-black/15 bg-white p-0.5 text-[11px] shadow-[0_8px_24px_-12px_rgb(0_0_0/0.25)] dark:border-white/15 dark:bg-black"
      )}
    >
      {VARIANTS.map((option) => (
        <button
          aria-pressed={variant === option.id}
          className={cn(
            "px-2.5 py-1.5 transition-[background-color,color] duration-150 ease-out",
            variant === option.id
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white"
          )}
          key={option.id}
          onClick={() => setVariant(option.id)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
