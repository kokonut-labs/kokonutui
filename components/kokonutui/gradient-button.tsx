/**
 * @author: @dorianbaffier
 * @description: Gradient Button
 * @version: 1.1.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GradientButtonVariant = "emerald" | "purple" | "orange";

export interface GradientButtonProps
  extends Omit<ComponentProps<"button">, "children"> {
  /** Button content. Takes precedence over `label`. */
  children?: ReactNode;
  /** Fallback text when no `children` are passed. */
  label?: string;
  /** Optional icon rendered before the text (e.g. a lucide-react icon). */
  icon?: ReactNode;
  /** Color theme. */
  variant?: GradientButtonVariant;
}

interface VariantClasses {
  /** Focus ring color on the button itself. */
  ring: string;
  /** Outer 2px gradient border. */
  border: string;
  /** Soft base tint, light mode only (dark mode shows the solid surface). */
  base: string;
  /** Vertical color wash. */
  overlay: string;
  /** Diagonal accent. */
  accent: string;
  /** Inset glow. */
  glow: string;
  /** Gradient text + dark-mode text glow. */
  text: string;
  /** Icon color. */
  icon: string;
  /** Hover sheen. */
  hover: string;
}

/**
 * Every class is a complete, static string so Tailwind can detect it at build
 * time. Light classes come first, dark ones are explicitly `dark:` prefixed.
 */
const variantClasses: Record<GradientButtonVariant, VariantClasses> = {
  emerald: {
    ring: "focus-visible:ring-emerald-500/60 dark:focus-visible:ring-[#87F6B7]/50",
    border:
      "from-emerald-400 via-emerald-300 to-emerald-200 dark:from-[#336C4F] dark:via-[#0C1F21] dark:to-[#0D6437]",
    base: "from-emerald-50 via-emerald-50/80 to-emerald-50/90",
    overlay:
      "from-emerald-300/30 via-emerald-200/20 to-emerald-400/20 dark:from-[#347B52]/40 dark:via-[#0C1F21] dark:to-[#0D6437]/30",
    accent:
      "from-emerald-400/20 via-emerald-300/10 to-emerald-200/30 dark:from-[#87F6B7]/10 dark:via-[#0C1F21] dark:to-[#17362A]/50",
    glow: "shadow-[inset_0_0_10px_rgba(52,211,153,0.2)] dark:shadow-[inset_0_0_10px_rgba(135,246,183,0.1)]",
    text: "from-emerald-700 to-emerald-600 dark:from-[#8AEECA] dark:to-[#73F8A8] dark:drop-shadow-[0_0_12px_rgba(135,246,183,0.4)]",
    icon: "text-emerald-600 dark:text-[#73F8A8]",
    hover:
      "from-emerald-300/30 via-emerald-200/20 to-emerald-300/30 dark:from-[#17362A]/20 dark:via-[#87F6B7]/10 dark:to-[#17362A]/20",
  },
  purple: {
    ring: "focus-visible:ring-purple-500/60 dark:focus-visible:ring-[#D6BCFA]/50",
    border:
      "from-purple-400 via-purple-300 to-purple-200 dark:from-[#6B46C1] dark:via-[#0C1F21] dark:to-[#553C9A]",
    base: "from-purple-50 via-purple-50/80 to-purple-50/90",
    overlay:
      "from-purple-300/30 via-purple-200/20 to-purple-400/20 dark:from-[#7E22CE]/40 dark:via-[#0C1F21] dark:to-[#6B46C1]/30",
    accent:
      "from-purple-400/20 via-purple-300/10 to-purple-200/30 dark:from-[#E9D8FD]/10 dark:via-[#0C1F21] dark:to-[#44337A]/50",
    glow: "shadow-[inset_0_0_10px_rgba(159,122,234,0.2)] dark:shadow-[inset_0_0_10px_rgba(159,122,234,0.1)]",
    text: "from-purple-700 to-purple-600 dark:from-[#E9D8FD] dark:to-[#D6BCFA] dark:drop-shadow-[0_0_12px_rgba(159,122,234,0.4)]",
    icon: "text-purple-600 dark:text-[#D6BCFA]",
    hover:
      "from-purple-300/30 via-purple-200/20 to-purple-300/30 dark:from-[#44337A]/20 dark:via-[#B794F4]/10 dark:to-[#44337A]/20",
  },
  orange: {
    ring: "focus-visible:ring-orange-500/60 dark:focus-visible:ring-[#FBD38D]/50",
    border:
      "from-orange-400 via-orange-300 to-orange-200 dark:from-[#C05621] dark:via-[#0C1F21] dark:to-[#9C4221]",
    base: "from-orange-50 via-orange-50/80 to-orange-50/90",
    overlay:
      "from-orange-300/30 via-orange-200/20 to-orange-400/20 dark:from-[#DD6B20]/40 dark:via-[#0C1F21] dark:to-[#C05621]/30",
    accent:
      "from-orange-400/20 via-orange-300/10 to-orange-200/30 dark:from-[#FED7AA]/10 dark:via-[#0C1F21] dark:to-[#7B341E]/50",
    glow: "shadow-[inset_0_0_10px_rgba(237,137,54,0.2)] dark:shadow-[inset_0_0_10px_rgba(237,137,54,0.1)]",
    text: "from-orange-700 to-orange-600 dark:from-[#FED7AA] dark:to-[#FBD38D] dark:drop-shadow-[0_0_12px_rgba(237,137,54,0.4)]",
    icon: "text-orange-600 dark:text-[#FBD38D]",
    hover:
      "from-orange-300/30 via-orange-200/20 to-orange-300/30 dark:from-[#7B341E]/20 dark:via-[#ED8936]/10 dark:to-[#7B341E]/20",
  },
};

