import { validateInstrument, okxId } from "./providers.mjs";
export function orderflowConfig(input) {
  const i = validateInstrument(input);
  if (i.venue === "binance") {
    const symbol = i.symbol.toLowerCase();
    return {
      url: `${i.market === "spot" ? "wss://stream.binance.com:9443" : "wss://fstream.binance.com"}/stream?streams=${symbol}@aggTrade/${symbol}@depth20@100ms${i.market === "perpetual" ? "/" + symbol + "@forceOrder" : ""}`,
      subscribe: null,
    };
  }
  if (i.venue === "bybit")
    return {
      url: `wss://stream.bybit.com/v5/public/${i.market === "spot" ? "spot" : "linear"}`,
      subscribe: {
        op: "subscribe",
        args: [`publicTrade.${i.symbol}`, `orderbook.50.${i.symbol}`],
      },
    };
  return {
    url: "wss://ws.okx.com/ws/v5/public",
    subscribe: {
      op: "subscribe",
      args: [
        { channel: "trades", instId: okxId(i.symbol, i.market) },
        { channel: "books5", instId: okxId(i.symbol, i.market) },
      ],
    },
  };
}
export function parseOrderflow(venue, message, state) {
  const raw = typeof message === "string" ? JSON.parse(message) : message,
    d = raw.data && !Array.isArray(raw.data) && raw.stream ? raw.data : raw;
  const out = [];
  if (venue === "binance") {
    if (d.e === "aggTrade")
      out.push({
        type: "trade",
        timestamp: d.T,
        price: +d.p,
        size: +d.q,
        side: d.m ? "sell" : "buy",
        id: String(d.a),
      });
    if (
      (d.bids && d.asks) ||
      (d.e === "depthUpdate" && d.b?.length && d.a?.length)
    ) {
      out.push({
        type: "depth",
        snapshot: true,
        bids: (d.bids || d.b).map((r) => [+r[0], +r[1]]),
        asks: (d.asks || d.a).map((r) => [+r[0], +r[1]]),
        timestamp: d.E || Date.now(),
        sequence: d.lastUpdateId || d.u,
      });
    }
    if (d.e === "forceOrder")
      out.push({
        type: "liquidation",
        timestamp: d.o.T,
        side: d.o.S,
        notional: +d.o.ap * +d.o.z,
        sampled: true,
      });
  }
  if (venue === "bybit") {
    if (d.topic?.startsWith("publicTrade."))
      for (const r of d.data || [])
        out.push({
          type: "trade",
          timestamp: +r.T,
          price: +r.p,
          size: +r.v,
          side: r.S === "Buy" ? "buy" : "sell",
          id: r.i,
        });
    if (d.topic?.startsWith("orderbook.")) {
      const r = d.data;
      if (d.type === "snapshot" || r.u === 1) {
        state.bids = new Map();
        state.asks = new Map();
        state.sequence = 0;
      }
      if (!state.bids || r.u <= state.sequence) return out;
      for (const [target, updates] of [
        [state.bids, r.b],
        [state.asks, r.a],
      ])
        for (const [p, s] of updates || [])
          if (+s === 0) target.delete(p);
          else target.set(p, +s);
      state.sequence = r.u;
      out.push({
        type: "depth",
        snapshot: true,
        bids: [...state.bids]
          .map(([p, s]) => [+p, s])
          .sort((a, b) => b[0] - a[0])
          .slice(0, 20),
        asks: [...state.asks]
          .map(([p, s]) => [+p, s])
          .sort((a, b) => a[0] - b[0])
          .slice(0, 20),
        timestamp: d.ts,
        sequence: r.u,
      });
    }
  }
  if (venue === "okx") {
    if (d.arg?.channel === "trades")
      for (const r of d.data || [])
        out.push({
          type: "trade",
          timestamp: +r.ts,
          price: +r.px,
          size: +r.sz,
          side: r.side,
          id: r.tradeId,
        });
    if (d.arg?.channel === "books5")
      for (const r of d.data || [])
        out.push({
          type: "depth",
          snapshot: true,
          bids: r.bids.map((x) => [+x[0], +x[1]]),
          asks: r.asks.map((x) => [+x[0], +x[1]]),
          timestamp: +r.ts,
          sequence: r.seqId,
        });
  }
  return out;
}
