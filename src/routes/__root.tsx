import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";
import { site } from "@/data/site";
import { Navigation, WhatsAppFab } from "@/components/site/Navigation";
import { Footer } from "@/components/site/Footer";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Tharigopula Technologies — Technology built around your business" },
      {
        name: "description",
        content:
          "Websites, business software, automation, dashboards and AI for businesses that need one practical technology partner.",
      },
      { name: "author", content: "Tharigopula Technologies" },
      { property: "og:site_name", content: "Tharigopula Technologies" },
      { property: "og:type", content: "website" },
      // twitter:card was already summary_large_image, but no image was ever set —
      // so shared links rendered an empty card. These fill it.
      { property: "og:image", content: `${site.url}/og-image.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "Tharigopula Technologies — technology built around your business",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${site.url}/og-image.png` },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap",
      },
      { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      // NOTE: canonical is intentionally not set here. A single hardcoded value
      // told search engines every page was a duplicate of the homepage, which
      // de-indexed all of them. <CanonicalUrl /> below emits the correct
      // per-page URL instead.
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Emits the canonical URL and og:url for the page actually being viewed.
 *
 * React 19 hoists <link> and <meta> rendered anywhere in the tree into <head>,
 * so this stays correct on every route without each route repeating itself.
 * Demo routes are excluded from indexing already, so they get nothing.
 */
function CanonicalUrl() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // The five website demos are noindexed fictional sites — they need no canonical.
  // /demo/platform is a real product page, and its ?industry= variants must all
  // consolidate onto the bare path or they compete with each other.
  const isNoindexDemo = pathname.startsWith("/demo") && pathname !== "/demo/platform";
  if (isNoindexDemo) return null;

  // Strip any trailing slash so "/pricing/" and "/pricing" do not compete.
  const path = pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const url = path === "/" ? site.url : `${site.url}${path}`;

  return (
    <>
      <link rel="canonical" href={url} />
      <meta property="og:url" content={url} />
    </>
  );
}

/**
 * Organization and WebSite markup, emitted once on every page.
 *
 * Deliberately minimal: only facts that are verifiably true. No aggregateRating,
 * no review markup, no employee count, no founding date — Google penalises
 * fabricated structured data, and none of it can be substantiated here.
 */
function StructuredData() {
  const json = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${site.url}/#organization`,
        name: site.name,
        url: site.url,
        logo: `${site.url}/logo-mark.png`,
        image: `${site.url}/og-image.png`,
        description: site.supporting,
        email: site.email,
        telephone: `+${site.whatsapp}`,
        address: {
          "@type": "PostalAddress",
          addressLocality: "Hyderabad",
          addressRegion: "Telangana",
          addressCountry: "IN",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${site.url}/#website`,
        url: site.url,
        name: site.name,
        publisher: { "@id": `${site.url}/#organization` },
        inLanguage: "en-IN",
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Serialised, not user input — safe, and required for JSON-LD.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const isDemo = useRouterState({
    select: (s) => s.location.pathname.startsWith("/demo"),
  });

  if (isDemo) {
    return (
      <QueryClientProvider client={queryClient}>
        {/* Demos render without the site chrome, but /demo/platform is a real
            indexable page and still needs its canonical — CanonicalUrl decides
            which demo routes get one. */}
        <CanonicalUrl />
        <Outlet />
        <Toaster position="top-center" richColors />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <CanonicalUrl />
      <StructuredData />
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <main className="flex-1">
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </main>
        <Footer />
        <WhatsAppFab />
      </div>
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
