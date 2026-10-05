# Security and operations

## Implemented boundaries

Opaque random sessions are stored as SHA-256 hashes. Passwords use salted scrypt. Production cookies are Secure/HttpOnly/SameSite and origin/CSRF checks protect writes. Google OAuth verifies state, nonce and ID-token signature with PKCE and gates enabled TOTP before session creation. Wallet login uses exact server-generated SIWE messages, five-minute expiry, one-use nonces and browser/session binding. TOTP needs a valid code before enabling. BYOK/exchange/TOTP secrets use AES-256-GCM with fresh nonces and tenant/provider/key-ID associated data. Browser responses expose credential metadata only. Parameterized tenant queries, optimistic drawing versions, DB quota locking, signed Stripe webhooks and webhook dedup protect writes. Application deployment uses a runtime DB role without schema DDL.

CSP uses per-request nonces and strict-dynamic, with development-only eval. The chart needs inline styles; no HTML insertion of model/news text occurs. Body/payload limits, rate limits and gateway connection/backpressure limits bound work. Push endpoints are allowlisted. RSS/calendar/optional REST and local model hosts are operator-controlled. Error logging deliberately excludes exception text, stack, request bodies, headers, prompts, email and keys. Optional Sentry receives bounded generic failures with request IDs. Gateway and worker expose `/metrics`; keep these internal and scrape through a trusted monitoring network.

## Before public deployment

1. Configure TLS, exact APP_ORIGIN, public WSS build URL and trusted reverse proxy. Do not expose internal Redis, PostgreSQL or metrics to the Internet. The public gateway relies on origin/IP checks; authenticated drawings additionally require a ticket.
2. Generate secrets with `npm run secrets:generate`. Store production secrets in a vault or protected deployment environment, outside source control. Compose passes only application variables to runtime containers; the database admin password is limited to bootstrap/migration. Keep environment files mode 600.
3. Configure and test SMTP verification/reset, OAuth redirect URI, notification channels and BYOK with test accounts. Configure maintained token-price tables; unknown prices are estimates. Run cross-tenant, CSRF, model validation, browser and region-specific exchange staging checks.
4. Run `npm run migrate` with a migration role, then verify runtime privileges. The migration uses an advisory lock and applies each migration and its version record in one transaction. Bootstrap SQL runs only for fresh volumes. Never erase a volume to update a schema.
5. Back up PostgreSQL with encrypted `pg_dump` and restore into a separate database. Verify counts and private record access. Back up the encryption key independently; a DB backup without it cannot recover credentials. Exercise restore and restart/recovery before release.
6. To rotate BYOK, set old/new keys in the operator environment and run `scripts/rotate-keys.mjs` against a backed-up DB; it transactionally re-encrypts credentials and TOTP and never prints secrets. Restart services with the new root key only after successful rotation. Check the script's required variable names first.
7. Set retention policies for audit/usage/market data and encrypted backups. Account export and deletion are implemented; privacy/legal policies, data-processing agreements, backup expiry, consent text approval and statutory retention decisions are operator responsibilities. Do not claim GDPR certification from these technical features alone.

## Operational limitations

A crashed running analysis is marked failed after 30 minutes, its reservation accounted conservatively and it is not silently sent to the provider again. User retry is a new request. Browser display, external delivery and deployment integration need staging validation. Indicators, structure heuristics and LLM output can be wrong; the consent/disclaimer remains prominent. There is no trading execution module. Paper balances and risk guards are simulations; realized drawdown guards do not guarantee limits on live portfolios or intraday mark-to-market losses.

Paper settlement now caps losses per position at its isolated reserved collateral; this is an educational simulator policy, not a venue liquidation calculation. Wallet support is EVM EOA only; private keys never leave the wallet. See WALLET-AUTH.md for proof and linking boundaries.

## Administration

Roles/suspension are server-side database fields, fetched on each HTTP session check. Public account settings cannot change roles. First admin access uses a server-only bootstrap command, existing-account UUID and singleton row lock; production has no seeded default admin. Admin mutations require CSRF/exact Origin and current TOTP when enabled. User access updates revoke sessions/unused drawing tickets; suspension also disables schedules and blocks new AI calls. Admin keys use agent-bound AES-256-GCM envelopes and write-only API inputs; custom arbitrary provider URLs are not supported. Agent/config edits have version checks, and job cancellation releases reservations atomically. See ADMIN.md for operational limits and staging verification.
