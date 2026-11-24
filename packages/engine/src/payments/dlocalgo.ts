import crypto from "node:crypto";
import type { PaymentGatewayDriver } from "./types";
import type {
  CreatePaymentSessionInput,
  PaymentSessionResponse,
  NormalizedPaymentEvent,
} from "@astrobranding/contracts";

export interface DLocalGoOptions {
  apiKey?: string;
  secretKey?: string;
  baseUrl?: string;
  isSandbox?: boolean;
}

export class DLocalGoDriver implements PaymentGatewayDriver {
  readonly id = "dlocalgo" as const;
  readonly name = "dLocal Go (LatAm & Global Cards)";
  readonly supportedCurrencies = ["USD", "COP", "MXN", "BRL", "CLP", "ARS"];
  readonly supportedMethods = ["Credit Card", "Debit Card"];

  private readonly overrideOpts?: DLocalGoOptions;

  constructor(options?: DLocalGoOptions) {
    this.overrideOpts = options;
  }

  private getConfig() {
    const apiKey = this.overrideOpts?.apiKey ?? (process.env.DLOCAL_GO_API_KEY || process.env.DLOCALGO_API_KEY || "");
    const secretKey = this.overrideOpts?.secretKey ?? (process.env.DLOCAL_GO_SECRET_KEY || process.env.DLOCALGO_SECRET || "");
    const isSandbox = this.overrideOpts?.isSandbox ?? (process.env.DLOCAL_GO_ENV === "sandbox");
    const baseUrl = this.overrideOpts?.baseUrl ?? (
      process.env.DLOCALGO_URL ||
      (isSandbox ? "https://api-sbx.dlocalgo.com/v1" : "https://api.dlocalgo.com/v1")
    );
    return { apiKey, secretKey, baseUrl: baseUrl.replace(/\/$/, "") };
  }

  isConfigured(): boolean {
    const { apiKey, secretKey } = this.getConfig();
    return Boolean(apiKey && secretKey);
  }

  async createSession(input: CreatePaymentSessionInput, orderId: string): Promise<PaymentSessionResponse> {
    const { apiKey, secretKey, baseUrl } = this.getConfig();
    if (!apiKey || !secretKey) {
      throw new Error("dLocal Go is not configured (missing DLOCAL_GO_API_KEY / DLOCAL_GO_SECRET_KEY)");
    }

    const res = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}:${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currency: input.currency,
        amount: Number(input.amount),
        country: input.currency === "COP" ? "CO" : "US",
        order_id: orderId,
        description: `Order ${orderId}`,
        success_url: input.redirectUrl || "/",
        back_url: input.redirectUrl || "/",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`dLocal Go createSession HTTP ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as { id?: string; redirect_url?: string };
    if (!data.redirect_url) {
      throw new Error("dLocal Go response missing redirect_url");
    }

    return {
      success: true,
      sessionId: data.id || orderId,
      redirectUrl: data.redirect_url,
      gateway: "dlocalgo",
      orderId,
    };
  }

  verifySignature(headers: Record<string, string>, rawBody: string): boolean {
    const { apiKey, secretKey } = this.getConfig();
    if (!secretKey) return false;

    const rawHeader = String(
      headers["x-dlocal-signature"] || headers["authorization"] || ""
    ).trim();
    if (!rawHeader) return false;

    const match = rawHeader.match(/Signature:\s*([a-fA-F0-9]+)/i);
    const sigHex = match ? match[1].toLowerCase() : (/^[a-fA-F0-9]{64}$/.test(rawHeader) ? rawHeader.toLowerCase() : "");
    if (sigHex.length !== 64) return false;

    const expectedHex = crypto
      .createHmac("sha256", secretKey)
      .update(`${apiKey}${rawBody}`, "utf8")
      .digest("hex")
      .toLowerCase();

    return crypto.timingSafeEqual(Buffer.from(expectedHex, "utf8"), Buffer.from(sigHex, "utf8"));
  }

  normalizeWebhook(body: Record<string, any>): NormalizedPaymentEvent {
    const raw = String(body.status || "PENDING").toUpperCase();
    const event =
      raw === "PAID" || raw === "COMPLETED"
        ? "payment.approved"
        : raw === "REJECTED" || raw === "DECLINED" || raw === "FAILED" || raw === "CANCELLED"
        ? "payment.declined"
        : "payment.pending";

    return {
      gateway: "dlocalgo",
      event,
      orderId: body.order_id || body.orderId || "unknown",
      transactionId: body.id || body.transaction_id || `dlg-${Date.now()}`,
      amount: Number(body.amount || 0),
      currency: body.currency || "USD",
      payerEmail: body.payer?.email,
      signatureValid: false,
      rawPayload: body,
    };
  }
}
