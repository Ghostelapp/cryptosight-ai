# Native mobile applications

The `apps/mobile` workspace adds a native iOS and Android client to the existing web terminal. Both use the same server, users, watchlists, analysis queue, paper portfolio, journal, keys and notifications. The native client includes candlestick charts/EMA, market screening, shared watchlists, AI-agent selection/results/history, a cost-aware risk calculator, market/limit paper orders, stop-loss/take-profit editing, partial exits, journal metrics/CSV sharing, price alerts and account settings. The optional biometric lock protects the local app after it leaves the foreground. Settings also includes account deletion. Administration and advanced web-only tools remain accessible through the full terminal link.

No exchange trading is performed. Price-alert delivery in this version is **in-app**, polled while Account is visible; this is not a native APNs/FCM background push implementation. AI requires a configured managed agent or provider credential/model and an operating backend worker. Missing real data displays an error. Synthetic data is available only in the explicit sample mode; it cannot place paper orders or run analyses.

## Server and database

Deploy the backend before distributing a connected build. Use a public HTTPS origin without a URL path, for example `https://your-project.vercel.app`. It must match the backend `APP_ORIGIN` exactly. Apply `npm run migrate` to the production PostgreSQL database, including migration **007_mobile_login.sql**. The development PGlite store applies it automatically. Keep the existing session/encryption secrets and database; this is an additive migration.

A Vercel web deployment still needs external PostgreSQL and an independently running worker for queued jobs, scheduled price alerts and automatic paper exits. The current Docker/worker setup can provide that backend. A mobile binary does not start these services. The app checks server health at connection time and shows the paper engine's actual health; a successful web build alone does not prove workers are running.

The app lets the user enter the server origin on first launch. To prefill it, set `EXPO_PUBLIC_API_URL` at build time. Values prefixed `EXPO_PUBLIC_` are bundled and public: **never** put provider API keys, database URLs, session secrets or signing credentials there. An optional `EXPO_PUBLIC_EAS_PROJECT_ID` attaches the build to the owner's real Expo project. The `.env.example` in the mobile workspace contains only public settings.

## Authentication

1. The phone creates a random verifier (32 bytes) and state, submits its SHA-256 PKCE challenge, and opens the server's `/mobile/connect` page in the system authentication browser.
2. The user signs in using existing web methods and explicitly approves this phone. A configured TOTP requires a fresh code at approval. Anonymous or unconsented sessions return to the existing login/consent flow.
3. The fixed `cryptosightai://auth` callback carries a one-use code, request ID and state. The phone validates all three and exchanges the code with its verifier. A stolen callback alone cannot create a session.
4. The server hashes native session tokens in the existing session table. The phone stores its seven-day token in SecureStore (iOS Keychain / Android Keystore-backed encrypted storage). It sends `Bearer m_…` and the configured Origin, with no browser cookies. Browser sessions retain their Origin/CSRF checks. Web cookie tokens and native bearer tokens cannot substitute for one another.

Pairing grants expire after five minutes and are consumed transactionally. Logout removes the local credential immediately and attempts server revocation. If the device is offline, the old server token remains valid until expiry or administrator revocation, but is no longer available through this app. A 401 revokes local state; ordinary permission/network failures do not. No automatic mutation retries are performed. AI/paper mutation intent keys survive an uncertain network result while the screen remains mounted; after an app restart, inspect the shared account/history before manually recreating an uncertain operation. CSV export writes a temporary journal-only cache file and removes it when the system share sheet finishes.

The custom scheme and platform application IDs are `cryptosightai` and `com.ghostelapp.cryptosightai`. Production store ownership/signing must belong to Ghostelapp. SecureStore on iOS may survive uninstall/reinstall; server expiry/revocation remains authoritative. Local biometrics is an app lock, separate from server TOTP.

Email/Google sign-in and server TOTP use the existing browser flow. A Web3 wallet can sign only where that browser exposes the existing injected EVM provider; this version does not embed a native wallet or WalletConnect SDK. On phones without an injected provider, use an available email/Google account. Native charts request the selected venue directly and display an error if it is unavailable, so paper orders and chart labels cannot silently refer to different venues.

