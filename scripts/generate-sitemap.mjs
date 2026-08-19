import { writeFileSync } from "node:fs";
import { createRunnableDevEnvironment, createServer } from "vite";

/**
 * Generates public/sitemap.xml from the site's own data.
 *
 * Written as a script rather than a hand-maintained file because the industry,
 * portfolio and template lists change — a static sitemap would quietly go stale
 * and start pointing search engines at URLs that no longer exist.
 *
 * Loads the TypeScript data through Vite so there is exactly one definition of
 * what pages exist. Run as part of the build.
 */

const ORIGIN = "https://tharigopula.com";

/** Pages that exist regardless of data, with how often they genuinely change. */
const STATIC_ROUTES = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/solutions", priority: "0.9", changefreq: "monthly" },
  { path: "/industries", priority: "0.9", changefreq: "monthly" },
  { path: "/website-studio", priority: "0.9", changefreq: "monthly" },
  { path: "/experience-lab", priority: "0.9", changefreq: "monthly" },
  { path: "/portfolio", priority: "0.8", changefreq: "monthly" },
  { path: "/pricing", priority: "0.9", changefreq: "monthly" },
  { path: "/start-project", priority: "0.8", changefreq: "monthly" },
  { path: "/demo/platform", priority: "0.8", changefreq: "monthly" },
  { path: "/about", priority: "0.6", changefreq: "yearly" },
  { path: "/contact", priority: "0.7", changefreq: "yearly" },
  { path: "/privacy", priority: "0.2", changefreq: "yearly" },
  { path: "/terms", priority: "0.2", changefreq: "yearly" },
];

const xmlEscape = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Vite 8 removed ssrLoadModule in favour of the environment API. A runnable SSR
// environment lets this script import the app's own .ts data files directly, so
// the sitemap is generated from the same source the site renders from.
// configFile:false matters — loading the app's own Vite config pulls in the
// Nitro/Cloudflare plugins, which replace the SSR environment with a worker
// emulation this script cannot import from. The data files only use relative
// imports, so they need no aliases or plugins.
const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
  environments: {
    ssr: { dev: { createEnvironment: createRunnableDevEnvironment } },
  },
});

try {
  const load = (p) => vite.environments.ssr.runner.import(p);
  const { industries } = await load("/src/data/industries.ts");
  const { caseStudies } = await load("/src/data/portfolio.ts");
  const { templates } = await load("/src/data/templates.ts");

  const entries = [
    ...STATIC_ROUTES,
    ...industries.map((i) => ({
      path: `/industries/${i.slug}`,
      priority: "0.8",
      changefreq: "monthly",
    })),
    ...caseStudies.map((c) => ({
      path: `/portfolio/${c.slug}`,
      priority: "0.7",
      changefreq: "yearly",
    })),
    ...templates.map((t) => ({
      path: `/website-studio/${t.slug}`,
      priority: "0.7",
      changefreq: "monthly",
    })),
  ];

  const lastmod = new Date().toISOString().slice(0, 10);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <url>
    <loc>${xmlEscape(ORIGIN + e.path)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

  writeFileSync("public/sitemap.xml", xml);
  console.log(
    `sitemap: ${entries.length} urls ` +
      `(${STATIC_ROUTES.length} static, ${industries.length} industries, ` +
      `${caseStudies.length} case studies, ${templates.length} templates)`,
  );
} finally {
  await vite.close();
}
