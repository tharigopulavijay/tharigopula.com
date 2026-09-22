import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/*
 * Offline production migration audit.
 *
 * The input is a Wrangler D1 SQL export. It is loaded into an in-memory
 * SQLite database; no patient data is printed and the export is never
 * modified. The audit proves that every schema object/column introduced by
 * migrations 001-036 exists, then rehearses migrations 037 onward against
 * the exact exported production state.
 */

const backupPath = process.argv[2];
const baselineThrough = Number(process.argv[3] || 36);
const migrateThrough = Number(process.argv[4] || 48);

if (!backupPath || !Number.isInteger(baselineThrough) || !Number.isInteger(migrateThrough)) {
  console.error('Usage: node scripts/audit-production-baseline.js <d1-export.sql> [baseline-through] [migrate-through]');
  process.exit(2);
}

const root = resolve(import.meta.dirname, '..');
const migrationDir = resolve(root, 'migrations');
const migrationFiles = readdirSync(migrationDir)
  .filter((name) => /^\d{3}-.+\.sql$/.test(name))
  .sort();

function numberOf(name) {
  return Number(name.slice(0, 3));
}

function sqlWithoutComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

function unquote(name) {
  return name.replace(/^[`"[]|[`"\]]$/g, '');
}

function requirements(files) {
  const objects = new Map();
  const columns = new Map();

  for (const name of files) {
    const migration = numberOf(name);
    const statements = sqlWithoutComments(readFileSync(resolve(migrationDir, name), 'utf8'))
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      let match = statement.match(/^CREATE\s+(?:UNIQUE\s+)?(TABLE|INDEX|TRIGGER|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"\[]?[A-Za-z_]\w*[`"\]]?)/i);
      if (match) {
        const type = match[1].toLowerCase();
        const objectName = unquote(match[2]);
        objects.set(`${type}:${objectName}`, { type, name: objectName, migration });
        continue;
      }

      match = statement.match(/^DROP\s+(TABLE|INDEX|TRIGGER|VIEW)\s+(?:IF\s+EXISTS\s+)?([`"\[]?[A-Za-z_]\w*[`"\]]?)/i);
      if (match) {
        const type = match[1].toLowerCase();
        const objectName = unquote(match[2]);
        objects.delete(`${type}:${objectName}`);
        if (type === 'table') columns.delete(objectName);
        continue;
      }

      match = statement.match(/^ALTER\s+TABLE\s+([`"\[]?[A-Za-z_]\w*[`"\]]?)\s+RENAME\s+TO\s+([`"\[]?[A-Za-z_]\w*[`"\]]?)/i);
      if (match) {
        const from = unquote(match[1]);
        const to = unquote(match[2]);
        const table = objects.get(`table:${from}`);
        if (table) {
          objects.delete(`table:${from}`);
          objects.set(`table:${to}`, { ...table, name: to });
        }
        if (columns.has(from)) {
          columns.set(to, columns.get(from));
          columns.delete(from);
        }
        continue;
      }

      match = statement.match(/^ALTER\s+TABLE\s+([`"\[]?[A-Za-z_]\w*[`"\]]?)\s+ADD\s+(?:COLUMN\s+)?([`"\[]?[A-Za-z_]\w*[`"\]]?)/i);
      if (match) {
        const table = unquote(match[1]);
        const column = unquote(match[2]);
        if (!columns.has(table)) columns.set(table, new Map());
        columns.get(table).set(column, migration);
      }
    }
  }

  return { objects, columns };
}

function inspect(db, expected) {
  const actualObjects = new Set(db.prepare(
    "SELECT type || ':' || name AS key FROM sqlite_master WHERE type IN ('table','index','trigger','view')"
  ).all().map((row) => row.key));
  const missingObjects = [...expected.objects.values()]
    .filter((item) => !actualObjects.has(`${item.type}:${item.name}`));
  const missingColumns = [];

  for (const [table, names] of expected.columns) {
    const actual = new Set(db.prepare(`PRAGMA table_info(\"${table.replaceAll('"', '""')}\")`).all()
      .map((row) => row.name));
    for (const [column, migration] of names) {
      if (!actual.has(column)) missingColumns.push({ table, column, migration });
    }
  }

  return { missingObjects, missingColumns };
}

const baselineFiles = migrationFiles.filter((name) => numberOf(name) <= baselineThrough);
const forwardFiles = migrationFiles.filter((name) => {
  const number = numberOf(name);
  return number > baselineThrough && number <= migrateThrough;
});

const db = new DatabaseSync(':memory:');
// Wrangler exports tables in dependency-independent order. Disable immediate
// FK evaluation only while reconstructing the already-validated snapshot;
// the audit turns it back on and runs foreign_key_check before succeeding.
db.exec('PRAGMA foreign_keys = OFF');
db.exec(readFileSync(resolve(backupPath), 'utf8'));
db.exec('PRAGMA foreign_keys = ON');

const baseline = inspect(db, requirements(baselineFiles));
if (baseline.missingObjects.length || baseline.missingColumns.length) {
  console.error(JSON.stringify({ ok: false, stage: 'baseline', ...baseline }, null, 2));
  process.exit(1);
}

for (const name of forwardFiles) {
  try {
    db.exec(readFileSync(resolve(migrationDir, name), 'utf8'));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      stage: 'forward-migration',
      migration: name,
      error: error instanceof Error ? error.message : String(error)
    }, null, 2));
    process.exit(1);
  }
}

const forward = inspect(db, requirements(forwardFiles));
const integrity = db.prepare('PRAGMA integrity_check').get()?.integrity_check;
const foreignKeyViolations = db.prepare('PRAGMA foreign_key_check').all().length;
const result = {
  ok: !forward.missingObjects.length && !forward.missingColumns.length &&
      integrity === 'ok' && foreignKeyViolations === 0,
  baselineThrough,
  baselineObjectsChecked: requirements(baselineFiles).objects.size,
  baselineColumnsChecked: [...requirements(baselineFiles).columns.values()]
    .reduce((total, names) => total + names.size, 0),
  rehearsedMigrations: forwardFiles,
  forwardObjectsChecked: requirements(forwardFiles).objects.size,
  forwardColumnsChecked: [...requirements(forwardFiles).columns.values()]
    .reduce((total, names) => total + names.size, 0),
  integrity,
  foreignKeyViolations,
  missingObjects: forward.missingObjects,
  missingColumns: forward.missingColumns
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
