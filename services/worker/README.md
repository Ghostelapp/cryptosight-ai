# Analysis and maintenance worker

Run `npm run worker` with PostgreSQL. Redis activates BullMQ schedulers; without Redis the worker uses process timers. PostgreSQL row locks claim analysis/backtest jobs. Maintenance evaluates alerts/signals, sends configured notifications, enqueues schedules, cleans expiring tokens and recovers abandoned jobs. `/health` and `/metrics` listen on WORKER_PORT (default 3002); keep this internal.

Development without DATABASE_URL uses the embedded worker in the web process instead. Do not run separate gateway/worker processes against a shared PGlite path. Configure integration secrets and pricing in the operator environment. Logs contain generic failure/request IDs only.
