import { SiweMessage, generateNonce } from "siwe";
import { getAddress } from "ethers";
import { z } from "zod";
import { randomBytes, randomUUID } from "node:crypto";
import { query, transaction, audit } from "./store.mjs";
import {
  cookies,
  hash,
  checkTotp,
  createSession,
  clearSession,
} from "./auth.mjs";
import { messages } from "./localization.mjs";
export const walletCookie =
  process.env.NODE_ENV === "production"
    ? "__Host-cryptosight-wallet"
    : "cryptosight-wallet";
export function walletChains() {
  return (
    process.env.WALLET_CHAIN_IDS ||
    "1,8453,137,42161,10,43114,56,84532,11155111"
  )
    .split(",")
    .map(Number)
    .filter((n) => Number.isSafeInteger(n) && n > 0);
}
const challengeSchema = z
  .object({
    address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    chainId: z.number().int().positive(),
    purpose: z.enum(["auth", "link", "unlink"]).default("auth"),
    locale: z.enum(["en", "pl", "de"]).default("en"),
  })
  .strict();
const proofSchema = z
  .object({
    challengeId: z.string().uuid(),
    message: z.string().min(1).max(3000),
    signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
    consent: z.boolean().optional(),
    totp: z.string().max(10).optional(),
  })
  .strict();