/** Shared classes for the decorative layers sitting inside the 2px border. */
const innerLayer = "pointer-events-none absolute inset-[2px] rounded-[6px]";

export default function GradientButton({
  children,
  label = "Welcome",
  icon,
  className,
  variant = "emerald",
  ...props
}: GradientButtonProps) {
  const colors = variantClasses[variant];

  return (
    <Button
      className={cn(
        "group relative h-12 overflow-hidden rounded-lg px-4",
        // Ghost variant adds a hover background; the layers below own the look.
        "hover:bg-transparent dark:hover:bg-transparent",
        // Press feedback: transform only, short strong ease-out.
        "transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]",
        "motion-reduce:transition-none motion-reduce:active:scale-100",
        colors.ring,
        className
      )}
      variant="ghost"
      {...props}
    >
      {/* Gradient border (visible as the 2px ring around the inner layers) */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 rounded-lg bg-linear-to-b",
          colors.border
        )}
      />

      {/* Surface */}
      <span
        aria-hidden="true"
        className={cn(innerLayer, "bg-white dark:bg-[#0C1F21]")}
      />
      <span
        aria-hidden="true"
        className={cn(
          innerLayer,
          "bg-linear-to-r opacity-90 dark:hidden",
          colors.base
        )}
      />
      <span
        aria-hidden="true"
        className={cn(innerLayer, "bg-linear-to-b opacity-80", colors.overlay)}
      />
      <span
        aria-hidden="true"
        className={cn(innerLayer, "bg-linear-to-br", colors.accent)}
      />
      <span aria-hidden="true" className={cn(innerLayer, colors.glow)} />

      {/* Hover sheen: opacity only. Tailwind v4 gates hover to (hover: hover) devices. */}
      <span
        aria-hidden="true"
        className={cn(
          innerLayer,
          "bg-linear-to-r opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 motion-reduce:transition-none",
          colors.hover
        )}
      />

      <span className="relative flex items-center justify-center gap-2">
        {icon ? (
          <span
            aria-hidden="true"
            className={cn("flex shrink-0 items-center", colors.icon)}
          >
            {icon}
          </span>
        ) : null}
        <span
          className={cn(
            "bg-linear-to-b bg-clip-text font-light text-lg text-transparent tracking-tighter",
            colors.text
          )}
        >
          {children ?? label}
        </span>
      </span>
    </Button>
  );
}
