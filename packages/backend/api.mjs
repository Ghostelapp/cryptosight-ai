import { z } from "zod";
import { adminHandle } from "./admin.mjs";
import {
  platformSettings,
  availableAgents,
  resolveAIConfig,
  platformCredential,
} from "./platform-ai.mjs";
import { walletChallenge, walletVerify, walletChains } from "./wallet-auth.mjs";
import { messages } from "./localization.mjs";
import { routes } from "../contracts/routes.mjs";
import { recordFailure } from "./observability.mjs";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { query, transaction, audit } from "./store.mjs";
import {
  session,
  createSession,
  clearSession,
  cookieName,
  cookies,
  hash,
  passwordHash,
  passwordValid,
  verifyOrigin,
  rateLimit,
  rootKey,
  checkTotp,
  totpBegin,
  totpEnable,
} from "./auth.mjs";
import { encryptKey } from "../security/key-vault.mjs";
import {
  history,
  historyWithFallback,
  tickers,
  depth,
  context,
  derivatives,
  validateInstrument,
} from "../market/providers.mjs";
import { indicators } from "../quant/indicators.mjs";
import { storeCandles } from "./market-storage.mjs";
import {
  positionSize,
  correlation,
  settlePaperPosition,
} from "../quant/research.mjs";
import { snapshot, llm, providers } from "../ai/agent.mjs";
import { queueAnalysis, credential, estimate, withAIBudget } from "./jobs.mjs";
import { cached, redisClient } from "./cache.mjs";
import { email, news } from "./notifications.mjs";
import { oauthStart, oauthCallback, verifyOAuthTotp } from "./oauth.mjs";
import { startEmbeddedWorker } from "./embedded-worker.mjs";
import {
  connectExchange,
  exchangePortfolio,
  exchangeTrades,
} from "./exchange.mjs";
import { paperOverview } from "./portfolio.mjs";
const uuid = z.string().uuid(),
  text = z.string().min(1).max(4000),
  emailSchema = z
    .string()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  pass = z.string().min(12).max(128),
  finite = z.number().finite(),
  positive = finite.positive();
const instrument = z.object({
  venue: z.enum(["binance", "bybit", "okx"]).default("binance"),
  market: z.enum(["spot", "perpetual"]).default("spot"),
  symbol: z
    .string()
    .regex(/^[A-Z0-9]{2,20}USDT$/)
    .default("BTCUSDT"),
  timeframe: z
    .enum([
      "1m",
      "3m",
      "5m",
      "15m",
      "30m",
      "1h",
      "2h",
      "4h",
      "6h",
      "12h",
      "1d",
      "1w",
      "1M",
    ])
    .default("1h"),
});
const json = (v, status = 200, headers = {}) =>
  Response.json(v, {
    status,
    headers: { "cache-control": "no-store", ...headers },
  });
const csrf = (req) =>
  createHmac("sha256", process.env.SESSION_SECRET || "development-only")
    .update(cookies(req)[cookieName] || "anonymous")
    .digest("hex");
