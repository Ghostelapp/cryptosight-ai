import { z } from "zod";
import { randomUUID } from "node:crypto";
import { query, transaction } from "./store.mjs";
import { checkTotp, rootKey, rateLimit } from "./auth.mjs";
import { encryptKey, decryptKey } from "../security/key-vault.mjs";
import { platformSettings } from "./platform-ai.mjs";
import { llm, providers } from "../ai/agent.mjs";
import { withAIBudget } from "./jobs.mjs";
import { serviceConfig, saveService } from "./integrations.mjs";
import { email } from "./mail.mjs";
import { messages } from "./localization.mjs";
const uuid = z.string().uuid();
export const agentSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    provider: z.enum(providers),
    model: z.string().regex(/^[a-zA-Z0-9._:/-]{1,100}$/),
    description: z.string().max(500).default(""),
    instructions: z.string().max(2000).default(""),
    enabled: z.boolean().default(false),
    min_tier: z.enum(["free", "pro"]).default("free"),
    apiKey: z.string().trim().min(8).max(4096).optional(),
    clearKey: z.boolean().default(false),
    version: z.number().int().positive().optional(),
  })
  .strict();
export const settingsSchema = z
  .object({
    ai_enabled: z.boolean(),
    free_daily_limit: z.number().int().min(0).max(10000),
    pro_daily_limit: z.number().int().min(0).max(10000),
    free_daily_budget_usd: z.number().min(0).max(10000),
    pro_daily_budget_usd: z.number().min(0).max(10000),
    announcement: z
      .object({
        en: z.string().max(500),
        pl: z.string().max(500),
        de: z.string().max(500),
      })
      .strict(),
    version: z.number().int().positive(),
  })
  .strict();
const fields =
  "id,name,provider,model,description,instructions,enabled,min_tier,(key_envelope IS NOT NULL) AS has_key,version,created_at,updated_at";
