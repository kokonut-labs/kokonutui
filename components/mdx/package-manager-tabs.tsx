"use client";

import { CheckCheck } from "lucide-react";
import { motion } from "motion/react";
import React from "react";
import { cn } from "@/lib/utils";

type PackageManagerTabsProps = {
  onSelect: (packageManager: string) => void;
  commandName: string;
  prePath: string;
};

const packageManagers = [
  { id: "npm", title: "npm" },
  { id: "bun", title: "bun" },
  { id: "pnpm", title: "pnpm" },
];

export function PackageManagerTabs({
  onSelect,
  commandName,
  prePath,
}: PackageManagerTabsProps) {
  const [selected, setSelected] = React.useState<string>("bun");
  const [dimensions, setDimensions] = React.useState({ width: 0, left: 0 });
  const [isCopied, setIsCopied] = React.useState(false);

  // Reference for the selected button
  const buttonRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const containerRef = React.useRef<HTMLDivElement>(null);
  const copyButtonRef = React.useRef<HTMLButtonElement>(null);

  // Update dimensions whenever selected tab changes or on mount
  React.useLayoutEffect(() => {
    const updateDimensions = () => {
      const selectedButton = buttonRefs.current.get(selected);
      const container = containerRef.current;

      if (selectedButton && container) {
        const rect = selectedButton.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        setDimensions({
          width: rect.width,
          left: rect.left - containerRect.left,
        });
      }
    };

    // Initial update
    requestAnimationFrame(() => {
      updateDimensions();
    });

    // Update on resize
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [selected]);

  const handleTabClick = (tabId: string) => {
    setSelected(tabId);
    onSelect(tabId);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    tabId: string
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleTabClick(tabId);
    }
  };

  const getCommand = (packageManager: string): string => {
    if (packageManager === "pnpm") {
      return `pnpm dlx shadcn@latest add ${prePath}/${commandName}`;
    }
    if (packageManager === "npm") {
      return `npx shadcn@latest add ${prePath}/${commandName}`;
    }
    return `bunx --bun shadcn@latest add ${prePath}/${commandName}`;
  };

  const handleCopyCommand = () => {
    const commandToCopy = getCommand(selected);
    navigator.clipboard.writeText(commandToCopy);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center sm:gap-2">
      <div
        aria-label="Package manager tabs"
        className={cn(
          "relative flex items-center justify-start gap-1",
          "rounded-sm bg-background",
          "border",
          "h-7 text-black dark:text-white"
        )}
        ref={containerRef}
        role="tablist"
      >
        <motion.div
          animate={{
            width: dimensions.width - 4,
            x: dimensions.left + 2,
            opacity: 1,
          }}
          className="absolute z-[1] rounded-sm bg-black dark:bg-white"
          initial={false}
          style={{ height: "calc(100% - 4px)", top: "2px" }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
          }}
        />

        <div className="relative z-[2] flex">
          {packageManagers.map((item) => {
            const isSelected = selected === item.id;
            return (
              <motion.button
                aria-controls={`panel-${item.id}`}
                aria-selected={isSelected}
                className={cn(
                  "relative flex h-7 items-center justify-center gap-0.5 rounded-sm px-2 py-0.5",
                  "font-medium text-xs transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "truncate",
                  isSelected
                    ? "text-white dark:text-black"
                    : "text-black/50 hover:bg-muted/50 hover:text-foreground dark:text-white/50"
                )}
                id={`tab-${item.id}`}
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                onKeyDown={(e) => handleKeyDown(e, item.id)}
                ref={(el) => {
                  if (el) {
                    buttonRefs.current.set(item.id, el);
                  } else {
                    buttonRefs.current.delete(item.id);
                  }
                }}
                role="tab"
                tabIndex={isSelected ? 0 : -1}
                type="button"
              >
                <span className="truncate">{item.title}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <button
        className={cn(
          "h-7 font-medium text-xs",
          "border border-black/10 dark:border-white/10",
          "rounded-sm px-2",
          "transition-[background-color,transform] duration-150 ease-out hover:bg-muted/50 active:scale-[0.99]",
          "group flex items-center justify-center gap-1",
          "w-full min-w-0 sm:min-w-[250px]",
          "relative"
        )}
        onClick={handleCopyCommand}
        ref={copyButtonRef}
        title={getCommand(selected)}
        type="button"
      >
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center gap-1",
            "transition-opacity duration-200",
            isCopied ? "opacity-100" : "opacity-0"
          )}
        >
          <CheckCheck className="h-3.5 w-3.5 text-green-500 dark:text-green-500" />
          <span className="truncate">Copied to clipboard</span>
        </span>
        <span
          className={cn(
            "truncate",
            "transition-opacity duration-200",
            isCopied ? "opacity-0" : "opacity-100"
          )}
        >
          {getCommand(selected)}
        </span>
      </button>
    </div>
  );
}
