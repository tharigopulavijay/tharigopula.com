import { readFileSync, writeFileSync } from "node:fs";

/**
 * Normalises the Cloudflare config that Nitro generates at build time.
 *
 * Two things go wrong without this, and both have bitten production:
 *
 * 1. WORKER NAME. Nitro derives the worker name from the repository, producing
 *    "tharigopulavijay-tharigopula-com". Cloudflare CI overrides it to
 *    "tharigopula-com". The result was two separate workers — the custom domain
 *    tharigopula.com attached to one, CI deploying to the other. Deploys landed
 *    on whichever the last command happened to target, and the live site sat
 *    two days stale while builds "succeeded". Pinning the name here means every
 *    deploy, local or CI, updates the worker the domain actually points at.
 *
 * 2. PATH SEPARATORS. A build on Windows writes "..\\public" as the assets
 *    directory. Cloudflare's runtime is Linux and cannot resolve that, so every
 *    static asset 404s while the HTML still renders — a failure that looks like
 *    a caching problem rather than a broken deploy.
 *
 * Run after `vite build`, before `wrangler deploy`.
 */

const WRANGLER_CONFIG = ".output/server/wrangler.json";
const DEPLOY_CONFIG = ".wrangler/deploy/config.json";

/** The worker the custom domain tharigopula.com is attached to. */
const WORKER_NAME = "tharigopulavijay-tharigopula-com";

const toPosix = (p) => p.split("\\").join("/");

const wrangler = JSON.parse(readFileSync(WRANGLER_CONFIG, "utf8"));
const previousName = wrangler.name;
const previousDir = wrangler.assets?.directory;
const previousDate = wrangler.compatibility_date;

wrangler.name = WORKER_NAME;
if (wrangler.assets?.directory) {
  wrangler.assets.directory = toPosix(wrangler.assets.directory);
}

// 3. COMPATIBILITY DATE. Nitro stamps this from the local clock. India is
//    UTC+5:30, so from about 5:30am IST the local date is already tomorrow in
//    Cloudflare's terms and the API rejects the deploy outright:
//    "Can't set compatibility date in the future" [code: 10021].
//    Clamping to today's UTC date makes evening deploys work.
const utcToday = new Date().toISOString().slice(0, 10);
if (wrangler.compatibility_date > utcToday) {
  wrangler.compatibility_date = utcToday;
}

writeFileSync(WRANGLER_CONFIG, `${JSON.stringify(wrangler, null, 2)}\n`);

let deployNote = "not present";
try {
  const deploy = JSON.parse(readFileSync(DEPLOY_CONFIG, "utf8"));
  deploy.configPath = toPosix(deploy.configPath);
  writeFileSync(DEPLOY_CONFIG, JSON.stringify(deploy));
  deployNote = deploy.configPath;
} catch {
  // Nitro only writes this file for some presets; its absence is not an error.
}

console.log("prepare-deploy:");
console.log(`  worker name      ${previousName} -> ${wrangler.name}`);
console.log(`  assets directory ${previousDir} -> ${wrangler.assets?.directory}`);
console.log(
  `  compatibility    ${previousDate} -> ${wrangler.compatibility_date}` +
    (previousDate !== wrangler.compatibility_date ? "  (clamped to UTC today)" : ""),
);
console.log(`  deploy config    ${deployNote}`);
