import { useEffect, useState } from "react";
import { Alert } from "react-native";
import * as Crypto from "expo-crypto";
import { mutationIntents } from "./api.mjs";
import {
  AuthGate,
  Button,
  Card,
  Choices,
  Field,
  Heading,
  Label,
  Loading,
  Metrics,
  Notice,
  useMobile,
  useRemote,
} from "./ui";
import { number } from "./i18n";
import type { PaperOrder, PaperOverview } from "./types";

function Position({
  order,
  refresh,
  stale,
  intents,
}: {
  order: PaperOrder;
  refresh: () => Promise<void>;
  stale: boolean;
  intents: ReturnType<typeof mutationIntents>;
}) {
  const { api, t, locale, busy, run } = useMobile();
  const [stop, setStop] = useState(order.stop_loss || ""),
    [target, setTarget] = useState(order.take_profit || "");
  const close = (fraction: number) =>
    Alert.alert(
      t("mobileCloseConfirm"),
      `${order.symbol} · ${fraction * 100}%\n${t("mobileNoRealOrders")}`,
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("close"),
          onPress: () =>
            void run(async () => {
              const body =
                  fraction === 1
                    ? {}
                    : { quantity: Number(order.quantity) * fraction },
                name = "close:" + order.id + ":" + order.version;
              await api.request("paper-close/" + order.id, {
                method: "POST",
                body,
                key: intents.key(name, body),
              });
              intents.done(name);
              await refresh();
            }),
        },
      ],
    );
  return (
    <Card>
      <Heading>
        {order.symbol} · {order.direction}
      </Heading>
      <Label>
        {t(order.status)} · {t("quantity")}: {number(locale, order.quantity, 8)}
      </Label>
      <Label>
        {t("entry")}: {number(locale, order.fill_price ?? order.limit_price, 6)}
      </Label>
      {!!order.pending_exit && <Notice>{t("paperExitPending")}</Notice>}
      <Field
        label={t("stopLoss")}
        value={stop}
        keyboardType="decimal-pad"
        onChangeText={(v) => setStop(v.replace(",", "."))}
      />
      <Field
        label={t("takeProfit")}
        value={target}
        keyboardType="decimal-pad"
        onChangeText={(v) => setTarget(v.replace(",", "."))}
      />
      <Button
        title={t("paperSaveProtection")}
        secondary
        disabled={busy || stale || !!order.pending_exit}
        onPress={() =>
          void run(async () => {
            await api.request("paper-protection/" + order.id, {
              method: "PATCH",
              body: {
                version: order.version,
                stopLoss: stop ? Number(stop) : null,
                takeProfit: target ? Number(target) : null,
              },
            });
            await refresh();
          })
        }
      />
      {order.status === "pending" ? (
        <Button
          title={t("paperCancelOrder")}
          secondary
          disabled={busy}
          onPress={() =>
            void run(async () => {
              await api.request("paper-cancel/" + order.id, {
                method: "POST",
                body: {},
              });
              await refresh();
            })
          }
        />
      ) : (
        [0.25, 0.5, 1].map((fraction) => (
          <Button
            key={fraction}
            title={t("close") + " " + fraction * 100 + "%"}
            secondary
            disabled={
              busy ||
              stale ||
              !!order.pending_exit ||
              Number(order.quantity) * fraction < 1e-8
            }
            onPress={() => close(fraction)}
          />
        ))
      )}
    </Card>
  );
}
function Portfolio() {
  const { api, t, locale, instrument, busy, run, active } = useMobile();
  const overview = useRemote<PaperOverview>("paper/account", true, 10000),
    [intents] = useState(() => mutationIntents(Crypto.randomUUID));
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [active]);
  const [direction, setDirection] = useState("LONG"),
    [orderType, setType] = useState("market"),
    [quantity, setQuantity] = useState(""),
    [limit, setLimit] = useState(""),
    [stop, setStop] = useState(""),
    [target, setTarget] = useState("");
  const account = overview.data,
    stale = !account || !!overview.error || now - overview.updatedAt > 45000;
  const place = () =>
    Alert.alert(
      t("mobilePaperConfirm"),
      `${instrument.symbol} · ${direction} · ${quantity}\n${t("mobileNoRealOrders")}`,
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("simulate"),
          onPress: () =>
            void run(async () => {
              if (Date.now() - overview.updatedAt > 45000)
                throw new Error("mobileDataStale");
              const body = {
                ...instrument,
                direction,
                orderType,
                quantity: Number(quantity),
                ...(orderType === "limit" ? { limitPrice: Number(limit) } : {}),
                stopLoss: stop ? Number(stop) : null,
                takeProfit: target ? Number(target) : null,
              };
              await api.request("paper/orders", {
                method: "POST",
                body,
                key: intents.key("place", body),
              });
              intents.done("place");
              setQuantity("");
              await overview.refetch();
            }),
        },
      ],
    );
  return (
    <>
      <Heading>{t("paper")}</Heading>
      <Notice>{t("paperHint")}</Notice>
      <Loading loading={overview.loading && !account} />
      {!!overview.error && <Notice error>{overview.error}</Notice>}
      {!!account && (
        <>
          <Metrics
            values={[
              {
                label: t("balance"),
                value: number(locale, account.account.balance) + " USDT",
              },
              {
                label: t("account"),
                value: number(locale, account.equity) + " USDT",
              },
              {
                label: t("paperRealized"),
                value: number(locale, account.stats.realizedPnl),
              },
              {
                label: t("paperUnrealized"),
                value: number(locale, account.stats.unrealizedPnl),
              },
              {
                label: t("winRate"),
                value:
                  number(locale, account.stats.winRate) +
                  (account.stats.winRate == null ? "" : "%"),
              },
              {
                label: t("paperReserved"),
                value: number(locale, account.reserved),
              },
            ]}
          />
          {!account.engineActive && <Notice>{t("paperWorkerWarning")}</Notice>}
          {!account.complete && <Notice>{t("paperMissingQuotes")}</Notice>}
        </>
      )}
      <Button
        title={t("refresh")}
        disabled={overview.loading}
        secondary
        onPress={() => void overview.refetch()}
      />
      <Card>
        <Heading>
          {instrument.symbol} · {instrument.venue}
        </Heading>
        <Choices
          label={t("direction")}
          value={direction}
          onChange={setDirection}
          options={["LONG", "SHORT"].map((value) => ({ value, label: value }))}
        />
        <Choices
          label={t("paperOrderType")}
          value={orderType}
          onChange={setType}
          options={[
            { value: "market", label: t("paperMarketOrder") },
            { value: "limit", label: t("paperLimitOrder") },
          ]}
        />
        <Field
          label={t("quantity")}
          value={quantity}
          onChangeText={(v) => setQuantity(v.replace(",", "."))}
          keyboardType="decimal-pad"
        />
        {orderType === "limit" && (
          <Field
            label={t("paperLimitPrice")}
            value={limit}
            onChangeText={(v) => setLimit(v.replace(",", "."))}
            keyboardType="decimal-pad"
          />
        )}
        <Field
          label={t("stopLoss")}
          value={stop}
          onChangeText={(v) => setStop(v.replace(",", "."))}
          keyboardType="decimal-pad"
        />
        <Field
          label={t("takeProfit")}
          value={target}
          onChangeText={(v) => setTarget(v.replace(",", "."))}
          keyboardType="decimal-pad"
        />
        {stale && <Notice>{t("mobileDataStale")}</Notice>}
        <Button
          title={t("simulate")}
          disabled={
            busy ||
            stale ||
            !(Number(quantity) > 0) ||
            (orderType === "limit" && !(Number(limit) > 0))
          }
          onPress={place}
        />
      </Card>
      <Heading>{t("paperOpenPositions")}</Heading>
      {account?.orders
        .filter((o) => ["filled", "pending"].includes(o.status))
        .map((order) => (
          <Position
            key={order.id + ":" + order.version}
            order={order}
            refresh={overview.refetch}
            stale={stale}
            intents={intents}
          />
        ))}
      <Card>
        <Heading>{t("paperHistory")}</Heading>
        {!account?.exits.length && <Label muted>{t("empty")}</Label>}
        {account?.exits.slice(0, 30).map((exit) => (
          <Label key={exit.id}>
            {exit.symbol} · {number(locale, exit.quantity, 8)} ×{" "}
            {number(locale, exit.price, 6)} · {t("pnl")}:{" "}
            {number(locale, exit.pnl)} USDT
          </Label>
        ))}
      </Card>
    </>
  );
}
export function PaperScreen() {
  return (
    <AuthGate>
      <Portfolio />
    </AuthGate>
  );
}
