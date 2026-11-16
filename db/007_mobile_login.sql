CREATE TABLE IF NOT EXISTS mobile_login_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes',
 code_challenge text NOT NULL CHECK(code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
 state text NOT NULL CHECK(state ~ '^[a-f0-9]{64}$'),
 user_id uuid REFERENCES users(id) ON DELETE CASCADE,
 code_hash text UNIQUE,
 authorized_at timestamptz
);
CREATE INDEX IF NOT EXISTS mobile_login_expiry_idx ON mobile_login_requests(expires_at);
