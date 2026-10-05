import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const cache = new Map();
export function messages(locale = "en") {
  if (!["en", "pl", "de"].includes(locale)) locale = "en";
  if (!cache.has(locale)) {
    const root =
      process.env.PROJECT_ROOT ||
      (process.cwd().endsWith("/apps/web")
        ? resolve(process.cwd(), "../..")
        : process.cwd());
    cache.set(
      locale,
      JSON.parse(
        readFileSync(
          resolve(root, "apps/web/messages", locale + ".json"),
          "utf8",
        ),
      ),
    );
  }
  return cache.get(locale);
}
