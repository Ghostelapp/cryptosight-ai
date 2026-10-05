-- EVM wallets are real identities, without fabricated email addresses.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
CREATE TABLE IF NOT EXISTS wallet_identities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 address text NOT NULL UNIQUE CHECK(address ~ '^0x[0-9a-f]{40}$'),
 chain_id bigint NOT NULL CHECK(chain_id>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 last_used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_identities_user_idx ON wallet_identities(user_id);
CREATE TABLE IF NOT EXISTS wallet_challenges (
 id uuid PRIMARY KEY,
 user_id uuid REFERENCES users(id) ON DELETE CASCADE,
 address text NOT NULL,
 chain_id bigint NOT NULL,
 purpose text NOT NULL CHECK(purpose IN ('auth','link','unlink')),
 locale text NOT NULL CHECK(locale IN ('en','pl','de')),
 nonce_hash text NOT NULL UNIQUE,
 browser_hash text NOT NULL,
 message text NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_challenges_expiry_idx ON wallet_challenges(expires_at);
