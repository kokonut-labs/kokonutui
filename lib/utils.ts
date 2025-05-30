import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function cx(baseClass: string, conditionalClass?: string) {
    return conditionalClass ? `${baseClass} ${conditionalClass}` : baseClass;
}