const verifyCsrf = (req) => {
  if (req.headers.get("x-csrf-token") !== csrf(req))
    throw new Error("csrf_failed");
};
const take = async (sql, args) => (await query(sql, args)).rows;
export async function handle(req) {
  startEmbeddedWorker();
  let user;
  try {
    const url = new URL(req.url),
      path = url.pathname.split("/api/v1/")[1] || "",
      parts = path.split("/"),
      method = req.method;
    const routePath =
      "/" +
      path.replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        "/{id}",
      );
    const allowed = routes[routePath];
    if (!allowed)
      return json({ code: "not_found", request_id: randomUUID() }, 404);
    if (!allowed.includes(method.toLowerCase()))
      return json(
        { code: "method_not_allowed", request_id: randomUUID() },
        405,
        { allow: allowed.map((m) => m.toUpperCase()).join(", ") },
      );
    if (
      process.env.NODE_ENV === "production" &&
      (process.env.SESSION_SECRET || "").length < 32
    )
      throw new Error("session_not_configured");
    const mutation = !["GET", "HEAD"].includes(method);
    const params = Object.fromEntries(url.searchParams);
    let body = {};
    if (mutation) {
      if (path !== "billing/webhook") {
        verifyOrigin(req);
        if (!req.headers.get("content-type")?.includes("application/json"))
          throw new Error("invalid_content_type");
        const raw = await req.text();
        if (
          Buffer.byteLength(raw, "utf8") >
          (path === "attachments" ? 2800000 : 65536)
        )
          throw new Error("body_too_large");
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error("invalid_json");
        }
      }
    }
    if (path === "health")
      return json({
        status: "ok",
        database: (await query("SELECT 1")).rows.length === 1,
        liveData: "provider-dependent",
      });
    if (path === "auth/oauth/start" && method === "GET") return oauthStart(url);
    if (path === "auth/oauth/callback" && method === "GET")
      return oauthCallback(req);
    if (path === "billing/webhook" && method === "POST") {
      const { default: Stripe } = await import("stripe");
      if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET)
        throw new Error("billing_not_configured");
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      let event;
      try {
        event = stripe.webhooks.constructEvent(
          await req.text(),
          req.headers.get("stripe-signature"),
          process.env.STRIPE_WEBHOOK_SECRET,
        );
      } catch {
        throw new Error("invalid_webhook");
      }
      if (
        [
          "customer.subscription.created",
          "customer.subscription.updated",
          "customer.subscription.deleted",
        ].includes(event.type)
      ) {
        const s = event.data.object,
          u = s.metadata.userId;
        if (u && uuid.safeParse(u).success) {
          await transaction(async (tx) => {
            const inserted = await tx.query(
              "INSERT INTO billing_events(id) VALUES($1) ON CONFLICT DO NOTHING RETURNING id",
              [event.id],
            );
            if (!inserted.rows.length) return;
            const existing = (
              await tx.query(
                "SELECT event_timestamp FROM subscriptions WHERE stripe_subscription_id=$1 FOR UPDATE",
                [s.id],
              )
            ).rows[0];
            if (existing && +existing.event_timestamp > event.created) return;
            await tx.query(
              "INSERT INTO subscriptions(user_id,stripe_customer_id,stripe_subscription_id,status) VALUES($1,$2,$3,$4) ON CONFLICT(stripe_subscription_id) DO UPDATE SET status=EXCLUDED.status",
              [u, s.customer, s.id, s.status],
            );
            await tx.query(
              "UPDATE subscriptions SET event_timestamp=$1 WHERE stripe_subscription_id=$2",
              [event.created, s.id],
            );
            await tx.query("UPDATE users SET tier=$1 WHERE id=$2", [
              ["active", "trialing"].includes(s.status) ? "pro" : "free",
              u,
            ]);
          });
        }
      }
      return json({ received: true });
    }
    // Public market endpoints are shared-data only and separately throttled.
    if (
      [
        "markets",
        "candles",
        "depth",
        "context",
        "news",
        "risk",
        "derivatives",
      ].includes(path)
    ) {
      await rateLimit(
        `public:${req.headers.get("x-real-ip") || "local"}:${path}`,
        120,
        60,
      );
      if (path === "markets")
        return json(
          await cached(`tickers:${params.venue}:${params.market}`, 15, () =>
            tickers(params.venue, params.market),
          ),
        );
      if (path === "candles") {
        const i = instrument.parse(params),
          limit = Math.min(3000, Number(params.limit) || 500);
        return json(
          await cached(
            `candles:${JSON.stringify(i)}:${limit}:${params.from || ""}`,
            5,
            async () => {
              const d = await historyWithFallback(i, {
                limit,
                from: params.from ? +params.from : undefined,
                allowFallback: params.fallback === "true",
                anchorPrice: params.anchorPrice
                  ? +params.anchorPrice
                  : undefined,
              });
              await storeCandles(d);
              return {
                ...d,
                indicators: indicators(d.candles, {
                  period: Math.min(
                    200,
                    Math.max(2, Number(params.period) || 14),
                  ),
                }),
              };
            },
          ),
        );
      }
      if (path === "depth")
        return json(
          await cached(`depth:${JSON.stringify(params)}`, 2, () =>
            depth(instrument.parse(params)),
          ),
        );
      if (path === "derivatives")
        return json(
          await cached("derivatives:" + JSON.stringify(params), 30, () =>
            derivatives(instrument.parse(params)),
          ),
        );
      if (path === "context")
        return json(await cached("context", 120, context));
      if (path === "news") return json(await cached("news", 120, news));
      if (path === "risk")
        return json(
          positionSize(
            z
              .object({
                account: positive,
                riskPct: positive.max(5),
                entry: positive,
                stop: positive,
                target: positive.optional(),
                leverage: positive.max(100),
                direction: z.enum(["LONG", "SHORT"]),
                feeBps: finite.min(0).default(10),
                slippageBps: finite.min(0).default(5),
              })
              .parse(body),
          ),
        );
    }
    if (["auth/wallet/challenge", "auth/wallet/verify"].includes(path)) {
      const current = await session(req);
      if (current) verifyCsrf(req);
      await rateLimit(
        "wallet-ip:" + (req.headers.get("x-real-ip") || "local"),
        20,
        60,
      );
      if (path === "auth/wallet/challenge") {
        const addr = z
          .string()
          .regex(/^0x[0-9a-fA-F]{40}$/)
          .parse(body.address);
        await rateLimit("wallet-address:" + addr.toLowerCase(), 10, 60);
      }
      const result =
        path === "auth/wallet/challenge"
          ? await walletChallenge(req, body, current)
          : await walletVerify(req, body, current);
      return json(
        result.body,
        200,
        result.cookie ? { "set-cookie": result.cookie } : {},
      );
    }
    if (path === "auth/oauth/verify-totp") {
      await rateLimit(
        "oauth-totp:" +
          hash(
            cookies(req)[
              process.env.NODE_ENV === "production"
                ? "__Host-cryptosight-oauth-mfa"
                : "cryptosight-oauth-mfa"
            ] || "none",
          ),
        5,
        300,
      );
      const result = await verifyOAuthTotp(
        req,
        z.string().length(6).parse(body.code),
      );
      return json({ authenticated: true }, 200, {
        "set-cookie": result.cookie,
      });
    }
    if (path === "auth/resend-verification") {
      const addr = emailSchema.parse(body.email);
      await rateLimit("resend:" + addr, 3, 3600);
      const u = (
        await take(
          "SELECT id,locale FROM users WHERE email=$1 AND email_verified=false",
          [addr],
        )
      )[0];
      if (u && process.env.SMTP_URL) {
        const token = randomBytes(32).toString("hex");
        await query(
          "INSERT INTO auth_tokens(user_id,kind,token_hash,expires_at) VALUES($1,'verify',$2,now()+interval '1 day')",
          [u.id, hash(token)],
        );
        await email(
          addr,
          messages(u.locale).verifyEmailSubject,
          messages(u.locale).verifyEmailBody +
            " " +
            process.env.APP_ORIGIN +
            "/?verify=" +
            token,
        );
      }
      return json({ accepted: true });
    }
    if (path === "auth/register" && method === "POST") {
      const b = z
        .object({
          email: emailSchema,
          password: pass,
          locale: z.enum(["en", "pl", "de"]).default("en"),
          consent: z.literal(true),
        })
        .parse(body);
      await rateLimit(`register:${b.email}`, 5, 3600);
      if (process.env.NODE_ENV === "production" && !process.env.SMTP_URL)
        throw new Error("email_not_configured");
      const id = randomUUID(),
        verified = process.env.NODE_ENV !== "production";
      await transaction(async (tx) => {
        await tx.query(
          "INSERT INTO users(id,email,password_hash,locale,email_verified) VALUES($1,$2,$3,$4,$5)",
          [id, b.email, await passwordHash(b.password), b.locale, verified],
        );
        await tx.query(
          "INSERT INTO consents(user_id,version,locale) VALUES($1,'2026-10-v1',$2)",
          [id, b.locale],
        );
        await tx.query(
          "INSERT INTO paper_accounts(user_id,balance) VALUES($1,10000)",
          [id],
        );
      });
      if (!verified) {
        const token = randomBytes(32).toString("hex");
        await query(
          "INSERT INTO auth_tokens(user_id,kind,token_hash,expires_at) VALUES($1,'verify',$2,now()+interval '1 day')",
          [id, hash(token)],
        );
        await email(
          b.email,
          messages(b.locale).verifyEmailSubject,
          messages(b.locale).verifyEmailBody +
            " " +
            `${process.env.APP_ORIGIN}/?verify=${token}`,
        );
        return json({ verification_required: true });
      }
      return json({ registered: true }, 201, {
        "set-cookie": await createSession(id),
      });
    }
    if (path === "auth/login" && method === "POST") {
      const b = z
        .object({
          email: emailSchema,
          password: z.string().max(128),
          totp: z.string().max(10).optional(),
        })
        .parse(body);
      await rateLimit(`login:${b.email}`, 10, 600);
      const u = (
        await take(
          "SELECT * FROM users WHERE email=$1 AND deleted_at IS NULL",
          [b.email],
        )
      )[0];
      if (
        !u ||
        !(await passwordValid(b.password, u.password_hash)) ||
        !(await checkTotp(u, b.totp))
      )
        throw new Error("invalid_login");
      if (!u.email_verified) throw new Error("email_verification_required");
      return json({ authenticated: true }, 200, {
        "set-cookie": await createSession(u.id),
      });
    }
    if (path === "auth/verify" && method === "POST") {
      const token = z.string().length(64).parse(body.token);
      const row = await transaction(async (tx) => {
        const r = await tx.query(
          "DELETE FROM auth_tokens WHERE token_hash=$1 AND kind='verify' AND expires_at>now() RETURNING user_id",
          [hash(token)],
        );
        if (r.rows[0])
          await tx.query("UPDATE users SET email_verified=true WHERE id=$1", [
            r.rows[0].user_id,
          ]);
        return r.rows[0];
      });
      if (!row) throw new Error("invalid_token");
      return json({ verified: true });
    }
    if (path === "auth/reset-request" && method === "POST") {
      const addr = emailSchema.parse(body.email);
      await rateLimit(`reset:${addr}`, 3, 3600);
      const u = (
        await take("SELECT id,locale FROM users WHERE email=$1", [addr])
      )[0];
      if (u && process.env.SMTP_URL) {
        const token = randomBytes(32).toString("hex");
        await query(
          "INSERT INTO auth_tokens(user_id,kind,token_hash,expires_at) VALUES($1,'reset',$2,now()+interval '30 minutes')",
          [u.id, hash(token)],
        );
        await email(
          addr,
          messages(u.locale).resetEmailSubject,
          messages(u.locale).resetEmailBody +
            " " +
            `${process.env.APP_ORIGIN}/?reset=${token}`,
        );
      }
      return json({ accepted: true });
    }
    if (path === "auth/reset" && method === "POST") {
      const b = z
        .object({ token: z.string().length(64), password: pass })
        .parse(body);
      await transaction(async (tx) => {
        const r = await tx.query(
          "DELETE FROM auth_tokens WHERE token_hash=$1 AND kind='reset' AND expires_at>now() RETURNING user_id",
          [hash(b.token)],
        );
        if (!r.rows[0]) throw new Error("invalid_token");
        await tx.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
          await passwordHash(b.password),
          r.rows[0].user_id,
        ]);
        await tx.query("DELETE FROM sessions WHERE user_id=$1", [
          r.rows[0].user_id,
        ]);
      });
      return json({ reset: true });
    }
    user = await session(req);
    if (path === "auth/me")
      return json({
        user,
        csrfToken: user ? csrf(req) : null,
        consentAccepted: user
          ? (await take("SELECT 1 FROM consents WHERE user_id=$1", [user.id]))
              .length > 0
          : false,
        configuration: {
          announcement: (await platformSettings()).announcement,
          aiEnabled: (await platformSettings()).ai_enabled,
          walletChains: walletChains(),
          googleOAuth: !!process.env.GOOGLE_CLIENT_ID,
          email: !!process.env.SMTP_URL,
          byok: !!process.env.BYOK_ENCRYPTION_KEY,
          billing: !!process.env.STRIPE_PRICE_ID,
          pushKey: process.env.VAPID_PUBLIC_KEY || null,
          analysisReservation: estimate(),
        },
      });
    if (!user) throw new Error("authentication_required");
    await rateLimit(`user:${user.id}`, 120, 60);
    if (mutation) verifyCsrf(req);
    const uid = user.id;
    if (parts[0] === "admin")
      return json(await adminHandle(user, path, method, body, params));
    if (path === "agents") return json(await availableAgents(user));
    if (mutation)
      await audit(uid, "attempt." + method.toLowerCase() + "." + parts[0]);
    const id = uuid.safeParse(parts[1]).success ? parts[1] : null;
    if (path === "wallets" && method === "GET")
      return json(
        await take(
          "SELECT id,address,chain_id,created_at,last_used_at FROM wallet_identities WHERE user_id=$1 ORDER BY created_at",
          [uid],
        ),
      );
    if (path === "ws-ticket" && method === "POST") {
      const token = randomBytes(32).toString("hex");
      await query(
        "INSERT INTO auth_tokens(user_id,kind,token_hash,expires_at) VALUES($1,'ws',$2,now()+interval '30 seconds')",
        [uid, hash(token)],
      );
      return json({ ticket: token });
    }
    if (path === "auth/logout" && method === "POST") {
      await query("DELETE FROM sessions WHERE token_hash=$1", [
        hash(cookies(req)[cookieName]),
      ]);
      return json({ logged_out: true }, 200, { "set-cookie": clearSession() });
    }
    if (path === "settings") {
      if (method === "GET")
        return json({
          ...user,
          usage:
            (
              await take(
                "SELECT * FROM daily_budgets WHERE user_id=$1 AND day=CURRENT_DATE",
                [uid],
              )
            )[0] || null,
        });
      const b = z
        .object({
          locale: z.enum(["en", "pl", "de"]),
          timezone: z.string().max(80),
          settings: z
            .object({
              telegramChatId: z
                .string()
                .regex(/^-?\d{1,20}$/)
                .optional(),
              dailyLossLimit: positive.max(1000000).optional(),
              maxDrawdownPct: positive.max(100).optional(),
              theme: z.enum(["dark", "light"]).optional(),
            })
            .default({}),
        })
        .parse(body);
      try {
        new Intl.DateTimeFormat("en", { timeZone: b.timezone });
      } catch {
        throw new Error("invalid_timezone");
      }
      await query(
        "UPDATE users SET locale=$1,timezone=$2,settings=settings||$3::jsonb WHERE id=$4",
        [b.locale, b.timezone, JSON.stringify(b.settings), uid],
      );
      return json({ saved: true });
    }
    if (path === "totp") {
      const u = (await take("SELECT * FROM users WHERE id=$1", [uid]))[0];
      if (method === "GET") return json(totpBegin(u));
      if (method === "POST") {
        await totpEnable(
          u,
          z.string().min(16).max(100).parse(body.secret),
          z.string().length(6).parse(body.code),
        );
        return json({ enabled: true });
      }
      if (method === "DELETE") {
        if (
          (u.password_hash &&
            !(await passwordValid(body.password, u.password_hash))) ||
          !(await checkTotp(u, body.code))
        )
          throw new Error("invalid_login");
        await query("UPDATE users SET totp_envelope=NULL WHERE id=$1", [uid]);
        return json({ disabled: true });
      }
    }
    if (path === "consents" && method === "POST") {
      await query(
        "INSERT INTO consents(user_id,version,locale) VALUES($1,'2026-10-v1',$2) ON CONFLICT DO NOTHING",
        [uid, user.locale],
      );
      return json({ accepted: true });
    }
    if (parts[0] === "credentials") {
      if (method === "GET")
        return json(
          await take(
            "SELECT id,provider,key_id,created_at FROM credentials WHERE user_id=$1",
            [uid],
          ),
        );
      if (method === "DELETE") {
        await query("DELETE FROM credentials WHERE id=$1 AND user_id=$2", [
          id,
          uid,
        ]);
        await audit(uid, "credential.deleted", id);
        return json({ deleted: true });
      }
      const b = z
          .object({
            provider: z.enum(["openai", "gemini", "anthropic", "openrouter"]),
            key: z.string().min(8).max(1000),
          })
          .parse(body),
        e = encryptKey(b.key, rootKey(), {
          userId: uid,
          provider: b.provider,
          keyId: process.env.BYOK_KEY_ID || "primary",
        });
      await query(
        "INSERT INTO credentials(user_id,provider,key_id,ciphertext,nonce,tag) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,provider) DO UPDATE SET key_id=EXCLUDED.key_id,ciphertext=EXCLUDED.ciphertext,nonce=EXCLUDED.nonce,tag=EXCLUDED.tag",
        [
          uid,
          b.provider,
          e.keyId,
          Buffer.from(e.ciphertext, "base64"),
          Buffer.from(e.nonce, "base64"),
          Buffer.from(e.tag, "base64"),
        ],
      );
      await audit(uid, "credential.saved");
      return json({ saved: true });
    }
    if (parts[0] === "analyses") {
      if (method === "POST") {
        if (
          !(await take("SELECT 1 FROM consents WHERE user_id=$1", [uid])).length
        )
          throw new Error("consent_required");
        const b = instrument
          .extend({
            mode: z.enum(["quick", "deep", "explain"]),
            indicatorPeriod: z.number().int().min(2).max(200).default(14),
            locale: z.enum(["en", "pl", "de"]),
            provider: z.enum(providers),
            model: z.string().min(1).max(100),
            agentId: uuid.optional(),
          })
          .parse(body);
        return json(
          await queueAnalysis(
            user,
            b,
            z
              .string()
              .min(8)
              .max(150)
              .parse(req.headers.get("idempotency-key")),
          ),
          202,
        );
      }
      if (id) {
        const r = (
          await take(
            "SELECT id,status,result,snapshot_id,error_code,cost_usd,created_at,request_config FROM analyses WHERE id=$1 AND user_id=$2",
            [id, uid],
          )
        )[0];
        if (!r) throw new Error("not_found");
        return json(r);
      }
      return json(
        await take(
          "SELECT id,status,result,cost_usd,created_at,request_config FROM analyses WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
          [uid],
        ),
      );
    }
    if (path === "chat" && method === "POST") {
      const b = instrument
        .extend({
          message: text,
          provider: z.enum(providers),
          model: z.string().min(1).max(100),
          agentId: uuid.optional(),
          locale: z.enum(["en", "pl", "de"]),
        })
        .parse(body);
      if (
        !(await take("SELECT 1 FROM consents WHERE user_id=$1", [uid])).length
      )
        throw new Error("consent_required");
      await rateLimit(`chat:${uid}`, 5, 3600);
      const snap = await snapshot(b, "quick");
      Object.assign(b, await resolveAIConfig(uid, b));
      const managed = await platformCredential(uid, b);
      const providerKey = managed?.key || (await credential(uid, b.provider));
      const result = await withAIBudget(user, b, () =>
        llm({
          provider: b.provider,
          model: b.model,
          key: providerKey,
          agentInstructions: managed?.instructions,
          locale: b.locale,
          snap,
          mode: "chat",
          message: b.message,
        }),
      );
      await query(
        "INSERT INTO chat_messages(user_id,symbol,role,content) VALUES($1,$2,'user',$3),($1,$2,'assistant',$4)",
        [uid, b.symbol, b.message, result.text],
      );
      return json({ content: result.text, usage: result.usage });
    }
    if (parts[0] === "drawings") {
      if (method === "GET") {
        const i = instrument.parse(params);
        return json(
          await take(
            "SELECT * FROM drawings WHERE user_id=$1 AND venue=$2 AND market=$3 AND symbol=$4 AND timeframe=$5 AND deleted_at IS NULL ORDER BY created_at",
            [uid, i.venue, i.market, i.symbol, i.timeframe],
          ),
        );
      }
      if (method === "DELETE") {
        const deleted = await query(
          "UPDATE drawings SET deleted_at=now(),version=version+1 WHERE id=$1 AND user_id=$2 RETURNING *",
          [id, uid],
        );
        if (deleted.rows[0])
          await redisClient()
            ?.publish(
              "cryptosight:drawings",
              JSON.stringify({ userId: uid, instrument: deleted.rows[0], id }),
            )
            .catch(() => {});
        return json({ deleted: true });
      }
      const b = instrument
        .extend({
          kind: z.string().min(1).max(60),
          payload: z.object({
            name: z.string().max(60),
            points: z
              .array(
                z.object({
                  timestamp: finite.optional(),
                  value: finite.optional(),
                  dataIndex: finite.optional(),
                }),
              )
              .max(500),
            styles: z.record(z.string(), z.unknown()).optional(),
            lock: z.boolean().optional(),
            visible: z.boolean().optional(),
            extendData: z.unknown().optional(),
          }),
          version: z.number().int().min(0).default(0),
        })
        .parse(body);
      const old = (
        await take("SELECT * FROM drawings WHERE id=$1 AND user_id=$2", [
          id,
          uid,
        ])
      )[0];
      if (old) {
        const r = await take(
          "UPDATE drawings SET payload=$1,version=version+1,updated_at=now(),deleted_at=NULL WHERE id=$2 AND user_id=$3 AND version=$4 RETURNING *",
          [JSON.stringify(b.payload), id, uid, b.version],
        );
        if (!r.length)
          return json({ code: "version_conflict", latest: old }, 409);
        await redisClient()
          ?.publish(
            "cryptosight:drawings",
            JSON.stringify({ userId: uid, instrument: b, id }),
          )
          .catch(() => {});
        return json(r[0]);
      }
      if (b.version !== 0) throw new Error("version_conflict");
      const row = (
        await take(
          "INSERT INTO drawings(id,user_id,venue,market,symbol,timeframe,kind,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
          [
            id || randomUUID(),
            uid,
            b.venue,
            b.market,
            b.symbol,
            b.timeframe,
            b.kind,
            JSON.stringify(b.payload),
          ],
        )
      )[0];
      await redisClient()
        ?.publish(
          "cryptosight:drawings",
          JSON.stringify({ userId: uid, instrument: b, id: row.id }),
        )
        .catch(() => {});
      return json(row);
    }
    if (parts[0] === "templates") {
      if (method === "GET")
        return json(
          await take("SELECT * FROM indicator_templates WHERE user_id=$1", [
            uid,
          ]),
        );
      if (method === "DELETE") {
        await query(
          "DELETE FROM indicator_templates WHERE id=$1 AND user_id=$2",
          [id, uid],
        );
        return json({ deleted: true });
      }
      const b = z
        .object({
          name: z.string().min(1).max(100),
          config: z.record(z.string(), z.unknown()),
        })
        .parse(body);
      return json(
        (
          await take(
            "INSERT INTO indicator_templates(user_id,name,config) VALUES($1,$2,$3) RETURNING *",
            [uid, b.name, JSON.stringify(b.config)],
          )
        )[0],
      );
    }
    if (path === "watchlist") {
      if (method === "GET")
        return json(
          await take(
            "SELECT wi.* FROM watchlist_items wi JOIN watchlists w ON w.id=wi.watchlist_id WHERE w.user_id=$1",
            [uid],
          ),
        );
      const b = instrument.parse(body);
      await transaction(async (tx) => {
        let w = (
          await tx.query(
            "SELECT id FROM watchlists WHERE user_id=$1 ORDER BY created_at LIMIT 1",
            [uid],
          )
        ).rows[0];
        if (!w)
          w = (
            await tx.query(
              "INSERT INTO watchlists(user_id,name) VALUES($1,'Default') RETURNING id",
              [uid],
            )
          ).rows[0];
        if (method === "DELETE")
          await tx.query(
            "DELETE FROM watchlist_items WHERE watchlist_id=$1 AND venue=$2 AND market=$3 AND symbol=$4",
            [w.id, b.venue, b.market, b.symbol],
          );
        else
          await tx.query(
            "INSERT INTO watchlist_items(watchlist_id,venue,market,symbol) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
            [w.id, b.venue, b.market, b.symbol],
          );
      });
      return json({ saved: true });
    }
    if (parts[0] === "alerts") {
      if (method === "GET")
        return json(
          await take(
            "SELECT * FROM alerts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
            [uid],
          ),
        );
      if (method === "DELETE") {
        await query("DELETE FROM alerts WHERE id=$1 AND user_id=$2", [id, uid]);
        return json({ deleted: true });
      }
      const b = z
        .object({
          kind: z.enum(["price", "indicator", "ai_signal", "drawing"]),
          condition: instrument.extend({
            comparison: z.enum(["above", "below"]).optional(),
            price: positive.optional(),
            value: finite.optional(),
            indicator: z.enum(["RSI", "EMA20"]).optional(),
            drawingId: uuid.optional(),
          }),
          channels: z
            .array(z.enum(["in_app", "email", "telegram", "push"]))
            .min(1)
            .max(4),
        })
        .parse(body);
      if (b.channels.includes("email") && !user.email)
        throw new Error("email_required");
      if (
        (b.kind === "price" && !b.condition.price) ||
        (b.kind === "indicator" &&
          (b.condition.value == null || !b.condition.indicator)) ||
        (b.kind === "drawing" && !b.condition.drawingId)
      )
        throw new Error("invalid_alert");
      return json(
        (
          await take(
            "INSERT INTO alerts(user_id,kind,condition,channels) VALUES($1,$2,$3,$4) RETURNING *",
            [
              uid,
              b.kind,
              JSON.stringify(b.condition),
              JSON.stringify(b.channels),
            ],
          )
        )[0],
      );
    }
    if (parts[0] === "notifications") {
      if (method === "GET")
        return json(
          await take(
            "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
            [uid],
          ),
        );
      await query("UPDATE notifications SET read=true WHERE user_id=$1", [uid]);
      return json({ saved: true });
    }
    if (path === "push" && method === "POST") {
      const b = z
        .object({
          endpoint: z.string().url().max(2000),
          keys: z.object({
            p256dh: z.string().max(500),
            auth: z.string().max(100),
          }),
        })
        .parse(body);
      const host = new URL(b.endpoint).hostname;
      if (
        ![
          "fcm.googleapis.com",
          "updates.push.services.mozilla.com",
          "web.push.apple.com",
        ].some((h) => host === h || host.endsWith("." + h))
      )
        throw new Error("invalid_push_endpoint");
      await query("UPDATE users SET push_subscription=$1 WHERE id=$2", [
        JSON.stringify(b),
        uid,
      ]);
      return json({ saved: true });
    }
    if (parts[0] === "schedules") {
      if (method === "GET")
        return json(
          await take(
            "SELECT * FROM schedules WHERE user_id=$1 ORDER BY created_at DESC",
            [uid],
          ),
        );
      if (method === "DELETE") {
        await query("DELETE FROM schedules WHERE id=$1 AND user_id=$2", [
          id,
          uid,
        ]);
        return json({ deleted: true });
      }
      const b = z
        .object({
          interval_minutes: z.number().int().min(15).max(10080),
          config: instrument.extend({
            provider: z.enum(providers),
            model: z.string().min(1).max(100),
            agentId: uuid.optional(),
            locale: z.enum(["en", "pl", "de"]),
            mode: z.enum(["quick", "deep", "explain"]),
          }),
        })
        .parse(body);
      return json(
        (
          await take(
            "INSERT INTO schedules(user_id,config,interval_minutes,next_run) VALUES($1,$2,$3,now()) RETURNING *",
            [uid, JSON.stringify(b.config), b.interval_minutes],
          )
        )[0],
      );
    }
    if (path === "exchange/connect" && method === "POST") {
      const b = z
        .object({
          apiKey: z.string().min(10).max(200),
          secret: z.string().min(10).max(200),
        })
        .parse(body);
      await rateLimit("exchange:" + uid, 5, 3600);
      return json(await connectExchange(uid, b));
    }
    if (path === "exchange/portfolio")
      return json(await exchangePortfolio(uid));
    if (path === "exchange/trades")
      return json(
        await exchangeTrades(
          uid,
          z
            .string()
            .regex(/^[A-Z0-9]{2,20}USDT$/)
            .parse(params.symbol),
        ),
      );
    if (parts[0] === "attachments") {
      if (method === "GET") {
        const row = (
          await take(
            "SELECT mime_type,bytes FROM journal_attachments WHERE id=$1 AND user_id=$2",
            [id, uid],
          )
        )[0];
        if (!row) throw new Error("not_found");
        return new Response(row.bytes, {
          headers: {
            "content-type": row.mime_type,
            "cache-control": "private, no-store",
            "x-content-type-options": "nosniff",
          },
        });
      }
      if (method === "DELETE") {
        await query(
          "DELETE FROM journal_attachments WHERE id=$1 AND user_id=$2",
          [id, uid],
        );
        return json({ deleted: true });
      }
      const b = z
        .object({
          journalId: uuid,
          mimeType: z.enum(["image/png", "image/jpeg"]),
          base64: z.string().max(2700000),
        })
        .parse(body);
      if (
        !(
          await take(
            "SELECT 1 FROM journal_entries WHERE id=$1 AND user_id=$2",
            [b.journalId, uid],
          )
        ).length
      )
        throw new Error("not_found");
      const bytes = Buffer.from(b.base64, "base64");
      if (
        bytes.length > 2000000 ||
        bytes.length < 8 ||
        (b.mimeType === "image/png" &&
          bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") ||
        (b.mimeType === "image/jpeg" &&
          bytes.subarray(0, 3).toString("hex") !== "ffd8ff")
      )
        throw new Error("invalid_image");
      return json(
        (
          await take(
            "INSERT INTO journal_attachments(user_id,journal_id,mime_type,bytes) VALUES($1,$2,$3,$4) RETURNING id",
            [uid, b.journalId, b.mimeType, bytes],
          )
        )[0],
      );
    }
    if (parts[0] === "journal") {
      if (method === "GET")
        return json(
          await take(
            "SELECT j.*,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'mime_type',a.mime_type)) FROM journal_attachments a WHERE a.journal_id=j.id AND a.user_id=j.user_id),'[]'::jsonb) AS attachments FROM journal_entries j WHERE j.user_id=$1 ORDER BY j.created_at DESC LIMIT 200",
            [uid],
          ),
        );
      if (method === "DELETE") {
        await query("DELETE FROM journal_entries WHERE id=$1 AND user_id=$2", [
          id,
          uid,
        ]);
        return json({ deleted: true });
      }
      const b = z
        .object({
          symbol: z.string().regex(/^[A-Z0-9]{2,20}USDT$/),
          side: z.enum(["LONG", "SHORT"]),
          entry: positive,
          exit: positive,
          quantity: positive,
          fees: finite.min(0),
          notes: z.string().max(4000).default(""),
        })
        .parse(body);
      return json(
        (
          await take(
            "INSERT INTO journal_entries(user_id,symbol,side,entry,exit,quantity,fees,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
            [
              uid,
              b.symbol,
              b.side,
              b.entry,
              b.exit,
              b.quantity,
              b.fees,
              b.notes,
            ],
          )
        )[0],
      );
    }
    if (path === "journal-review" && method === "POST") {
      const b = z
        .object({
          provider: z.enum(providers),
          model: z.string().min(1).max(100),
          agentId: uuid.optional(),
          locale: z.enum(["en", "pl", "de"]),
        })
        .parse(body);
      if (
        !(await take("SELECT 1 FROM consents WHERE user_id=$1", [uid])).length
      )
        throw new Error("consent_required");
      await rateLimit(`review:${uid}`, 3, 3600);
      const entries = await take(
        "SELECT symbol,side,entry,exit,quantity,fees,notes FROM journal_entries WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30",
        [uid],
      );
      Object.assign(b, await resolveAIConfig(uid, b));
      const managed = await platformCredential(uid, b);
      const providerKey = managed?.key || (await credential(uid, b.provider));
      const r = await withAIBudget(user, b, () =>
        llm({
          ...b,
          key: providerKey,
          agentInstructions: managed?.instructions,
          snap: { journal: entries },
          mode: "chat",
          message:
            "Review recurring mistakes and risk management, only using this journal. No chart or market assumptions.",
        }),
      );
      return json({ content: r.text });
    }
    if (path === "paper/account") return json(await paperOverview(uid));
    if (path === "paper/orders" && method === "POST") {
      const b = instrument
        .extend({
          direction: z.enum(["LONG", "SHORT"]),
          quantity: positive.max(1000000),
        })
        .parse(body);
      const book = await depth(b);
      if (Date.now() - book.timestamp > 10000) throw new Error("stale_quote");
      const levels = b.direction === "LONG" ? book.asks : book.bids;
      let remaining = b.quantity,
        notional = 0;
      for (const [price, size] of levels) {
        const fill = Math.min(remaining, size);
        notional += fill * price;
        remaining -= fill;
        if (remaining <= 1e-10) break;
      }
      if (remaining > 1e-10) throw new Error("insufficient_depth");
      const fillPrice = notional / b.quantity,
        fees = notional * 0.001,
        key = z
          .string()
          .min(8)
          .max(150)
          .parse(req.headers.get("idempotency-key"));
      const result = await transaction(async (tx) => {
        const a = (
          await tx.query(
            "SELECT * FROM paper_accounts WHERE user_id=$1 FOR UPDATE",
            [uid],
          )
        ).rows[0];
        const old = (
          await tx.query(
            "SELECT * FROM paper_orders WHERE account_id=$1 AND idempotency_key=$2",
            [a.id, key],
          )
        ).rows[0];
        if (old) return old;
        const daily = (
          await tx.query(
            "SELECT COALESCE(SUM(pnl),0) AS pnl FROM paper_orders WHERE account_id=$1 AND closed_at>=CURRENT_DATE",
            [a.id],
          )
        ).rows[0];
        const total = (
          await tx.query(
            "SELECT COALESCE(SUM(pnl),0) AS pnl FROM paper_orders WHERE account_id=$1 AND closed_at IS NOT NULL",
            [a.id],
          )
        ).rows[0];
        const realized = +a.initial_balance + +total.pnl;
        if (
          ((+a.peak_equity - realized) / +a.peak_equity) * 100 >=
          (user.settings.maxDrawdownPct || 10)
        )
          throw new Error("max_drawdown_limit");
        if (+daily.pnl < -(user.settings.dailyLossLimit || 500))
          throw new Error("daily_loss_limit");
        if (+a.balance < notional + fees)
          throw new Error("insufficient_balance");
        await tx.query(
          "UPDATE paper_accounts SET balance=balance-$1,version=version+1 WHERE id=$2",
          [notional + fees, a.id],
        );
        return (
          await tx.query(
            "INSERT INTO paper_orders(account_id,symbol,direction,quantity,order_type,fill_price,fees,status,idempotency_key,venue,market) VALUES($1,$2,$3,$4,'market',$5,$6,'filled',$7,$8,$9) RETURNING *",
            [
              a.id,
              b.symbol,
              b.direction,
              b.quantity,
              fillPrice,
              fees,
              key,
              b.venue,
              b.market,
            ],
          )
        ).rows[0];
      });
      return json(result);
    }
    if (parts[0] === "paper-close" && method === "POST") {
      const order = (
        await take(
          "SELECT o.* FROM paper_orders o JOIN paper_accounts a ON a.id=o.account_id WHERE o.id=$1 AND a.user_id=$2",
          [id, uid],
        )
      )[0];
      if (!order) throw new Error("not_found");
      const book = await depth({
        venue: order.venue,
        market: order.market,
        symbol: order.symbol,
      });
      if (Date.now() - book.timestamp > 10000) throw new Error("stale_quote");
      const levels = order.direction === "LONG" ? book.bids : book.asks;
      let remaining = +order.quantity,
        value = 0;
      for (const [price, size] of levels) {
        const n = Math.min(remaining, size);
        value += n * price;
        remaining -= n;
        if (remaining <= 1e-10) break;
      }
      if (remaining > 1e-10) throw new Error("insufficient_depth");
      const price = value / +order.quantity;
      const settlement = settlePaperPosition({
        direction: order.direction,
        entry: +order.fill_price,
        exit: price,
        quantity: +order.quantity,
        entryFees: +order.fees,
      });
      await transaction(async (tx) => {
        const o = (
          await tx.query("SELECT * FROM paper_orders WHERE id=$1 FOR UPDATE", [
            id,
          ])
        ).rows[0];
        if (o.closed_at) throw new Error("already_closed");
        await tx.query(
          "UPDATE paper_accounts SET balance=balance+$1,version=version+1 WHERE id=$2",
          [settlement.returnedCollateral, o.account_id],
        );
        await tx.query(
          "UPDATE paper_orders SET closed_at=now(),close_price=$1,pnl=$2,status='closed',collateral_exhausted=$4 WHERE id=$3",
          [price, settlement.pnl, id, settlement.collateralExhausted],
        );
        await tx.query(
          "UPDATE paper_accounts SET peak_equity=GREATEST(peak_equity,initial_balance+(SELECT COALESCE(SUM(pnl),0) FROM paper_orders WHERE account_id=$1 AND closed_at IS NOT NULL)) WHERE id=$1",
          [o.account_id],
        );
      });
      return json({
        closed: true,
        collateral_exhausted: settlement.collateralExhausted,
        settlement_model: settlement.model,
      });
    }
    if (parts[0] === "backtests") {
      if (method === "GET")
        return json(
          await take(
            id
              ? "SELECT * FROM backtests WHERE id=$1 AND user_id=$2"
              : "SELECT * FROM backtests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30",
            id ? [id, uid] : [uid],
          ),
        );
      const b = instrument
        .extend({
          fast: z.number().int().min(2).max(100),
          slow: z.number().int().min(3).max(200),
          riskPct: positive.max(5),
          initialBalance: positive,
          feeBps: finite.min(0).max(100),
          slippageBps: finite.min(0).max(100),
        })
        .refine((b) => b.slow > b.fast)
        .parse(body);
      return json(
        (
          await take(
            "INSERT INTO backtests(user_id,strategy,status) VALUES($1,$2,'queued') RETURNING *",
            [uid, JSON.stringify(b)],
          )
        )[0],
        202,
      );
    }
    if (path === "signals")
      return json(
        await take(
          "SELECT s.*,a.request_config FROM signals s JOIN analyses a ON a.id=s.analysis_id WHERE a.user_id=$1 ORDER BY s.created_at DESC LIMIT 200",
          [uid],
        ),
      );
    if (path === "correlation") {
      const list = z
        .array(z.string().regex(/^[A-Z0-9]{2,20}USDT$/))
        .min(2)
        .max(8)
        .parse((params.symbols || "BTCUSDT,ETHUSDT").split(","));
      const rows = await Promise.all(
        list.map(async (symbol) => [
          symbol,
          (
            await history(
              {
                symbol,
                venue: params.venue || "binance",
                market: "spot",
                timeframe: "1d",
              },
              { limit: 90 },
            )
          ).candles.filter((c) => c.closed),
        ]),
      );
      return json(correlation(Object.fromEntries(rows)));
    }
    if (path === "daily-brief") {
      if (method === "GET")
        return json(
          (
            await take(
              "SELECT id,status,result,created_at,cost_usd FROM analyses WHERE user_id=$1 AND request_config->>'purpose'='daily_brief' ORDER BY created_at DESC LIMIT 1",
              [uid],
            )
          )[0] || null,
        );
      const b = z
        .object({
          provider: z.enum(providers),
          model: z.string().min(1).max(100),
          agentId: uuid.optional(),
          locale: z.enum(["en", "pl", "de"]),
        })
        .parse(body);
      if (
        !(await take("SELECT 1 FROM consents WHERE user_id=$1", [uid])).length
      )
        throw new Error("consent_required");
      const config = {
        ...b,
        venue: "binance",
        market: "spot",
        symbol: "BTCUSDT",
        timeframe: "1d",
        mode: "deep",
        purpose: "daily_brief",
      };
      const job = await queueAnalysis(
        user,
        config,
        "daily-brief:" + new Date().toISOString().slice(0, 10) + ":" + b.locale,
      );
      await transaction(async (tx) => {
        await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [uid]);
        const existing = await tx.query(
          "SELECT id FROM schedules WHERE user_id=$1 AND config->>'purpose'='daily_brief'",
          [uid],
        );
        if (existing.rows[0])
          await tx.query(
            "UPDATE schedules SET config=$1,enabled=true,next_run=now()+interval '1 day' WHERE id=$2",
            [JSON.stringify(config), existing.rows[0].id],
          );
        else
          await tx.query(
            "INSERT INTO schedules(user_id,config,interval_minutes,next_run) VALUES($1,$2,1440,now()+interval '1 day')",
            [uid, JSON.stringify(config)],
          );
      });
      return json(job, 202);
    }
    if (path === "scanner" && method === "POST") {
      const b = z
        .object({
          provider: z.enum(providers),
          model: z.string().min(1).max(100),
          agentId: uuid.optional(),
          locale: z.enum(["en", "pl", "de"]),
          timeframe: instrument.shape.timeframe,
        })
        .parse(body);
      if (
        !(await take("SELECT 1 FROM consents WHERE user_id=$1", [uid])).length
      )
        throw new Error("consent_required");
      const key = z
        .string()
        .min(8)
        .max(150)
        .parse(req.headers.get("idempotency-key"));
      const items = await take(
          "SELECT wi.* FROM watchlist_items wi JOIN watchlists w ON w.id=wi.watchlist_id WHERE w.user_id=$1 ORDER BY wi.symbol LIMIT 5",
          [uid],
        ),
        jobs = [];
      for (const wi of items) {
        try {
          jobs.push({
            symbol: wi.symbol,
            ...(await queueAnalysis(
              user,
              {
                ...b,
                venue: wi.venue,
                market: wi.market,
                symbol: wi.symbol,
                mode: "quick",
              },
              key + ":" + wi.symbol,
            )),
          });
        } catch (e) {
          jobs.push({
            symbol: wi.symbol,
            error: ["daily_limit", "credential_required"].includes(e.message)
              ? e.message
              : "service_unavailable",
          });
        }
      }
      return json(
        { jobs, max_coins: 5, estimated_cost_per_coin: estimate() },
        202,
      );
    }
    if (path === "scanner" && params.mode === "ai") {
      const rows = await take(
        "SELECT DISTINCT ON (a.request_config->>'symbol') a.id,a.result,a.created_at,a.request_config FROM analyses a WHERE a.user_id=$1 AND a.status='completed' AND EXISTS(SELECT 1 FROM watchlist_items wi JOIN watchlists w ON w.id=wi.watchlist_id WHERE w.user_id=$1 AND wi.symbol=a.request_config->>'symbol' AND wi.venue=a.request_config->>'venue' AND wi.market=a.request_config->>'market') ORDER BY a.request_config->>'symbol',a.created_at DESC",
        [uid],
      );
      return json(
        rows
          .map((r) => {
            const setup = r.result.setups.find(
              (s) => s.direction !== "NO_TRADE",
            );
            return {
              analysisId: r.id,
              symbol: r.request_config.symbol,
              direction: setup?.direction || "NO_TRADE",
              score: setup
                ? r.result.confidence *
                  Math.min(setup.risk_reward, 5) *
                  { low: 1, medium: 0.8, high: 0.5, extreme: 0.2 }[
                    r.result.risk.level
                  ]
                : 0,
              scoreType: "subjective_llm_confidence_times_rr_risk_weight",
              timestamp: r.created_at,
              stale: Date.now() - +new Date(r.created_at) > 3600000,
            };
          })
          .sort((a, b) => b.score - a.score),
      );
    }
    if (path === "scanner") {
      const list = await take(
        "SELECT wi.* FROM watchlist_items wi JOIN watchlists w ON w.id=wi.watchlist_id WHERE w.user_id=$1 LIMIT 10",
        [uid],
      );
      const output = [];
      for (const wi of list) {
        try {
          const d = await history({ ...wi, timeframe: "1h" }, { limit: 220 }),
            i = indicators(d.candles),
            score =
              (i.ADX?.adx || 0) +
              Math.abs((i.RSI || 50) - 50) +
              (i.structure.state !== "mixed" ? 10 : 0);
          output.push({
            symbol: wi.symbol,
            score,
            indicators: i,
            source: wi.venue,
            scoreType: "deterministic_confluence_not_ai",
          });
        } catch {
          output.push({ symbol: wi.symbol, error: "provider_unavailable" });
        }
      }
      return json(output.sort((a, b) => (b.score || 0) - (a.score || 0)));
    }
    if (path === "reports" && method === "POST") {
      const id = uuid.parse(body.analysisId),
        a = (
          await take(
            "SELECT result,created_at FROM analyses WHERE id=$1 AND user_id=$2 AND status='completed'",
            [id, uid],
          )
        )[0];
      if (!a) throw new Error("not_found");
      const { report } = await import("./reports.mjs");
      return new Response(await report(a.result, user.locale), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="CryptoSight-${id}.pdf"`,
          "cache-control": "no-store",
        },
      });
    }
    if (path === "billing/checkout" && method === "POST") {
      if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID)
        throw new Error("billing_not_configured");
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY),
        s = await stripe.checkout.sessions.create({
          mode: "subscription",
          ...(user.email ? { customer_email: user.email } : {}),
          line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
          client_reference_id: uid,
          subscription_data: { metadata: { userId: uid } },
          success_url: `${process.env.APP_ORIGIN}/?billing=success`,
          cancel_url: `${process.env.APP_ORIGIN}/?billing=cancel`,
        });
      return json({ url: s.url });
    }
    if (path === "account/export") {
      const tables = [
        "drawings",
        "analyses",
        "alerts",
        "journal_entries",
        "backtests",
        "watchlists",
        "indicator_templates",
        "notifications",
        "schedules",
        "consents",
        "imported_trades",
        "wallet_identities",
      ];
      const out = { user };
      for (const t of tables)
        out[t] = await take(`SELECT * FROM ${t} WHERE user_id=$1`, [uid]);
      out.attachments = await take(
        "SELECT id,journal_id,mime_type,encode(bytes,'base64') AS base64 FROM journal_attachments WHERE user_id=$1",
        [uid],
      );
      out.paper_accounts = await take(
        "SELECT * FROM paper_accounts WHERE user_id=$1",
        [uid],
      );
      out.paper_orders = await take(
        "SELECT o.* FROM paper_orders o JOIN paper_accounts a ON a.id=o.account_id WHERE a.user_id=$1",
        [uid],
      );
      out.signals = await take(
        "SELECT s.* FROM signals s JOIN analyses a ON a.id=s.analysis_id WHERE a.user_id=$1",
        [uid],
      );
      return json(out, 200, {
        "content-disposition":
          'attachment; filename="CryptoSight-account.json"',
      });
    }
    if (path === "account" && method === "DELETE") {
      if (user.role === "admin") throw new Error("admin_self_lockout");
      const u = (
        await take("SELECT password_hash FROM users WHERE id=$1", [uid])
      )[0];
      if (
        u.password_hash &&
        !(await passwordValid(body.password, u.password_hash))
      )
        throw new Error("invalid_login");
      if (process.env.STRIPE_SECRET_KEY) {
        const subs = await take(
          "SELECT stripe_subscription_id FROM subscriptions WHERE user_id=$1 AND status IN ('active','trialing')",
          [uid],
        );
        if (subs.length) {
          const { default: Stripe } = await import("stripe");
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
          for (const sub of subs)
            await stripe.subscriptions.cancel(sub.stripe_subscription_id);
        }
      }
      await query("DELETE FROM users WHERE id=$1", [uid]);
      return json({ deleted: true }, 200, { "set-cookie": clearSession() });
    }
    throw new Error("not_found");
  } catch (e) {
    if (
      process.env.DEBUG_SERVER === "true" &&
      process.env.NODE_ENV !== "production"
    )
      console.error(e.stack);
    const code =
      e instanceof z.ZodError
        ? "validation_failed"
        : e.code === "23505"
          ? "already_exists"
          : e.message || "server_error";
    const known = [
      "invalid_agent",
      "invalid_admin_request",
      "invalid_instrument",
      "invalid_risk",
      "invalid_strategy",
      "invalid_analysis",
      "invalid_provider",
      "invalid_timezone",
      "invalid_login",
      "wallet_chain_unsupported",
      "wallet_address_invalid",
      "wallet_signature_invalid",
      "wallet_use_link",
      "wallet_last_login_method",
      "wallet_totp_required",
      "invalid_totp",
      "invalid_token",
      "invalid_alert",
      "invalid_content_type",
      "invalid_json",
      "email_required",
      "body_too_large",
      "stale_quote",
      "invalid_push_endpoint",
      "invalid_webhook",
      "invalid_image",
    ];
    const status =
      code === "authentication_required" || code === "wallet_challenge_invalid"
        ? 401
        : [
              "csrf_failed",
              "consent_required",
              "admin_required",
              "account_suspended",
            ].includes(code)
          ? 403
          : code === "not_found"
            ? 404
            : [
                  "admin_self_lockout",
                  "admin_last_admin",
                  "job_not_queued",
                  "agent_changed",
                ].includes(code) ||
                code === "wallet_already_linked" ||
                code === "version_conflict" ||
                code === "already_exists" ||
                code === "already_closed"
              ? 409
              : code === "rate_limited" ||
                  code === "daily_limit" ||
                  code === "daily_loss_limit" ||
                  code === "max_drawdown_limit"
                ? 429
                : e instanceof z.ZodError || known.includes(code)
                  ? 400
                  : 503;
    const requestId = randomUUID();
    if (status === 503) recordFailure("api", requestId);
    return json(
      {
        code:
          status === 503 &&
          ![
            "credential_required",
            "ai_paused",
            "agent_unavailable",
            "email_not_configured",
            "encryption_not_configured",
            "database_not_configured",
            "billing_not_configured",
            "insufficient_fresh_data",
            "insufficient_balance",
            "insufficient_depth",
            "local_provider_not_configured",
          ].includes(code)
            ? "service_unavailable"
            : code,
        request_id: requestId,
      },
      status,
    );
  }
}
