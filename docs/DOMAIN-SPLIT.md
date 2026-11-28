# Landing and terminal domains

The public pages imported from CryptoSight_AI_pelny_kod.zip are integrated independently from the current terminal/backend. Their original terminal and backend files do not replace the current application. The public home, educational articles and translations use the main domain. Account screens, signed wallet messages, email links, CSRF checks, native account pairing and the streaming gateway use the app origin.

Production environment:

```
PUBLIC_ORIGIN=https://cryptosight.tech
APP_ORIGIN=https://app.cryptosight.tech
NEXT_PUBLIC_GATEWAY_URL=wss://app.cryptosight.tech/ws
```

Create an A record `app` in the authoritative `cryptosight.tech` DNS zone pointing to `31.3.218.251`. An `app` record inside a separate `app.cryptosight.tech` zone would name `app.app.cryptosight.tech`; it does not create the required parent-zone record. Configure both hostnames in Nginx and obtain a valid certificate for the app hostname before changing production APP_ORIGIN. Rebuild the common Docker image after changing the public gateway URL.

Public terminal buttons link directly to the configured APP_ORIGIN and preserve the selected language. Old `/?reset=...`, `/?verify=...`, OAuth/MFA, billing and mobile-pairing links redirect to the app with their query values intact. Redirects use a fixed configured origin, no-store and no-referrer. Main-domain `/terminal` redirects to the app root. The app root rewrites internally to the terminal route. Public pages have main-domain canonical links and sitemaps; terminal pages use noindex, and app-domain robots disallows indexing.

Existing accounts, admin roles, personal keys, analyses and trades stay in the existing database. Browser cookies and local preferences are host-scoped, so users sign in again on the app subdomain. Configure the new subdomain in Turnstile/Google OAuth if those services require an explicit allowed hostname/callback. Resend domain verification stays on cryptosight.tech; new email links use APP_ORIGIN automatically.

Native clients should use `https://app.cryptosight.tech` as their server address (EXPO_PUBLIC_API_URL for a new build). Previously installed clients pinned to the old main-domain origin need their server setting changed or an updated build; the mutation Origin check is intentionally not broadened to the marketing site.

Local development keeps the terminal at the configured APP_ORIGIN root. With the isolated browser fixture this is `http://127.0.0.1:3100`; `http://localhost:3100` exercises the public site. Routing tests also verify the real production hostnames because Next can normalize loopback aliases in redirect headers.
