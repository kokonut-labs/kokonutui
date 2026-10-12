"use client";

/**
 * @author: @kokonutui
 * @description: A modern search bar component with action buttons and suggestions
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  AudioLines,
  BarChart2,
  LayoutGrid,
  PlaneTakeoff,
  Search,
  Send,
  Video,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import useDebounce from "@/hooks/use-debounce";

interface Action {
  id: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
  short?: string;
  end?: string;
}

interface SearchResult {
  actions: Action[];
}

const ANIMATION_VARIANTS = {
  container: {
    hidden: { opacity: 0, y: -4 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.15,
        ease: [0.23, 1, 0.32, 1],
        staggerChildren: 0.03,
      },
    },
    exit: {
      opacity: 0,
      y: -4,
      transition: { duration: 0.1, ease: [0.23, 1, 0.32, 1] },
    },
  },
  item: {
    hidden: { opacity: 0, y: 4 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.15, ease: [0.23, 1, 0.32, 1] },
    },
  },
} as const;

const allActionsSample = [
  {
    id: "1",
    label: "Book tickets",
    icon: <PlaneTakeoff className="h-4 w-4 text-blue-500" />,
    description: "Operator",
    short: "⌘K",
    end: "Agent",
  },
  {
    id: "2",
    label: "Summarize",
    icon: <BarChart2 className="h-4 w-4 text-orange-500" />,
    description: "gpt-5",
    short: "⌘cmd+p",
    end: "Command",
  },
  {
    id: "3",
    label: "Screen Studio",
    icon: <Video className="h-4 w-4 text-purple-500" />,
    description: "Claude 4.1",
    short: "",
    end: "Application",
  },
  {
    id: "4",
    label: "Talk to Jarvis",
    icon: <AudioLines className="h-4 w-4 text-green-500" />,
    description: "gpt-5 voice",
    short: "",
    end: "Active",
  },
  {
    id: "5",
    label: "Kokonut UI - Pro",
    icon: <LayoutGrid className="h-4 w-4 text-blue-500" />,
    description: "Components",
    short: "",
    end: "Link",
  },
];

function ActionSearchBar({
  actions = allActionsSample,
  defaultOpen = false,
}: {
  actions?: Action[];
  defaultOpen?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isFocused, setIsFocused] = useState(defaultOpen);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebounce(query, 200);

  const filteredActions = useMemo(() => {
    if (!debouncedQuery) return actions;

    const normalizedQuery = debouncedQuery.toLowerCase().trim();
    return actions.filter((action) => {
      const searchableText =
        `${action.label} ${action.description || ""}`.toLowerCase();
      return searchableText.includes(normalizedQuery);
    });
  }, [debouncedQuery, actions]);

  useEffect(() => {
    if (!isFocused) {
      setResult(null);
      setActiveIndex(-1);
      return;
    }

    setResult({ actions: filteredActions });
    setActiveIndex(-1);
  }, [filteredActions, isFocused]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      setIsTyping(true);
      setActiveIndex(-1);
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!result?.actions.length) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < result.actions.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : result.actions.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (activeIndex >= 0 && result.actions[activeIndex]) {
            setSelectedAction(result.actions[activeIndex]);
          }
          break;
        case "Escape":
          setIsFocused(false);
          setActiveIndex(-1);
          break;
      }
    },
    [result?.actions, activeIndex]
  );

  const handleActionClick = useCallback((action: Action) => {
    setSelectedAction(action);
  }, []);

  const handleFocus = useCallback(() => {
    setSelectedAction(null);
    setIsFocused(true);
    setActiveIndex(-1);
  }, []);

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setIsFocused(false);
      setActiveIndex(-1);
    }, 200);
  }, []);

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="relative flex min-h-[300px] flex-col items-center justify-start">
        <div className="sticky top-0 z-10 w-full max-w-sm bg-background pt-4 pb-1">
          <label
            className="mb-1 block font-medium text-gray-500 text-xs dark:text-gray-400"
            htmlFor="search"
          >
            Search Commands
          </label>
          <div className="relative">
            <Input
              aria-activedescendant={
                activeIndex >= 0
                  ? `action-${result?.actions[activeIndex]?.id}`
                  : undefined
              }
              aria-autocomplete="list"
              aria-expanded={isFocused && !!result}
              autoComplete="off"
              className="h-9 rounded-lg py-1.5 pr-9 pl-3 text-sm focus-visible:ring-offset-0"
              id="search"
              onBlur={handleBlur}
              onChange={handleInputChange}
              onFocus={handleFocus}
              onKeyDown={handleKeyDown}
              placeholder="What's up?"
              role="combobox"
              type="text"
              value={query}
            />
            <div className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2">
              <AnimatePresence mode="popLayout">
                <motion.div
                  animate={{ y: 0, opacity: 1 }}
                  // Only the fade remains under reduced motion.
                  className="motion-reduce:transform-none!"
                  exit={{
                    y: 20,
                    opacity: 0,
                    transition: { duration: 0.15, ease: [0.23, 1, 0.32, 1] },
                  }}
                  initial={{ y: -20, opacity: 0 }}
                  key={query.length > 0 ? "send" : "search"}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                >
                  {query.length > 0 ? (
                    <Send className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  ) : (
                    <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="w-full max-w-sm">
          <AnimatePresence>
            {isFocused && result && !selectedAction && (
              <motion.div
                animate="show"
                aria-label="Search results"
                className="mt-1 w-full overflow-hidden rounded-md border bg-white shadow-xs dark:border-gray-800 dark:bg-black"
                exit="exit"
                initial="hidden"
                role="listbox"
                variants={ANIMATION_VARIANTS.container}
              >
                <motion.ul role="none">
                  {result.actions.map((action) => (
                    <motion.li
                      aria-selected={
                        activeIndex === result.actions.indexOf(action)
                      }
                      className={`flex cursor-pointer items-center justify-between rounded-md px-3 py-2 hover:bg-gray-200 dark:hover:bg-zinc-900 ${
                        activeIndex === result.actions.indexOf(action)
                          ? "bg-gray-100 dark:bg-zinc-800"
                          : ""
                      }`}
                      id={`action-${action.id}`}
                      key={action.id}
                      layout
                      onClick={() => handleActionClick(action)}
                      role="option"
                      variants={ANIMATION_VARIANTS.item}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span aria-hidden="true" className="text-gray-500">
                            {action.icon}
                          </span>
                          <span className="font-medium text-gray-900 text-sm dark:text-gray-100">
                            {action.label}
                          </span>
                          {action.description && (
                            <span className="text-gray-400 text-xs">
                              {action.description}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {action.short && (
                          <span className="text-gray-400 text-xs">
                            {action.short}
                          </span>
                        )}
                        {action.end && (
                          <span className="text-right text-gray-400 text-xs">
                            {action.end}
                          </span>
                        )}
                      </div>
                    </motion.li>
                  ))}
                </motion.ul>
                <div className="mt-2 border-gray-100 border-t px-3 py-2 dark:border-gray-800">
                  <div className="flex items-center justify-between text-gray-500 text-xs">
                    <span>Press ⌘K to open commands</span>
                    <span>ESC to cancel</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default ActionSearchBar;
