"use client";
import { useState, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api, type Instrument } from "../lib/client";
import { Button } from "./ui/button";
import { paperLiquidationPrice } from "../../../packages/quant/paper-model.mjs";

type Order = {
  id: string;
  symbol: string;
  venue: string;
  market: string;
  direction: "LONG" | "SHORT";
  status: string;
  order_type: string;
  quantity: string;
  initial_quantity: string;
  fill_price: string | null;
  limit_price: string | null;
  stop_loss: string | null;
  take_profit: string | null;
  pnl: string | null;
  reserved: string;
  version: number;
  pending_exit: string | null;
  leverage?: number;
};
type Exit = {
  id: string;
  symbol: string;
  quantity: string;
  price: string;
  pnl: string;
  entry_fees: string;
  exit_fees: string;
  created_at: string;
  reason: string;
};
type Exposure = {
  id: string;
  mark: number | null;
  unrealizedPnl: number | null;
  collateral?: number;
  liquidationPrice?: number | null;
};
type Overview = {
  account: { balance: string };
  orders: Order[];
  exits: Exit[];
  exposure: Exposure[];
  equity: number | null;
  reserved: number;
  drawdownPct: number;
  complete: boolean;
  engineLastTick: string | null;
  updatedAt: string;
  stats: {
    closedTrades: number;
    winRate: number | null;
    realizedPnl: number;
    profitFactor: number | null;
    unrealizedPnl: number | null;
  };
};
type Run = (name: string, fn: () => Promise<unknown>) => Promise<unknown>;
function PriceField({
  label,
  value,
  set,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );
}
function Position({
  order,
  exposure,
  run,
  refresh,
  disabled,
}: {
  order: Order;
  exposure?: Exposure;
  run: Run;
  refresh: () => Promise<void>;
  disabled: boolean;
}) {
  const t = useTranslations(),
    locale = useLocale();
  const [stop, setStop] = useState(order.stop_loss ?? ""),
    [target, setTarget] = useState(order.take_profit ?? "");
  useEffect(() => {
    setStop(order.stop_loss ?? "");
    setTarget(order.take_profit ?? "");
  }, [order.stop_loss, order.take_profit]);
  const fmt = (v: unknown) =>
    v == null
      ? "—"
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(
          Number(v),
        );
  const pending = order.status === "pending";
  const close = (fraction: number) =>
    run("paper-close", async () => {
      await api("paper-close/" + order.id, {
        method: "POST",
        headers: { "idempotency-key": crypto.randomUUID() },
        body:
          fraction === 1 ? {} : { quantity: Number(order.quantity) * fraction },
      });
      await refresh();
    });
  return (
    <article className="paper-position">
      <div className="paper-position-head">
        <strong>{order.symbol}</strong>
        <span
          className={
            "paper-side " +
            (order.direction === "LONG" ? "positive" : "negative")
          }
        >
          {order.direction} · {order.leverage ?? 1}×
        </span>
        <strong
          className={
            (exposure?.unrealizedPnl ?? 0) >= 0 ? "positive" : "negative"
          }
        >
          {pending ? fmt(order.reserved) : fmt(exposure?.unrealizedPnl)}{" "}
          <small>USDT</small>
        </strong>
      </div>
      <div className="paper-position-meta">
        <span>
          {t("quantity")}: {fmt(order.quantity)}
        </span>
        <span>
          {pending ? t("paperLimitPrice") : t("entry")}:{" "}
          {fmt(order.fill_price ?? order.limit_price)}
        </span>
        <span>
          {order.venue} · {order.market}
        </span>
      </div>
      {!pending && (
        <div className="paper-position-meta">
          <span>SL: {fmt(order.stop_loss)}</span>
          <span>TP: {fmt(order.take_profit)}</span>
          <span>
            {t("paperLiquidation")}: {fmt(exposure?.liquidationPrice)}
          </span>
        </div>
      )}
      {order.pending_exit && (
        <p role="status" className="negative">
          {t("paperExitPending")}
        </p>
      )}
      <div className="paper-position-footer">
        <details className="paper-manage">
          <summary>{t("paperManage")}</summary>
          <div className="paper-fields">
            <PriceField label={t("stopLoss")} value={stop} set={setStop} />
            <PriceField
              label={t("takeProfit")}
              value={target}
              set={setTarget}
            />
          </div>
          <div className="paper-actions">
            <Button
              variant="outline"
              disabled={disabled || Boolean(order.pending_exit)}
              onClick={() =>
                run("paper-protection", async () => {
                  await api("paper-protection/" + order.id, {
                    method: "PATCH",
                    body: {
                      version: order.version,
                      stopLoss: stop === "" ? null : Number(stop),
                      takeProfit: target === "" ? null : Number(target),
                    },
                  });
                  await refresh();
                })
              }
            >
              {t("paperSaveProtection")}
            </Button>
            {!pending &&
              [0.25, 0.5].map((f) => (
                <Button
                  key={f}
                  variant="outline"
                  disabled={
                    disabled ||
                    Boolean(order.pending_exit) ||
                    Number(order.quantity) * f < 1e-8
                  }
                  onClick={() => close(f)}
                >
                  {t("close")} {f * 100}%
                </Button>
              ))}
          </div>
        </details>
        {pending ? (
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() =>
              run("paper-cancel", async () => {
                await api("paper-cancel/" + order.id, {
                  method: "POST",
                  body: {},
                });
                await refresh();
              })
            }
          >
            {t("paperCancelOrder")}
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={disabled || Boolean(order.pending_exit)}
            onClick={() => close(1)}
          >
            {t("close")} 100%
          </Button>
        )}
      </div>
    </article>
  );
}
export function PaperPanel({
  overview,
  instrument,
  mark,
  demo,
  busy,
  run,
  refresh,
  onMarketChange,
}: {
  overview: Overview | null;
  instrument: Instrument;
  mark: number;
  demo: boolean;
  busy: string;
  run: Run;
  refresh: () => Promise<void>;
  onMarketChange: () => void;
}) {
  const t = useTranslations(),
    locale = useLocale();
  const [direction, setDirection] = useState("LONG"),
    [type, setType] = useState("market"),
    [quantity, setQuantity] = useState("0.01"),
    [limit, setLimit] = useState(""),
    [stop, setStop] = useState(""),
    [target, setTarget] = useState(""),
    [risk, setRisk] = useState("1"),
    [leverage, setLeverage] = useState(1),
    [tab, setTab] = useState("positions");
  const [pendingSubmission, setPendingSubmission] = useState(false),
    [now, setNow] = useState(0);
  const submission = useRef<{ payload: string; key: string } | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  const stale = Boolean(
    overview && now && now - new Date(overview.updatedAt).getTime() > 30000,
  );
  const engineActive = Boolean(
    overview?.engineLastTick &&
    now - new Date(overview.engineLastTick).getTime() < 45000,
  );
  const fmt = (v: unknown, digits = 2) =>
    v == null
      ? "—"
      : new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(
          Number(v),
        );
  const reference = type === "limit" ? Number(limit) : mark,
    L = instrument.market === "perpetual" ? leverage : 1;
  const notional = reference * Number(quantity),
    margin = notional / L,
    fee = notional * 0.001,
    cost = margin + fee,
    balance = Number(overview?.account.balance ?? 0);
  const maxQuantity =
    reference > 0 ? balance / (reference * (1 / L + 0.001)) : 0;
  const stopValue = stop === "" ? null : Number(stop),
    targetValue = target === "" ? null : Number(target);
  const wrongStop =
    stopValue != null &&
    (stopValue <= 0 ||
      (direction === "LONG" ? stopValue >= reference : stopValue <= reference));
  const wrongTarget =
    targetValue != null &&
    (targetValue <= 0 ||
      (direction === "LONG"
        ? targetValue <= reference
        : targetValue >= reference));
  const valid =
    Number.isFinite(cost) &&
    Number(quantity) >= 1e-8 &&
    Number(quantity) <= 1000000 &&
    reference > 0 &&
    !wrongStop &&
    !wrongTarget &&
    cost <= balance;
  const disabled = Boolean(busy) || pendingSubmission;
  const liquidation = paperLiquidationPrice(reference, direction, L);
  const submit = async () => {
    if (pendingSubmission || !valid || stale) return;
    const payload = JSON.stringify([
      instrument,
      direction,
      type,
      quantity,
      limit,
      stop,
      target,
      L,
    ]);
    if (submission.current?.payload !== payload)
      submission.current = { payload, key: crypto.randomUUID() };
    const key = submission.current.key;
    setPendingSubmission(true);
    try {
      await run("paper", async () => {
        const placed = await api("paper/orders", {
          method: "POST",
          headers: { "idempotency-key": key },
          body: {
            ...instrument,
            direction,
            orderType: type,
            quantity: Number(quantity),
            leverage: L,
            ...(type === "limit" ? { limitPrice: Number(limit) } : {}),
            stopLoss: stopValue,
            takeProfit: targetValue,
          },
        });
        submission.current = null;
        setTab(placed.status === "pending" ? "pending" : "positions");
        await refresh();
      });
    } finally {
      setPendingSubmission(false);
    }
  };
  const positions = overview?.orders.filter((o) => o.status === "filled") ?? [],
    pending = overview?.orders.filter((o) => o.status === "pending") ?? [];
  const selected = tab === "positions" ? positions : pending;
  const metric = (label: string, value: unknown) => (
    <div>
      <span>{label}</span>
      <strong>{value as string}</strong>
    </div>
  );
  return (
    <section className="paper-workspace" aria-label={t("paper")}>
      <div className="paper-topline">
        <span className="paper-mode">{t("paperSimulation")}</span>
        <span className="muted">{t("paperRefreshShort")}</span>
        <span className={engineActive ? "positive" : "negative"}>
          {engineActive ? t("paperEngineOnline") : t("paperEngineOffline")}
        </span>
      </div>
      <div className="paper-metrics">
        {metric(t("paperAvailable"), fmt(overview?.account.balance) + " USDT")}
        {metric(t("paperEquity"), fmt(overview?.equity) + " USDT")}
        {metric(
          t("paperUnrealized"),
          fmt(overview?.stats.unrealizedPnl) + " USDT",
        )}
      </div>
      {(demo ||
        stale ||
        (overview && !overview.complete) ||
        (!engineActive && overview)) && (
        <p role="status" className="paper-warning">
          {demo
            ? t("paperDemoBlocked")
            : stale
              ? t("paperStale")
              : !overview?.complete
                ? t("paperMissingQuotes")
                : t("paperWorkerWarning")}
        </p>
      )}
      <div className="paper-layout">
        <section className="paper-ticket" aria-label={t("paperNewOrder")}>
          <header>
            <h3>{t("paperNewOrder")}</h3>
            <strong>{instrument.symbol}</strong>
            <span>
              {instrument.venue} ·{" "}
              {instrument.market === "perpetual" ? "Futures" : "Spot"}
            </span>
          </header>
          <div
            className="paper-direction"
            role="group"
            aria-label={t("direction")}
          >
            {["LONG", "SHORT"].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={direction === d}
                className={direction === d ? d.toLowerCase() : ""}
                onClick={() => setDirection(d)}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="paper-fields">
            <label className="field">
              <span>{t("paperOrderType")}</span>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="market">{t("paperMarketOrder")}</option>
                <option value="limit">{t("paperLimitOrder")}</option>
              </select>
            </label>
            <label className="field">
              <span>{t("leverage")}</span>
              <select
                value={L}
                disabled={instrument.market !== "perpetual"}
                onChange={(e) => setLeverage(Number(e.target.value))}
              >
                {[1, 2, 3, 5, 10, 20].map((n) => (
                  <option key={n} value={n}>
                    {n}×
                  </option>
                ))}
              </select>
            </label>
          </div>
          {instrument.market !== "perpetual" && (
            <button
              type="button"
              className="paper-link"
              onClick={onMarketChange}
            >
              {t("paperEnableFutures")}
            </button>
          )}
          <PriceField
            label={t("quantity")}
            value={quantity}
            set={setQuantity}
          />
          <div className="paper-percent">
            {[0.25, 0.5, 1].map((f) => (
              <button
                key={f}
                disabled={disabled || demo || !reference}
                onClick={() =>
                  setQuantity(
                    String(
                      Math.min(
                        1000000,
                        Math.floor(maxQuantity * f * 1e8) / 1e8,
                      ),
                    ),
                  )
                }
              >
                {f * 100}%
              </button>
            ))}
          </div>
          {type === "limit" && (
            <PriceField
              label={t("paperLimitPrice")}
              value={limit}
              set={setLimit}
            />
          )}
          <details className="paper-advanced">
            <summary>{t("paperProtectionSizing")}</summary>
            <div className="paper-fields">
              <PriceField label={t("stopLoss")} value={stop} set={setStop} />
              <PriceField
                label={t("takeProfit")}
                value={target}
                set={setTarget}
              />
            </div>
            <div className="paper-fields">
              <PriceField label={t("riskPct")} value={risk} set={setRisk} />
              <Button
                variant="outline"
                disabled={
                  disabled ||
                  demo ||
                  !reference ||
                  !stopValue ||
                  wrongStop ||
                  !(Number(risk) > 0 && Number(risk) <= 5)
                }
                onClick={() =>
                  run("paper-size", async () => {
                    const result = await api("risk", {
                      method: "POST",
                      body: {
                        account: balance,
                        riskPct: Number(risk),
                        entry: reference,
                        stop: stopValue,
                        leverage: L,
                        direction,
                        feeBps: 10,
                        slippageBps: 5,
                      },
                    });
                    setQuantity(
                      String(
                        Math.min(
                          1000000,
                          Math.floor(
                            Math.min(result.quantity, maxQuantity) * 1e8,
                          ) / 1e8,
                        ),
                      ),
                    );
                  })
                }
              >
                {t("paperSizeRisk")}
              </Button>
            </div>
            {stopValue != null && reference > 0 && (
              <p className="muted">
                {t("paperPlannedLoss")}:{" "}
                {fmt(
                  (Math.abs(reference - stopValue) +
                    reference * 0.001 +
                    stopValue * 0.001) *
                    Number(quantity),
                )}{" "}
                USDT
              </p>
            )}
          </details>
          <dl className="paper-estimate">
            <div>
              <dt>{t("paperNotional")}</dt>
              <dd>{reference > 0 ? fmt(notional) : "—"} USDT</dd>
            </div>
            <div>
              <dt>{t("paperMargin")}</dt>
              <dd>{reference > 0 ? fmt(margin) : "—"} USDT</dd>
            </div>
            <div>
              <dt>{t("paperEntryFee")}</dt>
              <dd>{reference > 0 ? fmt(fee) : "—"} USDT</dd>
            </div>
            {L > 1 && (
              <div>
                <dt>{t("paperLiquidation")}</dt>
                <dd>{fmt(liquidation, 6)}</dd>
              </div>
            )}
          </dl>
          {(wrongStop || wrongTarget) && (
            <p className="negative" role="alert">
              {t("paperInvalidProtection")}
            </p>
          )}
          {cost > balance && reference > 0 && (
            <p className="negative" role="status">
              {t("paperInsufficient")}
            </p>
          )}
          <Button
            className={"paper-submit " + direction.toLowerCase()}
            disabled={disabled || !valid || demo || stale}
            onClick={submit}
          >
            {type === "limit" ? t("paperPlaceLimit") : t("simulate")} ·{" "}
            {direction} {L}×
          </Button>
        </section>
        <section className="paper-book" aria-label={t("paperPortfolio")}>
          <div
            className="paper-tabs"
            role="tablist"
            aria-label={t("paperPortfolio")}
          >
            {[
              ["positions", t("paperOpenPositions"), positions.length],
              ["pending", t("paperPendingOrders"), pending.length],
              ["history", t("paperHistory"), overview?.exits.length ?? 0],
            ].map(([id, label, count]) => (
              <button
                key={id}
                id={"paper-tab-" + id}
                role="tab"
                aria-selected={tab === id}
                aria-controls="paper-book-panel"
                onClick={() => setTab(String(id))}
              >
                {label} <span>{count}</span>
              </button>
            ))}
          </div>
          <div
            id="paper-book-panel"
            role="tabpanel"
            aria-labelledby={"paper-tab-" + tab}
          >
            {tab !== "history" ? (
              selected.length ? (
                selected.map((o) => (
                  <Position
                    key={o.id}
                    order={o}
                    exposure={overview?.exposure.find((e) => e.id === o.id)}
                    run={run}
                    refresh={refresh}
                    disabled={disabled}
                  />
                ))
              ) : (
                <div className="paper-empty">
                  <strong>{t("paperEmpty")}</strong>
                  <p>
                    {t(
                      tab === "positions"
                        ? "paperEmptyPositionsHint"
                        : "paperEmptyPendingHint",
                    )}
                  </p>
                </div>
              )
            ) : (
              <>
                <p className="muted">{t("paperHistoryLimit")}</p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {[
                          t("symbol"),
                          t("quantity"),
                          t("paperExit"),
                          t("pnl"),
                          t("paperFees"),
                          t("paperReason"),
                          t("date"),
                        ].map((s, n) => (
                          <th key={n}>{s}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {overview?.exits.map((e) => (
                        <tr key={e.id}>
                          <td>{e.symbol}</td>
                          <td>{fmt(e.quantity, 6)}</td>
                          <td>{fmt(e.price, 6)}</td>
                          <td
                            className={
                              Number(e.pnl) >= 0 ? "positive" : "negative"
                            }
                          >
                            {fmt(e.pnl)}
                          </td>
                          <td>
                            {fmt(Number(e.entry_fees) + Number(e.exit_fees))}
                          </td>
                          <td>
                            {t.has("paperReason_" + e.reason)
                              ? t("paperReason_" + e.reason)
                              : e.reason}
                          </td>
                          <td>
                            {new Intl.DateTimeFormat(locale, {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(new Date(e.created_at))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <details className="paper-advanced">
                  <summary>{t("paperOrderHistory")}</summary>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          {[
                            t("symbol"),
                            t("direction"),
                            t("leverage"),
                            t("quantity"),
                            t("status"),
                            t("pnl"),
                          ].map((s, n) => (
                            <th key={n}>{s}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {overview?.orders
                          .filter((o) =>
                            ["closed", "cancelled"].includes(o.status),
                          )
                          .map((o) => (
                            <tr key={o.id}>
                              <td>{o.symbol}</td>
                              <td>{o.direction}</td>
                              <td>{o.leverage ?? 1}×</td>
                              <td>{fmt(o.initial_quantity, 6)}</td>
                              <td>
                                {o.status === "cancelled"
                                  ? t("paperCancelled")
                                  : t("closed")}
                              </td>
                              <td>{fmt(o.pnl)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            )}
          </div>
        </section>
      </div>
      <details className="paper-advanced paper-secondary">
        <summary>{t("paperAccountStats")}</summary>
        <div className="paper-metrics">
          {metric(t("paperReserved"), fmt(overview?.reserved))}
          {metric(t("paperRealized"), fmt(overview?.stats.realizedPnl))}
          {metric(t("drawdown"), fmt(overview?.drawdownPct) + "%")}
          {metric(t("trades"), overview?.stats.closedTrades ?? 0)}
          {metric(
            t("winRate"),
            overview?.stats.winRate == null
              ? "—"
              : fmt(overview.stats.winRate) + "%",
          )}
          {metric(t("paperProfitFactor"), fmt(overview?.stats.profitFactor))}
        </div>
      </details>
      <details className="paper-advanced paper-secondary">
        <summary>{t("paperModelDetails")}</summary>
        <p>{t("paperHint")}</p>
        <p>{t("paperFee")}</p>
        <p>{t("paperProtectionHint")}</p>
        <p>{t("paperLeverageModel")}</p>
      </details>
    </section>
  );
}
