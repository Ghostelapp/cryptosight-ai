import { transaction } from "./store.mjs";
export async function bootstrapAdmin(id) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id || "",
    )
  )
    throw new Error("Existing user UUID required");
  return transaction(async (tx) => {
    await tx.query("SELECT id FROM platform_settings WHERE id=1 FOR UPDATE");
    if (
      (
        await tx.query(
          "SELECT 1 FROM users WHERE role='admin' AND suspended=false AND deleted_at IS NULL LIMIT 1",
        )
      ).rows.length
    )
      throw new Error("admin_already_exists");
    const row = (
      await tx.query(
        "UPDATE users SET role='admin' WHERE id=$1 AND deleted_at IS NULL AND suspended=false RETURNING id",
        [id],
      )
    ).rows[0];
    if (!row) throw new Error("active_user_required");
    await tx.query("DELETE FROM sessions WHERE user_id=$1", [id]);
    await tx.query(
      "INSERT INTO audit_logs(user_id,action,resource_id) VALUES($1,'admin.bootstrap',$1)",
      [id],
    );
    return row;
  });
}
