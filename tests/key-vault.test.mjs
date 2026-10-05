import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { encryptKey, decryptKey } from "../packages/security/key-vault.mjs";
test("BYOK authenticated encryption and tenant binding", () => {
  const key = randomBytes(32),
    context = { userId: "u1", provider: "openai", keyId: "primary" },
    record = encryptKey("secret", key, context);
  assert.equal(decryptKey(record, key, context), "secret");
  assert.throws(() => decryptKey(record, key, { ...context, userId: "u2" }));
  assert.throws(() => decryptKey(record, randomBytes(32), context));
  const damaged = { ...record, tag: randomBytes(16).toString("base64") };
  assert.throws(() => decryptKey(damaged, key, context));
  assert.notEqual(encryptKey("secret", key, context).nonce, record.nonce);
});
