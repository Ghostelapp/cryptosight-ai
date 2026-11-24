# Candidate scanner

Open **Screener → Potential setups → Find setups**. This web scanner does not need a saved AI key or a populated watchlist. It is distinct from the existing watchlist/paid-AI scans below it. Results open the selected pair, venue, market and timeframe in the terminal; they never submit an order or enqueue an AI job.

`GET /api/v1/scanner/candidates` requires an authenticated account. It accepts venue, market, timeframe, direction (`all`, `LONG`, `SHORT`), minimum 24h quote turnover (at least 1 million USDT) and universe size (5–30, default 24). The UI offers 12/24/30 pairs and 5m/15m/1h/4h/1d. The universe consists of highest-turnover USDT pairs, excluding an explicit stablecoin set and common leveraged-token suffixes. Turnover is a liquidity proxy, not an executable-depth guarantee.

## Rules

The scanner reads up to 220 candles on the selected and confirmation timeframes. Primary data needs 200 valid closed candles; confirmation needs at least 60. Stale history, recent gaps and incomplete warmup are rejected. LONG requires price above EMA20 > EMA50 > EMA200; SHORT requires the reverse. The context price and EMA20 must agree relative to EMA50.

An entry candidate also requires directionally aligned MACD histogram, ADX ≥18, RSI 45–70 for LONG or 30–55 for SHORT, latest volume ≥1.2 times the previous 20-bar average, ATR between 0.2% and 6% of close, and either a close outside the preceding 20-bar range or an EMA20 pullback/bounce within 0.8 ATR. Rules are a research heuristic, not a validated trading edge.

Candidates **await a future candle-close confirmation** beyond the signal candle's high/low. Stop placement combines the five-bar swing and a minimum 1.2 ATR distance; stop distance must be 0.3–6%. Two equal-allocation illustrative targets are 1.5R and 2.5R. Weighted gross RR is 2; net RR must be at least 1.2 after an assumed 30 bps round trip. Spread/funding are excluded, levels are not tick-size rounded, and the UI says so. Open the chart/deep analysis to reassess before making a decision. SHORT on spot is explicitly labeled a bearish research scenario, not a directly executable spot short.

Ranking combines trend agreement, RSI proximity, ADX, relative volume, momentum, pattern and volatility. The 0–100 score is rule confluence, not a success probability. Near matches are shown separately with unmet conditions and no entry/stop/target plan. Empty results are preserved rather than filled with fabricated opportunities.

## Operational limits

Four workers process pairs, with two frame requests per pair. Both requests settle before that worker starts another pair, including when one fails, keeping at most eight simultaneous history calls per scan. Two distinct scans may run per web process. Scans stop taking new pairs after a 20-second collection budget; already running HTTP requests finish under their existing transport timeout. Coverage/failure/skipped/not-scanned counts expose partial results.

Market-only results are shared through a 60-second server cache keyed by configuration and UTC minute, with per-process single-flight deduplication. Authenticated users are limited to three requests per minute. The UI refreshes its stale indicator every 15 seconds; scanning is explicit, not a background cron or an always-on signal engine. Plans show a candle-based reassessment time and must be rescanned when stale. Venue availability and continuously changing market conditions remain limitations.

Validation: seven rule/orchestration cases, authenticated-input guards, browser candidate/watch/empty-state and chart-selection flows, and a read-only live VPS scan. The live observation checked 24 Binance spot pairs with no source failures in about 2.7 seconds, returning one conditional candidate and five watch rows. This is one observation, not a latency benchmark or a recommendation to enter that historical candidate. No LLM generation or exchange order was performed.
