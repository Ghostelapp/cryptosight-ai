export function positionSize({
  account,
  riskPct,
  entry,
  stop,
  leverage = 1,
  feeBps = 10,
  slippageBps = 5,
  direction = "LONG",
}) {
  for (const v of [
    account,
    riskPct,
    entry,
    stop,
    leverage,
    feeBps,
    slippageBps,
  ])
    if (!Number.isFinite(+v)) throw new Error("invalid_risk");
  if (
    account <= 0 ||
    riskPct <= 0 ||
    riskPct > 5 ||
    entry <= 0 ||
    stop <= 0 ||
    leverage < 1 ||
    leverage > 100 ||
    feeBps < 0 ||
    slippageBps < 0 ||
    !["LONG", "SHORT"].includes(direction) ||
    (direction === "LONG" && stop >= entry) ||
    (direction === "SHORT" && stop <= entry)
  )
    throw new Error("invalid_risk");
  const risk = (account * riskPct) / 100,
    unitRisk =
      Math.abs(entry - stop) +
      ((entry + stop) * (feeBps + slippageBps)) / 10000,
    raw = risk / unitRisk,
    quantity = Math.min(raw, (account * leverage) / entry);
  return {
    riskBudget: risk,
    quantity,
    notional: quantity * entry,
    margin: (quantity * entry) / leverage,
    maxLoss: quantity * unitRisk,
    liquidationPrice: null,
    liquidationReason: "Venue margin tiers and collateral mode required",
    warnings: [
      ...(leverage >= 10 ? ["high_leverage"] : []),
      ...(riskPct >= 2 ? ["high_account_risk"] : []),
      ...(quantity < raw ? ["collateral_capped"] : []),
    ],
  };
}
export function evaluateSetup(
  setup,
  candles,
  { publishedAt, expiresAt, feeBps = 10, slippageBps = 5 } = {},
) {
  if (setup.direction === "NO_TRADE") return { status: "no_trade" };
  const long = setup.direction === "LONG",
    entry = setup.entry.price;
  let triggered = false,
    active = false,
    fill = null,
    remaining = 1,
    pnl = 0,
    hits = [];
  for (const c of candles) {
    if (c.timestamp < publishedAt) continue;
    if (c.timestamp > expiresAt)
      return { status: "expired", active, pnl, hits };
    if (!active) {
      const trigger = setup.trigger || { type: "price_touch", price: entry };
      if (!triggered) {
        if (
          trigger.type === "candle_close_above" ||
          trigger.type === "candle_close_below"
        ) {
          if (
            trigger.type === "candle_close_above"
              ? c.close > trigger.price
              : c.close < trigger.price
          )
            triggered = true;
          continue;
        }
        if (!(c.low <= trigger.price && c.high >= trigger.price)) continue;
        triggered = true;
        if (trigger.price !== entry && c.low <= entry && c.high >= entry)
          return {
            status: "ambiguous",
            reason: "trigger_and_entry_same_bar",
            hits,
            pnl,
          };
      }
      const type = setup.entry.type;
      const touch =
        type === "market" ||
        (type === "limit"
          ? long
            ? c.low <= entry
            : c.high >= entry
          : long
            ? c.high >= entry
            : c.low <= entry);
      if (!touch) continue;
      active = true;
      fill =
        type === "market"
          ? trigger.type === "price_touch"
            ? trigger.price
            : c.open
          : type === "stop"
            ? long
              ? Math.max(entry, c.open)
              : Math.min(entry, c.open)
            : entry;
      // OHLC cannot order events within the entry candle. Never score targets on it.
      if (
        (c.low <= setup.stop_loss && setup.stop_loss <= c.high) ||
        setup.take_profits.some((t) => c.low <= t.price && t.price <= c.high)
      )
        return {
          status: "ambiguous",
          reason: "entry_and_exit_same_bar",
          hits,
          pnl,
        };
      continue;
    }
    const sl = long ? c.low <= setup.stop_loss : c.high >= setup.stop_loss;
    const reached = setup.take_profits.filter(
      (t, j) =>
        !hits.includes(j) && (long ? c.high >= t.price : c.low <= t.price),
    );
    if (sl && reached.length)
      return {
        status: "ambiguous",
        reason: "stop_and_target_same_bar",
        hits,
        pnl,
      };
    if (sl) {
      pnl +=
        remaining *
        ((long ? setup.stop_loss - fill : fill - setup.stop_loss) / fill -
          ((feeBps + slippageBps) * 2) / 10000);
      return { status: "sl", pnl, hits };
    }
    for (const t of reached) {
      const j = setup.take_profits.indexOf(t),
        fraction = t.size_pct / 100;
      hits.push(j);
      remaining -= fraction;
      pnl +=
        fraction *
        ((long ? t.price - fill : fill - t.price) / fill -
          ((feeBps + slippageBps) * 2) / 10000);
    }
    if (remaining <= 1e-6) return { status: "tp", pnl, hits };
  }
  return {
    status: Date.now() > expiresAt ? "expired" : active ? "active" : "pending",
    pnl,
    hits,
  };
}
export function backtest(
  candles,
  {
    fast = 20,
    slow = 50,
    riskPct = 1,
    initialBalance = 10000,
    feeBps = 10,
    slippageBps = 5,
  } = {},
) {
  if (
    !Number.isInteger(fast) ||
    !Number.isInteger(slow) ||
    fast < 2 ||
    slow <= fast ||
    slow > 200 ||
    initialBalance <= 0 ||
    riskPct <= 0 ||
    riskPct > 5
  )
    throw new Error("invalid_strategy");
  let equity = initialBalance,
    peak = equity,
    drawdown = 0,
    position = null,
    trades = [],
    curve = [];
  const mean = (end, n) =>
    candles.slice(end - n, end).reduce((s, c) => s + c.close, 0) / n;
  for (let i = slow + 1; i < candles.length; i++) {
    const pf = mean(i - 1, fast),
      ps = mean(i - 1, slow),
      f = mean(i, fast),
      s = mean(i, slow),
      bar = candles[i];
    if (position && f < s) {
      const price = bar.open * (1 - slippageBps / 10000),
        pnl =
          (price - position.price) * position.quantity -
          ((price + position.price) * position.quantity * feeBps) / 10000;
      equity += pnl;
      trades.push({ ...position, exit: price, exitTime: bar.timestamp, pnl });
      position = null;
    }
    if (!position && pf <= ps && f > s) {
      const price = bar.open * (1 + slippageBps / 10000);
      position = {
        price,
        quantity: Math.min(
          equity / price,
          (equity * riskPct) / 100 / (price * 0.03),
        ),
        time: bar.timestamp,
      };
    }
    const marked =
      equity +
      (position ? (bar.close - position.price) * position.quantity : 0);
    peak = Math.max(peak, marked);
    drawdown = Math.max(drawdown, ((peak - marked) / peak) * 100);
    curve.push({ timestamp: bar.timestamp, equity: marked });
  }
  const markedEquity = curve.at(-1)?.equity ?? equity;
  return {
    realizedBalance: equity,
    strategy:
      "SMA crossover; signals on previous closed bars, fills at next open",
    initialBalance,
    equity: markedEquity,
    returnPct: (markedEquity / initialBalance - 1) * 100,
    maxDrawdownPct: drawdown,
    trades,
    openPosition: position,
    winRate: trades.length
      ? (trades.filter((t) => t.pnl > 0).length / trades.length) * 100
      : null,
    curve,
    fees: { feeBps, slippageBps },
    riskNote:
      "riskPct sizes to a 3% reference distance; this SMA strategy exits on crossover and does not guarantee that loss cap",
  };
}
export function correlation(series) {
  const symbols = Object.keys(series),
    returns = {};
  for (const s of symbols) {
    const c = series[s];
    returns[s] = new Map(
      c.slice(1).map((b, i) => [b.timestamp, Math.log(b.close / c[i].close)]),
    );
  }
  return symbols.map((a) => ({
    symbol: a,
    values: symbols.map((b) => {
      const pairs = [...returns[a]]
        .filter(([t]) => returns[b].has(t))
        .map(([t, x]) => [x, returns[b].get(t)]);
      if (pairs.length < 30)
        return { symbol: b, value: null, samples: pairs.length };
      const n = pairs.length,
        mx = pairs.reduce((s, p) => s + p[0], 0) / n,
        my = pairs.reduce((s, p) => s + p[1], 0) / n;
      let co = 0,
        vx = 0,
        vy = 0;
      for (const [x, y] of pairs) {
        co += (x - mx) * (y - my);
        vx += (x - mx) ** 2;
        vy += (y - my) ** 2;
      }
      return {
        symbol: b,
        value: vx && vy ? co / Math.sqrt(vx * vy) : null,
        samples: n,
      };
    }),
  }));
}
// Isolated, fully collateralized educational paper model; no venue liquidation claim.
export function settlePaperPosition({
  direction,
  entry,
  exit,
  quantity,
  entryFees = 0,
  feeBps = 10,
}) {
  if (
    !["LONG", "SHORT"].includes(direction) ||
    ![entry, exit, quantity].every((n) => Number.isFinite(n) && n > 0) ||
    ![entryFees, feeBps].every((n) => Number.isFinite(n) && n >= 0)
  )
    throw new Error("invalid_risk");
  const collateral = entry * quantity,
    exitFees = (exit * quantity * feeBps) / 10000,
    rawPnl =
      (direction === "LONG" ? exit - entry : entry - exit) * quantity -
      exitFees,
    pnlBeforeEntryFee = Math.max(-collateral, rawPnl);
  return {
    collateral,
    exitFees,
    pnl: pnlBeforeEntryFee - entryFees,
    returnedCollateral: Math.max(0, collateral + pnlBeforeEntryFee),
    collateralExhausted: rawPnl <= -collateral,
    model: "isolated_paper_collateral_cap",
  };
}
