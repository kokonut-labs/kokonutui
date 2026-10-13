"use client";

/**
 * @author: @dorianbaffier
 * @description: Sliced Text
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { MotionConfig, motion } from "motion/react";
import { cn } from "@/lib/utils";

interface SlicedTextProps {
  text?: string;
  className?: string;
  containerClassName?: string;
  splitSpacing?: number;
}

const SlicedText: React.FC<SlicedTextProps> = ({
  text = "Sliced Text",
  className,
  containerClassName,
  splitSpacing = 2,
}) => (
  // Under reduced motion the slices still merge (clip-path, opacity) but
  // skip the vertical offset.
  <MotionConfig reducedMotion="user">
    <motion.div
      className={cn(
        "relative inline-block w-full text-center",
        containerClassName
      )}
      initial="default"
      whileHover="hover"
    >
      <motion.div
        aria-hidden="true"
        className={cn("absolute -ml-0.5 w-full text-4xl", className)}
        transition={{ duration: 0.1 }}
        variants={{
          default: {
            clipPath: "inset(0 0 50% 0)",
            y: -splitSpacing / 2,
            opacity: 1,
          },
          hover: {
            clipPath: "inset(0 0 0 0)",
            y: 0,
            opacity: 0,
          },
        }}
      >
        {text}
      </motion.div>
      <motion.div
        aria-hidden="true"
        className={cn("absolute w-full text-4xl", className)}
        transition={{ duration: 0.1 }}
        variants={{
          default: {
            clipPath: "inset(50% 0 0 0)",
            y: splitSpacing / 2,
            opacity: 1,
          },
          hover: {
            clipPath: "inset(0 0 0 0)",
            y: 0,
            opacity: 1,
          },
        }}
      >
        {text}
      </motion.div>

      {/* Sizes the container and is the one copy exposed to assistive tech.
          opacity-0 comes last so a consumer's className can't reveal it. */}
      <div className={cn("text-4xl", className, "opacity-0")}>{text}</div>
    </motion.div>
  </MotionConfig>
);

export default SlicedText;
