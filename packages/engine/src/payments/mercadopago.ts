import crypto from "node:crypto";
import type { PaymentGatewayDriver } from "./types";
import type {
  CreatePaymentSessionInput,
  PaymentSessionResponse,
  NormalizedPaymentEvent,
} from "@astrobranding/contracts";

export class MercadoPagoDriver implements PaymentGatewayDriver {
  readonly id = "mercadopago" as const;
  readonly name = "Mercado Pago (LatAm & Pix)";
  readonly supportedCurrencies = ["COP", "MXN", "BRL", "ARS", "CLP", "PEN", "USD"];
  readonly supportedMethods = ["Credit Card", "PSE", "Pix", "Oxxo", "Efectivo", "Wallet"];

  private getConfig() {
    return {
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
      webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET || "",
    };
  }

  isConfigured(): boolean {
    const { accessToken } = this.getConfig();
    return Boolean(accessToken);
  }

  async createSession(input: CreatePaymentSessionInput, orderId: string): Promise<PaymentSessionResponse> {
    const { accessToken } = this.getConfig();
    if (!accessToken) {
      throw new Error("Mercado Pago is not configured (missing MERCADOPAGO_ACCESS_TOKEN)");
    }

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_reference: orderId,
        items: [{ title: `Order ${orderId}`, quantity: 1, unit_price: input.amount, currency_id: input.currency }],
        back_urls: { success: input.redirectUrl || "/", failure: input.redirectUrl || "/" },
      }),
    });

    if (!res.ok) throw new Error(`MercadoPago HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { id?: string; init_point?: string };
    if (!data.init_point) throw new Error("MercadoPago response missing init_point");

    return {
      success: true,
      sessionId: data.id || orderId,
      redirectUrl: data.init_point,
      gateway: "mercadopago",
      orderId,
    };
  }

  verifySignature(headers: Record<string, string>, rawBody: string): boolean {
    const { webhookSecret } = this.getConfig();
    if (!webhookSecret) return false;
    const xSig = headers["x-signature"] || "";
    const requestId = headers["x-request-id"] || "";
    const parts = Object.fromEntries(xSig.split(",").map((p) => p.trim().split("=")));
    const ts = parts["ts"];
    const v1 = parts["v1"]?.toLowerCase();
    if (!ts || !v1 || v1.length !== 64) return false;

    try {
      const body = JSON.parse(rawBody);
      const dataId = body?.data?.id || body?.id || "";
      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
      const expected = crypto
        .createHmac("sha256", webhookSecret)
        .update(manifest, "utf8")
        .digest("hex")
        .toLowerCase();
      return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(v1, "utf8"));
    } catch {
      return false;
    }
  }

  normalizeWebhook(body: Record<string, any>): NormalizedPaymentEvent {
    const action = body.action || body.type || "";
    const data = body.data || body;

    let event: NormalizedPaymentEvent["event"] = "payment.pending";
    if (action === "payment.created" || action === "payment.updated" || body.status === "approved") {
      event = "payment.approved";
    } else if (body.status === "rejected" || body.status === "cancelled") {
      event = "payment.declined";
    }

    return {
      gateway: "mercadopago",
      event,
      orderId: data.external_reference || body.external_reference || "unknown",
      transactionId: data.id || body.id || `mp-${Date.now()}`,
      amount: Number(body.transaction_amount || 0),
      currency: body.currency_id || "USD",
      payerEmail: body.payer?.email,
      signatureValid: false,
      rawPayload: body,
    };
  }
}
