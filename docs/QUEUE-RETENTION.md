# Worker queue retention and recovery

The production incident on 2026-11-28 was caused by retained BullMQ scheduler ticks filling Redis's 256 MB `noeviction` ceiling. The worker process stayed alive while Redis rejected job execution, leaving database analyses queued and paper/maintenance ticks stale.

Recovery temporarily raised the ceiling to 512 MB, removed only completed scheduler ticks older than one hour, and trimmed their event streams. Removed completed ticks: 184,194 analysis, 18,470 maintenance and 36,880 paper. Redis memory fell from 256.10 MB to 2.88 MB in that observation. Database analysis results, accounts and paper orders were not deleted. Existing queued analyses subsequently ran; new paid analyses were not enqueued for diagnosis.

Scheduler templates now set `removeOnComplete: {age:3600,count:1000}` and `removeOnFail: {age:86400,count:500}`. Queue event streams target 1,000 entries. Retention is in the scheduler template as well as queue defaults, so repeated ticks inherit it. Redis keeps `noeviction`; pending queue keys must not be evicted as cache entries. After recovery and deployment verification the normal 256 MB ceiling can be restored.

Queue/Redis error handlers count failures and emit bounded diagnostics instead of dumping Redis command payloads. Worker health reports degraded when analysis polling is stale with no analysis in flight, or when paper execution has no recent heartbeat. A process merely listening on port 3002 is no longer sufficient for healthy status. Startup checks should allow the first paper tick to complete.

The database remains the source of analyses and trade history. Do not flush Redis, force-clean active tasks, or delete database jobs to recover memory. A sustained increase should be investigated using queue counts, retention templates and Redis memory information.
