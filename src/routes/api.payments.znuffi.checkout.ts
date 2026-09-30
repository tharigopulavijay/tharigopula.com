import { createFileRoute } from "@tanstack/react-router";

type CheckoutIntent = {
  intentId: string;
  organizationId: string;
  planCatalogId: string;
  planName: string;
  cadence: "monthly" | "yearly";
  amountPaise: number;
  currency: "INR";
  customerEmail: string;
  expiresAt: number;
};

const encoder = new TextEncoder();

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

function base64UrlDecode(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function bytesToHex(value: ArrayBuffer) {
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function safeEqualHex(provided: string, expected: string) {
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided.toLowerCase())),
    crypto.subtle.digest("SHA-256", encoder.encode(expected.toLowerCase())),
  ]);
  return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
}

async function verifyIntent(token: string, secret: string): Promise<CheckoutIntent | null> {
  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra || !/^[a-f0-9]{64}$/i.test(signature)) return null;
  const expected = await hmacHex(secret, encodedPayload);
  if (!(await safeEqualHex(signature, expected))) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload))) as CheckoutIntent;
    const valid =
      payload.currency === "INR" &&
      ["monthly", "yearly"].includes(payload.cadence) &&
      Number.isInteger(payload.amountPaise) &&
      payload.amountPaise > 0 &&
      payload.amountPaise <= 2_500_000_00 &&
      payload.expiresAt > Math.floor(Date.now() / 1000) &&
      payload.expiresAt <= Math.floor(Date.now() / 1000) + 900 &&
      Boolean(payload.intentId && payload.organizationId && payload.planCatalogId && payload.planName);
    return valid ? payload : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/payments/znuffi/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sharedSecret = process.env["ZNUFFI_BILLING_SHARED_SECRET"];
        const keyId = process.env["RAZORPAY_KEY_ID"];
        const keySecret = process.env["RAZORPAY_KEY_SECRET"];
        if (!sharedSecret || !keyId || !keySecret) {
          return json({ error: "billing_not_configured" }, 503);
        }
        if (Number(request.headers.get("content-length") ?? 0) > 16_384) {
          return json({ error: "request_too_large" }, 413);
        }
        const body = (await request.json().catch(() => null)) as { token?: string } | null;
        const token = String(body?.token ?? "");
        const intent = await verifyIntent(token, sharedSecret);
        if (!intent) return json({ error: "invalid_or_expired_intent" }, 400);

        const authorization = btoa(`${keyId}:${keySecret}`);
        const response = await fetch("https://api.razorpay.com/v1/payment_links", {
          method: "POST",
          headers: {
            authorization: `Basic ${authorization}`,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            amount: intent.amountPaise,
            currency: "INR",
            accept_partial: false,
            reference_id: intent.intentId.slice(0, 40),
            description: `Znuffi ${intent.planName} ${intent.cadence} software subscription`,
            customer: { email: intent.customerEmail || undefined },
            notify: { sms: false, email: false },
            reminder_enable: false,
            expire_by: Math.floor(Date.now() / 1000) + 86400,
            callback_url: `https://tharigopula.com/pay/znuffi/complete?intent=${encodeURIComponent(intent.intentId)}`,
            callback_method: "get",
            notes: {
              product: "znuffi",
              purpose: "b2b_software_subscription",
              intent_id: intent.intentId,
              organization_id: intent.organizationId,
              plan_catalog_id: intent.planCatalogId,
              cadence: intent.cadence,
            },
          }),
        });
        const result = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        if (!response.ok || !result?.["short_url"]) {
          console.error(JSON.stringify({ event: "razorpay_payment_link_failed", status: response.status }));
          return json({ error: "payment_provider_unavailable" }, 502);
        }
        return json({ checkoutUrl: result["short_url"], paymentLinkId: result["id"] }, 201);
      },
    },
  },
});
