import type { APIRoute } from "astro";
import { classifyHost, resolveRequestHost } from "../lib/host";

export const GET: APIRoute = async ({ request }) => {
  const hostname = resolveRequestHost(request.headers);
  const { isPreviewHost } = classifyHost(hostname);

  if (isPreviewHost) {
    return new Response("User-agent: *\nDisallow: /\n", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  const proto = request.headers.get("x-forwarded-proto") || "https";
  const baseUrl = `${proto}://${hostname}`;
  const body = `# Robots — ${hostname}
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: Claude-SearchBot
User-agent: Claude-User
User-agent: PerplexityBot
User-agent: Perplexity-User
User-agent: Bingbot
User-agent: Googlebot
Allow: /

User-agent: *
Disallow: /admin/
Disallow: /adminn/
Disallow: /api/private/
Allow: /

Sitemap: ${baseUrl}/sitemap-index.xml
Sitemap: ${baseUrl}/sitemap.xml
`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
