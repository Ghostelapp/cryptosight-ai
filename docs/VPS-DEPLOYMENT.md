# Production VPS deployment

The first VPS deployment on 2026-11-24 serves `https://cryptosight.tech`, with the gateway at `wss://cryptosight.tech/ws`. It runs Ubuntu 24.04, Docker Compose, PostgreSQL 17, Redis 7, the web application, gateway and persistent worker. Source is installed at `/opt/cryptosight`; this initial installation used an archive of the Git source, not a server-side Git checkout. Secrets were generated on the server in a private `.env` and are not committed.

## Operations

Connect with `ssh -p 2022 ubuntu@31.3.218.251` using an authorized key. From `/opt/cryptosight`:

```sh
sudo docker compose ps -a
sudo docker compose logs --tail=50 web worker gateway
sudo systemctl start cryptosight-health.service
sudo systemctl start cryptosight-backup.service
```

Nginx terminates HTTPS and forwards `/ws` to loopback port 3001 and other requests to port 3000. PostgreSQL and Redis have no published ports. UFW allows TCP 2022, 80 and 443. Docker and Nginx are enabled at boot, and persistent containers use `restart: unless-stopped`. Compose log rotation is configured in the server's `compose.override.yaml` (local driver, three 10 MB files per service).

`cryptosight-health.timer` checks public API health, local gateway health and the paper-worker heartbeat every minute. Failures are recorded by systemd; external alerts are not yet configured. Inspect with `sudo journalctl -u cryptosight-health.service`.

## Backups

`cryptosight-backup.timer` runs daily at 03:15 UTC. It saves a custom-format PostgreSQL dump and the private environment in `/var/backups/cryptosight`, accessible only to root. Files older than seven days are removed. The initial dump was restored successfully into a separate disposable database, its seven schema migrations were checked, and that test database was removed. The live database was preserved.

These backups reside on the same VPS. Configure an independent off-server destination before relying on them for server-loss recovery. Preserve `BYOK_ENCRYPTION_KEY` with database backups; it is needed to decrypt saved credentials. Never publish `.env` or backup files.

## Resend setup pending

In Resend, verify ownership of `cryptosight.tech` using the DNS records Resend supplies. Create a sending API key for that domain. Then connect in an interactive SSH terminal and run:

```sh
sudo /usr/local/sbin/cryptosight-configure-resend
```

The server-only helper reads the API key without echoing it, stores an SMTP-over-TLS URL for `smtp.resend.com:465` and sender `CryptoSight <noreply@cryptosight.tech>`, and recreates web/worker containers. It does not send email. Test registration and password recovery after configuring it. The key must not be pasted into a chat, shell argument or repository. Until configured, production email registration is unavailable. Google OAuth is also unconfigured; the existing wallet flow remains a separate option.

## Validation and deployment fixes

The Docker production build, TypeScript, all seven migrations, PostgreSQL runtime-role access, Redis-backed gateway startup, public HTTPS home/API, anonymous journal rejection and public WSS handshake passed. The worker heartbeat was fresh. Each selected venue (Binance, Bybit and OKX) returned 50 actual BTCUSDT hourly candles with fallback disabled. This is an access check, not a continuous-availability or latency guarantee. Paid model calls, mail delivery and physical mobile-device pairing were not exercised.

The first deployment exposed CRLF conversion of the PostgreSQL bootstrap shell script and a Redis subscription issued before the connection was ready. `.gitattributes` now forces shell scripts to LF, and the gateway connects before subscribing. The initially missing runtime role was provisioned without deleting the database, with grants on the already migrated tables.

For upgrades, back up first, transfer a reviewed source archive with LF shell files, preserve `.env`, Compose overrides and database volumes, rebuild, apply versioned migrations and check worker/gateway/API health. Do not run `docker compose down -v`; it deletes database volumes. GitHub pushes do not automatically deploy to this VPS.
