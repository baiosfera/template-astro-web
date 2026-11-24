export interface HostClassification {
  hostname: string;
  environment: "dev" | "stage" | "prod";
  isProduction: boolean;
  isPreviewHost: boolean;
}

export function resolveRequestHost(headers: Headers, fallback = "localhost"): string {
  const forwarded = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const direct = headers.get("host")?.trim();
  const raw = forwarded || direct || fallback;
  return raw.split(":")[0].toLowerCase();
}

export function classifyHost(rawHost: string): HostClassification {
  const hostname = rawHost.split(":")[0].trim().toLowerCase();
  const isZeropsPreview = hostname.endsWith(".zerops.app");
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "";

  if (hostname.includes("staging.") || (isZeropsPreview && hostname.includes("webprod"))) {
    return {
      hostname,
      environment: "stage",
      isProduction: false,
      isPreviewHost: true,
    };
  }

  if (isZeropsPreview || isLocal) {
    return {
      hostname,
      environment: "dev",
      isProduction: false,
      isPreviewHost: true,
    };
  }

  return {
    hostname,
    environment: "prod",
    isProduction: true,
    isPreviewHost: false,
  };
}
