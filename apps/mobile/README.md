# CryptoSight AI for iOS and Android

Native Expo SDK 58 / React Native 0.88 application. It uses the existing backend and account, rather than wrapping the website in a WebView. Start from the **repository root**:

```sh
npm ci
npm run mobile:start
```

Use a development build (`npm run mobile:android`, or `npm run mobile:ios` on a Mac) for browser sign-in and biometric testing. Expo Go is not the release/test target for custom-scheme authentication. Enter your backend's HTTPS origin on the first screen. A clearly labeled sample chart is available without a server. All private features require a connected account.

See [the mobile operating guide](../../docs/NATIVE-MOBILE.md) for local APK builds, server configuration, authentication, EAS signing, and validation boundaries.
