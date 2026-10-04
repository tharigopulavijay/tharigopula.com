import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// The SIMS repository owns the application. This site only publishes a
// fictional, isolated showcase snapshot; do not develop a second OS here.
const source = process.argv[2];
if (!source) {
  console.error("Usage: node scripts/publish-business-os-demo.mjs <SIMS_Business_OS.html>");
  process.exit(1);
}

const input = await readFile(resolve(source), "utf8");
if (!input.includes("v1.7 &middot; clear connections")) {
  throw new Error("Expected the reviewed SIMS Business OS v1.7 source.");
}

let output = input
  .replaceAll(
    "SIMS - Suvidha Inspection Methods & Systems",
    "SIMS — Sri Industrial Magnetic Solutions",
  )
  .replaceAll(
    "SIMS - Suvidha Inspection Methods &amp; Systems",
    "SIMS — Sri Industrial Magnetic Solutions",
  )
  .replaceAll("Vijay Tharigopula", "Demo Owner")
  .replaceAll("sims_os_db_v1", "sims_os_public_demo_v16")
  .replaceAll("sims_os_trial_db_v1", "sims_os_public_trial_db_v16")
  .replaceAll("sims_os_device_v1", "sims_os_public_device_v16")
  .replaceAll("sims_os_sync_v1", "sims_os_public_sync_v16")
  .replaceAll("sims_os_trial_sync_v1", "sims_os_public_trial_sync_v16")
  .replaceAll("sims_os_mode_v1", "sims_os_public_mode_v16")
  .replace("var PUBLIC_DEMO = false;", "var PUBLIC_DEMO = true;")
  // These are invented-looking examples, but a valid Indian mobile number may
  // belong to a real person. Do not expose actionable contact links in a demo.
  .replace(/\bmobile:'[6-9]\d{9}'/g, "mobile:'0000000000'")
  .replace("phone: '+91 98480 00000'", "phone: '+91 00000 00000'");

const forbidden = [
  "Suvidha Inspection Methods",
  "36AAZFS2897N1ZU",
  "0907016669",
  "+91 94400 66029",
  "sales@simsndt.com",
  "Vijay Tharigopula",
  "sims_os_db_v1",
  "sims_os_sync_v1",
  "var PUBLIC_DEMO = false;",
];
for (const value of forbidden) {
  if (output.includes(value))
    throw new Error(`Public demo still contains restricted text: ${value}`);
}
if (/(?<!\d)[6-9]\d{9}(?!\d)/.test(output)) {
  throw new Error("A potentially real Indian mobile number remains in the public demo.");
}

output =
  "<!-- Generated from the SIMS Business OS v1.7 source; fictional public demo, not the canonical application. -->\n" +
  output;
await writeFile(new URL("../public/demos/business-os.html", import.meta.url), output);
console.log("Published sanitized SIMS Business OS v1.7 showcase snapshot.");
