import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { listModels } from "../packages/ai/models.mjs";
process.env.DEV_DATABASE_PATH = "memory://";
process.env.NODE_ENV = "test";
process.env.APP_ORIGIN = "http://localhost:3000";
process.env.SESSION_SECRET = randomBytes(32).toString("hex");
process.env.BYOK_ENCRYPTION_KEY = randomBytes(32).toString("base64");
const { handle } = await import("../packages/backend/api.mjs");
const { db, query } = await import("../packages/backend/store.mjs");
const { encryptKey } = await import("../packages/security/key-vault.mjs");
const { rootKey } = await import("../packages/backend/auth.mjs");
let owner, other;
async function request(path, { user, method = "GET", body, csrf = true } = {}) {
  const response = await handle(
    new Request(process.env.APP_ORIGIN + "/api/v1/" + path, {
      method,
      headers: {
        origin: process.env.APP_ORIGIN,
        "content-type": "application/json",
        ...(user
          ? {
              cookie: user.cookie,
              ...(csrf ? { "x-csrf-token": user.csrf } : {}),
            }
          : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
before(async () => {
  for (const name of ["owner", "other"]) {
    const registered = await request("auth/register", {
      method: "POST",
      body: {
        email: name + "-models@example.com",
        password: "models-fixture-password-123",
        consent: true,
      },
    });
    assert.equal(registered.status, 201);
    const me = await request("auth/me", {
      user: { cookie: registered.cookie },
    });
    const user = { cookie: registered.cookie, csrf: me.data.csrfToken };
    if (name === "owner") owner = user;
    else other = user;
  }
  assert.equal(
    (
      await request("credentials", {
        user: owner,
        method: "POST",
        body: { provider: "openai", key: "fixture-owner-secret" },
      })
    ).status,
    200,
  );
});
after(async () => {
  const client = await db();
  await client.close();
});
test("OpenAI catalog authenticates, deduplicates and excludes non-chat products", async () => {
  const result = await listModels(
    "openai",
    "test-key",
    async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/models");
      assert.equal(options.headers.authorization, "Bearer test-key");
      assert.equal(options.redirect, "error");
      return Response.json({
        data: [
          { id: "gpt-fixture" },
          { id: "gpt-fixture" },
          { id: "text-embedding-fixture" },
          { id: "bad<script>" },
        ],
      });
    },
  );
  assert.deepEqual(result.models, [{ id: "gpt-fixture", name: "gpt-fixture" }]);
});
test("Gemini follows page tokens and normalizes generateContent model IDs", async () => {
  let count = 0;
  const result = await listModels(
    "gemini",
    "test-key",
    async (url, options) => {
      assert.equal(options.headers["x-goog-api-key"], "test-key");
      assert.ok(!url.includes("test-key"));
      if (++count === 1)
        return Response.json({
          models: [
            {
              name: "models/gemini-fixture",
              supportedGenerationMethods: ["generateContent"],
            },
          ],
          nextPageToken: "next page",
        });
      assert.equal(new URL(url).searchParams.get("pageToken"), "next page");
      return Response.json({
        models: [
          {
            name: "models/embed-fixture",
            supportedGenerationMethods: ["embedContent"],
          },
        ],
      });
    },
  );
  assert.equal(count, 2);
  assert.equal(result.models[0].id, "gemini-fixture");
  assert.equal(result.models.length, 1);
});
test("Anthropic pagination and OpenRouter user-specific catalog", async () => {
  let page = 0;
  const a = await listModels("anthropic", "test-key", async (url, options) => {
    assert.equal(options.headers["x-api-key"], "test-key");
    if (++page === 1)
      return Response.json({
        data: [{ id: "claude-one", display_name: "Claude One" }],
        has_more: true,
        last_id: "claude-one",
      });
    assert.equal(new URL(url).searchParams.get("after_id"), "claude-one");
    return Response.json({ data: [{ id: "claude-two" }], has_more: false });
  });
  assert.equal(a.models.length, 2);
  const o = await listModels("openrouter", "test-key", async (url) => {
    assert.equal(url, "https://openrouter.ai/api/v1/models/user");
    return Response.json({
      data: [
        { id: "vendor/text", architecture: { output_modalities: ["text"] } },
        { id: "vendor/image", architecture: { output_modalities: ["image"] } },
      ],
    });
  });
  assert.equal(o.models.length, 1);
});
test("Provider errors never expose the upstream response or key", async () => {
  await assert.rejects(
    listModels(
      "openai",
      "private-key",
      async () => new Response("private-key", { status: 401 }),
    ),
    /^Error: provider_key_rejected$/,
  );
  await assert.rejects(
    listModels("openai", "private-key", async () => {
      throw new Error("private-key");
    }),
    /^Error: model_catalog_unavailable$/,
  );
  await assert.rejects(
    listModels("openai", "key", async () => Response.json({ unexpected: [] })),
    /model_catalog_unavailable/,
  );
});
test("Local discovery refuses a host outside the operator allowlist before sending credentials", async () => {
  const previous = process.env.LOCAL_LLM_URL;
  process.env.LOCAL_LLM_URL = "http://169.254.169.254/v1";
  try {
    await assert.rejects(
      listModels("local", "key", () => {
        throw new Error("must not fetch");
      }),
      /provider_host_not_allowed/,
    );
  } finally {
    if (previous === undefined) delete process.env.LOCAL_LLM_URL;
    else process.env.LOCAL_LLM_URL = previous;
  }
});
test("Authenticated catalog decrypts only the current tenant key; POST retains CSRF", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(options.headers.authorization, "Bearer fixture-owner-secret");
    return Response.json({ data: [{ id: "gpt-fixture" }] });
  });
  assert.equal((await request("models?provider=openai")).status, 401);
  assert.equal(
    (await request("models?provider=openai", { user: other })).data.code,
    "credential_required",
  );
  const result = await request("models?provider=openai", { user: owner });
  assert.equal(result.status, 200);
  assert.equal(result.data.models[0].id, "gpt-fixture");
  assert.ok(!JSON.stringify(result).includes("fixture-owner-secret"));
  assert.equal(
    (
      await request("models", {
        user: owner,
        method: "POST",
        csrf: false,
        body: { provider: "openai", key: "fixture-owner-secret" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "models?provider=openai&agentId=" + randomBytes(16).toString("hex"),
        { user: other },
      )
    ).status,
    400,
  );
  const denied = await request(
    "models?provider=openai&agentId=550e8400-e29b-41d4-a716-446655440000",
    { user: other },
  );
  assert.equal(denied.status, 403);
});

test("only administrators can discover models with a stored platform-agent key", async (t) => {
  const id = randomUUID();
  const envelope = encryptKey("fixture-platform-secret", rootKey(), {
    userId: id,
    provider: "platform:openai",
    keyId: "primary",
  });
  await query(
    "INSERT INTO platform_agents(id,name,provider,model,key_envelope) VALUES($1,'Fixture','openai','gpt-fixture',$2)",
    [id, JSON.stringify(envelope)],
  );
  assert.equal(
    (await request("models?provider=openai&agentId=" + id, { user: other }))
      .status,
    403,
  );
  await query(
    "UPDATE users SET role='admin' WHERE email='owner-models@example.com'",
  );
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(
      options.headers.authorization,
      "Bearer fixture-platform-secret",
    );
    return Response.json({ data: [{ id: "gpt-fixture" }] });
  });
  const result = await request("models?provider=openai&agentId=" + id, {
    user: owner,
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.models.length, 1);
  assert.ok(!JSON.stringify(result).includes("fixture-platform-secret"));
  assert.equal(
    (await request("models?provider=anthropic&agentId=" + id, { user: owner }))
      .status,
    404,
  );
});

test("analysis evidence projection remains tenant scoped and excludes the raw snapshot", async () => {
  const ownerId = (
    await query("SELECT id FROM users WHERE email='owner-models@example.com'")
  ).rows[0].id;
  const research = {
    status: "partial",
    frames: [],
    execution: { available: true, spreadBps: 0 },
  };
  const snapshotId = (
    await query(
      "INSERT INTO market_snapshots(venue,market,symbol,timeframe,observed_at,snapshot_hash,data,schema_version) VALUES('binance','spot','BTCUSDT','1h',now(),$1,$2,1) RETURNING id",
      [
        randomUUID(),
        JSON.stringify({ research, privateRaw: "not part of the response" }),
      ],
    )
  ).rows[0].id;
  const id = randomUUID();
  const result = {
    setups: [
      {
        direction: "LONG",
        entry: { price: 100 },
        stop_loss: 90,
        take_profits: [{ price: 120, size_pct: 100 }],
      },
    ],
  };
  await query(
    "INSERT INTO analyses(id,user_id,locale,provider,model,prompt_version,schema_version,status,result,snapshot_id,idempotency_key,mode,request_config,reservation_usd) VALUES($1,$2,'en','openai','fixture','fixture',1,'completed',$3,$4,$5,'deep','{}',0)",
    [id, ownerId, JSON.stringify(result), snapshotId, "research-"+id],
  );
  const response = await request("analyses/" + id, { user: owner });
  assert.equal(response.status, 200);
  assert.deepEqual(response.data.research, research);
  assert.equal(response.data.trade_metrics[0].grossRR, 2);
  assert.ok(!JSON.stringify(response.data).includes("privateRaw"));
  assert.equal((await request("analyses/" + id, { user: other })).status, 404);
});
