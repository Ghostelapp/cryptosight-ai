import { db } from "../packages/backend/store.mjs";
import { bootstrapAdmin } from "../packages/backend/admin-bootstrap.mjs";
try {
  process.loadEnvFile(".env");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const id = process.argv[2];
if (!id)
  throw new Error("Usage: npm run admin:bootstrap -- EXISTING_USER_UUID");
try {
  await bootstrapAdmin(id);
  console.log("First administrator configured. Sign in again.");
} finally {
  const client = await db();
  if (client.end) await client.end();
  else await client.close();
}
