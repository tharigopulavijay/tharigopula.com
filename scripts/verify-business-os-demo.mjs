import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { Script, createContext, runInContext } from "node:vm";

const html = await readFile(new URL("../public/demos/business-os.html", import.meta.url), "utf8");
const expected = [
  "v1.7 &middot; clear connections",
  "sims_os_public_demo_v16",
  "sims_os_public_trial_db_v16",
  "sims_os_public_mode_v16",
  "My test data",
  "Live · locked",
  "var PUBLIC_DEMO = true;",
  "People & Pay",
  "Web Enquiries",
];
const forbidden = [
  "Suvidha Inspection Methods",
  "Vijay Tharigopula",
  "sims_os_db_v1",
  "sims_os_trial_db_v1",
  "sims_os_mode_v1",
  "36AAZFS2897N1ZU",
  "sales@simsndt.com",
];
for (const value of expected) {
  if (!html.includes(value)) throw new Error(`Missing from public demo: ${value}`);
}
for (const value of forbidden) {
  if (html.includes(value)) throw new Error(`Restricted text in public demo: ${value}`);
}
if (/(?<!\d)[6-9]\d{9}(?!\d)/.test(html)) {
  throw new Error("A potentially real Indian mobile number remains in the public demo.");
}

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
if (scripts.length !== 1)
  throw new Error(`Expected one inline application script, found ${scripts.length}.`);
const application = new Script(scripts[0][1], { filename: "business-os.html" });
const sandbox = {
  window: { addEventListener() {} },
  document: { addEventListener() {} },
  localStorage: {
    getItem() {
      return null;
    },
    setItem() {},
  },
  navigator: { onLine: true },
  location: { hash: "#dashboard" },
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
};
const context = createContext(sandbox);
application.runInContext(context);
runInContext("DB = { leads: [], employees: [{ id: 'EMP-2', role: 'sales' }] };", context);
const csv = [
  "Reference,Company,Contact,Mobile,Email,City,Product,Requirement",
  'IM-1,"Acme, Engineering",Meera,9876543210,meera@example.com,Pune,Magnetic Yoke,"Coil, 220 mm"',
  'IM-1,"Acme, Engineering",Meera,9876543210,meera@example.com,Pune,Magnetic Yoke,"Coil, 220 mm"',
  "IM-2,,,,,,,",
].join("\r\n");
context.testCsv = csv;
const preview = runInContext("mapMarketplaceRows(testCsv, 'IndiaMART')", context);
assert.equal(preview.rows.length, 1);
assert.equal(preview.rows[0].company, "Acme, Engineering");
assert.equal(preview.rows[0].notes, "Coil, 220 mm");
assert.equal(preview.rows[0].sourceRef, "IndiaMART:IM-1");
assert.equal(preview.duplicates, 1);
assert.equal(preview.invalid, 1);
const connectionPage = runInContext("renderConnections()", context);
for (const label of [
  "SIMS website",
  "IndiaMART &amp; TradeIndia",
  "WhatsApp",
  "Gmail",
  "TallyPrime",
  "Biometric attendance",
  "Serial-first service assistant",
]) {
  assert.ok(connectionPage.includes(label), `Connections page misses ${label}`);
}
assert.equal(runInContext("NAV.some(page => page.id === 'connections')", context), true);
const trialStorage = new Map([["sims_os_public_mode_v16", "trial"]]);
const trial = createContext({
  ...sandbox,
  localStorage: {
    getItem: key => trialStorage.get(key) ?? null,
    setItem: (key, value) => trialStorage.set(key, String(value)),
    removeItem: key => trialStorage.delete(key),
  },
});
application.runInContext(trial);
runInContext("loadDB()", trial);
assert.equal(runInContext("WORKSPACE_MODE", trial), "trial");
assert.equal(runInContext("DB.customers.length", trial), 0);
assert.equal(runInContext("DB.salesInvoices.length", trial), 0);
assert.equal(runInContext("syncReady()", trial), false);
assert.equal(runInContext("PUBLIC_DEMO", trial), true);
assert.ok(trialStorage.has("sims_os_public_trial_db_v16"));
console.log("SIMS public demo: sanitization, JavaScript and marketplace import OK.");
