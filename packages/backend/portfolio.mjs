import { query } from "./store.mjs";
import { tickers } from "../market/providers.mjs";
import { settlePaperPosition } from "../quant/research.mjs";
import { cached } from "./cache.mjs";
import { paperLiquidationPrice } from "../quant/paper-model.mjs";
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
  const open = orders.filter((o) => o.status === "filled"),
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
  const reserved = orders
    .filter((o) => o.status === "pending")
    .reduce((sum, o) => sum + +o.reserved, 0);
  let equity = +account.balance + reserved,
    complete = true;
  const exposure = open.map((o) => {
    const p = prices[o.venue + ":" + o.market]?.find(
      (t) => t.symbol === o.symbol,
    )?.price;
    const collateral = (+o.quantity * +o.fill_price) / +o.leverage;
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
            leverage: +o.leverage,
          }).pnl;
    if (pnl != null) equity += pnl + +o.fees;
    return {
      id: o.id,
      symbol: o.symbol,
      direction: o.direction,
      quantity: +o.quantity,
      collateral,
      leverage: +o.leverage,
      liquidationPrice: paperLiquidationPrice(
        +o.fill_price,
        o.direction,
        +o.leverage,
      ),
      mark: p ?? null,
      unrealizedPnl: pnl,
      notional: p == null ? null : p * +o.quantity,
    };
  });
  const allRealized = (
    await query(
      "SELECT COALESCE(SUM(pnl),0) AS pnl, COUNT(*) AS trades, COUNT(CASE WHEN pnl>0 THEN 1 END) AS wins, COALESCE(SUM(CASE WHEN pnl>0 THEN pnl ELSE 0 END),0) AS profit, COALESCE(SUM(CASE WHEN pnl<0 THEN -pnl ELSE 0 END),0) AS loss FROM paper_orders WHERE account_id=$1 AND status='closed'",
      [account.id],
    )
  ).rows[0];
  const exits = (
    await query(
      "SELECT e.*,o.symbol,o.direction FROM paper_exits e JOIN paper_orders o ON o.id=e.order_id WHERE o.account_id=$1 ORDER BY e.created_at DESC LIMIT 200",
      [account.id],
    )
  ).rows;
  const realized = (
    await query(
      "SELECT COALESCE(SUM(e.pnl),0) AS pnl FROM paper_exits e JOIN paper_orders o ON o.id=e.order_id WHERE o.account_id=$1",
      [account.id],
    )
  ).rows[0];
  const health = (
    await query("SELECT last_tick FROM paper_engine_health WHERE id=1")
  ).rows[0];
  const engineActive = Boolean(
    health && Date.now() - new Date(health.last_tick).getTime() < 45000,
  );
  const realizedBalance = +account.initial_balance + +realized.pnl;
  return {
    account,
    exits,
    reserved,
    engineActive,
    engineLastTick: health?.last_tick ?? null,
    updatedAt: new Date().toISOString(),
    stats: {
      closedTrades: +allRealized.trades,
      winRate: +allRealized.trades
        ? (+allRealized.wins / +allRealized.trades) * 100
        : null,
      realizedPnl: +realized.pnl,
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
