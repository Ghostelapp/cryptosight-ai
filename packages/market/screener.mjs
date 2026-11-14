/**
 * @param {{symbol: string, price: number | null, volume: number, change: number | null}[]} tickers
 * @param {{search?: string, minVolume?: number, movement?: string, favoritesOnly?: boolean, watchlist?: string[], sort?: string, order?: string}} options
 */
export function screenMarkets(
  tickers,
  {
    search = "",
    minVolume = 0,
    movement = "all",
    favoritesOnly = false,
    watchlist = [],
    sort = "volume",
    order = "desc",
  } = {},
) {
  const term = search.trim().toUpperCase();
  const field = ["symbol", "price", "change", "volume"].includes(sort)
    ? sort
    : "volume";
  return tickers
    .filter(
      (row) =>
        typeof row.symbol === "string" &&
        row.symbol.includes(term) &&
        Number.isFinite(row.volume) &&
        row.volume >= minVolume &&
        (!favoritesOnly || watchlist.includes(row.symbol)) &&
        (movement === "all" ||
          (Number.isFinite(row.change) &&
            (movement === "gainers" ? row.change > 0 : row.change < 0))),
    )
    .sort((a, b) => {
      if (field === "symbol")
        return (order === "asc" ? 1 : -1) * a.symbol.localeCompare(b.symbol);
      const av = a[field],
        bv = b[field];
      // Missing quotes always go last, including ascending order.
      if (!Number.isFinite(av))
        return Number.isFinite(bv) ? 1 : a.symbol.localeCompare(b.symbol);
      if (!Number.isFinite(bv)) return -1;
      return (
        (order === "asc" ? av - bv : bv - av) ||
        a.symbol.localeCompare(b.symbol)
      );
    });
}
