import { nextTime } from "../market/providers.mjs";

export function researchFrames(timeframe, mode) {
  if (mode !== "deep") return [timeframe];
  const context = {
    "1m": ["15m", "1h"],
    "3m": ["15m", "1h"],
    "5m": ["1h", "4h"],
    "15m": ["1h", "4h"],
    "30m": ["4h", "1d"],
    "1h": ["4h", "1d"],
    "2h": ["1d", "1w"],
    "4h": ["1d", "1w"],
    "6h": ["1d", "1w"],
    "12h": ["1d", "1w"],
    "1d": ["1w", "1M"],
    "1w": ["1d", "1M"],
    "1M": ["1d", "1w"],
  };
  return [...new Set([timeframe, ...(context[timeframe] || [])])];
}

export function closedBars(candles, timeframe, now = Date.now()) {
  const rows = new Map();
  for (const c of candles) {
    if (
      !c.closed ||
      ![c.timestamp, c.open, c.high, c.low, c.close, c.volume].every(
        Number.isFinite,
      ) ||
      c.timestamp < 0 ||
      c.low <= 0 ||
      c.volume < 0 ||
      c.high < Math.max(c.open, c.close, c.low) ||
      c.low > Math.min(c.open, c.close) ||
      nextTime(c.timestamp, timeframe) > now
    )
      continue;
    rows.set(c.timestamp, c);
  }
  return [...rows.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export function frameEvidence(
  candles,
  timeframe,
  indicators,
  now = Date.now(),
) {
  const c = closedBars(candles, timeframe, now),
    last = c.at(-1);
  let gaps = 0;
  const recent = c.slice(-80);
  for (let n = 1; n < recent.length; n++)
    if (nextTime(recent[n - 1].timestamp, timeframe) !== recent[n].timestamp)
      gaps++;
  const ema = indicators.EMA || {};
  const trend = [ema[20], ema[50], ema[200], indicators.price].every(
    (x) => Number.isFinite(x) && x > 0,
  )
    ? indicators.price > ema[20] && ema[20] > ema[50] && ema[50] > ema[200]
      ? "bullish"
      : indicators.price < ema[20] && ema[20] < ema[50] && ema[50] < ema[200]
        ? "bearish"
        : "mixed"
    : "unknown";
  const pct = (n) =>
    c.length > n ? (last.close / c.at(-1 - n).close - 1) * 100 : null;
  const previousVolume = c.slice(-21, -1);
  const averageVolume =
    previousVolume.length === 20
      ? previousVolume.reduce((s, b) => s + b.volume, 0) / 20
      : null;
  const closes = c.slice(-21);
  const returns = closes
    .slice(1)
    .map((b, n) => Math.log(b.close / closes[n].close));
  const mean = returns.length
    ? returns.reduce((s, x) => s + x, 0) / returns.length
    : 0;
  return {
    timeframe,
    closedBars: c.length,
    warmup: c.length < 200,
    gaps,
    lastCloseAt: last
      ? new Date(nextTime(last.timestamp, timeframe)).toISOString()
      : null,
    ageSeconds: last
      ? Math.max(0, (now - nextTime(last.timestamp, timeframe)) / 1000)
      : null,
    trend,
    rsi: indicators.RSI ?? null,
    adx: indicators.ADX?.adx ?? null,
    atrPct:
      last && Number.isFinite(indicators.ATR)
        ? (indicators.ATR / last.close) * 100
        : null,
    volumeRatio20: averageVolume > 0 ? last.volume / averageVolume : null,
    returnPct: { oneBar: pct(1), fiveBars: pct(5), twentyBars: pct(20) },
    volatilityPerBarPct:
      returns.length === 20
        ? Math.sqrt(
            returns.reduce((s, x) => s + (x - mean) ** 2, 0) /
              (returns.length - 1),
          ) * 100
        : null,
    vwapDistancePct:
      last && indicators.VWAP > 0
        ? (last.close / indicators.VWAP - 1) * 100
        : null,
  };
}

export function executionEvidence(book, market, now = Date.now()) {
  if (
    !book ||
    !Number.isFinite(book.timestamp) ||
    now - book.timestamp > 15000 ||
    now < book.timestamp
  )
    return { available: false, reason: "orderbook_unavailable_or_stale" };
  const clean = (rows) =>
    (rows || []).filter(
      (r) =>
        r.length >= 2 &&
        r.slice(0, 2).every((x) => Number.isFinite(x) && x > 0),
    );
  const bids = clean(book.bids).sort((a, b) => b[0] - a[0]),
    asks = clean(book.asks).sort((a, b) => a[0] - b[0]);
  if (!bids.length || !asks.length || bids[0][0] >= asks[0][0])
    return { available: false, reason: "invalid_orderbook" };
  const bid = bids[0][0],
    ask = asks[0][0],
    mid = (bid + ask) / 2;
  const bidSize = bids.reduce((s, r) => s + r[1], 0),
    askSize = asks.reduce((s, r) => s + r[1], 0);
  return {
    available: true,
    source: book.source,
    observedAt: new Date(book.timestamp).toISOString(),
    bestBid: bid,
    bestAsk: ask,
    mid,
    spreadBps: ((ask - bid) / mid) * 10000,
    displayedImbalance: (bidSize - askSize) / (bidSize + askSize),
    bidNotional:
      market === "spot" ? bids.reduce((s, r) => s + r[0] * r[1], 0) : null,
    askNotional:
      market === "spot" ? asks.reduce((s, r) => s + r[0] * r[1], 0) : null,
    note: "Visible levels only; cancellable liquidity, not executed order flow. Perpetual quantity units are venue-specific.",
  };
}

export function alignedCorrelation(candles, benchmark) {
  const pairs = new Map(benchmark.map((c) => [c.timestamp, c.close]));
  const rows = candles.filter((c) => pairs.has(c.timestamp)).slice(-61);
  if (rows.length < 21) return { value: null, samples: 0 };
  const a = [],
    b = [];
  for (let n = 1; n < rows.length; n++) {
    a.push(Math.log(rows[n].close / rows[n - 1].close));
    b.push(
      Math.log(pairs.get(rows[n].timestamp) / pairs.get(rows[n - 1].timestamp)),
    );
  }
  const avg = (x) => x.reduce((s, v) => s + v, 0) / x.length,
    ma = avg(a),
    mb = avg(b);
  let numerator = 0,
    va = 0,
    vb = 0;
  a.forEach((v, n) => {
    numerator += (v - ma) * (b[n] - mb);
    va += (v - ma) ** 2;
    vb += (b[n] - mb) ** 2;
  });
  return {
    value:
      va > 0 && vb > 0
        ? Math.max(-1, Math.min(1, numerator / Math.sqrt(va * vb)))
        : null,
    samples: a.length,
  };
}

export function setupMetrics(result, research) {
  if (!result?.setups) return [];
  const spread = research?.execution?.available
    ? research.execution.spreadBps
    : null;
  return result.setups
    .filter((s) => s.direction !== "NO_TRADE")
    .map((s) => {
      const entry = s.entry.price,
        risk = Math.abs(entry - s.stop_loss);
      const reward = s.take_profits.reduce(
        (sum, t) => sum + (Math.abs(t.price - entry) * t.size_pct) / 100,
        0,
      );
      // Explicit comparison assumptions, not a provider fee quote or fill simulation.
      const costBps = 20 + 10 + (spread ?? 0),
        cost = (entry * costBps) / 10000;
      return {
        direction: s.direction,
        grossRR: reward / risk,
        netRR: (reward - cost) / (risk + cost),
        stopDistancePct: (risk / entry) * 100,
        breakEvenWinRatePct: ((risk + cost) / (risk + reward)) * 100,
        assumedRoundTripCostBps: costBps,
        spreadIncluded: spread !== null,
        positiveAfterCosts: reward > cost,
      };
    });
}
