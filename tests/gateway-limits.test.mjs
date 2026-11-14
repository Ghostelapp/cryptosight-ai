import { test } from "node:test";
import assert from "node:assert/strict";
import { createConnectionLimiter } from "../services/gateway/connection-limits.mjs";

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
