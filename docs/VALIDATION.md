# Validation record

Earlier release records below describe checks from 2026-10-05 (Europe/Warsaw). The 2026-11-14 productivity/browser update at the end supersedes the earlier missing-browser limitation.

- Node test suite: 49 passed, 3 opt-in live provider tests skipped in the default run (52 tests). Covers strict/semantic AI schema, provider response fixtures/retry, encryption/tenant binding, migrations/OHLC constraints, sessions/CSRF/tenant isolation/optimistic versions/TOTP, indicator vectors, worker series, sizing, replay ambiguity/triggers, fees/no-lookahead backtest, correlation and order-flow snapshot/delta parsing. New wallet tests cover real ECDSA signatures, consent, replay/expiry/domain/browser/chain checks, concurrent creation, tenant linking, last-method protection, wallet TOTP and the Google MFA gate; paper/API tests cover collateral settlement and malformed JSON.
- Next.js production compilation, TypeScript check and standalone route generation passed. The final source is rebuilt after release edits.
- Standalone HTTP smoke verifies page, health and anonymous private API protection, wallet registration and its private paper-account read, admin login/access denial and encrypted managed-agent storage/catalog. This is not a browser interaction test.
- Production dependency audit: zero reported known vulnerabilities; `dependency-audit.json` records the result. This does not prove absence of vulnerabilities.
- Synthetic gateway test: 51 symbols, 7 clients, 1,511 events, local gateway-to-client p95 1 ms. `LOAD-TEST.json` preserves the measurement. It excludes exchange/Internet/browser-rendering latency and does not verify the under-200 ms end-to-end target.

## Blocked / unverified

Explicit live integration attempts failed: Binance HTTP 451 and Bybit/OKX non-JSON access responses. Data adapters have fixture tests, but venue access, funding/open-interest endpoints and live UI freshness need regional staging verification.

In the October release check, Chromium full and headless-shell installation failed with truncated download archives; browser execution was unavailable then. Chromium installation succeeded during the November update; see the latest record below.

No Docker engine was available for a Compose run. Full PostgreSQL/Redis/BullMQ integration, runtime-role bootstrap, container image execution, restore drill and TLS deployment remain staging checks. PGlite uses a PostgreSQL engine for local integration tests but is not a substitute for multi-process deployment verification.

No real LLM, SMTP/OAuth/Telegram/push/Stripe/on-chain credentials were provided. These adapters and workflows are implemented and conditionally configured; their external integrations were not invoked. No production URL or exchange trade was created.

## Mobile regression stage (1.1.0-rc.2)

See [MOBILE-REVIEW.md](MOBILE-REVIEW.md). Seven browser scenarios are discoverable; execution is blocked before page interaction by a missing Chromium executable. Mobile layout and accessibility changes compile, but have not received browser visual verification.

## Administration stage (1.2.0-rc.1)

49 tests passed, 3 optional live-provider tests skipped (52 total). Nine new administration/bootstrap cases cover RBAC, CSRF/Origin, encryption/redaction, version checks, managed-agent journal review/queue routing, tier restrictions and draft connectivity checks, suspension/session revocation, self-lockout, persisted AI pause/limits, one-time reservation release and admin TOTP. Provider calls use stub/recorded responses. Production TypeScript/build and HTTP smoke pass; smoke includes admin access denial and encrypted agent/catalog workflows. Nine browser scenarios are discoverable, with two new admin flows and an isolated test-admin fixture. Browser execution and screenshots remain unverified. See ADMIN.md.

## Productivity and browser update (2026-11-14)

- Node tests: 59 passed and 3 optional live-provider tests skipped (62 total). New coverage checks workspace validation, market filtering/sorting, journal PnL/drawdown/CSV handling, long/short target costs and break-even prices, risk API validation and platform-aware project-root resolution.
- Production build, TypeScript and route generation passed on Windows. Fixed project-root detection for Windows path separators and preference restoration during development remounts.
- Standalone HTTP smoke passed: health, anonymous journal rejection, signed wallet registration/private paper account and administrator denial/encrypted agent/catalog workflows.
- Contract/schema validation and EN/PL/DE catalog parity passed with Python 3.12 and the pinned `tests/requirements.txt` installed in `.runtime/contracts-venv`; `PYTHON` selected this interpreter. The new launcher supports Windows and POSIX default interpreter names and UTF-8 mode.
- Chromium 153 (Playwright build 1243) full and headless installations succeeded. The earlier missing-browser restriction is resolved. The browser fixture now waits for API/database readiness, and admin selectors match the actual accessible controls.
- Final `npm run test:e2e`: **17 passed (1.4 minutes)**, including administrator agent configuration/access denial, wallet registration/login/logout, language persistence, sample candles, journal/calculator flows, mobile navigation at 320/390/768px, quick commands, workspace restore/reset, unavailable browser storage, market filters/sorting, quote refresh failure and journal CSV. Desktop journal and 320px quick-command/screener screenshots were visually inspected. Runtime: Windows, Node 22.17.0; the documented deployment recommendation remains Node 24.

The optional remote-service, full PostgreSQL/Redis/Docker and live-model staging limits above still apply. New quote scenarios use intercepted fixture responses; the wallet browser scenario injects a test EIP-1193 provider and signs with an ephemeral key. No real extension, paid model call or exchange execution is claimed. Feature details and metric boundaries: [PRODUCTIVITY-REVIEW.md](PRODUCTIVITY-REVIEW.md).
