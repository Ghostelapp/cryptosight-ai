import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
function keyCheck(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32)
    throw new Error("Encryption key must be 32 bytes");
}
export function encryptKey(secret, key, { userId, provider, keyId }) {
  keyCheck(key);
  const nonce = randomBytes(12);
  const aad = Buffer.from(JSON.stringify([userId, provider, keyId]));
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aad);
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  return {
    version: 1,
    keyId,
    nonce: nonce.toString("base64"),
    ciphertext: encrypted.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}
export function decryptKey(record, key, { userId, provider }) {
  keyCheck(key);
  if (record.version !== 1) throw new Error("Unsupported envelope version");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(record.nonce, "base64"),
  );
  decipher.setAAD(
    Buffer.from(JSON.stringify([userId, provider, record.keyId])),
  );
  decipher.setAuthTag(Buffer.from(record.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
