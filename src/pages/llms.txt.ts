import type { APIRoute } from "astro";
import { classifyHost, resolveRequestHost } from "../lib/host";

export const GET: APIRoute = async ({ request }) => {
  const hostname = resolveRequestHost(request.headers);
  const { isPreviewHost } = classifyHost(hostname);
  const proto = request.headers.get("x-forwarded-proto") || (isPreviewHost ? "http" : "https");
  const baseUrl = `${proto}://${hostname}`;

  const envPrefix = hostname.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const siteName =
    process.env[`${envPrefix}_PROJECT_NAME`] ||
    process.env.PROJECT_NAME ||
    "Web Platform";

  const content = `# ${siteName}
> Base web agnóstica sobre Astro 5 SSR, Hono y Bun (${baseUrl}).

## Endpoints
- [Inicio](${baseUrl}/): Página principal del proyecto
- [Health](${baseUrl}/health): Estado del servicio en JSON
`;

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": isPreviewHost ? "no-store" : "public, max-age=86400",
      ...(isPreviewHost ? { "X-Robots-Tag": "noindex, nofollow" } : {}),
    },
  });
};
