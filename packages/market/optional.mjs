import { z } from "zod";
import { jsonFetch } from "./providers.mjs";
const positive = z.number().finite().min(0),
  observed = z.string().datetime();
async function external(url, key, parse) {
  if (!url)
    return { value: null, unavailableReason: "provider_not_configured" };
  try {
    const target = new URL(url);
    if (target.protocol !== "https:") throw new Error("invalid_url");
    const raw = await jsonFetch(target.href, {
        headers: key ? { authorization: `Bearer ${key}` } : {},
        redirect: "error",
      }),
      value = parse.parse(raw);
    return {
      value,
      source: target.hostname,
      fetchedAt: new Date().toISOString(),
      stale: Date.now() - Date.parse(value.observedAt) > 3600000,
    };
  } catch {
    return { value: null, unavailableReason: "provider_unavailable" };
  }
}
export const onchain = () =>
  external(
    process.env.ONCHAIN_API_URL,
    process.env.ONCHAIN_API_KEY,
    z.object({
      observedAt: observed,
      exchangeInflowUsd: positive,
      exchangeOutflowUsd: positive,
      stablecoinNetflowUsd: z.number().finite(),
      whaleTransactions: z
        .array(
          z.object({
            hash: z.string().max(200),
            asset: z.string().max(30),
            valueUsd: positive,
            timestamp: observed,
          }),
        )
        .max(50),
    }),
  );
export const sentiment = () =>
  external(
    process.env.SENTIMENT_API_URL,
    process.env.SENTIMENT_API_KEY,
    z.object({
      observedAt: observed,
      score: z.number().finite().min(-1).max(1),
      sampleSize: z.number().int().nonnegative(),
      source: z.enum(["reddit", "x", "combined"]),
    }),
  );
export const liquidations = () =>
  external(
    process.env.LIQUIDATIONS_API_URL,
    process.env.LIQUIDATIONS_API_KEY,
    z.object({
      observedAt: observed,
      symbol: z.string().max(30),
      windowMinutes: z.number().int().positive(),
      longUsd: positive,
      shortUsd: positive,
    }),
  );
