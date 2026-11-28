CREATE TABLE IF NOT EXISTS service_integrations (
 name text PRIMARY KEY CHECK(name IN ('resend','turnstile')),
 enabled boolean NOT NULL DEFAULT false,
 config jsonb NOT NULL DEFAULT '{}',
 key_envelope jsonb,
 version integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO service_integrations(name) VALUES('resend'),('turnstile') ON CONFLICT DO NOTHING;
