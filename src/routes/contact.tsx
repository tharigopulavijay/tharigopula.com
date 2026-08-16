import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Section, SectionHeading } from "@/components/site/primitives";
import { site, whatsappLink } from "@/data/site";
import {
  ESTIMATOR_HANDOFF_KEY,
  enquirySchema,
  enquiryWhatsappLink,
  submitEnquiry,
  type EnquiryInput,
} from "@/lib/enquiry";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Talk To A Technology Partner | Tharigopula Technologies" },
      {
        name: "description",
        content: "Tell us about your business and what is slowing it down. We reply with a practical direction, not a sales pitch.",
      },
      { property: "og:title", content: "Contact Tharigopula Technologies" },
      { property: "og:description", content: "Start a conversation about your website, software or automation project." },
    ],
  }),
  component: ContactPage,
});

type Sent = { reference: string; payload: EnquiryInput };

function ContactPage() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [handoff, setHandoff] = useState<string | null>(null);

  // Pick up an estimator breakdown if the visitor came from the configurator.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(ESTIMATOR_HANDOFF_KEY);
      if (stored) setHandoff(stored);
    } catch {
      /* private mode — proceed without the handoff */
    }
  }, []);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const raw = {
      ...Object.fromEntries(form),
      source: handoff ? "estimator" : "contact",
      ...(handoff ? { context: handoff } : {}),
    };

    const parsed = enquirySchema.safeParse(raw);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }

    setErrors({});
    setBusy(true);
    try {
      const result = await submitEnquiry({ data: parsed.data });
      setSent({ reference: result.reference, payload: parsed.data });
      try {
        sessionStorage.removeItem(ESTIMATOR_HANDOFF_KEY);
      } catch {
        /* ignore */
      }
    } catch {
      toast.error("That did not send. Please use WhatsApp or email below — we do not want to lose your message.");
    } finally {
      setBusy(false);
    }
  };

  const field = "mt-1.5 w-full rounded-md border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-foreground/40";

  return (
    <>
      <Section className="pb-8">
        <SectionHeading
          as="h1"
          eyebrow="Contact"
          title="Tell us what is slowing your business down"
          lead="A short description is enough to start. We will come back with a practical direction and an indicative range."
        />
      </Section>

      <Section className="pt-0">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          {sent ? (
            <div className="rounded-xl border border-signal bg-signal/5 p-6 sm:p-8">
              <p className="font-mono text-[10px] tracking-[0.16em] text-signal uppercase">Enquiry received</p>
              <h2 className="mt-3 font-display text-2xl font-semibold">Thanks, {sent.payload.name}.</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your reference is{" "}
                <span className="font-mono font-semibold text-foreground">{sent.reference}</span>. We reply within one
                business day.
              </p>
              <p className="mt-5 text-sm">
                Want a faster answer? Send the same details on WhatsApp — it arrives instantly with everything already
                filled in.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <a
                  href={enquiryWhatsappLink(sent.reference, sent.payload)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-ink px-5 py-3.5 text-center text-sm font-semibold text-ink-foreground"
                >
                  Send on WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => setSent(null)}
                  className="rounded-md border border-border px-5 py-3.5 text-center text-sm font-semibold"
                >
                  Send another enquiry
                </button>
              </div>
            </div>
          ) : (
          <form onSubmit={onSubmit} noValidate className="rounded-xl border border-border bg-card p-6 sm:p-8">
            {handoff ? (
              <div className="mb-6 rounded-lg border border-signal/40 bg-signal/5 p-4">
                <p className="font-mono text-[10px] tracking-[0.16em] text-signal uppercase">
                  Your estimate is attached
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  We will receive your configurator breakdown with this message, so you will not be asked to explain the
                  scope again.
                </p>
              </div>
            ) : null}
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Name
                <input name="name" className={field} maxLength={100} />
                {errors["name"] ? <span className="mt-1 block text-xs text-destructive">{errors["name"]}</span> : null}
              </label>
              <label className="block text-sm font-medium">
                Email
                <input name="email" type="email" className={field} maxLength={255} />
                {errors["email"] ? <span className="mt-1 block text-xs text-destructive">{errors["email"]}</span> : null}
              </label>
              <label className="block text-sm font-medium">
                Phone (optional)
                <input name="phone" className={field} maxLength={20} />
              </label>
              <label className="block text-sm font-medium">
                Business name (optional)
                <input name="company" className={field} maxLength={120} />
              </label>
            </div>
            <label className="mt-5 block text-sm font-medium">
              What would you like to improve?
              <textarea name="message" rows={6} className={field} maxLength={1500} />
              {errors["message"] ? <span className="mt-1 block text-xs text-destructive">{errors["message"]}</span> : null}
            </label>
            <button
              type="submit"
              disabled={busy}
              className="mt-6 rounded-md bg-ink px-5 py-3.5 text-sm font-semibold text-ink-foreground transition-opacity disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send enquiry"}
            </button>
          </form>
          )}

          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Direct</p>
              <a href={`mailto:${site.email}`} className="mt-2 block text-sm hover:underline">
                {site.email}
              </a>
              <a href={`tel:+${site.whatsapp}`} className="mt-1 block text-sm hover:underline">
                {site.phoneDisplay}
              </a>
              <a
                href={whatsappLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-block rounded-md border border-border px-4 py-2.5 text-sm font-semibold"
              >
                Message on WhatsApp
              </a>
            </div>
            <div className="rounded-xl border border-border bg-secondary/50 p-6 text-sm text-muted-foreground">
              Prefer structure? Use the project configurator to answer a few guided questions and receive an indicative
              estimate along with your enquiry.
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
