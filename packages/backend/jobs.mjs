import { randomUUID, createHash } from "node:crypto";
import { query, transaction, audit } from "./store.mjs";
import { rootKey } from "./auth.mjs";
import { decryptKey } from "../security/key-vault.mjs";
import { snapshot, analyze, promptVersion, providers } from "../ai/agent.mjs";
import { history, validateInstrument, depth } from "../market/providers.mjs";
import { backtest, evaluateSetup } from "../quant/research.mjs";
import { cached } from "./cache.mjs";
import {
  resolveAIConfig,
  platformCredential,
  assertAIUser,
} from "./platform-ai.mjs";
export const estimate = () =>
  Number(process.env.ANALYSIS_RESERVATION_USD || 0.5);
export async function credential(userId, provider) {
  if (provider === "local") return process.env.LOCAL_LLM_KEY || "local";
  const r = await query(
    "SELECT * FROM credentials WHERE user_id=$1 AND provider=$2",
    [userId, provider],
  );
  const c = r.rows[0];
  if (!c) throw new Error("credential_required");
  return decryptKey(
    {
      version: c.envelope_version,
      keyId: c.key_id,
      ciphertext: Buffer.from(c.ciphertext).toString("base64"),
      nonce: Buffer.from(c.nonce).toString("base64"),
      tag: Buffer.from(c.tag).toString("base64"),
    },
    rootKey(),
    { userId, provider },
  );
}
export async function queueAnalysis(user, config, key = randomUUID()) {
  config = await resolveAIConfig(user.id, config);
  validateInstrument(config);
  if (
    !providers.includes(config.provider) ||
    !/^[a-zA-Z0-9._:/-]{1,100}$/.test(config.model) ||
    !["en", "pl", "de"].includes(config.locale) ||
    !["quick", "deep", "explain"].includes(config.mode)
  )
    throw new Error("invalid_analysis");
  if (config.agentId) await platformCredential(user.id, config);
  else await credential(user.id, config.provider);
  const existing = await query(
    "SELECT id,status FROM analyses WHERE user_id=$1 AND idempotency_key=$2",
    [user.id, key],
  );
  if (existing.rows.length) return existing.rows[0];
  const { settings, user: activeUser } = await assertAIUser(user.id);
  const cap =
      settings[
        activeUser.tier === "pro" ? "pro_daily_limit" : "free_daily_limit"
      ],
    budget =
      settings[
        activeUser.tier === "pro"
          ? "pro_daily_budget_usd"
          : "free_daily_budget_usd"
      ];
  const id = randomUUID();
  return cached(
    "analysis-job:" +
      JSON.stringify([user.id, config, Math.floor(Date.now() / 60000)]),
    60,
    () =>
      transaction(async (tx) => {
        await tx.query(
          "INSERT INTO daily_budgets(user_id,day) VALUES($1,CURRENT_DATE) ON CONFLICT DO NOTHING",
          [user.id],
        );
        const r = await tx.query(
          "UPDATE daily_budgets SET reserved=reserved+$2,analyses=analyses+1 WHERE user_id=$1 AND day=CURRENT_DATE AND analyses<$3 AND used+reserved+$2<=$4 RETURNING *",
          [user.id, estimate(), cap, budget],
        );
        if (!r.rows.length) throw new Error("daily_limit");
        await tx.query(
          "INSERT INTO analyses(id,user_id,locale,provider,model,prompt_version,schema_version,status,idempotency_key,mode,request_config,reservation_usd) VALUES($1,$2,$3,$4,$5,$6,1,'queued',$7,$8,$9,$10)",
          [
            id,
            user.id,
            config.locale,
            config.provider,
            config.model,
            promptVersion,
            key,
            config.mode,
            JSON.stringify(config),
            estimate(),
          ],
        );
        return {
          id,
          status: "queued",
          estimated_cost_usd: estimate(),
          cost_type: "conservative_reservation_not_quote",
        };
      }),
  );
}
export async function runAnalysis(job) {
  let usage = { inputTokens: 0, outputTokens: 0 },
    actual = 0,
    attempted = false;
  try {
    const config = job.request_config;
    await assertAIUser(job.user_id);
    const managed = await platformCredential(job.user_id, config);
    const providerKey =
      managed?.key || (await credential(job.user_id, job.provider));
    const snap = await snapshot(config, config.mode),
      hash = createHash("sha256").update(JSON.stringify(snap)).digest("hex");
    const stored = await query(
      "INSERT INTO market_snapshots(venue,market,symbol,timeframe,observed_at,snapshot_hash,data,schema_version) VALUES($1,$2,$3,$4,$5,$6,$7,1) ON CONFLICT(snapshot_hash) DO UPDATE SET snapshot_hash=EXCLUDED.snapshot_hash RETURNING id",
      [
        config.venue,
        config.market,
        config.symbol,
        config.timeframe,
        snap.timestamp,
        hash,
        JSON.stringify(snap),
      ],
    );
    await query("UPDATE analyses SET snapshot_id=$1 WHERE id=$2", [
      stored.rows[0].id,
      job.id,
    ]);
    await assertAIUser(job.user_id);
    const currentManaged = await platformCredential(job.user_id, config);
    attempted = true;
    const output = await analyze({
      provider: job.provider,
      model: job.model,
      key: currentManaged?.key || providerKey,
      agentInstructions: currentManaged?.instructions || managed?.instructions,
      locale: job.locale,
      snap,
    });
    usage = output.usage;
    const pricing = JSON.parse(process.env.MODEL_PRICING_JSON || "{}")[
      `${job.provider}:${job.model}`
    ];
    actual = pricing
      ? (usage.inputTokens * pricing.input +
          usage.outputTokens * pricing.output) /
        1e6
      : +job.reservation_usd;
    const expiry = new Date(
      Date.now() +
        { scalp: 3600000, intraday: 86400000, swing: 604800000 }[
          output.result.setups[0].time_horizon
        ],
    );
    await transaction(async (tx) => {
      await tx.query(
        "UPDATE analyses SET status='completed',result=$1,cost_usd=$2,expires_at=$3 WHERE id=$4",
        [JSON.stringify(output.result), actual, expiry, job.id],
      );
      for (const setup of output.result.setups.filter(
        (s) => s.direction !== "NO_TRADE",
      ))
        await tx.query(
          "INSERT INTO signals(analysis_id,direction,entry,stop_loss,targets,expires_at,setup) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            job.id,
            setup.direction,
            setup.entry.price,
            setup.stop_loss,
            JSON.stringify(setup.take_profits),
            expiry,
            JSON.stringify(setup),
          ],
        );
      await tx.query(
        "INSERT INTO usage_events(user_id,analysis_id,input_tokens,output_tokens,cost_usd) VALUES($1,$2,$3,$4,$5)",
        [job.user_id, job.id, usage.inputTokens, usage.outputTokens, actual],
      );
      await tx.query(
        "INSERT INTO notifications(user_id,title_key,data) VALUES($1,'analysis_ready',$2)",
        [
          job.user_id,
          JSON.stringify({ analysisId: job.id, symbol: config.symbol }),
        ],
      );
    });
  } catch (e) {
    actual = attempted ? +job.reservation_usd : 0;
    await query(
      "UPDATE analyses SET status='failed',error_code=$1 WHERE id=$2",
      [
        [
          "insufficient_fresh_data",
          "credential_required",
          "agent_unavailable",
          "agent_changed",
          "ai_paused",
          "account_suspended",
          "encryption_not_configured",
          "ai_validation_failed",
          "snapshot_too_large",
        ].includes(e.message)
          ? e.message
          : "analysis_failed",
        job.id,
      ],
    );
  } finally {
    await query(
      "UPDATE daily_budgets SET reserved=GREATEST(0,reserved-$2),used=used+$3 WHERE user_id=$1 AND day=$4::date",
      [
        job.user_id,
        +job.reservation_usd,
        actual,
        new Date(job.created_at).toISOString().slice(0, 10),
      ],
    );
  }
}
export async function claimAnalysis() {
  return transaction(async (tx) => {
    const r = await tx.query(
      "SELECT * FROM analyses WHERE status='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
    );
    if (!r.rows.length) return null;
    await tx.query(
      "UPDATE analyses SET status='running',started_at=now() WHERE id=$1",
      [r.rows[0].id],
    );
    return r.rows[0];
  });
}
export async function evaluateSignals() {
  const jobs = (
    await query(
      "SELECT s.*,a.request_config,s.created_at AS published_at FROM signals s JOIN analyses a ON a.id=s.analysis_id WHERE s.status IN ('pending','active') ORDER BY s.created_at LIMIT 50",
    )
  ).rows;
  for (const j of jobs) {
    try {
      const data = await history(j.request_config, {
        from: +new Date(j.published_at),
        limit: 3000,
      });
      const out = evaluateSetup(
        j.setup,
        data.candles.filter((c) => c.closed),
        {
          publishedAt: +new Date(j.published_at),
          expiresAt: +new Date(j.expires_at),
        },
      );
      await query(
        "UPDATE signals SET status=$1,evaluation=$2,last_evaluated_at=now() WHERE id=$3",
        [out.status, JSON.stringify(out), j.id],
      );
    } catch {}
  }
}
export async function runBacktests() {
  const job = await transaction(async (tx) => {
    const r = await tx.query(
      "SELECT * FROM backtests WHERE status='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
    );
    if (r.rows[0])
      await tx.query(
        "UPDATE backtests SET status='running',started_at=now() WHERE id=$1",
        [r.rows[0].id],
      );
    return r.rows[0];
  });
  if (!job) return;
  try {
    const data = await history(job.strategy, { limit: 3000 }),
      r = backtest(
        data.candles.filter((c) => c.closed),
        job.strategy,
      );
    await query(
      "UPDATE backtests SET status='completed',result=$1,dataset_hash=$2 WHERE id=$3",
      [
        JSON.stringify(r),
        createHash("sha256").update(JSON.stringify(data.candles)).digest("hex"),
        job.id,
      ],
    );
  } catch {
    await query("UPDATE backtests SET status='failed' WHERE id=$1", [job.id]);
  }
}

