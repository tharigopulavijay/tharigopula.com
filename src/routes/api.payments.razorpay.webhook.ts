import { createFileRoute } from "@tanstack/react-router";

const encoder = new TextEncoder();

function bytesToHex(value: ArrayBuffer) {
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret: string, value: ArrayBuffer | string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = typeof value === "string" ? encoder.encode(value) : value;
  return bytesToHex(await crypto.subtle.sign("HMAC", key, data));
}

async function safeEqualHex(provided: string, expected: string) {
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided.toLowerCase())),
    crypto.subtle.digest("SHA-256", encoder.encode(expected.toLowerCase())),
  ]);
  return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
}

export const Route = createFileRoute("/api/payments/razorpay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env["RAZORPAY_WEBHOOK_SECRET"];
        const sharedSecret = process.env["ZNUFFI_BILLING_SHARED_SECRET"];
        const znuffiApiUrl = process.env["ZNUFFI_API_URL"] ?? "https://znuffi-api.hello-znuffi.workers.dev";
        if (!webhookSecret || !sharedSecret) return Response.json({ error: "webhook_not_configured" }, { status: 503 });
        if (Number(request.headers.get("content-length") ?? 0) > 262_144) {
          return Response.json({ error: "request_too_large" }, { status: 413 });
        }
        const raw = await request.arrayBuffer();
        const received = request.headers.get("x-razorpay-signature") ?? "";
        const expected = await hmacHex(webhookSecret, raw);
        if (!/^[a-f0-9]{64}$/i.test(received) || !(await safeEqualHex(received, expected))) {
          return Response.json({ error: "invalid_signature" }, { status: 403 });
        }

        const event = JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>;
        if (event["event"] !== "payment_link.paid") return Response.json({ accepted: true, ignored: true });
        const payload = event["payload"] as Record<string, unknown> | undefined;
        const link = (payload?.["payment_link"] as Record<string, unknown> | undefined)?.["entity"] as Record<string, unknown> | undefined;
        const payment = (payload?.["payment"] as Record<string, unknown> | undefined)?.["entity"] as Record<string, unknown> | undefined;
        const notes = link?.["notes"] as Record<string, unknown> | undefined;
        if (notes?.["product"] !== "znuffi" || notes?.["purpose"] !== "b2b_software_subscription") {
          return Response.json({ accepted: true, ignored: true });
        }

        const normalized = JSON.stringify({
          eventId: request.headers.get("x-razorpay-event-id") || `payment_link.paid:${String(link?.["id"] ?? "")}`,
          eventType: "payment_link.paid",
          intentId: String(notes["intent_id"] ?? ""),
          organizationId: String(notes["organization_id"] ?? ""),
          planCatalogId: String(notes["plan_catalog_id"] ?? ""),
          paymentLinkId: String(link?.["id"] ?? ""),
          paymentId: String(payment?.["id"] ?? ""),
          amountPaise: Number(payment?.["amount"] ?? link?.["amount_paid"] ?? 0),
          currency: String(payment?.["currency"] ?? link?.["currency"] ?? "INR"),
          paidAt: Number(payment?.["created_at"] ?? 0),
        });
        const signature = await hmacHex(sharedSecret, normalized);
        const forwarded = await fetch(`${znuffiApiUrl}/v1/billing/parent-events`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-tharigopula-signature": signature },
          body: normalized,
        });
        if (!forwarded.ok) {
          console.error(JSON.stringify({ event: "znuffi_payment_forward_failed", status: forwarded.status }));
          return Response.json({ error: "activation_failed" }, { status: 502 });
        }
        return Response.json({ accepted: true });
      },
    },
  },
});
