# TCOS disaster recovery

## What is protected

Production D1 is exported every day at 00:30 IST by GitHub Actions. The SQL
is encrypted with AES-256 before it is uploaded. Only the encrypted archive,
its SHA-256 checksum and a non-clinical manifest leave the ephemeral runner.
Artifacts are retained for 90 days in the private GitHub repository.

Each backup job decrypts its own archive and reconstructs the database in an
in-memory SQLite instance. The job verifies every migration-defined schema
object through migration 048, runs `integrity_check`, and requires zero
foreign-key violations. A backup that cannot be restored is a failed backup.

## Required GitHub configuration

- Repository variable `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account ID.
- Repository secret `CLOUDFLARE_D1_BACKUP_TOKEN` — a dedicated, least-
  privilege Cloudflare API token for exporting D1. Do not reuse an owner or
  deployment token.
- Repository secret `TCOS_BACKUP_PASSPHRASE` — at least 24 random characters.
  Keep a second copy in the owner's password manager. GitHub cannot recover
  an encrypted backup if this passphrase is lost.

Never paste either secret into an issue, pull request, commit, support ticket
or chat. Add each secret through GitHub's secret prompt or the interactive
`gh secret set` command.

## Restore procedure

1. Declare an incident and stop writes if the source database may be corrupt.
2. Download the newest successful `Encrypted production D1 backup` artifact.
3. Verify `sha256sum -c tcos-production.sql.gpg.sha256`.
4. Decrypt to an encrypted/admin-controlled workstation or ephemeral runner.
5. Run:

   `node scripts/audit-production-baseline.js tcos-production.sql 48 48`

6. Create a new isolated recovery D1 database. Never import over the damaged
   production database.
7. Import the SQL into the isolated database and repeat schema, integrity and
   application smoke tests.
8. Point a staging Worker at the recovered database and verify owner sign-in,
   one clinic sign-in, patient lookup, consultation, prescription, billing,
   stock and audit history.
9. Only after written owner approval, change the production binding to the
   recovered database. Keep the old database read-only for investigation.
10. Rotate credentials implicated in the incident and record the recovery in
    the audit/incident log.

## Quarterly rehearsal

Once per quarter, perform steps 2–8 against a newly created recovery database,
then delete that recovery database after the result is recorded. The scheduled
local restore check runs daily, but it does not test Cloudflare resource
creation, binding changes or the human approval path.
