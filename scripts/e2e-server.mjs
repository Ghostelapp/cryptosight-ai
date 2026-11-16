// Isolated browser-test fixture, never a production bootstrap path.
import { mkdtemp, mkdir, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
if (process.env.NODE_ENV === "production")
  throw new Error("Test server cannot run in production");
if (process.env.DATABASE_URL)
  throw new Error("Test fixture requires an isolated local database");
await mkdir(".runtime", { recursive: true });
const fixtureRoot = resolve(await mkdtemp(".runtime/e2e-"));
// A stale Turbopack dev cache can serve HTML with missing client chunks after
// switching between production and browser checks. Preserve it outside Next's
// output before starting this isolated test server.
const workspace = resolve(process.cwd()),
  devCache = resolve(workspace, "apps/web/.next/dev");
if (
  !devCache.startsWith(workspace + (process.platform === "win32" ? "\\" : "/"))
)
  throw new Error("Invalid test cache path");
try {
  await rename(devCache, resolve(fixtureRoot, "previous-next-dev"));
} catch (error) {
  if (error.code !== "ENOENT")
    throw new Error("Stop the local Next.js dev server before browser tests", {
      cause: error,
    });
}
process.env.NODE_ENV = "test";
process.env.DEV_DATABASE_PATH = resolve(fixtureRoot, "database");
process.env.PROJECT_ROOT = process.cwd();
process.env.BYOK_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.SESSION_SECRET = randomBytes(32).toString("hex");
const { query, db } = await import("../packages/backend/store.mjs");
const { passwordHash } = await import("../packages/backend/auth.mjs");
const { bootstrapAdmin } =
  await import("../packages/backend/admin-bootstrap.mjs");
const row = (
  await query(
    "INSERT INTO users(email,password_hash,email_verified) VALUES('admin-e2e@example.com',$1,true) RETURNING id",
    [await passwordHash("isolated-e2e-password-123")],
  )
).rows[0];
await query(
  "INSERT INTO consents(user_id,version,locale) VALUES($1,'v1','en')",
  [row.id],
);
await bootstrapAdmin(row.id);
await (await db()).close();
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "apps/web",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ],
  { stdio: "inherit", env: { ...process.env, NODE_ENV: "development" } },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code || 0));
