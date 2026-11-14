# Terminal productivity and journal update

Implemented on 2026-11-14 (Europe/Warsaw).

- **Quick commands:** open with the header search button or Ctrl/Cmd+K. Search localized navigation, risk calculator, indicators, theme, terminal reset and market symbols. Arrow keys select, Enter opens and Escape closes. The shortcut also works while typing in a field. Existing chart shortcuts no longer intercept Ctrl+A, other pages or dialogs.
- **Workspace:** this browser restores venue, market, symbol, timeframe, chart type, layout, indicators, indicator period, fallback preference and panel order. A versioned allowlist validates stored values. Invalid or unavailable browser storage falls back to defaults. Quick commands can restore defaults. Sample replay and account secrets are not persisted in this workspace object.
- **Screener:** independent pair search, minimum volume, gainers/losers, watchlist filter, sortable column headers, result count and progressive rows. Missing numeric values sort last. A star changes the watchlist and a pair opens its chart. Authenticated watchlists now load for the selected venue and market, including an intentionally empty list.
- **Journal:** net PnL, win rate, profit factor, average trade, maximum cumulative-PnL drawdown and a cumulative result curve. All figures use the latest 200 entries supplied by the existing endpoint, ordered by recording date, with recorded fees. Drawdown is an absolute USDT amount; the curve does not claim account equity or actual execution chronology. Export CSV includes the same entries, UTF-8 BOM, quoted multiline notes and neutralized spreadsheet formulas in text.
- **Risk calculator:** optional target, entry/exit fee and slippage estimates, break-even price, net target profit and reward/risk after costs for long and short positions. Invalid target direction and costs at or above 100% are rejected. Results clear when inputs change; existing collateral/leverage warnings are visible. The model excludes funding and venue-specific liquidation rules.
- **Quote status:** shows the last successful market-list response and marks failed refreshes explicitly. Quotes clear when switching venue or market. Refresh requests have a 12-second timeout. This timestamp describes an application refresh, not the exchange's trade timestamp.
- **Windows build:** shared root resolution now recognizes Windows and POSIX path separators for schema, migrations, localized copy and report assets.
- **Preferences and checks:** locale/theme writes wait for browser preferences to load, preventing development remounts from overwriting the saved language. Browser-test readiness checks the API and database before starting interactions. The contract-check launcher selects a platform-appropriate Python interpreter and UTF-8 mode; `PYTHON` can override it.

All new interface strings are supplied in English, Polish and German. No migration or additional dependency is required.

## Verification

- `npm test`: 59 passed, 3 optional live-provider tests skipped (62 total).
- `npm run test:e2e`: all 17 Chromium scenarios passed in the final run (1.4 minutes), including existing administrator, wallet, localized terminal and mobile navigation flows, plus all eight new productivity scenarios. Desktop journal and 320px palette/screener screenshots were inspected; page-width checks also cover 390px and 768px.
- `npm run build`: optimized production compilation, TypeScript and route generation passed on Windows.
- `node scripts/smoke.mjs`: standalone health, anonymous access denial, signed wallet/private paper-account flow and encrypted managed-agent/catalog flow passed against an isolated local database.
- `npm run contracts:check`: schema, unique API operation IDs and EN/PL/DE key parity passed using Python 3.12 in an isolated virtual environment selected with `PYTHON`.

External provider availability and real AI billing remain dependent on operator configuration and staging checks described in VALIDATION.md.
