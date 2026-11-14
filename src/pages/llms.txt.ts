import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  const siteName = process.env.PROJECT_NAME || "Web Platform";
  const content = `# ${siteName}
> Base web agnóstica sobre Astro 5 SSR, Hono y Bun.

## Endpoints
- [/](/) : Página principal del proyecto
- [/health](/health) : Estado del servicio en JSON
`;

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
};
