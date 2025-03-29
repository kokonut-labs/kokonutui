"use client";

import { Search, ShoppingBag, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import Link from "next/link";

interface TopBarProps {
    cartItemCount: number;
    onCartClick: () => void;
    onSearch: (query: string) => void;
}

const categories = [
    "All",
    "Lighting",
    "Kitchenware",
    "Home Decor",
    "Plants",
    "Office",
    "Textiles",
];

export function TopBar({ cartItemCount, onCartClick, onSearch }: TopBarProps) {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [isScrolled, setIsScrolled] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            setIsSearchOpen(false);
            searchInputRef.current?.blur();
        }
    };

    return (
        <div
            className={`sticky top-0 z-40 transition-all duration-200 ${
                isScrolled
                    ? "bg-white/90 dark:bg-zinc-900/90 shadow-sm"
                    : "bg-white/80 dark:bg-zinc-900/80"
            } backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800`}
        >
            <div className="flex items-center justify-between px-3 h-12">
                <Link
                    href="https://kokonutui.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium shrink-0"
                >
                    Shop
                </Link>

                <div className="flex-1 px-8 overflow-x-auto flex items-center justify-center gap-6 scrollbar-none">
                    {categories.map((category) => (
                        <button
                            type="button"
                            key={category}
                            className={`whitespace-nowrap transition-colors ${
                                selectedCategory === category
                                    ? "text-zinc-900 dark:text-white text-sm font-medium"
                                    : "text-zinc-500 dark:text-zinc-400 text-sm hover:text-zinc-900 dark:hover:text-white"
                            }`}
                            onClick={() => setSelectedCategory(category)}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <motion.div
                        className="relative overflow-hidden p-1"
                        initial={false}
                        animate={{ width: isSearchOpen ? "auto" : 0 }}
                    >
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search products..."
                            className={`w-48 sm:w-56 bg-zinc-100 dark:bg-zinc-800 rounded-md text-sm px-3 py-1.5 
                                focus:outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-700
                                transition-all duration-200 ${
                                    isSearchOpen ? "opacity-100" : "opacity-0"
                                }`}
                            onChange={(e) => onSearch(e.target.value)}
                            onKeyDown={handleKeyPress}
                        />
                        {isSearchOpen && (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsSearchOpen(false);
                                    onSearch("");
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-zinc-200 
                                    dark:hover:bg-zinc-700 rounded-full"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </motion.div>
                    <button
                        type="button"
                        onClick={() => setIsSearchOpen(!isSearchOpen)}
                        className={`p-1.5 rounded-md transition-colors ${
                            isSearchOpen
                                ? "bg-zinc-100 dark:bg-zinc-800"
                                : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        } z-10`}
                    >
                        <Search className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onCartClick}
                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md relative"
                    >
                        <ShoppingBag className="w-4 h-4" />
                        {cartItemCount > 0 && (
                            <motion.span
                                initial={{ scale: 0.5 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1 -right-1 bg-zinc-900 dark:bg-white 
                                    text-white dark:text-zinc-900 text-xs font-medium w-4 h-4 
                                    flex items-center justify-center rounded-full"
                            >
                                {cartItemCount}
                            </motion.span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
