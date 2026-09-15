import { createFileRoute, Link } from "@tanstack/react-router";
import { Container, Section } from "@/components/site/primitives";
import { ProjectStatusBadge } from "@/components/site/ProjectStatusBadge";
import { CTABanner } from "@/components/site/CTABanner";
import { products, type Product } from "@/data/products";
import { statusMeta } from "@/data/project-status";
import { whatsappLink } from "@/data/site";
import { productIcon } from "@/components/site/ProductIcons";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      {
        title:
          "Products — Clinical, Education, Industrial, Hotel & Veterinary Systems | Tharigopula Technologies",
      },
      {
        name: "description",
        content:
          "Management systems we build and own — clinical, educational, industrial, hotel and veterinary. Each one says plainly whether it is live, in development or a prototype.",
      },
      { property: "og:title", content: "Products | Tharigopula Technologies" },
      {
        property: "og:description",
        content:
          "Five management systems for clinics, schools, manufacturers, hotels and veterinary practices.",
      },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-secondary/50 to-background">
        <Container className="relative py-10 sm:py-12 lg:py-14">
          <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              Home
            </Link>
            <span aria-hidden className="px-2">
              ›
            </span>
            <span className="text-signal">Products</span>
          </nav>

          <div className="max-w-3xl reveal">
            <h1 className="font-display text-4xl leading-[1.06] font-semibold tracking-tight sm:text-5xl lg:text-[3.35rem]">
              Systems we build
              <br />
              and <span className="text-signal">keep building.</span>
            </h1>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Most of our work is built around one business at a time. These are the exceptions —
              systems we own, develop continuously, and shape to a sector rather than a single
              client. Each one says plainly where it stands.
            </p>
          </div>
        </Container>
      </section>

      <Section className="pt-10">
        <div className="grid gap-5 lg:grid-cols-2">
          {products.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </Section>

      {/* The honesty note. Five products at five different stages invites the
          obvious question, so it gets answered before it is asked. */}
      <Section className="pt-0">
        <div className="rounded-2xl border border-border bg-secondary/50 p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold sm:text-2xl">
            Why each one carries a label
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            These are at genuinely different stages. One has a full working version you can open on
            this site; one is a separate venture already serving people; two are being built now.
            Presenting them as a uniform product line would read better and be untrue, and a buyer
            who discovers that later stops believing the rest of the site as well.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            If a system you need is in development, that is often the best moment to talk — it gets
            built around your business instead of adapted to it afterwards.
          </p>
        </div>
      </Section>

      <Section className="pt-0">
        <CTABanner
          title="Need one of these shaped around your business?"
          body="Tell us how your work actually moves today. We'll show you the version of this built for it, and say honestly how much is ready now."
          primary={{ to: "/start-project", label: "Get project estimate" }}
          whatsapp={whatsappLink(
            "Hello Tharigopula Technologies, I would like to know more about your management systems.",
          )}
        />
      </Section>
    </>
  );
}

function ProductCard({ product }: { product: Product }) {
  const Icon = productIcon(product.slug);
  const meta = statusMeta(product.status);

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <span
            aria-hidden
            className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl"
            style={{
              background: `color-mix(in srgb, ${product.accent} 14%, transparent)`,
              color: `color-mix(in oklab, ${product.accent}, var(--accent-toward) var(--accent-lift))`,
            }}
          >
            {product.logo ? (
              <img
                src={product.logo.mark}
                alt=""
                width={160}
                height={146}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-contain p-0.5"
              />
            ) : (
              <Icon />
            )}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg leading-snug font-semibold">
              {product.logo ? (
                /* The alt text names the heading, so no duplicate label is needed. */
                <img
                  src={product.logo.wordmark}
                  alt={product.logo.alt}
                  width={360}
                  height={98}
                  loading="lazy"
                  decoding="async"
                  className="h-[22px] w-auto"
                />
              ) : (
                product.name
              )}
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">{product.audience}</p>
          </div>
        </div>
        <ProjectStatusBadge status={product.status} className="shrink-0" />
      </div>

      <p className="mt-4 text-[15px] leading-snug font-medium">{product.promise}</p>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{product.body}</p>

      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {product.modules.map((m) => (
          <li key={m} className="flex gap-2 text-[13px] leading-snug">
            <span
              aria-hidden
              className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: product.accent }}
            />
            {m}
          </li>
        ))}
      </ul>

      {/* Status meaning sits on the card, not hidden on a detail page — the
          label alone is not self-explanatory to someone seeing it once. */}
      <p className="mt-5 text-[13px] leading-snug text-muted-foreground">
        {product.note ?? meta.meaning}
      </p>

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        {product.demoTo ? (
          <Link
            to={product.demoTo}
            className="inline-flex items-center gap-2 rounded-lg bg-signal px-4 py-2.5 text-sm font-semibold text-signal-foreground transition-opacity hover:opacity-90"
          >
            Open the working demo <span aria-hidden>→</span>
          </Link>
        ) : null}

        {product.externalUrl ? (
          <a
            href={product.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:border-foreground/25"
          >
            Visit {product.name} <span aria-hidden>↗</span>
          </a>
        ) : null}

        <Link
          to="/contact"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:border-foreground/25"
        >
          {product.status === "in-build" ? "Talk to us about it" : "Request a walkthrough"}
        </Link>
      </div>
    </article>
  );
}
