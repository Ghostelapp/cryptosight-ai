# Paper trading

Paper trading never sends exchange orders or signs wallet transactions. Balances and positions are virtual and denominated in USDT.

## Features

- Market long/short entries use a fresh order-book snapshot and volume-weighted execution prices. Entry and exit fees are 0.1% each.
- Limit entries reserve collateral plus entry fees immediately. The worker fills the entire quantity only when visible liquidity is sufficient within the limit. Unused reservation is refunded. Cancellation refunds once. Short limit fills above the limit may require additional collateral; they remain pending if the account cannot fund it.
- Optional stop-loss and take-profit are editable on pending orders and open positions. Clear either field and save to remove it. Open-position stops can move into profit; updated levels must be on the correct side of the current executable market price.
- Partial exits of 25% or 50%, and full exits, allocate entry fees proportionally and record a separate execution ledger. Remaining quantity retains its protection. New entries and explicit partial exits require at least 0.00000001 units; a partial exit cannot leave less than that amount. The parent order records cumulative realized PnL and original quantity.
- Risk-based sizing uses the existing calculator with fees and a conservative slippage allowance; balance allocation shortcuts reserve entry fees.
- Available cash, pending reservations, estimated equity, realized/unrealized PnL, closed-position win rate and profit factor are separate. Closed-position profit factor is unavailable when there are no closed losing positions. History shows the latest 200 exit executions and the latest 200 inactive orders; statistics cover all historical executions.
- Account values refresh every 10 seconds while the panel is visible. Missing quotes, stale account data and an inactive worker are shown explicitly. Chart sample replay cannot submit paper entries.

## Execution model and limits

Worker evaluation is scheduled every 5 seconds. It samples current books; it does not reconstruct price touches between samples, model exchange queue priority or partially fill entries. A triggered protective exit stays latched if liquidity is insufficient and retries later. Stop-loss takes precedence if both conditions are observed. Execution is at the current available book price, including gaps, rather than a guaranteed stop/target price. Fresh quotes are required for each execution.

Positions use isolated 1× collateral. Losses cannot spend collateral belonging to other positions or create a negative cash balance. This is a simulation, including for spot SHORT; no borrowing, funding, perpetual margin tiers or real liquidation engine are modeled. Mark-to-market is an estimate from cached ticker prices, with estimated closing fees, and can differ from actual order-book execution.

Daily loss and drawdown limits use realized results, including partial exits. They block new entries and are rechecked when pending orders become executable. Closing existing exposure is never blocked by those guards. Account-first database locks, order versions, replay keys and unique exit-ledger keys prevent duplicate settlement and conflicting updates. Protective exits continue for filled positions belonging to suspended accounts; new pending fills for those accounts remain paused.

## Upgrade and operation

Use a maintenance window: pause web/worker writes, apply migration **006_paper_trading.sql**, then deploy and restart the updated web process and worker:

```sh
npm run migrate
```

The migration preserves existing balances/orders, backfills prior closed trades into the exit ledger only when they have no exit records, and labels the virtual quote currency USDT. Reapplying it in development preserves partial/full execution history without duplicating realized PnL. It is included in the versioned PostgreSQL migration runner and embedded development setup. Back up production data before any migration.

Local development without DATABASE_URL uses the embedded worker automatically. Production/Vercel requires a separate persistent worker process:

```sh
npm run worker
```

On Railway create a separate service from the same repository, root directory `/`, with Custom Start Command `node services/worker/index.mjs`. Supply `DATABASE_URL`, `APP_ORIGIN`, application secrets and the existing worker integrations; use the same Redis as the other services when configured. Do not change the gateway's start command. The worker schedules `cryptosight-paper` through BullMQ when Redis is available and uses an in-process interval otherwise. Its health endpoint uses `WORKER_PORT` (default 3002); Railway's generated domain should target that port if exposed. Paper trading does not require a public worker domain.

The UI reports an inactive engine after 45 seconds without a completed paper tick. A running gateway or Vercel web process alone does not execute pending orders and protection.

## Validation

Nine paper API/database fixture tests cover reservations, depth/limit restrictions, exact refunds, fee allocation, replay and ownership, concurrent closes, stop gaps, short targets, latched exits, risk guards, editable protection and repeated migration. The integrated Node suite passes 71 tests, with three optional live-exchange tests skipped. Strict TypeScript, production build and EN/PL/DE contract checks pass.

A Playwright paper-panel scenario passes for the ticket, cancellation, protection editing, partial/full exits and mobile width using explicit UI response fixtures. All 18 browser scenarios pass, and the mobile paper-panel screenshot was inspected. External PostgreSQL/Redis and live exchange operation still require staging validation. See [INTEGRATION-REVIEW.md](INTEGRATION-REVIEW.md).
