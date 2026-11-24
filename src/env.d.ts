/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    hostname: string;
    environment: "dev" | "stage" | "prod";
    isProduction: boolean;
    isPreviewHost: boolean;
  }
}
