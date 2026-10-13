"use client";

import { CommandToolbar } from "./command";
import { InkToolbar } from "./ink";
import type { ToolbarProps } from "./shared";
import { SpecToolbar } from "./spec";
import { useToolbarVariant } from "./variant-store";

const VARIANTS = [CommandToolbar, SpecToolbar, InkToolbar];

/** Renders the preview toolbar direction chosen in the prototype picker. */
export function PreviewToolbar(props: ToolbarProps) {
  const variant = useToolbarVariant();
  const Toolbar = VARIANTS[variant] ?? CommandToolbar;
  return (
    <div data-toolbar-variant={variant + 1}>
      <Toolbar {...props} />
    </div>
  );
}
