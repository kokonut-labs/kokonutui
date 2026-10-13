"use client";

import ElasticSlider from "@/components/kokonutui/elastic-slider";

/**
 * Docs demo only. MDX renders on the server, which can't pass the
 * `formatValue` function to a client component, so the demo lives here.
 */
export default function ElasticSliderDemo() {
  return (
    <div className="flex w-full flex-col items-center gap-10">
      <ElasticSlider />
      <ElasticSlider
        defaultValue={1.5}
        endIcon={null}
        formatValue={(v) => `${v.toFixed(1)}x`}
        label="Playback speed"
        max={3}
        min={0.5}
        startIcon={null}
        step={0.1}
      />
    </div>
  );
}
