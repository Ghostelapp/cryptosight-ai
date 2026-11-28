const symbol = "BTCUSDT";
const candleLimit = 36;
const refreshMs = 15_000;
const staleMs = 12_000;
const historyUrl = `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=1m&limit=${candleLimit}`;
const streamUrl = `wss://data-stream.binance.vision/ws/${symbol.toLowerCase()}@kline_1m`;

export function parseCandle([time, open, high, low, close]) {
  const values = [time, open, high, low, close];
  if (
    values.some(
      (value) =>
        typeof value !== "number" &&
        (typeof value !== "string" || !value.trim()),
    )
  )
    return;
  [time, open, high, low, close] = values.map(Number);
  if (
    ![time, open, high, low, close].every(Number.isFinite) ||
    !Number.isSafeInteger(time) ||
    time <= 0 ||
    low <= 0 ||
    low > Math.min(open, close) ||
    high < Math.max(open, close)
  )
    return;
  return { time, open, high, low, close };
}

function renderCandles(plot, candles) {
  const min = Math.min(...candles.map((candle) => candle.low));
  const max = Math.max(...candles.map((candle) => candle.high));
  const padding = Math.max((max - min) * 0.08, max * 0.00002);
  const percent = (value) =>
    ((value - min + padding) * 100) / (max - min + padding * 2);

  plot.style.gridTemplateColumns = `repeat(${candles.length}, minmax(0, 1fr))`;
  plot.replaceChildren(
    ...candles.map(({ open, high, low, close }) => {
      const wick = document.createElement("i");
      const body = document.createElement("b");
      wick.className = close >= open ? "up" : "down";
      wick.style.setProperty("--wick-bottom", `${percent(low)}%`);
      wick.style.setProperty(
        "--wick-height",
        `${percent(high) - percent(low)}%`,
      );
      body.style.bottom = `${percent(Math.min(open, close))}%`;
      body.style.height = `${Math.abs(percent(close) - percent(open))}%`;
      wick.append(body);
      return wick;
    }),
  );
}

function mountChart(chart) {
  const status = chart.querySelector("[data-market-status]");
  const price = chart.querySelector("[data-market-price]");
  const timestamp = chart.querySelector("[data-market-time]");
  const plot = chart.querySelector("[data-market-candles]");
  const formatPrice = new Intl.NumberFormat(chart.lang, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formatTime = new Intl.DateTimeFormat(chart.lang, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  });

  let candles = [];
  let socket;
  let lastEvent = 0;
  let lastUpdate = 0;
  let retryAt = 0;
  let retryDelay = 1_000;
  let lastSnapshot = 0;
  let request;
  let heartbeat;
  let active = false;

  function show(state) {
    if (chart.dataset.state === state) return;
    chart.dataset.state = state;
    status.textContent = chart.dataset[state];
  }

  function update(next, updatedAt) {
    candles = next
      .sort((left, right) => left.time - right.time)
      .slice(-candleLimit);
    lastUpdate = Math.max(updatedAt, lastUpdate);
    renderCandles(plot, candles);
    price.textContent = `${formatPrice.format(candles.at(-1).close)} USDT`;
    timestamp.textContent = `${formatTime.format(lastUpdate)} UTC`;
    timestamp.dateTime = new Date(lastUpdate).toISOString();
  }

  async function snapshot() {
    if (request) return;
    const started = Date.now();
    const controller = new AbortController();
    request = controller;
    lastSnapshot = started;
    const timeout = window.setTimeout(() => controller.abort(), 6_000);
    try {
      const response = await fetch(historyUrl, {
        signal: controller.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) throw new Error("Market data unavailable");
      const data = await response.json();
      const history = Array.isArray(data)
        ? data.filter(Array.isArray).map(parseCandle).filter(Boolean)
        : [];
      if (!history.length) throw new Error("No valid market data");
      if (!active || controller.signal.aborted) return;

      const merged = new Map(candles.map((candle) => [candle.time, candle]));
      const newestStreamCandle =
        lastEvent >= started ? candles.at(-1)?.time : undefined;
      for (const candle of history) {
        if (candle.time !== newestStreamCandle) merged.set(candle.time, candle);
      }
      update(
        [...merged.values()],
        newestStreamCandle ? lastUpdate : Date.now(),
      );
      if (Date.now() - lastEvent >= staleMs) show("snapshot");
    } catch {
      if (active && !candles.length && request === controller)
        show("unavailable");
    } finally {
      window.clearTimeout(timeout);
      if (request === controller) request = undefined;
    }
  }

  function disconnect(connection) {
    if (socket !== connection) return;
    socket = undefined;
    connection.close();
    retryAt = Date.now() + retryDelay;
    retryDelay = Math.min(retryDelay * 2, 30_000);
    if (candles.length) show("snapshot");
  }

  function connect(now) {
    let connection;
    try {
      connection = new WebSocket(streamUrl);
    } catch {
      retryAt = now + retryDelay;
      retryDelay = Math.min(retryDelay * 2, 30_000);
      return;
    }
    socket = connection;
    connection.addEventListener("message", ({ data }) => {
      if (socket !== connection) return;
      try {
        const { E: eventTime, k } = JSON.parse(data);
        if (
          k?.s !== symbol ||
          k?.i !== "1m" ||
          !Number.isSafeInteger(eventTime) ||
          Math.abs(Date.now() - eventTime) >= 60_000
        )
          return;
        const candle = parseCandle([k.t, k.o, k.h, k.l, k.c]);
        if (!candle || candle.time < (candles.at(-1)?.time ?? 0)) return;
        lastEvent = Date.now();
        retryDelay = 1_000;
        update(
          [...candles.filter(({ time }) => time !== candle.time), candle],
          eventTime,
        );
        show("live");
      } catch {
        // Ignore invalid messages without replacing any real data.
      }
    });
    connection.addEventListener("close", () => disconnect(connection));
    connection.addEventListener("error", () => disconnect(connection));
    connection.started = now;
  }

  function tick() {
    const now = Date.now();
    if (socket && now - Math.max(lastEvent, socket.started) >= staleMs)
      disconnect(socket);
    if (!socket && now >= retryAt) connect(now);
    if (
      now - lastEvent >= staleMs &&
      (now - lastSnapshot >= refreshMs || !lastSnapshot)
    )
      void snapshot();
  }

  function start() {
    if (active || document.hidden) return;
    active = true;
    tick();
    heartbeat = window.setInterval(tick, 2_000);
  }

  function stop() {
    if (!active) return;
    active = false;
    window.clearInterval(heartbeat);
    request?.abort();
    request = undefined;
    const connection = socket;
    socket = undefined;
    connection?.close();
    lastEvent = 0;
    lastSnapshot = 0;
    if (candles.length) show("snapshot");
  }

  document.addEventListener("visibilitychange", () =>
    document.hidden ? stop() : start(),
  );
  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", start);
  start();
}

if (typeof document !== "undefined") {
  document.querySelectorAll("[data-market-chart]").forEach(mountChart);
}
