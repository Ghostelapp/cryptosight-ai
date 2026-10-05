import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
process.env.DEV_DATABASE_PATH = "memory://";
process.env.NODE_ENV = "test";
process.env.APP_ORIGIN = "http://localhost:3000";
process.env.BYOK_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.SESSION_SECRET = randomBytes(32).toString("hex");
const { handle } = await import("../packages/backend/api.mjs");
const { query, db } = await import("../packages/backend/store.mjs");
const { resolveAIConfig, platformCredential } =
  await import("../packages/backend/platform-ai.mjs");
const { queueAnalysis, withAIBudget, runAnalysis } =
  await import("../packages/backend/jobs.mjs");
const { totpBegin, totpEnable } = await import("../packages/backend/auth.mjs");
const password = "admin-test-password-123";
let admin, member, agent;
async function req(path, user, method = "GET", body, extra = {}) {
  const r = await handle(
    new Request("http://localhost:3000/api/v1/" + path, {
      method,
      headers: {
        origin: process.env.APP_ORIGIN,
        "content-type": "application/json",
        ...(user ? { cookie: user.cookie, "x-csrf-token": user.csrf } : {}),
        ...extra,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
  );
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
async function signin(email) {
  const login = await req("auth/login", null, "POST", { email, password });
  assert.equal(login.status, 200);
  const me = await req("auth/me", { cookie: login.cookie });
  return { cookie: login.cookie, csrf: me.data.csrfToken, ...me.data.user };
}
before(async () => {
  for (const email of ["admin@example.com", "member@example.com"])
    assert.equal(
      (
        await req("auth/register", null, "POST", {
          email,
          password,
          consent: true,
        })
      ).status,
      201,
    );
  await query("UPDATE users SET role='admin' WHERE email='admin@example.com'");
  admin = await signin("admin@example.com");
  member = await signin("member@example.com");
});
after(async () => {
  await (await db()).close();
});
test("admin endpoints reject anonymous, members, forged origin and missing CSRF", async () => {
  for (const path of [
    "admin/overview",
    "admin/users",
    "admin/agents",
    "admin/jobs",
    "admin/audit",
    "admin/settings",
  ]) {
    assert.equal((await req(path, null)).status, 401);
    assert.equal((await req(path, member)).status, 403);
    assert.equal((await req(path, admin)).status, 200);
  }
  assert.equal(
    (await req("admin/settings", admin, "PUT", {}, { "x-csrf-token": "" }))
      .status,
    403,
  );
  assert.equal(
    (
      await req(
        "admin/settings",
        admin,
        "PUT",
        {},
        { origin: "https://evil.example" },
      )
    ).status,
    403,
  );
  assert.equal((await req("admin/users", member, "POST", {})).status, 405);
  assert.equal((await req("admin/agents", admin, "POST", null)).status, 400);
});
test("platform API keys stay encrypted and write-only, with strict version and input checks", async () => {
  const key = "secret-platform-api-key-123456";
  const b = {
    name: "Market analyst",
    provider: "openai",
    model: "gpt-test",
    apiKey: key,
    enabled: true,
    description: "test analyst",
    instructions: "Focus on liquidity",
    min_tier: "free",
  };
  const saved = await req("admin/agents", admin, "POST", b);
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  agent = saved.data;
  assert.equal(agent.has_key, true);
  assert.ok(!JSON.stringify(agent).includes(key));
  assert.ok(!("key_envelope" in agent));
  const stored = (
    await query("SELECT key_envelope FROM platform_agents WHERE id=$1", [
      agent.id,
    ])
  ).rows[0];
  assert.ok(!JSON.stringify(stored).includes(key));
  assert.equal(stored.key_envelope.version, 1);
  const resolved = await resolveAIConfig(member.id, {
    provider: "anthropic",
    model: "spoofed",
    agentId: agent.id,
    locale: "pl",
  });
  assert.equal(resolved.provider, "openai");
  assert.equal(resolved.model, "gpt-test");
  const credential = await platformCredential(member.id, resolved);
  assert.equal(credential.key, key);
  assert.equal(credential.instructions, "Focus on liquidity");
  const pub = await req("agents", member);
  assert.equal(pub.status, 200);
  assert.equal(pub.data[0].id, agent.id);
  assert.ok(!JSON.stringify(pub.data).includes("instructions"));
  assert.ok(!JSON.stringify(pub.data).includes(key));
  const { id, has_key, created_at, updated_at, ...editable } = agent;
  assert.equal(
    (
      await req("admin/agents/" + id, admin, "PUT", {
        ...editable,
        version: 999,
        apiKey: "another-secret",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await req("admin/agents/" + id, admin, "PUT", {
        ...editable,
        endpoint: "http://127.0.0.1",
      })
    ).status,
    400,
  );
  const update = await req("admin/agents/" + id, admin, "PUT", {
    ...editable,
    description: "Updated",
  });
  assert.equal(update.status, 200);
  agent = update.data;
  await assert.rejects(
    platformCredential(member.id, resolved),
    /agent_changed/,
  );
  const fresh = await resolveAIConfig(member.id, { agentId: id });
  assert.equal((await platformCredential(member.id, fresh)).key, key);
  const audit = (await req("admin/audit", admin)).data;
  assert.ok(!JSON.stringify(audit).includes(key));
});
test("a managed agent powers journal review without a personal API key and its credential stays on the server", async () => {
  const originalFetch = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://api.openai.com/v1/chat/completions");
    sent = options;
    return Response.json({
      choices: [{ message: { content: "Educational journal review." } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });
  };
  try {
    const response = await req("journal-review", member, "POST", {
      provider: "anthropic",
      model: "spoofed-model",
      agentId: agent.id,
      locale: "pl",
    });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    assert.equal(response.data.content, "Educational journal review.");
    assert.equal(
      new Headers(sent.headers).get("authorization"),
      "Bearer secret-platform-api-key-123456",
    );
    const payload = JSON.parse(sent.body);
    assert.equal(payload.model, "gpt-test");
    assert.ok(payload.messages[0].content.includes("Focus on liquidity"));
    assert.ok(payload.messages[0].content.includes("Polish"));
    assert.ok(!JSON.stringify(response).includes("secret-platform-api-key"));
    const queued = await queueAnalysis(
      member,
      {
        agentId: agent.id,
        provider: "anthropic",
        model: "spoof",
        locale: "pl",
        mode: "quick",
        venue: "binance",
        market: "spot",
        symbol: "BTCUSDT",
        timeframe: "1h",
      },
      "managed-job-test",
    );
    const job = (
      await query(
        "SELECT provider,model,request_config FROM analyses WHERE id=$1",
        [queued.id],
      )
    ).rows[0];
    assert.equal(job.provider, "openai");
    assert.equal(job.model, "gpt-test");
    assert.equal(job.request_config.agentVersion, agent.version);
    await req("admin/job-cancellations", admin, "POST", { id: queued.id });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("tier restrictions, disabling agents and provider changes do not bypass key handling", async () => {
  const payload = () => ({
    name: agent.name,
    provider: agent.provider,
    model: agent.model,
    description: agent.description,
    instructions: agent.instructions,
    enabled: agent.enabled,
    min_tier: agent.min_tier,
    version: agent.version,
  });
  let r = await req("admin/agents/" + agent.id, admin, "PUT", {
    ...payload(),
    min_tier: "pro",
  });
  assert.equal(r.status, 200);
  agent = r.data;
  await assert.rejects(
    resolveAIConfig(member.id, { agentId: agent.id }),
    /agent_unavailable/,
  );
  assert.equal((await req("agents", member)).data.length, 0);
  assert.equal(
    (await resolveAIConfig(admin.id, { agentId: agent.id })).model,
    "gpt-test",
  );
  r = await req("admin/agents/" + agent.id, admin, "PUT", {
    ...payload(),
    provider: "anthropic",
  });
  assert.equal(r.status, 503);
  assert.equal(r.data.code, "credential_required");
  const pending = await queueAnalysis(
    admin,
    {
      agentId: agent.id,
      provider: "openai",
      model: "gpt-test",
      locale: "en",
      mode: "quick",
      venue: "binance",
      market: "spot",
      symbol: "BTCUSDT",
      timeframe: "1h",
    },
    "disable-worker-check",
  );
  const pendingRow = (
    await query("SELECT * FROM analyses WHERE id=$1", [pending.id])
  ).rows[0];
  r = await req("admin/agents/" + agent.id, admin, "PUT", {
    ...payload(),
    enabled: false,
  });
  assert.equal(r.status, 200);
  agent = r.data;
  await runAnalysis(pendingRow);
  const failed = (
    await query("SELECT status,error_code FROM analyses WHERE id=$1", [
      pending.id,
    ])
  ).rows[0];
  assert.equal(failed.status, "failed");
  assert.equal(failed.error_code, "agent_unavailable");
  assert.equal(
    +(
      await query("SELECT reserved FROM daily_budgets WHERE user_id=$1", [
        admin.id,
      ])
    ).rows[0].reserved,
    0,
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      choices: [{ message: { content: "Connection acknowledged." } }],
      usage: { prompt_tokens: 4, completion_tokens: 3 },
    });
  try {
    const check = await req("admin/agent-tests", admin, "POST", {
      agentId: agent.id,
    });
    assert.equal(check.status, 200, JSON.stringify(check.data));
    assert.equal(check.data.ok, true);
    assert.equal(
      (
        await query("SELECT enabled FROM platform_agents WHERE id=$1", [
          agent.id,
        ])
      ).rows[0].enabled,
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  await assert.rejects(
    resolveAIConfig(admin.id, { agentId: agent.id }),
    /agent_unavailable/,
  );
  r = await req("admin/agents/" + agent.id, admin, "PUT", {
    ...payload(),
    enabled: false,
    clearKey: true,
  });
  assert.equal(r.status, 200);
  agent = r.data;
  assert.equal(agent.has_key, false);
});
test("user access changes revoke sessions, stop schedules and prevent admin self-lockout", async () => {
  assert.equal(
    (
      await req("admin/users/" + admin.id, admin, "PATCH", {
        role: "user",
        suspended: false,
      })
    ).status,
    409,
  );
  assert.equal((await req("account", admin, "DELETE", {})).status, 409);
  await query(
    "INSERT INTO schedules(user_id,config,interval_minutes,next_run) VALUES($1,'{}',15,now())",
    [member.id],
  );
  assert.equal(
    (
      await req("admin/users/" + member.id, admin, "PATCH", {
        role: "user",
        suspended: true,
      })
    ).status,
    200,
  );
  assert.equal((await req("journal", member)).status, 401);
  assert.equal(
    (await req("auth/login", null, "POST", { email: member.email, password }))
      .status,
    403,
  );
  assert.equal(
    (await query("SELECT enabled FROM schedules WHERE user_id=$1", [member.id]))
      .rows[0].enabled,
    false,
  );
  assert.equal(
    (
      await req("admin/users/" + member.id, admin, "PATCH", {
        role: "user",
        suspended: false,
      })
    ).status,
    200,
  );
  member = await signin(member.email);
  assert.equal(
    (await query("SELECT enabled FROM schedules WHERE user_id=$1", [member.id]))
      .rows[0].enabled,
    false,
  );
  const forged = await req("settings", member, "PATCH", {
    locale: "en",
    timezone: "UTC",
    settings: {},
    role: "admin",
  });
  assert.equal(forged.status, 200);
  assert.equal((await req("admin/overview", member)).status, 403);
});
test("platform limits and pause apply to queued analyses and synchronous AI budgets", async () => {
  const original = (await req("admin/settings", admin)).data;
  const paused = await req("admin/settings", admin, "PUT", {
    ...original,
    ai_enabled: false,
  });
  assert.equal(paused.status, 200);
  await assert.rejects(resolveAIConfig(member.id, {}), /ai_paused/);
  await assert.rejects(
    withAIBudget(member, { provider: "openai", model: "test" }, () => {
      throw new Error("must_not_call");
    }),
    /ai_paused/,
  );
  assert.equal(
    (await req("admin/settings", admin, "PUT", original)).status,
    409,
  );
  const updated = await req("admin/settings", admin, "PUT", {
    ...paused.data,
    ai_enabled: true,
    free_daily_limit: 0,
  });
  assert.equal(updated.status, 200);
  await assert.rejects(
    withAIBudget(member, { provider: "openai", model: "test" }, () => {
      throw new Error("must_not_call");
    }),
    /daily_limit/,
  );
  assert.equal(
    (
      await req("admin/settings", admin, "PUT", {
        ...updated.data,
        free_daily_limit: 10,
      })
    ).status,
    200,
  );
});
test("queued job cancellation releases its reservation once and refuses running jobs", async () => {
  const id = randomUUID();
  await query(
    "INSERT INTO daily_budgets(user_id,day,reserved) VALUES($1,CURRENT_DATE,0.5) ON CONFLICT(user_id,day) DO UPDATE SET reserved=0.5",
    [member.id],
  );
  await query(
    "INSERT INTO analyses(id,user_id,locale,provider,model,prompt_version,schema_version,status,idempotency_key,mode,request_config,reservation_usd) VALUES($1,$2,'en','openai','test','test',1,'queued',$3,'quick','{}',0.5)",
    [id, member.id, id],
  );
  assert.equal(
    (await req("admin/job-cancellations", admin, "POST", { id })).status,
    200,
  );
  assert.equal(
    (await req("admin/job-cancellations", admin, "POST", { id })).status,
    409,
  );
  assert.equal(
    +(
      await query("SELECT reserved FROM daily_budgets WHERE user_id=$1", [
        member.id,
      ])
    ).rows[0].reserved,
    0,
  );
  assert.equal(
    (await query("SELECT error_code FROM analyses WHERE id=$1", [id])).rows[0]
      .error_code,
    "admin_cancelled",
  );
  await query("UPDATE analyses SET status='running' WHERE id=$1", [id]);
  assert.equal(
    (await req("admin/job-cancellations", admin, "POST", { id })).status,
    409,
  );
});
test("enabled admin 2FA is enforced on every administration mutation", async () => {
  const { secret } = totpBegin(admin);
  const { TOTP } = await import("@otplib/totp");
  const { NodeCryptoPlugin } = await import("@otplib/plugin-crypto-node");
  const { ScureBase32Plugin } = await import("@otplib/plugin-base32-scure");
  const totp = new TOTP({
    crypto: new NodeCryptoPlugin(),
    base32: new ScureBase32Plugin(),
  });
  const code = await totp.generate({ secret });
  await totpEnable(admin, secret, code);
  assert.equal(
    (
      await req("admin/agents", admin, "POST", {
        name: "MFA check",
        provider: "openai",
        model: "test",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req("admin/agents", admin, "POST", {
        name: "MFA check",
        provider: "openai",
        model: "test",
        totp: code,
      })
    ).status,
    200,
  );
});
