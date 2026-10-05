# Upgrade and functionality review

## Changes delivered

- Signed wallet registration/login, no fabricated emails, multiple injected wallet selection, account linking/removal, localized consent/status/errors, allowed-chain display and optional network configuration.
- Wallet identity creation is atomic; nonce replay, stale proof, browser/origin/message mismatches, wrong signer, cross-account linking, unsupported network and last-login-method removal are rejected.
- Google sign-in previously created a session even when the account had TOTP enabled. It now issues a browser-bound, single-use pending MFA challenge and waits for a valid current code before creating the session.
- Passwordless users previously could not disable TOTP because password validation was unconditional; signed-in users without a password can now disable it with a valid current TOTP code. Missing codes fail cleanly instead of causing library exceptions. Authenticator labels now work for wallet-only identities.
- Production signup SMTP failure could leave an unverified account without a recovery path. Resend verification provides a rate-limited, enumeration-resistant retry. Actual SMTP delivery remains configuration-dependent.
- Malformed JSON now returns a 400 input error, and request-size checks count UTF-8 bytes.
- Paper short positions could fail to close if an adverse gap exceeded their reserved collateral. Settlement now uses an explicit isolated-collateral cap, with recorded `collateral_exhausted`; it does not claim a real exchange liquidation price. Mark-to-market reporting respects the same cap. A fixture integration test verifies close, cash/PnL and duplicate-close protection.
- Wallet-only profiles render safely without email; Stripe checkout omits absent email; email-alert creation rejects an email-less account instead of silently queuing undeliverable mail. Account export includes wallet identities.

## Verification

The full baseline suite remains enabled: indicators and worker series, closed bars, schema/semantic validation and model fixture retries, secret encryption and tenant binding, sessions/CSRF/tenant isolation, drawing concurrency, quota/recovery, sizing/replay/backtesting/correlation and order-flow fixtures. Added tests use real ECDSA signatures against the application's API dispatcher and PostgreSQL engine. Production standalone HTTP smoke now registers a wallet and fetches its private paper account, while checking CSP/anonymous protection.

The release is not claimed as a completed external-integration or browser audit. Browser installation returned truncated full/headless archives; Playwright fixtures are shipped for wallet success/no-provider and original main flows, but could not execute locally. Live exchange access, a real extension, full Docker/PostgreSQL/Redis deployment, Stripe/SMTP/Google remote integration and restore remain staging checks. The earlier synthetic 51-symbol result is retained unchanged; this upgrade does not claim a new end-to-end latency measurement.
