import { query } from "./store.mjs";
export async function storeCandles(data) {
  if (!data.candles.length) return;
  const i = data.instrument;
  const rows = data.candles.map((c) => ({
    ...c,
    open_time: new Date(c.timestamp).toISOString(),
  }));
  await query(
    `INSERT INTO candles(venue,market,symbol,timeframe,open_time,open,high,low,close,volume,closed) SELECT $1,$2,$3,$4,x.open_time,x.open,x.high,x.low,x.close,x.volume,x.closed FROM jsonb_to_recordset($5::jsonb) AS x(open_time timestamptz,open numeric,high numeric,low numeric,close numeric,volume numeric,closed boolean) ON CONFLICT(venue,market,symbol,timeframe,open_time) DO UPDATE SET open=EXCLUDED.open,high=EXCLUDED.high,low=EXCLUDED.low,close=EXCLUDED.close,volume=EXCLUDED.volume,closed=EXCLUDED.closed WHERE NOT candles.closed OR EXCLUDED.closed`,
    [i.venue, i.market, i.symbol, i.timeframe, JSON.stringify(rows)],
  );
}
export async function cachedCandles(i, from, to, limit = 500) {
  const r = await query(
    "SELECT * FROM candles WHERE venue=$1 AND market=$2 AND symbol=$3 AND timeframe=$4 AND open_time BETWEEN $5 AND $6 ORDER BY open_time DESC LIMIT $7",
    [
      i.venue,
      i.market,
      i.symbol,
      i.timeframe,
      new Date(from),
      new Date(to),
      limit,
    ],
  );
  return r.rows.reverse().map((b) => ({
    timestamp: +new Date(b.open_time),
    open: +b.open,
    high: +b.high,
    low: +b.low,
    close: +b.close,
    volume: +b.volume,
    closed: b.closed,
  }));
}
