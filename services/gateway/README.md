# Market gateway

Run `npm run gateway` with Node 24. Streams and shares exchange candles/order flow, reconnects with jitter, reloads via client REST, bounds subscriptions/payloads/backpressure and publishes metrics on `/metrics`. Production drawing sync requires PostgreSQL and Redis; authenticated clients pass a one-use `ws-ticket` as a URL query parameter during upgrade.

Set APP_ORIGIN and GATEWAY_PORT (default 3001). Expose through a TLS reverse proxy, keep metrics internal. The synthetic test override is available only under NODE_ENV=test. See docs/API.md and docs/LOAD-TEST.json.
