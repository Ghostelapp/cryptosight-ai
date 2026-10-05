import { Wallet } from "ethers";
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { mkdtemp, mkdir } from "node:fs/promises";
await mkdir(".runtime", { recursive: true });
const smokePath = resolve(await mkdtemp(".runtime/smoke-"), "database");
const env = {
  ...process.env,
  NODE_ENV: "production",
  SESSION_SECRET: randomBytes(32).toString("hex"),
  BYOK_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  ALLOW_LOCAL_DB: "true",
  AUTO_MIGRATE: "true",
  DEV_DATABASE_PATH: smokePath,
  PROJECT_ROOT: process.cwd(),
  APP_ORIGIN: "http://127.0.0.1:3190",
  PORT: "3190",
  HOSTNAME: "127.0.0.1",
};
// Seed an isolated local test administrator before starting the server.
Object.assign(process.env, env);
const { query, db } = await import("../packages/backend/store.mjs");
const { passwordHash } = await import("../packages/backend/auth.mjs");
const { bootstrapAdmin } =
  await import("../packages/backend/admin-bootstrap.mjs");
const adminPassword = "isolated-smoke-password-123";
const admin = (
  await query(
    "INSERT INTO users(email,password_hash,email_verified) VALUES('smoke-admin@example.com',$1,true) RETURNING id",
    [await passwordHash(adminPassword)],
  )
).rows[0];
await query(
  "INSERT INTO consents(user_id,version,locale) VALUES($1,'v1','en')",
  [admin.id],
);
await bootstrapAdmin(admin.id);
await (await db()).close();
const child = spawn(process.execPath, ["scripts/start.mjs"], {
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
child.stdout.on("data", (d) => (logs += d));
child.stderr.on("data", (d) => (logs += d));
try {
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await wait(500);
    try {
      const r = await fetch("http://127.0.0.1:3190/");
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
  }
  if (!ready) throw new Error("server_not_reachable: " + logs.slice(-2000));
  const page = await fetch("http://127.0.0.1:3190/");
  const csp = page.headers.get("content-security-policy") || "";
  if (!csp.includes("'strict-dynamic'") || csp.includes("'unsafe-eval'"))
    throw new Error("production_csp_failed");
  const html = await page.text();
  if (!/nonce="[^"]+"/.test(html)) throw new Error("script_nonce_missing");
  const health = await fetch("http://127.0.0.1:3190/api/v1/health");
  console.log("health", health.status, await health.text());
  if (!health.ok) throw new Error("health_failed: " + logs.slice(-3000));
  const privateResponse = await fetch("http://127.0.0.1:3190/api/v1/journal");
  console.log("anonymous_journal", privateResponse.status);
  if (privateResponse.status !== 401) throw new Error("auth_guard_failed");
  const wallet = Wallet.createRandom(),
    origin = env.APP_ORIGIN;
  const challengeResponse = await fetch(
    origin + "/api/v1/auth/wallet/challenge",
    {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({
        address: wallet.address,
        chainId: 8453,
        locale: "pl",
      }),
    },
  );
  const challenge = await challengeResponse.json();
  if (!challengeResponse.ok)
    throw new Error("wallet_challenge_failed:" + JSON.stringify(challenge));
  const browserCookie = challengeResponse.headers
    .get("set-cookie")
    .split(";")[0];
  const proof = {
    challengeId: challenge.challengeId,
    message: challenge.message,
    signature: await wallet.signMessage(challenge.message),
    consent: true,
  };
  const verified = await fetch(origin + "/api/v1/auth/wallet/verify", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      cookie: browserCookie,
    },
    body: JSON.stringify(proof),
  });
  const verifiedBody = await verified.json();
  if (!verified.ok || !verifiedBody.authenticated)
    throw new Error("wallet_verify_failed:" + JSON.stringify(verifiedBody));
  const sessionCookie = verified.headers.get("set-cookie").split(";")[0];
  const me = await (
    await fetch(origin + "/api/v1/auth/me", {
      headers: { cookie: sessionCookie },
    })
  ).json();
  if (
    me.user.wallet_address !== wallet.address.toLowerCase() ||
    me.user.email !== null
  )
    throw new Error("wallet_profile_failed");
  const paper = await fetch(origin + "/api/v1/paper/account", {
    headers: { cookie: sessionCookie },
  });
  if (!paper.ok) throw new Error("wallet_private_flow_failed");
  console.log(
    "production_wallet_registration_and_private_account",
    verified.status,
    paper.status,
  );
  const denied = await fetch(origin + "/api/v1/admin/overview", {
    headers: { cookie: sessionCookie },
  });
  if (denied.status !== 403) throw new Error("admin_member_guard_failed");
  const login = await fetch(origin + "/api/v1/auth/login", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({
      email: "smoke-admin@example.com",
      password: adminPassword,
    }),
  });
  if (!login.ok) throw new Error("admin_login_failed");
  const adminCookie = login.headers.get("set-cookie").split(";")[0];
  const adminMe = await (
    await fetch(origin + "/api/v1/auth/me", {
      headers: { cookie: adminCookie },
    })
  ).json();
  if (adminMe.user.role !== "admin") throw new Error("admin_role_failed");
  const secret = "synthetic-smoke-platform-key";
  const saved = await fetch(origin + "/api/v1/admin/agents", {
    method: "POST",
    headers: {
      origin,
      cookie: adminCookie,
      "x-csrf-token": adminMe.csrfToken,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: "Smoke managed analyst",
      provider: "openai",
      model: "test-model",
      apiKey: secret,
      enabled: true,
    }),
  });
  const savedBody = await saved.json();
  if (
    !saved.ok ||
    !savedBody.has_key ||
    JSON.stringify(savedBody).includes(secret)
  )
    throw new Error("admin_agent_secret_failed");
  const available = await (
    await fetch(origin + "/api/v1/agents", {
      headers: { cookie: sessionCookie },
    })
  ).json();
  if (
    !available.some((a) => a.id === savedBody.id) ||
    JSON.stringify(available).includes(secret)
  )
    throw new Error("managed_agent_catalog_failed");
  console.log(
    "production_admin_guard_agent_storage_and_catalog",
    denied.status,
    saved.status,
  );
} finally {
  child.kill("SIGTERM");
}
