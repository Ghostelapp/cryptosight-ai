import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Share, Text, View } from "react-native";
import { sampleCandles } from "../../../packages/market/sample.mjs";
import { screenMarkets } from "../../../packages/market/screener.mjs";
import {
  Card,
  Choices,
  Field,
  Heading,
  Label,
  Loading,
  Metrics,
  Notice,
  Button,
  colors,
  s,
  useMobile,
  useRemote,
} from "./ui";
import { number } from "./i18n";
import { CandleChart } from "./charts";
import type { Candle, Ticker } from "./types";

export function MarketScreen() {
  const {
    api,
    t,
    locale,
    instrument,
    selectInstrument,
    user,
    demo,
    busy,
    run,
  } = useMobile();
  const [search, setSearch] = useState(""),
    [movement, setMovement] = useState("all"),
    [favorites, setFavorites] = useState(false),
    [pairOpen, setPairOpen] = useState(false);
  const markets = useRemote<Ticker[]>(
    `markets?venue=${instrument.venue}&market=${instrument.market}`,
    true,
    15000,
  );
  const watch = useRemote<{ symbol: string; venue: string; market: string }[]>(
    "watchlist",
    !!user,
  );
  const chart = useRemote<{ candles: Candle[]; indicators: any }>(
    "candles?" +
      new URLSearchParams({
        ...instrument,
        limit: "240",
        fallback: "false",
        period: "20",
      }).toString(),
    true,
    15000,
  );
  const demoBars = useMemo(
    () => sampleCandles(instrument.timeframe),
    [instrument.timeframe],
  );
  const demoQuotes: Ticker[] = [
    {
      symbol: "BTCUSDT",
      price: demoBars.at(-1)!.close,
      change: (demoBars.at(-1)!.close / demoBars.at(-25)!.close - 1) * 100,
      volume: 15000000,
    },
  ];
  const quotes = demo ? demoQuotes : markets.data || [];
  const bars = demo ? demoBars : chart.data?.candles || [];
  const quote = quotes.find((q) => q.symbol === instrument.symbol);
  const watched =
    watch.data
      ?.filter(
        (w) => w.venue === instrument.venue && w.market === instrument.market,
      )
      .map((w) => w.symbol) || [];
  const rows = screenMarkets(quotes, {
    search,
    movement,
    favoritesOnly: favorites,
    watchlist: watched,
    sort: "volume",
    order: "desc",
  });
  const choose = (symbol: string) => {
    selectInstrument({ symbol });
    setPairOpen(false);
  };
  const toggleWatch = (symbol: string) =>
    void run(async () => {
      await api.request("watchlist", {
        method: watched.includes(symbol) ? "DELETE" : "POST",
        body: { ...instrument, symbol },
      });
      await watch.refetch();
    });
  return (
    <>
      <Card>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <View>
            <Heading>{instrument.symbol.replace("USDT", " / USDT")}</Heading>
            <Label muted>
              {instrument.venue} · {t(instrument.market)}
            </Label>
          </View>
          {!demo && (
            <Button
              title={t("mobileExchangeHint")}
              secondary
              onPress={() => setPairOpen(true)}
            />
          )}
        </View>
        <Text style={{ color: colors.text, fontSize: 35, fontWeight: "700" }}>
          {number(
            locale,
            bars.at(-1)?.close ?? quote?.price,
            (quote?.price || 100) < 1 ? 6 : 2,
          )}
        </Text>
        <View style={s.row}>
          <Text
            style={{
              color: (quote?.change || 0) >= 0 ? colors.green : colors.red,
              fontSize: 17,
            }}
          >
            {number(locale, quote?.change)}
            {quote ? "%" : ""}
          </Text>
          <Label muted>{t("change")}</Label>
        </View>
        {!demo && (
          <Choices
            label={t("venue")}
            value={instrument.venue}
            options={["binance", "bybit", "okx"].map((value) => ({
              value,
              label: value,
            }))}
            onChange={(venue) => selectInstrument({ venue })}
          />
        )}
        {!demo && (
          <Choices
            label={t("spot")}
            value={instrument.market}
            options={["spot", "perpetual"].map((value) => ({
              value,
              label: t(value),
            }))}
            onChange={(market) => selectInstrument({ market })}
          />
        )}
        <Choices
          label={t("timeframe")}
          value={instrument.timeframe}
          options={["1m", "5m", "15m", "1h", "4h", "1d"].map((value) => ({
            value,
            label: value,
          }))}
          onChange={(timeframe) => selectInstrument({ timeframe })}
        />
        <Loading loading={chart.loading && !bars.length} />
        {bars.length ? (
          <CandleChart candles={bars} />
        ) : (
          <Notice>{t("mobileNoQuotes")}</Notice>
        )}
        {!!chart.error && <Notice error>{chart.error}</Notice>}
        <Label muted>{t("mobileRefreshHint")}</Label>
        {!!chart.updatedAt && (
          <Label muted>
            {t("mobileLatest")}:{" "}
            {new Date(chart.updatedAt).toLocaleTimeString(locale)}
          </Label>
        )}
        <View style={s.wrap}>
          <Button
            title={t("refresh")}
            disabled={chart.loading || demo}
            secondary
            onPress={() => {
              void chart.refetch();
              void markets.refetch();
            }}
          />
          <Button
            title={t("mobileShare")}
            disabled={!bars.length}
            secondary
            onPress={() =>
              void Share.share({
                message: `${demo ? t("mobileSample") + " · " : ""}CryptoSight AI · ${instrument.symbol} · ${instrument.timeframe}\n${number(locale, bars.at(-1)?.close, 6)} USDT${!demo ? "\n" + api.baseUrl : ""}`,
              })
            }
          />
        </View>
      </Card>
      {!demo && (
        <Metrics
          values={[
            {
              label: "RSI (20)",
              value: number(locale, chart.data?.indicators?.RSI, 1),
            },
            { label: t("volume"), value: number(locale, quote?.volume, 0) },
          ]}
        />
      )}
      <Heading>{t("screener")}</Heading>
      <Field
        label={t("search")}
        value={search}
        onChangeText={setSearch}
        autoCapitalize="characters"
      />
      <Choices
        label={t("marketMovement")}
        value={movement}
        onChange={setMovement}
        options={["all", "gainers", "losers"].map((value) => ({
          value,
          label: t(value === "all" ? "allMarkets" : value),
        }))}
      />
      {!!user && (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: favorites }}
          onPress={() => setFavorites((v) => !v)}
          style={s.chip}
        >
          <Label>
            {favorites ? "★ " : "☆ "}
            {t("favoritesOnly")}
          </Label>
        </Pressable>
      )}
      {!!markets.error && <Notice error>{markets.error}</Notice>}
      <Card>
        {!rows.length && <Label muted>{t("noMarketMatches")}</Label>}
        {rows.slice(0, 40).map((row) => (
          <View key={row.symbol} style={s.listRow}>
            <Pressable
              style={{ flex: 1 }}
              accessibilityRole="button"
              accessibilityLabel={row.symbol}
              onPress={() => choose(row.symbol)}
            >
              <Label>{row.symbol.replace("USDT", " / USDT")}</Label>
              <Label muted>
                {number(
                  locale,
                  row.price,
                  row.price != null && row.price < 1 ? 6 : 2,
                )}
              </Label>
            </Pressable>
            <Text
              style={{
                color: (row.change || 0) >= 0 ? colors.green : colors.red,
              }}
            >
              {number(locale, row.change)}%
            </Text>
            {!!user && (
              <Pressable
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t("watchlist") + " " + row.symbol}
                onPress={() => toggleWatch(row.symbol)}
                style={s.chip}
              >
                <Text style={{ color: colors.cyan }}>
                  {watched.includes(row.symbol) ? "★" : "☆"}
                </Text>
              </Pressable>
            )}
          </View>
        ))}
      </Card>
      <Modal
        visible={pairOpen}
        onRequestClose={() => setPairOpen(false)}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <ScrollView
          style={s.container}
          contentContainerStyle={[s.content, { paddingTop: 55 }]}
        >
          <Heading>{t("mobileExchangeHint")}</Heading>
          <Button
            title={t("close")}
            secondary
            onPress={() => setPairOpen(false)}
          />
          <Field
            label={t("search")}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="characters"
          />
          {quotes
            .filter((row) => row.symbol.includes(search.toUpperCase().trim()))
            .slice(0, 80)
            .map((row) => (
              <Pressable
                key={row.symbol}
                accessibilityRole="button"
                onPress={() => choose(row.symbol)}
                style={s.listRow}
              >
                <Label>{row.symbol}</Label>
                <Label>{number(locale, row.price, 6)}</Label>
              </Pressable>
            ))}
        </ScrollView>
      </Modal>
    </>
  );
}
