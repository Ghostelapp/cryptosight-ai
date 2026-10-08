import { paperTick } from "./paper.mjs";
import { query } from "./store.mjs";
import {
  recoverAbandonedJobs,
  claimAnalysis,
  runAnalysis,
  runBacktests,
  evaluateSignals,
} from "./jobs.mjs";
import { alertsTick, deliveriesTick, schedulesTick } from "./notifications.mjs";
export function startEmbeddedWorker() {
  if (process.env.DATABASE_URL || process.env.NODE_ENV === "test") return;
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_LOCAL_DB !== "true"
  )
    return;
  const key = Symbol.for("cryptosight.embedded-worker");
  if (globalThis[key]) return;
  let analysisBusy = false,
    maintenanceBusy = false;
  let paperBusy = false;
  const paper = setInterval(async () => {
    if (paperBusy) return;
    paperBusy = true;
    try {
      await paperTick();
    } catch {
    } finally {
      paperBusy = false;
    }
  }, 5000);
  paper.unref();
  const analysis = setInterval(async () => {
    if (analysisBusy) return;
    analysisBusy = true;
    try {
      const job = await claimAnalysis();
      if (job) await runAnalysis(job);
    } catch {
    } finally {
      analysisBusy = false;
    }
  }, 3000);
  const maintenance = setInterval(async () => {
    if (maintenanceBusy) return;
    maintenanceBusy = true;
    try {
      await query("DELETE FROM wallet_challenges WHERE expires_at<now()");
      await recoverAbandonedJobs();
      await runBacktests();
      await schedulesTick();
      await alertsTick();
      await deliveriesTick();
      await evaluateSignals();
    } catch {
    } finally {
      maintenanceBusy = false;
    }
  }, 15000);
  analysis.unref();
  maintenance.unref();
  globalThis[key] = [analysis, maintenance, paper];
}
