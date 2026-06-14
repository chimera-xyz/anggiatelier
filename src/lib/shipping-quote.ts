import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { ShippingOption } from "./types";

type QuotePayload = ShippingOption & { productId: string; postalCode: string; expiresAt: number };

function secret() {
  return process.env.SHIPPING_QUOTE_SECRET || process.env.ADMIN_SESSION_SECRET || "anggi-local-shipping-quotes";
}

function signature(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function signShippingQuote(option: ShippingOption, productId: string, postalCode: string) {
  const payload: QuotePayload = { ...option, token: undefined, productId, postalCode, expiresAt: Date.now() + 15 * 60_000 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

export function verifyShippingQuote(token: string, productId: string, postalCode: string): ShippingOption | null {
  try {
    const [encoded, received] = token.split(".");
    const expected = signature(encoded);
    const left = Buffer.from(received || "");
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as QuotePayload;
    if (payload.expiresAt < Date.now() || payload.productId !== productId || payload.postalCode !== postalCode) return null;
    return { id: payload.id, courier: payload.courier, service: payload.service, price: payload.price, eta: payload.eta, token };
  } catch {
    return null;
  }
}
