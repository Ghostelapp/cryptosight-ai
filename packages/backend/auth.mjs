import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { query, audit } from "./store.mjs";
import { encryptKey, decryptKey } from "../security/key-vault.mjs";
import { TOTP } from "@otplib/totp";
import { NodeCryptoPlugin } from "@otplib/plugin-crypto-node";
import { ScureBase32Plugin } from "@otplib/plugin-base32-scure";
import { mobileTokenPattern } from "../mobile/protocol.mjs";
const scrypt = promisify(scryptCb);
export const hash = (t) => createHash("sha256").update(t).digest("hex");
export const cookieName =
  process.env.NODE_ENV === "production" ? "__Host-cryptosight" : "cryptosight";
export function rootKey() {
  const k = Buffer.from(process.env.BYOK_ENCRYPTION_KEY || "", "base64");
  if (k.length !== 32) throw new Error("encryption_not_configured");
  return k;
}
export async function passwordHash(password) {
  const salt = randomBytes(16).toString("hex"),
    result = await scrypt(password, salt, 64, {
      N: 32768,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });
  return `scrypt:${salt}:${result.toString("hex")}`;
}
export async function passwordValid(password, stored) {
  if (!stored) return false;
  const [, salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const actual = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  const expected = Buffer.from(hex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function cookies(req) {
  return Object.fromEntries(
    (req.headers.get("cookie") || "")
      .split(";")
      .map((p) => p.trim().split("=")),
  );
}
export function mobileToken(req) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return mobileTokenPattern.test(token) ? token : null;
}
export function sessionToken(req) {
  if (req.headers.has("authorization")) return mobileToken(req);
  const token = cookies(req)[cookieName] || "";
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export async function session(req) {
  const token = sessionToken(req);
  if (!token) return null;
  const r = await query(
    "SELECT u.id,u.email,u.locale,u.timezone,u.tier,u.email_verified,u.settings,u.role,u.suspended,(SELECT address FROM wallet_identities WHERE user_id=u.id ORDER BY created_at LIMIT 1) AS wallet_address,(u.password_hash IS NOT NULL) AS has_password,(u.totp_envelope IS NOT NULL) AS two_factor FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.deleted_at IS NULL AND u.suspended=false",
    [hash(token)],
  );
  return r.rows[0] || null;
}
export async function createSession(userId) {
  const active = await query(
    "SELECT id FROM users WHERE id=$1 AND deleted_at IS NULL AND suspended=false",
    [userId],
  );
  if (!active.rows.length) throw new Error("account_suspended");
  const token = randomBytes(32).toString("hex");
  await query(
    "INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '7 days')",
    [userId, hash(token)],
  );
  await audit(userId, "auth.login");
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export function clearSession() {
  return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export function verifyOrigin(req) {
  const origin = req.headers.get("origin");
  const trusted = process.env.APP_ORIGIN || "http://localhost:3000";
  if (!origin || origin !== trusted) throw new Error("csrf_failed");
}
export async function rateLimit(bucket, max = 60, seconds = 60) {
  const r = await query(
    `INSERT INTO api_rate_limits(bucket,count,expires_at) VALUES($1,1,now()+($2||' seconds')::interval) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN api_rate_limits.expires_at<now() THEN 1 ELSE api_rate_limits.count+1 END,expires_at=CASE WHEN api_rate_limits.expires_at<now() THEN now()+($2||' seconds')::interval ELSE api_rate_limits.expires_at END RETURNING count`,
    [bucket, String(seconds)],
  );
  if (r.rows[0].count > max) throw new Error("rate_limited");
}
const totp = new TOTP({
  crypto: new NodeCryptoPlugin(),
  base32: new ScureBase32Plugin(),
});
export async function checkTotp(user, code) {
  if (!user.totp_envelope) return true;
  if (!/^\d{6}$/.test(String(code || ""))) return false;
  const secret = decryptKey(user.totp_envelope, rootKey(), {
    userId: user.id,
    provider: "totp",
  });
  return (await totp.verify(String(code || ""), { secret, epochTolerance: 30 }))
    .valid;
}
export function totpBegin(user) {
  const secret = totp.generateSecret();
  return {
    secret,
    uri: totp.toURI({
      secret,
      issuer: "CryptoSight AI",
      label: user.email || user.wallet_address || user.id,
    }),
  };
}
export async function totpEnable(user, secret, code) {
  if (!(await totp.verify(String(code), { secret, epochTolerance: 30 })).valid)
    throw new Error("invalid_totp");
  const envelope = encryptKey(secret, rootKey(), {
    userId: user.id,
    provider: "totp",
    keyId: process.env.BYOK_KEY_ID || "primary",
  });
  await query("UPDATE users SET totp_envelope=$1 WHERE id=$2", [
    JSON.stringify(envelope),
    user.id,
  ]);
}
