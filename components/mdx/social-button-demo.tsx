"use client";

import SocialButton from "@/components/kokonutui/social-button";

const shareData = {
  title: "KokonutUI",
  text: "Open-source components built with React and Tailwind CSS",
  url: "https://kokonutui.com",
};

/** Docs demo: the inline row and the popover side by side. */
export default function SocialButtonDemo() {
  return (
    <div className="flex min-h-[280px] w-full flex-wrap items-center justify-center gap-x-10 gap-y-8 p-6">
      <div className="flex flex-col items-center gap-3">
        <SocialButton shareData={shareData} />
        <span className="text-xs text-zinc-500">Inline</span>
      </div>
      <div className="flex flex-col items-center gap-3">
        <SocialButton placement="popover" shareData={shareData} />
        <span className="text-xs text-zinc-500">Popover</span>
      </div>
    </div>
  );
}
