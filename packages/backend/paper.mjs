import { randomUUID, createHash } from "node:crypto";
import { query, transaction } from "./store.mjs";
import { depth } from "../market/providers.mjs";
import { settlePaperPosition } from "../quant/research.mjs";

function freshBook(book) {
  if (
    !Number.isFinite(book.timestamp) ||
    Date.now() - book.timestamp > 10000 ||
    book.timestamp > Date.now() + 1000
  )
    throw new Error("stale_quote");
}
export function paperFill(book, direction, quantity, limit = null) {
  if (
    !["LONG", "SHORT"].includes(direction) ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  )
    throw new Error("invalid_risk");
  freshBook(book);
  let remaining = quantity,
    value = 0;
  for (const [price, size] of direction === "LONG" ? book.asks : book.bids) {
    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isFinite(size) ||
      size < 0
    )
      throw new Error("stale_quote");
    if (limit != null && (direction === "LONG" ? price > limit : price < limit))
      break;
    const n = Math.min(remaining, size);
    value += n * price;
    remaining -= n;
    if (remaining <= quantity * 1e-12) break;
  }
  if (remaining > quantity * 1e-12) throw new Error("insufficient_depth");
  return { price: value / quantity, notional: value, fees: value * 0.001 };
}
export function validateProtection(direction, entry, stop, target) {
  if (
    (stop != null &&
      (!Number.isFinite(stop) ||
        stop <= 0 ||
        (direction === "LONG" ? stop >= entry : stop <= entry))) ||
    (target != null &&
      (!Number.isFinite(target) ||
        target <= 0 ||
        (direction === "LONG" ? target <= entry : target >= entry)))
  )
    throw new Error("invalid_risk");
}
async function owned(userId, id) {
  const o = (
    await query(
      "SELECT o.* FROM paper_orders o JOIN paper_accounts a ON a.id=o.account_id WHERE o.id=$1 AND a.user_id=$2",
      [id, userId],
    )
  ).rows[0];
  if (!o) throw new Error("not_found");
  return o;
}
async function locked(tx, userId, id) {
  const a = (
    await tx.query("SELECT * FROM paper_accounts WHERE user_id=$1 FOR UPDATE", [
      userId,
    ])
  ).rows[0];
  if (!a) throw new Error("not_found");
  const o = (
    await tx.query(
      "SELECT * FROM paper_orders WHERE id=$1 AND account_id=$2 FOR UPDATE",
      [id, a.id],
    )
  ).rows[0];
  if (!o) throw new Error("not_found");
  return { a, o };
}
async function riskGuard(tx, a, settings = {}) {
  const r = (
    await tx.query(
      "SELECT COALESCE(SUM(e.pnl),0) AS total, COALESCE(SUM(CASE WHEN e.created_at>=CURRENT_DATE THEN e.pnl ELSE 0 END),0) AS daily FROM paper_exits e JOIN paper_orders o ON o.id=e.order_id WHERE o.account_id=$1",
      [a.id],
    )
  ).rows[0];
  const realized = +a.initial_balance + +r.total;
  if (
    ((+a.peak_equity - realized) / +a.peak_equity) * 100 >=
    (settings.maxDrawdownPct ?? 10)
  )
    throw new Error("max_drawdown_limit");
  if (+r.daily <= -(settings.dailyLossLimit ?? 500))
    throw new Error("daily_loss_limit");
}
export async function placePaper(user, b, key) {
  const account = (
    await query("SELECT id FROM paper_accounts WHERE user_id=$1", [user.id])
  ).rows[0];
  const old = (
    await query(
      "SELECT * FROM paper_orders WHERE account_id=$1 AND idempotency_key=$2",
      [account.id, key],
    )
  ).rows[0];
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        b.venue,
        b.market,
        b.symbol,
        b.direction,
        b.quantity,
        b.orderType ?? "market",
        b.limitPrice ?? null,
        b.stopLoss ?? null,
        b.takeProfit ?? null,
      ]),
    )
    .digest("hex");
  const replay = (o) => {
    if (o.request_fingerprint && o.request_fingerprint !== fingerprint)
      throw new Error("version_conflict");
    return o;
  };
  if (old) return replay(old);
  const type = b.orderType ?? "market";
  const fill =
    type === "market"
      ? paperFill(await depth(b), b.direction, b.quantity)
      : {
          price: b.limitPrice,
          notional: b.limitPrice * b.quantity,
          fees: b.limitPrice * b.quantity * 0.001,
        };
  validateProtection(b.direction, fill.price, b.stopLoss, b.takeProfit);
  return transaction(async (tx) => {
    const a = (
      await tx.query(
        "SELECT * FROM paper_accounts WHERE user_id=$1 FOR UPDATE",
        [user.id],
      )
    ).rows[0];
    const duplicate = (
      await tx.query(
        "SELECT * FROM paper_orders WHERE account_id=$1 AND idempotency_key=$2",
        [a.id, key],
      )
    ).rows[0];
    if (duplicate) return replay(duplicate);
    await riskGuard(tx, a, user.settings);
    const cost = fill.notional + fill.fees;
    if (+a.balance < cost) throw new Error("insufficient_balance");
    await tx.query(
      "UPDATE paper_accounts SET balance=balance-$1,version=version+1 WHERE id=$2",
      [cost, a.id],
    );
    return (
      await tx.query(
        "INSERT INTO paper_orders(account_id,symbol,direction,quantity,initial_quantity,order_type,limit_price,fill_price,fees,status,idempotency_key,venue,market,stop_loss,take_profit,reserved,request_fingerprint) VALUES($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *",
        [
          a.id,
          b.symbol,
          b.direction,
          b.quantity,
          type,
          b.limitPrice ?? null,
          type === "market" ? fill.price : null,
          type === "market" ? fill.fees : 0,
          type === "market" ? "filled" : "pending",
          key,
          b.venue,
          b.market,
          b.stopLoss ?? null,
          b.takeProfit ?? null,
          type === "limit" ? cost : 0,
          fingerprint,
        ],
      )
    ).rows[0];
  });
}
export async function cancelPaper(userId, id) {
  return transaction(async (tx) => {
    const { a, o } = await locked(tx, userId, id);
    if (o.status === "cancelled") return o;
    if (o.status !== "pending") throw new Error("version_conflict");
    await tx.query(
      "UPDATE paper_accounts SET balance=balance+$1,version=version+1 WHERE id=$2",
      [o.reserved, a.id],
    );
    return (
      await tx.query(
        "UPDATE paper_orders SET reserved=0,status='cancelled',closed_at=now(),version=version+1 WHERE id=$1 RETURNING *",
        [id],
      )
    ).rows[0];
  });
}
export async function protectPaper(userId, id, b) {
  const snapshot = await owned(userId, id);
  if (
    snapshot.version !== b.version ||
    snapshot.pending_exit ||
    !["pending", "filled"].includes(snapshot.status)
  )
    throw new Error("version_conflict");
  let reference = +(snapshot.fill_price ?? snapshot.limit_price);
  if (
    snapshot.status === "filled" &&
    (b.stopLoss != null || b.takeProfit != null)
  ) {
    const book = await depth(snapshot);
    freshBook(book);
    reference = (snapshot.direction === "LONG" ? book.bids : book.asks)[0]?.[0];
    if (!Number.isFinite(reference) || reference <= 0)
      throw new Error("stale_quote");
  }
  return transaction(async (tx) => {
    const { o } = await locked(tx, userId, id);
    if (
      o.version !== b.version ||
      !["pending", "filled"].includes(o.status) ||
      o.pending_exit
    )
      throw new Error("version_conflict");
    validateProtection(o.direction, reference, b.stopLoss, b.takeProfit);
    return (
      await tx.query(
        "UPDATE paper_orders SET stop_loss=$1,take_profit=$2,version=version+1 WHERE id=$3 RETURNING *",
        [b.stopLoss ?? null, b.takeProfit ?? null, id],
      )
    ).rows[0];
  });
}
export async function closePaper(
  userId,
  id,
  { quantity, key = randomUUID(), reason = "manual", book } = {},
) {
  const snapshot = await owned(userId, id);
  const previous = (
    await query(
      "SELECT * FROM paper_exits WHERE order_id=$1 AND idempotency_key=$2",
      [id, key],
    )
  ).rows[0];
  if (previous) {
    if (quantity != null && quantity !== +previous.quantity)
      throw new Error("version_conflict");
    return previous;
  }
  if (snapshot.status !== "filled") throw new Error("already_closed");
  const q = quantity ?? +snapshot.quantity;
  if (!Number.isFinite(q) || q <= 0 || q > +snapshot.quantity)
    throw new Error("invalid_risk");
  if (q !== +snapshot.quantity && +snapshot.quantity - q < 1e-8)
    throw new Error("invalid_risk");
  const fill = paperFill(
    book ?? (await depth(snapshot)),
    snapshot.direction === "LONG" ? "SHORT" : "LONG",
    q,
  );
  return transaction(async (tx) => {
    const { a, o } = await locked(tx, userId, id);
    const duplicate = (
      await tx.query(
        "SELECT * FROM paper_exits WHERE order_id=$1 AND idempotency_key=$2",
        [id, key],
      )
    ).rows[0];
    if (duplicate) {
      if (quantity != null && quantity !== +duplicate.quantity)
        throw new Error("version_conflict");
      return duplicate;
    }
    if (o.status !== "filled") throw new Error("already_closed");
    if (o.version !== snapshot.version || q > +o.quantity)
      throw new Error("version_conflict");
    const entryFees = (+o.fees * q) / +o.quantity;
    const settlement = settlePaperPosition({
      direction: o.direction,
      entry: +o.fill_price,
      exit: fill.price,
      quantity: q,
      entryFees,
    });
    const full = q === +o.quantity;
    const exit = (
      await tx.query(
        "INSERT INTO paper_exits(order_id,quantity,price,pnl,entry_fees,exit_fees,reason,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
        [
          id,
          q,
          fill.price,
          settlement.pnl,
          entryFees,
          settlement.exitFees,
          o.pending_exit ?? reason,
          key,
        ],
      )
    ).rows[0];
    await tx.query(
      "UPDATE paper_accounts SET balance=balance+$1,version=version+1 WHERE id=$2",
      [settlement.returnedCollateral, a.id],
    );
    await tx.query(
      "UPDATE paper_orders SET quantity=$1,fees=$2,pnl=COALESCE(pnl,0)+$3,close_price=$4,status=$5,closed_at=CASE WHEN $6 THEN now() ELSE NULL END,close_reason=$7,collateral_exhausted=collateral_exhausted OR $8,version=version+1 WHERE id=$9",
      [
        full ? +o.quantity : +o.quantity - q,
        full ? +o.fees : +o.fees - entryFees,
        settlement.pnl,
        fill.price,
        full ? "closed" : "filled",
        full,
        full ? (o.pending_exit ?? reason) : null,
        settlement.collateralExhausted,
        id,
      ],
    );
    await tx.query(
      "UPDATE paper_accounts SET peak_equity=GREATEST(peak_equity,initial_balance+(SELECT COALESCE(SUM(e.pnl),0) FROM paper_exits e JOIN paper_orders o ON o.id=e.order_id WHERE o.account_id=$1)) WHERE id=$1",
      [a.id],
    );
    return {
      ...exit,
      closed: full,
      collateral_exhausted: settlement.collateralExhausted,
      settlement_model: settlement.model,
    };
  });
}
export async function paperTick() {
  // A finite scan; failures are isolated per instrument. No fabricated or stale fills.
  const orders = (
    await query(
      "SELECT o.*,a.user_id FROM paper_orders o JOIN paper_accounts a ON a.id=o.account_id JOIN users u ON u.id=a.user_id WHERE (o.status='filled' OR (o.status='pending' AND NOT u.suspended)) ORDER BY o.created_at",
    )
  ).rows;
  const books = new Map();
  let failures = 0;
  for (const o of orders) {
    const instrument = [o.venue, o.market, o.symbol].join(":");
    try {
      if (!books.has(instrument)) books.set(instrument, depth(o));
      const book = await books.get(instrument);
      if (o.status === "pending") {
        let fill;
        try {
          fill = paperFill(book, o.direction, +o.quantity, +o.limit_price);
        } catch (e) {
          if (e.message === "insufficient_depth") continue;
          throw e;
        }
        await transaction(async (tx) => {
          const { a, o: current } = await locked(tx, o.user_id, o.id);
          if (current.status !== "pending") return;
          const user = (
            await tx.query("SELECT settings FROM users WHERE id=$1", [
              o.user_id,
            ])
          ).rows[0];
          try {
            await riskGuard(tx, a, user.settings);
          } catch (e) {
            if (!["max_drawdown_limit", "daily_loss_limit"].includes(e.message))
              throw e;
            await tx.query(
              "UPDATE paper_accounts SET balance=balance+$1,version=version+1 WHERE id=$2",
              [current.reserved, a.id],
            );
            await tx.query(
              "UPDATE paper_orders SET reserved=0,status='cancelled',closed_at=now(),close_reason=$2,version=version+1 WHERE id=$1",
              [o.id, e.message],
            );
            return;
          }
          const difference = +current.reserved - fill.notional - fill.fees;
          if (+a.balance + difference < 0)
            throw new Error("insufficient_balance");
          await tx.query(
            "UPDATE paper_accounts SET balance=balance+$1,version=version+1 WHERE id=$2",
            [difference, a.id],
          );
          await tx.query(
            "UPDATE paper_orders SET fill_price=$1,fees=$2,reserved=0,status='filled',version=version+1 WHERE id=$3",
            [fill.price, fill.fees, o.id],
          );
        });
      } else {
        const mark = (o.direction === "LONG" ? book.bids : book.asks)[0]?.[0];
        freshBook(book);
        if (!Number.isFinite(mark) || mark <= 0) throw new Error("stale_quote");
        const stop =
          o.stop_loss != null &&
          (o.direction === "LONG"
            ? mark <= +o.stop_loss
            : mark >= +o.stop_loss);
        const target =
          o.take_profit != null &&
          (o.direction === "LONG"
            ? mark >= +o.take_profit
            : mark <= +o.take_profit);
        const reason =
          o.pending_exit ??
          (stop ? "stop_loss" : target ? "take_profit" : null);
        if (reason) {
          await transaction(async (tx) => {
            const { o: current } = await locked(tx, o.user_id, o.id);
            if (
              current.status === "filled" &&
              current.version === o.version &&
              !current.pending_exit
            )
              await tx.query(
                "UPDATE paper_orders SET pending_exit=$2,version=version+1 WHERE id=$1",
                [o.id, reason],
              );
          });
          const current = await owned(o.user_id, o.id);
          if (current.pending_exit)
            await closePaper(o.user_id, o.id, {
              key: "protective-" + current.version,
              reason: current.pending_exit,
              book,
            });
        }
      }
    } catch {
      failures++;
    }
  }
  await query(
    "INSERT INTO paper_engine_health(id,last_tick) VALUES(1,now()) ON CONFLICT(id) DO UPDATE SET last_tick=now()",
  );
  return { processed: orders.length, failures };
}
