"use client";

/**
 * @author: @kokonutui
 * @description: A spotlight-style command palette with categorized actions and smooth animations
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
    Search,
    X,
    FileText,
    Settings,
    User,
    Mail,
    Calendar,
    Folder,
    Clock,
    Star,
    ArrowRight,
    Command,
} from "lucide-react";
import useDebounce from "@/hooks/use-debounce";

interface Action {
    id: string;
    label: string;
    icon: React.ReactNode;
    category: string;
    shortcut?: string;
    href?: string;
}

interface CategoryGroup {
    category: string;
    actions: Action[];
}

const ANIMATION_VARIANTS = {
    overlay: {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
        exit: { opacity: 0 },
    },
    modal: {
        hidden: { opacity: 0, scale: 0.95, y: -20 },
        visible: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: {
                type: "spring",
                stiffness: 300,
                damping: 30,
            },
        },
        exit: {
            opacity: 0,
            scale: 0.95,
            y: -20,
            transition: { duration: 0.15 },
        },
    },
    item: {
        hidden: { opacity: 0, x: -10 },
        visible: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 10 },
    },
} as const;

const defaultActions: Action[] = [
    {
        id: "1",
        label: "New Document",
        icon: <FileText className="h-4 w-4" />,
        category: "Actions",
        shortcut: "⌘N",
    },
    {
        id: "2",
        label: "Open Settings",
        icon: <Settings className="h-4 w-4" />,
        category: "Actions",
        shortcut: "⌘,",
    },
    {
        id: "3",
        label: "View Profile",
        icon: <User className="h-4 w-4" />,
        category: "Navigation",
        shortcut: "⌘P",
    },
    {
        id: "4",
        label: "Check Messages",
        icon: <Mail className="h-4 w-4" />,
        category: "Navigation",
        shortcut: "⌘M",
    },
    {
        id: "5",
        label: "Open Calendar",
        icon: <Calendar className="h-4 w-4" />,
        category: "Apps",
        shortcut: "⌘K",
    },
    {
        id: "6",
        label: "Browse Files",
        icon: <Folder className="h-4 w-4" />,
        category: "Apps",
    },
    {
        id: "7",
        label: "Recent Activity",
        icon: <Clock className="h-4 w-4" />,
        category: "Quick Access",
    },
    {
        id: "8",
        label: "Starred Items",
        icon: <Star className="h-4 w-4" />,
        category: "Quick Access",
    },
];

function ActionSearchBar02({
    actions = defaultActions,
    placeholder = "Type a command or search...",
    onActionSelect,
    defaultOpen = false,
}: {
    actions?: Action[];
    placeholder?: string;
    onActionSelect?: (action: Action) => void;
    defaultOpen?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const debouncedQuery = useDebounce(query, 150);

    const filteredActions = useMemo(() => {
        if (!debouncedQuery.trim()) return actions;

        const normalizedQuery = debouncedQuery.toLowerCase().trim();
        return actions.filter((action) => {
            const searchableText =
                `${action.label} ${action.category}`.toLowerCase();
            return searchableText.includes(normalizedQuery);
        });
    }, [debouncedQuery, actions]);

    const groupedActions = useMemo(() => {
        const groups: CategoryGroup[] = [];
        const categoryMap = new Map<string, Action[]>();

        for (const action of filteredActions) {
            const existing = categoryMap.get(action.category);
            if (existing) {
                existing.push(action);
            } else {
                categoryMap.set(action.category, [action]);
            }
        }

        for (const [category, categoryActions] of categoryMap) {
            groups.push({ category, actions: categoryActions });
        }

        return groups;
    }, [filteredActions]);

    const flatActions = useMemo(
        () => groupedActions.flatMap((g) => g.actions),
        [groupedActions]
    );

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        setActiveIndex(0);
    }, [debouncedQuery]);

    useEffect(() => {
        if (listRef.current && flatActions.length > 0) {
            const activeElement = listRef.current.querySelector(
                `[data-index="${activeIndex}"]`
            );
            activeElement?.scrollIntoView({ block: "nearest" });
        }
    }, [activeIndex, flatActions.length]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    setActiveIndex((prev) =>
                        prev < flatActions.length - 1 ? prev + 1 : 0
                    );
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    setActiveIndex((prev) =>
                        prev > 0 ? prev - 1 : flatActions.length - 1
                    );
                    break;
                case "Enter":
                    e.preventDefault();
                    if (flatActions[activeIndex]) {
                        onActionSelect?.(flatActions[activeIndex]);
                        setIsOpen(false);
                    }
                    break;
                case "Escape":
                    e.preventDefault();
                    setIsOpen(false);
                    break;
            }
        },
        [flatActions, activeIndex, onActionSelect]
    );

    const handleActionClick = useCallback(
        (action: Action) => {
            onActionSelect?.(action);
            setIsOpen(false);
        },
        [onActionSelect]
    );

    const openPalette = useCallback(() => {
        setIsOpen(true);
        setQuery("");
        setActiveIndex(0);
    }, []);

    let globalIndex = 0;

    return (
        <div className="w-full max-w-2xl mx-auto">
            {/* Trigger Button */}
            <motion.button
                type="button"
                onClick={openPalette}
                className="w-full max-w-md mx-auto flex items-center gap-3 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors shadow-sm"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
            >
                <Search className="h-4 w-4 text-zinc-400" />
                <span className="flex-1 text-left text-sm text-zinc-500 dark:text-zinc-400">
                    Search commands...
                </span>
                <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-md border border-zinc-200 dark:border-zinc-700">
                    <Command className="h-3 w-3" />
                    <span>K</span>
                </kbd>
            </motion.button>

            {/* Command Palette Modal */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                            variants={ANIMATION_VARIANTS.overlay}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Modal */}
                        <motion.div
                            className="fixed left-1/2 top-[20%] -translate-x-1/2 w-full max-w-lg z-50"
                            variants={ANIMATION_VARIANTS.modal}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                        >
                            <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                                {/* Search Input */}
                                <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                                    <Search className="h-5 w-5 text-zinc-400 shrink-0" />
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={query}
                                        onChange={(e) =>
                                            setQuery(e.target.value)
                                        }
                                        onKeyDown={handleKeyDown}
                                        placeholder={placeholder}
                                        className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
                                        aria-label="Search commands"
                                        role="combobox"
                                        aria-expanded={true}
                                        aria-controls="command-list"
                                        aria-activedescendant={
                                            flatActions[activeIndex]
                                                ? `action-${flatActions[activeIndex].id}`
                                                : undefined
                                        }
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                        aria-label="Close command palette"
                                    >
                                        <X className="h-4 w-4 text-zinc-400" />
                                    </button>
                                </div>

                                {/* Results */}
                                <div
                                    ref={listRef}
                                    id="command-list"
                                    role="listbox"
                                    className="max-h-80 overflow-y-auto py-2"
                                >
                                    {groupedActions.length > 0 ? (
                                        groupedActions.map((group) => (
                                            <div
                                                key={group.category}
                                                className="mb-2 last:mb-0"
                                            >
                                                <div className="px-4 py-1.5">
                                                    <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                                                        {group.category}
                                                    </span>
                                                </div>
                                                {group.actions.map((action) => {
                                                    const currentIndex =
                                                        globalIndex++;
                                                    const isActive =
                                                        currentIndex ===
                                                        activeIndex;

                                                    return (
                                                        <motion.button
                                                            key={action.id}
                                                            id={`action-${action.id}`}
                                                            data-index={
                                                                currentIndex
                                                            }
                                                            type="button"
                                                            role="option"
                                                            aria-selected={
                                                                isActive
                                                            }
                                                            onClick={() =>
                                                                handleActionClick(
                                                                    action
                                                                )
                                                            }
                                                            onMouseEnter={() =>
                                                                setActiveIndex(
                                                                    currentIndex
                                                                )
                                                            }
                                                            className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                                                                isActive
                                                                    ? "bg-zinc-100 dark:bg-zinc-800"
                                                                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                                                            }`}
                                                            variants={
                                                                ANIMATION_VARIANTS.item
                                                            }
                                                            initial="hidden"
                                                            animate="visible"
                                                            transition={{
                                                                delay:
                                                                    currentIndex *
                                                                    0.03,
                                                            }}
                                                        >
                                                            <span
                                                                className={`shrink-0 ${
                                                                    isActive
                                                                        ? "text-zinc-900 dark:text-zinc-100"
                                                                        : "text-zinc-500 dark:text-zinc-400"
                                                                }`}
                                                            >
                                                                {action.icon}
                                                            </span>
                                                            <span
                                                                className={`flex-1 text-sm font-medium ${
                                                                    isActive
                                                                        ? "text-zinc-900 dark:text-zinc-100"
                                                                        : "text-zinc-700 dark:text-zinc-300"
                                                                }`}
                                                            >
                                                                {action.label}
                                                            </span>
                                                            {action.shortcut && (
                                                                <kbd className="text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                                                                    {
                                                                        action.shortcut
                                                                    }
                                                                </kbd>
                                                            )}
                                                            {isActive && (
                                                                <ArrowRight className="h-4 w-4 text-zinc-400 shrink-0" />
                                                            )}
                                                        </motion.button>
                                                    );
                                                })}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="px-4 py-8 text-center">
                                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                                No results found for "
                                                <span className="font-medium">
                                                    {query}
                                                </span>
                                                "
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                    <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                                        <div className="flex items-center gap-3">
                                            <span className="flex items-center gap-1">
                                                <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-medium">
                                                    ↑↓
                                                </kbd>
                                                Navigate
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-medium">
                                                    ↵
                                                </kbd>
                                                Select
                                            </span>
                                        </div>
                                        <span className="flex items-center gap-1">
                                            <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-medium">
                                                Esc
                                            </kbd>
                                            Close
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

export default ActionSearchBar02;