// A crashed provider call has unknown billable usage: fail conservatively rather than replay it.
export async function recoverAbandonedJobs() {
  await transaction(async (tx) => {
    const rows = (
      await tx.query(
        "UPDATE analyses SET status='failed',error_code='worker_interrupted',cost_usd=reservation_usd WHERE status='running' AND COALESCE(started_at,created_at)<now()-interval '30 minutes' RETURNING user_id,created_at,reservation_usd",
      )
    ).rows;
    for (const row of rows)
      await tx.query(
        "UPDATE daily_budgets SET reserved=GREATEST(0,reserved-$2),used=used+$2 WHERE user_id=$1 AND day=$3::date",
        [
          row.user_id,
          row.reservation_usd,
          new Date(row.created_at).toISOString().slice(0, 10),
        ],
      );
    await tx.query(
      "UPDATE backtests SET status='failed' WHERE status='running' AND COALESCE(started_at,created_at)<now()-interval '30 minutes'",
    );
  });
}
export async function withAIBudget(user, config, call) {
  const { settings, user: activeUser } = await assertAIUser(user.id);
  const reservation = estimate(),
    cap =
      settings[
        activeUser.tier === "pro" ? "pro_daily_limit" : "free_daily_limit"
      ],
    budget =
      settings[
        activeUser.tier === "pro"
          ? "pro_daily_budget_usd"
          : "free_daily_budget_usd"
      ];
  const day = await transaction(async (tx) => {
    await tx.query(
      "INSERT INTO daily_budgets(user_id,day) VALUES($1,CURRENT_DATE) ON CONFLICT DO NOTHING",
      [user.id],
    );
    const r = await tx.query(
      "UPDATE daily_budgets SET reserved=reserved+$2,analyses=analyses+1 WHERE user_id=$1 AND day=CURRENT_DATE AND analyses<$3 AND used+reserved+$2<=$4 RETURNING day::text AS day",
      [user.id, reservation, cap, budget],
    );
    if (!r.rows.length) throw new Error("daily_limit");
    return r.rows[0].day;
  });
  let cost = reservation,
    usage = { inputTokens: 0, outputTokens: 0 };
  try {
    const result = await call();
    usage = result.usage || usage;
    const pricing = JSON.parse(process.env.MODEL_PRICING_JSON || "{}")[
      config.provider + ":" + config.model
    ];
    if (
      pricing &&
      [pricing.input, pricing.output].every((n) => Number.isFinite(n) && n >= 0)
    )
      cost =
        (usage.inputTokens * pricing.input +
          usage.outputTokens * pricing.output) /
        1e6;
    return result;
  } finally {
    await transaction(async (tx) => {
      await tx.query(
        "UPDATE daily_budgets SET reserved=GREATEST(0,reserved-$2),used=used+$3 WHERE user_id=$1 AND day=$4::date",
        [user.id, reservation, cost, day],
      );
      await tx.query(
        "INSERT INTO usage_events(user_id,input_tokens,output_tokens,cost_usd) VALUES($1,$2,$3,$4)",
        [user.id, usage.inputTokens, usage.outputTokens, cost],
      );
    });
  }
}
