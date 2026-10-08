"use client";
import { useState, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api, type Instrument } from "../lib/client";
import { Button } from "./ui/button";

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
  close_price: string | null;
  reserved: string;
  version: number;
  pending_exit: string | null;
  close_reason: string | null;
};
type Exit = {
  symbol: string;
  id: string;
  order_id: string;
  created_at: string;
  quantity: string;
  price: string;
  pnl: string;
  exit_fees: string;
  entry_fees: string;
  reason: string;
};
type Exposure = {
  id: string;
  mark: number | null;
  unrealizedPnl: number | null;
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
  engineActive: boolean;
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
  const fmt = (v: unknown) =>
    v == null
      ? "—"
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(
          Number(v),
        );
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
    <article className="form-card">
      <div className="stats-grid">
        <strong>
          {order.symbol} · {order.direction}
        </strong>
        <span>
          {t("quantity")}: {fmt(order.quantity)}
        </span>
        <span>
          {order.status === "pending" ? t("paperLimitPrice") : t("entry")}:{" "}
          {fmt(order.fill_price ?? order.limit_price)}
        </span>
        <span>
          {t("price")}: {fmt(exposure?.mark)}
        </span>
        <strong
          className={
            (exposure?.unrealizedPnl ?? 0) >= 0 ? "positive" : "negative"
          }
        >
          {t("pnl")}: {fmt(exposure?.unrealizedPnl)} USDT
        </strong>
      </div>
      <p className="muted">
        {order.venue} · {order.market} · {t("paperRealized")}:{" "}
        {fmt(order.pnl ?? 0)} USDT
      </p>
      {order.status === "pending" && (
        <p>
          {t("paperReserved")}: {fmt(order.reserved)} USDT
        </p>
      )}
      {order.pending_exit && (
        <div className="event-notice">{t("paperExitPending")}</div>
      )}
      <div className="form-grid">
        <PriceField label={t("stopLoss")} value={stop} set={setStop} />
        <PriceField label={t("takeProfit")} value={target} set={setTarget} />
      </div>
      <div className="paper-actions">
        <Button
          disabled={disabled || Boolean(order.pending_exit)}
          variant="outline"
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
        {order.status === "pending" ? (
          <Button
            disabled={disabled}
            variant="outline"
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
          [0.25, 0.5, 1].map((fraction) => (
            <Button
              key={fraction}
              disabled={
                disabled ||
                (fraction !== 1 && Number(order.quantity) * fraction < 1e-8)
              }
              variant="outline"
              onClick={() => close(fraction)}
            >
              {t("close")} {fraction * 100}%
            </Button>
          ))
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
}: {
  overview: Overview | null;
  instrument: Instrument;
  mark: number;
  demo: boolean;
  busy: string;
  run: Run;
  refresh: () => Promise<void>;
}) {
  const t = useTranslations(),
    locale = useLocale();
  const [direction, setDirection] = useState("LONG"),
    [type, setType] = useState("market"),
    [quantity, setQuantity] = useState("0.01"),
    [limit, setLimit] = useState(""),
    [stop, setStop] = useState(""),
    [target, setTarget] = useState(""),
    [risk, setRisk] = useState("1");
  const [pendingSubmission, setPendingSubmission] = useState(false);
  const submission = useRef<{ payload: string; key: string } | null>(null);
  const [now, setNow] = useState(0);
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
  const reference = type === "limit" ? Number(limit) : mark;
  const cost = reference * Number(quantity) * 1.001;
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
    Number(quantity) >= 1e-8 &&
    Number(quantity) <= 1000000 &&
    reference > 0 &&
    !wrongStop &&
    !wrongTarget &&
    cost <= Number(overview?.account.balance ?? 0);
  const disabled = Boolean(busy) || pendingSubmission;
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
    ]);
    if (submission.current?.payload !== payload)
      submission.current = { payload, key: crypto.randomUUID() };
    const key = submission.current.key;
    setPendingSubmission(true);
    try {
      await run("paper", async () => {
        await api("paper/orders", {
          method: "POST",
          headers: { "idempotency-key": key },
          body: {
            ...instrument,
            direction,
            orderType: type,
            quantity: Number(quantity),
            ...(type === "limit" ? { limitPrice: Number(limit) } : {}),
            stopLoss: stopValue,
            takeProfit: targetValue,
          },
        });
        submission.current = null;
        await refresh();
      });
    } finally {
      setPendingSubmission(false);
    }
  };
  const metric = (label: string, value: unknown) => (
    <div className="stat">
      <span>{label}</span>
      <strong>{value as string}</strong>
    </div>
  );
  return (
    <>
      <div className="event-notice">{t("paperHint")}</div>
      <p className="muted">{t("paperRefresh")}</p>
      {demo && <div className="event-notice">{t("paperDemoBlocked")}</div>}
      {overview && !engineActive && (
        <div className="event-notice">{t("paperWorkerWarning")}</div>
      )}
      {stale && <div className="event-notice">{t("paperStale")}</div>}
      {overview && !overview.complete && (
        <div className="event-notice">{t("paperMissingQuotes")}</div>
      )}
      <div className="stats-grid">
        {metric(t("balance"), fmt(overview?.account.balance))}
        {metric(t("paperReserved"), fmt(overview?.reserved))}
        {metric(t("account"), fmt(overview?.equity))}
        {metric(t("drawdown"), fmt(overview?.drawdownPct) + "%")}
        {metric(t("paperRealized"), fmt(overview?.stats.realizedPnl))}
        {metric(t("paperUnrealized"), fmt(overview?.stats.unrealizedPnl))}
        {metric(t("trades"), overview?.stats.closedTrades ?? 0)}
        {metric(
          t("winRate"),
          overview?.stats.winRate == null
            ? "—"
            : fmt(overview.stats.winRate) + "%",
        )}
        {metric(t("paperProfitFactor"), fmt(overview?.stats.profitFactor))}
      </div>
      <div className="form-card">
        <h3>
          {instrument.symbol} · {instrument.venue} · {instrument.market}
        </h3>
        <div className="form-grid">
          <label className="field">
            <span>{t("direction")}</span>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              <option value="LONG">{t("paperLong")}</option>
              <option value="SHORT">{t("paperShort")}</option>
            </select>
          </label>
          <label className="field">
            <span>{t("paperOrderType")}</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="market">{t("paperMarketOrder")}</option>
              <option value="limit">{t("paperLimitOrder")}</option>
            </select>
          </label>
          <PriceField
            label={t("quantity")}
            value={quantity}
            set={setQuantity}
          />
          {type === "limit" && (
            <PriceField
              label={t("paperLimitPrice")}
              value={limit}
              set={setLimit}
            />
          )}
          <PriceField label={t("stopLoss")} value={stop} set={setStop} />
          <PriceField label={t("takeProfit")} value={target} set={setTarget} />
          <PriceField label={t("riskPct")} value={risk} set={setRisk} />
        </div>
        <div className="paper-actions">
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
                    account: Number(overview?.account.balance ?? 0),
                    riskPct: Number(risk),
                    entry: reference,
                    stop: stopValue,
                    leverage: 1,
                    direction,
                    feeBps: 10,
                    slippageBps: 5,
                  },
                });
                setQuantity(
                  String(
                    Math.min(
                      result.quantity,
                      Number(overview?.account.balance ?? 0) /
                        (reference * 1.001),
                    ),
                  ),
                );
              })
            }
          >
            {t("paperSizeRisk")}
          </Button>
          {[0.25, 0.5, 1].map((fraction) => (
            <Button
              key={fraction}
              variant="outline"
              disabled={disabled || !reference || demo}
              onClick={() =>
                setQuantity(
                  String(
                    (Number(overview?.account.balance ?? 0) * fraction) /
                      (reference * 1.001),
                  ),
                )
              }
            >
              {fraction * 100}%
            </Button>
          ))}
        </div>
        <p className="muted">
          {t("paperEstimate")}: {reference > 0 ? fmt(cost) : "—"} USDT ·{" "}
          {t("paperFee")}
        </p>
        {stopValue != null && reference > 0 && (
          <p className="muted">
            {t("paperPlannedLoss")}:{" "}
            {fmt(
              (Math.abs(reference - stopValue) +
                reference * 0.001 +
                stopValue * 0.001) *
                Number(quantity),
            )}{" "}
            USDT{" "}
            {targetValue != null && (
              <>
                {" "}
                · {t("riskReward")}:{" "}
                {fmt(
                  Math.max(
                    0,
                    Math.abs(targetValue - reference) -
                      reference * 0.001 -
                      targetValue * 0.001,
                  ) /
                    (Math.abs(reference - stopValue) +
                      reference * 0.001 +
                      stopValue * 0.001),
                )}
              </>
            )}
          </p>
        )}
        {(wrongStop || wrongTarget) && (
          <p className="negative">{t("paperInvalidProtection")}</p>
        )}
        <p className="muted">{t("paperProtectionHint")}</p>
        <Button disabled={disabled || !valid || demo || stale} onClick={submit}>
          {type === "limit" ? t("paperPlaceLimit") : t("simulate")}
        </Button>
      </div>
      <h3>{t("paperPendingOrders")}</h3>
      {overview?.orders
        .filter((o) => o.status === "pending")
        .map((o) => (
          <Position
            key={o.id + ":" + o.version}
            order={o}
            run={run}
            refresh={refresh}
            disabled={disabled}
          />
        ))}
      {!overview?.orders.some((o) => o.status === "pending") && (
        <p className="muted">{t("paperEmpty")}</p>
      )}
      <h3>{t("paperOpenPositions")}</h3>
      {overview?.orders
        .filter((o) => o.status === "filled")
        .map((o) => (
          <Position
            key={o.id + ":" + o.version}
            order={o}
            exposure={overview.exposure.find((e) => e.id === o.id)}
            run={run}
            refresh={refresh}
            disabled={disabled}
          />
        ))}
      {!overview?.orders.some((o) => o.status === "filled") && (
        <p className="muted">{t("paperEmpty")}</p>
      )}
      <h3>{t("paperHistory")}</h3>
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
              ].map((label, index) => (
                <th key={index}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {overview?.exits.map((e) => (
              <tr key={e.id}>
                <td>{e.symbol}</td>
                <td>{fmt(e.quantity, 6)}</td>
                <td>{fmt(e.price, 6)}</td>
                <td className={Number(e.pnl) >= 0 ? "positive" : "negative"}>
                  {fmt(e.pnl)}
                </td>
                <td>{fmt(Number(e.entry_fees) + Number(e.exit_fees))}</td>
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
      <details>
        <summary>{t("paperOrderHistory")}</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  t("symbol"),
                  t("direction"),
                  t("quantity"),
                  t("status"),
                  t("pnl"),
                ].map((label, index) => (
                  <th key={index}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overview?.orders
                .filter((o) => ["closed", "cancelled"].includes(o.status))
                .map((o) => (
                  <tr key={o.id}>
                    <td>{o.symbol}</td>
                    <td>{o.direction}</td>
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
  );
}
