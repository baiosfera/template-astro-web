import { defineMiddleware } from "astro:middleware";
import { classifyHost, resolveRequestHost } from "./lib/host";

export const onRequest = defineMiddleware(async (context, next) => {
  const hostname = resolveRequestHost(context.request.headers);
  const info = classifyHost(hostname);

  context.locals.hostname = info.hostname;
  context.locals.environment = info.environment;
  context.locals.isProduction = info.isProduction;
  context.locals.isPreviewHost = info.isPreviewHost;

  const response = await next();

  if (info.isPreviewHost) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
});
