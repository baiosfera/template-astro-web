import crypto from "node:crypto";
import type { PaymentGatewayDriver } from "./types";
import type {
  CreatePaymentSessionInput,
  PaymentSessionResponse,
  NormalizedPaymentEvent,
} from "@astrobranding/contracts";

export class StripeDriver implements PaymentGatewayDriver {
  readonly id = "stripe" as const;
  readonly name = "Stripe (Global & Apple Pay)";
  readonly supportedCurrencies = ["USD", "EUR", "GBP", "CAD", "AUD", "COP", "MXN", "BRL"];
  readonly supportedMethods = ["Credit Card", "Apple Pay", "Google Pay", "Link"];

  private getConfig() {
    return {
      secretKey: process.env.STRIPE_SECRET_KEY || "",
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    };
  }

  isConfigured(): boolean {
    const { secretKey } = this.getConfig();
    return Boolean(secretKey);
  }

  async createSession(input: CreatePaymentSessionInput, orderId: string): Promise<PaymentSessionResponse> {
    const { secretKey } = this.getConfig();
    if (!secretKey) {
      throw new Error("Stripe is not configured (missing STRIPE_SECRET_KEY)");
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        success_url: input.redirectUrl || "/",
        cancel_url: input.redirectUrl || "/",
        client_reference_id: orderId,
        mode: "payment",
        "line_items[0][price_data][currency]": input.currency.toLowerCase(),
        "line_items[0][price_data][unit_amount]": String(Math.round(input.amount * 100)),
        "line_items[0][price_data][product_data][name]": `Order ${orderId}`,
        "line_items[0][quantity]": "1",
      }),
    });

    if (!res.ok) {
      throw new Error(`Stripe HTTP ${res.status}: ${await res.text()}`);
    }

    const session = (await res.json()) as { id?: string; url?: string };
    if (!session.url) throw new Error("Stripe session missing checkout URL");

    return {
      success: true,
      sessionId: session.id || orderId,
      redirectUrl: session.url,
      gateway: "stripe",
      orderId,
    };
  }

  verifySignature(headers: Record<string, string>, rawBody: string): boolean {
    const { webhookSecret } = this.getConfig();
    if (!webhookSecret) return false;
    const sig = headers["stripe-signature"] || "";
    const parts = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=")));
    const timestamp = parts["t"];
    const v1 = parts["v1"]?.toLowerCase();
    if (!timestamp || !v1 || v1.length !== 64) return false;

    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(`${timestamp}.${rawBody}`, "utf8")
      .digest("hex")
      .toLowerCase();

    return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(v1, "utf8"));
  }

  normalizeWebhook(body: Record<string, any>): NormalizedPaymentEvent {
    const type = body.type || "";
    const object = body.data?.object || body;

    let event: NormalizedPaymentEvent["event"] = "payment.pending";
    if (type === "checkout.session.completed" || type === "payment_intent.succeeded") {
      event = "payment.approved";
    } else if (type === "payment_intent.payment_failed") {
      event = "payment.declined";
    }

    const orderId = object.metadata?.orderId || object.client_reference_id || "unknown";
    const amount = Number((object.amount_total || object.amount || 0) / 100);

    return {
      gateway: "stripe",
      event,
      orderId,
      transactionId: object.id || `ch_${Date.now()}`,
      amount,
      currency: (object.currency || "usd").toUpperCase(),
      payerEmail: object.customer_details?.email || object.receipt_email,
      signatureValid: false,
      rawPayload: body,
    };
  }
}
