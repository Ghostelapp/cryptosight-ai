import { test } from "node:test";
import assert from "node:assert/strict";
import { createConnectionLimiter } from "../services/gateway/connection-limits.mjs";
import { createServer } from "node:net";
import { request } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { WebSocket } from "ws";

test("gateway connection limits reserve slots and release them once", () => {
  const reserve = createConnectionLimiter(2);
  const first = reserve("client");
  const second = reserve("client");
  assert.equal(typeof first, "function");
  assert.equal(typeof second, "function");
  assert.equal(reserve("client"), null);

  first();
  first();
  const third = reserve("client");
  assert.equal(typeof third, "function");
  assert.equal(reserve("client"), null);

  second();
  third();
  const final = reserve("client");
  assert.equal(typeof final, "function");
  final();
});

test(
  "gateway releases rejected handshakes and enforces the live connection cap",
  { timeout: 30000 },
  async (t) => {
    const probe = createServer();
    await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    const child = spawn(process.execPath, ["services/gateway/index.mjs"], {
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: "",
        REDIS_URL: "",
        GATEWAY_HOST: "127.0.0.1",
        GATEWAY_PORT: String(port),
        APP_ORIGIN: "http://localhost:3000",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const sockets = [];
    t.after(async () => {
      for (const ws of sockets) ws.terminate();
      const ended = once(child, "exit");
      child.kill();
      await ended;
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Gateway start timeout")),
        15000,
      );
      child.once("error", reject);
      child.stdout.on("data", (chunk) => {
        if (String(chunk).includes("gateway ready")) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    for (let i = 0; i < 25; i++) {
      const status = await new Promise((resolve, reject) => {
        const req = request(
          {
            host: "127.0.0.1",
            port,
            path: "/",
            headers: {
              Connection: "Upgrade",
              Upgrade: "websocket",
              Origin: "http://localhost:3000",
              "Sec-WebSocket-Version": "13",
              "Sec-WebSocket-Key": "invalid-key",
            },
          },
          (res) => {
            res.resume();
            res.once("end", () => resolve(res.statusCode));
          },
        );
        req.once("error", reject);
        req.end();
      });
      assert.equal(status, 400);
    }
    const connect = () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`, {
        origin: "http://localhost:3000",
      });
      sockets.push(ws);
      return ws;
    };
    for (let i = 0; i < 20; i++) await once(connect(), "open");
    const denied = connect();
    await new Promise((resolve, reject) => {
      denied.once("error", resolve);
      denied.once("open", () => reject(new Error("Connection cap bypassed")));
    });
    const closed = once(sockets[0], "close");
    sockets[0].close();
    await closed;
    await once(connect(), "open");
  },
);
