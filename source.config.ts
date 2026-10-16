import type { LLMsOptions } from "fumadocs-core/mdx-plugins/remark-llms";
import {
  defineConfig,
  defineDocs,
  frontmatterSchema,
} from "fumadocs-mdx/config";
import lastModified from "fumadocs-mdx/plugins/last-modified";
import { z } from "zod";

/**
 * Docs pages are almost entirely JSX — the install command, source code and
 * usage live inside the `Preview` components rather than in Markdown prose.
 * Keeping them as placeholders lets `lib/get-llm-text.ts` swap in the real
 * component source at render time, so the `.md` endpoints carry actual
 * content instead of an empty shell.
 */
const llmsOptions: LLMsOptions = {
  // The page's own blocks (commands, notes, the agent setup, the changelog)
  // are rendered as Markdown there too, so no raw JSX reaches the `.md`.
  mdxAsPlaceholder: [
    "Preview",
    "PreviewClient",
    "PreviewTemplate",
    "ProTemplates",
    "ProPeek",
    "Command",
    "Note",
    "McpSetup",
    "AgentRules",
    "AgentPrompts",
    "AgentEndpoints",
    "Release",
    "SetupChoice",
  ],
  // Heading ids would print as `[#slug]` after every heading.
  headingIds: false,
};

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    postprocess: {
      includeProcessedMarkdown: llmsOptions,
    },
    schema: frontmatterSchema.extend({
      /**
       * Search-only synonyms ("glow", "cta", "shimmer"…) folded into the
       * Orama index by `app/api/search/route.ts` — component pages have
       * almost no prose, so title + description alone miss these terms.
       */
      keywords: z.array(z.string()).optional(),
    }),
  },
});

export default defineConfig({
  // Real per-page git timestamps, so the sitemap reports accurate
  // <lastmod> values instead of the build time for every page.
  plugins: [lastModified()],
});
