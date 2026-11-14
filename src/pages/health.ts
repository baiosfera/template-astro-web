import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      status: "ok",
      service: process.env.PROJECT_NAME || process.env.ZEROPS_SERVICE_HOSTNAME || "web",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }
  );
};
