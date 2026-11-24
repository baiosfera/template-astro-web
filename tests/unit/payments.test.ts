import crypto from "node:crypto";
import { describe, expect, it } from "bun:test";
import { DLocalGoDriver } from "../../packages/engine/src/payments/dlocalgo";
import { WompiDriver } from "../../packages/engine/src/payments/wompi";
import { StripeDriver } from "../../packages/engine/src/payments/stripe";
import { PaymentGatewayRegistry } from "../../packages/engine/src/payments/registry";
import { classifyHost } from "../../src/lib/host";

describe("Host classification (middleware)", () => {
  it("classifies *.zerops.app including webprod as non-production preview hosts", () => {
    const dev = classifyHost("webdev-2b6-4321.ny1.zerops.app");
    expect(dev.environment).toBe("dev");
    expect(dev.isProduction).toBe(false);
    expect(dev.isPreviewHost).toBe(true);

    const stagePreview = classifyHost("webprod-2b6-4321.ny1.zerops.app");
    expect(stagePreview.environment).toBe("stage");
    expect(stagePreview.isProduction).toBe(false);
    expect(stagePreview.isPreviewHost).toBe(true);
  });

  it("classifies custom production domains as prod and indexable", () => {
    const prod = classifyHost("example.com:443");
    expect(prod.hostname).toBe("example.com");
    expect(prod.environment).toBe("prod");
    expect(prod.isProduction).toBe(true);
    expect(prod.isPreviewHost).toBe(false);
  });
});

describe("Payment drivers fail-closed security", () => {
  it("DLocalGoDriver.isConfigured returns false when keys are missing", () => {
    const driver = new DLocalGoDriver({ apiKey: "", secretKey: "" });
    expect(driver.isConfigured()).toBe(false);
  });

  it("DLocalGoDriver.verifySignature validates real V2-HMAC-SHA256 signatures and rejects tampering", () => {
    const apiKey = "dlg_api_test";
    const secretKey = "dlg_secret_test";
    const driver = new DLocalGoDriver({ apiKey, secretKey, isSandbox: true });
    const rawBody = JSON.stringify({ id: "pay_123", order_id: "ord_1", status: "PAID", amount: 9, currency: "USD" });

    const validHex = crypto
      .createHmac("sha256", secretKey)
      .update(`${apiKey}${rawBody}`, "utf8")
      .digest("hex");

    expect(
      driver.verifySignature({ authorization: `V2-HMAC-SHA256, Signature: ${validHex}` }, rawBody)
    ).toBe(true);

    expect(
      driver.verifySignature({ authorization: `V2-HMAC-SHA256, Signature: ${"0".repeat(64)}` }, rawBody)
    ).toBe(false);

    expect(driver.verifySignature({}, rawBody)).toBe(false);
  });

  it("Registry propagates failed signature verification without returning signatureValid: true", () => {
    const prevSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_123";
    try {
      const registry = new PaymentGatewayRegistry();
      const event = registry.verifyAndNormalizeWebhook(
        "stripe",
        {},
        { type: "checkout.session.completed", data: { object: { id: "cs_1", client_reference_id: "ord_2" } } },
        "{}"
      );
      expect(event.signatureValid).toBe(false);
      expect(new WompiDriver().verifySignature({}, "{}")).toBe(false);
      expect(new StripeDriver().verifySignature({}, "{}")).toBe(false);
    } finally {
      if (prevSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = prevSecret;
    }
  });
});
