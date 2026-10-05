# Web3 wallet accounts

CryptoSight supports registration and sign-in using injected EVM wallets (MetaMask and other EIP-1193 providers), including EIP-6963 discovery when multiple extensions are installed. A user signs a server-generated Sign-In with Ethereum message. No private key, seed phrase, token approval, transaction or gas payment is requested.

## User flow

1. Open Sign in and choose a wallet provider. Accept the account/educational-analysis consent and sign the login message.
2. A new wallet creates a normal tenant account with no email address, a paper account and a recorded consent. An existing wallet returns to its existing account. User locale is retained.
3. To attach a wallet to an existing email account, sign in with that account first and open Settings → Web3 wallets → Link a wallet. Signing out and registering the wallet separately would create a separate account; no balances or private records are silently merged.
4. Settings lists linked wallets. Removing a wallet requires its fresh signature and current 2FA code when enabled. The last usable login method cannot be removed. Successful unlink revokes every account session.
5. A passwordless account can enable/disable TOTP from Settings. Login by wallet and Google both enforce enabled TOTP. Keep another usable wallet linked before retiring the original wallet; CryptoSight cannot recover a lost private key.

Wallet addresses are global EVM identities within this application. The signed proof binds its chosen chain, while the application session identifies the tenant rather than granting blockchain permissions. Default enabled chains: Ethereum, Base, Polygon, Arbitrum, Optimism, Avalanche C-Chain, BNB Chain, Base Sepolia and Ethereum Sepolia. Configure `WALLET_CHAIN_IDS` on the server; Compose passes this setting and the UI displays the enabled list.

## Security

A challenge expires after five minutes and binds an exact server-generated message, domain, URI, chain, address, nonce, request ID, purpose, browser HttpOnly cookie and (for linking/removal) signed-in user. Signature verification precedes transactional one-use nonce consumption. Fresh ECDSA signatures are verified with the SIWE library. Linking/removing also require the normal session CSRF token. Account 2FA applies to wallet proofs; failed 2FA never creates a session. Different-owner addresses cannot be linked. Atomic identity creation and per-address transaction locking prevent duplicate users during concurrent first sign-in.

The SIWE statements in EN/PL/DE use ASCII-compatible text as required by the message grammar; the surrounding UI uses fully localized Unicode copy. See the authoritative [EIP-4361 specification](https://eips.ethereum.org/EIPS/eip-4361) and [SIWE implementation](https://github.com/spruceid/siwe).

## API

- `POST /api/v1/auth/wallet/challenge`: address, numeric chainId, purpose (`auth|link|unlink`), locale. Returns a challenge ID, complete message and expiry; sets an HttpOnly browser-binding cookie.
- `POST /api/v1/auth/wallet/verify`: challengeId, exact message, signature, consent for new accounts, optional/current totp. Auth returns a session cookie; link retains the current session; unlink revokes all sessions.
- `GET /api/v1/wallets`: authenticated linked-wallet metadata.

Both proof routes enforce the exact APP_ORIGIN and rate limits. Their auth purpose is public; link/unlink require an existing session and CSRF token despite sharing those paths. The browser reads account and chain again after signing and rejects a changed provider account/network. Signatures and binding cookies are not logged. Expired challenges are cleaned by maintenance.

## Scope and setup

Run migrations `003_wallet_auth.sql` and `004_functional_fixes.sql` in addition to the original two before deploying updated application containers. The first makes email nullable and adds wallet identities/challenges. The second records paper collateral-cap settlement. Existing users/data are preserved. `npm run migrate` applies all four migrations, transactionally and once each.

Support is for externally owned EVM accounts with standard 65-byte signatures. ERC-1271 smart-contract wallets, WalletConnect QR sessions, Solana wallets, ENS profile lookup and on-chain portfolio ownership checks are not implemented. On mobile, use an injected wallet's built-in browser. These limits are shown in the release documentation rather than implied as supported.

Wallet-only users can use in-app, push and Telegram alerts; email alerts need a verified email identity. Existing email accounts can link wallets. Wallet signing has integration/HTTP tests with genuine locally generated ECDSA signatures. A real extension click-through and browser visual QA remain unverified because the Chromium download is blocked in this environment.
