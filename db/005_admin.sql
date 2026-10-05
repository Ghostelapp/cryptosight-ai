ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS platform_settings (
 id integer PRIMARY KEY CHECK(id=1), config jsonb NOT NULL DEFAULT '{}',
 version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO platform_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS platform_agents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
 provider text NOT NULL CHECK(provider IN ('openai','gemini','anthropic','openrouter','local')),
 model text NOT NULL, description text NOT NULL DEFAULT '', instructions text NOT NULL DEFAULT '',
 enabled boolean NOT NULL DEFAULT false, min_tier text NOT NULL DEFAULT 'free' CHECK(min_tier IN ('free','pro')),
 key_envelope jsonb, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_agents_enabled_idx ON platform_agents(enabled);
