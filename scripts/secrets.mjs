import { randomBytes } from "node:crypto";
for (const name of ["SESSION_SECRET", "POSTGRES_PASSWORD", "APP_DB_PASSWORD"])
  console.log(name + "=" + randomBytes(32).toString("hex"));
console.log("BYOK_ENCRYPTION_KEY=" + randomBytes(32).toString("base64"));
