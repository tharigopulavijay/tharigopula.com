/**
 * Integration tests against a real PostgreSQL (TEST_DATABASE_URL) and the real engine.
 * Covers the playbook acceptance criteria for tenancy, audit, conflicts, immutability,
 * RBAC, residency, and incremental cursor safety.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ADMIN_URL = process.env.TEST_ADMIN_URL ?? 'postgres://studio:studio@127.0.0.1:5432/postgres';
const DB = 'studio_itest';
const SRC = 'source_itest';
process.env.DATABASE_URL = `postgres://studio:studio@127.0.0.1:5432/${DB}`;
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-itest-'));
process.env.REGION = 'ap-south-1';
process.env.MASTER_KEY = 'itest-master-key-0123456789-abcdefghijkl';
process.env.LOG_LEVEL = 'silent';

let app: any; let pool: any; let executors: any; let jobs: any;
const H = { 'x-ds-client': 'web', 'content-type': 'application/json' };

async function login(email: string, password: string) {
  const r = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: H, payload: { email, password } });
  expect(r.statusCode).toBe(200);
  const c = r.cookies.find((x: any) => x.name === 'ds_session');
  return { ...H, cookie: `ds_session=${c.value}` };
}
const call = (h: any, method: string, url: string, payload?: any) => app.inject({ method, url: `/api/v1${url}`, headers: h, payload });

async function mkTenant(name: string, email: string, region = 'ap-south-1') {
  const { hashPassword } = await import('../../apps/api/src/auth.js');
  const t = (await pool.query(`INSERT INTO tenants (name, default_region) VALUES ($1,$2) RETURNING id`, [name, region])).rows[0];
  const w = (await pool.query(`INSERT INTO workspaces (tenant_id, name, region, settings) VALUES ($1,$2,$3,'{"active_environment":"development"}') RETURNING id`, [t.id, name + ' WS', region])).rows[0];
  for (const e of ['development', 'test', 'production']) await pool.query('INSERT INTO environments (tenant_id, workspace_id, name) VALUES ($1,$2,$3)', [t.id, w.id, e]);
  const u = (await pool.query(`INSERT INTO users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id`, [email, name, await hashPassword('Password!12345')])).rows[0];
  await pool.query(`INSERT INTO memberships (user_id, tenant_id, workspace_id, role) VALUES ($1,$2,$3,'admin')`, [u.id, t.id, w.id]);
  return { tenantId: t.id, workspaceId: w.id, userId: u.id };
}

async function runQueued(kind?: string) {
  // drive the worker's executor inline, exactly as the worker does
  for (;;) {
    const r = (await pool.query(`UPDATE runs SET status='running', started_at=now(), heartbeat_at=now(), attempt=attempt+1 WHERE id = (SELECT id FROM runs WHERE status='queued' ${kind ? `AND kind='${kind}'` : ''} ORDER BY queued_at LIMIT 1) RETURNING *`)).rows[0];
    if (!r) return;
    const rc = { run: r, log: async () => {}, progress: async () => {}, checkCancel: async () => {} };
    const fn = ({ ingest: executors.executeIngest, pipeline: executors.executePipeline, quality: executors.executeQuality, profile: executors.executeProfile } as any)[r.kind];
    try { const counts = await fn(rc); await pool.query(`UPDATE runs SET status='succeeded', counts=$2, finished_at=now() WHERE id=$1`, [r.id, JSON.stringify(counts)]); }
    catch (e: any) { await pool.query(`UPDATE runs SET status='failed', error=$2, finished_at=now() WHERE id=$1`, [r.id, JSON.stringify({ message: e.message, code: e.code })]); }
  }
}

beforeAll(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  for (const d of [DB, SRC]) { await admin.query(`DROP DATABASE IF EXISTS ${d} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${d}`); }
  await admin.end();
  const src = new pg.Client({ connectionString: `postgres://studio:studio@127.0.0.1:5432/${SRC}` });
  await src.connect();
  await src.query(`CREATE SCHEMA s; CREATE TABLE s.events (id int PRIMARY KEY, amount numeric(12,2), updated_at timestamp NOT NULL);
    INSERT INTO s.events SELECT i, i * 1.5, timestamp '2025-01-01' + (i || ' minutes')::interval FROM generate_series(1, 500) i;`);
  await src.end();
  process.env.MIGRATIONS_DIR = path.resolve(__dirname, '../../infra/migrations');
  const { migrate } = await import('../../apps/api/src/migrate.js');
  await migrate();
  ({ pool } = await import('../../apps/api/src/db.js'));
  executors = await import('../../apps/api/src/services/executors.js');
  jobs = await import('../../apps/api/src/jobs.js');
  const { buildApp } = await import('../../apps/api/src/server.js');
  app = await buildApp();
});
afterAll(async () => { await app?.close(); await pool?.end(); });

describe('tenancy, audit, conflicts and RBAC', () => {
  let A: any; let B: any; let ha: any; let hb: any; let assetA: string;
  beforeAll(async () => {
    A = await mkTenant('Alpha', 'a@alpha.test'); B = await mkTenant('Beta', 'b@beta.test');
    ha = await login('a@alpha.test', 'Password!12345'); hb = await login('b@beta.test', 'Password!12345');
    const csv = path.join(process.env.DATA_DIR!, 'x.csv'); fs.writeFileSync(csv, 'id,email,amount\n1,a@x.com,10\n2,b@x.com,20\n3,c@x.com,\n');
    const boundary = '----dsb'; const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="people.csv"\r\nContent-Type: text/csv\r\n\r\n${fs.readFileSync(csv, 'utf8')}\r\n--${boundary}--\r\n`;
    const up = await app.inject({ method: 'POST', url: '/api/v1/uploads', headers: { ...ha, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: body });
    expect(up.statusCode).toBe(200);
    const imp = await call(ha, 'POST', '/uploads/import', { uploadRef: up.json().uploadRef, filename: 'people.csv', name: 'People' });
    expect(imp.statusCode).toBe(200);
    assetA = imp.json().assetId;
    await runQueued('ingest');
  });

  it('ingests a file, profiles it and auto-classifies PII', async () => {
    const r = await call(ha, 'GET', `/assets/${assetA}`);
    expect(r.json().currentVersion.row_count).toBe(3);
    expect(r.json().fields.find((f: any) => f.name === 'email').sensitivity).toBe('pii');
  });

  it('cross-tenant ids behave exactly like missing ids', async () => {
    const r = await call(hb, 'GET', `/assets/${assetA}`);
    expect(r.statusCode).toBe(404);
    const p = await call(hb, 'POST', `/assets/${assetA}/preview`, {});
    expect(p.statusCode).toBe(404);
    const list = await call(hb, 'GET', '/assets');
    expect(list.json().length).toBe(0);
    const s = await call(hb, 'GET', '/catalog/search?q=People');
    expect(s.json().assets.length).toBe(0);
  });

  it('every mutation emits an audit record and the chain verifies', async () => {
    const before = (await pool.query('SELECT count(*)::int n FROM audit_events WHERE tenant_id = $1', [A.tenantId])).rows[0].n;
    const a = (await call(ha, 'GET', `/assets/${assetA}`)).json();
    const r = await call(ha, 'PATCH', `/assets/${assetA}`, { version: a.version, description: 'People list' });
    expect(r.statusCode).toBe(200);
    const after = (await pool.query('SELECT count(*)::int n FROM audit_events WHERE tenant_id = $1', [A.tenantId])).rows[0].n;
    expect(after).toBeGreaterThan(before);
    expect((await call(ha, 'GET', '/audit/verify')).json().ok).toBe(true);
    await expect(pool.query('UPDATE audit_events SET action = $1 WHERE tenant_id = $2', ['tampered', A.tenantId])).rejects.toThrow(/append-only/);
  });

  it('stale versions return 409', async () => {
    const r = await call(ha, 'PATCH', `/assets/${assetA}`, { version: 1, description: 'stale' });
    expect(r.statusCode).toBe(409);
    const p = (await call(ha, 'POST', '/pipelines', { name: 'P1', sourceAssetId: assetA })).json();
    expect((await call(ha, 'PUT', `/pipelines/${p.id}/draft`, { graph: p.draft_graph, rev: p.draft_rev })).statusCode).toBe(200);
    expect((await call(ha, 'PUT', `/pipelines/${p.id}/draft`, { graph: p.draft_graph, rev: p.draft_rev })).statusCode).toBe(409);
  });

  it('PII is masked for non-admin roles by default and RBAC denies writes', async () => {
    const { hashPassword } = await import('../../apps/api/src/auth.js');
    const u = (await pool.query(`INSERT INTO users (email, name, password_hash) VALUES ('v@alpha.test','Viewer',$1) RETURNING id`, [await hashPassword('Password!12345')])).rows[0];
    await pool.query(`INSERT INTO memberships (user_id, tenant_id, workspace_id, role) VALUES ($1,$2,$3,'viewer')`, [u.id, A.tenantId, A.workspaceId]);
    const hv = await login('v@alpha.test', 'Password!12345');
    const pr = (await call(hv, 'POST', `/assets/${assetA}/preview`, {})).json();
    expect(pr.rows.every((r: any) => r.email === null || String(r.email).startsWith('••••'))).toBe(true);
    expect(pr.appliedPolicies.some((p: any) => p.target === 'email')).toBe(true);
    expect((await call(hv, 'POST', '/pipelines', { name: 'nope' })).statusCode).toBe(403);
    expect((await call(hv, 'GET', '/audit-events')).statusCode).toBe(403);
  });

  it('state-changing calls without the client header are rejected (CSRF)', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/v1/pipelines', headers: { cookie: ha.cookie, 'content-type': 'application/json' }, payload: { name: 'x' } });
    expect(r.statusCode).toBe(403);
  });

  it('certified metric versions are immutable; edits create drafts', async () => {
    const m = (await call(ha, 'POST', '/metrics', { name: 'Total amount', definition: { assetId: assetA, kind: 'simple', expression: 'sum("amount")', description: 'Sum of amount' } })).json();
    expect(m.validation.ok).toBe(true);
    expect((await call(ha, 'POST', `/metrics/${m.id}/versions/1/certify`)).statusCode).toBe(200);
    await expect(pool.query(`UPDATE metric_versions SET definition = '{}' WHERE metric_id = $1`, [m.id])).rejects.toThrow(/immutable/);
    const v2 = (await call(ha, 'POST', `/metrics/${m.id}/versions`, { definition: { assetId: assetA, kind: 'simple', expression: 'avg("amount")', description: 'Average' } })).json();
    expect(v2.version).toBe(2);
  });

  it('publish is blocked without quality coverage, allowed once rules pass', async () => {
    const p = (await call(ha, 'POST', '/products', { name: 'People product', assetId: assetA })).json();
    const r1 = await call(ha, 'POST', `/products/${p.id}/publish`, {});
    expect(r1.statusCode).toBe(422);
    await call(ha, 'POST', '/quality/rules', { assetId: assetA, name: 'id unique', ruleType: 'unique', config: { columns: ['id'] }, severity: 'block' });
    await call(ha, 'POST', `/quality/assets/${assetA}/run`);
    await runQueued('quality');
    const r2 = await call(ha, 'POST', `/products/${p.id}/publish`, {});
    expect(r2.statusCode).toBe(200);
    await call(ha, 'POST', '/quality/rules', { assetId: assetA, name: 'amount required', ruleType: 'not_null', config: { column: 'amount' }, severity: 'block' });
    await call(ha, 'POST', `/quality/assets/${assetA}/run`);
    await runQueued('quality');
    const r3 = await call(ha, 'POST', `/products/${p.id}/publish`, {});
    expect(r3.statusCode).toBe(422); // blocking failure now present (1 null amount)
  });

  it('AI SQL surface blocks mutation, file access and unapproved tables', async () => {
    const s = (await call(ha, 'POST', '/ai-spaces', { name: 'Space', assetIds: [assetA] })).json();
    for (const sql of ['DELETE FROM people', "SELECT * FROM read_csv('/etc/passwd')", 'SELECT * FROM users', "SELECT getenv('MASTER_KEY')"]) {
      const r = (await call(ha, 'POST', `/ai-spaces/${s.id}/questions`, { question: 'attack test', sql })).json();
      expect(r.status).toBe('blocked');
    }
    const ok = (await call(ha, 'POST', `/ai-spaces/${s.id}/questions`, { question: 'count', sql: 'SELECT count(*) AS n FROM people' })).json();
    expect(ok.status).toBe('answered');
    expect(Number(ok.rows[0].n)).toBe(3);
  });

  it('residency: data in another region is never processed here', async () => {
    const t = await mkTenant('Gamma', 'g@gamma.test', 'eu-central-1');
    await pool.query(`UPDATE workspaces SET region = 'eu-central-1' WHERE id = $1`, [t.workspaceId]);
    const env = (await pool.query(`SELECT id FROM environments WHERE workspace_id = $1 AND name='development'`, [t.workspaceId])).rows[0];
    const a = (await pool.query(`INSERT INTO assets (tenant_id, workspace_id, environment_id, physical_name, logical_name, type, region) VALUES ($1,$2,$3,'eu_data','EU data','file','eu-central-1') RETURNING id`, [t.tenantId, t.workspaceId, env.id])).rows[0];
    await pool.query(`INSERT INTO runs (tenant_id, workspace_id, kind, definition_id, region, params) VALUES ($1,$2,'ingest',$3,'eu-central-1','{}')`, [t.tenantId, t.workspaceId, a.id]);
    const claimed = (await pool.query(`SELECT count(*)::int n FROM runs WHERE region = $1 AND status = 'queued'`, ['ap-south-1'])).rows[0].n;
    expect(claimed).toBe(0); // ap-south-1 worker queue never sees EU work
    const { resolveRef } = await import('../../apps/api/src/store.js');
    expect(() => resolveRef('obj:eu-central-1/x/y/z.parquet', { requireRegion: 'ap-south-1' })).toThrow(/Cross-region/);
  });
});

describe('incremental ingestion safety', () => {
  it('cursor advances only with a committed version; a blocked drift keeps the cursor', async () => {
    const T = await mkTenant('Delta', 'd@delta.test');
    const h = await login('d@delta.test', 'Password!12345');
    const c = (await call(h, 'POST', '/connections', { type: 'postgres', displayName: 'src', config: { host: '127.0.0.1', port: 5432, database: SRC, sslMode: 'disable', readOnly: true }, credentials: { username: 'studio', password: 'studio' } })).json();
    const t = await call(h, 'POST', `/connections/${c.id}/test`);
    expect(t.json().ok).toBe(true);
    expect(JSON.stringify(t.json())).not.toMatch(/password/i);
    const imp = (await call(h, 'POST', `/connections/${c.id}/import`, { namespace: 's', tables: [{ name: 'events', mode: 'incremental', cursor: 'updated_at', primaryKey: ['id'], driftPolicy: 'block' }] })).json();
    const assetId = imp.created[0].assetId;
    await runQueued('ingest');
    const def1 = (await pool.query('SELECT cursor_value FROM ingestion_definitions WHERE asset_id = $1', [assetId])).rows[0];
    expect(def1.cursor_value).toMatch(/2025-01-01 08:20/);
    const src = new pg.Client({ connectionString: `postgres://studio:studio@127.0.0.1:5432/${SRC}` }); await src.connect();
    await src.query(`ALTER TABLE s.events ADD COLUMN note text; INSERT INTO s.events VALUES (501, 1, '2025-02-01', 'x')`);
    await src.end();
    await call(h, 'POST', `/assets/${assetId}/ingest`);
    await runQueued('ingest');
    const run = (await pool.query(`SELECT * FROM runs WHERE definition_id = $1 ORDER BY queued_at DESC LIMIT 1`, [assetId])).rows[0];
    expect(run.status).toBe('failed');
    expect(run.error.code).toBe('SCHEMA_DRIFT');
    const def2 = (await pool.query('SELECT cursor_value FROM ingestion_definitions WHERE asset_id = $1', [assetId])).rows[0];
    expect(def2.cursor_value).toBe(def1.cursor_value);
    const versions = (await pool.query('SELECT count(*)::int n FROM dataset_versions WHERE asset_id = $1', [assetId])).rows[0].n;
    expect(versions).toBe(1);
    // idempotency: the same key never enqueues twice
    const ctx = { tenantId: T.tenantId, workspaceId: T.workspaceId, userId: T.userId, correlationId: 't' } as any;
    const r1 = await jobs.enqueueRun(pool, ctx, { kind: 'ingest', definitionId: assetId, region: 'ap-south-1', idempotencyKey: 'k1' });
    const r2 = await jobs.enqueueRun(pool, ctx, { kind: 'ingest', definitionId: assetId, region: 'ap-south-1', idempotencyKey: 'k1' });
    expect(r2.deduplicated).toBe(true); expect(r2.run.id).toBe(r1.run.id);
    await pool.query(`UPDATE runs SET status = 'cancelled' WHERE id = $1`, [r1.run.id]);
  });
});

// Audit regressions: synthetic fixtures only, intended to fail until the defects are fixed.
describe('independent audit regressions', () => {
  let T: any; let admin: any; let viewer: any; let analyst: any; let cid: string; let aid: string;
  beforeAll(async () => {
    T = await mkTenant('Audit', 'admin@audit.test');
    admin = await login('admin@audit.test', 'Password!12345');
    const { hashPassword } = await import('../../apps/api/src/auth.js');
    for (const role of ['viewer','analyst']) {
      const u = (await pool.query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id', [`${role}@audit.test`,role,await hashPassword('Password!12345')])).rows[0];
      await pool.query('INSERT INTO memberships(user_id,tenant_id,workspace_id,role) VALUES($1,$2,$3,$4)',[u.id,T.tenantId,T.workspaceId,role]);
    }
    viewer = await login('viewer@audit.test','Password!12345');
    analyst = await login('analyst@audit.test','Password!12345');
    const cr = await call(admin,'POST','/connections',{type:'postgres',displayName:'Audit source',config:{host:'127.0.0.1',port:5432,database:SRC,sslMode:'disable',readOnly:true},credentials:{username:'studio',password:'studio'}});
    expect(cr.statusCode).toBe(201); cid=cr.json().id;
    const imp=await call(admin,'POST',`/connections/${cid}/import`,{namespace:'s',tables:[{name:'events',mode:'snapshot'}]});
    expect(imp.statusCode).toBe(200); aid=imp.json().created[0].assetId;
    await runQueued('ingest');
    expect((await call(admin,'GET',`/assets/${aid}`)).json().currentVersion.row_count).toBe(501);
    await pool.query(`INSERT INTO policies(tenant_id,workspace_id,name,policy_type,asset_id,field_name,applies_to_roles,effect) VALUES($1,$2,'Hide amounts','column_mask',$3,'amount',ARRAY['viewer','analyst'],'mask')`,[T.tenantId,T.workspaceId,aid]);
    await pool.query(`INSERT INTO policies(tenant_id,workspace_id,name,policy_type,asset_id,condition,applies_to_roles,effect) VALUES($1,$2,'First row only','row_filter',$3,'id = 1',ARRAY['viewer','analyst'],'filter')`,[T.tenantId,T.workspaceId,aid]);
  });

  it('raw connection previews reject viewers without connection access',async()=>{
    const r=await call(viewer,'POST',`/connections/${cid}/preview`,{namespace:'s',asset:'events',limit:5});
    expect(r.statusCode).toBe(403);
  });

  it('live previews enforce the same row and column policies as snapshots',async()=>{
    const snap=(await call(viewer,'POST',`/assets/${aid}/preview`,{})).json();
    expect(snap.rows).toHaveLength(1); expect(snap.rows[0].amount).toBeNull();
    await pool.query("UPDATE ingestion_definitions SET mode='query_in_place' WHERE asset_id=$1",[aid]);
    try {
      const live=(await call(viewer,'POST',`/assets/${aid}/preview`,{})).json();
      expect(live.rows).toHaveLength(1); expect(live.rows[0].amount).toBeNull();
    } finally { await pool.query("UPDATE ingestion_definitions SET mode='snapshot' WHERE asset_id=$1",[aid]); }
  });

  it('profile hides values for explicitly masked columns',async()=>{
    const r=await call(viewer,'GET',`/assets/${aid}/profile`);
    expect(r.statusCode).toBe(200);
    expect(r.json().profile.columns.find((c:any)=>c.name==='amount').min).toBeNull();
  });

  it('pipeline preview enforces source row and column policies',async()=>{
    const p=(await call(analyst,'POST','/pipelines',{name:'Audit preview',sourceAssetId:aid})).json();
    const r=await call(analyst,'POST',`/pipelines/${p.id}/preview`,{graph:p.draft_graph,nodeId:'src',limit:5});
    expect(r.statusCode).toBe(200); expect(r.json().rows).toHaveLength(1); expect(r.json().rows[0].amount).toBeNull();
  });

  it('upload inspection rejects traversal to another tenant synthetic file',async()=>{
    const other=await mkTenant('AuditOther','other@audit.test');
    const target=path.join(process.env.DATA_DIR!,'ap-south-1',other.tenantId,other.workspaceId,'uploads','synthetic.csv');
    fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,'id,value\n1,SYNTHETIC_OTHER_TENANT\n');
    const uploadRef=`obj:ap-south-1/${T.tenantId}/${T.workspaceId}/uploads/../../../${other.tenantId}/${other.workspaceId}/uploads/synthetic.csv`;
    const r=await call(admin,'POST','/uploads/inspect',{uploadRef});
    expect(r.statusCode).toBe(400);
  });

  it('connection updates never return plaintext credentials placed in config',async()=>{
    const original=(await call(admin,'GET','/connections')).json().find((c:any)=>c.id===cid);
    const r=await call(admin,'PUT',`/connections/${cid}`,{version:original.version,config:{...original.config,password:'SYNTHETIC_SECRET_MARKER'}});
    expect(r.statusCode).toBe(200); expect(JSON.stringify(r.json())).not.toContain('SYNTHETIC_SECRET_MARKER');
  });

  it('certification requires executed passing quality evidence',async()=>{
    const rule=await call(admin,'POST','/quality/rules',{assetId:aid,name:'Audit unique id',ruleType:'unique',config:{columns:['id']},severity:'block'});
    expect(rule.statusCode).toBe(201);
    const a=(await call(admin,'GET',`/assets/${aid}`)).json();
    const r=await call(admin,'PATCH',`/assets/${aid}`,{version:a.version,certification:'certified'});
    expect(r.statusCode).toBe(422);
  });

  it('environment selection is local to the selecting session',async()=>{
    expect((await call(admin,'GET','/me')).json().environment).toBe('development');
    expect((await call(viewer,'PUT','/workspace/environment',{environment:'test'})).statusCode).toBe(200);
    try { expect((await call(admin,'GET','/me')).json().environment).toBe('development'); }
    finally { await call(admin,'PUT','/workspace/environment',{environment:'development'}); }
  });

  it('saved AI answers do not expose an admin result to restricted viewers',async()=>{
    const s=(await call(admin,'POST','/ai-spaces',{name:'Audit space',assetIds:[aid]})).json();
    const a=(await call(admin,'POST',`/ai-spaces/${s.id}/questions`,{question:'Audit second amount',sql:'SELECT id, amount FROM events WHERE id = 2'})).json();
    expect(a.status).toBe('answered');
    await call(admin,'POST',`/ai-answers/${a.id}/feedback`,{feedback:'helpful',save:true});
    const r=await call(viewer,'GET',`/ai-answers/${a.id}`);
    expect(r.statusCode).toBe(404);
  });
});
