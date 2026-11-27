import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";
import { type NextRequest, NextResponse } from "next/server";

const { rewrite: rewriteLLM } = rewritePath(
  "/docs{/*path}",
  "/llms.mdx/docs{/*path}"
);

/**
 * Content negotiation for AI agents: a client that asks for `text/markdown`
 * on a normal docs URL gets the clean Markdown version, without needing to
 * know about the `.md` suffix convention.
 */
export default function proxy(request: NextRequest) {
  if (isMarkdownPreferred(request)) {
    const result = rewriteLLM(request.nextUrl.pathname);

    if (result) {
      // No `Vary: Accept` here: Next overwrites `Vary` on App Router page
      // responses with its own router values, and it does the same to a
      // `headers()` entry in next.config.mjs. The HTML variant is prerendered
      // and always answers without `Accept` in its `Vary`, so a shared cache
      // keyed only on the URL could reuse it for a Markdown request. Vercel's
      // own routing distinguishes the two, so this only affects intermediary
      // caches — the `.md` suffix is the cache-safe path for those.
      return NextResponse.rewrite(new URL(result, request.nextUrl));
    }
  }

  return NextResponse.next();
}

// Only requests that ask for Markdown run the proxy. Without the `has`, every
// docs page view and every sidebar click paid for a proxy invocation before
// the prerendered page could be served.
export const config = {
  matcher: [
    {
      source: "/docs/:path*",
      has: [{ type: "header", key: "accept", value: "(.*)text/markdown(.*)" }],
    },
  ],
};
