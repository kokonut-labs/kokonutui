"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import Nextjs from "@/components/icons/nextjs";
import ReactIcon from "@/components/icons/react";
import { DURATION, EASE_OUT, STAGGER } from "@/lib/animation-presets";
import { cn } from "@/lib/utils";
import ShadcnIcon from "../icons/shadcn";

type Tech = {
  name: string;
  className: string;
  render: () => React.ReactNode;
  labelClassName?: string;
  wrapperClassName?: string;
};

const TECHS: Tech[] = [
  {
    name: "TailwindCSS",
    className: "text-blue-600 dark:text-blue-400",
    render: () => (
      <svg
        aria-labelledby="tailwindcss-icon-title"
        className="h-8 w-8"
        role="img"
        viewBox="0 0 54 33"
      >
        <title id="tailwindcss-icon-title">TailwindCSS</title>
        <g clipPath="url(#prefix__clip0)">
          <path
            clipRule="evenodd"
            d="M27 0c-7.2 0-11.7 3.6-13.5 10.8 2.7-3.6 5.85-4.95 9.45-4.05 2.054.513 3.522 2.004 5.147 3.653C30.744 13.09 33.808 16.2 40.5 16.2c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.513-3.522-2.004-5.147-3.653C36.756 3.11 33.692 0 27 0zM13.5 16.2C6.3 16.2 1.8 19.8 0 27c2.7-3.6 5.85-4.95 9.45-4.05 2.054.514 3.522 2.004 5.147 3.653C17.244 29.29 20.308 32.4 27 32.4c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.513-3.522-2.004-5.147-3.653C23.256 19.31 20.192 16.2 13.5 16.2z"
            fill="#38bdf8"
            fillRule="evenodd"
          />
        </g>
      </svg>
    ),
    labelClassName: "text-black dark:text-white",
  },
  {
    name: "Motion",
    className: "text-yellow-500 dark:text-[#F5EA1E]",
    render: () => (
      <Image
        alt="Motion"
        className="rounded-full"
        height={32}
        src="/motion.png"
        width={32}
      />
    ),
    labelClassName: "text-black dark:text-white",
  },
  {
    name: "shadcn/ui",
    className: "text-black dark:text-white",
    render: () => (
      <ShadcnIcon
        aria-label="shadcn/ui"
        className="h-8 w-8 text-black dark:text-white"
      />
    ),
  },
  {
    name: "Next.js",
    className: "text-black dark:text-white",
    render: () => <Nextjs aria-label="Next.js" className="h-8 w-8" />,
    wrapperClassName: "col-span-1 col-start-1 md:col-auto",
  },
  {
    name: "React",
    className: "text-black dark:text-white",
    render: () => <ReactIcon aria-label="React" className="h-8 w-8" />,
    wrapperClassName: "col-span-1 col-start-3 md:col-auto",
  },
];

export default function FeatureBlock() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  return (
    <div className="z-10 mx-auto flex w-full max-w-none flex-col items-center">
      <div className="mx-auto grid w-[95%] grid-cols-3 items-center justify-center gap-6 py-4 md:flex md:w-[85%] md:flex-wrap md:gap-8">
        {TECHS.map((tech, index) => {
          const isHovered = hoveredItem === tech.name;
          return (
            <motion.div
              className={cn(
                "relative flex flex-col items-center gap-2",
                tech.className,
                tech.wrapperClassName
              )}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
              key={tech.name}
              onMouseEnter={() => setHoveredItem(tech.name)}
              onMouseLeave={() => setHoveredItem(null)}
              transition={{
                duration: DURATION.slow,
                delay: index * STAGGER.base,
                ease: EASE_OUT,
              }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              {tech.render()}
              <motion.span
                animate={{ scale: reduceMotion || !isHovered ? 1 : 1.1 }}
                className={cn(
                  "mt-1 whitespace-nowrap text-center text-xs transition-[font-weight] duration-150",
                  isHovered ? "font-medium" : "font-normal",
                  tech.labelClassName
                )}
                transition={{ duration: DURATION.fast, ease: EASE_OUT }}
              >
                {tech.name}
              </motion.span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
