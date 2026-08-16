import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { site } from "@/data/site";

/**
 * Enquiry capture.
 *
 * Delivery is layered so a lead is never lost while the business is still
 * setting up infrastructure:
 *
 *   1. Every submission is written to the structured log, which Cloudflare
 *      Observability retains. Even with nothing else configured, the enquiry
 *      exists somewhere retrievable.
 *   2. If RESEND_API_KEY is present, an email goes to the business inbox.
 *   3. The client always offers a one-tap WhatsApp handoff carrying the full
 *      enquiry, so the visitor can deliver it themselves regardless.
 *
 * No secret is ever read on the client — the handler below is stripped from
 * the browser bundle by the TanStack Start compiler.
 */

/**
 * sessionStorage key the project configurator writes its breakdown to before
 * sending a visitor to /contact, so the enquiry arrives with the scope attached.
 */
export const ESTIMATOR_HANDOFF_KEY = "tt:estimator-handoff";

export const enquirySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().max(20).optional(),
  company: z.string().trim().max(120).optional(),
  message: z.string().trim().min(10, "Tell us a little more").max(1500),
  /** Which surface produced this — "contact", "estimator", etc. */
  source: z.string().trim().max(40).optional(),
  /** Optional estimator breakdown carried across from the configurator. */
  context: z.string().trim().max(4000).optional(),
});

export type EnquiryInput = z.input<typeof enquirySchema>;
export type Enquiry = z.output<typeof enquirySchema>;

/** Short human-quotable reference, e.g. "TT-M8X2QK". */
function makeReference(): string {
  return `TT-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

function plainText(reference: string, d: Enquiry): string {
  const lines = [
    `New enquiry — ${reference}`,
    "",
    `Name:     ${d.name}`,
    `Email:    ${d.email}`,
    `Phone:    ${d.phone || "—"}`,
    `Business: ${d.company || "—"}`,
    `Source:   ${d.source || "contact"}`,
    "",
    "Message",
    "-------",
    d.message,
  ];
  if (d.context) {
    lines.push("", "Estimator breakdown", "-------------------", d.context);
  }
  lines.push("", `Reply directly to this email to reach ${d.name}.`);
  return lines.join("\n");
}

/** Builds the WhatsApp handoff message shown to the visitor after submitting. */
export function enquiryWhatsappLink(reference: string, d: EnquiryInput): string {
  const parts = [
    `Hello ${site.short}, I just sent an enquiry from your website.`,
    `Reference: ${reference}`,
    `Name: ${d.name}`,
    d.company ? `Business: ${d.company}` : "",
    "",
    d.message,
  ].filter(Boolean);
  if (d.context) parts.push("", d.context);
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(parts.join("\n"))}`;
}

export const submitEnquiry = createServerFn({ method: "POST" })
  .validator((input: unknown) => enquirySchema.parse(input))
  .handler(async ({ data }) => {
    const reference = makeReference();

    // Safety net: retained by Cloudflare Observability even if delivery fails.
    console.log(`[enquiry] ${JSON.stringify({ reference, ...data })}`);

    let emailed = false;
    const apiKey = process.env["RESEND_API_KEY"];

    if (apiKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            from: process.env["ENQUIRY_FROM"] ?? "Tharigopula Website <onboarding@resend.dev>",
            to: [process.env["ENQUIRY_TO"] ?? site.email],
            reply_to: data.email,
            subject: `New enquiry ${reference} — ${data.name}${data.company ? ` (${data.company})` : ""}`,
            text: plainText(reference, data),
          }),
        });
        emailed = response.ok;
        if (!response.ok) {
          console.error(`[enquiry] resend ${response.status}: ${await response.text()}`);
        }
      } catch (error) {
        console.error("[enquiry] email delivery threw", error);
      }
    }

    return { ok: true as const, reference, emailed };
  });
