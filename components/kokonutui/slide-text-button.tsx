"use client";

/**
 * @author: @kokonut-labs
 * @description: Slide Text Button with animated vertical text transition
 * @version: 1.0.0
 * @date: 2025-11-02
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import Link from "next/link";
import { cn } from "@/lib/utils";

interface SlideTextButtonProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  text?: string;
  hoverText?: string;
  href?: string;
  className?: string;
  variant?: "default" | "ghost";
  /** Fades and slides the button in when it mounts. */
  animateIn?: boolean;
}

export default function SlideTextButton({
  text = "Browse Components",
  hoverText,
  href = "/docs",
  className,
  variant = "default",
  animateIn = true,
  ...props
}: SlideTextButtonProps) {
  const slideText = hoverText ?? text;
  const variantStyles =
    variant === "ghost"
      ? "border border-black/10 text-black hover:bg-black/5 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
      : "bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90";

  return (
    <Link
      className={cn(
        "group relative inline-flex h-10 items-center justify-center overflow-hidden rounded-lg px-8 font-medium text-base tracking-tighter transition-[background-color,scale,opacity,translate] duration-[150ms,150ms,200ms,200ms] ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2 active:scale-[0.97] motion-reduce:active:scale-100 md:min-w-56 dark:focus-visible:outline-white",
        // CSS entrance from @starting-style: no JS and no wrapper element.
        // Reduced motion keeps the fade and drops the slide.
        animateIn &&
          "starting:translate-x-2 starting:opacity-0 motion-reduce:starting:translate-x-0",
        variantStyles,
        className
      )}
      href={href}
      {...props}
    >
      {/* Both labels share one grid cell, so the wider one sets the width
          and both stay centred; the hover label waits one row below. */}
      <span className="grid justify-items-center transition-transform duration-200 ease-[cubic-bezier(0.77,0,0.175,1)] group-hover:-translate-y-full group-focus-visible:-translate-y-full motion-reduce:transition-none">
        <span className="col-start-1 row-start-1 flex items-center gap-2 opacity-100 transition-opacity duration-200 group-hover:opacity-0 group-focus-visible:opacity-0">
          <span className="font-medium">{text}</span>
        </span>
        <span
          aria-hidden="true"
          className="col-start-1 row-start-1 flex translate-y-full items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <span className="font-medium">{slideText}</span>
        </span>
      </span>
    </Link>
  );
}
