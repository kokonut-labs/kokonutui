// Custom events for Vercel Web Analytics: what was copied and which links
// out were followed. Only a kind and a component or placement name are sent,
// never the copied text, and at most two properties per event.

import { track } from "@vercel/analytics";

const SOURCE_FILE = /^([a-z0-9-]+)\.tsx$/;
const MARKDOWN_FILE = /^([a-z0-9-]+)\.md$/;
const COMPONENT = /(?:@kokonutui\/|\/r\/)([a-z0-9-]+)/;
const RUNNER = /^(?:npx|bunx|pnpm dlx|yarn dlx)\s/;
const SETUP = /\bmcp\b|setup\.md|shadcn@latest init/;
const REGISTRY_ENTRY = /\/r\/([a-z0-9-]+)\.json/;
const WWW = /^www\./;
const SLASHES = /^\/|\/$/g;

const OPEN_IN: Record<string, string> = {
  "claude.ai": "Claude",
  "chatgpt.com": "ChatGPT",
  "cursor.com": "Cursor",
  "v0.dev": "v0",
};

type CopyKind =
  | "install"
  | "prompt"
  | "source"
  | "markdown"
  | "setup"
  | "file"
  | "other";

function describeCopy(text: string): { kind: CopyKind; component?: string } {
  const source = SOURCE_FILE.exec(text);
  if (source) {
    return { kind: "source", component: source[1] };
  }
  const markdown = MARKDOWN_FILE.exec(text);
  if (markdown) {
    return { kind: "markdown", component: markdown[1] };
  }
  // Config and rules files; a one-line command or prompt never wraps.
  if (text.includes("\n")) {
    return { kind: "file" };
  }
  const component = COMPONENT.exec(text)?.[1];
  if (component) {
    return { kind: RUNNER.test(text) ? "install" : "prompt", component };
  }
  return { kind: SETUP.test(text) ? "setup" : "other" };
}

/**
 * Report a copy that landed: an install command, an agent prompt, a
 * component's source or a page's Markdown, with the component it was for.
 */
export function trackCopy(text?: string) {
  const value = text?.trim();
  if (!value) {
    return;
  }
  track("Copy", describeCopy(value));
}

/**
 * Report a followed link when it leads to Pro, Product Hunt, the GitHub repo
 * or an AI tool from the Open in menu. Any other link is left alone.
 */
export function trackLink(href: string) {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return;
  }
  const host = url.hostname.replace(WWW, "");

  if (host === "kokonutui.pro") {
    // Every link to Pro carries where it sits in utm_medium.
    track("Pro click", {
      placement: url.searchParams.get("utm_medium") ?? "unknown",
      item:
        url.searchParams.get("utm_content") ??
        (url.hash.slice(1) || url.pathname.replace(SLASHES, "") || "home"),
    });
    return;
  }
  if (host === "producthunt.com") {
    track("Product Hunt click");
    return;
  }
  if (
    host === "github.com" &&
    url.pathname.startsWith("/kokonut-labs/kokonutui")
  ) {
    track("GitHub click");
    return;
  }
  const tool = OPEN_IN[host];
  const component = tool
    ? REGISTRY_ENTRY.exec(decodeURIComponent(url.search))?.[1]
    : undefined;
  if (tool && component) {
    track("Open in", { tool, component });
  }
}
