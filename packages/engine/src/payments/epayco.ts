import crypto from "node:crypto";
import type { PaymentGatewayDriver } from "./types";
import type {
  CreatePaymentSessionInput,
  PaymentSessionResponse,
  NormalizedPaymentEvent,
} from "@astrobranding/contracts";

export class EPaycoDriver implements PaymentGatewayDriver {
  readonly id = "epayco" as const;
  readonly name = "ePayco Davivienda (Colombia)";
  readonly supportedCurrencies = ["COP", "USD"];
  readonly supportedMethods = ["Daviplata", "PSE", "Credit Card", "Efecty", "SafetyPay"];

  private getConfig() {
    return {
      publicKey: process.env.EPAYCO_PUBLIC_KEY || "",
      pKey: process.env.EPAYCO_P_KEY || "",
      customerId: process.env.EPAYCO_P_CUST_ID_CLIENTE || "",
    };
  }

  isConfigured(): boolean {
    const { publicKey, pKey, customerId } = this.getConfig();
    return Boolean(publicKey && pKey && customerId);
  }

  async createSession(input: CreatePaymentSessionInput, orderId: string): Promise<PaymentSessionResponse> {
    const { publicKey } = this.getConfig();
    if (!publicKey) {
      throw new Error("ePayco is not configured (missing EPAYCO_PUBLIC_KEY)");
    }
    const redirectUrl = `https://checkout.epayco.co/checkout.html?public_key=${publicKey}&amount=${input.amount}&currency=${input.currency}&ref=${orderId}`;

    return {
      success: true,
      sessionId: orderId,
      redirectUrl: input.redirectUrl || redirectUrl,
      gateway: "epayco",
      orderId,
    };
  }

  verifySignature(_headers: Record<string, string>, rawBody: string): boolean {
    const { pKey, customerId } = this.getConfig();
    if (!pKey || !customerId) return false;
    try {
      const data = JSON.parse(rawBody);
      const refPayco = data.x_ref_payco || "";
      const transactionId = data.x_transaction_id || "";
      const amount = data.x_amount || "";
      const currency = data.x_currency_code || "COP";
      const signatureReceived = String(data.x_signature || "").trim().toLowerCase();
      if (signatureReceived.length !== 64) return false;

      const expected = crypto
        .createHash("sha256")
        .update(`${customerId}^${pKey}^${refPayco}^${transactionId}^${amount}^${currency}`, "utf8")
        .digest("hex")
        .toLowerCase();
      return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(signatureReceived, "utf8"));
    } catch {
      return false;
    }
  }

  normalizeWebhook(body: Record<string, any>): NormalizedPaymentEvent {
    const codRespuesta = Number(body.x_cod_response || body.x_cod_respuesta || 0);
    const status = codRespuesta === 1
      ? "payment.approved"
      : codRespuesta === 2 || codRespuesta === 4
      ? "payment.declined"
      : "payment.pending";

    return {
      gateway: "epayco",
      event: status,
      orderId: body.x_id_invoice || body.x_extra1 || "unknown",
      transactionId: body.x_transaction_id || body.x_ref_pay || `epayco-${Date.now()}`,
      amount: Number(body.x_amount || 0),
      currency: body.x_currency_code || "COP",
      payerEmail: body.x_customer_email,
      signatureValid: false,
      rawPayload: body,
    };
  }
}
