/* =========================================================================
   Applying a migration file to a node:sqlite database, for tests.

   WHY THIS IS NOT `split(';')`. Migration 019 contains this seed value:

     'Gupshup / Interakt / AiSensy monthly fee. Set once chosen; 0 until then.'

   A naive split on semicolons cuts that string in half. The two fragments
   are not valid SQL, so the migration half-applies and the error - if
   anybody is reporting errors at all - points at a line that looks fine.
   The rule is: a semicolon inside a quoted string is data, not a statement
   boundary.

   Comments are stripped first for the same reason, since a sentence in a
   comment may also contain one.

   Failures are RETURNED, never swallowed. A migration that silently
   half-applies leaves a test suite passing against a schema that does not
   exist in production, which is worse than no test at all.
   ========================================================================= */

import { readFileSync } from 'node:fs';

/* Split on semicolons that are not inside a single-quoted string. SQL
   escapes a quote by doubling it ('it''s'), which this handles naturally:
   the two quotes toggle the flag twice and leave it where it started. */
export function statementsIn(sql) {
  const out = [];
  let current = '', inString = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") inString = !inString;
    if (ch === ';' && !inString) {
      if (current.trim()) out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

const stripComments = sql => sql.split('\n')
  .filter(line => !line.trim().startsWith('--'))
  .join('\n');

/* Returns the list of things that went wrong - empty means it applied
   cleanly. "already exists" is not a failure: tests apply overlapping
   migrations on purpose so each file can be read on its own. */
export function applyMigration(db, path) {
  const problems = [];
  for (const statement of statementsIn(stripComments(readFileSync(path, 'utf8')))) {
    try {
      db.exec(statement + ';');
    } catch (error) {
      if (!/duplicate column|already exists/i.test(error.message)) {
        problems.push(path.split('/').pop() + ': ' + statement.slice(0, 70).replace(/\s+/g, ' ') +
                      ' -> ' + error.message);
      }
    }
  }
  return problems;
}
