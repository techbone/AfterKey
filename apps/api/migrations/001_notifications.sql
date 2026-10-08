BEGIN;
CREATE TABLE IF NOT EXISTS afterkey_auth_challenges (id text PRIMARY KEY, wallet text NOT NULL, message text NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS afterkey_sessions (hash text PRIMARY KEY, wallet text NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS afterkey_profiles (wallet text PRIMARY KEY, email text, verified_at timestamptz, enabled boolean NOT NULL, checkin_reminders boolean NOT NULL, claim_alerts boolean NOT NULL, version text NOT NULL);
CREATE TABLE IF NOT EXISTS afterkey_email_tokens (hash text PRIMARY KEY, wallet text NOT NULL, email text NOT NULL, version text NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS afterkey_email_rates (key text PRIMARY KEY, last_request timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS afterkey_deliveries (key text PRIMARY KEY, first_attempt_at timestamptz NOT NULL, status text NOT NULL CHECK (status IN ('sending','sent','skipped','expired')));
CREATE TABLE IF NOT EXISTS afterkey_vault_snapshots (address text PRIMARY KEY, snapshot jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS afterkey_challenge_expiry ON afterkey_auth_challenges (expires_at);
CREATE INDEX IF NOT EXISTS afterkey_session_expiry ON afterkey_sessions (expires_at);
CREATE INDEX IF NOT EXISTS afterkey_email_token_expiry ON afterkey_email_tokens (expires_at);
-- Private server-side data must not be readable through a hosted public data API.
-- The backend uses its trusted owner/service database connection; no client policies exist.
ALTER TABLE afterkey_auth_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE afterkey_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE afterkey_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE afterkey_email_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE afterkey_email_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE afterkey_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE afterkey_vault_snapshots ENABLE ROW LEVEL SECURITY;
COMMIT;
