export const frames = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "12h",
  "1d",
  "1w",
  "1M",
];
export const venues = ["binance", "bybit", "okx"];
export function validateInstrument({
  venue = "binance",
  market = "spot",
  symbol = "BTCUSDT",
  timeframe = "1h",
} = {}) {
  if (
    !venues.includes(venue) ||
    !["spot", "perpetual"].includes(market) ||
    !frames.includes(timeframe) ||
    !/^[A-Z0-9]{2,20}USDT$/.test(symbol)
  )
    throw new Error("invalid_instrument");
  return { venue, market, symbol, timeframe };
}
export const intervalMs = (f) =>
  f === "1M"
    ? null
    : { m: 60000, h: 3600000, d: 86400000, w: 604800000 }[f.slice(-1)] *
      Number(f.slice(0, -1));
export function nextTime(t, f) {
  if (f === "1M") {
    const d = new Date(t);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }
  return t + intervalMs(f);
}
export function okxId(symbol, market) {
  return (
    symbol.replace(/USDT$/, "-USDT") + (market === "perpetual" ? "-SWAP" : "")
  );
}
export function providerFrame(venue, f) {
  if (venue === "bybit")
    return (
      { "1d": "D", "1w": "W", "1M": "M" }[f] || String(intervalMs(f) / 60000)
    );
  if (venue === "okx")
    return (
      {
        "1h": "1H",
        "2h": "2H",
        "4h": "4H",
        "6h": "6Hutc",
        "12h": "12Hutc",
        "1d": "1Dutc",
        "1w": "1Wutc",
        "1M": "1Mutc",
      }[f] || f
    );
  return f;
}
export async function jsonFetch(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    signal: options.signal || AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`provider_http_${r.status}`);
  const v = await r.json();
  if (
    (v.retCode && v.retCode !== 0) ||
    (v.code && v.code !== "0" && v.code !== 0)
  )
    throw new Error("provider_error");
  return v;
}
export function normalizeRows(venue, rows, f, now = Date.now()) {
  return rows
    .map((r) => ({
      timestamp: +r[0],
      open: +r[1],
      high: +r[2],
      low: +r[3],
      close: +r[4],
      volume: +r[5],
      closed: venue === "okx" ? r[8] === "1" : nextTime(+r[0], f) <= now,
    }))
    .filter(
      (c) =>
        Object.values(c).every(
          (x) => typeof x !== "number" || Number.isFinite(x),
        ) &&
        c.high >= c.low &&
        c.low > 0 &&
        c.volume >= 0,
    )
    .sort((a, b) => a.timestamp - b.timestamp);
}
export async function history(
  input,
  { from, to = Date.now(), limit = 500 } = {},
) {
  const i = validateInstrument(input);
  limit = Math.max(1, Math.min(3000, limit));
  let cursor = to,
    rows = [];
  for (let page = 0; page < Math.ceil(limit / 300) + 1; page++) {
    let data;
    const f = providerFrame(i.venue, i.timeframe);
    if (i.venue === "binance") {
      const base =
        i.market === "spot"
          ? "https://api.binance.com/api/v3"
          : "https://fapi.binance.com/fapi/v1";
      data = await jsonFetch(
        `${base}/klines?symbol=${i.symbol}&interval=${f}&limit=${Math.min(300, limit - rows.length)}&endTime=${cursor}`,
      );
    } else if (i.venue === "bybit") {
      data = (
        await jsonFetch(
          `https://api.bybit.com/v5/market/kline?category=${i.market === "spot" ? "spot" : "linear"}&symbol=${i.symbol}&interval=${f}&limit=${Math.min(300, limit - rows.length)}&end=${cursor}`,
        )
      ).result.list;
    } else {
      data = (
        await jsonFetch(
          `https://www.okx.com/api/v5/market/history-candles?instId=${okxId(i.symbol, i.market)}&bar=${f}&limit=${Math.min(300, limit - rows.length)}&after=${cursor + 1}`,
        )
      ).data;
    }
    if (!data.length) break;
    const chunk = normalizeRows(i.venue, data, i.timeframe);
    rows.push(...chunk);
    const oldest = Math.min(...chunk.map((c) => c.timestamp));
    if (
      !chunk.length ||
      oldest >= cursor ||
      rows.length >= limit ||
      (from && oldest <= from)
    )
      break;
    cursor = oldest - 1;
  }
  const unique = [...new Map(rows.map((c) => [c.timestamp, c])).values()]
    .sort((a, b) => a.timestamp - b.timestamp)
    .filter((c) => !from || c.timestamp >= from)
    .slice(-limit);
  return {
    instrument: i,
    candles: unique,
    provenance: {
      source: i.venue,
      fetchedAt: new Date().toISOString(),
      observedAt: unique.length
        ? new Date(unique.at(-1).timestamp).toISOString()
        : null,
      stale:
        !unique.length ||
        nextTime(unique.at(-1).timestamp, i.timeframe) + 60000 < Date.now(),
    },
  };
}
export async function tickers(venue = "binance", market = "spot") {
  if (!venues.includes(venue) || !["spot", "perpetual"].includes(market))
    throw new Error("invalid_instrument");
  let rows;
  if (venue === "binance") {
    rows = await jsonFetch(
      `https://${market === "spot" ? "api" : "fapi"}.binance.com/${market === "spot" ? "api/v3" : "fapi/v1"}/ticker/24hr`,
    );
    return rows
      .filter((r) => r.symbol.endsWith("USDT"))
      .map((r) => ({
        symbol: r.symbol,
        price: +r.lastPrice,
        change: +r.priceChangePercent,
        volume: +r.quoteVolume,
      }));
  }
  if (venue === "bybit") {
    rows = (
      await jsonFetch(
        `https://api.bybit.com/v5/market/tickers?category=${market === "spot" ? "spot" : "linear"}`,
      )
    ).result.list;
    return rows
      .filter((r) => r.symbol.endsWith("USDT"))
      .map((r) => ({
        symbol: r.symbol,
        price: +r.lastPrice,
        change: +r.price24hPcnt * 100,
        volume: +r.turnover24h,
      }));
  }
  rows = (
    await jsonFetch(
      `https://www.okx.com/api/v5/market/tickers?instType=${market === "spot" ? "SPOT" : "SWAP"}`,
    )
  ).data;
  return rows
    .filter((r) => /-USDT(-SWAP)?$/.test(r.instId))
    .map((r) => ({
      symbol: r.instId.replace("-SWAP", "").replace("-", ""),
      price: +r.last,
      change: (+r.last / +r.open24h - 1) * 100,
      volume: +r.volCcy24h * (market === "spot" ? 1 : +r.last),
    }));
}
export async function depth(input) {
  const i = validateInstrument(input);
  let d;
  if (i.venue === "binance") {
    d = await jsonFetch(
      `https://${i.market === "spot" ? "api" : "fapi"}.binance.com/${i.market === "spot" ? "api/v3" : "fapi/v1"}/depth?symbol=${i.symbol}&limit=20`,
    );
  } else if (i.venue === "bybit") {
    const r = (
      await jsonFetch(
        `https://api.bybit.com/v5/market/orderbook?category=${i.market === "spot" ? "spot" : "linear"}&symbol=${i.symbol}&limit=25`,
      )
    ).result;
    d = { bids: r.b, asks: r.a };
  } else {
    d = (
      await jsonFetch(
        `https://www.okx.com/api/v5/market/books?instId=${okxId(i.symbol, i.market)}&sz=20`,
      )
    ).data[0];
  }
  return {
    bids: d.bids.map((r) => [+r[0], +r[1]]),
    asks: d.asks.map((r) => [+r[0], +r[1]]),
    timestamp: Date.now(),
    source: i.venue,
  };
}
export async function derivatives(input) {
  const i = validateInstrument(input);
  if (i.market === "spot")
    return { value: null, unavailableReason: "spot_market", source: i.venue };
  try {
    if (i.venue === "binance") {
      const [f, o, l] = await Promise.all([
        jsonFetch(
          `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${i.symbol}`,
        ),
        jsonFetch(
          `https://fapi.binance.com/fapi/v1/openInterest?symbol=${i.symbol}`,
        ),
        jsonFetch(
          `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${i.symbol}&period=1h&limit=1`,
        ),
      ]);
      return {
        value: {
          funding: +f.lastFundingRate,
          openInterest: +o.openInterest,
          longShortRatio: +l[0]?.longShortRatio,
        },
        source: i.venue,
        observedAt: new Date().toISOString(),
      };
    }
    if (i.venue === "bybit") {
      const r = (
        await jsonFetch(
          `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${i.symbol}`,
        )
      ).result.list[0];
      return {
        value: {
          funding: +r.fundingRate,
          openInterest: +r.openInterest,
          longShortRatio: null,
        },
        source: i.venue,
        observedAt: new Date().toISOString(),
      };
    }
    const [f, o] = await Promise.all([
      jsonFetch(
        `https://www.okx.com/api/v5/public/funding-rate?instId=${okxId(i.symbol, i.market)}`,
      ),
      jsonFetch(
        `https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=${okxId(i.symbol, i.market)}`,
      ),
    ]);
    return {
      value: {
        funding: +f.data[0].fundingRate,
        openInterest: +o.data[0].oi,
        longShortRatio: null,
      },
      source: i.venue,
      observedAt: new Date().toISOString(),
    };
  } catch {
    return {
      value: null,
      unavailableReason: "provider_unavailable",
      source: i.venue,
    };
  }
}
export function streamConfig(input) {
  const i = validateInstrument(input),
    f = providerFrame(i.venue, i.timeframe);
  if (i.venue === "binance")
    return {
      url: `${i.market === "spot" ? "wss://stream.binance.com:9443" : "wss://fstream.binance.com"}/ws/${i.symbol.toLowerCase()}@kline_${f}`,
      subscribe: null,
    };
  if (i.venue === "bybit")
    return {
      url: `wss://stream.bybit.com/v5/public/${i.market === "spot" ? "spot" : "linear"}`,
      subscribe: { op: "subscribe", args: [`kline.${f}.${i.symbol}`] },
    };
  return {
    url: "wss://ws.okx.com/ws/v5/business",
    subscribe: {
      op: "subscribe",
      args: [{ channel: `candle${f}`, instId: okxId(i.symbol, i.market) }],
    },
  };
}
export function parseStream(venue, message) {
  const d = typeof message === "string" ? JSON.parse(message) : message;
  if (venue === "binance" && d.k) {
    const k = d.k;
    return {
      timestamp: k.t,
      open: +k.o,
      high: +k.h,
      low: +k.l,
      close: +k.c,
      volume: +k.v,
      closed: k.x,
    };
  }
  if (venue === "bybit" && d.topic?.startsWith("kline.") && d.data?.length) {
    const k = d.data[0];
    return {
      timestamp: +k.start,
      open: +k.open,
      high: +k.high,
      low: +k.low,
      close: +k.close,
      volume: +k.volume,
      closed: k.confirm,
    };
  }
  if (venue === "okx" && d.arg?.channel.startsWith("candle") && d.data?.length)
    return normalizeRows("okx", d.data, "1m")[0];
  return null;
}
export async function context() {
  const [global, fg] = await Promise.allSettled([
    jsonFetch("https://api.coingecko.com/api/v3/global"),
    jsonFetch("https://api.alternative.me/fng/?limit=1"),
  ]);
  return {
    global:
      global.status === "fulfilled"
        ? {
            totalMarketCap: global.value.data.total_market_cap.usd,
            btcDominance: global.value.data.market_cap_percentage.btc,
          }
        : null,
    fearGreed:
      fg.status === "fulfilled"
        ? {
            value: +fg.value.data[0].value,
            classification: fg.value.data[0].value_classification,
            timestamp: +fg.value.data[0].timestamp * 1000,
          }
        : null,
    fetchedAt: new Date().toISOString(),
  };
}
export async function instrumentMetadata(input) {
  const i = validateInstrument(input);
  if (i.venue === "binance") {
    const data = await jsonFetch(
        `https://${i.market === "spot" ? "api" : "fapi"}.binance.com/${i.market === "spot" ? "api/v3" : "fapi/v1"}/exchangeInfo?symbol=${i.symbol}`,
      ),
      row = data.symbols.find((x) => x.symbol === i.symbol);
    if (!row) throw new Error("instrument_unavailable");
    return {
      ...i,
      tickSize: row.filters.find((f) => f.filterType === "PRICE_FILTER")
        ?.tickSize,
      quantityStep: row.filters.find((f) => f.filterType === "LOT_SIZE")
        ?.stepSize,
    };
  }
  if (i.venue === "bybit") {
    const row = (
      await jsonFetch(
        `https://api.bybit.com/v5/market/instruments-info?category=${i.market === "spot" ? "spot" : "linear"}&symbol=${i.symbol}`,
      )
    ).result.list[0];
    if (!row) throw new Error("instrument_unavailable");
    return {
      ...i,
      tickSize: row.priceFilter.tickSize,
      quantityStep:
        row.lotSizeFilter.qtyStep || row.lotSizeFilter.basePrecision,
    };
  }
  const row = (
    await jsonFetch(
      `https://www.okx.com/api/v5/public/instruments?instType=${i.market === "spot" ? "SPOT" : "SWAP"}&instId=${okxId(i.symbol, i.market)}`,
    )
  ).data[0];
  if (!row) throw new Error("instrument_unavailable");
  return { ...i, tickSize: row.tickSz, quantityStep: row.lotSz };
}
export async function historyWithFallback(input, options = {}) {
  const requested = validateInstrument(input),
    order = [requested.venue, ...venues.filter((v) => v !== requested.venue)];
  let error;
  for (const venue of order) {
    try {
      const data = await history({ ...requested, venue }, options);
      if (data.provenance.stale) throw new Error("stale_data");
      if (venue !== requested.venue) {
        const anchor = Number(options.anchorPrice);
        if (
          anchor > 0 &&
          Math.abs(data.candles.at(-1).close / anchor - 1) > 0.01
        )
          throw new Error("fallback_price_discontinuity");
        data.fallback = {
          from: requested.venue,
          to: venue,
          reason: "requested_provider_unavailable",
          resetRequired: true,
        };
      }
      return data;
    } catch (e) {
      error = e;
      if (!options.allowFallback) throw e;
    }
  }
  throw error;
}
