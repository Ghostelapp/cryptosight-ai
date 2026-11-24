import { closedBars, frameEvidence, setupMetrics } from "./evidence.mjs";
import { nextTime } from "../market/providers.mjs";

export function confirmationFrame(frame) {
  return {
    "1m": "15m",
    "3m": "15m",
    "5m": "1h",
    "15m": "1h",
    "30m": "4h",
    "1h": "4h",
    "2h": "1d",
    "4h": "1d",
    "6h": "1d",
    "12h": "1d",
    "1d": "1w",
    "1w": "1M",
    "1M": "1w",
  }[frame];
}

// Transparent research rules, never a probability or an executable order.
export function evaluateCandidate({
  instrument,
  primary,
  confirmation,
  indicators,
  confirmationIndicators,
  volume,
  now = Date.now(),
}) {
  const rows = closedBars(primary.candles, instrument.timeframe, now),
    higher = closedBars(
      confirmation.candles,
      confirmationFrame(instrument.timeframe),
      now,
    );
  if (
    rows.length < 200 ||
    higher.length < 60 ||
    primary.provenance?.stale ||
    confirmation.provenance?.stale
  )
    return null;
  const last = rows.at(-1),
    previous = rows.slice(-21, -1),
    stats = frameEvidence(rows, instrument.timeframe, indicators, now);
  const confirmationStats = frameEvidence(
    higher,
    confirmationFrame(instrument.timeframe),
    confirmationIndicators,
    now,
  );
  if (
    confirmationStats.gaps ||
    now >=
      nextTime(
        nextTime(
          higher.at(-1).timestamp,
          confirmationFrame(instrument.timeframe),
        ),
        confirmationFrame(instrument.timeframe),
      )
  )
    return null;
  if (
    stats.gaps ||
    now >=
      nextTime(
        nextTime(last.timestamp, instrument.timeframe),
        instrument.timeframe,
      )
  )
    return null;
  const ema = indicators.EMA || {},
    h = confirmationIndicators.EMA || {},
    hp = higher.at(-1).close;
  const direction =
    last.close > ema[20] && ema[20] > ema[50] && ema[50] > ema[200]
      ? "LONG"
      : last.close < ema[20] && ema[20] < ema[50] && ema[50] < ema[200]
        ? "SHORT"
        : null;
  if (!direction || !Number.isFinite(indicators.ATR) || !(indicators.ATR > 0))
    return null;
  const long = direction === "LONG",
    higherAligned = long
      ? hp > h[50] && h[20] > h[50]
      : hp < h[50] && h[20] < h[50];
  if (!higherAligned) return null;
  const momentum =
    Number.isFinite(indicators.MACD?.histogram) &&
    (long ? indicators.MACD.histogram > 0 : indicators.MACD.histogram < 0);
  const rsi =
    Number.isFinite(indicators.RSI) &&
    (long
      ? indicators.RSI >= 45 && indicators.RSI <= 70
      : indicators.RSI >= 30 && indicators.RSI <= 55);
  const adx = Number.isFinite(indicators.ADX?.adx) && indicators.ADX.adx >= 18;
  const volumeExpansion = stats.volumeRatio20 >= 1.2;
  const atrPct = (indicators.ATR / last.close) * 100,
    volatility = atrPct >= 0.2 && atrPct <= 6;
  const breakout = long
    ? last.close > Math.max(...previous.map((b) => b.high))
    : last.close < Math.min(...previous.map((b) => b.low));
  const pullback =
    Math.abs(last.close - ema[20]) <= indicators.ATR * 0.8 &&
    (long
      ? last.low <= ema[20] && last.close > last.open
      : last.high >= ema[20] && last.close < last.open);
  const score = Math.round(
    35 +
      (rsi
        ? Math.max(0, 15 - Math.abs(indicators.RSI - (long ? 58 : 42)) * 0.8)
        : 0) +
      (adx ? Math.min(15, 5 + (indicators.ADX.adx - 18) * 0.5) : 0) +
      Math.min(15, Math.max(0, stats.volumeRatio20 || 0) * 6) +
      (momentum ? 10 : 0) +
      (breakout ? 5 : pullback ? 3 : 0) +
      (volatility ? 5 : 0),
  );
  const unmet = [
    ...(!momentum ? ["momentum"] : []),
    ...(!rsi ? ["rsi"] : []),
    ...(!adx ? ["trend_strength"] : []),
    ...(!volumeExpansion ? ["volume"] : []),
    ...(!volatility ? ["volatility"] : []),
    ...(!breakout && !pullback ? ["pattern"] : []),
  ];
  const base = {
    ...instrument,
    direction,
    score,
    scoreType: "rule_confluence_not_probability",
    price: last.close,
    volume,
    confirmationTimeframe: confirmationFrame(instrument.timeframe),
    rsi: indicators.RSI,
    adx: indicators.ADX?.adx,
    atrPct,
    volumeRatio20: stats.volumeRatio20,
    observedAt: new Date(
      nextTime(last.timestamp, instrument.timeframe),
    ).toISOString(),
    expiresAt: new Date(
      nextTime(
        nextTime(last.timestamp, instrument.timeframe),
        instrument.timeframe,
      ),
    ).toISOString(),
    pattern: breakout ? "breakout" : pullback ? "pullback" : null,
    unmet,
  };
  if (unmet.length) return { ...base, status: "watch" };
  const entry = long ? last.high : last.low;
  const swing = long
    ? Math.min(...rows.slice(-5).map((b) => b.low))
    : Math.max(...rows.slice(-5).map((b) => b.high));
  const stop = long
    ? Math.min(swing, entry - 1.2 * indicators.ATR)
    : Math.max(swing, entry + 1.2 * indicators.ATR);
  const risk = Math.abs(entry - stop),
    stopPct = (risk / entry) * 100;
  if (stopPct < 0.3 || stopPct > 6)
    return { ...base, status: "watch", unmet: ["stop_distance"] };
  const targets = [1.5, 2.5].map((r) => ({
    price: entry + (long ? 1 : -1) * risk * r,
    size_pct: 50,
  }));
  const setup = {
    direction,
    entry: { price: entry },
    stop_loss: stop,
    take_profits: targets,
  };
  const metrics = setupMetrics({ setups: [setup] }, {})[0];
  if (metrics.netRR < 1.2)
    return { ...base, status: "watch", unmet: ["costs"] };
  return {
    ...base,
    status: "wait_confirmation",
    trigger: {
      type: long ? "candle_close_above" : "candle_close_below",
      price: entry,
      timeframe: instrument.timeframe,
    },
    stop,
    targets,
    netRR: metrics.netRR,
    assumedRoundTripCostBps: metrics.assumedRoundTripCostBps,
    spreadIncluded: false,
  };
}
