import crypto from "node:crypto";
import type { PaymentGatewayDriver } from "./types";
import type {
  CreatePaymentSessionInput,
  PaymentSessionResponse,
  NormalizedPaymentEvent,
} from "@astrobranding/contracts";

export class WompiDriver implements PaymentGatewayDriver {
  readonly id = "wompi" as const;
  readonly name = "Wompi Bancolombia (Colombia)";
  readonly supportedCurrencies = ["COP", "USD"];
  readonly supportedMethods = ["Bancolombia QR", "Nequi", "PSE", "Credit Card", "Bancolombia Transfer"];

  private getConfig() {
    return {
      publicKey: process.env.WOMPI_PUBLIC_KEY || "",
      privateKey: process.env.WOMPI_PRIVATE_KEY || "",
      integritySecret: process.env.WOMPI_INTEGRITY_SECRET || "",
      eventsSecret: process.env.WOMPI_EVENTS_SECRET || "",
    };
  }

  isConfigured(): boolean {
    const { publicKey, integritySecret } = this.getConfig();
    return Boolean(publicKey && integritySecret);
  }

  async createSession(input: CreatePaymentSessionInput, orderId: string): Promise<PaymentSessionResponse> {
    const { publicKey, integritySecret } = this.getConfig();
    if (!publicKey || !integritySecret) {
      throw new Error("Wompi is not configured (missing WOMPI_PUBLIC_KEY / WOMPI_INTEGRITY_SECRET)");
    }

    const amountInCents = Math.round(input.amount * 100);
    const sig = crypto
      .createHash("sha256")
      .update(`${orderId}${amountInCents}${input.currency}${integritySecret}`, "utf8")
      .digest("hex");

    const redirectUrl = `https://checkout.wompi.co/p/?public-key=${publicKey}&currency=${input.currency}&amount-in-cents=${amountInCents}&reference=${orderId}&signature:integrity=${sig}&redirect-url=${encodeURIComponent(input.redirectUrl || "/")}`;

    return {
      success: true,
      sessionId: orderId,
      redirectUrl,
      gateway: "wompi",
      orderId,
    };
  }

  verifySignature(headers: Record<string, string>, rawBody: string): boolean {
    const { eventsSecret } = this.getConfig();
    if (!eventsSecret) return false;
    try {
      const event = JSON.parse(rawBody);
      const props: string[] = Array.isArray(event?.signature?.properties) ? event.signature.properties : [];
      const checksum = String(event?.signature?.checksum || headers["x-event-checksum"] || "").trim().toLowerCase();
      if (!checksum || props.length === 0 || !event?.timestamp) return false;
      const concatenated = props
        .map((p) => p.split(".").reduce((acc: any, k: string) => (acc != null ? acc[k] : ""), event.data) ?? "")
        .join("");
      const expected = crypto
        .createHash("sha256")
        .update(`${concatenated}${event.timestamp}${eventsSecret}`, "utf8")
        .digest("hex")
        .toLowerCase();
      return expected.length === checksum.length && crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(checksum, "utf8"));
    } catch {
      return false;
    }
  }

  normalizeWebhook(body: Record<string, any>): NormalizedPaymentEvent {
    const tx = body.data?.transaction || body.transaction || body;
    const status = tx.status === "APPROVED"
      ? "payment.approved"
      : tx.status === "DECLINED" || tx.status === "ERROR"
      ? "payment.declined"
      : "payment.pending";

    return {
      gateway: "wompi",
      event: status,
      orderId: tx.reference || "unknown",
      transactionId: tx.id || `wompi-${Date.now()}`,
      amount: Number((tx.amount_in_cents || 0) / 100),
      currency: tx.currency || "COP",
      payerEmail: tx.customer_email,
      signatureValid: false,
      rawPayload: body,
    };
  }
}
