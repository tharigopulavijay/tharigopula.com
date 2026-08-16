import { createFileRoute } from "@tanstack/react-router";
import { Section, SectionHeading } from "@/components/site/primitives";
import { site } from "@/data/site";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service | Tharigopula Technologies" },
      { name: "description", content: "Terms covering estimates, scope, payments, third-party costs and support for Tharigopula Technologies projects." },
      { property: "og:title", content: "Terms of Service | Tharigopula Technologies" },
      { property: "og:description", content: "How we scope, quote and deliver work." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <Section>
      <SectionHeading as="h1" eyebrow="Legal" title="Terms of Service" />
      <div className="mt-8 max-w-3xl space-y-5 text-sm text-muted-foreground">
        <p>All prices shown on this website are indicative starting ranges. Final pricing is confirmed in a written proposal after scope discussion.</p>
        <p>Work is delivered against an agreed scope. Additional features, integrations or design rounds beyond the agreed scope are quoted separately.</p>
        <p>Third-party costs — domains, hosting, databases, messaging, payment gateways, AI usage, store accounts and licences — are billed at actuals or paid directly by you.</p>
        <p>Timelines assume timely content, feedback and approvals. Delays in inputs shift delivery dates accordingly.</p>
        <p>Ownership of delivered code and design transfers on full payment. Support plans are billed monthly and can be cancelled with notice.</p>
        <p>Questions about these terms: {site.email}.</p>
      </div>
    </Section>
  );
}
