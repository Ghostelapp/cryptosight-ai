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
async function paperMaintenance() {
  if (paperBusy) return;
  paperBusy = true;
  try {
    const result = await paperTick();
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
  for (const [name, every, fn, concurrency] of [
    ["cryptosight-analysis", 1000, analysisTick, 4],
    ["cryptosight-maintenance", 10000, maintenance, 1],
    ["cryptosight-paper", 5000, paperMaintenance, 1],
  ]) {
    const queue = new Queue(name, { connection });
    queues.push(queue);
    await queue.upsertJobScheduler(
      "tick",
      { every },
      { name: "tick", data: {} },
    );
    workers.push(new Worker(name, fn, { connection, concurrency }));
  }
} else {
  setInterval(paperMaintenance, 5000);
  await paperMaintenance();
  setInterval(analysisTick, 1000);
  setInterval(maintenance, 10000);
  await maintenance();
}
const server = createServer((req, res) => {
  res.writeHead(200, {
    "content-type": req.url === "/metrics" ? "text/plain" : "application/json",
  });
  res.end(
    req.url === "/metrics"
      ? `cryptosight_worker_failures_total ${failures}\ncryptosight_analyses_running ${analyses}\ncryptosight_maintenance_busy ${Number(maintenanceBusy)}\n`
      : JSON.stringify({ status: "ok", analyses, lastTick }),
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
