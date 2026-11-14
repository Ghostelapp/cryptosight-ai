# Implemented scope and remaining release work

The user's subsequent instruction authorized all phases together. No further phase confirmations are required. This delivery implements the application and ships release tooling; configuration-dependent and unverified items are distinguished below.

| Phase | Delivered | Limits / release checks |
|---|---|---|
| 1 | Architecture, SQL migrations, folder structure, 97 REST operations, AI JSON schema | Shared row-shaped API responses are extensible; SQL defines those fields |
| 2 | Three venue REST/candle sockets, historical pagination/cache, gateway, trades/depth/sampled liquidations, indicators, multi-chart and crosshair | Live endpoints blocked in this environment; automatic REST venue fallback is explicit, midstream first reconnects same venue |
| 3 | Trend/ray/lines/channel/Fibonacci/extension/rectangle/ellipse/note/arrow/range/position/measure/brush; editing, persistence, versions, magnet, lock/hide/style/templates/undo/redo; PNG with current analysis | Real-time cross-device persistence needs PostgreSQL + Redis + gateway; freehand brush uses sampled points |
| 4 | OpenAI/Gemini/Anthropic/OpenRouter/local adapters, encrypted BYOK, bounded snapshot/output, one retry, semantic validation, quick/deep/explain/chat/scheduled scans, overlays, PDF, quotas/costs/signal logs | No real model invocation verified without credentials; estimates require maintained model pricing; scanner queues at most five coins per request and ranks completed analyses using subjective confidence × RR × risk weight |
| 5 | Cost-aware sizing, collateral cap, RR, daily realized-loss and realized-drawdown paper guards, correlation/exposure, watchlist/screener, alerts and channels | Exact liquidation price requires venue margin tiers and remains unavailable; alerts support price, RSI/EMA20, AI and drawing touch rather than a universal strategy-expression editor |
| 6 | EN/PL/DE catalogs, runtime/account locale/timezone/theme, email verification/reset, Google PKCE OAuth with MFA gate, signed EVM wallet registration/login/linking, TOTP, consent, settings, encrypted BYOK | SMTP, Google credentials and HTTPS need configuration; no account linking solely by matching email |
| 7 | Next-open SMA rule backtest, AI setup replay/track record, journal/screenshots/PnL/AI review, isolated-collateral paper ledger with limits, editable SL/TP and partial exits, read-only Binance import | Backtest is one supplied strategy, not arbitrary strategy scripting. Paper fills use available order-book depth with fixed fees; no exchange execution, leverage/funding/liquidation simulation |
| 8 | Unit/security/provider fixture tests, E2E source, build/smoke, audit, synthetic 51-symbol test, Docker/CI/migrations/rotation, redacted logs/Sentry/metrics | Desktop/mobile browser execution passes locally; Docker/Postgres/Redis integration, live exchange latency and real-provider AI staging remain unverified |

## Indicator coverage

Server engine: EMA/SMA/WMA 20/50/100/200, Ichimoku, Supertrend, ADX, Parabolic SAR, RSI, Stochastic RSI, MACD, CCI, Williams %R, MFI, Bollinger, ATR, Keltner, Donchian, OBV and daily-session VWAP. Configurable base period plus chart indicator templates are provided. The chart's additional indicator worker computes series for selected indicators without blocking the UI.

Structure: confirmed two-bar pivots, HH/HL/LH/LL, BOS/CHoCH, heuristic order blocks/FVG/liquidity zones, RSI/MACD divergence and common candle patterns. These are documented heuristics, not reliable institutional-order identification. Volume profile allocates candle volume to typical-price bins and reports approximate POC/VAH/VAL; it is not tick-level exchange volume-at-price. Live CVD requires gateway/Redis. It is displayed as observed flow, not a complete historical CVD pane.

## Optional modules

Configured REST adapters support on-chain, sentiment and liquidation summaries. RSS, calendar, funding/open interest/long-short ratio, CoinGecko context and Fear & Greed show unavailable/stale provenance. There is a depth ladder; a historical order-book heatmap is not implemented. Optional X/Reddit-specific ingestion is not provided. Stripe subscription activation and external notification delivery require real secrets, HTTPS and operator setup. Dashboard data, manual AI scans and opt-in per-user daily BTC multi-timeframe briefs are implemented. Enabling a brief creates a daily schedule using the selected provider/model and existing quota; manage or delete it in Alerts.

## Product boundaries

Panels support chart/analysis resize and drag reorder, with one/two/four chart layouts and responsive navigation; this is not a general arbitrary-panel window manager. Account locale persists server-side after settings are saved. Onboarding and legal copy are localized; deployers must supply their own privacy policy, legal entity, retention policy and regional obligations before public launch. The application offers educational analysis and no automatic or manual live order-execution endpoint.

Administration extension: encrypted managed agents, roles/suspension, persisted AI limits/pause, announcements, queued-job cancellation and audit views. Setup and limitations: ADMIN.md.
