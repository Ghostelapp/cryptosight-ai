import { spawn } from "node:child_process";
import { resolve } from "node:path";
try {
  process.loadEnvFile(".env");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
process.env.DEV_DATABASE_PATH ||= resolve(process.cwd(), ".runtime/database");
process.env.PROJECT_ROOT ||= process.cwd();
const args = process.argv.slice(2);
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "apps/web", ...args],
  { stdio: "inherit", env: process.env },
);
for (const event of ["SIGINT", "SIGTERM"])
  process.on(event, () => child.kill(event));
child.on("exit", (code) => process.exit(code || 0));
