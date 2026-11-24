import { tickers, history } from "../market/providers.mjs";
import { indicators } from "../quant/indicators.mjs";
import { evaluateCandidate, confirmationFrame } from "../quant/candidates.mjs";
import { cached } from "./cache.mjs";
import { closedBars } from "../quant/evidence.mjs";
const inflight = new Map();
const stablecoins = new Set([
  "USDCUSDT",
  "FDUSDUSDT",
  "TUSDUSDT",
  "USDEUSDT",
  "DAIUSDT",
  "USD1USDT",
  "USDPUSDT",
]);

export async function collectCandidates(
  config,
  feeds = { tickers, history, indicators },
) {
  const {
    venue,
    market,
    timeframe,
    minVolume = 10000000,
    limit = 24,
    direction = "all",
  } = config;
  const generatedAt = new Date().toISOString(),
    deadline = Date.now() + 20000;
  const quotes = await feeds.tickers(venue, market);
  const universe = quotes
    .filter(
      (q) =>
        /^[A-Z0-9]{2,20}USDT$/.test(q.symbol) &&
        !stablecoins.has(q.symbol) &&
        !/(?:[235][LS]|BULL|BEAR)USDT$/.test(q.symbol) &&
        q.volume >= minVolume &&
        Number.isFinite(q.volume) &&
        Number.isFinite(q.price) &&
        q.price > 0,
    )
    .sort((a, b) => b.volume - a.volume || a.symbol.localeCompare(b.symbol))
    .slice(0, limit);
  const results = [];
  let cursor = 0,
    scanned = 0,
    failed = 0,
    skipped = 0;
  async function worker() {
    while (cursor < universe.length && Date.now() < deadline) {
      const quote = universe[cursor++],
        instrument = { venue, market, timeframe, symbol: quote.symbol };
      try {
        const pair = await Promise.allSettled([
          feeds.history(instrument, { limit: 220 }),
          feeds.history(
            { ...instrument, timeframe: confirmationFrame(timeframe) },
            { limit: 220 },
          ),
        ]);
        if (pair.some((result) => result.status === "rejected"))
          throw new Error("provider_unavailable");
        const [primary, confirmation] = pair.map((result) => result.value);
        const result = evaluateCandidate({
          instrument,
          primary,
          confirmation,
          indicators: feeds.indicators(closedBars(primary.candles, timeframe)),
          confirmationIndicators: feeds.indicators(
            closedBars(confirmation.candles, confirmationFrame(timeframe)),
          ),
          volume: quote.volume,
        });
        scanned++;
        if (result && (direction === "all" || result.direction === direction))
          results.push(result);
        else skipped++;
      } catch {
        failed++;
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(4, universe.length) }, worker),
  );
  const ranked = results.sort(
    (a, b) =>
      b.score - a.score ||
      b.volume - a.volume ||
      a.symbol.localeCompare(b.symbol),
  );
  return {
    venue,
    market,
    timeframe,
    confirmationTimeframe: confirmationFrame(timeframe),
    generatedAt,
    refreshAfter: new Date(
      (Math.floor(Date.parse(generatedAt) / 60000) + 1) * 60000,
    ).toISOString(),
    universeSize: universe.length,
    scanned,
    failed,
    skipped,
    notScanned: universe.length - cursor,
    partial: failed > 0 || cursor < universe.length,
    candidates: ranked
      .filter((r) => r.status === "wait_confirmation")
      .slice(0, 10),
    watch: ranked.filter((r) => r.status === "watch").slice(0, 5),
  };
}

export async function candidateScan(config) {
  const key =
    "candidate-scan:v1:" +
    JSON.stringify(config) +
    ":" +
    Math.floor(Date.now() / 60000);
  return cached(key, 60, async () => {
    if (inflight.has(key)) return inflight.get(key);
    if (inflight.size >= 2) throw new Error("rate_limited");
    const task = collectCandidates(config);
    inflight.set(key, task);
    try {
      return await task;
    } finally {
      inflight.delete(key);
    }
  });
}
