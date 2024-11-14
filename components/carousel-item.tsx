"use client";

import { ArrowRight } from "lucide-react";
import { memo } from "react";
import type { CarouselItemType } from "./carousel-wrapper";

export const WIDTH_CLASSES = {
    3: "w-[600px] md:w-[700px] lg:w-[800px]",
    2: "w-[400px] md:w-[500px] lg:w-[600px]",
    1: "w-[300px] md:w-[350px] lg:w-[400px]",
} as const;

export const COMPONENT_SIZES = {
    wide: "w-full aspect-[2/1]",
    tall: "w-full aspect-[4/3]",
    default: "w-full aspect-[3/2]",
} as const;

export function getWidthClasses(span: 1 | 2 | 3 = 1) {
    return WIDTH_CLASSES[span];
}

export function getComponentClasses(
    size: "default" | "wide" | "tall" = "default"
) {
    return COMPONENT_SIZES[size];
}

interface CarouselItemProps {
    item: CarouselItemType;
    index: number;
}

export const CarouselItem = memo(function CarouselItem({
    item,
}: CarouselItemProps) {
    return (
        <div
            className={`flex-shrink-0 ${getWidthClasses(
                item.span
            )} gpu-accelerated select-none`}
            style={{ userSelect: "none", touchAction: "none" }}
        >
            <div
                className="relative p-3 sm:p-4 h-full rounded-xl 
                    border border-zinc-200 dark:border-zinc-800 
                    bg-white dark:bg-zinc-900 
                    transition-colors duration-200 
                    flex flex-col overflow-hidden
                    pointer-events-none"
            >
                <div
                    className={`flex-1 flex items-center justify-center mb-3 
                        rounded-lg overflow-hidden 
                        ${getComponentClasses(item.size)}`}
                >
                    <div className="w-full h-full flex items-center justify-center">
                        {item.component}
                    </div>
                </div>
                <div
                    className="flex items-center justify-between mt-auto pt-3 
                    border-t border-zinc-200 dark:border-zinc-800 -mx-4 px-4"
                >
                    <div>
                        <h3
                            className="text-base font-semibold 
                            text-zinc-900 dark:text-zinc-100"
                        >
                            {item.title}
                        </h3>
                        <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                            {item.count} components
                        </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-400 dark:text-zinc-600" />
                </div>
            </div>
        </div>
    );
});