/* One cross-platform test runner. Shell `&&` chains behave differently on
   Windows and Unix and can hide which suite failed. Each child is the same
   Node executable running one named file; the first failure stops the run. */

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const tests = [
  'test/isolation.test.js',
  'test/clinical.test.js',
  'test/clinical-transactions.test.js',
  'test/billing-transactions.test.js',
  'test/appointment-transactions.test.js',
  'test/prescription-transactions.test.js',
  'test/stock-transactions.test.js',
  'test/patient-registration-transactions.test.js',
  'test/staff.test.js',
  'test/onboarding.test.js',
  'test/platform.test.js',
  'test/pepper-rotation.test.js',
  'test/security.test.js',
  'test/session-security.test.js',
  'test/owner-console.test.js',
  'test/ai-preflight.test.js',
  'test/ai-retention.test.js',
  'test/ai-drafts.test.js',
  'test/ai-merge.test.js',
  'test/fhir.test.js',
  'test/plans.test.js',
  'test/subscriptions.test.js',
  'test/abha.test.js',
  'test/whatsapp.test.js',
  'test/otp-sms.test.js',
  'test/email.test.js',
  'test/patient-numbers.test.js',
  'test/scribe.test.js',
  'test/webhook-security.test.js',
  'test/patient-portal.test.js',
  'test/rx-document.test.js',
  'test/care-plans.test.js',
  'test/plan-page.test.js',
  'test/entitlements.test.js',
  'test/website-screen.test.js',
  'test/clinic-site.test.js',
  'test/qr.test.js',
  'test/desk-boot.test.js',
  'test/desk-without-scratchpad.test.js',
  'test/consultation-draft.test.js',
  'test/verifier-actually-runs.test.js',
  'test/domains.test.js',
  'test/custom-hostname.test.js',
  'test/owner-dashboard.test.js',
  'test/coupons.test.js',
  'test/domain-admin.test.js',
  'test/leads.test.js',
  'test/clinic-fields.test.js',
  'test/consult-fields.test.js',
  'test/offline-payments.test.js',
  'test/demo-clinics.test.js',
  'test/owner-test-clinics.test.js',
  'test/mobile-app.test.js',
  'test/site-pages.test.js',
  'test/signin-usability.test.js',
  'test/app-boot.test.js',
  'test/passkeys.test.js',
  'test/clinic-overview.test.js',
  'test/publish-safety.test.js'
];

/* This list is hand-written, so a suite that is never added to it is a suite
   that never runs - and it reports nothing at all rather than failing, which
   is the worst way for a test to be broken. A green run over a file nobody
   executed is exactly the kind of shallow verification that has cost this
   project real incidents.

   So the directory is the authority and the list is checked against it. */
const onDisk = readdirSync('test')
  .filter(name => name.endsWith('.test.js'))
  .map(name => 'test/' + name);
const missing = onDisk.filter(file => !tests.includes(file));
if (missing.length) {
  console.error('\nThese suites exist but are not in scripts/run-tests.js, ' +
    'so they were never run:\n  ' + missing.join('\n  ') + '\n');
  process.exit(1);
}

for (const file of tests) {
  const result = spawnSync(process.execPath, [file], { stdio: 'inherit', shell: false });
  if (result.status !== 0) process.exit(result.status === null ? 1 : result.status);
}
