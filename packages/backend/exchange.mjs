import { createHmac } from "node:crypto";
import { encryptKey, decryptKey } from "../security/key-vault.mjs";
import { rootKey } from "./auth.mjs";
import { query } from "./store.mjs";
import { jsonFetch } from "../market/providers.mjs";
async function signed(path, { apiKey, secret }, params = {}) {
  const query = new URLSearchParams({
      ...params,
      timestamp: String(Date.now()),
      recvWindow: "5000",
    }).toString(),
    signature = createHmac("sha256", secret).update(query).digest("hex");
  return jsonFetch(
    `https://api.binance.com${path}?${query}&signature=${signature}`,
    { headers: { "X-MBX-APIKEY": apiKey } },
  );
}
async function checkReadOnly(credentials) {
  const permissions = await signed(
    "/sapi/v1/account/apiRestrictions",
    credentials,
  );
  if (
    permissions.enableReading !== true ||
    ["enableSpotAndMarginTrading", "enableFutures", "enableWithdrawals"].some(
      (k) => permissions[k] !== false,
    ) ||
    [
      "enableSpotAndMarginTrading",
      "enableFutures",
      "enableWithdrawals",
      "enableInternalTransfer",
      "enablePermitsUniversalTransfer",
      "enableVanillaOptions",
      "enableMargin",
    ].some((k) => permissions[k])
  )
    throw new Error("exchange_key_not_readonly");
  return permissions;
}
export async function connectExchange(userId, credentials) {
  await checkReadOnly(credentials);
  const e = encryptKey(JSON.stringify(credentials), rootKey(), {
    userId,
    provider: "binance-readonly",
    keyId: process.env.BYOK_KEY_ID || "primary",
  });
  await query(
    "INSERT INTO credentials(user_id,provider,key_id,ciphertext,nonce,tag) VALUES($1,'binance-readonly',$2,$3,$4,$5) ON CONFLICT(user_id,provider) DO UPDATE SET ciphertext=EXCLUDED.ciphertext,nonce=EXCLUDED.nonce,tag=EXCLUDED.tag,key_id=EXCLUDED.key_id",
    [
      userId,
      e.keyId,
      Buffer.from(e.ciphertext, "base64"),
      Buffer.from(e.nonce, "base64"),
      Buffer.from(e.tag, "base64"),
    ],
  );
  return { connected: true, permissions: "read_only" };
}
async function loadExchange(userId) {
  const r = (
    await query(
      "SELECT * FROM credentials WHERE user_id=$1 AND provider='binance-readonly'",
      [userId],
    )
  ).rows[0];
  if (!r) throw new Error("exchange_not_configured");
  const credentials = JSON.parse(
    decryptKey(
      {
        version: r.envelope_version,
        keyId: r.key_id,
        ciphertext: Buffer.from(r.ciphertext).toString("base64"),
        nonce: Buffer.from(r.nonce).toString("base64"),
        tag: Buffer.from(r.tag).toString("base64"),
      },
      rootKey(),
      { userId, provider: r.provider },
    ),
  );
  await checkReadOnly(credentials);
  return credentials;
}
export async function exchangePortfolio(userId) {
  const credentials = await loadExchange(userId),
    account = await signed("/api/v3/account", credentials);
  return {
    balances: account.balances.filter((b) => +b.free || +b.locked),
    updatedAt: account.updateTime,
    source: "binance",
    readOnly: true,
  };
}
export async function exchangeTrades(userId, symbol) {
  const credentials = await loadExchange(userId),
    trades = await signed("/api/v3/myTrades", credentials, {
      symbol,
      limit: "1000",
    });
  for (const trade of trades)
    await query(
      "INSERT INTO imported_trades(user_id,venue,symbol,trade_id,data) VALUES($1,'binance',$2,$3,$4) ON CONFLICT(user_id,venue,symbol,trade_id) DO NOTHING",
      [userId, symbol, String(trade.id), JSON.stringify(trade)],
    );
  return (
    await query(
      "SELECT * FROM imported_trades WHERE user_id=$1 AND symbol=$2 ORDER BY created_at DESC LIMIT 1000",
      [userId, symbol],
    )
  ).rows;
}
