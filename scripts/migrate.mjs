import { Pool } from "pg";
import { readFile } from "node:fs/promises";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  options: "-c timezone=UTC",
});
const client = await pool.connect();
try {
  await client.query("SELECT pg_advisory_lock(174924)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY,applied_at timestamptz DEFAULT now())",
  );
  for (const file of [
    "001_initial.sql",
    "002_application.sql",
    "003_wallet_auth.sql",
    "004_functional_fixes.sql",
    "005_admin.sql",
    "006_paper_trading.sql",
    "007_mobile_login.sql",
    "008_paper_leverage.sql",
  ]) {
    if (
      (
        await client.query("SELECT 1 FROM schema_migrations WHERE version=$1", [
          file,
        ])
      ).rows.length
    )
      continue;
    const sql = (
      await readFile(new URL("../db/" + file, import.meta.url), "utf8")
    )
      .replace(/^BEGIN;\s*$/m, "")
      .replace(/^COMMIT;\s*$/m, "");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(version) VALUES($1)", [
        file,
      ]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
    console.log(`Applied ${file}`);
  }
} finally {
  await client.query("SELECT pg_advisory_unlock(174924)");
  client.release();
  await pool.end();
}
