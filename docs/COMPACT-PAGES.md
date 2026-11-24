# Compact feature pages

The web application uses a shared compact layout for market overview, screener, alerts, journal, signal history, backtesting, settings and administration. The chart workspace keeps its own sizing, and paper trading retains its dedicated order ticket.

- Settings separates preferences, wallet, AI keys, exchange import, 2FA and account actions into six tabs.
- Screener separates conditional setups, the market list and paid watchlist AI scans. Scan results and filter input remain mounted when switching tabs.
- Alerts separates the alert list, scheduled analyses and notifications. Alert creation expands on demand. The header bell selects Notifications directly.
- Journal shows three primary metrics, with additional statistics, the entry form and AI review expandable. CSV export and the cumulative PnL curve remain available.
- Market overview starts with 12 mover tiles; an explicit control expands to 24. AI brief controls and correlation expand on demand.
- Backtesting keeps strategy/balance/risk inputs visible and places execution-cost inputs in additional options.
- Smaller cards, headings, tables and form controls apply to the other feature pages, including signal history and administration. Mobile inputs retain 16px text and usable target heights. Wide tables scroll inside their container.
- Administration has one heading and a list of agents first; the create/edit form expands on demand, and saving or closing clears and collapses it.

Tabs support left/right arrows, Home/End and focus indication. Inactive panels are hidden while mounted, preserving unfinished input. Table rows are scoped to the originating page and signed-in account, preventing a late response from being interpreted as another page's row type. Empty result tables explain that there are no saved records.

This change does not alter exchange execution, analysis generation, paper margin calculations or native application binaries. Current browser/build validation is recorded in VALIDATION.md.
