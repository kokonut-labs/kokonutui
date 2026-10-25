import { getParts } from "@/components/landing/home/parts";
import type { FramePart } from "@/components/og/frames";
import { AI_HIGHLIGHTS, AI_PART } from "@/components/og/proposal-list";
import type { FrameCategory, ProposalData } from "@/components/og/proposals";

const AI_PREFIX = /^AI /;

/** The catalog facts the proposals draw, counted from the docs. */
export function getProposalData(): ProposalData {
  const all = getParts();
  const categories: FrameCategory[] = [];
  for (const part of all) {
    const code = part.code.split("-")[0] ?? part.categorySlug;
    const last = categories.at(-1);
    if (last?.code === code) {
      last.count += 1;
    } else {
      categories.push({ code, title: part.category, count: 1 });
    }
  }
  const featured = new Set([AI_PART, "slide-to-confirm"]);
  const parts: Record<string, FramePart> = {};
  for (const part of all) {
    if (featured.has(part.name)) {
      parts[part.name] = {
        code: part.code,
        name: part.name,
        title: part.title,
        category: part.category,
        dependencies: part.dependencies,
      };
    }
  }
  return {
    count: all.length,
    categories,
    parts,
    aiTitles: AI_HIGHLIGHTS.flatMap((name) => {
      const part = all.find((p) => p.name === name);
      return part ? [part.title.replace(AI_PREFIX, "")] : [];
    }),
  };
}
