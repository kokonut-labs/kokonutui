import { siteConfig } from "@/config/site";

/**
 * Emits an API catalog (RFC 9727) as an RFC 9264 linkset.
 *
 * Two APIs are public here: the shadcn component registry that the CLI reads,
 * and the Orama-backed docs search. Both are unauthenticated, so no `status`
 * or auth relations are advertised — there is nothing to hold a token for.
 */
export function GET() {
  const linkset = {
    linkset: [
      {
        anchor: `${siteConfig.url}/r`,
        "service-desc": [
          {
            href: `${siteConfig.url}/r/registry.json`,
            type: "application/json",
            title: "shadcn registry index — every installable component",
          },
        ],
        "service-doc": [
          {
            href: `${siteConfig.url}/docs`,
            type: "text/html",
            title: "KokonutUI component documentation",
          },
          {
            href: `${siteConfig.url}/docs/agents`,
            type: "text/html",
            title:
              "Using the registry from AI agents and the shadcn MCP server",
          },
          {
            href: `${siteConfig.url}/llms.txt`,
            type: "text/plain",
            title: "llms.txt index of the documentation",
          },
        ],
      },
      {
        anchor: `${siteConfig.url}/api/search`,
        "service-doc": [
          {
            href: `${siteConfig.url}/docs`,
            type: "text/html",
            title: "Full-text search over the KokonutUI documentation",
          },
        ],
      },
    ],
  };

  // Built by hand rather than with `Response.json()`, which hardcodes
  // `application/json` — RFC 9727 requires the linkset media type.
  return new Response(JSON.stringify(linkset, null, 2), {
    headers: {
      "Content-Type": "application/linkset+json",
      "Cache-Control": "public, max-age=0, s-maxage=86400, must-revalidate",
    },
  });
}
