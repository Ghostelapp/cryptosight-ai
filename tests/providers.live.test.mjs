import { test } from "node:test";
import assert from "node:assert/strict";
import { history, depth } from "../packages/market/providers.mjs";
for (const venue of ["binance", "bybit", "okx"])
  test(
    `live provider ${venue}: closed OHLCV and depth`,
    { skip: process.env.RUN_LIVE_TESTS !== "true" },
    async () => {
      const d = await history(
        { venue, symbol: "BTCUSDT", market: "spot", timeframe: "1h" },
        { limit: 80 },
      );
      assert.ok(d.candles.length >= 50);
      assert.ok(d.candles.every((c) => c.low <= c.open && c.high >= c.close));
      assert.ok(!d.provenance.stale);
      const b = await depth({ venue, symbol: "BTCUSDT", market: "spot" });
      assert.ok(b.bids[0][0] < b.asks[0][0]);
    },
  );