async function log(tx, user, action, id = null, metadata = {}) {
  await tx.query(
    "INSERT INTO audit_logs(user_id,action,resource_id,metadata) VALUES($1,$2,$3,$4)",
    [user.id, action, id, JSON.stringify(metadata)],
  );
}
export async function adminHandle(user, path, method, input, params) {
  if (user.role !== "admin") throw new Error("admin_required");
  await rateLimit("admin:" + user.id, 60, 60);
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("invalid_admin_request");
  const { totp, ...body } = input;
  if (method !== "GET" && user.two_factor) {
    const full = (
      await query("SELECT id,totp_envelope FROM users WHERE id=$1", [user.id])
    ).rows[0];
    if (!(await checkTotp(full, totp))) throw new Error("invalid_totp");
  }
  if (path === "admin/overview") {
    const stats = (
      await query(`SELECT
   (SELECT count(*)::int FROM users WHERE deleted_at IS NULL) AS users,
   (SELECT count(*)::int FROM users WHERE suspended=true AND deleted_at IS NULL) AS suspended,
   (SELECT count(*)::int FROM platform_agents WHERE enabled=true) AS active_agents,
   (SELECT count(*)::int FROM analyses WHERE status='queued') AS queued,
   (SELECT count(*)::int FROM analyses WHERE status='running') AS running,
   (SELECT count(*)::int FROM analyses WHERE status='failed' AND created_at>=CURRENT_DATE) AS failed_today,
   (SELECT COALESCE(sum(cost_usd),0) FROM usage_events WHERE created_at>=CURRENT_DATE) AS cost_today_usd`)
    ).rows[0];
    return { stats, settings: await platformSettings() };
  }
  if (path === "admin/integrations" && method === "GET")
    return Promise.all(
      ["resend", "turnstile"].map((name) => serviceConfig(name)),
    );
  if (path === "admin/integrations/resend/test" && method === "POST") {
    const b = z
      .object({ email: z.string().email().max(254) })
      .strict()
      .parse(body);
    await rateLimit("admin-mail-test:" + user.id, 3, 3600);
    const m = messages(user.locale);
    await email(b.email, m.mailTestSubject, m.mailTestBody);
    return { accepted: true };
  }
  if (
    /^admin\/integrations\/(resend|turnstile)$/.test(path) &&
    method === "PUT"
  )
    return saveService(user, path.split("/")[2], body);
  if (path === "admin/settings") {
    if (method === "GET") return platformSettings();
    const b = settingsSchema.parse(body),
      { version, ...config } = b;
    return transaction(async (tx) => {
      const row = (
        await tx.query(
          "UPDATE platform_settings SET config=$1,version=version+1,updated_at=now() WHERE id=1 AND version=$2 RETURNING version",
          [JSON.stringify(config), version],
        )
      ).rows[0];
      if (!row) throw new Error("version_conflict");
      await log(tx, user, "admin.settings.updated");
      return { ...config, ...row };
    });
  }
  if (path === "admin/users" && method === "GET") {
    const page = z.coerce
        .number()
        .int()
        .min(1)
        .max(100000)
        .default(1)
        .parse(params.page),
      search = z.string().max(254).default("").parse(params.search);
    const where =
      "deleted_at IS NULL AND ($1='' OR email ILIKE '%'||$1||'%' OR id::text=$1 OR EXISTS(SELECT 1 FROM wallet_identities w WHERE w.user_id=users.id AND w.address=$1))";
    const rows = (
      await query(
        `SELECT id,email,role,tier,suspended,email_verified,(totp_envelope IS NOT NULL) AS two_factor,created_at,(SELECT address FROM wallet_identities WHERE user_id=users.id ORDER BY created_at LIMIT 1) AS wallet_address FROM users WHERE ${where} ORDER BY created_at DESC,id LIMIT 25 OFFSET $2`,
        [search, (page - 1) * 25],
      )
    ).rows;
    const total = (
      await query(`SELECT count(*)::int AS total FROM users WHERE ${where}`, [
        search,
      ])
    ).rows[0].total;
    return { items: rows, page, total };
  }
  if (/^admin\/users\//.test(path)) {
    const id = uuid.parse(path.split("/")[2]);
    const b = z
      .object({ role: z.enum(["user", "admin"]), suspended: z.boolean() })
      .strict()
      .parse(body);
    if (id === user.id && (b.role !== "admin" || b.suspended))
      throw new Error("admin_self_lockout");
    return transaction(async (tx) => {
      await tx.query("SELECT id FROM platform_settings WHERE id=1 FOR UPDATE");
      const actor = (
        await tx.query(
          "SELECT role FROM users WHERE id=$1 AND suspended=false AND deleted_at IS NULL",
          [user.id],
        )
      ).rows[0];
      if (actor?.role !== "admin") throw new Error("admin_required");
      const target = (
        await tx.query(
          "SELECT id,role,suspended FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!target) throw new Error("not_found");
      if (
        target.role === "admin" &&
        !target.suspended &&
        (b.role !== "admin" || b.suspended)
      ) {
        const admins = (
          await tx.query(
            "SELECT count(*)::int AS count FROM users WHERE role='admin' AND suspended=false AND deleted_at IS NULL",
          )
        ).rows[0].count;
        if (admins <= 1) throw new Error("admin_last_admin");
      }
      await tx.query("UPDATE users SET role=$1,suspended=$2 WHERE id=$3", [
        b.role,
        b.suspended,
        id,
      ]);
      await tx.query("DELETE FROM sessions WHERE user_id=$1", [id]);
      await tx.query("DELETE FROM auth_tokens WHERE user_id=$1 AND kind='ws'", [
        id,
      ]);
      if (b.suspended)
        await tx.query("UPDATE schedules SET enabled=false WHERE user_id=$1", [
          id,
        ]);
      await log(tx, user, "admin.user.updated", id, b);
      return { saved: true };
    });
  }
  if (path === "admin/agents" && method === "GET")
    return (
      await query(`SELECT ${fields} FROM platform_agents ORDER BY name,id`)
    ).rows;
  if (path === "admin/agents" || /^admin\/agents\//.test(path)) {
    const creating = path === "admin/agents",
      id = creating ? randomUUID() : uuid.parse(path.split("/")[2]);
    if (method === "DELETE") {
      return transaction(async (tx) => {
        const { version: v } = z
          .object({ version: z.number().int().positive() })
          .strict()
          .parse(body);
        const row = (
          await tx.query(
            "DELETE FROM platform_agents WHERE id=$1 AND version=$2 RETURNING id",
            [id, v],
          )
        ).rows[0];
        if (!row) throw new Error("version_conflict");
        await log(tx, user, "admin.agent.deleted", id);
        return { deleted: true };
      });
    }
    const b = agentSchema.parse(body);
    if (b.apiKey && b.clearKey) throw new Error("invalid_agent");
    return transaction(async (tx) => {
      const old = creating
        ? null
        : (
            await tx.query(
              "SELECT * FROM platform_agents WHERE id=$1 FOR UPDATE",
              [id],
            )
          ).rows[0];
      if (!creating && !old) throw new Error("not_found");
      if (old && old.version !== b.version) throw new Error("version_conflict");
      let envelope = old?.provider === b.provider ? old.key_envelope : null;
      if (b.clearKey) envelope = null;
      if (b.apiKey)
        envelope = encryptKey(b.apiKey, rootKey(), {
          userId: id,
          provider: "platform:" + b.provider,
          keyId: process.env.BYOK_KEY_ID || "primary",
        });
      if (b.enabled && b.provider !== "local" && old?.key_envelope && old.provider !== b.provider && !b.apiKey)
        throw new Error("credential_required");
      const args = [
        b.name,
        b.provider,
        b.model,
        b.description,
        b.instructions,
        b.enabled,
        b.min_tier,
        envelope ? JSON.stringify(envelope) : null,
        id,
      ];
      const row = (
        await tx.query(
          creating
            ? `INSERT INTO platform_agents(name,provider,model,description,instructions,enabled,min_tier,key_envelope,id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${fields}`
            : `UPDATE platform_agents SET name=$1,provider=$2,model=$3,description=$4,instructions=$5,enabled=$6,min_tier=$7,key_envelope=$8,version=version+1,updated_at=now() WHERE id=$9 RETURNING ${fields}`,
          args,
        )
      ).rows[0];
      await log(
        tx,
        user,
        creating ? "admin.agent.created" : "admin.agent.updated",
        id,
        { provider: b.provider, key_changed: !!b.apiKey || b.clearKey },
      );
      return row;
    });
  }
  if (path === "admin/agent-tests") {
    const b = z.object({ agentId: uuid }).strict().parse(body);
    await rateLimit("admin-test:" + user.id, 5, 3600);
    const agent = (
      await query("SELECT * FROM platform_agents WHERE id=$1", [b.agentId])
    ).rows[0];
    if (!agent) throw new Error("not_found");
    if (!agent.key_envelope && agent.provider !== "local")
      throw new Error("credential_required");
    const config = {
      provider: agent.provider,
      model: agent.model,
      locale: user.locale,
    };
    const cred = {
      instructions: agent.instructions,
      key:
        agent.provider === "local"
          ? process.env.LOCAL_LLM_KEY || "local"
          : decryptKey(agent.key_envelope, rootKey(), {
              userId: agent.id,
              provider: "platform:" + agent.provider,
            }),
    };
    const result = await withAIBudget(user, config, () =>
      llm({
        ...config,
        key: cred.key,
        agentInstructions: cred.instructions,
        snap: { purpose: "connectivity_check", market_data_available: false },
        mode: "chat",
        message:
          "Reply with a brief acknowledgement of this connectivity check. Do not give market analysis.",
      }),
    );
    await transaction((tx) => log(tx, user, "admin.agent.tested", b.agentId));
    return { ok: true, usage: result.usage };
  }
  if (path === "admin/jobs" && method === "GET")
    return (
      await query(
        "SELECT id,user_id,provider,model,status,error_code,cost_usd,created_at,started_at FROM analyses ORDER BY created_at DESC LIMIT 100",
      )
    ).rows;
  if (path === "admin/job-cancellations") {
    const { id } = z.object({ id: uuid }).strict().parse(body);
    return transaction(async (tx) => {
      const row = (
        await tx.query(
          "UPDATE analyses SET status='failed',error_code='admin_cancelled' WHERE id=$1 AND status='queued' RETURNING user_id,reservation_usd,created_at",
          [id],
        )
      ).rows[0];
      if (!row) throw new Error("job_not_queued");
      await tx.query(
        "UPDATE daily_budgets SET reserved=GREATEST(0,reserved-$2) WHERE user_id=$1 AND day=$3::date",
        [
          row.user_id,
          row.reservation_usd,
          new Date(row.created_at).toISOString().slice(0, 10),
        ],
      );
      await log(tx, user, "admin.job.cancelled", id);
      return { cancelled: true };
    });
  }
  if (path === "admin/audit") {
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .default(1)
      .parse(params.page);
    return {
      items: (
        await query(
          "SELECT id,user_id,action,resource_id,metadata,created_at FROM audit_logs ORDER BY created_at DESC,id LIMIT 50 OFFSET $1",
          [(page - 1) * 50],
        )
      ).rows,
      page,
    };
  }
  throw new Error("not_found");
}
