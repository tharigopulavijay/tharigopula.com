import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Section, SectionHeading } from "@/components/site/primitives";
import { site, whatsappLink } from "@/data/site";

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

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().max(20).optional(),
  company: z.string().trim().max(120).optional(),
  message: z.string().trim().min(10, "Tell us a little more").max(1500),
});

function ContactPage() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    e.currentTarget.reset();
    toast.success("Thanks — your enquiry is noted. We will reply within one business day.");
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
          <form onSubmit={onSubmit} noValidate className="rounded-xl border border-border bg-card p-6 sm:p-8">
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
            <button type="submit" className="mt-6 rounded-md bg-ink px-5 py-3.5 text-sm font-semibold text-ink-foreground">
              Send enquiry
            </button>
          </form>

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
