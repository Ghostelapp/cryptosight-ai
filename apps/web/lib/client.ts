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
export function sampleCandles(timeframe: string): Candle[] {
  const duration =
    timeframe === "1M"
      ? 86400000 * 30
      : ({ m: 60000, h: 3600000, d: 86400000, w: 604800000 }[
          timeframe.slice(-1)
        ] || 3600000) * Number(timeframe.slice(0, -1));
  const end = Math.floor(Date.now() / duration) * duration;
  let close = 65000;
  return Array.from({ length: 280 }, (_, j) => {
    const open = close;
    close =
      open *
      (1 + Math.sin(j * 0.43) * 0.0018 + Math.cos(j * 0.11) * 0.001 + 0.0001);
    return {
      timestamp: end - (280 - j) * duration,
      open,
      close,
      high: Math.max(open, close) * (1.001 + Math.abs(Math.sin(j)) * 0.001),
      low: Math.min(open, close) * (0.999 - Math.abs(Math.cos(j)) * 0.001),
      volume: 10 + Math.abs(Math.sin(j * 0.41)) * 100,
      closed: true,
    };
  });
}
