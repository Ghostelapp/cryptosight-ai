import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { cp, mkdir } from "node:fs/promises";
try {
  process.loadEnvFile(".env");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
process.env.DEV_DATABASE_PATH ||= resolve(process.cwd(), ".runtime/database");
process.env.PROJECT_ROOT ||= process.cwd();
const root = "apps/web/.next/standalone/apps/web";
await mkdir(root + "/public", { recursive: true });
await cp("apps/web/public", root + "/public", { recursive: true });
await cp("apps/web/.next/static", root + "/.next/static", { recursive: true });
const child = spawn(process.execPath, [root + "/server.js"], {
  stdio: "inherit",
  env: process.env,
});
for (const event of ["SIGINT", "SIGTERM"])
  process.on(event, () => child.kill(event));
child.on("exit", (code) => process.exit(code || 0));
