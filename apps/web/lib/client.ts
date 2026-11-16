export type Candle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closed: boolean;
};
export type Instrument = {
  venue: string;
  market: string;
  symbol: string;
  timeframe: string;
};
let csrfToken = "";
export function setCsrf(token: string) {
  csrfToken = token || "";
}
export async function api(path: string, options: any = {}) {
  const { body, ...rest } = options;
  const response = await fetch("/api/v1/" + path, {
    ...rest,
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
      ...options.headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.code || "service_unavailable");
  return value;
}
export const queryString = (i: Instrument) => new URLSearchParams(i).toString();
export { sampleCandles } from "../../../packages/market/sample.mjs";
