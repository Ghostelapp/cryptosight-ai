import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mobileCallback, serverOrigin } from "../packages/mobile/protocol.mjs";
import {
  base64url,
  mobileClient,
  mutationIntents,
} from "../apps/mobile/src/api.mjs";
import {
  rememberMobileRequest,
  consumeMobileRequest,
} from "../apps/web/lib/mobile-intent.mjs";

test("native endpoints require HTTPS; local HTTP is an explicit development option", () => {
  assert.equal(serverOrigin("https://example.com/"), "https://example.com");
  for (const url of [
    "http://localhost:3000",
    "https://x.example/api",
    "https://u:p@x.example",
    "https://x.example?token=secret",
    "https://x.example#fragment",
    "file:///x",
  ])
    assert.throws(() => serverOrigin(url));
  for (const host of [
    "localhost",
    "127.0.0.1",
    "192.168.1.2",
    "10.0.0.2",
    "172.16.0.2",
    "[::1]",
  ])
    assert.equal(
      serverOrigin(`http://${host}:3000`, true),
      `http://${host}:3000`,
    );
  for (const host of [
    "example.com",
    "192.169.1.2",
    "172.32.0.1",
    "localhost.evil.example",
  ])
    assert.throws(() => serverOrigin(`http://${host}`, true));
});
test("callback proof is bound to scheme, host, state, request and code", () => {
  const id = "11111111-1111-4111-8111-111111111111",
    state = "a".repeat(64),
    code = "b".repeat(64);
  const target = `cryptosightai://auth?requestId=${id}&state=${state}&code=${code}`;
  assert.equal(mobileCallback(target, id, state), code);
  for (const url of [
    target.replace("auth?", "attacker?"),
    target.replace("cryptosightai:", "https:"),
    target.replace("auth?", "auth/steal?"),
    target.replace(state, "c".repeat(64)),
    target.replace(code, "x"),
    target.replace(id, "22222222-2222-4222-8222-222222222222"),
  ])
    assert.throws(() => mobileCallback(url, id, state));
});
test("PKCE byte encoding matches the standard for every remainder length", () => {
  for (let length = 0; length < 130; length++) {
    const bytes = randomBytes(length);
    assert.equal(base64url(bytes), bytes.toString("base64url"));
  }
});
test("native transport sends scoped bearer and Origin, omits cookies, and never auto-retries", async () => {
  const requests = [],
    token = "m_" + "c".repeat(64);
  const client = mobileClient("https://api.example", {
    fetcher: async (url, options) => {
      requests.push({ url, options });
      return Response.json({ saved: true });
    },
  });
  client.setToken(token);
  await client.request("paper/orders", {
    method: "POST",
    body: { quantity: 1 },
    key: "order-intent-123",
  });
  assert.equal(requests.length, 1);
  const { url, options } = requests[0];
  assert.equal(url, "https://api.example/api/v1/paper/orders");
  assert.ok(!url.includes(token));
  assert.equal(options.credentials, "omit");
  assert.equal(options.headers.Origin, "https://api.example");
  assert.equal(options.headers.Authorization, "Bearer " + token);
  assert.equal(options.headers["idempotency-key"], "order-intent-123");
  assert.equal(options.headers.cookie, undefined);
  await assert.rejects(client.request("https://other.example/steal"));
  await assert.rejects(client.request("../steal"));
  assert.equal(requests.length, 1);
  let failed = 0;
  const offline = mobileClient("https://api.example", {
    fetcher: async () => {
      failed++;
      throw new Error("connection lost");
    },
  });
  await assert.rejects(
    offline.request("paper/orders", { method: "POST", body: {} }),
    /mobile_network_error/,
  );
  assert.equal(failed, 1);
});
test("revocation clears the matching session; permission errors preserve it", async () => {
  let expired = 0,
    status = 403;
  const headers = [],
    client = mobileClient("https://api.example", {
      onUnauthorized: () => expired++,
      fetcher: async (_, options) => {
        headers.push(options.headers.Authorization);
        return Response.json(
          { code: status === 401 ? "authentication_required" : "forbidden" },
          { status },
        );
      },
    });
  const token = "m_" + "d".repeat(64);
  client.setToken(token);
  await assert.rejects(client.request("journal"));
  assert.equal(expired, 0);
  status = 401;
  await assert.rejects(client.request("journal"));
  assert.equal(expired, 1);
  await assert.rejects(client.request("journal"));
  assert.equal(headers.at(-1), undefined);
  assert.equal(expired, 1);
  assert.throws(() => client.setToken("web-cookie"));
});
test("mutations retain an idempotency key across unknown outcomes until acknowledged", () => {
  let index = 0;
  const intents = mutationIntents(() => "intent-" + ++index),
    body = { quantity: 1 };
  assert.equal(
    intents.key("order", body),
    intents.key("order", { quantity: 1 }),
  );
  assert.notEqual(intents.key("close", body), intents.key("order", body));
  assert.notEqual(intents.key("order", { quantity: 2 }), "intent-1");
  const prior = intents.key("order", body);
  intents.done("order");
  assert.notEqual(intents.key("order", body), prior);
});
test("web login intent stores only a validated request identifier and expires", () => {
  const values = new Map(),
    storage = {
      setItem: (key, value) => values.set(key, value),
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
    };
  const id = "11111111-1111-4111-8111-111111111111";
  rememberMobileRequest(storage, id);
  assert.equal(consumeMobileRequest(storage), id);
  assert.equal(consumeMobileRequest(storage), null);
  rememberMobileRequest(storage, "https://attacker.example");
  assert.equal(values.size, 0);
  rememberMobileRequest(storage, id, 1000);
  assert.equal(consumeMobileRequest(storage, 301001), null);
});
