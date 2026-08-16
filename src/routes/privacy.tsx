import { createFileRoute } from "@tanstack/react-router";
import { Section, SectionHeading } from "@/components/site/primitives";
import { site } from "@/data/site";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | Tharigopula Technologies" },
      { name: "description", content: "How Tharigopula Technologies collects, uses and protects enquiry and project information." },
      { property: "og:title", content: "Privacy Policy | Tharigopula Technologies" },
      { property: "og:description", content: "Our approach to data collected through this website." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <Section>
      <SectionHeading as="h1" eyebrow="Legal" title="Privacy Policy" />
      <div className="mt-8 max-w-3xl space-y-5 text-sm text-muted-foreground">
        <p>We collect only the information you share through enquiry forms: name, email, phone, business name and your project description.</p>
        <p>This information is used to respond to your enquiry, prepare proposals and maintain project communication. We do not sell or rent it.</p>
        <p>Project data handled during an engagement remains yours. Access is limited to the people working on your project and is governed by the agreement we sign.</p>
        <p>Third-party services such as hosting, email and analytics may process limited technical data required to deliver the site.</p>
        <p>To request access, correction or deletion of your information, write to {site.email}.</p>
      </div>
    </Section>
  );
}
