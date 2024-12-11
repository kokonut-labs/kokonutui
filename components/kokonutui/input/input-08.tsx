"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

interface ColorInputProps {
  onChange?: (color: string) => void; // Callback for final color
  defaultValue?: string; // Default color
  swatches?: string[]; // Swatches for quick selection
  showOpacity?: boolean; // Whether to show the opacity slider
  label?: string; // Label for the input
}

const defaultSwatches = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
];

// Helper to calculate final color with opacity
const generateFinalColor = (color: string, opacity: number): string => {
  if (opacity === 100) return color; // No need to calculate if opacity is 100%
  const alpha = Math.round(opacity * 2.55) // Convert opacity (0-100) to 0-255
    .toString(16) // Convert to hexadecimal
    .padStart(2, "0"); // Ensure 2 digits (e.g., "0F")
  return `${color}${alpha}`;
};

export default function Input_08({
  onChange,
  defaultValue = "#3b82f6",
  swatches = defaultSwatches,
  showOpacity = true,
  label = "Color",
}: ColorInputProps) {
  const [color, setColor] = useState(defaultValue); // Base color without opacity
  const [opacity, setOpacity] = useState(100); // Opacity (0-100)
  const { isCopied, copyToClipboard } = useCopyToClipboard();

  const finalColor = generateFinalColor(color, opacity); // Calculate the final color

  // Trigger the onChange callback whenever color or opacity changes
  const updateFinalColor = (newColor: string, newOpacity = opacity) => {
    const updatedColor = generateFinalColor(newColor, newOpacity);
    setColor(newColor);
    onChange?.(updatedColor); // Pass final color to parent
  };

  const updateOpacity = (newOpacity: number) => {
    setOpacity(newOpacity);
    onChange?.(generateFinalColor(color, newOpacity)); // Pass final color to parent
  };

  const handleCopy = () => {
    copyToClipboard(finalColor); // Copy the final color
  };

  return (
    <div className="w-full max-w-xs space-y-2 relative z-10 min-h-[200px]">
      {label && (
        <label
          htmlFor="color-input"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          {label}
        </label>
      )}

      {/* Color Picker */}
      <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
        {/* Color Preview & Input */}
        <div className="flex gap-2 items-center">
          <div
            className="w-8 h-8 rounded-md border border-zinc-200 dark:border-zinc-700"
            style={{ backgroundColor: finalColor }} // Display final color
          />
          <input
            id="color-input"
            type="text"
            value={finalColor.toUpperCase()} // Show final color
            onChange={(e) => {
              const value = e.target.value.slice(0, 7); // Extract base color
              if (/^#[0-9A-F]{6}$/i.test(value)) {
                updateFinalColor(value);
              }
            }}
            className={cn(
              "flex-1 px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-800",
              "bg-white dark:bg-zinc-900 text-sm font-mono",
              "focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            )}
          />
          <button type="button" onClick={handleCopy} className="ml-2 hover:opacity-70">
            {isCopied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 text-zinc-500" />
            )}
          </button>
        </div>

        {/* Opacity Slider */}
        {showOpacity && (
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span>Opacity</span>
              <span>{opacity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={opacity}
              onChange={(e) => updateOpacity(Number(e.target.value))}
              className={cn(
                "w-full h-2 rounded-full appearance-none",
                "bg-gradient-to-r from-transparent to-current cursor-pointer"
              )}
              style={{ color }}
            />
          </div>
        )}

        {/* Color Swatches */}
        <div className="mt-4 space-y-1.5">
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Swatches</div>
          <div className="grid grid-cols-6 gap-1">
            {swatches.map((swatch) => (
              <button
                type="button"
                key={swatch}
                onClick={() => updateFinalColor(swatch)}
                className={cn(
                  "w-6 h-6 rounded-md border border-zinc-200 dark:border-zinc-700",
                  "transition-transform hover:scale-110 relative"
                )}
                style={{ backgroundColor: swatch }}
              >
                {color === swatch && (
                  <Check
                    className={cn(
                      "w-4 h-4 absolute inset-0 m-auto text-white",
                      "drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]"
                    )}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
