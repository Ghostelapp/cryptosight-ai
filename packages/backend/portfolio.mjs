import { query } from "./store.mjs";
import { tickers } from "../market/providers.mjs";
import { cached } from "./cache.mjs";
export async function paperOverview(userId) {
  const account = (
      await query("SELECT * FROM paper_accounts WHERE user_id=$1", [userId])
    ).rows[0],
    orders = (
      await query(
        "SELECT * FROM paper_orders WHERE account_id=$1 AND (closed_at IS NULL OR id IN (SELECT id FROM paper_orders WHERE account_id=$1 AND closed_at IS NOT NULL ORDER BY closed_at DESC LIMIT 200)) ORDER BY created_at DESC",
        [account.id],
      )
    ).rows;
  const open = orders.filter((o) => !o.closed_at),
    groups = [...new Set(open.map((o) => o.venue + ":" + o.market))],
    prices = {};
  for (const g of groups) {
    const [venue, market] = g.split(":");
    try {
      prices[g] = await cached("portfolio-prices:" + g, 10, () =>
        tickers(venue, market),
      );
    } catch {
      prices[g] = [];
    }
  }
  let equity = +account.balance,
    complete = true;
  const exposure = open.map((o) => {
    const p = prices[o.venue + ":" + o.market]?.find(
      (t) => t.symbol === o.symbol,
    )?.price;
    const collateral = +o.quantity * +o.fill_price;
    equity += collateral;
    if (p == null) complete = false;
    const pnl =
      p == null
        ? null
        : Math.max(
            -collateral,
            (o.direction === "LONG" ? p - +o.fill_price : +o.fill_price - p) *
              +o.quantity,
          );
    if (pnl != null) equity += pnl;
    return {
      symbol: o.symbol,
      direction: o.direction,
      quantity: +o.quantity,
      collateral,
      mark: p ?? null,
      unrealizedPnl: pnl,
      notional: p == null ? null : p * +o.quantity,
    };
  });
  const allRealized = (
    await query(
      "SELECT COALESCE(SUM(pnl),0) AS pnl FROM paper_orders WHERE account_id=$1 AND closed_at IS NOT NULL",
      [account.id],
    )
  ).rows[0];
  const realizedBalance = +account.initial_balance + +allRealized.pnl;
  return {
    account,
    orders,
    exposure,
    equity: complete ? equity : null,
    realizedBalance,
    drawdownPct: Math.max(
      0,
      ((+account.peak_equity - realizedBalance) / +account.peak_equity) * 100,
    ),
    complete,
    guardBasis: "realized_equity",
  };
}
