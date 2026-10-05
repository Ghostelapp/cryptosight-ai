let registered = false;
const configs: any = {
  SMA: ["value"],
  WMA: ["value"],
  ADX: ["adx", "pdi", "mdi"],
  ATR: ["value"],
  CCI: ["value"],
  WR: ["value"],
  MFI: ["value"],
  STOCHRSI: ["stochRSI", "k", "d"],
  ICHIMOKU: ["conversion", "base", "spanA", "spanB"],
  KELTNER: ["upper", "middle", "lower"],
  DONCHIAN: ["upper", "middle", "lower"],
  VWAP: ["value"],
  SUPERTREND: ["value"],
};
export const extraIndicators = Object.keys(configs).map((x) => "CS_" + x);
export const priceIndicators = [
  "EMA",
  "MA",
  "BOLL",
  "SAR",
  "CS_SMA",
  "CS_WMA",
  "CS_ICHIMOKU",
  "CS_KELTNER",
  "CS_DONCHIAN",
  "CS_VWAP",
  "CS_SUPERTREND",
];
export function registerWorkerIndicators(k: any) {
  if (registered) return;
  registered = true;
  const worker = new Worker("/workers/indicators.js");
  let id = 0;
  const pending = new Map<number, (value: any) => void>();
  worker.onmessage = ({ data }) => {
    pending.get(data.id)?.(data.result);
    pending.delete(data.id);
  };
  worker.onerror = () => {
    for (const resolve of pending.values()) resolve([]);
    pending.clear();
  };
  for (const [name, keys] of Object.entries(configs))
    k.registerIndicator({
      name: "CS_" + name,
      shortName: name,
      calcParams: [14],
      precision: 3,
      figures: (keys as string[]).map((key, i) => ({
        key,
        title: key,
        type: "line",
        styles: { color: ["#43c4dd", "#dfbd73", "#c2a2fa", "#36cfa6"][i % 4] },
      })),
      calc: (candles: any[], indicator: any) =>
        new Promise((resolve) => {
          const key = ++id;
          pending.set(key, resolve);
          worker.postMessage({
            id: key,
            name,
            candles,
            period: indicator.calcParams[0],
          });
          setTimeout(() => {
            if (pending.has(key)) {
              pending.delete(key);
              resolve(candles.map(() => ({})));
            }
          }, 10000);
        }),
    });
}
