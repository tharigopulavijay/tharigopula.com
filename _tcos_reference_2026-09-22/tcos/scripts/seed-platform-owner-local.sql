-- LOCAL DEVELOPMENT ONLY.
-- Pre-lists an owner identity without a password so the one-time bootstrap
-- screen can create it. Staging and production owners are recovered from the
-- exact Cloudflare Access identity configured in PLATFORM_OWNER_EMAIL.
INSERT OR IGNORE INTO platform_team (email, full_name, role)
VALUES ('owner@tcos.local', 'Local TCOS owner', 'owner');
