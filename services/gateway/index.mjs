import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import {
  streamConfig,
  parseStream,
  validateInstrument,
} from "../../packages/market/providers.mjs";
import { query } from "../../packages/backend/store.mjs";
import { hash } from "../../packages/backend/auth.mjs";
import { redisClient } from "../../packages/backend/cache.mjs";
import {
  orderflowConfig,
  parseOrderflow,
} from "../../packages/market/orderflow.mjs";
import { createConnectionLimiter } from "./connection-limits.mjs";
const upstreams = new Map(),
  clients = new Map(),
  reserveIP = createConnectionLimiter(20);
let received = 0,
  delivered = 0,
  reconnects = 0;
const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        streams: upstreams.size,
        clients: clients.size,
      }),
    );
  } else if (req.url === "/metrics") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end(
      `cryptosight_upstream_streams ${upstreams.size}\ncryptosight_clients ${clients.size}\ncryptosight_events_received_total ${received}\ncryptosight_events_delivered_total ${delivered}\ncryptosight_reconnects_total ${reconnects}\n`,
    );
  } else {
    res.writeHead(404);
    res.end();
  }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
const send = (ws, event) => {
  if (ws.readyState !== WebSocket.OPEN) return;
  if (ws.bufferedAmount > 1000000) {
    ws.close(1013, "backpressure");
    return;
  }
  ws.send(JSON.stringify({ v: 1, server_time: Date.now(), ...event }));
  delivered++;
};
function connect(entry) {
  const config = streamConfig(entry.instrument);
  if (process.env.NODE_ENV === "test" && process.env.TEST_UPSTREAM_URL)
    config.url = process.env.TEST_UPSTREAM_URL;
  const ws = new WebSocket(config.url, { handshakeTimeout: 10000 });
  entry.ws = ws;
  entry.last = Date.now();
  ws.on("open", () => {
    entry.retry = 0;
    entry.last = Date.now();
    if (config.subscribe) ws.send(JSON.stringify(config.subscribe));
    for (const c of entry.subscribers)
      send(c, {
        type: "status",
        subscription_id: entry.key,
        payload: { state: "live", venue: entry.instrument.venue },
      });
  });
  ws.on("message", (data) => {
    entry.last = Date.now();
    if (String(data) === "pong") return;
    try {
      const candle = parseStream(entry.instrument.venue, String(data));
      if (!candle) return;
      received++;
      entry.candle = candle;
      entry.sequence++;
      for (const c of entry.subscribers)
        send(c, {
          type: "candle",
          sequence: entry.sequence,
          subscription_id: entry.key,
          payload: candle,
        });
      if (candle.closed && process.env.DATABASE_URL)
        query(
          "INSERT INTO candles(venue,market,symbol,timeframe,open_time,open,high,low,close,volume,closed) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true) ON CONFLICT(venue,market,symbol,timeframe,open_time) DO UPDATE SET close=EXCLUDED.close,high=EXCLUDED.high,low=EXCLUDED.low,volume=EXCLUDED.volume,closed=true",
          [
            entry.instrument.venue,
            entry.instrument.market,
            entry.instrument.symbol,
            entry.instrument.timeframe,
            new Date(candle.timestamp),
            candle.open,
            candle.high,
            candle.low,
            candle.close,
            candle.volume,
          ],
        ).catch(() => {});
    } catch {}
  });
  ws.on("error", () => ws.close());
  ws.on("close", () => {
    for (const c of entry.subscribers)
      send(c, {
        type: "status",
        subscription_id: entry.key,
        payload: { state: "reconnecting" },
      });
    if (!upstreams.has(entry.key)) return;
    reconnects++;
    const delay =
      Math.min(30000, 500 * 2 ** Math.min(entry.retry++, 6)) +
      Math.random() * 1000;
    entry.timer = setTimeout(() => connect(entry), delay);
  });
}
function connectOrderflow(entry) {
  const config = orderflowConfig(entry.instrument);
  if (process.env.NODE_ENV === "test" && process.env.TEST_UPSTREAM_URL) return;
  const ws = new WebSocket(config.url, { handshakeTimeout: 10000 });
  entry.aux = ws;
  entry.flowState = {};
  entry.cvd = 0;
  entry.cvdSince = Date.now();
  entry.tradeIds = new Set();
  let last = Date.now();
  let heartbeat;
  ws.on("open", () => {
    if (config.subscribe) ws.send(JSON.stringify(config.subscribe));
    heartbeat = setInterval(() => {
      if (Date.now() - last > 60000) ws.terminate();
      else if (
        ws.readyState === WebSocket.OPEN &&
        entry.instrument.venue !== "binance"
      )
        ws.send(
          entry.instrument.venue === "okx"
            ? "ping"
            : JSON.stringify({ op: "ping" }),
        );
    }, 20000);
  });
  ws.on("message", (raw) => {
    last = Date.now();
    if (String(raw) === "pong") return;
    try {
      const events = parseOrderflow(
        entry.instrument.venue,
        String(raw),
        entry.flowState,
      );
      for (const e of events) {
        if (e.type === "trade") {
          if (entry.tradeIds.has(e.id)) continue;
          entry.tradeIds.add(e.id);
          if (entry.tradeIds.size > 5000)
            entry.tradeIds.delete(entry.tradeIds.values().next().value);
          entry.cvd += (e.side === "buy" ? 1 : -1) * e.size;
          e.cvd = {
            value: entry.cvd,
            since: entry.cvdSince,
            unit:
              entry.instrument.market === "spot"
                ? "base_asset"
                : "venue_contract_units",
          };
          const r = redisClient();
          if (r && Date.now() - (entry.lastCvdStored || 0) > 1000) {
            entry.lastCvdStored = Date.now();
            r.set(
              "cvd:" +
                JSON.stringify({
                  venue: entry.instrument.venue,
                  market: entry.instrument.market,
                  symbol: entry.instrument.symbol,
                }),
              JSON.stringify({ ...e.cvd, observedAt: Date.now() }),
              "EX",
              60,
            ).catch(() => {});
          }
        }
        for (const c of entry.subscribers)
          send(c, { type: e.type, subscription_id: entry.key, payload: e });
      }
    } catch {}
  });
  ws.on("error", () => ws.close());
  ws.on("close", () => {
    clearInterval(heartbeat);
    if (upstreams.has(entry.key))
      entry.auxTimer = setTimeout(
        () => connectOrderflow(entry),
        5000 + Math.random() * 1000,
      );
  });
}
function detach(ws, key) {
  const e = upstreams.get(key);
  if (!e) return;
  e.subscribers.delete(ws);
  clients.get(ws)?.subscriptions.delete(key);
  if (!e.subscribers.size) {
    upstreams.delete(key);
    clearTimeout(e.timer);
    clearTimeout(e.auxTimer);
    e.ws?.close();
    e.aux?.close();
  }
}
server.on("upgrade", async (req, socket, head) => {
  const origin = req.headers.origin;
  if (origin !== (process.env.APP_ORIGIN || "http://localhost:3000"))
    return socket.destroy();
  const ip = req.socket.remoteAddress || "unknown";
  const releaseIP = reserveIP(ip);
  if (!releaseIP) return socket.destroy();
  let userId = null;
  try {
    const token = new URL(req.url, "http://localhost").searchParams.get(
      "ticket",
    );
    if (token) {
      if (!process.env.DATABASE_URL) {
        releaseIP();
        return socket.destroy();
      }
      const r = await query(
        "DELETE FROM auth_tokens WHERE token_hash=$1 AND kind='ws' AND expires_at>now() RETURNING user_id",
        [hash(token)],
      );
      if (!r.rows[0]) {
        releaseIP();
        return socket.destroy();
      }
      userId = r.rows[0].user_id;
    }
  } catch {
    releaseIP();
    return socket.destroy();
  }
  if (socket.destroyed) {
    releaseIP();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    clients.set(ws, {
      subscriptions: new Set(),
      userId,
      alive: true,
      messageCount: 0,
    });
    ws.on("pong", () => {
      const c = clients.get(ws);
      if (c) c.alive = true;
    });
    ws.on("message", (raw) => {
      const state = clients.get(ws);
      if (++state.messageCount > 60) return ws.close(1008, "message_limit");
      try {
        const m = JSON.parse(String(raw));
        if (m.type === "subscribe") {
          const i = validateInstrument(
              m.instrument ? { ...m.instrument, timeframe: m.timeframe } : m,
            ),
            key = JSON.stringify(i);
          if (state.subscriptions.size >= 8 && !state.subscriptions.has(key))
            throw new Error("subscription_limit");
          let e = upstreams.get(key);
          if (!e) {
            if (upstreams.size >= 500) throw new Error("gateway_capacity");
            e = {
              key,
              instrument: i,
              subscribers: new Set(),
              sequence: 0,
              retry: 0,
            };
            upstreams.set(key, e);
            connect(e);
            connectOrderflow(e);
          }
          e.subscribers.add(ws);
          state.subscriptions.add(key);
          send(ws, {
            type: "status",
            subscription_id: key,
            payload: {
              state:
                e.ws?.readyState === WebSocket.OPEN ? "live" : "connecting",
              venue: i.venue,
            },
          });
          if (e.candle)
            send(ws, {
              type: "candle",
              sequence: e.sequence,
              subscription_id: key,
              payload: e.candle,
            });
        } else if (m.type === "unsubscribe") detach(ws, m.subscription_id);
      } catch {
        send(ws, { type: "error", payload: { code: "invalid_subscription" } });
      }
    });
    ws.on("close", () => {
      for (const key of clients.get(ws)?.subscriptions || []) detach(ws, key);
      clients.delete(ws);
      releaseIP();
    });
  });
});
setInterval(() => {
  for (const [ws, state] of clients) {
    if (!state.alive) {
      ws.terminate();
      continue;
    }
    state.alive = false;
    state.messageCount = 0;
    ws.ping();
  }
  for (const e of upstreams.values()) {
    if (Date.now() - e.last > 60000) {
      for (const ws of e.subscribers)
        send(ws, {
          type: "status",
          subscription_id: e.key,
          payload: { state: "stale" },
        });
      e.ws?.terminate();
    } else if (
      e.ws?.readyState === WebSocket.OPEN &&
      e.instrument.venue !== "binance"
    )
      e.ws.send(
        e.instrument.venue === "okx" ? "ping" : JSON.stringify({ op: "ping" }),
      );
  }
}, 20000).unref();
const redis = redisClient();
if (redis) {
  const pub = redis.duplicate();
  pub.subscribe("cryptosight:drawings");
  pub.on("message", (_, message) => {
    try {
      const e = JSON.parse(message);
      for (const [ws, c] of clients)
        if (c.userId === e.userId) send(ws, { type: "drawing", payload: e });
    } catch {}
  });
}
server.listen(
  Number(process.env.GATEWAY_PORT || 3001),
  process.env.GATEWAY_HOST || "0.0.0.0",
  () => console.log("CryptoSight gateway ready"),
);
const stop = () => {
  for (const e of upstreams.values()) {
    clearTimeout(e.timer);
    clearTimeout(e.auxTimer);
    e.ws?.terminate();
    e.aux?.terminate();
  }
  for (const ws of clients.keys()) ws.terminate();
  server.close();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
