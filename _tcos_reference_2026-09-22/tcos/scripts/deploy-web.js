/* =========================================================================
   Deploy the doctor-facing site.

   Everything here is a guard. The build is one line; the rest is the set of
   mistakes that were possible on 7 September 2026, written down so they
   stop being possible:

     - deploying the repository root, which published .dev.vars containing
       the OpenAI key and the password pepper;
     - labelling every upload "main" whatever branch it came from, so no
       deployment could be traced to its code;
     - deploying uncommitted work to production, which cannot be rolled back
       to because the code that made it exists on one laptop.

   Usage:  node scripts/deploy-web.js production
           node scripts/deploy-web.js preview
           node scripts/deploy-web.js staging
   ========================================================================= */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/* Staging is a separate Pages project, and it was leaking too: its own
   .dev.vars was public with a PEPPER in it. It goes through the same build
   for the same reason. */
/* Each Pages project has its own idea of which branch name means "this is
   the live one". tcos calls it main; tcos-staging calls it staging. Deploy
   under the wrong name and the upload silently becomes a preview: the
   command succeeds, prints a URL, and the site nobody asked about carries
   on serving the old build. That is exactly what happened on the first
   attempt to clean staging, so the branch is written down here rather than
   remembered. `null` means "whatever branch is checked out". */
const TARGETS = {
  production: { project: 'tcos',         branch: 'main' },
  preview:    { project: 'tcos',         branch: null },
  staging:    { project: 'tcos-staging', branch: 'staging' }
};

const target = (process.argv[2] || '').toLowerCase();

if (!TARGETS[target]) {
  console.log('\nSay which one:  node scripts/deploy-web.js production | preview | staging\n');
  process.exit(1);
}

const PROJECT = TARGETS[target].project;

const git = args => spawnSync('git', args, { encoding: 'utf8' }).stdout?.trim() || '';
const WRANGLER = fileURLToPath(
  new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));

const sha = git(['rev-parse', 'HEAD']);
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
const dirty = git(['status', '--porcelain']);

if (!sha) {
  console.log('\nNot a git checkout, so this deployment could not be traced to any commit. Refusing.\n');
  process.exit(1);
}

/* A production deployment must be reproducible. If the working tree has
   changes that are not committed, the deployed site exists nowhere but this
   computer - and "roll back to the previous release" has no meaning. */
if (target !== 'preview' && dirty) {
  console.log('\nRefusing to deploy uncommitted work to ' + target + '.\n');
  console.log('These files differ from the last commit:\n');
  for (const line of dirty.split('\n').slice(0, 20)) console.log('  ' + line);
  console.log('\nCommit them first, or deploy a preview instead:');
  console.log('  npm run deploy:web:preview\n');
  process.exit(1);
}

/* Build. The build refuses on its own if the output contains anything
   private, so a non-zero exit here must stop the deploy. */
const build = spawnSync(process.execPath, ['scripts/build-public.js'], { stdio: 'inherit' });
if (build.status !== 0) {
  console.log('The build refused. Nothing was deployed.\n');
  process.exit(1);
}

/* Cloudflare treats the project's production branch specially. Sending a
   preview under its real branch name keeps it off the production URL and
   makes the dashboard readable. */
const label = TARGETS[target].branch || branch;

console.log('Deploying ' + target + ' -> ' + PROJECT +
            '  branch=' + label + '  commit=' + sha.slice(0, 7) + '\n');

/* Pages refuses the --config flag supported by Worker deploys. This checkout
   may also sit under a Codex-generated .wrangler/deploy/config.json, so
   allowing Wrangler to discover configs from the current directory makes
   the result depend on where the worktree happens to live. Run it from an
   empty temporary cwd and pass the already-audited dist path explicitly. */
const isolatedCwd = mkdtempSync(join(tmpdir(), 'tcos-pages-'));
let deploy;
try {
  deploy = spawnSync(process.execPath, [
    WRANGLER, 'pages', 'deploy', resolve('dist'),
    '--cwd=' + isolatedCwd,
    '--project-name=' + PROJECT,
    '--branch=' + label,
    '--commit-hash=' + sha,
    '--commit-dirty=' + (dirty ? 'true' : 'false')
  ], { stdio: 'inherit', shell: false });
} finally {
  rmSync(isolatedCwd, { recursive: true, force: true });
}

/* THE OWNER CONSOLE IS NOT ON PAGES.
 *
   This script deploys the Pages project, which serves the DOCTOR app at
   tcos.pages.dev. The console moved onto the Worker's own hostname on
   20 Sep 2026, and the Worker serves its own copy of dist/ through the
   ASSETS binding - uploaded by deploy-api.js and by nothing else.
 *
   So a console change deployed with this script goes live on Pages and
   changes nothing the owner can see. That happened, and it cost Vijay a
   round trip: "its done but i see no change." Both hosts were serving a
   console, and they were different builds.
 *
   Saying so here is cheaper than remembering it. */
if (deploy.status === 0) {
  console.log('\nNote: this deployed the DOCTOR app (Cloudflare Pages).');
  console.log('The owner console is served by the Worker, from its own copy');
  console.log('of dist/. If you changed admin.html, js/tcos-admin-*.js or');
  console.log('css/tcos.css, the console will not move until you also run:');
  console.log('\n  node scripts/deploy-api.js production\n');
}

process.exit(deploy.status === null ? 1 : deploy.status);
