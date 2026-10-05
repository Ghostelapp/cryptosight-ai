# CryptoSight AI

A full-stack crypto analysis terminal built with Next.js, React, TypeScript, KLineCharts, PostgreSQL and Redis. Includes a real market data layer, saved drawing tools, indicators, encrypted BYOK AI analysis, signed Web3 wallet registration/login, risk tools, alerts, research and account settings in English, Polish and German. It never submits exchange trade orders.

The source and production build are delivered. This is a release candidate requiring operator configuration and staging verification before public use. Live exchange access and browser E2E execution could not be verified in this environment; see [validation](docs/VALIDATION.md).

## Local development

Node.js 24 is required. From this directory:

```sh
npm ci
cp .env.example .env
npm run secrets:generate
# Copy the generated values into .env. Keep that file private.
npm run dev
```

Open http://localhost:3000. Development uses a persistent embedded PostgreSQL engine in `.runtime/database` and an embedded analysis worker. Without SMTP, development registration verifies email immediately. Production always requires SMTP for email registration and an external PostgreSQL database. Leave `NEXT_PUBLIC_GATEWAY_URL` empty to use direct exchange browser sockets for candles; order flow and multi-device drawing sync require the gateway.

Actual quotes appear only when the selected provider is reachable. The explicit **Sample replay** control displays deterministic synthetic candles, disables live analysis and does not replace unavailable live data. Enter a provider API key in account Settings, choose a real model identifier, and run an analysis. Optional integrations show unavailable states until configured.

```sh
npm test
npm run build
node scripts/smoke.mjs
npm run contracts:check
npx playwright install --with-deps chromium
npm run test:e2e
RUN_LIVE_TESTS=true npm test
```

`contracts:check` also requires `pip install -r tests/requirements.txt`. Live tests make genuine venue requests and may fail when access is restricted.

## Docker deployment

```sh
# Set all four generated secrets, SMTP, APP_ORIGIN and the public WSS URL in .env.
# APP_ORIGIN=https://your-domain; NEXT_PUBLIC_GATEWAY_URL=wss://your-domain/ws
# NODE_ENV=production
# Use hex database passwords, or properly URL-encode other passwords.
docker compose --env-file .env up --build -d
```

Compose runs PostgreSQL, Redis, a one-shot versioned migration, web, gateway and worker. Database bootstrap creates a separate runtime role with data privileges; admin credentials are supplied only to PostgreSQL and migration. Internal infrastructure ports are not exposed. Application ports bind to loopback and need a TLS reverse proxy; [nginx example](deploy/nginx.conf) supplies routing, WebSocket forwarding and trusted client IPs. `NEXT_PUBLIC_GATEWAY_URL` is a build-time browser setting: rebuild when it changes. Secure production cookies require HTTPS.

The bootstrap applies only to a new database volume. An existing installation needs the runtime role/grants provisioned separately; preserve data and backups. Test migrations and restore before upgrading. Wallet login/setup and scope: [WALLET-AUTH.md](docs/WALLET-AUTH.md). Functionality fixes: [UPGRADE-REVIEW.md](docs/UPGRADE-REVIEW.md).

See [deployment/security](docs/SECURITY.md) for keys, retention and operational checks. Docker execution and a full PostgreSQL/Redis deployment were not available for verification here.

## Configuration

All settings are in `.env.example`. Essential: `APP_ORIGIN`, `DATABASE_URL` (outside Compose), `SESSION_SECRET`, `BYOK_ENCRYPTION_KEY` (base64 32 bytes), `BYOK_KEY_ID`, optional `WALLET_CHAIN_IDS`, production `SMTP_URL` and `EMAIL_FROM`. Compose also needs `POSTGRES_PASSWORD` and `APP_DB_PASSWORD`. `REDIS_URL` enables distributed cache, queues, CVD summaries and drawing pub/sub. No credentials are bundled.

Optional: Google OAuth, RSS, economic calendar, normalized on-chain/sentiment/liquidations APIs, Telegram, VAPID push, Stripe, allowlisted local models, and `SENTRY_DSN`. `MODEL_PRICING_JSON` maps `provider:model` to per-million `input`/`output` prices; the operator must maintain these prices. The displayed analysis reservation is a conservative budget estimate, not a provider billing quote. Unknown usage after an interrupted worker is charged conservatively and never automatically replayed.

## Source map

- `apps/web`: App Router, localized terminal, KLine drawing layer, indicator worker and account flows.
- `packages/market`: exchange REST/WebSocket adapters, order flow and optional context providers.
- `packages/quant`: closed-candle indicators, structure heuristics, sizing, replay and backtest.
- `packages/ai`: evidence-only prompts, provider adapters, strict/semantic validation.
- `packages/backend`: tenant APIs, sessions, encrypted credentials, jobs, alerts and research ledger.
- `services`: shared WebSocket gateway and BullMQ worker.
- `db`: initial schema, versioned application/wallet/functional migrations and runtime-role bootstrap.
- `packages/contracts`: OpenAPI, executable route manifest and strict AI schema.
- `tests`: indicator/schema/security/provider fixtures, opt-in live integration and Playwright flows.
- `deploy`, `scripts`, `.github/workflows`: release operations and CI.

Architecture and decisions: [ARCHITECTURE.md](docs/ARCHITECTURE.md). Coverage and limitations: [PHASES.md](docs/PHASES.md). REST/socket details: [API.md](docs/API.md).

## Administration

The admin panel manages encrypted shared AI-agent keys/models, agent access, users/roles/suspension, AI limits/pause, localized announcements, queued analyses and audit records. Apply migration 005, register your account, then run `npm run admin:bootstrap -- YOUR_EXISTING_USER_UUID` on the server and sign in again. There is no default production admin password. See [docs/ADMIN.md](docs/ADMIN.md) for Docker commands, 2FA, key handling and behavior of queued/running jobs.
