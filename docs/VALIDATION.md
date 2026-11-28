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

## Integrated upstream and security update (2026-11-14)

The latest verification supersedes the earlier 59-test/17-browser snapshot above: **71 Node tests passed, 3 opt-in live tests skipped (74 total), and all 18 Chromium scenarios passed** after integrating current main and the gateway branch. Production build/TypeScript, standalone HTTP smoke, OpenAPI/schema/catalog checks and actionlint passed. The audit of production dependencies reports zero known vulnerabilities after updating Next.js 16.4.6, React 19.3.1, Sentry, Nodemailer, Zod and vulnerable transitive packages.

The mobile chart and paper-panel screenshots were inspected. The new gateway load fixture passed for 51 symbols and seven clients, with 1,385 events and p95 local transport 1 ms; this excludes exchange and browser-rendering latency. The preview database was backed up, upgraded with migration 006 and checked with its existing account intact. A regression test verifies repeated migration does not duplicate exit records or PnL. Full Docker/PostgreSQL/Redis deployment and credential-dependent services remain staging checks. Source revisions and operating instructions: [INTEGRATION-REVIEW.md](INTEGRATION-REVIEW.md).

Remote CI on the integrated source was blocked before checkout: GitHub reported "The job was not started because your account is locked due to a billing issue." Both application and PostgreSQL jobs have no executed steps. The workflow passes actionlint locally; see [the observed run](https://github.com/Ghostelapp/cryptosight-ai/actions/runs/43634080617). No billing/account settings were changed.

## Native mobile client (2026-11-16)

85 Node tests passed, with three optional live-provider tests skipped (88 total). The new cases cover PKCE approval/exchange/replay, fresh TOTP, expiry, suspension, tenant isolation, cookie/bearer separation, Origin/CSRF enforcement, callback validation, network failures and stable mutation intent keys. All 20 Chromium scenarios passed, including real browser approval and native-session API access. Browser fixtures now preserve and rotate the dev cache before each run to avoid stale Turbopack client chunks. Functional UI assertions allow cold compilation and password derivation up to 15 seconds; these are not latency benchmarks.

Web production build/TypeScript, native TypeScript/lint, contracts, actionlint, standalone HTTP smoke, and the production dependency audit passed (zero known vulnerabilities). Android and iOS Hermes bundles exported successfully; inspected bundles contain native React 19.3.0, with no React 19.3.1 or backend source. Expo Doctor passes 19 of 20 checks: the duplicate-React warning reflects intentional web/native workspace versions, isolated by Metro. The production profile rejects local HTTP configuration. The preview database was backed up and migration 007 applied with its original account intact and zero paper orders.

iOS Xcode compilation/signing and real-device Face ID remain unverified on Windows. Expo skips generating native iOS files here; EAS/macOS is required for a signed iPhone build. Native background APNs/FCM delivery is not implemented: alerts are in-app. No store submission, paid cloud build or external model call was performed. Build instructions and feature limits: [NATIVE-MOBILE.md](NATIVE-MOBILE.md).

The Windows Android release build subsequently passed for arm64-v8a and x86_64. The resulting local APK is 56,131,479 bytes, SHA-256 `cecebc70b2be8f609f2a1e6a897603153504e78441315ed45fe0850ce1a19f10`. Android package metadata and the generated development signature were verified, and the final APK was installed and launched in an emulator. The native welcome screen and sample-market candlestick/EMA chart were visually inspected. This is a locally signed test APK, not a Play Store release. Device browser pairing, private native screens and physical-device biometrics remain unverified; browser approval and bearer API access were covered by the desktop browser/API tests above. The disposable native QA account was deleted through the account API after testing. CSV sharing retains its private cache file until logout or OS cleanup so Android recipients can read it asynchronously.

## VPS deployment (2026-11-24)

The first real Docker/PostgreSQL/Redis deployment passed production compilation/TypeScript, migrations 001–007, runtime database access, public HTTPS/API and WSS checks, a fresh persistent-worker heartbeat, and a dump/restore drill into an isolated disposable database. Binance, Bybit and OKX each returned 50 actual hourly candles with fallback disabled. Shell-script LF enforcement and Redis connection ordering fixed two deployment failures. This supersedes the earlier missing-Docker/restore limitation for this installation. SMTP/Resend, external backup delivery, paid AI calls and physical mobile pairing remain unverified. See [VPS-DEPLOYMENT.md](VPS-DEPLOYMENT.md) for operations and boundaries.

## Provider model discovery (2026-11-24)

The updated Node suite passed 92 tests, with three optional live-provider tests skipped (95 total). Seven new cases cover provider headers/catalog filtering, Gemini/Anthropic pagination, error redaction, local-host restrictions, tenant-bound credential access, POST CSRF and administrator-only access to agent credentials. Provider catalog responses are fixtures; no real provider key or paid generation was used. The two administrator Chromium scenarios and the new model-picker scenario passed. The latter saves a real encrypted fixture credential, uses intercepted catalog responses, selects a returned model and clears stale selection on provider change. The selected-model settings screenshot was visually inspected.

Web production compilation/TypeScript, native TypeScript/lint, Android/iOS Hermes export and contract/catalog parity passed. OpenAPI now has 82 paths and 103 operations. A successful catalog response does not establish model billing balance or compatibility with every generation mode. The installed older Android APK must be rebuilt to include the new native controls.

## Analysis engine v2 (2026-11-24)

The final Node suite passed **104 tests**, with three optional live-provider tests skipped (107 total). New coverage includes adaptive timeframes, closed-bar/lookahead filtering, candle gaps, calendar-month boundaries, execution-book freshness/units, aligned return correlation, cost arithmetic, optional-feed failures, required-primary-data failure, concurrent collection, trigger/zone tick precision, contradictory setups and tenant-scoped evidence projection. Native TypeScript/lint, Android/iOS Hermes export and schema/catalog parity passed.

All **22 Chromium scenarios** were verified across runs. The full run passed 20; two existing calculator/wallet flows failed while the Android native compiler was competing for resources. After lowering only this build's process priority, all four terminal/wallet scenarios passed on rerun without changing those tests. The new research flow passed and verifies deep mode, stable enqueue intent on retry, evidence/cost display and no additional polling after completion. The evidence-panel screenshot was visually inspected. These are functional checks, not latency benchmarks.

A temporary read-only container on the VPS exercised the new snapshot collector against real Binance BTCUSDT/ETHUSDT hourly data without calling an LLM. Each collected 299 closed candles on 1h/4h/1d with zero detected gaps; payloads including the schema were approximately 44k characters, below the existing 70k limit. Two collection observations were 565 ms and 349 ms; these are individual samples, not p95 or end-to-end analysis timings. Missing calendar/news/on-chain/sentiment/liquidations feeds were reported explicitly. No accuracy improvement or win rate has been established by these checks. See ANALYSIS-ENGINE.md for the calculations, input/output budgets and unverified assumptions.

The HTTPS Android preview was rebuilt successfully for arm64-v8a/x86_64, signed with the existing development certificate. The 56,140,059-byte APK has SHA-256 `2c741d23ad043dd1c4743f4221123e16a951bf896b50c7211507665314c34f32`. Package metadata and signature verification passed; the packaged Hermes bundle contains the HTTPS backend, model picker and new evidence UI. It is a test build, not a Play Store release. Signed iOS compilation and private mobile account flows remain separate checks.

After deployment, the official public CoinDesk RSS at `https://www.coindesk.com/arc/outboundfeeds/rss` was verified through the existing parser and configured on the VPS. The public news API returned 12 dated items. The trailing-slash URL redirects, so the canonical URL is used while preserving the existing no-redirect policy. The earlier preflight's missing-news report describes the state before this configuration; calendar/on-chain/sentiment/liquidations still require operator sources. Production health, gateway and worker checks passed after restart.

## Market-wide candidate scanner (2026-11-24)

112 Node tests passed, with three optional live-provider tests skipped (115 total). Seven new rule/orchestration cases cover long/short geometry, pending rather than immediate entries, near matches without trade levels, freshness/gap/warmup/context rejection, candle expiry, stablecoin exclusion, bounded concurrency with partial failures, and empty universes. Authenticated API guards reject anonymous access and excessive/invalid parameters. Browser checks cover candidate/watch/empty states, opening the correct market and absence of paid AI enqueue calls; the existing market screener and 320px quick-command scenarios also passed. Production build/TypeScript and OpenAPI/catalog checks passed. OpenAPI now contains 83 paths and 104 operations.

A temporary read-only container on the real VPS scanned 24 Binance spot pairs with no source failures in approximately 2.7 seconds, returning one waiting-confirmation candidate and five watch rows. No AI generation or exchange orders were invoked. That observation is neither an accuracy test nor a durable recommendation for any sampled pair. Criteria and operational boundaries are documented in CANDIDATE-SCANNER.md.

## Readable AI chart plans (2026-11-24)

117 Node tests passed, with three optional live-provider checks skipped (120 total). New checks cover selecting only one scenario, coincident entry/trigger labels, context/timeframe/demo guards, NO_TRADE without trade geometry, crowded/offscreen label anchors and note length/target correspondence. Production build/TypeScript and schema/OpenAPI/locale parity passed.

Nine browser scenarios passed, including the deep-analysis flow with per-level AI note fixtures, scenario switching, drawing/scale/context controls and a 360px chart/guide without horizontal overflow. Desktop and mobile canvas screenshots were visually inspected. Visual review found KLineCharts 9.8.12 ignores the dynamic maximum bound; the implementation now feeds invisible calculated bound values into axis calculation. The research browser scenario passed again after that correction, and screenshots confirmed SL/TP are inside the fitted scale. No paid AI calls were made; provider-generated prose quality and forecast accuracy are not established by fixture tests. Native binaries were not rebuilt for this web chart change.

## NO_TRADE observation drawing correction (2026-11-24)

Read-only production diagnosis showed completed analyses returning NO_TRADE, which previously drew no overlay with context disabled. NO_TRADE now automatically draws available AI support/resistance plus an explicit observation badge; absent levels produce a status and explanation without trade geometry. Context selection excludes invalid/duplicate prices and chooses the nearest provided levels.

118 Node tests passed, with three optional checks skipped (121 total). Two new browser cases assert actual canvas text for observation levels/status and for empty key levels; the actionable deep-analysis regression also passed (three browser cases in this run). Both 360px screenshots were inspected. Production build/TypeScript and contract/locale parity passed. No paid AI call or account impersonation was used for these checks.

## Compact paper workspace and isolated leverage (2026-11-24)

The Node suite passed 123 cases with three optional live tests skipped (126 total). An additional targeted database concurrency/migration case passed afterward, bringing verified cases to 124 (127 discovered). New cases cover full-notional fees, proportional margin release, leveraged limit fills/refunds, replay conflicts across leverage choices, margin-exhaustion exits for LONG/SHORT without consuming another position, invalid leverage/spot rejection, concurrent margin reservations, repeated migration 008 and fee-inclusive liquidation estimates. Existing 1x settlement cases remain unchanged.

The revised paper browser flow passed: spot leverage disabled, direct futures switch, 10x preview and request, order cancellation, protection editing, partial/full closes, history tabs and 360/390px layout without page overflow. Compact desktop/mobile screenshots were inspected. Production build/strict TypeScript and OpenAPI/locale checks passed. The new route keeps omitted leverage at 1 for old clients. The native binary was not rebuilt. Exchange liquidation fidelity, funding/maintenance margin and intratick liquidation coverage are outside this simulator's model.

## Compact feature pages (2026-11-24)

All 26 Chromium browser scenarios passed in the final complete run (3.3 minutes). Coverage includes settings/screener/alert tabs, arrow/Home/End navigation, preservation of edited settings across tabs, alert creation and notification-bell selection, expandable backtest costs, mover expansion, journal save/CSV, managed agents and role restrictions, wallet login, native browser pairing, paper trading and AI chart/research regressions. Feature-page screenshots were reviewed for overview, screener, alerts, journal, signal history, backtesting, settings and administration, including 320px layout, Polish labels and the light theme.

The checks caught two UI issues during development: a duplicated empty-state block and delayed preference initialization overwriting an edit. Empty tables now use one compact message, and initial preferences hydrate before auxiliary agent discovery. Records are scoped to their page and account so navigating from alerts to backtesting cannot interpret an alert row as a strategy. Earlier intermediate test failures from changed selectors and development hot reload were superseded by the final clean full run.

Production build/strict TypeScript and OpenAPI/locale parity checks passed. This revision changes the web UI and client state only; backend calculations, dependencies and native binaries remain at their previously verified versions. No external model generation was needed for layout validation.

## 2026-11-28 — email, anti-spam and batch AI scans

- Node suite: 132 passed, 3 optional live tests skipped. New cases cover production email verification, single-use password recovery/session revocation, encrypted write-only service settings, Turnstile hostname/action/token checks and tenant-scoped multi-timeframe deep jobs.
- Browser: 29 distinct scenarios verified across the full run and targeted reruns after the integrations form busy-state fix. Registration/recovery challenges and batch scan polling/partial failures also passed final targeted reruns. Integration credentials in browser tests are fixtures.
- Production build and strict TypeScript passed. Contracts regenerated for 87 paths / 108 operations.
- The production scanner was blocked by Redis memory exhaustion from unbounded completed scheduler ticks. Removing only old completed technical ticks reduced memory from 256.10 MB to 2.88 MB and existing queued analyses resumed. User analysis/trade/account records were retained. Scheduler retention and worker heartbeat checks now prevent silent recurrence.
- Real Resend delivery and Cloudflare Turnstile remain pending owner configuration. No real email was sent during validation. Use Administration → Integrations and the explicit test-email action. See AUTH-EMAIL-TURNSTILE.md and QUEUE-RETENTION.md.
