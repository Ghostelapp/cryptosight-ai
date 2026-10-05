import * as ti from "technicalindicators";
const last = (a) => (a.length ? a.at(-1) : null);
function calc(name, input) {
  try {
    return last(ti[name].calculate(input));
  } catch {
    return null;
  }
}
export function indicators(candles, config = {}) {
  const c = candles.filter((c) => c.closed),
    close = c.map((c) => c.close),
    high = c.map((c) => c.high),
    low = c.map((c) => c.low),
    volume = c.map((c) => c.volume);
  if (!c.length) return { warmup: true, bars: 0 };
  const period = Math.max(2, Math.min(200, Number(config.period) || 14));
  const result = {
    bars: c.length,
    closedAt: c.at(-1).timestamp,
    warmup: c.length < 200,
    parameters: { period },
    price: last(close),
  };
  for (const name of ["EMA", "SMA", "WMA"])
    result[name] = Object.fromEntries(
      [20, 50, 100, 200].map((period) => [
        period,
        calc(name, { period, values: close }),
      ]),
    );
  Object.assign(result, {
    RSI: calc("RSI", { period, values: close }),
    MACD: calc("MACD", {
      values: close,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    }),
    ATR: calc("ATR", { high, low, close, period }),
    ADX: calc("ADX", { high, low, close, period }),
    CCI: calc("CCI", { high, low, close, period: 20 }),
    WilliamsR: calc("WilliamsR", { high, low, close, period }),
    MFI: calc("MFI", { high, low, close, volume, period }),
    StochasticRSI: calc("StochasticRSI", {
      values: close,
      rsiPeriod: period,
      stochasticPeriod: period,
      kPeriod: 3,
      dPeriod: 3,
    }),
    BollingerBands: calc("BollingerBands", {
      values: close,
      period: 20,
      stdDev: 2,
    }),
    OBV: calc("OBV", { close, volume }),
    PSAR: calc("PSAR", { high, low, step: 0.02, max: 0.2 }),
    Ichimoku: calc("IchimokuCloud", {
      high,
      low,
      conversionPeriod: 9,
      basePeriod: 26,
      spanPeriod: 52,
      displacement: 26,
    }),
    Keltner: calc("KeltnerChannels", {
      high,
      low,
      close,
      maPeriod: 20,
      atrPeriod: 10,
      useSMA: false,
      multiplier: 2,
    }),
    Donchian:
      c.length >= 20
        ? {
            upper: Math.max(...high.slice(-20)),
            lower: Math.min(...low.slice(-20)),
          }
        : null,
  });
  const day = new Date(c.at(-1).timestamp).toISOString().slice(0, 10),
    session = c.filter((x) =>
      new Date(x.timestamp).toISOString().startsWith(day),
    );
  let sum = 0,
    vol = 0;
  for (const b of session) {
    sum += ((b.high + b.low + b.close) / 3) * b.volume;
    vol += b.volume;
  }
  result.VWAP = vol ? sum / vol : null;
  result.CVD = {
    value: null,
    reason:
      "Requires classified trade feed; candle volume cannot establish aggressor direction",
  };
  const atr = ti.ATR.calculate({ high, low, close, period: 10 });
  let upper = 0,
    lower = 0,
    trend = 1,
    value = null;
  for (let j = 10; j < c.length; j++) {
    const a = atr[j - 10];
    if (!Number.isFinite(a)) continue;
    const b = c[j],
      u = (b.high + b.low) / 2 + 3 * a,
      l = (b.high + b.low) / 2 - 3 * a;
    upper = j === 10 ? u : u < upper || c[j - 1].close > upper ? u : upper;
    lower = j === 10 ? l : l > lower || c[j - 1].close < lower ? l : lower;
    if (trend === 1 && b.close < lower) trend = -1;
    else if (trend === -1 && b.close > upper) trend = 1;
    value = trend === 1 ? lower : upper;
  }
  result.Supertrend = value == null ? null : { value, trend };
  result.structure = structure(c);
  result.volumeProfile = volumeProfile(c);
  result.patterns = patterns(c);
  result.divergences = divergences(c);
  return result;
}
export function structure(c) {
  const highs = [],
    lows = [],
    fvg = [],
    blocks = [];
  for (let j = 2; j < c.length - 2; j++) {
    const x = c[j],
      window = c.slice(j - 2, j + 3);
    if (window.every((b) => b.high <= x.high))
      highs.push({ price: x.high, timestamp: x.timestamp, index: j });
    if (window.every((b) => b.low >= x.low))
      lows.push({ price: x.low, timestamp: x.timestamp, index: j });
  }
  for (let j = 2; j < c.length; j++) {
    if (c[j].low > c[j - 2].high)
      fvg.push({
        direction: "bullish",
        low: c[j - 2].high,
        high: c[j].low,
        timestamp: c[j].timestamp,
      });
    if (c[j].high < c[j - 2].low)
      fvg.push({
        direction: "bearish",
        low: c[j].high,
        high: c[j - 2].low,
        timestamp: c[j].timestamp,
      });
    const p = c[j - 1],
      b = c[j];
    if (
      p.close < p.open &&
      b.close > p.high &&
      b.close - b.open > (p.high - p.low) * 1.5
    )
      blocks.push({
        direction: "bullish",
        low: p.low,
        high: p.high,
        timestamp: p.timestamp,
      });
    if (
      p.close > p.open &&
      b.close < p.low &&
      b.open - b.close > (p.high - p.low) * 1.5
    )
      blocks.push({
        direction: "bearish",
        low: p.low,
        high: p.high,
        timestamp: p.timestamp,
      });
  }
  const h = highs.slice(-2),
    l = lows.slice(-2);
  const state =
    h.length === 2 && l.length === 2
      ? h[1].price > h[0].price && l[1].price > l[0].price
        ? "HH/HL"
        : h[1].price < h[0].price && l[1].price < l[0].price
          ? "LH/LL"
          : "mixed"
      : "unknown";
  const price = c.at(-1)?.close,
    prev = c.at(-2)?.close;
  let event = null;
  if (h.length && price > h.at(-1).price && prev <= h.at(-1).price)
    event = state === "LH/LL" ? "CHoCH_up" : "BOS_up";
  if (l.length && price < l.at(-1).price && prev >= l.at(-1).price)
    event = state === "HH/HL" ? "CHoCH_down" : "BOS_down";
  return {
    algorithm: "confirmed-2-bar-pivots-v1",
    state,
    event,
    support: lows.slice(-8),
    resistance: highs.slice(-8),
    fairValueGaps: fvg.slice(-10),
    orderBlocks: blocks.slice(-6),
    liquidityZones: [...highs.slice(-4), ...lows.slice(-4)].map((x) => ({
      low: x.price * 0.999,
      high: x.price * 1.001,
    })),
    note: "Heuristic structure; order blocks and liquidity are inferred, not observed orders",
  };
}
export function volumeProfile(c, bins = 32) {
  if (!c.length) return null;
  const low = Math.min(...c.map((x) => x.low)),
    high = Math.max(...c.map((x) => x.high));
  if (high === low) return null;
  const step = (high - low) / bins,
    profile = Array(bins).fill(0);
  for (const b of c) {
    const j = Math.min(
      bins - 1,
      Math.max(0, Math.floor(((b.high + b.low + b.close) / 3 - low) / step)),
    );
    profile[j] += b.volume;
  }
  const total = profile.reduce((a, b) => a + b, 0);
  if (!total) return null;
  let lo = profile.indexOf(Math.max(...profile)),
    hi = lo,
    amount = profile[lo];
  while (amount < total * 0.7 && (lo > 0 || hi < bins - 1)) {
    if (lo > 0 && (hi === bins - 1 || profile[lo - 1] > profile[hi + 1]))
      amount += profile[--lo];
    else amount += profile[++hi];
  }
  return {
    POC: low + (profile.indexOf(Math.max(...profile)) + 0.5) * step,
    VAL: low + lo * step,
    VAH: low + (hi + 1) * step,
    bins: profile,
    low,
    high,
    approximate: true,
    note: "OHLCV typical-price approximation; not trade-level volume profile",
  };
}
export function patterns(c) {
  if (c.length < 2) return [];
  const p = c.at(-2),
    b = c.at(-1),
    body = Math.abs(b.close - b.open),
    range = b.high - b.low,
    out = [];
  if (range && body / range < 0.1) out.push("doji");
  if (
    body &&
    Math.min(b.open, b.close) - b.low > body * 2 &&
    b.high - Math.max(b.open, b.close) < body
  )
    out.push("hammer");
  if (
    p.close < p.open &&
    b.close > b.open &&
    b.open <= p.close &&
    b.close >= p.open
  )
    out.push("bullish_engulfing");
  if (
    p.close > p.open &&
    b.close < b.open &&
    b.open >= p.close &&
    b.close <= p.open
  )
    out.push("bearish_engulfing");
  return out;
}
export function divergences(c) {
  if (c.length < 40) return [];
  const r = ti.RSI.calculate({ period: 14, values: c.map((b) => b.close) }),
    offset = c.length - r.length,
    ps = structure(c),
    out = [];
  for (const [points, kind] of [
    [ps.support, "bullish"],
    [ps.resistance, "bearish"],
  ]) {
    if (points.length < 2) continue;
    const [a, b] = points.slice(-2),
      ra = r[a.index - offset],
      rb = r[b.index - offset];
    if (
      Number.isFinite(ra) &&
      Number.isFinite(rb) &&
      (kind === "bullish"
        ? b.price < a.price && rb > ra
        : b.price > a.price && rb < ra)
    )
      out.push({
        indicator: "RSI",
        direction: kind,
        from: a.timestamp,
        to: b.timestamp,
      });
  }
  const macd = ti.MACD.calculate({
      values: c.map((b) => b.close),
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    }),
    mo = c.length - macd.length;
  for (const [points, kind] of [
    [ps.support, "bullish"],
    [ps.resistance, "bearish"],
  ]) {
    if (points.length < 2) continue;
    const [a, b] = points.slice(-2),
      ma = macd[a.index - mo]?.MACD,
      mb = macd[b.index - mo]?.MACD;
    if (
      Number.isFinite(ma) &&
      Number.isFinite(mb) &&
      (kind === "bullish"
        ? b.price < a.price && mb > ma
        : b.price > a.price && mb < ma)
    )
      out.push({
        indicator: "MACD",
        direction: kind,
        from: a.timestamp,
        to: b.timestamp,
      });
  }
  return out;
}
export function heikinAshi(c) {
  let po = null,
    pc = null;
  return c.map((b) => {
    const close = (b.open + b.high + b.low + b.close) / 4,
      open = po === null ? (b.open + b.close) / 2 : (po + pc) / 2;
    po = open;
    pc = close;
    return {
      ...b,
      open,
      close,
      high: Math.max(b.high, open, close),
      low: Math.min(b.low, open, close),
    };
  });
}
