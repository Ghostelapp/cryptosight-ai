# Validation record

Updated on 2026-10-05 (Europe/Warsaw) in the provided development environment.

- Node test suite: 49 passed, 3 opt-in live provider tests skipped in the default run (52 tests). Covers strict/semantic AI schema, provider response fixtures/retry, encryption/tenant binding, migrations/OHLC constraints, sessions/CSRF/tenant isolation/optimistic versions/TOTP, indicator vectors, worker series, sizing, replay ambiguity/triggers, fees/no-lookahead backtest, correlation and order-flow snapshot/delta parsing. New wallet tests cover real ECDSA signatures, consent, replay/expiry/domain/browser/chain checks, concurrent creation, tenant linking, last-method protection, wallet TOTP and the Google MFA gate; paper/API tests cover collateral settlement and malformed JSON.
- Next.js production compilation, TypeScript check and standalone route generation passed. The final source is rebuilt after release edits.
- Standalone HTTP smoke verifies page, health and anonymous private API protection, wallet registration and its private paper-account read, admin login/access denial and encrypted managed-agent storage/catalog. This is not a browser interaction test.
- Production dependency audit: zero reported known vulnerabilities; `dependency-audit.json` records the result. This does not prove absence of vulnerabilities.
- Synthetic gateway test: 51 symbols, 7 clients, 1,511 events, local gateway-to-client p95 1 ms. `LOAD-TEST.json` preserves the measurement. It excludes exchange/Internet/browser-rendering latency and does not verify the under-200 ms end-to-end target.

## Blocked / unverified

Explicit live integration attempts failed: Binance HTTP 451 and Bybit/OKX non-JSON access responses. Data adapters have fixture tests, but venue access, funding/open-interest endpoints and live UI freshness need regional staging verification.

Playwright flows are implemented. Chromium full and headless-shell installation failed in this environment with truncated download archives; test execution subsequently failed because the browser executable was unavailable. No desktop/mobile screenshot QA or browser E2E pass is claimed. CI installs Chromium and runs these flows on a compatible runner.

No Docker engine was available for a Compose run. Full PostgreSQL/Redis/BullMQ integration, runtime-role bootstrap, container image execution, restore drill and TLS deployment remain staging checks. PGlite uses a PostgreSQL engine for local integration tests but is not a substitute for multi-process deployment verification.

No real LLM, SMTP/OAuth/Telegram/push/Stripe/on-chain credentials were provided. These adapters and workflows are implemented and conditionally configured; their external integrations were not invoked. No production URL or exchange trade was created.

## Mobile regression stage (1.1.0-rc.2)

See [MOBILE-REVIEW.md](MOBILE-REVIEW.md). Seven browser scenarios are discoverable; execution is blocked before page interaction by a missing Chromium executable. Mobile layout and accessibility changes compile, but have not received browser visual verification.

## Administration stage (1.2.0-rc.1)

49 tests passed, 3 optional live-provider tests skipped (52 total). Nine new administration/bootstrap cases cover RBAC, CSRF/Origin, encryption/redaction, version checks, managed-agent journal review/queue routing, tier restrictions and draft connectivity checks, suspension/session revocation, self-lockout, persisted AI pause/limits, one-time reservation release and admin TOTP. Provider calls use stub/recorded responses. Production TypeScript/build and HTTP smoke pass; smoke includes admin access denial and encrypted agent/catalog workflows. Nine browser scenarios are discoverable, with two new admin flows and an isolated test-admin fixture. Browser execution and screenshots remain unverified. See ADMIN.md.
