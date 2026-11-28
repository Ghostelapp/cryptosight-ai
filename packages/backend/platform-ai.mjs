import { query } from "./store.mjs";
import { rootKey } from "./auth.mjs";
import { credential } from "./ai-credentials.mjs";
import { decryptKey } from "../security/key-vault.mjs";

export async function platformSettings() {
  const row = (
    await query("SELECT config,version FROM platform_settings WHERE id=1")
  ).rows[0];
  return {
    ai_enabled: true,
    free_daily_limit: Number(process.env.FREE_DAILY_LIMIT || 10),
    pro_daily_limit: Number(process.env.PRO_DAILY_LIMIT || 100),
    free_daily_budget_usd: Number(process.env.FREE_DAILY_BUDGET_USD || 5),
    pro_daily_budget_usd: Number(process.env.PRO_DAILY_BUDGET_USD || 20),
    announcement: { en: "", pl: "", de: "" },
    ...row.config,
    version: row.version,
  };
}
export async function assertAIUser(userId) {
  const settings = await platformSettings();
  if (!settings.ai_enabled) throw new Error("ai_paused");
  const user = (
    await query(
      "SELECT id,tier,role FROM users WHERE id=$1 AND suspended=false AND deleted_at IS NULL",
      [userId],
    )
  ).rows[0];
  if (!user) throw new Error("account_suspended");
  return { user, settings };
}
const publicFields = "id,name,provider,model,description,min_tier,version";
export async function availableAgents(user) {
  return (
    await query(
      `SELECT ${publicFields} FROM platform_agents WHERE enabled=true AND (min_tier='free' OR $1='pro' OR $2='admin') ORDER BY name,id`,
      [user.tier, user.role],
    )
  ).rows;
}
export async function resolveAIConfig(userId, config) {
  const { user } = await assertAIUser(userId);
  if (!config.agentId) {
    if (user.role !== "admin") throw new Error("agent_required");
    return { ...config };
  }
  const agent = (
    await query("SELECT * FROM platform_agents WHERE id=$1 AND enabled=true", [
      config.agentId,
    ])
  ).rows[0];
  if (
    !agent ||
    (agent.min_tier === "pro" && user.tier !== "pro" && user.role !== "admin")
  )
    throw new Error("agent_unavailable");
  return {
    ...config,
    provider: agent.provider,
    model: agent.model,
    agentVersion: agent.version,
  };
}
export async function platformCredential(userId, config) {
  if (!config.agentId) {
    await resolveAIConfig(userId, config);
    return null;
  }
  const selected = await resolveAIConfig(userId, config);
  if (
    selected.provider !== config.provider ||
    selected.model !== config.model ||
    (config.agentVersion && selected.agentVersion !== config.agentVersion)
  )
    throw new Error("agent_changed");
  const agent = (
    await query("SELECT * FROM platform_agents WHERE id=$1 AND enabled=true", [
      config.agentId,
    ])
  ).rows[0];
  if (!agent) throw new Error("agent_unavailable");
  if (
    agent.version !== selected.agentVersion ||
    agent.provider !== selected.provider ||
    agent.model !== selected.model
  )
    throw new Error("agent_changed");
  const ownKey =
    agent.provider !== "local" &&
    (
      await query(
        "SELECT 1 FROM credentials WHERE user_id=$1 AND provider=$2",
        [userId, agent.provider],
      )
    ).rows.length;
  if (!ownKey && !agent.key_envelope && agent.provider !== "local")
    throw new Error("credential_required");
  return {
    key: ownKey
      ? await credential(userId, agent.provider)
      : agent.provider === "local"
        ? process.env.LOCAL_LLM_KEY || "local"
        : decryptKey(agent.key_envelope, rootKey(), {
            userId: agent.id,
            provider: "platform:" + agent.provider,
          }),
    instructions: agent.instructions,
  };
}
