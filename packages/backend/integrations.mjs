import { query, transaction } from "./store.mjs";
import { rootKey } from "./auth.mjs";
import { encryptKey, decryptKey } from "../security/key-vault.mjs";
import { z } from "zod";
const identity = (name) => ({
  userId: "platform-integrations",
  provider: name,
});
export async function serviceConfig(name, includeSecret = false) {
  const row = (
    await query("SELECT * FROM service_integrations WHERE name=$1", [name])
  ).rows[0];
  if (!row) throw new Error("integration_not_configured");
  return {
    name,
    enabled: row.enabled,
    config: row.config,
    hasSecret: !!row.key_envelope,
    version: row.version,
    ...(includeSecret && row.key_envelope
      ? { secret: decryptKey(row.key_envelope, rootKey(), identity(name)) }
      : {}),
  };
}
export async function saveService(user, name, input) {
  if (!["resend", "turnstile"].includes(name)) throw new Error("not_found");
  const b = z
    .object({
      enabled: z.boolean(),
      version: z.number().int().positive(),
      secret: z.string().trim().min(8).max(4096).optional(),
      config:
        name === "resend"
          ? z.object({ from: z.string().trim().email().max(254) }).strict()
          : z
              .object({
                siteKey: z
                  .string()
                  .trim()
                  .min(8)
                  .max(200)
                  .regex(/^[a-zA-Z0-9_-]+$/),
              })
              .strict(),
    })
    .strict()
    .parse(input);
  if (
    name === "turnstile" &&
    process.env.NODE_ENV === "production" &&
    [b.config.siteKey, b.secret].some(
      (value) => typeof value === "string" && /^[123]x0{10}/.test(value),
    )
  )
    throw new Error("invalid_admin_request");
  return transaction(async (tx) => {
    const current = (
      await tx.query(
        "SELECT * FROM service_integrations WHERE name=$1 FOR UPDATE",
        [name],
      )
    ).rows[0];
    if (!current || current.version !== b.version)
      throw new Error("version_conflict");
    const envelope = b.secret
      ? encryptKey(b.secret, rootKey(), {
          ...identity(name),
          keyId: process.env.BYOK_KEY_ID || "primary",
        })
      : current.key_envelope;
    if (b.enabled && !envelope) throw new Error("integration_not_configured");
    await tx.query(
      "UPDATE service_integrations SET enabled=$1,config=$2,key_envelope=$3,version=version+1,updated_at=now() WHERE name=$4",
      [
        b.enabled,
        JSON.stringify(b.config),
        envelope ? JSON.stringify(envelope) : null,
        name,
      ],
    );
    await tx.query(
      "INSERT INTO audit_logs(user_id,action,metadata) VALUES($1,'admin.integration.updated',$2)",
      [user.id, JSON.stringify({ service: name, enabled: b.enabled })],
    );
    return { saved: true, version: current.version + 1 };
  });
}
export async function mailConfig() {
  if (
    process.env.EMAIL_FROM &&
    (process.env.SMTP_URL || process.env.RESEND_API_KEY)
  )
    return {
      ready: true,
      from: process.env.EMAIL_FROM,
      smtp: process.env.SMTP_URL,
      secret: process.env.RESEND_API_KEY,
    };
  const s = await serviceConfig("resend", true);
  return {
    ready: !!(s.enabled && s.secret && s.config.from),
    from: s.config.from,
    secret: s.secret,
  };
}
export async function turnstileConfig() {
  const siteKey = process.env.TURNSTILE_SITE_KEY,
    secret = process.env.TURNSTILE_SECRET_KEY;
  if (siteKey || secret)
    return { enabled: true, ready: !!(siteKey && secret), siteKey, secret };
  const s = await serviceConfig("turnstile", true);
  return {
    enabled: s.enabled,
    ready: !!(s.enabled && s.secret && s.config.siteKey),
    siteKey: s.config.siteKey,
    secret: s.secret,
  };
}
