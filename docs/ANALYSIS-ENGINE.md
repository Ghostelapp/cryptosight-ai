# Analysis engine v2

## Readable AI chart plans

The web chart shows one selected setup at a time. Entry/activation, SL and TP carry colored price labels; coincident entry and activation share a label. The entry zone and conditional risk/reward areas use translucent shading. Label displacement preserves the true price anchor. Optional nearest support/resistance levels are hidden by default. Scale fitting includes SL and all targets, and offscreen labels carry arrows when fitting is disabled. Drawings are limited to the matching symbol, timeframe and stored venue/market context, and are disabled in sample mode. NO_TRADE has no entry/target drawing. User drawings retain their separate storage group.

Below the chart, “Chart plan — AI explanation” includes the selected scenario's reasoning, timing, invalidation and level notes. Prompt `crypto-analyst-v3` asks for one evidence-grounded sentence per entry, activation, stop and target in `chart_notes`. Each note is bounded to 300 characters, and validation rejects a target-note count different from the target count. The field remains optional for stored analyses and older provider outputs; missing notes are identified explicitly while the original reasoning remains available. There is no extra AI call for drawing or explanation. Price lines and bands are a conditional setup, not a forecast price path. PNG export includes the selected setup and its explanations.

The native app continues to display the existing analysis results; this drawing update is in the web chart, including mobile browsers.

For NO_TRADE, support/resistance context is shown automatically: up to two distinct levels of each type nearest the latest chart price, using only levels supplied by that analysis. The canvas explicitly labels the result as an AI observation. Scale fitting includes these context levels. If none were supplied, the status remains visible and the guide explains that no levels were provided. This observation does not introduce an entry, stop or target. LONG/SHORT retain optional context levels. Browser regression checks verify the actual canvas text, including the empty-level case, rather than only the explanation panel.

The default web and native research mode is now **deep**. Quick and explain remain available. Deep research collects the selected timeframe and two context frames appropriate to its horizon: for example 1m/15m/1h, 1h/4h/1d, or 1d/1w/1M. Weekly/monthly research also includes a shorter context frame. It does not silently substitute another venue.

## Evidence before generation

Each available timeframe requests up to 300 candles. Only valid, closed candles ending before collection time feed the indicators and evidence. Duplicate timestamps are collapsed. The model receives the latest 60 closed candles per frame, computed indicators and provenance; this keeps the input bounded while retaining the full indicator warmup. Fewer than 50 fresh primary candles stops the job before any generation call. Context frames can fail independently and are listed as missing.

Primary history, instrument metadata and auxiliary data are collected concurrently. Optional feeds have an eight-second wait budget; their late results are discarded, although the underlying HTTP request can continue until its transport timeout. Missing news/calendar/on-chain/sentiment/liquidations data stays unknown instead of aborting otherwise valid research. Instrument metadata and primary history remain required.

The server computes an auditable report independently of the model:

- EMA20/50/200 trend ordering, RSI, ADX, ATR as percent of price, recent returns and per-bar volatility;
- latest volume divided by the previous 20-candle average, candle gaps and warmup state;
- bid/ask spread and visible-book imbalance, with a 15-second freshness check at collection time;
- spot notional depth only; perpetual quantities are venue-specific and are not mislabeled as USD;
- deep-mode BTC correlation from up to 60 aligned closed-candle log returns, with at least 20 returns required. Zero variance and missing benchmarks remain unknown.

The quality status is a completeness/warmup indicator, **not a numerical probability of success**. The order book is a collection-time snapshot, not a promise of future liquidity or measured executed flow. A completed LLM response does not refresh those observations. Calendar and other configured feeds can still be incomplete or incorrect; access checks do not validate their coverage.

## Output and validation

Prompt `crypto-analyst-v2` asks for a top-down comparison of trend, momentum, volume, structure and volatility, explicit conflicting evidence, invalidation and an opposing scenario. It discourages counting correlated indicators as independent confirmations. The existing JSON schema and maximum three setups remain unchanged. NO_TRADE remains a valid outcome.

Deep generation allows up to 8,000 output tokens; other modes retain 6,000. A provider/model with a smaller output limit may reject the request. OpenAI uses `max_completion_tokens`; OpenRouter/local compatible providers use `max_tokens`. There is no multi-model voting or automatic fan-out. The existing maximum of one corrective retry after invalid structured output remains. Longer inputs/outputs can cost more; daily limits, reservations and provider billing still apply.

Server validation checks schema, instrument/time identity, entry/stop/target geometry, target allocations, gross RR, event-risk restrictions, trigger timeframe and distance, and tick precision for entry zone/trigger as well as entry/stop/targets. A contradictory mixture of NO_TRADE and actionable setups is rejected. When a fresh order book is available, its midpoint anchors distance checks; otherwise the latest closed-candle price is used.

## Costs and display

`GET /api/v1/analyses/{id}` returns `research` projected from that analysis's stored market snapshot and independently calculated `trade_metrics`. It remains tenant scoped and does not expose the raw snapshot. Older jobs without research metadata continue to work.

For an actionable setup, let `R` be entry-to-stop distance, `W` the allocation-weighted entry-to-target distance, and `C` assumed round-trip cost per unit:

```text
C = entry × (20 fee bps + 10 slippage bps + available spread bps) / 10,000
gross RR = W / R
net RR = (W - C) / (R + C)
break-even win rate = (R + C) / (R + W)
```

These are comparison assumptions, not exchange fee quotes or fill simulations. Missing spread is not represented as measured zero: `spreadIncluded` is false. Funding, gaps, variable sizing, partial fills and changing liquidity are excluded. The break-even threshold is not an estimated win rate. Negative net reward is displayed explicitly.

Web and native results display evidence and costs separately from model confidence. Web polling is sequential, backs off on transport failures and stops on terminal job states. A retry after an uncertain enqueue response reuses the same idempotency key for unchanged inputs. Native interval polling skips overlapping requests and stops polling completed/failed analysis jobs. Native UI changes require a new application binary.

The deployed VPS now uses the official public CoinDesk RSS feed (`https://www.coindesk.com/arc/outboundfeeds/rss`) for news. It was verified before enabling it; existing nonempty operator settings are preserved. Other optional feeds still require configuration. The Android HTTPS test build in `.runtime/mobile-builds/CryptoSight-AI-preview.apk` includes model discovery and the evidence report; it is development signed and connects to `https://cryptosight.tech` on a fresh installation.
