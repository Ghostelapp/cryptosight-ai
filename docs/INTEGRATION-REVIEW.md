# Integrated update — 2026-11-14

This version combines the newer repository code with the local terminal improvements, preserving the history of both branches.

## Integrated source

- `bd3c9e4` from `main`: advanced paper trading, account/execution statistics, horizontal mobile drawing tools, compact chart tooltips and chart resizing.
- `67f82f5`: quick commands, validated workspace persistence, the market screener, journal analytics/CSV, target-aware risk sizing, Windows paths and local browser verification.
- `c886653`: per-IP gateway connection reservations before asynchronous authentication.

## Integration corrections

- Retained the local journal statistics and storage-failure handling while integrating the new paper panel, worker and migration 006.
- Made the legacy paper-exit backfill safe to execute repeatedly. Previously, restarting a development database after a partially closed trade could add a second synthetic exit record and double its realized PnL. The regression fixture verifies two normal exit records remain two, a legacy order is backfilled once, and cash is unchanged.
- Released gateway reservations when an HTTP upgrade is rejected or its socket closes before a WebSocket exists. A real local gateway test rejects 25 malformed handshakes, accepts 20 live connections, rejects the 21st and accepts a replacement after disconnect.
- Regenerated OpenAPI and the route manifest, retaining the optional risk target and requiring leverage of at least 1. The API has 77 paths and 97 operations.
- Updated the paper UI test to select the actual accessible combobox.

## Dependency and CI updates

The production dependency audit initially reported eight affected packages, including critical Next.js advisories. Updated Next.js to 16.4.6, React/React DOM to 19.3.1, Sentry Node to 11.12.0, Nodemailer to 10.5.0, Zod to 4.6.7 and vulnerable transitive dependencies. The final `npm audit --omit=dev` reports zero known vulnerabilities; `dependency-audit.json` records the result. This is an audit result, not proof that all vulnerabilities are absent.

GitHub Actions now uses checkout 7.0.1, setup-node 7.1.0, setup-python 7.1.0 and upload-artifact 7.0.2, pinned to their verified full commit SHAs. Actionlint 1.7.12 passes. After pushing, GitHub accepted the workflow and created both jobs, but blocked them before any steps ran: "The job was not started because your account is locked due to a billing issue." See [the observed run](https://github.com/Ghostelapp/cryptosight-ai/actions/runs/43634080617). Account billing must be resolved before remote runner verification; local checks passed independently.

## Observed verification

- Node tests: **71 passed, 3 optional live-provider tests skipped** (74 total).
- Chromium browser suite: **18 passed**, including the paper ticket, cancellation, protection editing, partial/full exits, mobile chart geometry at 320/390/768px and all previous terminal/account flows.
- Production build, TypeScript and standalone HTTP smoke: passed.
- Contract/schema checks and EN/PL/DE catalog parity: passed.
- Synthetic local gateway load: 51 symbols, 7 clients, 1,385 events, p95 gateway-to-client transport 1 ms. It excludes exchange and browser-rendering latency.
- Mobile chart and paper-panel screenshots inspected.

Runtime: Windows with Node 22.17.0; deployment/CI remains configured for Node 24. Docker CLI is installed but the Docker engine is unavailable, so a full Compose/PostgreSQL/Redis deployment and restore remain unverified. Credential-dependent remote services and real AI billing still require staging configuration.

## Local data and release operations

The running development preview was stopped and its database copied under `.runtime/backups/` before applying migration 006. Its existing account was preserved. The old `.runtime/database` was not used for this preview update. Environment files, databases, installed dependencies, build output and browser artifacts remain excluded from Git.

For production, back up the database, stop application/worker writes, run `npm run migrate` with the migration role and restart the updated web/worker processes. Pending fills and protective exits require a persistent worker. See [PAPER-TRADING.md](PAPER-TRADING.md). No production database migration was performed by this update. For a local rollback, stop the preview and select its backed-up database directory with `DEV_DATABASE_PATH` while running the preceding code version.

`SHA256SUMS` is regenerated from the staged Git file contents, excluding the checksum file itself and ignored runtime data.
