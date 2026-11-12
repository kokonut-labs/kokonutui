"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import CircleTheme from "@/components/icons/circle-theme";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  // `theme` is "system" until someone picks one, so the icon and the toggle
  // go by what is actually showing.
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="cursor-pointer rounded-lg border border-transparent px-2 py-0.5 transition-colors hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-800 dark:hover:bg-zinc-900"
      onClick={() => {
        setTheme(isDark ? "light" : "dark");
      }}
      size="sm"
      variant="ghost"
    >
      <CircleTheme aria-hidden className="h-5 w-5 text-black dark:text-white" />
    </Button>
  );
}
