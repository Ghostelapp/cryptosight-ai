import { query } from "./store.mjs";
import { tickers } from "../market/providers.mjs";
import { settlePaperPosition } from "../quant/research.mjs";
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
        : settlePaperPosition({
            direction: o.direction,
            entry: +o.fill_price,
            exit: p,
            quantity: +o.quantity,
            entryFees: +o.fees,
          }).pnl;
    if (pnl != null) equity += pnl + +o.fees;
    return {
      id: o.id,
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
      "SELECT COALESCE(SUM(pnl),0) AS pnl, COUNT(*) AS trades, COUNT(CASE WHEN pnl>0 THEN 1 END) AS wins, COALESCE(SUM(CASE WHEN pnl>0 THEN pnl ELSE 0 END),0) AS profit, COALESCE(SUM(CASE WHEN pnl<0 THEN -pnl ELSE 0 END),0) AS loss FROM paper_orders WHERE account_id=$1 AND closed_at IS NOT NULL",
      [account.id],
    )
  ).rows[0];
  const realizedBalance = +account.initial_balance + +allRealized.pnl;
  return {
    account,
    updatedAt: new Date().toISOString(),
    stats: {
      closedTrades: +allRealized.trades,
      winRate: +allRealized.trades
        ? (+allRealized.wins / +allRealized.trades) * 100
        : null,
      realizedPnl: +allRealized.pnl,
      profitFactor: +allRealized.loss
        ? +allRealized.profit / +allRealized.loss
        : null,
      openPositions: open.length,
      unrealizedPnl: complete
        ? exposure.reduce((sum, o) => sum + o.unrealizedPnl, 0)
        : null,
    },
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