## Local Android testing on Windows

Prerequisites: Node 24, JDK 21, Android SDK/NDK versions required by Expo 58, and a working `JAVA_HOME` / `ANDROID_HOME`. From the repository root:

```sh
npm ci
npm run dev
# In a second terminal, with a test emulator or USB-debugging device connected:
adb reverse tcp:3000 tcp:3000
npm run mobile:apk -- --local
adb install -r .runtime/mobile-builds/CryptoSight-AI-local.apk
```

The local APK prefills `http://localhost:3000` and permits HTTP only to local/private origins. `adb reverse` makes that origin work in both the app and its login browser, matching the local backend `APP_ORIGIN`. On a physical device you need USB debugging; a simulator/emulator does not change which backend account is used. Use a disposable account when testing destructive actions. A release/production build disables local HTTP. The local Gradle APK uses the generated development signing key and is for testing, **not Play Store distribution**.

On this Windows host, JDK 21's default socket directory caused `Unable to establish loopback connection` / `Invalid argument: connect`. The build was continued with a short, space-free directory for Java's temporary IPC sockets. If you encounter the same host issue, run this in the APK-build terminal before the command above:

```powershell
New-Item -ItemType Directory -Force C:\Temp\cryptosight-java | Out-Null
$env:JAVA_TOOL_OPTIONS = '-Djdk.net.unixdomain.tmpdir=C:\Temp\cryptosight-java'
```

For a production-like HTTPS preview, set `EXPO_PUBLIC_API_URL` to the deployed origin and run `npm run mobile:apk` without `--local`. Native directories are generated by Expo config/plugins and ignored by Git; do not edit them manually. Android and iOS project generation, dependencies and config are owned by `app.config.ts` and `package-lock.json`.

The Windows-only config plugin keeps CMake object paths compact, places the app's generated C++ staging directory in a short temporary path, and explicitly selects clang's C++ driver when Windows short filenames obscure `clang++`. Native dependency sources are unchanged. The local APK targets arm64 phones and x86_64 emulators; production EAS builds use the configured SDK's default architectures.

## Signed iOS and Android distribution

From `apps/mobile`, after configuring the owner's Expo account/project:

```sh
npx eas-cli@latest login
npx eas-cli@latest init
# Keep the returned project ID in EXPO_PUBLIC_EAS_PROJECT_ID.
# Set EXPO_PUBLIC_API_URL to the production HTTPS origin in the EAS environment.
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest build --platform ios --profile production
```

The production Android output is an AAB signed with the owner's upload key. iOS requires an Apple Developer account, registered bundle identifier and distribution credentials. The `preview` profile creates an installable Android APK and an iOS **simulator** build; use a production iOS build/TestFlight for real iPhones. Native iOS compilation cannot run on Windows: use EAS or a Mac/Xcode. Build and submission are separate actions. No cloud build, store submission, developer-account enrollment, payment or credential generation is performed automatically by this change.

Expo also skips generating the `ios/` native project on Windows. Its managed configuration and iOS Hermes bundle can be checked here; EAS/macOS performs the native project generation, CocoaPods installation and Xcode compilation.

Before submitting, configure the actual privacy-policy/support URLs and store metadata, complete Apple privacy/Google Data Safety disclosures for the deployed backend, provide reviewer access, and exercise authentication/account deletion on real devices. Make platform declarations reflect actual live services; the code cannot guarantee store approval. `eas submit --platform … --profile production` is the later, explicit publication step.

## Checks

```sh
npm test
npm run mobile:check
npm run mobile:lint
npm run mobile:export
npm run build
npm run contracts:check
npm run test:e2e
```

The web workspace uses React 19.3.1; Expo 58's renderer uses React 19.3.0. Metro explicitly resolves every native React import to the mobile workspace. Expo Doctor's duplicate-React check consequently reports the two intentional workspace versions; its other checks should pass. Removing that isolation or upgrading only native React can cause a renderer mismatch. The transitive minimatch override covers versions affected by GHSA-g3hv-75wg-m249, including fingerprinting and TypeScript lint tooling; it leaves legacy minimatch 3 consumers on their compatible API.
