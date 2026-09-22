/* =========================================================================
   AI provider-file retention.

   `store:false` covers Responses application state, not Files API objects
   used by Batch. These tests prove the input id is kept until the clinical
   result is safe, all terminal file ids are deleted, and a partial cleanup
   remains retryable rather than disappearing from operations.

   Run: node test/ai-retention.test.js
   ========================================================================= */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { applyMigration } from './migrate.js';
import { ai, batch } from '../worker/ai.js';
import { aiops } from '../worker/aiops.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const originalFetch = globalThis.fetch;

console.log('\nBatch files have a bounded provider lifecycle\n');

const calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  if (String(url).endsWith('/v1/files') && options.method === 'POST') {
    return new Response(JSON.stringify({ id: 'file_input' }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }
  if (String(url).endsWith('/v1/batches') && options.method === 'POST') {
    return new Response(JSON.stringify({ id: 'batch_1', status: 'validating' }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }
  throw new Error('Unexpected fetch: ' + url);
};

const submitted = await batch.submit({ OPENAI_API_KEY: 'test-key' }, {
  customId: 'reading_1',
  options: ai.extractionRequest({
    expectedName: 'Vijay', clinicalPages: [1], contentType: 'image/png',
    bytes: new Uint8Array([1, 2, 3]), filename: 'report.png'
  })
});

check('submission returns the input file id needed for deletion',
  submitted.inputFileId === 'file_input');
const uploadCall = calls.find(c => c.url.endsWith('/v1/files'));
check('batch inputs expire after 48 hours even if explicit deletion cannot run',
  uploadCall.options.body.get('expires_after[anchor]') === 'created_at' &&
  uploadCall.options.body.get('expires_after[seconds]') === '172800');
const createCall = calls.find(c => c.url.endsWith('/v1/batches'));
const createBody = JSON.parse(createCall.options.body);
check('batch outputs expire after one day even if TCOS cannot clean them',
  createBody.output_expires_after && createBody.output_expires_after.seconds === 86400,
  JSON.stringify(createBody.output_expires_after));

let orphanDeleted = false;
globalThis.fetch = async (url, options = {}) => {
  if (String(url).endsWith('/v1/files') && options.method === 'POST') {
    return new Response(JSON.stringify({ id: 'file_orphan' }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }
  if (String(url).endsWith('/v1/batches') && options.method === 'POST') {
    return new Response(JSON.stringify({ error: { message: 'batch rejected' } }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }
  if (String(url).endsWith('/v1/files/file_orphan') && options.method === 'DELETE') {
    orphanDeleted = true;
    return new Response('', { status: 200 });
  }
  throw new Error('Unexpected fetch: ' + url);
};
let submitError = null;
try {
  await batch.submit({ OPENAI_API_KEY: 'test-key' }, {
    customId: 'reading_rejected',
    options: ai.extractionRequest({
      expectedName: 'Vijay', clinicalPages: [1], contentType: 'image/png',
      bytes: new Uint8Array([1]), filename: 'report.png'
    })
  });
} catch (error) { submitError = error; }
check('a rejected batch deletes the input file it already uploaded',
  !!submitError && orphanDeleted);

globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  if (String(url).endsWith('/v1/batches/batch_1')) {
    return new Response(JSON.stringify({
      status: 'completed', input_file_id: 'file_input',
      output_file_id: 'file_output', error_file_id: 'file_error',
      request_counts: { completed: 1 }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (String(url).endsWith('/v1/files/file_output/content')) {
    const row = {
      response: {
        status_code: 200,
        body: {
          model: 'gpt-5.6-terra-2026-08-01',
          output: [{ type: 'message', content: [{
            type: 'output_text', text: JSON.stringify({ legible: true })
          }] }],
          usage: { input_tokens: 100, output_tokens: 10 }
        }
      }
    };
    return new Response(JSON.stringify(row) + '\n', { status: 200 });
  }
  throw new Error('Unexpected fetch: ' + url);
};

const collected = await batch.collect({ OPENAI_API_KEY: 'test-key' }, 'batch_1');
check('collection returns all provider ids before anything is deleted',
  collected.provider.inputFileId === 'file_input' &&
  collected.provider.outputFileId === 'file_output' &&
  collected.provider.errorFileId === 'file_error');

const deleted = [];
globalThis.fetch = async (url, options = {}) => {
  if (options.method !== 'DELETE') throw new Error('Expected DELETE');
  deleted.push(String(url).split('/').pop());
  return new Response('', { status: deleted.length === 2 ? 404 : 200 });
};
const cleanup = await batch.deleteFiles({ OPENAI_API_KEY: 'test-key' }, [
  'file_input', 'file_output', 'file_error', 'file_input'
]);
check('input, output and error files are each deleted once',
  deleted.length === 3 && new Set(deleted).size === 3, deleted.join(', '));
check('already-deleted provider files count as clean', cleanup.complete === true);

console.log('\nCleanup state survives provider and Worker failures\n');

const db = new DatabaseSync(':memory:');
db.exec(readFileSync('schema.sql', 'utf8'));
for (const file of [
  'migrations/019-cost-tracking.sql', 'migrations/022-files.sql',
  'migrations/026-ai-spend-guard.sql', 'migrations/027-batch-reading.sql',
  'migrations/036-ai-provider-file-cleanup.sql'
]) {
  for (const problem of applyMigration(db, file)) {
    console.log('  MIGRATION FAILED: ' + problem);
    failed++;
  }
}
db.exec("INSERT INTO doctors (id,mobile,full_name,clinic_name) VALUES ('doc_a','9000000001','Dr A','Clinic A')");

const shim = {
  prepare(sql) {
    const stmt = db.prepare(sql);
    return {
      bind(...args) {
        return {
          async first() { return stmt.get(...args) ?? null; },
          async all() { return { results: stmt.all(...args) }; },
          async run() { return stmt.run(...args); }
        };
      }
    };
  }
};

const queueId = await aiops.queueBatch(shim, 'doc_a', {
  batchId: 'batch_1', providerStatus: 'validating',
  providerInputFileId: 'file_input'
});
let row = db.prepare('SELECT * FROM ai_queue WHERE id = ?').get(queueId);
check('the input id is durable from the moment the batch is created',
  row.provider_input_file_id === 'file_input' && row.provider_cleanup_status === 'pending');

await aiops.noteBatchStatus(shim, 'doc_a', queueId, {
  status: 'completed', inputFileId: 'file_input', outputFileId: 'file_output',
  errorFileId: 'file_error'
});
let pending = await aiops.providerCleanupPending(shim, 'doc_a');
check('a completed batch appears in the cleanup retry queue', pending.length === 1);

await aiops.noteProviderCleanup(shim, 'doc_a', queueId, {
  complete: false, failures: ['temporary provider error']
});
pending = await aiops.providerCleanupPending(shim, 'doc_a');
row = db.prepare('SELECT * FROM ai_queue WHERE id = ?').get(queueId);
check('a partial cleanup remains retryable and counts the attempt',
  pending.length === 1 && row.provider_cleanup_attempts === 1);

const globalPending = await aiops.providerCleanupPendingAll(shim);
check('the nightly sweep can find cleanup work across clinics without clinical data',
  globalPending.length === 1 && globalPending[0].doctor_id === 'doc_a' &&
  !Object.keys(globalPending[0]).some(k => /patient|report|value|name/i.test(k)));

await aiops.noteProviderCleanup(shim, 'doc_a', queueId, {
  complete: true, failures: []
});
pending = await aiops.providerCleanupPending(shim, 'doc_a');
row = db.prepare('SELECT * FROM ai_queue WHERE id = ?').get(queueId);
check('successful cleanup leaves the retry queue and records when it happened',
  pending.length === 0 && row.provider_cleanup_status === 'complete' &&
  !!row.provider_files_deleted_at);

const aiSource = readFileSync('worker/ai.js', 'utf8');
const scribeSource = readFileSync('worker/scribe.js', 'utf8');
const stateDoc = readFileSync('docs/STATE-OF-THE-PROJECT.md', 'utf8');
check('TCOS no longer claims store:false means zero provider retention',
  !/never retained by the provider/i.test(aiSource + scribeSource + stateDoc));
check('the project state names the possible 30-day abuse-log window',
  /up to 30 days/.test(stateDoc));
const routerSource = readFileSync('worker/index.js', 'utf8');
check('the nightly scheduled job sweeps provider files',
  /ctx\.waitUntil\([\s\S]{0,80}sweepProviderFiles\(env\)/.test(routerSource));
check('three failed cleanup attempts create an operations alert',
  /state\.attempts === 3/.test(routerSource) &&
  /alertProviderCleanup/.test(routerSource));

globalThis.fetch = originalFetch;

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
