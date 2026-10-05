import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
process.env.DEV_DATABASE_PATH = "memory://";
process.env.NODE_ENV = "test";
const { query, db } = await import("../packages/backend/store.mjs");
const { bootstrapAdmin } =
  await import("../packages/backend/admin-bootstrap.mjs");
after(async () => {
  await (await db()).close();
});
test("first-admin bootstrap grants access only to an existing active account and cannot overwrite an admin", async () => {
  await assert.rejects(bootstrapAdmin(randomUUID()), /active_user_required/);
  const id = randomUUID();
  await query("INSERT INTO users(id,email) VALUES($1,$2)", [
    id,
    "bootstrap@example.com",
  ]);
  await query(
    "INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,'test-session',now()+interval '1 day')",
    [id],
  );
  await bootstrapAdmin(id);
  assert.equal(
    (await query("SELECT role FROM users WHERE id=$1", [id])).rows[0].role,
    "admin",
  );
  assert.equal(
    (await query("SELECT 1 FROM sessions WHERE user_id=$1", [id])).rows.length,
    0,
  );
  await assert.rejects(bootstrapAdmin(id), /admin_already_exists/);
  assert.equal(
    (await query("SELECT 1 FROM audit_logs WHERE action='admin.bootstrap'"))
      .rows.length,
    1,
  );
});
