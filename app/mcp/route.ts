import { createMcpHandler } from "@modelcontextprotocol/server";
import { createKokonutServer } from "@/lib/mcp/server";

/**
 * The Kokonut UI MCP server at /mcp, over Streamable HTTP. Stateless: each
 * request gets a fresh server, so it runs on serverless functions as is.
 * Clients on the 2026-07-28 revision also get the `kokonutui` skill; older
 * clients get the tools through the SDK's stateless fallback.
 */
const handler = createMcpHandler(createKokonutServer, {
  onerror: (error) => console.error("[mcp]", error),
});

const serve = (request: Request) => handler.fetch(request);

export { serve as DELETE, serve as GET, serve as POST };
