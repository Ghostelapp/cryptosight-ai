"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Star } from "lucide-react";
import { screenMarkets } from "../../../packages/market/screener.mjs";
import { Button } from "./ui/button";

export function MarketScreener({
  tickers,
  watchlist,
  onSelect,
  onToggleWatch,
  locale,
}: {
  tickers: any[];
  watchlist: string[];
  onSelect: (symbol: string) => void;
  onToggleWatch: (symbol: string) => void;
  locale: string;
}) {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [minVolume, setMinVolume] = useState(10000000);
  const [movement, setMovement] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState("volume");
  const [order, setOrder] = useState("desc");
  const [limit, setLimit] = useState(50);
  const rows = screenMarkets(tickers, {
    search,
    minVolume,
    movement,
    favoritesOnly,
    watchlist,
    sort,
    order,
  });
  const fmt = (value: number | null, compact = false) =>
    value == null || !Number.isFinite(value)
      ? "—"
      : new Intl.NumberFormat(locale, {
          ...(compact ? { notation: "compact" as const } : {}),
          maximumFractionDigits: !compact && value > 0 && value < 1 ? 6 : 2,
        }).format(value);
  const reset = () => {
    setSearch("");
    setMinVolume(10000000);
    setMovement("all");
    setFavoritesOnly(false);
    setSort("volume");
    setOrder("desc");
    setLimit(50);
  };
  return (
    <section className="market-screener" aria-label={t("screener")}>
      <div className="form-row screener-filters">
        <label className="field">
          <span>{t("search")}</span>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(50);
            }}
          />
        </label>
        <label className="field">
          <span>{t("minimumVolume")}</span>
          <input
            type="number"
            min="0"
            value={minVolume}
            onChange={(e) => {
              setMinVolume(Math.max(0, Number(e.target.value)));
              setLimit(50);
            }}
          />
        </label>
        <label className="field">
          <span>{t("marketMovement")}</span>
          <select
            value={movement}
            onChange={(e) => {
              setMovement(e.target.value);
              setLimit(50);
            }}
          >
            <option value="all">{t("allMarkets")}</option>
            <option value="gainers">{t("gainers")}</option>
            <option value="losers">{t("losers")}</option>
          </select>
        </label>
        <label className="screener-favorites">
          <input
            type="checkbox"
            checked={favoritesOnly}
            onChange={(e) => {
              setFavoritesOnly(e.target.checked);
              setLimit(50);
            }}
          />
          {t("favoritesOnly")}
        </label>
        <Button variant="outline" onClick={reset}>
          {t("resetFilters")}
        </Button>
      </div>
      <p className="muted screener-count" role="status">
        {t("marketResults", {
          shown: Math.min(limit, rows.length),
          total: rows.length,
        })}
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>
                <span className="sr-only">{t("watchlist")}</span>
              </th>
              {["symbol", "price", "change", "volume"].map((field) => (
                <th
                  key={field}
                  aria-sort={
                    sort === field
                      ? order === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    className="sort-button"
                    onClick={() => {
                      setSort(field);
                      setOrder(
                        sort === field && order === "desc" ? "asc" : "desc",
                      );
                    }}
                  >
                    {t(field)}
                    {sort === field &&
                      (order === "asc" ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      ))}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((row) => (
              <tr key={row.symbol}>
                <td>
                  <button
                    className={
                      "icon-button star " +
                      (watchlist.includes(row.symbol) ? "saved" : "")
                    }
                    aria-label={`${t("watchlist")} ${row.symbol}`}
                    aria-pressed={watchlist.includes(row.symbol)}
                    onClick={() => onToggleWatch(row.symbol)}
                  >
                    <Star size={16} />
                  </button>
                </td>
                <td>
                  <button
                    className="text-button"
                    onClick={() => onSelect(row.symbol)}
                  >
                    {row.symbol}
                  </button>
                </td>
                <td>{fmt(row.price)}</td>
                <td
                  className={
                    row.change == null
                      ? "muted"
                      : row.change >= 0
                        ? "positive"
                        : "negative"
                  }
                >
                  {fmt(row.change)}
                  {Number.isFinite(row.change) ? "%" : ""}
                </td>
                <td>{fmt(row.volume, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <div className="screener-empty">
          <p>{t(tickers.length ? "noMarketMatches" : "noMarketData")}</p>
          {tickers.length > 0 && (
            <Button variant="outline" onClick={reset}>
              {t("resetFilters")}
            </Button>
          )}
        </div>
      )}
      {rows.length > limit && (
        <Button variant="outline" onClick={() => setLimit((v) => v + 50)}>
          {t("showMore")}
        </Button>
      )}
    </section>
  );
}
