import {
  randomBytes,
  randomUUID,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import { query, transaction } from "./store.mjs";
import { hash, rateLimit, checkTotp } from "./auth.mjs";
import { mobileRedirectUri } from "../mobile/protocol.mjs";

const uuid = z.string().uuid();
const proof = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const state = z.string().regex(/^[a-f0-9]{64}$/);
const ip = (req) => req.headers.get("x-real-ip") || "local";
const equal = (a, b) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
function usable(row) {
  if (!row || new Date(row.expires_at).getTime() <= Date.now())
    throw new Error("mobile_request_expired");
}

export async function mobileStart(req, input) {
  const b = z.object({ codeChallenge: proof, state }).strict().parse(input);
  await rateLimit("mobile-start:" + ip(req), 30, 600);
  await query("DELETE FROM mobile_login_requests WHERE expires_at<now()");
  const id = randomUUID();
  const row = (
    await query(
      "INSERT INTO mobile_login_requests(id,code_challenge,state) VALUES($1,$2,$3) RETURNING expires_at",
      [id, b.codeChallenge, b.state],
    )
  ).rows[0];
  const origin = process.env.APP_ORIGIN || "http://localhost:3000";
  return {
    requestId: id,
    authorizeUrl: new URL("/mobile/connect?request=" + id, origin).href,
    redirectUri: mobileRedirectUri,
    expiresAt: row.expires_at,
  };
}

export async function mobileRequest(req, id) {
  uuid.parse(id);
  await rateLimit("mobile-request:" + ip(req), 120, 600);
  const row = (
    await query(
      "SELECT expires_at,authorized_at FROM mobile_login_requests WHERE id=$1",
      [id],
    )
  ).rows[0];
  usable(row);
  if (row.authorized_at) throw new Error("mobile_request_used");
  return {
    requestId: id,
    expiresAt: row.expires_at,
    application: "CryptoSight AI",
  };
}

export async function mobileAuthorize(user, input) {
  const b = z
    .object({ requestId: uuid, totp: z.string().max(10).optional() })
    .strict()
    .parse(input);
  await rateLimit("mobile-authorize:" + user.id, 10, 600);
  const account = (
    await query(
      "SELECT * FROM users WHERE id=$1 AND deleted_at IS NULL AND suspended=false",
      [user.id],
    )
  ).rows[0];
  if (!account) throw new Error("authentication_required");
  if (!(await checkTotp(account, b.totp))) throw new Error("invalid_totp");
  if (
    !(await query("SELECT 1 FROM consents WHERE user_id=$1 LIMIT 1", [user.id]))
      .rows.length
  )
    throw new Error("consent_required");
  return transaction(async (tx) => {
    const row = (
      await tx.query(
        "SELECT * FROM mobile_login_requests WHERE id=$1 FOR UPDATE",
        [b.requestId],
      )
    ).rows[0];
    usable(row);
    if (row.authorized_at) throw new Error("mobile_request_used");
    const code = randomBytes(32).toString("hex");
    await tx.query(
      "UPDATE mobile_login_requests SET user_id=$1,code_hash=$2,authorized_at=now() WHERE id=$3",
      [user.id, hash(code), b.requestId],
    );
    await tx.query(
      "INSERT INTO audit_logs(user_id,action,resource_id) VALUES($1,'auth.mobile_authorize',$2)",
      [user.id, b.requestId],
    );
    const target = new URL(mobileRedirectUri);
    target.searchParams.set("code", code);
    target.searchParams.set("requestId", b.requestId);
    target.searchParams.set("state", row.state);
    return { redirectUrl: target.href };
  });
}

export async function mobileExchange(req, input) {
  const b = z
    .object({ requestId: uuid, code: state, codeVerifier: proof })
    .strict()
    .parse(input);
  await rateLimit("mobile-exchange:" + ip(req), 30, 600);
  const challenge = createHash("sha256")
    .update(b.codeVerifier)
    .digest("base64url");
  return transaction(async (tx) => {
    const row = (
      await tx.query(
        "SELECT * FROM mobile_login_requests WHERE id=$1 FOR UPDATE",
        [b.requestId],
      )
    ).rows[0];
    usable(row);
    if (
      !row.authorized_at ||
      !row.code_hash ||
      !equal(hash(b.code), row.code_hash) ||
      !equal(challenge, row.code_challenge)
    )
      throw new Error("mobile_login_failed");
    const account = (
      await tx.query(
        "SELECT id FROM users WHERE id=$1 AND deleted_at IS NULL AND suspended=false",
        [row.user_id],
      )
    ).rows[0];
    if (!account) throw new Error("authentication_required");
    const token = "m_" + randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    await tx.query(
      "INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,$3)",
      [account.id, hash(token), expiresAt],
    );
    await tx.query("DELETE FROM mobile_login_requests WHERE id=$1", [row.id]);
    await tx.query(
      "INSERT INTO audit_logs(user_id,action) VALUES($1,'auth.mobile_login')",
      [account.id],
    );
    return { accessToken: token, tokenType: "Bearer", expiresAt };
  });
}
