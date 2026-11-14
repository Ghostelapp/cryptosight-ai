import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { projectRoot } from "./paths.mjs";
const cache = new Map();
export function messages(locale = "en") {
  if (!["en", "pl", "de"].includes(locale)) locale = "en";
  if (!cache.has(locale)) {
    const root = projectRoot();
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
