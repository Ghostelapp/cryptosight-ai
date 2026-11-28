import { paperTick } from "../../packages/backend/paper.mjs";
import { recordFailure } from "../../packages/backend/observability.mjs";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { Worker, Queue } from "bullmq";
import Redis from "ioredis";
import {
  recoverAbandonedJobs,
  claimAnalysis,
  runAnalysis,
  runBacktests,
  evaluateSignals,
} from "../../packages/backend/jobs.mjs";
import {
  alertsTick,
  deliveriesTick,
  schedulesTick,
} from "../../packages/backend/notifications.mjs";
import { query } from "../../packages/backend/store.mjs";
if (!process.env.DATABASE_URL)
  throw new Error(
    "Separate worker requires PostgreSQL. Embedded development uses the web-process worker.",
  );
let paperBusy = false;
let lastPaperTick = 0,
  lastAnalysisTick = 0;
async function paperMaintenance() {
  if (paperBusy) return;
  paperBusy = true;
  try {
    const result = await paperTick();
    lastPaperTick = Date.now();
    failures += result.failures;
  } catch {
    failures++;
    recordFailure("worker_paper", randomUUID());
  } finally {
    paperBusy = false;
  }
}
let analyses = 0,
  maintenanceBusy = false,
  lastTick = 0,
  failures = 0;
async function analysisTick() {
  try {
    const job = await claimAnalysis();
    lastAnalysisTick = Date.now();
    if (!job) return;
    analyses++;
    try {
      await runAnalysis(job);
    } finally {
      analyses--;
    }
  } catch {
    failures++;
    recordFailure("worker_analysis", randomUUID());
  }
}
async function maintenance() {
  if (maintenanceBusy) return;
  maintenanceBusy = true;
  try {
    await schedulesTick();
    await Promise.all([runBacktests(), alertsTick(), deliveriesTick()]);
    if (Date.now() - lastTick > 60000) {
      await recoverAbandonedJobs();
      await evaluateSignals();
      await query("DELETE FROM sessions WHERE expires_at<now()");
      await query("DELETE FROM auth_tokens WHERE expires_at<now()");
      await query("DELETE FROM wallet_challenges WHERE expires_at<now()");
      await query("DELETE FROM api_rate_limits WHERE expires_at<now()");
      lastTick = Date.now();
    }
  } catch {
    failures++;
    recordFailure("worker_maintenance", randomUUID());
  } finally {
    maintenanceBusy = false;
  }
}
const workers = [];
const queues = [];
if (process.env.REDIS_URL) {
  const connection = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  connection.on("error", () => {
    failures++;
    recordFailure("worker_redis", randomUUID());
  });
  for (const [name, every, fn, concurrency] of [
    ["cryptosight-analysis", 1000, analysisTick, 4],
    ["cryptosight-maintenance", 10000, maintenance, 1],
    ["cryptosight-paper", 5000, paperMaintenance, 1],
  ]) {
    const retention = {
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 86400, count: 500 },
    };
    const queue = new Queue(name, {
      connection,
      defaultJobOptions: retention,
      streams: { events: { maxLen: 1000 } },
    });
    queues.push(queue);
    await queue.upsertJobScheduler(
      "tick",
      { every },
      { name: "tick", data: {}, opts: retention },
    );
    const worker = new Worker(name, fn, { connection, concurrency });
    worker.on("error", () => {
      failures++;
      recordFailure("worker_queue", randomUUID());
    });
    workers.push(worker);
  }
} else {
  setInterval(paperMaintenance, 5000);
  await paperMaintenance();
  setInterval(analysisTick, 1000);
  setInterval(maintenance, 10000);
  await maintenance();
}
const server = createServer((req, res) => {
  const healthy =
    (analyses > 0 || Date.now() - lastAnalysisTick < 30000) &&
    Date.now() - lastPaperTick < 45000;
  res.writeHead(req.url === "/metrics" || healthy ? 200 : 503, {
    "content-type": req.url === "/metrics" ? "text/plain" : "application/json",
  });
  res.end(
    req.url === "/metrics"
      ? `cryptosight_worker_failures_total ${failures}\ncryptosight_analyses_running ${analyses}\ncryptosight_maintenance_busy ${Number(maintenanceBusy)}\n`
      : JSON.stringify({
          status: healthy ? "ok" : "degraded",
          analyses,
          lastTick,
          lastAnalysisTick,
          lastPaperTick,
        }),
  );
}).listen(Number(process.env.WORKER_PORT || 3002));
async function stop() {
  server.close();
  await Promise.all(workers.map((w) => w.close()));
  await Promise.all(queues.map((q) => q.close()));
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