export async function walletChallenge(req, body, user) {
  const b = challengeSchema.parse(body);
  if (!walletChains().includes(b.chainId))
    throw new Error("wallet_chain_unsupported");
  if (b.purpose !== "auth" && !user) throw new Error("authentication_required");
  if (b.purpose === "auth" && user) throw new Error("wallet_use_link");
  let checkedAddress;
  try {
    checkedAddress = getAddress(b.address);
  } catch {
    throw new Error("wallet_address_invalid");
  }
  const address = checkedAddress,
    id = randomUUID(),
    nonce = generateNonce(),
    now = new Date(),
    expires = new Date(+now + 300000);
  const origin = new URL(process.env.APP_ORIGIN || "http://localhost:3000");
  const binding = cookies(req)[walletCookie];
  const token = /^[a-f0-9]{64}$/.test(binding || "")
    ? binding
    : randomBytes(32).toString("hex");
  const message = new SiweMessage({
    domain: origin.host,
    address,
    statement: messages(b.locale)[
      {
        auth: "walletSignAuth",
        link: "walletSignLink",
        unlink: "walletSignUnlink",
      }[b.purpose]
    ],
    uri: origin.origin,
    version: "1",
    chainId: b.chainId,
    nonce,
    issuedAt: now.toISOString(),
    expirationTime: expires.toISOString(),
    requestId: id,
  }).prepareMessage();
  await query(
    "INSERT INTO wallet_challenges(id,user_id,address,chain_id,purpose,locale,nonce_hash,browser_hash,message,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [
      id,
      user?.id || null,
      address.toLowerCase(),
      b.chainId,
      b.purpose,
      b.locale,
      hash(nonce),
      hash(token),
      message,
      expires,
    ],
  );
  return {
    body: {
      challengeId: id,
      message,
      expiresAt: expires.toISOString(),
      chainId: b.chainId,
      address,
    },
    cookie: `${walletCookie}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  };
}
export async function walletVerify(req, body, user) {
  const b = proofSchema.parse(body),
    token = cookies(req)[walletCookie] || "";
  const row = (
    await query(
      "SELECT * FROM wallet_challenges WHERE id=$1 AND expires_at>now()",
      [b.challengeId],
    )
  ).rows[0];
  if (
    !row ||
    !token ||
    hash(token) !== row.browser_hash ||
    b.message !== row.message
  )
    throw new Error("wallet_challenge_invalid");
  if (!walletChains().includes(+row.chain_id))
    throw new Error("wallet_chain_unsupported");
  if (row.purpose !== "auth" && (!user || user.id !== row.user_id))
    throw new Error("authentication_required");
  if (row.purpose === "auth" && user) throw new Error("wallet_use_link");
  const siwe = new SiweMessage(b.message),
    origin = new URL(process.env.APP_ORIGIN || "http://localhost:3000");
  if (
    siwe.uri !== origin.origin ||
    siwe.address.toLowerCase() !== row.address ||
    hash(siwe.nonce) !== row.nonce_hash ||
    siwe.requestId !== row.id ||
    siwe.chainId !== +row.chain_id
  )
    throw new Error("wallet_challenge_invalid");
  let verified;
  try {
    verified = await siwe.verify(
      {
        signature: b.signature,
        domain: origin.host,
        nonce: siwe.nonce,
        time: new Date().toISOString(),
      },
      { suppressExceptions: true },
    );
  } catch {
    throw new Error("wallet_signature_invalid");
  }
  if (!verified.success) throw new Error("wallet_signature_invalid");
  // Signature checks precede nonce consumption. Lock both the challenge and the identity transactionally.
  const result = await transaction(async (tx) => {
    const claimed = (
      await tx.query(
        "SELECT * FROM wallet_challenges WHERE id=$1 AND expires_at>now() FOR UPDATE",
        [row.id],
      )
    ).rows[0];
    if (!claimed) throw new Error("wallet_challenge_invalid");
    await tx.query("DELETE FROM wallet_challenges WHERE id=$1", [row.id]);
    // Serializes first login/link for one address; PGlite's development transactions already serialize.
    if (process.env.DATABASE_URL)
      await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        row.address,
      ]);
    const existing = (
      await tx.query(
        "SELECT w.*,u.totp_envelope,u.password_hash,u.email_verified,u.email FROM wallet_identities w JOIN users u ON u.id=w.user_id WHERE address=$1 FOR UPDATE",
        [row.address],
      )
    ).rows[0];
    if (row.purpose === "auth") {
      let uid = existing?.user_id,
        created = false;
      if (
        existing &&
        !(await checkTotp(
          { id: uid, totp_envelope: existing.totp_envelope },
          b.totp,
        ))
      )
        throw new Error("wallet_totp_required");
      if (!uid) {
        if (b.consent !== true) throw new Error("consent_required");
        uid = randomUUID();
        created = true;
        await tx.query(
          "INSERT INTO users(id,email,locale,email_verified) VALUES($1,NULL,$2,false)",
          [uid, row.locale],
        );
        await tx.query(
          "INSERT INTO wallet_identities(user_id,address,chain_id) VALUES($1,$2,$3)",
          [uid, row.address, row.chain_id],
        );
        await tx.query(
          "INSERT INTO paper_accounts(user_id,balance) VALUES($1,10000)",
          [uid],
        );
        await tx.query(
          "INSERT INTO consents(user_id,version,locale) VALUES($1,'2026-10-v1',$2)",
          [uid, row.locale],
        );
      }
      await tx.query(
        "UPDATE wallet_identities SET last_used_at=now(),chain_id=$2 WHERE address=$1",
        [row.address, row.chain_id],
      );
      return { userId: uid, created, action: "auth" };
    }
    const account = (
      await tx.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [user.id])
    ).rows[0];
    if (!account || !(await checkTotp(account, b.totp)))
      throw new Error("wallet_totp_required");
    if (row.purpose === "link") {
      if (existing && existing.user_id !== user.id)
        throw new Error("wallet_already_linked");
      if (!existing)
        await tx.query(
          "INSERT INTO wallet_identities(user_id,address,chain_id) VALUES($1,$2,$3)",
          [user.id, row.address, row.chain_id],
        );
      return { userId: user.id, action: "link" };
    }
    if (!existing || existing.user_id !== user.id) throw new Error("not_found");
    const alternatives = (
      await tx.query(
        "SELECT (SELECT COUNT(*) FROM wallet_identities WHERE user_id=$1 AND address<>$2)+(SELECT COUNT(*) FROM auth_accounts WHERE user_id=$1) AS count",
        [user.id, row.address],
      )
    ).rows[0];
    if (
      !(account.password_hash && account.email_verified) &&
      +alternatives.count === 0
    )
      throw new Error("wallet_last_login_method");
    await tx.query(
      "DELETE FROM wallet_identities WHERE user_id=$1 AND address=$2",
      [user.id, row.address],
    );
    await tx.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
    return { userId: user.id, action: "unlink" };
  });
  await audit(result.userId, "wallet." + result.action);
  return {
    body: {
      authenticated: result.action === "auth",
      registered: result.created || false,
      action: result.action,
      address: row.address,
    },
    cookie:
      result.action === "auth"
        ? await createSession(result.userId)
        : result.action === "unlink"
          ? clearSession()
          : null,
  };
}
