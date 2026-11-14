"use client";
import {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import {
  api,
  queryString,
  sampleCandles,
  Instrument,
  Candle,
} from "../lib/client";
import { LoaderCircle, RefreshCw } from "lucide-react";
import {
  registerWorkerIndicators,
  priceIndicators,
  extraIndicators,
} from "../lib/chart-indicators";
let registered = false;
function serialize(o: any) {
  return {
    name: o.name,
    points: o.points.map((p: any) => ({
      timestamp: p.timestamp,
      value: p.value,
    })),
    styles: o.styles,
    lock: o.lock,
    visible: o.visible,
    extendData: o.extendData,
  };
}
function customOverlays(k: any) {
  if (registered) return;
  registered = true;
  for (const name of [
    "csRect",
    "csEllipse",
    "csArrow",
    "csRange",
    "csMeasure",
    "csExtension",
    "csLong",
    "csShort",
    "csBrush",
  ])
    k.registerOverlay({
      name,
      totalStep: ["csLong", "csShort"].includes(name) ? 4 : 3,
      needDefaultPointFigure: true,
      needDefaultXAxisFigure: true,
      needDefaultYAxisFigure: true,
      createPointFigures: ({ coordinates: c, overlay: o }: any) => {
        if (c.length < 2) return [];
        const [a, b, t] = c;
        const color = o.styles?.line?.color || "#43c4dd";
        const line = (points: any) => ({
          type: "line",
          attrs: { coordinates: points },
          styles: { color, size: 1.5 },
        });
        const label = (text: string, x = a.x, y = a.y) => ({
          type: "text",
          attrs: { x, y, text, align: "left", baseline: "bottom" },
          styles: {
            color,
            size: 12,
            backgroundColor: "#101b2b",
            paddingLeft: 4,
            paddingRight: 4,
            paddingTop: 4,
            paddingBottom: 4,
          },
        });
        const rect = (
          x: number,
          y: number,
          width: number,
          height: number,
          fill: string,
        ) => ({
          type: "rect",
          attrs: { x, y, width, height },
          styles: {
            style: "stroke_fill",
            color: fill,
            borderColor: color,
            borderSize: 1,
          },
        });
        if (name === "csBrush") return [line(c)];
        if (name === "csEllipse") {
          const cx = (a.x + b.x) / 2,
            cy = (a.y + b.y) / 2,
            rx = Math.abs(b.x - a.x) / 2,
            ry = Math.abs(b.y - a.y) / 2;
          return [
            line(
              Array.from({ length: 65 }, (_, j) => ({
                x: cx + rx * Math.cos((j / 64) * Math.PI * 2),
                y: cy + ry * Math.sin((j / 64) * Math.PI * 2),
              })),
            ),
          ];
        }
        if (name === "csRect")
          return [
            rect(
              Math.min(a.x, b.x),
              Math.min(a.y, b.y),
              Math.abs(b.x - a.x),
              Math.abs(b.y - a.y),
              color + "18",
            ),
          ];
        if (name === "csArrow") {
          const angle = Math.atan2(b.y - a.y, b.x - a.x);
          return [
            line([a, b]),
            line([
              {
                x: b.x - 12 * Math.cos(angle - 0.5),
                y: b.y - 12 * Math.sin(angle - 0.5),
              },
              b,
              {
                x: b.x - 12 * Math.cos(angle + 0.5),
                y: b.y - 12 * Math.sin(angle + 0.5),
              },
            ]),
          ];
        }
        if (name === "csExtension")
          return [0, 1, 1.272, 1.618, 2, 2.618].flatMap((level) => {
            const y = a.y + (b.y - a.y) * level;
            return [
              line([
                { x: a.x, y },
                { x: b.x, y },
              ]),
              label(String(level), b.x, y),
            ];
          });
        if (name === "csRange" || name === "csMeasure") {
          const p = o.points,
            delta = p[1].value - p[0].value,
            pct = (delta / p[0].value) * 100,
            time =
              Math.abs((p[1].timestamp || 0) - (p[0].timestamp || 0)) / 3600000;
          return [
            rect(
              Math.min(a.x, b.x),
              Math.min(a.y, b.y),
              Math.abs(b.x - a.x),
              Math.abs(b.y - a.y),
              color + "18",
            ),
            label(
              `${delta.toFixed(2)} (${pct.toFixed(2)}%)${name === "csMeasure" ? ` · ${time.toFixed(1)}h` : ""}`,
              Math.min(a.x, b.x),
              Math.min(a.y, b.y),
            ),
          ];
        }
        if ((name === "csLong" || name === "csShort") && t) {
          const p = o.points,
            rr = Math.abs(
              (p[2].value - p[0].value) / (p[1].value - p[0].value),
            );
          return [
            rect(
              Math.min(a.x, b.x),
              Math.min(a.y, b.y),
              Math.abs(b.x - a.x) || 80,
              Math.abs(a.y - b.y),
              "#e665731f",
            ),
            rect(
              Math.min(a.x, b.x),
              Math.min(a.y, t.y),
              Math.abs(b.x - a.x) || 80,
              Math.abs(a.y - t.y),
              "#36cfa61f",
            ),
            line([
              { x: a.x, y: a.y },
              { x: b.x, y: a.y },
            ]),
            label(`RR ${Number.isFinite(rr) ? rr.toFixed(2) : "—"}`, a.x, a.y),
          ];
        }
        return [line([a, b])];
      },
    });
}
export const MarketChart = forwardRef(function MarketChart(
  {
    instrument,
    locale,
    timezone,
    theme,
    chartType,
    indicatorNames,
    period,
    demo,
    user,
    analysis,
    showOverlay,
    onData,
    onStatus,
    onError,
    t,
    compact = false,
    onCrosshair,
    syncPoint,
    onOrderflow,
    allowFallback = true,
  }: any,
  ref: any,
) {
  const element = useRef<HTMLDivElement>(null),
    chart = useRef<any>(null),
    lib = useRef<any>(null),
    saved = useRef<any[]>([]),
    versions = useRef<Record<string, number>>({}),
    history = useRef<any[][]>([]),
    redo = useRef<any[][]>([]),
    suppress = useRef(false),
    brush = useRef<any[]>([]),
    [brushMode, setBrushMode] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [status, setStatus] = useState("connecting");
  const options = useRef({
    magnet: false,
    color: "#43c4dd",
    lock: false,
    hidden: false,
    note: "",
  });
  const snapshot = () => {
    if (!suppress.current) {
      history.current.push(structuredClone(saved.current));
      history.current = history.current.slice(-40);
      redo.current = [];
    }
  };
  const save = async (o: any, checkpoint = true) => {
    if (suppress.current || o.groupId === "ai") return;
    const payload = serialize(o);
    if (checkpoint) snapshot();
    saved.current = [
      ...saved.current.filter((x) => x.id !== o.id),
      { id: o.id, ...payload },
    ];
    if (user) {
      try {
        const row = await api(`drawings/${o.id}`, {
          method: "PUT",
          body: {
            ...instrument,
            kind: o.name,
            payload,
            version: versions.current[o.id] || 0,
          },
        });
        versions.current[o.id] = row.version;
      } catch (e: any) {
        onError(e.message);
      }
    }
  };
  const remove = async (o: any) => {
    if (suppress.current || o.groupId === "ai") return;
    snapshot();
    saved.current = saved.current.filter((x) => x.id !== o.id);
    if (user) {
      try {
        await api("drawings/" + o.id, { method: "DELETE", body: {} });
      } catch (e: any) {
        onError(e.message);
      }
    }
  };
  const callbacks = () => ({
    onDrawEnd: ({ overlay }: any) => {
      save(overlay);
      return true;
    },
    onPressedMoveEnd: ({ overlay }: any) => {
      save(overlay);
      return true;
    },
    onRemoved: ({ overlay }: any) => {
      remove(overlay);
      return true;
    },
  });
  const restore = async (items: any[]) => {
    suppress.current = true;
    chart.current?.removeOverlay({ groupId: "user" });
    for (const o of items)
      chart.current?.createOverlay({ ...o, groupId: "user", ...callbacks() });
    suppress.current = false;
    const old = saved.current;
    saved.current = structuredClone(items);
    if (user) {
      for (const o of old.filter((x) => !items.some((y) => y.id === x.id)))
        await api("drawings/" + o.id, { method: "DELETE", body: {} });
      for (const o of items) await save(o, false);
    }
  };
  useImperativeHandle(ref, () => ({
    tool: (name: string, note?: string) => {
      if (name === "csBrush") {
        setBrushMode(true);
        return;
      }
      chart.current?.createOverlay({
        id: crypto.randomUUID(),
        name,
        groupId: "user",
        mode: options.current.magnet ? "weak_magnet" : "normal",
        lock: options.current.lock,
        styles: { line: { color: options.current.color } },
        extendData:
          name === "simpleAnnotation" ? note || t("drawingNote") : null,
        ...callbacks(),
      });
    },
    setOptions: async (opt: any) => {
      Object.assign(options.current, opt);
      if ("lock" in opt || "hidden" in opt) {
        const changed = saved.current.map((x) => ({
          ...x,
          lock: options.current.lock,
          visible: !options.current.hidden,
        }));
        await restore(changed);
      }
    },
    undo: async () => {
      const prev = history.current.pop();
      if (prev) {
        redo.current.push(structuredClone(saved.current));
        await restore(prev);
      }
    },
    redo: async () => {
      const next = redo.current.pop();
      if (next) {
        history.current.push(structuredClone(saved.current));
        await restore(next);
      }
    },
    clear: async () => {
      snapshot();
      await restore([]);
    },
    export: async (lines: string[] = []) => {
      const url = chart.current?.getConvertPictureUrl(
        true,
        "png",
        theme === "dark" ? "#0b111a" : "#ffffff",
      );
      if (!url) return;
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas"),
        ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = img.width;
      ctx.font = "16px sans-serif";
      const wrapped: string[] = [];
      for (const text of lines) {
        let row = "";
        for (const word of text.split(/\s+/)) {
          const next = row ? row + " " + word : word;
          if (ctx.measureText(next).width > canvas.width - 40 && row) {
            wrapped.push(row);
            row = word;
          } else row = next;
        }
        wrapped.push(row);
      }
      canvas.height =
        img.height + (wrapped.length ? wrapped.length * 24 + 40 : 0);
      ctx.fillStyle = theme === "dark" ? "#0b111a" : "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      ctx.font = "16px sans-serif";
      ctx.fillStyle = theme === "dark" ? "#d8e3ee" : "#102030";
      wrapped.forEach((line, i) =>
        ctx.fillText(line, 20, img.height + 28 + i * 24),
      );
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${instrument.symbol}-${instrument.timeframe}.png`;
      a.click();
    },
    getDrawings: () => saved.current,
  }));
  useEffect(() => {
    let dead = false,
      ws: any,
      timer: any,
      heartbeat: any,
      attempt = 0;
    const narrow = window.matchMedia("(max-width: 850px)");
    const applyResponsiveStyles = () => {
      const c = chart.current;
      if (!c) return;
      const small = narrow.matches || compact;
      c.setStyles({
        candle: {
          tooltip: {
            showRule: "follow_cross",
            showType: "rect",
            text: { size: small ? 10 : 12 },
            rect: {
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 6,
              paddingBottom: 6,
            },
          },
          priceMark: {
            high: { show: !small, textSize: 10 },
            low: { show: !small, textSize: 10 },
            last: { text: { size: small ? 10 : 12 } },
          },
        },
        indicator: {
          tooltip: {
            showRule: small ? "none" : "follow_cross",
            showType: "rect",
            text: { size: small ? 10 : 12 },
          },
        },
        xAxis: { tickText: { size: small ? 10 : 12 } },
        yAxis: { tickText: { size: small ? 10 : 12 } },
        crosshair: {
          horizontal: { text: { size: small ? 10 : 12 } },
          vertical: { text: { size: small ? 10 : 12 } },
        },
      });
      c.resize();
    };
    narrow.addEventListener("change", applyResponsiveStyles);
    const abort = new AbortController();
    setLoading(true);
    setError("");
    setStatus(demo ? "demo" : "connecting");
    saved.current = [];
    versions.current = {};
    history.current = [];
    redo.current = [];
    const setConnection = (state: string) => {
      if (dead) return;
      setStatus(state);
      onStatus?.(state);
    };
    const load = async () => {
      if (demo)
        return {
          candles: sampleCandles(instrument.timeframe),
          indicators: null,
          provenance: { source: "synthetic", stale: false },
        };
      return api(
        "candles?" +
          queryString(instrument) +
          "&period=" +
          period +
          "&fallback=" +
          allowFallback,
        { signal: abort.signal },
      );
    };
    const transformed = (candles: Candle[]) => {
      if (chartType !== "heikin") return candles;
      let po: any = null,
        pc: any = null;
      return candles.map((c) => {
        const close = (c.open + c.high + c.low + c.close) / 4,
          open = po == null ? (c.open + c.close) / 2 : (po + pc) / 2;
        po = open;
        pc = close;
        return {
          ...c,
          open,
          close,
          high: Math.max(c.high, open, close),
          low: Math.min(c.low, open, close),
        };
      });
    };
    const connect = async () => {
      if (dead || demo) return;
      let gateway = process.env.NEXT_PUBLIC_GATEWAY_URL;
      let url = "";
      let subscribe: any = null;
      const f = instrument.timeframe;
      const bf =
        ({ "1d": "D", "1w": "W", "1M": "M" } as any)[f] ||
        String(
          (({ m: 60000, h: 3600000, d: 86400000, w: 604800000 } as any)[
            f.slice(-1)
          ] *
            Number(f.slice(0, -1))) /
            60000,
        );
      const of =
        (
          {
            "1h": "1H",
            "2h": "2H",
            "4h": "4H",
            "6h": "6Hutc",
            "12h": "12Hutc",
            "1d": "1Dutc",
            "1w": "1Wutc",
            "1M": "1Mutc",
          } as any
        )[f] || f;
      if (gateway) {
        if (user) {
          try {
            const ticket = await api("ws-ticket", { method: "POST", body: {} });
            gateway += `?ticket=${ticket.ticket}`;
          } catch {}
        }
        url = gateway;
        subscribe = { v: 1, type: "subscribe", instrument, timeframe: f };
      } else if (instrument.venue === "binance")
        url = `${instrument.market === "spot" ? "wss://stream.binance.com:9443" : "wss://fstream.binance.com"}/ws/${instrument.symbol.toLowerCase()}@kline_${f}`;
      else if (instrument.venue === "bybit") {
        url = `wss://stream.bybit.com/v5/public/${instrument.market === "spot" ? "spot" : "linear"}`;
        subscribe = {
          op: "subscribe",
          args: [`kline.${bf}.${instrument.symbol}`],
        };
      } else {
        url = "wss://ws.okx.com/ws/v5/business";
        subscribe = {
          op: "subscribe",
          args: [
            {
              channel: `candle${of}`,
              instId:
                instrument.symbol.replace("USDT", "-USDT") +
                (instrument.market === "perpetual" ? "-SWAP" : ""),
            },
          ],
        };
      }
      if (dead) return;
      setConnection("connecting");
      ws = new WebSocket(url);
      let last = Date.now();
      ws.onopen = () => {
        if (subscribe) ws.send(JSON.stringify(subscribe));
        attempt = 0;
        setConnection("live");
        heartbeat = setInterval(() => {
          if (Date.now() - last > 60000) {
            setConnection("stale");
            ws.close();
          } else if (
            ws.readyState === 1 &&
            instrument.venue !== "binance" &&
            !gateway
          )
            ws.send(
              instrument.venue === "okx"
                ? "ping"
                : JSON.stringify({ op: "ping" }),
            );
        }, 20000);
      };
      ws.onmessage = (e: any) => {
        last = Date.now();
        if (e.data === "pong") return;
        try {
          const m = JSON.parse(e.data);
          let c: any;
          if (gateway) {
            if (m.type === "status") {
              setConnection(m.payload.state);
              return;
            }
            if (m.type === "drawing") {
              api("drawings?" + queryString(instrument))
                .then((rows: any[]) => {
                  const items = rows.map((r) => ({ id: r.id, ...r.payload }));
                  for (const r of rows) versions.current[r.id] = r.version;
                  suppress.current = true;
                  chart.current?.removeOverlay({ groupId: "user" });
                  for (const o of items)
                    chart.current?.createOverlay({
                      ...o,
                      groupId: "user",
                      ...callbacks(),
                    });
                  suppress.current = false;
                  saved.current = items;
                })
                .catch(() => setConnection("reconnecting"));
              return;
            }
            if (["depth", "trade", "liquidation"].includes(m.type)) {
              onOrderflow?.(m);
              return;
            }
            if (m.type === "candle") c = m.payload;
          } else if (m.k) {
            const k = m.k;
            c = {
              timestamp: k.t,
              open: +k.o,
              high: +k.h,
              low: +k.l,
              close: +k.c,
              volume: +k.v,
              closed: k.x,
            };
          } else if (m.topic?.startsWith("kline.") && m.data?.length) {
            const k = m.data[0];
            c = {
              timestamp: +k.start,
              open: +k.open,
              high: +k.high,
              low: +k.low,
              close: +k.close,
              volume: +k.volume,
              closed: k.confirm,
            };
          } else if (m.arg?.channel.startsWith("candle") && m.data?.length) {
            const k = m.data[0];
            c = {
              timestamp: +k[0],
              open: +k[1],
              high: +k[2],
              low: +k[3],
              close: +k[4],
              volume: +k[5],
              closed: k[8] === "1",
            };
          }
          if (c && chart.current) {
            if (chartType === "heikin") {
              const all = chart.current
                  .getDataList()
                  .filter((b: any) => b.timestamp < c.timestamp),
                prev = all.at(-1),
                close = (c.open + c.high + c.low + c.close) / 4,
                open = prev
                  ? (prev.open + prev.close) / 2
                  : (c.open + c.close) / 2;
              c = {
                ...c,
                open,
                close,
                high: Math.max(c.high, open, close),
                low: Math.min(c.low, open, close),
              };
            }
            chart.current.updateData(c);
            if (c.closed)
              load()
                .then((d) => {
                  if (!dead) onData?.(d);
                })
                .catch(() => {});
          }
        } catch {}
      };
      ws.onerror = () => setConnection("offline");
      ws.onclose = () => {
        clearInterval(heartbeat);
        if (dead) return;
        setConnection("reconnecting");
        timer = setTimeout(
          async () => {
            try {
              const d = await load();
              if (!dead) {
                chart.current?.applyNewData(transformed(d.candles));
                onData?.(d);
              }
            } catch {}
            connect();
          },
          Math.min(30000, 1000 * 2 ** Math.min(attempt++, 5)) +
            Math.random() * 500,
        );
      };
    };
    (async () => {
      try {
        const k = await import("klinecharts");
        if (dead || !element.current) return;
        lib.current = k;
        customOverlays(k);
        registerWorkerIndicators(k);
        k.registerLocale(locale, {
          time: t("chartTime") + ": ",
          open: t("chartOpen") + ": ",
          high: t("chartHigh") + ": ",
          low: t("chartLow") + ": ",
          close: t("chartClose") + ": ",
          volume: t("chartVolume") + ": ",
          turnover: t("chartTurnover") + ": ",
          change: t("chartChange") + ": ",
        });
        const ch: any = k.init(element.current, { locale, timezone });
        chart.current = ch;
        ch?.setStyles(theme === "light" ? "light" : "dark");
        ch?.setStyles({
          grid: {
            horizontal: { color: theme === "dark" ? "#182330" : "#e7edf4" },
            vertical: { color: theme === "dark" ? "#182330" : "#e7edf4" },
          },
          candle: {
            type:
              chartType === "line" || chartType === "area"
                ? "area"
                : "candle_solid",
            area: {
              backgroundColor:
                chartType === "line"
                  ? "transparent"
                  : [
                      { offset: 0, color: "rgba(67,196,221,0.2)" },
                      { offset: 1, color: "rgba(67,196,221,0)" },
                    ],
              lineColor: "#43c4dd",
            },
            bar: {
              upColor: "#36cfa6",
              downColor: "#e66573",
              upBorderColor: "#36cfa6",
              downBorderColor: "#e66573",
              upWickColor: "#36cfa6",
              downWickColor: "#e66573",
            },
          },
        });
        const d = await load();
        if (dead) return;
        ch?.applyNewData(transformed(d.candles));
        ch?.setPriceVolumePrecision(d.candles.at(-1)?.close < 1 ? 6 : 2, 2);
        ch?.setOffsetRightDistance(narrow.matches || compact ? 24 : 50);
        ch?.setBarSpace(narrow.matches || compact ? 6 : 8);
        applyResponsiveStyles();
        onData?.(d);
        setLoading(false);
        if (demo) setConnection("demo");
        if (user) {
          const rows = await api("drawings?" + queryString(instrument));
          if (dead) return;
          suppress.current = true;
          for (const row of rows) {
            versions.current[row.id] = row.version;
            const o = { id: row.id, ...row.payload };
            saved.current.push(o);
            ch?.createOverlay({ ...o, groupId: "user", ...callbacks() });
          }
          suppress.current = false;
        }
        ch?.subscribeAction(k.ActionType.OnCrosshairChange, (e: any) =>
          onCrosshair?.({
            timestamp: e.kLineData?.timestamp,
            value: e.coordinate?.y,
            source: instrument.timeframe,
          }),
        );
        connect();
      } catch (e: any) {
        if (!dead) {
          setError(e.message);
          setLoading(false);
          setConnection("offline");
        }
      }
    })();
    const resize = new ResizeObserver(() => chart.current?.resize());
    if (element.current) resize.observe(element.current);
    return () => {
      dead = true;
      abort.abort();
      clearTimeout(timer);
      clearInterval(heartbeat);
      ws?.close();
      resize.disconnect();
      narrow.removeEventListener("change", applyResponsiveStyles);
      if (chart.current && element.current)
        lib.current?.dispose(element.current);
      chart.current = null;
    };
  }, [
    instrument.venue,
    instrument.market,
    instrument.symbol,
    instrument.timeframe,
    chartType,
    theme,
    timezone,
    demo,
    user?.id,
    period,
    locale,
    allowFallback,
    compact,
  ]);
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    const instances = c.getIndicatorByPaneId();
    if (instances)
      for (const paneId of Array.from(instances.keys()))
        c.removeIndicator(paneId);
    for (const name of indicatorNames)
      c.createIndicator(
        {
          name,
          precision: priceIndicators.includes(name) ? undefined : 2,
          calcParams:
            name === "EMA" || name === "MA"
              ? [period, 50, 100, 200]
              : name === "RSI" || extraIndicators.includes(name)
                ? [period]
                : undefined,
        },
        priceIndicators.includes(name),
        priceIndicators.includes(name) ? { id: "candle_pane" } : { height: 90 },
      );
    c.createIndicator("VOL", false, { height: 70 });
  }, [indicatorNames.join(","), period, loading]);
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    c.removeOverlay({ groupId: "ai" });
    if (!analysis || !showOverlay) return;
    const levels = [
      ...analysis.key_levels.support.map((v: any) => ({ v, color: "#708ba6" })),
      ...analysis.key_levels.resistance.map((v: any) => ({
        v,
        color: "#708ba6",
      })),
    ];
    for (const s of analysis.setups)
      if (s.direction !== "NO_TRADE")
        levels.push(
          { v: s.entry.price, color: "#43c4dd" },
          { v: s.stop_loss, color: "#e66573" },
          ...s.take_profits.map((v: any) => ({ v: v.price, color: "#36cfa6" })),
        );
    for (const l of levels)
      c.createOverlay({
        name: "horizontalStraightLine",
        groupId: "ai",
        lock: true,
        points: [{ value: l.v }],
        styles: { line: { color: l.color, style: "dashed" } },
      });
    for (const z of analysis.key_levels.liquidity_zones || [])
      c.createOverlay({
        name: "csRect",
        groupId: "ai",
        lock: true,
        points: [
          { timestamp: Date.now() - 86400000, value: z.low },
          { timestamp: Date.now(), value: z.high },
        ],
        styles: { line: { color: "#c2a2fa" } },
      });
  }, [analysis, showOverlay, loading]);
  useEffect(() => {
    if (
      !syncPoint?.timestamp ||
      syncPoint.source === instrument.timeframe ||
      !chart.current
    )
      return;
    try {
      const p = chart.current.convertToPixel(
        { timestamp: syncPoint.timestamp },
        { paneId: "candle_pane" },
      );
      chart.current.executeAction(lib.current.ActionType.OnCrosshairChange, {
        x: p.x,
        y: 100,
        paneId: "candle_pane",
      });
    } catch {}
  }, [syncPoint]);
  function point(event: any) {
    const rect = element.current!.getBoundingClientRect();
    return chart.current.convertFromPixel(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      { paneId: "candle_pane" },
    );
  }
  return (
    <div className={"chart-shell " + (compact ? "compact" : "")}>
      <div className="chart-indicator-labels" aria-label={t("indicators")}>
        {indicatorNames.map((name: string) => (
          <span key={name}>
            {name.replace(/^CS_/, "")} (
            {name === "EMA" || name === "MA" ? `${period}/50/100/200` : period})
          </span>
        ))}
        <span>VOL</span>
      </div>
      <div className="chart-canvas" ref={element} />
      {compact && <span className="chart-frame">{instrument.timeframe}</span>}
      {loading && (
        <div className="chart-message">
          <LoaderCircle className="spin" size={28} />
          <span>{t("loading")}</span>
        </div>
      )}
      {error && (
        <div className="chart-message">
          <RefreshCw size={28} />
          <p>{t("chartUnavailable")}</p>
        </div>
      )}
      {brushMode && (
        <div
          className="brush-layer"
          onPointerDown={(e: any) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            brush.current = [point(e)];
          }}
          onPointerMove={(e: any) => {
            if (e.buttons && brush.current.length < 500)
              brush.current.push(point(e));
          }}
          onPointerUp={() => {
            if (brush.current.length > 1) {
              const id = crypto.randomUUID();
              chart.current.createOverlay({
                id,
                name: "csBrush",
                groupId: "user",
                points: brush.current,
                styles: { line: { color: options.current.color } },
                ...callbacks(),
              });
              save(chart.current.getOverlayById(id));
            }
            setBrushMode(false);
          }}
        />
      )}
    </div>
  );
});
