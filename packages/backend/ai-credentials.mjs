import { query } from "./store.mjs";
import { rootKey } from "./auth.mjs";
import { decryptKey } from "../security/key-vault.mjs";
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
