"use client";

import { RotateCw, Scan } from "lucide-react";
import { useState } from "react";
import ScrubInput from "@/components/kokonutui/scrub-input";

/**
 * Docs demo only: four fields from a design tool's inspector, wired to a
 * shape so scrubbing has something to move.
 */
export default function ScrubInputDemo() {
  const [width, setWidth] = useState(144);
  const [height, setHeight] = useState(96);
  const [rotation, setRotation] = useState(12);
  const [radius, setRadius] = useState(16);

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <div className="flex h-60 w-full items-center justify-center overflow-hidden rounded-xl border border-zinc-200 border-dashed dark:border-zinc-800">
        <div
          className="bg-zinc-900 dark:bg-zinc-100"
          style={{
            width,
            height,
            borderRadius: radius,
            transform: `rotate(${rotation}deg)`,
          }}
        />
      </div>
      <div className="grid w-full grid-cols-2 gap-2">
        <ScrubInput
          className="w-full"
          label="W"
          max={200}
          min={8}
          name="Width"
          onChange={setWidth}
          unit="px"
          value={width}
        />
        <ScrubInput
          className="w-full"
          label="H"
          max={112}
          min={8}
          name="Height"
          onChange={setHeight}
          unit="px"
          value={height}
        />
        <ScrubInput
          className="w-full"
          label={<RotateCw className="size-3.5" />}
          max={360}
          min={0}
          name="Rotation"
          onChange={setRotation}
          unit="°"
          value={rotation}
          wrap
        />
        <ScrubInput
          className="w-full"
          label={<Scan className="size-3.5" />}
          max={80}
          min={0}
          name="Corner radius"
          onChange={setRadius}
          unit="px"
          value={radius}
        />
      </div>
    </div>
  );
}
