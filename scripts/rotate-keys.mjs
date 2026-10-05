import { query, transaction, db } from "../packages/backend/store.mjs";
import { encryptKey, decryptKey } from "../packages/security/key-vault.mjs";
const old = Buffer.from(process.env.OLD_BYOK_ENCRYPTION_KEY || "", "base64"),
  next = Buffer.from(process.env.BYOK_ENCRYPTION_KEY || "", "base64"),
  keyId = process.env.BYOK_KEY_ID;
if (
  old.length !== 32 ||
  next.length !== 32 ||
  !keyId ||
  !process.env.DATABASE_URL
)
  throw new Error("PostgreSQL, old/new 32-byte keys and new key ID required");
await transaction(async (tx) => {
  const rows = (await tx.query("SELECT * FROM credentials FOR UPDATE")).rows;
  for (const c of rows) {
    const secret = decryptKey(
        {
          version: c.envelope_version,
          keyId: c.key_id,
          ciphertext: Buffer.from(c.ciphertext).toString("base64"),
          nonce: Buffer.from(c.nonce).toString("base64"),
          tag: Buffer.from(c.tag).toString("base64"),
        },
        old,
        { userId: c.user_id, provider: c.provider },
      ),
      e = encryptKey(secret, next, {
        userId: c.user_id,
        provider: c.provider,
        keyId,
      });
    await tx.query(
      "UPDATE credentials SET key_id=$1,ciphertext=$2,nonce=$3,tag=$4 WHERE id=$5",
      [
        keyId,
        Buffer.from(e.ciphertext, "base64"),
        Buffer.from(e.nonce, "base64"),
        Buffer.from(e.tag, "base64"),
        c.id,
      ],
    );
  }
  for (const u of (
    await tx.query(
      "SELECT id,totp_envelope FROM users WHERE totp_envelope IS NOT NULL FOR UPDATE",
    )
  ).rows) {
    const secret = decryptKey(u.totp_envelope, old, {
        userId: u.id,
        provider: "totp",
      }),
      e = encryptKey(secret, next, { userId: u.id, provider: "totp", keyId });
    await tx.query("UPDATE users SET totp_envelope=$1 WHERE id=$2", [
      JSON.stringify(e),
      u.id,
    ]);
  }
  for (const agent of (
    await tx.query(
      "SELECT id,provider,key_envelope FROM platform_agents WHERE key_envelope IS NOT NULL FOR UPDATE",
    )
  ).rows) {
    const secret = decryptKey(agent.key_envelope, old, {
      userId: agent.id,
      provider: "platform:" + agent.provider,
    });
    const envelope = encryptKey(secret, next, {
      userId: agent.id,
      provider: "platform:" + agent.provider,
      keyId,
    });
    await tx.query("UPDATE platform_agents SET key_envelope=$1 WHERE id=$2", [
      JSON.stringify(envelope),
      agent.id,
    ]);
  }
  console.log(
    `Rotated ${rows.length} credential envelopes; TOTP and platform-agent envelopes rotated in the same transaction.`,
  );
});
await (await db()).end();
