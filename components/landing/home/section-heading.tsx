import type { ReactNode } from "react";

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-[560px]">
        <h2 className="text-balance font-semibold text-[32px] text-black leading-[1.1] tracking-[-0.035em] sm:text-[40px] dark:text-white">
          {title}
        </h2>
        <p className="mt-3 text-pretty text-[16px] text-black/55 leading-relaxed dark:text-white/55">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
