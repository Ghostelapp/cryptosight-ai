import { randomBytes, createHash } from "node:crypto";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { query, transaction } from "./store.mjs";
import { createSession, cookies, hash } from "./auth.mjs";
const issuer = "https://accounts.google.com",
  jwks = createRemoteJWKSet(
    new URL("https://www.googleapis.com/oauth2/v3/certs"),
  );
const options = () =>
  `Path=/; HttpOnly; SameSite=Lax; Max-Age=600${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
export async function oauthStart(url) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
    return Response.json({ code: "oauth_not_configured" }, { status: 503 });
  const state = randomBytes(24).toString("hex"),
    verifier = randomBytes(32).toString("base64url"),
    nonce = randomBytes(24).toString("hex");
  await query(
    "INSERT INTO api_rate_limits(bucket,count,expires_at) VALUES($1,1,now()+interval '10 minutes')",
    [`oauth:${hash(state)}:${verifier}:${nonce}`],
  );
  const target = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  target.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${process.env.APP_ORIGIN}/api/v1/auth/oauth/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return new Response(null, {
    status: 302,
    headers: {
      location: target.href,
      "set-cookie": `oauth_state=${state}; ${options()}`,
    },
  });
}
export async function oauthCallback(req) {
  const url = new URL(req.url),
    state = url.searchParams.get("state"),
    code = url.searchParams.get("code");
  if (!state || cookies(req).oauth_state !== state || !code)
    throw new Error("invalid_token");
  const rows = (
    await query(
      "DELETE FROM api_rate_limits WHERE bucket LIKE $1 AND expires_at>now() RETURNING bucket",
      [`oauth:${hash(state)}:%`],
    )
  ).rows;
  if (!rows.length) throw new Error("invalid_token");
  const [, , verifier, nonce] = rows[0].bucket.split(":");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: `${process.env.APP_ORIGIN}/api/v1/auth/oauth/callback`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error("invalid_token");
  const tokens = await r.json(),
    { payload } = await jwtVerify(tokens.id_token, jwks, {
      issuer: [issuer, "accounts.google.com"],
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  if (payload.nonce !== nonce || !payload.email_verified || !payload.email)
    throw new Error("invalid_token");
  const user = await transaction(async (tx) => {
    const account = (
      await tx.query(
        "SELECT u.* FROM auth_accounts a JOIN users u ON u.id=a.user_id WHERE a.provider='google' AND a.provider_subject=$1",
        [payload.sub],
      )
    ).rows[0];
    if (account) return account;
    // Prevent automatic linking of an OAuth identity to an existing password account.
    if (
      (
        await tx.query("SELECT 1 FROM users WHERE email=$1", [
          String(payload.email).toLowerCase(),
        ])
      ).rows.length
    )
      throw new Error("oauth_account_link_required");
    const u = (
      await tx.query(
        "INSERT INTO users(email,email_verified) VALUES($1,true) RETURNING *",
        [String(payload.email).toLowerCase()],
      )
    ).rows[0];
    await tx.query(
      "INSERT INTO auth_accounts(user_id,provider,provider_subject) VALUES($1,'google',$2)",
      [u.id, payload.sub],
    );
    await tx.query(
      "INSERT INTO paper_accounts(user_id,balance) VALUES($1,10000)",
      [u.id],
    );
    return u;
  });
  return finishOAuthSignIn(user);
}
export const oauthMfaCookie =
  process.env.NODE_ENV === "production"
    ? "__Host-cryptosight-oauth-mfa"
    : "cryptosight-oauth-mfa";
export async function finishOAuthSignIn(user) {
  if (user.totp_envelope) {
    const token = randomBytes(32).toString("hex");
    await query(
      "INSERT INTO auth_tokens(user_id,kind,token_hash,expires_at) VALUES($1,'oauth_mfa',$2,now()+interval '5 minutes')",
      [user.id, hash(token)],
    );
    return new Response(null, {
      status: 302,
      headers: {
        location: process.env.APP_ORIGIN + "/?oauthMfa=1",
        "set-cookie": `${oauthMfaCookie}=${token}; ${options()}`,
      },
    });
  }
  return new Response(null, {
    status: 302,
    headers: {
      location: process.env.APP_ORIGIN,
      "set-cookie": await createSession(user.id),
    },
  });
}
export async function verifyOAuthTotp(req, code) {
  const token = cookies(req)[oauthMfaCookie] || "";
  const { checkTotp } = await import("./auth.mjs");
  const row = (
    await query(
      "SELECT u.* FROM auth_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=$1 AND t.kind='oauth_mfa' AND t.expires_at>now()",
      [hash(token)],
    )
  ).rows[0];
  if (!row || !row.totp_envelope || !(await checkTotp(row, code)))
    throw new Error("invalid_totp");
  const claimed = (
    await query(
      "DELETE FROM auth_tokens WHERE token_hash=$1 AND kind='oauth_mfa' AND expires_at>now() RETURNING user_id",
      [hash(token)],
    )
  ).rows[0];
  if (!claimed) throw new Error("invalid_token");
  return { cookie: await createSession(row.id) };
}
