import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { readFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
let initialized;
const globalKey = Symbol.for("cryptosight.db");
export async function db() {
  if (globalThis[globalKey]) return globalThis[globalKey];
  if (initialized) return initialized;
  initialized = (async () => {
    let client;
    if (process.env.DATABASE_URL) {
      client = new Pool({
        connectionString: process.env.DATABASE_URL,
        options: "-c timezone=UTC",
        max: 15,
      });
    } else if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_LOCAL_DB !== "true"
    ) {
      throw new Error("database_not_configured");
    } else {
      const localPath =
        process.env.DEV_DATABASE_PATH ||
        resolve(process.cwd(), ".runtime/database");
      if (localPath !== "memory://")
        await mkdir(dirname(localPath), { recursive: true });
      client = new PGlite(localPath === "memory://" ? undefined : localPath);
    }
    if (client instanceof PGlite) await client.exec("SET TIMEZONE='UTC'");
    await client.query("SELECT 1");
    const check = await client.query(
      "SELECT to_regclass('public.users') AS present",
    );
    if (!check.rows[0].present) {
      if (
        process.env.NODE_ENV === "production" &&
        process.env.AUTO_MIGRATE !== "true"
      )
        throw new Error("migrations_required");
      let sql = await readFile(
        resolve(
          process.env.PROJECT_ROOT ||
            (process.cwd().endsWith("/apps/web")
              ? resolve(process.cwd(), "../..")
              : process.cwd()),
          "db/001_initial.sql",
        ),
        "utf8",
      );
      if (client instanceof PGlite)
        sql = sql.replace("CREATE EXTENSION IF NOT EXISTS pgcrypto;", "");
      if (client instanceof PGlite) await client.exec(sql);
      else await client.query(sql);
    }
    if (
      process.env.NODE_ENV !== "production" ||
      process.env.AUTO_MIGRATE === "true"
    ) {
      for (const file of [
        "002_application.sql",
        "003_wallet_auth.sql",
        "004_functional_fixes.sql",
        "005_admin.sql",
      ]) {
        const migration = await readFile(
          resolve(
            process.env.PROJECT_ROOT ||
              (process.cwd().endsWith("/apps/web")
                ? resolve(process.cwd(), "../..")
                : process.cwd()),
            "db",
            file,
          ),
          "utf8",
        );
        if (client instanceof PGlite) await client.exec(migration);
        else await client.query(migration);
      }
    }
    globalThis[globalKey] = client;
    return client;
  })();
  try {
    return await initialized;
  } catch (e) {
    initialized = null;
    throw e;
  }
}
export async function query(sql, args = []) {
  return (await db()).query(sql, args);
}
// Serialize local PGlite transactions; PostgreSQL uses a dedicated pooled connection.
let serial = Promise.resolve();
export async function transaction(fn) {
  const pool = await db();
  if (pool instanceof PGlite) {
    const run = serial.then(() => pool.transaction((tx) => fn(tx)));
    serial = run.catch(() => {});
    return run;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function audit(userId, action, resourceId = null) {
  await query(
    "INSERT INTO audit_logs(user_id,action,resource_id) VALUES($1,$2,$3)",
    [userId, action, resourceId],
  );
}
