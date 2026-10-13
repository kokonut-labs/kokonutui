"use client";

import { useTheme } from "next-themes";
import SwitchButton from "@/components/kokonutui/switch-button";

/**
 * Docs demo only. This site keeps its theme in next-themes, so the button is
 * wired to it; the component itself does not depend on next-themes.
 */
export default function SwitchButtonDemo() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <SwitchButton
      onThemeChange={setTheme}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}
