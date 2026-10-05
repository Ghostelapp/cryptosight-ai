import { WebSocketServer, WebSocket } from "ws";
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import { writeFile } from "node:fs/promises";
const source = new WebSocketServer({ port: 3192, host: "127.0.0.1" });
source.on("connection", (ws) => {
  const timer = setInterval(() => {
    if (ws.readyState === 1)
      ws.send(
        JSON.stringify({
          k: {
            t: Date.now(),
            o: "100",
            h: "101",
            l: "99",
            c: "100",
            v: "1",
            x: false,
          },
        }),
      );
  }, 100);
  ws.on("close", () => clearInterval(timer));
});
const child = spawn(process.execPath, ["services/gateway/index.mjs"], {
  env: {
    ...process.env,
    NODE_ENV: "test",
    GATEWAY_PORT: "3193",
    GATEWAY_HOST: "127.0.0.1",
    APP_ORIGIN: "http://localhost:3000",
    TEST_UPSTREAM_URL: "ws://127.0.0.1:3192",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
const sockets = [],
  latencies = [],
  symbols = new Set();
let logs = "";
child.stderr.on("data", (d) => (logs += d));
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Gateway start timeout: " + logs)),
      15000,
    );
    child.stdout.on("data", (d) => {
      if (String(d).includes("ready")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  for (let connection = 0; connection < 7; connection++) {
    const ws = new WebSocket("ws://127.0.0.1:3193", {
      origin: "http://localhost:3000",
    });
    sockets.push(ws);
    await new Promise((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });
    ws.on("message", (raw) => {
      const e = JSON.parse(String(raw));
      if (e.type === "candle") {
        latencies.push(Date.now() - e.server_time);
        symbols.add(JSON.parse(e.subscription_id).symbol);
      }
    });
    for (let j = connection * 8; j < Math.min(51, connection * 8 + 8); j++)
      ws.send(
        JSON.stringify({
          type: "subscribe",
          instrument: {
            venue: "binance",
            market: "spot",
            symbol: `TEST${j}USDT`,
          },
          timeframe: "1m",
        }),
      );
  }
  await wait(3000);
  if (symbols.size !== 51)
    throw new Error(`Only ${symbols.size} streams delivered`);
  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const result = {
    test: "synthetic local WebSocket transport; does not measure exchange latency or browser rendering",
    symbols: symbols.size,
    connections: sockets.length,
    events: latencies.length,
    p95GatewayToClientMs: p95,
    passed: p95 < 200,
    timestamp: new Date().toISOString(),
  };
  await writeFile("docs/LOAD-TEST.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (!result.passed) throw new Error("Transport p95 above target");
} finally {
  for (const ws of sockets) ws.terminate();
  child.kill("SIGTERM");
  for (const ws of source.clients) ws.terminate();
  source.close();
}
