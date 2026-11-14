"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { AdminPanel } from "./admin-panel";
import { CommandPalette, TerminalCommand } from "./command-palette";
import { MarketScreener } from "./market-screener";
import { JournalInsights } from "./journal-insights";
import {
  defaultWorkspace,
  normalizeWorkspace,
  workspaceKey,
} from "../lib/workspace.mjs";
import { tradePnl } from "../../../packages/quant/journal.mjs";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Activity,
  ChartCandlestick,
  LayoutDashboard,
  ScanLine,
  BookOpen,
  Wallet,
  History,
  FlaskConical,
  Settings,
  LogIn,
  LogOut,
  Search,
  Star,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Download,
  Bell,
  Plus,
  Trash2,
  SlidersHorizontal,
  Magnet,
  Undo2,
  Redo2,
  Lock,
  EyeOff,
  MousePointer2,
  MoveUpRight,
  Minus,
  MoveVertical,
  GitBranch,
  Square,
  Circle,
  Type,
  ArrowUp,
  Paintbrush,
  Ruler,
  Layers,
  RefreshCw,
  Check,
  Menu,
  X,
  Send,
  LoaderCircle,
} from "lucide-react";
import { WalletAccess } from "./wallet-access";
import { MarketChart } from "./chart";
import { extraIndicators } from "../lib/chart-indicators";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";
import { api, queryString, setCsrf, Instrument } from "../lib/client";
const frames = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "12h",
  "1d",
  "1w",
  "1M",
];
const nav = [
  ["terminal", ChartCandlestick],
  ["dashboard", LayoutDashboard],
  ["screener", ScanLine],
  ["alerts", Bell],
  ["journal", BookOpen],
  ["paper", Wallet],
  ["track", History],
  ["backtest", FlaskConical],
  ["settings", Settings],
] as const;
const tools = [
  ["trendline", "segment", MoveUpRight],
  ["ray", "rayLine", ArrowUpRight],
  ["horizontal", "horizontalStraightLine", Minus],
  ["vertical", "verticalStraightLine", MoveVertical],
  ["channel", "parallelStraightLine", GitBranch],
  ["fibonacci", "fibonacciLine", Layers],
  ["extension", "csExtension", Layers],
  ["rectangle", "csRect", Square],
  ["ellipse", "csEllipse", Circle],
  ["text", "simpleAnnotation", Type],
  ["arrow", "csArrow", ArrowUp],
  ["range", "csRange", MoveVertical],
  ["longTool", "csLong", ArrowUpRight],
  ["shortTool", "csShort", ArrowDownRight],
  ["measure", "csMeasure", Ruler],
  ["brush", "csBrush", Paintbrush],
] as const;
const majors = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
];
function Field({ label, children }: any) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function NumberInput({ value, set, min = 0, step = "any" }: any) {
  return (
    <input
      type="number"
      min={min}
      step={step}
      value={value}
      onChange={(e) => set(e.target.value === "" ? "" : Number(e.target.value))}
    />
  );
}
function Empty({ t, login = false }: any) {
  return (
    <div className="empty-state">
      <Activity size={25} />
      <p>{t(login ? "loginRequired" : "empty")}</p>
    </div>
  );
}
export function Terminal({ locale, setLocale, theme, setTheme }: any) {
  const t = useTranslations(),
    [tab, setTab] = useState("terminal"),
    [user, setUser] = useState<any>(null),
    [configuration, setConfiguration] = useState<any>({}),
    [authOpen, setAuthOpen] = useState(false),
    [oauthMfa, setOauthMfa] = useState(false),
    [register, setRegister] = useState(false),
    [consentOpen, setConsentOpen] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [totpCode, setTotpCode] = useState(""),
    [busy, setBusy] = useState(""),
    [toast, setToast] = useState(""),
    [mobileNav, setMobileNav] = useState(false),
    [commandsOpen, setCommandsOpen] = useState(false),
    [workspaceReady, setWorkspaceReady] = useState(false),
    [agentId, setAgentId] = useState(""),
    [managedAgents, setManagedAgents] = useState<any[]>([]);
  const [instrument, setInstrument] = useState<Instrument>({
      venue: "binance",
      market: "spot",
      symbol: "BTCUSDT",
      timeframe: "1h",
    }),
    [chartType, setChartType] = useState("candles"),
    [layout, setLayout] = useState(1),
    [demo, setDemo] = useState(false),
    [indicatorNames, setIndicators] = useState(["EMA", "RSI"]),
    [period, setPeriod] = useState(20),
    [timezone, setTimezone] = useState("UTC"),
    [data, setData] = useState<any>(null),
    [connection, setConnection] = useState("connecting"),
    [flow, setFlow] = useState<any>(null),
    [allowFallback, setAllowFallback] = useState(true),
    [tickers, setTickers] = useState<any[]>([]),
    [tickerUpdatedAt, setTickerUpdatedAt] = useState<number | null>(null),
    [tickerStatus, setTickerStatus] = useState("loading"),
    [watchlist, setWatchlist] = useState<string[]>(majors),
    [search, setSearch] = useState(""),
    [book, setBook] = useState<any>(null),
    [marketContext, setMarketContext] = useState<any>(null),
    [derivativeData, setDerivativeData] = useState<any>(null),
    [news, setNews] = useState<any>({ items: [] }),
    [crosshair, setCrosshair] = useState<any>(null),
    [panelOrder, setPanelOrder] = useState(["chart", "analysis"]),
    [selectedTool, setSelectedTool] = useState(""),
    [magnet, setMagnet] = useState(false),
    [locked, setLocked] = useState(false),
    [hidden, setHidden] = useState(false),
    [drawingColor, setDrawingColor] = useState("#43c4dd"),
    [note, setNote] = useState(""),
    [drawingModal, setDrawingModal] = useState(false),
    [savedDrawingRows, setSavedDrawingRows] = useState<any[]>([]),
    [indicatorOpen, setIndicatorOpen] = useState(false),
    [templates, setTemplates] = useState<any[]>([]),
    [templateName, setTemplateName] = useState("");
  const [provider, setProvider] = useState("openai"),
    [model, setModel] = useState(""),
    [mode, setMode] = useState("quick"),
    [analysis, setAnalysis] = useState<any>(null),
    [analysisId, setAnalysisId] = useState(""),
    [analysisStatus, setAnalysisStatus] = useState(""),
    [showOverlay, setShowOverlay] = useState(true),
    [chatMessage, setChatMessage] = useState(""),
    [chatMessages, setChatMessages] = useState<any[]>([]),
    [notifications, setNotifications] = useState<any[]>([]);
  const [account, setAccount] = useState(10000),
    [riskPct, setRiskPct] = useState(1),
    [entry, setEntry] = useState<number | "">(""),
    [stop, setStop] = useState<number | "">(""),
    [target, setTarget] = useState<number | "">(""),
    [riskFees, setRiskFees] = useState(10),
    [riskSlippage, setRiskSlippage] = useState(5),
    [leverage, setLeverage] = useState(1),
    [direction, setDirection] = useState("LONG"),
    [sizeResult, setSizeResult] = useState<any>(null),
    [riskOpen, setRiskOpen] = useState(false);
  const [records, setRecords] = useState<any[]>([]),
    [scanner, setScanner] = useState<any[]>([]),
    [brief, setBrief] = useState<any>(null),
    [correlations, setCorrelations] = useState<any[]>([]),
    [journalEntry, setJournalEntry] = useState<any>({
      symbol: "BTCUSDT",
      side: "LONG",
      entry: 0,
      exit: 0,
      quantity: 1,
      fees: 0,
      notes: "",
    }),
    [review, setReview] = useState(""),
    [journalFile, setJournalFile] = useState<File | null>(null),
    [exchangeKey, setExchangeKey] = useState(""),
    [exchangeSecret, setExchangeSecret] = useState(""),
    [portfolio, setPortfolio] = useState<any>(null),
    [importedTrades, setImportedTrades] = useState<any[]>([]),
    [paperAccount, setPaperAccount] = useState<any>(null),
    [paperQuantity, setPaperQuantity] = useState(0.01),
    [alertKind, setAlertKind] = useState("price"),
    [alertComparison, setAlertComparison] = useState("above"),
    [alertValue, setAlertValue] = useState<number | "">(""),
    [alertIndicator, setAlertIndicator] = useState("RSI"),
    [alertDrawingId, setAlertDrawingId] = useState(""),
    [alertChannels, setAlertChannels] = useState(["in_app"]),
    [scheduleMinutes, setScheduleMinutes] = useState(60),
    [schedules, setSchedules] = useState<any[]>([]),
    [fast, setFast] = useState(20),
    [slow, setSlow] = useState(50),
    [fees, setFees] = useState(10),
    [slippage, setSlippage] = useState(5),
    [backtestResult, setBacktestResult] = useState<any>(null),
    [backtestId, setBacktestId] = useState(""),
    [keys, setKeys] = useState<any[]>([]),
    [keyValue, setKeyValue] = useState(""),
    [telegramChatId, setTelegramChatId] = useState(""),
    [lossLimit, setLossLimit] = useState(500),
    [maxDrawdown, setMaxDrawdown] = useState(10),
    [paperOverviewData, setPaperOverviewData] = useState<any>(null),
    [totpSecret, setTotpSecret] = useState<any>(null),
    [usage, setUsage] = useState<any>(null),
    [deleteOpen, setDeleteOpen] = useState(false);
  const chartRef = useRef<any>(null),
    analysisInterval = useRef<any>(null);
  const applyWorkspace = (value: unknown) => {
    const saved = normalizeWorkspace(value, [
      "EMA",
      "MA",
      "BOLL",
      "SAR",
      "RSI",
      "MACD",
      "CCI",
      "OBV",
      ...extraIndicators,
    ]);
    setInstrument(saved.instrument);
    setChartType(saved.chartType);
    setLayout(saved.layout);
    setIndicators(saved.indicatorNames);
    setPeriod(saved.period);
    setPanelOrder(saved.panelOrder);
    setAllowFallback(saved.allowFallback);
  };
  useEffect(() => {
    try {
      applyWorkspace(JSON.parse(localStorage.getItem(workspaceKey) || "null"));
    } catch {
      applyWorkspace(defaultWorkspace);
    }
    setWorkspaceReady(true);
  }, []);
  useEffect(() => {
    if (!workspaceReady) return;
    try {
      localStorage.setItem(
        workspaceKey,
        JSON.stringify({
          instrument,
          chartType,
          layout,
          indicatorNames,
          period,
          panelOrder,
          allowFallback,
        }),
      );
    } catch {
      /* The terminal also works when browser storage is unavailable. */
    }
  }, [
    workspaceReady,
    instrument,
    chartType,
    layout,
    indicatorNames,
    period,
    panelOrder,
    allowFallback,
  ]);
  useEffect(() => {
    setSizeResult(null);
  }, [
    account,
    riskPct,
    entry,
    stop,
    leverage,
    direction,
    target,
    riskFees,
    riskSlippage,
  ]);
  const fmt = (v: any, digits = 2) =>
    v == null || !Number.isFinite(Number(v))
      ? "—"
      : new Intl.NumberFormat(locale, {
          maximumFractionDigits: digits,
          minimumFractionDigits: digits,
        }).format(Number(v));
  const compact = (v: any) =>
    v == null
      ? "—"
      : new Intl.NumberFormat(locale, {
          notation: "compact",
          maximumFractionDigits: 2,
        }).format(v);
  const date = (v: any) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(v));
  const error = (code: string) => {
    const key = "err_" + code;
    setToast(t.has(key) ? t(key) : t("errors"));
  };
  const protect = () => {
    if (user) return true;
    setAuthOpen(true);
    return false;
  };
  const perform = async (name: string, fn: () => Promise<any>) => {
    setBusy(name);
    try {
      return await fn();
    } catch (e: any) {
      error(e.message);
    } finally {
      setBusy("");
    }
  };
  const loadMe = async () => {
    try {
      const r = await api("auth/me");
      if (r.user && !r.consentAccepted) setConsentOpen(true);
      setUser(r.user);
      setConfiguration(r.configuration);
      setCsrf(r.csrfToken);
      if (r.user) {
        const agents = await api("agents");
        setManagedAgents(agents);
        setAgentId((current) =>
          agents.some((agent: any) => agent.id === current) ? current : "",
        );
      } else {
        setManagedAgents([]);
        setAgentId("");
      }
      if (r.user?.role !== "admin")
        setTab((current) => (current === "admin" ? "terminal" : current));
      if (r.user) {
        setLocale(r.user.locale);
        setTimezone(r.user.timezone);
        setTelegramChatId(r.user.settings.telegramChatId || "");
        setLossLimit(r.user.settings.dailyLossLimit || 500);
        setMaxDrawdown(r.user.settings.maxDrawdownPct || 10);
        if (r.user.settings.theme) setTheme(r.user.settings.theme);
      }
    } catch (e: any) {
      error(e.message);
    }
  };
  useEffect(() => {
    if (new URLSearchParams(location.search).has("oauthMfa")) {
      setOauthMfa(true);
      setRegister(false);
      setAuthOpen(true);
    }
  }, []);
  useEffect(() => {
    if (tab !== "dashboard" || !user) return;
    let dead = false;
    const refresh = () =>
      api("daily-brief")
        .then((r) => {
          if (!dead) setBrief(r);
        })
        .catch(() => {});
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      dead = true;
      clearInterval(timer);
    };
  }, [tab, user]);
  useEffect(() => {
    loadMe();
    try {
      setConsentOpen(localStorage.getItem("risk-consent") !== "2026-10-v1");
    } catch {
      setConsentOpen(true);
    }
    const sp = new URLSearchParams(location.search);
    if (sp.get("verify"))
      perform("verify", async () => {
        await api("auth/verify", {
          method: "POST",
          body: { token: sp.get("verify") },
        });
        setToast(t("saved"));
        history.replaceState({}, "", location.pathname);
      });
    if (sp.get("reset")) {
      setAuthOpen(true);
      setRegister(false);
    }
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setAnalysis(null);
    setAnalysisId("");
    setAnalysisStatus("");
    setData(null);
    setBook(null);
    setChatMessages([]);
    if (analysisInterval.current) clearInterval(analysisInterval.current);
  }, [
    instrument.symbol,
    instrument.venue,
    instrument.market,
    instrument.timeframe,
  ]);
  useEffect(() => {
    let active = true;
    setTickers([]);
    setTickerUpdatedAt(null);
    setTickerStatus("loading");
    const load = () =>
      api(`markets?venue=${instrument.venue}&market=${instrument.market}`, {
        signal: AbortSignal.timeout(12000),
      })
        .then((r) => {
          if (active) {
            setTickers(r);
            setTickerUpdatedAt(Date.now());
            setTickerStatus(r.length ? "ready" : "unavailable");
          }
        })
        .catch(() => {
          if (active) setTickerStatus("unavailable");
        });
    load();
    const id = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [instrument.venue, instrument.market]);
  useEffect(() => {
    let active = true;
    const load = () =>
      api("depth?" + queryString(instrument))
        .then((r) => {
          if (active) setBook(r);
        })
        .catch(() => {
          if (active) setBook(null);
        });
    if (!demo) load();
    const id = setInterval(() => {
      if (!demo) load();
    }, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [instrument.venue, instrument.market, instrument.symbol, demo]);
  useEffect(() => {
    if (instrument.market === "perpetual")
      api("derivatives?" + queryString(instrument))
        .then(setDerivativeData)
        .catch(() => setDerivativeData(null));
    else setDerivativeData(null);
  }, [instrument.symbol, instrument.market, instrument.venue]);
  useEffect(() => {
    api("context")
      .then(setMarketContext)
      .catch(() => {});
    api("news")
      .then(setNews)
      .catch(() => {});
  }, []);
  useEffect(() => {
    let active = true;
    if (!user) {
      setWatchlist([...majors]);
      setNotifications([]);
      return;
    }
    api("watchlist")
      .then((rows) => {
        if (active)
          setWatchlist([
            ...new Set<string>(
              rows
                .filter(
                  (row: any) =>
                    row.venue === instrument.venue &&
                    row.market === instrument.market,
                )
                .map((r: any) => r.symbol),
            ),
          ]);
      })
      .catch(() => {});
    api("notifications")
      .then((rows) => {
        if (active) setNotifications(rows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id, instrument.venue, instrument.market]);
  const refreshRecords = async () => {
    if (!user) return;
    if (tab === "paper") {
      const r = await api("paper/account");
      setPaperAccount(r.account);
      setPaperOverviewData(r);
      setRecords(r.orders);
    } else if (tab === "track") setRecords(await api("signals"));
    else if (["journal", "alerts", "backtest"].includes(tab)) {
      setRecords(await api(tab === "backtest" ? "backtests" : tab));
      if (tab === "alerts") setSchedules(await api("schedules"));
    } else if (tab === "settings") {
      setKeys(await api("credentials"));
      const r = await api("settings");
      setUsage(r.usage);
    }
  };
  useEffect(() => {
    setRecords([]);
    refreshRecords().catch((e: any) => error(e.message));
    const timer = setInterval(() => {
      if (tab === "track" || tab === "alerts" || tab === "backtest")
        refreshRecords().catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [tab, user?.id]);
  useEffect(() => {
    if (!analysisId) return;
    let stopped = false;
    const poll = async () => {
      try {
        const r = await api("analyses/" + analysisId);
        if (stopped) return;
        setAnalysisStatus(r.status);
        if (r.status === "completed") {
          setAnalysis(r.result);
          setEntry(r.result.setups[0]?.entry?.price || "");
          setStop(r.result.setups[0]?.stop_loss || "");
          clearInterval(analysisInterval.current);
        }
        if (r.status === "failed") {
          error(r.error_code || "analysis_failed");
          clearInterval(analysisInterval.current);
        }
      } catch (e: any) {
        error(e.message);
        clearInterval(analysisInterval.current);
      }
    };
    poll();
    analysisInterval.current = setInterval(poll, 2000);
    return () => {
      stopped = true;
      clearInterval(analysisInterval.current);
    };
  }, [analysisId]);
  useEffect(() => {
    if (!backtestId) return;
    const timer = setInterval(async () => {
      try {
        const r = await api("backtests/" + backtestId),
          job = r[0];
        if (job?.status === "completed") {
          setBacktestResult(job.result);
          clearInterval(timer);
        }
        if (job?.status === "failed") {
          error("service_unavailable");
          clearInterval(timer);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(timer);
  }, [backtestId]);
  const aiConfig = () => ({
    provider,
    model,
    locale,
    ...(agentId ? { agentId } : {}),
  });
  const analysisConfig = () => ({
    ...instrument,
    ...aiConfig(),
    mode,
    indicatorPeriod: period,
  });
  const runAnalysis = () => {
    if (!protect()) return;
    perform("analysis", async () => {
      const r = await api("analyses", {
        method: "POST",
        headers: { "idempotency-key": crypto.randomUUID() },
        body: analysisConfig(),
      });
      setAnalysis(null);
      setAnalysisId(r.id);
      setAnalysisStatus(r.status);
    });
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!e.repeat) setCommandsOpen((open) => !open);
        return;
      }
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable=true],[role=dialog]",
        )
      )
        return;
      if (tab !== "terminal" || e.altKey) return;
      if (e.key.toLowerCase() === "a" && !e.ctrlKey && !e.metaKey && !demo) {
        e.preventDefault();
        runAnalysis();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) chartRef.current?.redo();
        else chartRef.current?.undo();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [user, provider, model, instrument, mode, locale, agentId, tab, demo]);
  const updateInstrument = (part: any) =>
    setInstrument((i) => ({ ...i, ...part }));
  const price = data?.candles?.at(-1)?.close;
  const ticker = tickers.find((x) => x.symbol === instrument.symbol);
  const visibleTickers = search
    ? tickers
        .filter((x) => x.symbol.includes(search.toUpperCase()))
        .slice(0, 30)
    : watchlist.map(
        (symbol) => tickers.find((x) => x.symbol === symbol) || { symbol },
      );
  const toggleWatch = (symbol: string) => {
    const has = watchlist.includes(symbol);
    setWatchlist(
      has ? watchlist.filter((x) => x !== symbol) : [...watchlist, symbol],
    );
    if (user)
      api("watchlist", {
        method: has ? "DELETE" : "POST",
        body: { ...instrument, symbol },
      }).catch((e: any) => error(e.message));
  };
  const commands: TerminalCommand[] = [
    ...nav.map(([key]) => ({
      id: key,
      label: t(key),
      keywords: key,
      detail: t("navigation"),
      run: () => {
        setTab(key);
        setMobileNav(false);
      },
    })),
    ...(user?.role === "admin"
      ? [{ id: "admin", label: t("admin"), run: () => setTab("admin") }]
      : []),
    {
      id: "calculator",
      label: t("calculator"),
      keywords: "risk position",
      run: () => setRiskOpen(true),
    },
    {
      id: "indicators",
      label: t("indicators"),
      run: () => setIndicatorOpen(true),
    },
    {
      id: "theme",
      label: t("toggleTheme"),
      run: () => setTheme(theme === "dark" ? "light" : "dark"),
    },
    {
      id: "reset",
      label: t("resetWorkspace"),
      detail: t("resetWorkspaceHint"),
      run: () => {
        applyWorkspace(defaultWorkspace);
        setToast(t("workspaceReset"));
      },
    },
    ...[...new Set([...watchlist, ...tickers.map((row) => row.symbol)])].map(
      (symbol) => ({
        id: "market-" + symbol,
        label: symbol,
        detail: instrument.venue + " · " + t(instrument.market),
        keywords: "market chart",
        run: () => {
          updateInstrument({ symbol });
          setTab("terminal");
        },
      }),
    ),
  ];
  const authSubmit = () =>
    perform("auth", async () => {
      if (oauthMfa) {
        await api("auth/oauth/verify-totp", {
          method: "POST",
          body: { code: totpCode },
        });
        setOauthMfa(false);
        history.replaceState({}, "", location.pathname);
        await loadMe();
        setAuthOpen(false);
        setTotpCode("");
        return;
      }
      const reset = new URLSearchParams(location.search).get("reset");
      if (reset) {
        await api("auth/reset", {
          method: "POST",
          body: { token: reset, password },
        });
        history.replaceState({}, "", location.pathname);
        setToast(t("saved"));
        return;
      }
      const r = await api("auth/" + (register ? "register" : "login"), {
        method: "POST",
        body: { email, password, totp: totpCode, locale, consent: true },
      });
      if (r.verification_required) setToast(t("verificationRequired"));
      else {
        await loadMe();
        setAuthOpen(false);
      }
      setPassword("");
      setTotpCode("");
    });
  const exportPdf = () =>
    perform("pdf", async () => {
      const r = await fetch("/api/v1/reports", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": (await api("auth/me")).csrfToken,
        },
        body: JSON.stringify({ analysisId }),
      });
      if (!r.ok) throw new Error((await r.json()).code);
      const u = URL.createObjectURL(await r.blob()),
        a = document.createElement("a");
      a.href = u;
      a.download = `CryptoSight-${instrument.symbol}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    });
  const dropPanel = (id: string, e: any) => {
    e.preventDefault();
    const dragged = e.dataTransfer.getData("text/plain");
    if (!panelOrder.includes(dragged)) return;
    setPanelOrder((order) =>
      order.map((x) => (x === id ? dragged : x === dragged ? id : x)),
    );
  };
  const providerControls = (
    <>
      {managedAgents.length > 0 && (
        <Field label={t("adminAgent")}>
          <select
            value={agentId}
            onChange={(e) => {
              setAgentId(e.target.value);
              const selected = managedAgents.find(
                (a) => a.id === e.target.value,
              );
              if (selected) {
                setProvider(selected.provider);
                setModel(selected.model);
              }
            }}
          >
            <option value="">{t("adminOwnKey")}</option>
            {managedAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label={t("provider")}>
        <select
          value={provider}
          disabled={!!agentId}
          onChange={(e) => {
            setProvider(e.target.value);
            setModel("");
          }}
        >
          {["openai", "gemini", "anthropic", "openrouter", "local"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </Field>
      <Field label={t("model")}>
        <input
          value={model}
          disabled={!!agentId}
          onChange={(e) => setModel(e.target.value)}
          autoComplete="off"
        />
      </Field>
    </>
  );
  const stat = (label: string, value: any, sub?: string) => (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
  const instrumentControls = (
    <>
      <select
        aria-label={t("venue")}
        value={instrument.venue}
        onChange={(e) => updateInstrument({ venue: e.target.value })}
      >
        {["binance", "bybit", "okx"].map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
      <select
        aria-label={t("spot")}
        value={instrument.market}
        onChange={(e) => updateInstrument({ market: e.target.value })}
      >
        <option value="spot">{t("spot")}</option>
        <option value="perpetual">{t("perpetual")}</option>
      </select>
      <select
        aria-label={t("timeframe")}
        value={instrument.timeframe}
        onChange={(e) => updateInstrument({ timeframe: e.target.value })}
      >
        {frames.map((f) => (
          <option key={f}>{f}</option>
        ))}
      </select>
    </>
  );
  const table = (headers: string[], rows: any[][]) => (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty t={t} />}
    </div>
  );
  const navigationItems = [
    ...nav,
    ...(user?.role === "admin" ? [["admin", Settings] as const] : []),
  ].map(([key, Icon]) => (
    <button
      key={key}
      className={"nav-item " + (tab === key ? "active" : "")}
      aria-current={tab === key ? "page" : undefined}
      onClick={() => {
        setTab(key);
        setMobileNav(false);
      }}
      title={t(key)}
    >
      <Icon size={20} />
      <span>{t(key)}</span>
    </button>
  ));
  return (
    <div className="app-shell">
      <header className="topbar">
        <Dialog.Root open={mobileNav} onOpenChange={setMobileNav}>
          <Dialog.Trigger
            className="icon-button mobile-only"
            aria-label={t("navigation")}
          >
            <Menu size={21} />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="navigation-backdrop" />
            <Dialog.Content className="mobile-navigation">
              <div className="panel-title">
                <Dialog.Title>{t("navigation")}</Dialog.Title>
                <Dialog.Close className="icon-button" aria-label={t("close")}>
                  ×
                </Dialog.Close>
              </div>
              <Dialog.Description className="sr-only">
                {t("navigation")}
              </Dialog.Description>
              <nav aria-label={t("navigation")} className="nav-group">
                {navigationItems}
              </nav>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <a className="brand" href="/">
          <span className="brand-icon">
            <Activity size={23} />
          </span>
          <span>
            CryptoSight <b>AI</b>
          </span>
        </a>
        <span className="workspace-label">{t("terminal")}</span>
        <div className="topbar-actions">
          <button
            className="command-trigger"
            aria-label={t("commandPalette")}
            aria-keyshortcuts="Control+k Meta+k"
            onClick={() => setCommandsOpen(true)}
          >
            <Search size={17} />
            <span className="desktop-only">{t("commandPalette")}</span>
            <kbd className="desktop-only">Ctrl K</kbd>
          </button>
          <select
            aria-label={t("language")}
            value={locale}
            onChange={(e) => {
              setLocale(e.target.value);
              if (user)
                api("settings", {
                  method: "PATCH",
                  body: {
                    locale: e.target.value,
                    timezone,
                    settings: { theme },
                  },
                }).catch(() => {});
            }}
          >
            <option value="en">EN</option>
            <option value="pl">PL</option>
            <option value="de">DE</option>
          </select>
          <button
            className="icon-button"
            onClick={() => {
              setTab("alerts");
              setMobileNav(false);
            }}
            title={t("notifications")}
          >
            <Bell size={19} />
            {notifications.some((n) => !n.read) && (
              <span className="notification-dot" />
            )}
          </button>
          {user ? (
            <button
              className="account-button"
              aria-label={`${t("settings")} · ${user.email || user.wallet_address || t("walletAccount")}`}
              onClick={() => setTab("settings")}
            >
              <span className="avatar">
                {(user.email || user.wallet_address || "W")[0].toUpperCase()}
              </span>
              <span className="desktop-only">
                {user.email
                  ? user.email.split("@")[0]
                  : user.wallet_address?.slice(0, 6) +
                      "…" +
                      user.wallet_address?.slice(-4) || t("walletAccount")}
              </span>
            </button>
          ) : (
            <Button variant="outline" onClick={() => setAuthOpen(true)}>
              <LogIn size={16} />
              {t("login")}
            </Button>
          )}
        </div>
      </header>
      <div className="body-shell">
        <nav className="sidebar" aria-label={t("terminal")}>
          <div className="nav-group">{navigationItems}</div>
          <div className="sidebar-bottom">
            <span className={"connection " + connection}>
              <i />
              {t.has(connection) ? t(connection) : connection}
            </span>
            <small>{t("educational")}</small>
          </div>
        </nav>
        <main className="main-workspace">
          {configuration.announcement?.[locale] && (
            <div className="event-notice platform-announcement" role="status">
              {configuration.announcement[locale]}
            </div>
          )}
          {configuration.aiEnabled === false && (
            <div className="event-notice" role="status">
              {t("ai_paused")}
            </div>
          )}
          <div className="market-strip">
            <div className="pair">
              <span className="coin-icon">
                {instrument.symbol.startsWith("BTC")
                  ? "₿"
                  : instrument.symbol.slice(0, 1)}
              </span>
              <div>
                <strong>{instrument.symbol.replace("USDT", " / USDT")}</strong>
                <span>
                  {instrument.venue} · {t(instrument.market)}
                </span>
              </div>
            </div>
            <div className="market-price">
              <strong>{fmt(price || ticker?.price, price < 1 ? 6 : 2)}</strong>
              <span
                className={(ticker?.change || 0) >= 0 ? "positive" : "negative"}
              >
                {ticker
                  ? `${ticker.change >= 0 ? "+" : ""}${fmt(ticker.change)}%`
                  : "—"}
              </span>
            </div>
            <div className="strip-metric desktop-only">
              <span>{t("volume")}</span>
              <strong>{compact(ticker?.volume)}</strong>
            </div>
            <div className="strip-metric desktop-only">
              <span>RSI ({data?.indicators?.parameters?.period || 14})</span>
              <strong>{fmt(data?.indicators?.RSI, 1)}</strong>
            </div>
            <div className="strip-metric desktop-only">
              <span>{t("structure")}</span>
              <strong>{data?.indicators?.structure?.state || "—"}</strong>
            </div>
            {flow && (
              <div className="strip-metric desktop-only">
                <span>{t("cvdSince")}</span>
                <strong>{fmt(flow.value, 3)}</strong>
              </div>
            )}
            <div className="strip-controls">{instrumentControls}</div>
          </div>
          <div
            className={
              "market-data-status " +
              (tickerStatus === "unavailable" ? "data-unavailable" : "")
            }
            role="status"
          >
            <span>
              <i />
              {t(
                tickerStatus === "ready"
                  ? "quotesUpdated"
                  : tickerStatus === "loading"
                    ? "quotesLoading"
                    : tickerUpdatedAt
                      ? "quotesStale"
                      : "noMarketData",
              )}
              {tickerUpdatedAt && ` · ${date(tickerUpdatedAt)}`}
            </span>
            <small>
              {instrument.venue} · {t(instrument.market)}
            </small>
          </div>
          {derivativeData?.value?.funding != null &&
            Math.abs(derivativeData.value.funding) > 0.001 && (
              <div className="event-notice">
                {t("fundingWarning")} ·{" "}
                {fmt(derivativeData.value.funding * 100, 4)}%
              </div>
            )}
          {tab === "terminal" ? (
            <div className="terminal-grid">
              <div className="mobile-panel-links">
                <a href="#chart-panel">{t("chart")}</a>
                <a href="#analysis-panel">{t("analysis")}</a>
              </div>
              <aside className="watchlist-panel panel">
                <div className="panel-title">
                  <h2>{t("watchlist")}</h2>
                  <span>{watchlist.length}</span>
                </div>
                <div className="search-field">
                  <Search size={16} />
                  <input
                    aria-label={t("search")}
                    placeholder={t("search")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="watchlist-labels">
                  <span>{t("symbol")}</span>
                  <span>{t("change")}</span>
                </div>
                <div className="watchlist-rows">
                  {visibleTickers.map((row) => (
                    <div
                      className={
                        "watch-row " +
                        (row.symbol === instrument.symbol ? "selected" : "")
                      }
                      key={row.symbol}
                    >
                      <button
                        className="pair-select"
                        onClick={() => updateInstrument({ symbol: row.symbol })}
                      >
                        <strong>{row.symbol.replace("USDT", "")}</strong>
                        <small>{fmt(row.price, row.price < 1 ? 5 : 2)}</small>
                      </button>
                      <div>
                        <span
                          className={
                            (row.change || 0) >= 0 ? "positive" : "negative"
                          }
                        >
                          {row.change == null ? "—" : `${fmt(row.change)}%`}
                        </span>
                        <button
                          className={
                            "icon-button star " +
                            (watchlist.includes(row.symbol) ? "saved" : "")
                          }
                          onClick={() => toggleWatch(row.symbol)}
                          aria-label={t("watchlist")}
                          aria-pressed={watchlist.includes(row.symbol)}
                        >
                          <Star size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="market-mood">
                  <span>{t("fearGreed")}</span>
                  <strong>
                    {marketContext?.fearGreed?.value ?? "—"}
                    <small>/100</small>
                  </strong>
                  <div className="mood-bar">
                    <i
                      style={{
                        left: `${marketContext?.fearGreed?.value || 0}%`,
                      }}
                    />
                  </div>
                </div>
              </aside>
              <div className="terminal-panels">
                {panelOrder.map((panel) =>
                  panel === "chart" ? (
                    <section
                      key={panel}
                      id="chart-panel"
                      className="chart-panel panel"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => dropPanel(panel, e)}
                    >
                      <div className="chart-topbar">
                        <div
                          className="timeframes"
                          draggable
                          onDragStart={(e) =>
                            e.dataTransfer.setData("text/plain", "chart")
                          }
                        >
                          {["1m", "5m", "15m", "1h", "4h", "1d", "1w"].map(
                            (f) => (
                              <button
                                className={
                                  instrument.timeframe === f ? "active" : ""
                                }
                                onClick={() =>
                                  updateInstrument({ timeframe: f })
                                }
                                key={f}
                              >
                                {f}
                              </button>
                            ),
                          )}
                        </div>
                        <div className="chart-actions">
                          <button
                            onClick={() => setIndicatorOpen(true)}
                            title={t("indicators")}
                          >
                            <SlidersHorizontal size={16} />
                            <span>{t("indicators")}</span>
                          </button>
                          <select
                            aria-label={t("candles")}
                            value={chartType}
                            onChange={(e) => setChartType(e.target.value)}
                          >
                            {["candles", "heikin", "line", "area"].map((v) => (
                              <option value={v} key={v}>
                                {t(v)}
                              </option>
                            ))}
                          </select>
                          <select
                            aria-label={t("layout")}
                            value={layout}
                            onChange={(e) => setLayout(Number(e.target.value))}
                          >
                            {[1, 2, 4].map((v) => (
                              <option key={v} value={v}>
                                {v} ▦
                              </option>
                            ))}
                          </select>
                          <button
                            title={t("exportChart")}
                            onClick={() =>
                              chartRef.current?.export(
                                analysis
                                  ? [
                                      "CryptoSight AI · " +
                                        instrument.symbol +
                                        " · " +
                                        instrument.timeframe,
                                      analysis.summary_short,
                                      ...analysis.setups.map((s: any) =>
                                        s.direction === "NO_TRADE"
                                          ? t("noTrade") + " · " + s.reasoning
                                          : s.direction +
                                            " · " +
                                            t("entry") +
                                            ": " +
                                            fmt(s.entry.price) +
                                            " · " +
                                            t("stop") +
                                            ": " +
                                            fmt(s.stop_loss) +
                                            " · TP: " +
                                            s.take_profits
                                              .map((p: any) => fmt(p.price))
                                              .join(", "),
                                      ),
                                      t("disclaimer"),
                                    ]
                                  : [],
                              )
                            }
                          >
                            <Download size={17} />
                          </button>
                        </div>
                      </div>
                      <div className="chart-body">
                        <div className="drawing-toolbar">
                          {tools.map(([key, name, Icon]) => (
                            <button
                              key={key}
                              title={t(key)}
                              className={selectedTool === key ? "active" : ""}
                              onClick={() => {
                                setSelectedTool(key);
                                chartRef.current?.tool(name, note);
                              }}
                            >
                              <Icon size={17} />
                              <span className="sr-only">{t(key)}</span>
                            </button>
                          ))}
                          <div className="tool-separator" />
                          <button
                            title={t("magnet")}
                            className={magnet ? "active" : ""}
                            onClick={() => {
                              setMagnet(!magnet);
                              chartRef.current?.setOptions({ magnet: !magnet });
                            }}
                          >
                            <Magnet size={17} />
                          </button>
                          <button
                            title={t("undo")}
                            onClick={() => chartRef.current?.undo()}
                          >
                            <Undo2 size={17} />
                          </button>
                          <button
                            title={t("redo")}
                            onClick={() => chartRef.current?.redo()}
                          >
                            <Redo2 size={17} />
                          </button>
                          <button
                            title={t("lock")}
                            className={locked ? "active" : ""}
                            onClick={() => {
                              setLocked(!locked);
                              chartRef.current?.setOptions({ lock: !locked });
                            }}
                          >
                            <Lock size={16} />
                          </button>
                          <button
                            title={t("hide")}
                            className={hidden ? "active" : ""}
                            onClick={() => {
                              setHidden(!hidden);
                              chartRef.current?.setOptions({ hidden: !hidden });
                            }}
                          >
                            <EyeOff size={17} />
                          </button>
                          <button
                            title={t("savedDrawings")}
                            onClick={() =>
                              perform("drawings", async () => {
                                if (user)
                                  setSavedDrawingRows(
                                    await api(
                                      "drawings?" + queryString(instrument),
                                    ),
                                  );
                                setDrawingModal(true);
                              })
                            }
                          >
                            <Layers size={17} />
                          </button>
                          <input
                            type="color"
                            aria-label={t("color")}
                            value={drawingColor}
                            onChange={(e) => {
                              setDrawingColor(e.target.value);
                              chartRef.current?.setOptions({
                                color: e.target.value,
                              });
                            }}
                          />
                        </div>
                        <div className={"charts charts-" + layout}>
                          {Array.from({ length: layout }, (_, index) => (
                            <MarketChart
                              key={`${index}-${layout}`}
                              ref={index === 0 ? chartRef : undefined}
                              instrument={{
                                ...instrument,
                                timeframe:
                                  index === 0
                                    ? instrument.timeframe
                                    : ["15m", "4h", "1d"][index - 1],
                              }}
                              locale={locale}
                              timezone={timezone}
                              theme={theme}
                              chartType={chartType}
                              indicatorNames={indicatorNames}
                              period={period}
                              demo={demo}
                              user={user}
                              analysis={analysis}
                              showOverlay={showOverlay}
                              onData={
                                index === 0
                                  ? (d: any) => {
                                      setData(d);
                                      if (d.fallback) {
                                        setToast(
                                          t("sourceSwitched") +
                                            ": " +
                                            d.fallback.from +
                                            " → " +
                                            d.fallback.to,
                                        );
                                        updateInstrument({
                                          venue: d.instrument.venue,
                                        });
                                      }
                                    }
                                  : undefined
                              }
                              allowFallback={allowFallback}
                              onOrderflow={
                                index === 0
                                  ? (m: any) => {
                                      if (m.type === "depth")
                                        setBook(m.payload);
                                      if (m.type === "trade")
                                        setFlow(m.payload.cvd);
                                    }
                                  : undefined
                              }
                              onStatus={index === 0 ? setConnection : undefined}
                              onError={error}
                              t={t}
                              compact={layout > 1}
                              onCrosshair={setCrosshair}
                              syncPoint={crosshair}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="chart-footer">
                        <span className={"connection " + connection}>
                          <i />
                          {t.has(connection) ? t(connection) : connection}
                        </span>
                        <span>
                          {demo
                            ? t("demoHint")
                            : t("dataSource") + ": " + instrument.venue}
                        </span>
                        <button onClick={() => setDemo(!demo)}>
                          {t(demo ? "liveMode" : "demo")}
                        </button>
                      </div>
                      <div className="chart-bottom">
                        <div className="orderbook">
                          <div className="panel-title">
                            <h2>{t("depth")}</h2>
                            <small>{t("depthHint")}</small>
                          </div>
                          <div className="book-columns">
                            <div>
                              {book?.bids
                                ?.slice(0, 8)
                                .map((r: any, i: number) => (
                                  <div className="book-row" key={i}>
                                    <span className="positive">
                                      {fmt(r[0], r[0] < 1 ? 6 : 2)}
                                    </span>
                                    <span>{fmt(r[1], 3)}</span>
                                    <i
                                      className="bid-fill"
                                      style={{
                                        width: `${Math.min(100, (r[1] / Math.max(...book.bids.map((b: any) => b[1]))) * 100)}%`,
                                      }}
                                    />
                                  </div>
                                )) || (
                                <span className="muted">
                                  {t("unavailable")}
                                </span>
                              )}
                            </div>
                            <div>
                              {book?.asks
                                ?.slice(0, 8)
                                .map((r: any, i: number) => (
                                  <div className="book-row" key={i}>
                                    <span className="negative">
                                      {fmt(r[0], r[0] < 1 ? 6 : 2)}
                                    </span>
                                    <span>{fmt(r[1], 3)}</span>
                                    <i
                                      className="ask-fill"
                                      style={{
                                        width: `${Math.min(100, (r[1] / Math.max(...book.asks.map((b: any) => b[1]))) * 100)}%`,
                                      }}
                                    />
                                  </div>
                                )) || (
                                <span className="muted">
                                  {t("unavailable")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="news-panel">
                          <div className="panel-title">
                            <h2>{t("news")}</h2>
                          </div>
                          {news.items?.length ? (
                            news.items.slice(0, 4).map((n: any, i: number) => (
                              <a
                                href={n.link || undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                key={i}
                              >
                                <span>{n.title}</span>
                                <small>{n.date ? date(n.date) : ""}</small>
                              </a>
                            ))
                          ) : (
                            <p className="muted">{t("unavailable")}</p>
                          )}
                          <div className="event-notice">
                            {t("eventWarning")}
                          </div>
                        </div>
                      </div>
                    </section>
                  ) : (
                    <aside
                      key={panel}
                      id="analysis-panel"
                      className="ai-panel panel"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => dropPanel(panel, e)}
                    >
                      <div
                        className="panel-title"
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData("text/plain", "analysis")
                        }
                      >
                        <h2>
                          <Sparkles size={17} />
                          {t("analysis")}
                        </h2>
                        <span className="ai-label">AI</span>
                      </div>
                      <div className="ai-controls">
                        <div className="analysis-mode">
                          {["quick", "deep", "explain"].map((m) => (
                            <button
                              className={mode === m ? "active" : ""}
                              onClick={() => setMode(m)}
                              key={m}
                            >
                              {t(m)}
                            </button>
                          ))}
                        </div>
                        <div className="form-grid">{providerControls}</div>
                        <Button
                          className="analyze-button"
                          disabled={
                            busy === "analysis" ||
                            ["queued", "running"].includes(analysisStatus)
                          }
                          onClick={runAnalysis}
                        >
                          {["queued", "running"].includes(analysisStatus) ? (
                            <LoaderCircle className="spin" size={17} />
                          ) : (
                            <Sparkles size={17} />
                          )}{" "}
                          {["queued", "running"].includes(analysisStatus)
                            ? t(analysisStatus)
                            : t("analyze")}
                        </Button>
                        <small>
                          {t("cost")}:{" "}
                          {fmt(configuration.analysisReservation ?? 0.5)} USD
                        </small>
                      </div>
                      {analysis ? (
                        <div className="analysis-output">
                          <div className="analysis-meta">
                            <span className={"bias " + analysis.bias}>
                              {analysis.bias === "bullish"
                                ? t("bull")
                                : analysis.bias === "bearish"
                                  ? t("bear")
                                  : t("base")}
                            </span>
                            <span>{date(analysis.timestamp)}</span>
                          </div>
                          <p className="summary">{analysis.summary_short}</p>
                          <div className="confidence">
                            <div>
                              <span>{t("confidence")}</span>
                              <strong>{analysis.confidence}%</strong>
                            </div>
                            <progress value={analysis.confidence} max={100} />
                            <small>{t("confidenceHint")}</small>
                          </div>
                          <div className="risk-line">
                            <span>{t("risk")}</span>
                            <span
                              className={"risk-badge " + analysis.risk.level}
                            >
                              {t(analysis.risk.level)}
                            </span>
                          </div>
                          {analysis.setups.map((s: any, index: number) => (
                            <article className="setup-card" key={index}>
                              <div className="setup-heading">
                                <strong className={"direction " + s.direction}>
                                  {s.direction === "NO_TRADE"
                                    ? t("noTrade")
                                    : s.direction}
                                </strong>
                                <span>
                                  {s.risk_reward
                                    ? `RR ${fmt(s.risk_reward)}`
                                    : ""}
                                </span>
                              </div>
                              {s.direction !== "NO_TRADE" &&
                                table(
                                  [t("entry"), t("stop")],
                                  [
                                    [
                                      fmt(
                                        s.entry.price,
                                        s.entry.price < 1 ? 6 : 2,
                                      ),
                                      <span className="negative">
                                        {fmt(
                                          s.stop_loss,
                                          s.stop_loss < 1 ? 6 : 2,
                                        )}
                                      </span>,
                                    ],
                                  ],
                                )}
                              {s.take_profits?.map((tp: any, j: number) => (
                                <div className="tp-row" key={j}>
                                  <span>TP {j + 1}</span>
                                  <strong className="positive">
                                    {fmt(tp.price, tp.price < 1 ? 6 : 2)}
                                  </strong>
                                  <span>{tp.size_pct}%</span>
                                </div>
                              ))}
                              <details open={s.direction === "NO_TRADE"}>
                                <summary>{t("reasoning")}</summary>
                                <p>{s.reasoning}</p>
                                <b>{t("timing")}</b>
                                <p>{s.timing}</p>
                                <b>{t("invalidation")}</b>
                                <p>{s.invalidation}</p>
                              </details>
                            </article>
                          ))}
                          <details>
                            <summary>{t("scenarios")}</summary>
                            {[
                              ["bull", analysis.scenarios.bull_case],
                              ["bear", analysis.scenarios.bear_case],
                              ["base", analysis.scenarios.base_case],
                            ].map(([label, text]) => (
                              <div key={label}>
                                <b>{t(label)}</b>
                                <p>{text}</p>
                              </div>
                            ))}
                          </details>
                          <p className="risk-factors">
                            {analysis.risk.factors.join(" · ")}
                          </p>
                          <p className="risk-factors">
                            {analysis.risk.event_risk}
                          </p>
                          <div className="analysis-actions">
                            <label>
                              <input
                                type="checkbox"
                                checked={showOverlay}
                                onChange={(e) =>
                                  setShowOverlay(e.target.checked)
                                }
                              />
                              {t("overlay")}
                            </label>
                            <button onClick={exportPdf}>
                              <Download size={14} />
                              {t("exportPdf")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="ai-empty">
                          <div className="sparkle-circle">
                            <Sparkles size={28} />
                          </div>
                          <h3>{t("analysis")}</h3>
                          <p>{t("aiEmpty")}</p>
                        </div>
                      )}
                      <div className="ai-footer">
                        <Button
                          variant="outline"
                          onClick={() => setRiskOpen(true)}
                        >
                          <Ruler size={16} />
                          {t("calculator")}
                        </Button>
                        <details className="chat-box">
                          <summary>{t("chat")}</summary>
                          {chatMessages.map((m: any, i: number) => (
                            <p key={i} className={m.role}>
                              {m.text}
                            </p>
                          ))}
                          <textarea
                            aria-label={t("ask")}
                            placeholder={t("ask")}
                            value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                          />
                          <Button
                            disabled={busy === "chat"}
                            onClick={() => {
                              if (!protect()) return;
                              perform("chat", async () => {
                                const r = await api("chat", {
                                  method: "POST",
                                  body: {
                                    ...analysisConfig(),
                                    message: chatMessage,
                                  },
                                });
                                setChatMessages([
                                  ...chatMessages,
                                  { role: "user", text: chatMessage },
                                  { role: "assistant", text: r.content },
                                ]);
                                setChatMessage("");
                              });
                            }}
                          >
                            <Send size={14} />
                            {t("send")}
                          </Button>
                        </details>
                      </div>
                    </aside>
                  ),
                )}
              </div>
            </div>
          ) : (
            <section className="feature-page">
              <div className="page-title">
                <div>
                  <span className="eyebrow">CryptoSight AI</span>
                  <h1>{t(tab)}</h1>
                </div>
                <Button
                  variant="outline"
                  onClick={() => perform("refresh", refreshRecords)}
                >
                  <RefreshCw size={16} />
                  {t("retry")}
                </Button>
              </div>
              {tab === "admin" && user?.role === "admin" && (
                <AdminPanel api={api} user={user} onChanged={loadMe} />
              )}
              {tab === "dashboard" && (
                <>
                  <div className="stats-grid">
                    {stat(
                      t("marketCap"),
                      compact(marketContext?.global?.totalMarketCap),
                    )}
                    {stat(
                      t("btcDominance"),
                      fmt(marketContext?.global?.btcDominance) + "%",
                    )}
                    {stat(
                      t("fearGreed"),
                      marketContext?.fearGreed?.value ?? "—",
                    )}
                    {stat(
                      t("volume"),
                      compact(tickers.reduce((s, x) => s + x.volume, 0)),
                    )}
                  </div>
                  <div className="form-card">
                    <h2>{t("brief")}</h2>
                    <p className="muted">{t("briefHint")}</p>
                    <div className="form-grid">
                      {providerControls}
                      <Button
                        disabled={busy === "brief"}
                        onClick={() => {
                          if (!protect()) return;
                          perform("brief", async () => {
                            await api("daily-brief", {
                              method: "POST",
                              body: aiConfig(),
                            });
                            setBrief(await api("daily-brief"));
                            setToast(t("scanQueued"));
                          });
                        }}
                      >
                        {t("enableBrief")}
                      </Button>
                    </div>
                    {brief?.result ? (
                      <>
                        <p>{brief.result.summary_short}</p>
                        <details>
                          <summary>{t("reasoning")}</summary>
                          <p>{brief.result.summary_detailed}</p>
                        </details>
                      </>
                    ) : brief ? (
                      <p>{t(brief.status)}</p>
                    ) : null}
                  </div>
                  <h2>{t("topMovers")}</h2>
                  <div className="heatmap">
                    {[...tickers]
                      .filter((x) => x.volume > 1000000)
                      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
                      .slice(0, 24)
                      .map((x) => (
                        <button
                          style={{
                            background:
                              x.change >= 0
                                ? `rgba(54,207,166,${Math.min(0.5, 0.1 + Math.abs(x.change) / 50)})`
                                : `rgba(230,101,115,${Math.min(0.5, 0.1 + Math.abs(x.change) / 50)})`,
                          }}
                          key={x.symbol}
                          onClick={() => {
                            updateInstrument({ symbol: x.symbol });
                            setTab("terminal");
                          }}
                        >
                          <strong>{x.symbol.replace("USDT", "")}</strong>
                          <span
                            className={x.change >= 0 ? "positive" : "negative"}
                          >
                            {fmt(x.change)}%
                          </span>
                        </button>
                      ))}
                  </div>
                  <div className="event-notice">{t("eventWarning")}</div>
                  <h2>{t("correlation")}</h2>
                  <Button
                    onClick={() => {
                      if (!protect()) return;
                      perform("correlation", async () =>
                        setCorrelations(
                          await api(
                            "correlation?symbols=" +
                              watchlist.slice(0, 8).join(",") +
                              "&venue=" +
                              instrument.venue,
                          ),
                        ),
                      );
                    }}
                  >
                    {t("calculate")}
                  </Button>
                  {correlations.length > 0 &&
                    table(
                      [t("symbol"), ...correlations.map((r) => r.symbol)],
                      correlations.map((r) => [
                        r.symbol,
                        ...r.values.map((v: any) => fmt(v.value)),
                      ]),
                    )}
                </>
              )}
              {tab === "screener" && (
                <>
                  <div className="form-row">
                    <Button
                      onClick={() => {
                        if (!protect()) return;
                        perform("scanner", async () =>
                          setScanner(await api("scanner")),
                        );
                      }}
                    >
                      {t("scan")}
                    </Button>
                  </div>
                  <div className="form-grid">
                    {providerControls}
                    <Button
                      onClick={() => {
                        if (!protect()) return;
                        perform("scanner", async () => {
                          await api("scanner", {
                            method: "POST",
                            body: {
                              ...aiConfig(),
                              timeframe: instrument.timeframe,
                            },
                            headers: { "idempotency-key": crypto.randomUUID() },
                          });
                          setToast(t("scanQueued"));
                        });
                      }}
                    >
                      {t("aiScan")}
                    </Button>
                    <Button
                      onClick={() =>
                        perform("scanner", async () =>
                          setScanner(await api("scanner?mode=ai")),
                        )
                      }
                    >
                      {t("scanResults")}
                    </Button>
                  </div>
                  <p className="muted">{t("scoreHint")}</p>
                  {scanner.length > 0 &&
                    table(
                      [t("symbol"), t("score"), t("direction"), "RSI", "ADX"],
                      scanner.map((r) => [
                        r.symbol,
                        fmt(r.score),
                        r.direction || "—",
                        fmt(r.indicators?.RSI),
                        fmt(r.indicators?.ADX?.adx),
                      ]),
                    )}
                  <MarketScreener
                    tickers={tickers}
                    watchlist={watchlist}
                    locale={locale}
                    onToggleWatch={toggleWatch}
                    onSelect={(symbol) => {
                      updateInstrument({ symbol });
                      setTab("terminal");
                    }}
                  />
                </>
              )}
              {!user &&
              [
                "alerts",
                "journal",
                "paper",
                "track",
                "backtest",
                "settings",
              ].includes(tab) ? (
                <div className="signin-prompt">
                  <LogIn size={32} />
                  <h2>{t("loginRequired")}</h2>
                  <Button onClick={() => setAuthOpen(true)}>
                    {t("login")}
                  </Button>
                </div>
              ) : (
                <>
                  {tab === "alerts" && (
                    <>
                      <div className="form-card">
                        <h2>{t("alerts")}</h2>
                        <div className="form-grid">
                          <Field label={t("condition")}>
                            <select
                              value={alertKind}
                              onChange={(e) => setAlertKind(e.target.value)}
                            >
                              {[
                                "price",
                                "indicator",
                                "ai_signal",
                                "drawing",
                              ].map((k) => (
                                <option key={k} value={k}>
                                  {t(
                                    k === "ai_signal"
                                      ? "analysis"
                                      : k === "drawing"
                                        ? "drawings"
                                        : k,
                                  )}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label={t("symbol")}>
                            <input
                              value={instrument.symbol}
                              onChange={(e) =>
                                updateInstrument({
                                  symbol: e.target.value.toUpperCase(),
                                })
                              }
                            />
                          </Field>
                          <Field label={t("above")}>
                            <select
                              value={alertComparison}
                              onChange={(e) =>
                                setAlertComparison(e.target.value)
                              }
                            >
                              <option value="above">{t("above")}</option>
                              <option value="below">{t("below")}</option>
                            </select>
                          </Field>
                          {alertKind === "indicator" && (
                            <Field label={t("indicator")}>
                              <select
                                value={alertIndicator}
                                onChange={(e) =>
                                  setAlertIndicator(e.target.value)
                                }
                              >
                                <option>RSI</option>
                                <option>EMA20</option>
                              </select>
                            </Field>
                          )}
                          {alertKind === "drawing" ? (
                            <Field label={t("savedDrawings")}>
                              <input
                                value={alertDrawingId}
                                onChange={(e) =>
                                  setAlertDrawingId(e.target.value)
                                }
                              />
                            </Field>
                          ) : (
                            <Field label={t("price")}>
                              <NumberInput
                                value={alertValue}
                                set={setAlertValue}
                              />
                            </Field>
                          )}
                        </div>
                        <div className="checks">
                          {["in_app", "email", "telegram", "push"].map((c) => (
                            <label key={c}>
                              <input
                                type="checkbox"
                                checked={alertChannels.includes(c)}
                                onChange={(e) =>
                                  setAlertChannels(
                                    e.target.checked
                                      ? [...alertChannels, c]
                                      : alertChannels.filter((x) => x !== c),
                                  )
                                }
                              />
                              {t(c)}
                            </label>
                          ))}
                        </div>
                        <Button
                          onClick={() =>
                            perform("alert", async () => {
                              await api("alerts", {
                                method: "POST",
                                body: {
                                  kind: alertKind,
                                  condition: {
                                    ...instrument,
                                    comparison: alertComparison,
                                    ...(alertKind === "indicator"
                                      ? {
                                          indicator: alertIndicator,
                                          value: alertValue,
                                        }
                                      : alertKind === "drawing"
                                        ? { drawingId: alertDrawingId }
                                        : alertKind === "price"
                                          ? { price: alertValue }
                                          : {}),
                                  },
                                  channels: alertChannels,
                                },
                              });
                              await refreshRecords();
                              setToast(t("saved"));
                            })
                          }
                        >
                          <Plus size={16} />
                          {t("create")}
                        </Button>
                      </div>
                      {table(
                        [t("symbol"), t("condition"), t("date"), t("delete")],
                        records.map((r) => [
                          r.condition.symbol,
                          r.kind,
                          date(r.created_at),
                          <button
                            className="icon-button"
                            title={t("delete")}
                            onClick={() =>
                              perform("delete", async () => {
                                await api("alerts/" + r.id, {
                                  method: "DELETE",
                                  body: {},
                                });
                                await refreshRecords();
                              })
                            }
                          >
                            <Trash2 size={16} />
                          </button>,
                        ]),
                      )}
                      <div className="form-card">
                        <h2>{t("schedule")}</h2>
                        <div className="form-grid">
                          {providerControls}
                          <Field label={t("minutes")}>
                            <NumberInput
                              value={scheduleMinutes}
                              set={setScheduleMinutes}
                              min={15}
                              step={1}
                            />
                          </Field>
                        </div>
                        <Button
                          onClick={() =>
                            perform("schedule", async () => {
                              await api("schedules", {
                                method: "POST",
                                body: {
                                  interval_minutes: scheduleMinutes,
                                  config: analysisConfig(),
                                },
                              });
                              await refreshRecords();
                              setToast(t("saved"));
                            })
                          }
                        >
                          {t("create")}
                        </Button>
                        {table(
                          [t("symbol"), t("minutes"), t("delete")],
                          schedules.map((s) => [
                            s.config.symbol,
                            s.interval_minutes,
                            <button
                              onClick={() =>
                                perform("delete", async () => {
                                  await api("schedules/" + s.id, {
                                    method: "DELETE",
                                    body: {},
                                  });
                                  await refreshRecords();
                                })
                              }
                            >
                              {t("delete")}
                            </button>,
                          ]),
                        )}
                      </div>
                      <h2>{t("notifications")}</h2>
                      {notifications.map((n) => (
                        <div className="notification-item" key={n.id}>
                          <strong>
                            {t.has(n.title_key)
                              ? t(n.title_key)
                              : t("notifications")}
                          </strong>
                          <span>{n.data.symbol}</span>
                          <small>{date(n.created_at)}</small>
                        </div>
                      ))}
                    </>
                  )}
                  {tab === "journal" && (
                    <>
                      <JournalInsights records={records} locale={locale} />
                      <div className="form-card">
                        <div className="form-grid">
                          {["symbol", "entry", "exit", "quantity", "fees"].map(
                            (k) => (
                              <Field key={k} label={t(k)}>
                                {k === "symbol" ? (
                                  <input
                                    value={journalEntry[k]}
                                    onChange={(e) =>
                                      setJournalEntry({
                                        ...journalEntry,
                                        [k]: e.target.value.toUpperCase(),
                                      })
                                    }
                                  />
                                ) : (
                                  <NumberInput
                                    value={journalEntry[k]}
                                    set={(v: any) =>
                                      setJournalEntry({
                                        ...journalEntry,
                                        [k]: v,
                                      })
                                    }
                                  />
                                )}
                              </Field>
                            ),
                          )}
                          <Field label={t("direction")}>
                            <select
                              value={journalEntry.side}
                              onChange={(e) =>
                                setJournalEntry({
                                  ...journalEntry,
                                  side: e.target.value,
                                })
                              }
                            >
                              <option>LONG</option>
                              <option>SHORT</option>
                            </select>
                          </Field>
                        </div>
                        <Field label={t("notes")}>
                          <textarea
                            value={journalEntry.notes}
                            onChange={(e) =>
                              setJournalEntry({
                                ...journalEntry,
                                notes: e.target.value,
                              })
                            }
                          />
                        </Field>
                        <Field label={t("screenshot")}>
                          <input
                            type="file"
                            accept="image/png,image/jpeg"
                            onChange={(e) =>
                              setJournalFile(e.target.files?.[0] || null)
                            }
                          />
                        </Field>
                        <Button
                          onClick={() =>
                            perform("journal", async () => {
                              const row = await api("journal", {
                                method: "POST",
                                body: journalEntry,
                              });
                              if (journalFile) {
                                const base64 = await new Promise<string>(
                                  (resolve, reject) => {
                                    const reader = new FileReader();
                                    reader.onload = () =>
                                      resolve(
                                        String(reader.result).split(",")[1],
                                      );
                                    reader.onerror = reject;
                                    reader.readAsDataURL(journalFile);
                                  },
                                );
                                await api("attachments", {
                                  method: "POST",
                                  body: {
                                    journalId: row.id,
                                    mimeType: journalFile.type,
                                    base64,
                                  },
                                });
                                setJournalFile(null);
                              }
                              await refreshRecords();
                              setToast(t("saved"));
                            })
                          }
                        >
                          {t("save")}
                        </Button>
                      </div>
                      {table(
                        [
                          t("symbol"),
                          t("direction"),
                          t("entry"),
                          t("exit"),
                          t("pnl"),
                          t("notes"),
                          t("screenshot"),
                        ],
                        records.map((r) => [
                          r.symbol,
                          r.side,
                          fmt(r.entry),
                          fmt(r.exit),
                          fmt(tradePnl(r)),
                          r.notes,
                          <span>
                            {r.attachments?.map((a: any) => (
                              <a
                                key={a.id}
                                href={"/api/v1/attachments/" + a.id}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {t("screenshot")} ↗{" "}
                              </a>
                            ))}
                          </span>,
                        ]),
                      )}
                      <div className="form-card">
                        <h2>{t("review")}</h2>
                        <div className="form-grid">{providerControls}</div>
                        <Button
                          onClick={() =>
                            perform("review", async () =>
                              setReview(
                                (
                                  await api("journal-review", {
                                    method: "POST",
                                    body: aiConfig(),
                                  })
                                ).content,
                              ),
                            )
                          }
                        >
                          {t("review")}
                        </Button>
                        {review && <p className="prose-output">{review}</p>}
                      </div>
                    </>
                  )}
                  {tab === "paper" && (
                    <>
                      <div className="event-notice">{t("paperHint")}</div>
                      {paperOverviewData && (
                        <>
                          <div className="stats-grid">
                            {stat(t("account"), fmt(paperOverviewData.equity))}
                            {stat(
                              t("drawdown"),
                              fmt(paperOverviewData.drawdownPct) + "%",
                            )}
                          </div>
                          {table(
                            [
                              t("symbol"),
                              t("direction"),
                              t("notional"),
                              t("pnl"),
                            ],
                            paperOverviewData.exposure.map((r: any) => [
                              r.symbol,
                              r.direction,
                              fmt(r.notional),
                              fmt(r.unrealizedPnl),
                            ]),
                          )}
                        </>
                      )}
                      <div className="stats-grid">
                        {stat(t("balance"), fmt(paperAccount?.balance))}
                        {stat(t("trades"), records.length)}
                        {stat(
                          t("pnl"),
                          fmt(
                            records.reduce((s, r) => s + Number(r.pnl || 0), 0),
                          ),
                        )}
                      </div>
                      <div className="form-card">
                        <div className="form-grid">
                          <Field label={t("symbol")}>
                            <input
                              value={instrument.symbol}
                              onChange={(e) =>
                                updateInstrument({
                                  symbol: e.target.value.toUpperCase(),
                                })
                              }
                            />
                          </Field>
                          <Field label={t("direction")}>
                            <select
                              value={direction}
                              onChange={(e) => setDirection(e.target.value)}
                            >
                              <option>LONG</option>
                              <option>SHORT</option>
                            </select>
                          </Field>
                          <Field label={t("quantity")}>
                            <NumberInput
                              value={paperQuantity}
                              set={setPaperQuantity}
                            />
                          </Field>
                        </div>
                        <Button
                          onClick={() =>
                            perform("paper", async () => {
                              await api("paper/orders", {
                                method: "POST",
                                headers: {
                                  "idempotency-key": crypto.randomUUID(),
                                },
                                body: {
                                  ...instrument,
                                  direction,
                                  quantity: paperQuantity,
                                },
                              });
                              await refreshRecords();
                              setToast(t("saved"));
                            })
                          }
                        >
                          {t("simulate")}
                        </Button>
                      </div>
                      {table(
                        [
                          t("symbol"),
                          t("direction"),
                          t("quantity"),
                          t("entry"),
                          t("pnl"),
                          t("status"),
                          t("closePosition"),
                        ],
                        records.map((r) => [
                          r.symbol,
                          r.direction,
                          fmt(r.quantity, 5),
                          fmt(r.fill_price),
                          r.pnl == null ? "—" : fmt(r.pnl),
                          t.has(r.status) ? t(r.status) : r.status,
                          !r.closed_at && (
                            <Button
                              variant="outline"
                              onClick={() =>
                                perform("close", async () => {
                                  await api("paper-close/" + r.id, {
                                    method: "POST",
                                    body: {},
                                  });
                                  await refreshRecords();
                                })
                              }
                            >
                              {t("close")}
                            </Button>
                          ),
                        ]),
                      )}
                    </>
                  )}
                  {tab === "track" && (
                    <>
                      <p className="muted">{t("trackHint")}</p>
                      <div className="stats-grid">
                        {stat(
                          t("sample"),
                          records.filter((r) =>
                            ["tp", "sl", "expired", "ambiguous"].includes(
                              r.status,
                            ),
                          ).length,
                        )}
                        {stat(
                          t("outcomeRate"),
                          records.filter((r) =>
                            ["tp", "sl", "expired", "ambiguous"].includes(
                              r.status,
                            ),
                          ).length
                            ? fmt(
                                (records.filter((r) => r.status === "tp")
                                  .length /
                                  records.filter((r) =>
                                    [
                                      "tp",
                                      "sl",
                                      "expired",
                                      "ambiguous",
                                    ].includes(r.status),
                                  ).length) *
                                  100,
                              ) + "%"
                            : "—",
                        )}
                        {stat(
                          t("ambiguous"),
                          records.filter((r) => r.status === "ambiguous")
                            .length,
                        )}
                        {stat(
                          t("expired"),
                          records.filter((r) => r.status === "expired").length,
                        )}
                      </div>
                      {table(
                        [
                          t("symbol"),
                          t("direction"),
                          t("entry"),
                          t("stop"),
                          t("status"),
                          t("date"),
                        ],
                        records.map((r) => [
                          r.request_config.symbol,
                          r.direction,
                          fmt(r.entry),
                          fmt(r.stop_loss),
                          t.has(r.status) ? t(r.status) : r.status,
                          date(r.created_at),
                        ]),
                      )}
                    </>
                  )}
                  {tab === "backtest" && (
                    <>
                      <p className="muted">{t("backtestHint")}</p>
                      <div className="form-card">
                        <div className="form-grid">
                          <Field label={t("fast")}>
                            <NumberInput
                              value={fast}
                              set={setFast}
                              min={2}
                              step={1}
                            />
                          </Field>
                          <Field label={t("slow")}>
                            <NumberInput
                              value={slow}
                              set={setSlow}
                              min={3}
                              step={1}
                            />
                          </Field>
                          <Field label={t("initialBalance")}>
                            <NumberInput value={account} set={setAccount} />
                          </Field>
                          <Field label={t("riskPct")}>
                            <NumberInput value={riskPct} set={setRiskPct} />
                          </Field>
                          <Field label={t("feeBps")}>
                            <NumberInput value={fees} set={setFees} />
                          </Field>
                          <Field label={t("slippageBps")}>
                            <NumberInput value={slippage} set={setSlippage} />
                          </Field>
                        </div>
                        <Button
                          onClick={() =>
                            perform("backtest", async () => {
                              const r = await api("backtests", {
                                method: "POST",
                                body: {
                                  ...instrument,
                                  fast,
                                  slow,
                                  riskPct,
                                  initialBalance: account,
                                  feeBps: fees,
                                  slippageBps: slippage,
                                },
                              });
                              setBacktestId(r.id);
                              setBacktestResult(null);
                              await refreshRecords();
                            })
                          }
                        >
                          {t("runBacktest")}
                        </Button>
                      </div>
                      {backtestResult && (
                        <>
                          <div className="stats-grid">
                            {stat(t("balance"), fmt(backtestResult.equity))}
                            {stat(
                              t("return"),
                              fmt(backtestResult.returnPct) + "%",
                            )}
                            {stat(
                              t("drawdown"),
                              fmt(backtestResult.maxDrawdownPct) + "%",
                            )}
                            {stat(
                              t("winRate"),
                              fmt(backtestResult.winRate) + "%",
                            )}
                          </div>
                          {table(
                            [t("entry"), t("exit"), t("quantity"), t("pnl")],
                            backtestResult.trades.map((r: any) => [
                              fmt(r.price),
                              fmt(r.exit),
                              fmt(r.quantity, 5),
                              fmt(r.pnl),
                            ]),
                          )}
                          {backtestResult.openPosition && (
                            <p className="event-notice">
                              {t("active")}:{" "}
                              {fmt(backtestResult.openPosition.quantity, 5)} ·{" "}
                              {fmt(backtestResult.openPosition.price)}
                            </p>
                          )}
                        </>
                      )}
                      {table(
                        [t("symbol"), t("status"), t("date"), t("details")],
                        records.map((r) => [
                          r.strategy.symbol,
                          t.has(r.status) ? t(r.status) : r.status,
                          date(r.created_at),
                          r.result && (
                            <button
                              className="text-button"
                              onClick={() => setBacktestResult(r.result)}
                            >
                              {t("details")}
                            </button>
                          ),
                        ]),
                      )}
                    </>
                  )}
                  {tab === "settings" && (
                    <>
                      <WalletAccess
                        chains={configuration.walletChains}
                        user={user}
                        locale={locale}
                        onChanged={async () => {
                          await loadMe();
                        }}
                      />
                      <div className="settings-grid">
                        <div className="form-card">
                          <h2>{t("settings")}</h2>
                          <div className="form-grid">
                            <Field label={t("language")}>
                              <select
                                value={locale}
                                onChange={(e) => setLocale(e.target.value)}
                              >
                                <option value="en">English</option>
                                <option value="pl">Polski</option>
                                <option value="de">Deutsch</option>
                              </select>
                            </Field>
                            <Field label={t("timezone")}>
                              <input
                                value={timezone}
                                onChange={(e) => setTimezone(e.target.value)}
                              />
                            </Field>
                            <Field label={t("theme")}>
                              <select
                                value={theme}
                                onChange={(e) => setTheme(e.target.value)}
                              >
                                <option value="dark">{t("dark")}</option>
                                <option value="light">{t("light")}</option>
                              </select>
                            </Field>
                            <Field label={t("dailyLossLimit")}>
                              <NumberInput
                                value={lossLimit}
                                set={setLossLimit}
                              />
                            </Field>
                            <Field label={t("drawdown")}>
                              <NumberInput
                                value={maxDrawdown}
                                set={setMaxDrawdown}
                              />
                            </Field>
                            <Field label={t("telegramChatId")}>
                              <input
                                value={telegramChatId}
                                onChange={(e) =>
                                  setTelegramChatId(e.target.value)
                                }
                              />
                            </Field>
                          </div>
                          <Button
                            onClick={() =>
                              perform("settings", async () => {
                                await api("settings", {
                                  method: "PATCH",
                                  body: {
                                    locale,
                                    timezone,
                                    settings: {
                                      theme,
                                      dailyLossLimit: lossLimit,
                                      maxDrawdownPct: maxDrawdown,
                                      ...(telegramChatId
                                        ? { telegramChatId }
                                        : {}),
                                    },
                                  },
                                });
                                setToast(t("saved"));
                              })
                            }
                          >
                            {t("save")}
                          </Button>
                          <Button
                            variant="outline"
                            disabled={!configuration.pushKey}
                            onClick={() =>
                              perform("push", async () => {
                                if (
                                  !("serviceWorker" in navigator) ||
                                  !("PushManager" in window)
                                )
                                  throw new Error("service_unavailable");
                                const permission =
                                  await Notification.requestPermission();
                                if (permission !== "granted") return;
                                const registration =
                                  await navigator.serviceWorker.register(
                                    "/sw.js",
                                  );
                                await navigator.serviceWorker.ready;
                                const encoded = configuration.pushKey
                                    .replace(/-/g, "+")
                                    .replace(/_/g, "/"),
                                  raw = atob(
                                    encoded +
                                      "=".repeat(
                                        (4 - (encoded.length % 4)) % 4,
                                      ),
                                  ),
                                  key = Uint8Array.from(raw, (c: string) =>
                                    c.charCodeAt(0),
                                  );
                                const subscription =
                                  await registration.pushManager.subscribe({
                                    userVisibleOnly: true,
                                    applicationServerKey: key,
                                  });
                                await api("push", {
                                  method: "POST",
                                  body: subscription.toJSON(),
                                });
                                setToast(t("saved"));
                              })
                            }
                          >
                            {t("enablePush")}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              perform("logout", async () => {
                                await api("auth/logout", {
                                  method: "POST",
                                  body: {},
                                });
                                setUser(null);
                                setCsrf("");
                              })
                            }
                          >
                            <LogOut size={15} />
                            {t("logout")}
                          </Button>
                        </div>
                        <div className="form-card">
                          <h2>{t("apiKey")}</h2>
                          <p className="muted">{t("keyHint")}</p>
                          <div className="form-grid">
                            {providerControls}
                            <Field label={t("apiKey")}>
                              <input
                                type="password"
                                value={keyValue}
                                onChange={(e) => setKeyValue(e.target.value)}
                                autoComplete="new-password"
                              />
                            </Field>
                          </div>
                          <Button
                            onClick={() =>
                              perform("key", async () => {
                                await api("credentials", {
                                  method: "POST",
                                  body: { provider, key: keyValue },
                                });
                                setKeyValue("");
                                setKeys(await api("credentials"));
                                setToast(t("saved"));
                              })
                            }
                          >
                            {t("save")}
                          </Button>
                          {keys.map((k) => (
                            <div className="key-row" key={k.id}>
                              <Check size={16} className="positive" />
                              <span>{k.provider}</span>
                              <button
                                className="icon-button"
                                title={t("delete")}
                                onClick={() =>
                                  perform("key", async () => {
                                    await api("credentials/" + k.id, {
                                      method: "DELETE",
                                      body: {},
                                    });
                                    setKeys(await api("credentials"));
                                  })
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="form-card">
                          <h2>{t("exchangeImport")}</h2>
                          <div className="form-grid">
                            <Field label={t("exchangeKey")}>
                              <input
                                type="password"
                                value={exchangeKey}
                                onChange={(e) => setExchangeKey(e.target.value)}
                                autoComplete="new-password"
                              />
                            </Field>
                            <Field label={t("exchangeSecret")}>
                              <input
                                type="password"
                                value={exchangeSecret}
                                onChange={(e) =>
                                  setExchangeSecret(e.target.value)
                                }
                                autoComplete="new-password"
                              />
                            </Field>
                          </div>
                          <Button
                            onClick={() =>
                              perform("exchange", async () => {
                                await api("exchange/connect", {
                                  method: "POST",
                                  body: {
                                    apiKey: exchangeKey,
                                    secret: exchangeSecret,
                                  },
                                });
                                setExchangeKey("");
                                setExchangeSecret("");
                                setToast(t("saved"));
                              })
                            }
                          >
                            {t("connectReadonly")}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              perform("exchange", async () =>
                                setPortfolio(await api("exchange/portfolio")),
                              )
                            }
                          >
                            {t("loadPortfolio")}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              perform("exchange", async () =>
                                setImportedTrades(
                                  await api(
                                    "exchange/trades?symbol=" +
                                      instrument.symbol,
                                  ),
                                ),
                              )
                            }
                          >
                            {t("importTrades")}
                          </Button>
                          {portfolio &&
                            table(
                              [t("symbol"), t("balance")],
                              portfolio.balances.map((b: any) => [
                                b.asset,
                                fmt(+b.free + +b.locked, 6),
                              ]),
                            )}
                          {importedTrades.length > 0 &&
                            table(
                              [
                                t("symbol"),
                                t("price"),
                                t("quantity"),
                                t("fees"),
                              ],
                              importedTrades.map((r) => [
                                r.symbol,
                                fmt(r.data.price),
                                fmt(r.data.qty, 6),
                                r.data.commission +
                                  " " +
                                  r.data.commissionAsset,
                              ]),
                            )}
                        </div>
                        <div className="form-card">
                          <h2>{t("twoFactor")}</h2>
                          {user.two_factor ? (
                            <>
                              <span className="positive">{t("active")}</span>
                              <Field label={t("password")}>
                                <input
                                  type="password"
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                />
                              </Field>
                              <Field label={t("totpCode")}>
                                <input
                                  value={totpCode}
                                  onChange={(e) => setTotpCode(e.target.value)}
                                />
                              </Field>
                              <Button
                                variant="outline"
                                onClick={() =>
                                  perform("totp", async () => {
                                    await api("totp", {
                                      method: "DELETE",
                                      body: { password, code: totpCode },
                                    });
                                    setPassword("");
                                    setTotpCode("");
                                    await loadMe();
                                  })
                                }
                              >
                                {t("disable")}
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                onClick={() =>
                                  perform("totp", async () =>
                                    setTotpSecret(await api("totp")),
                                  )
                                }
                              >
                                {t("enable")}
                              </Button>
                              {totpSecret && (
                                <>
                                  <Field label={t("secret")}>
                                    <input readOnly value={totpSecret.secret} />
                                  </Field>
                                  <Field label={t("totpCode")}>
                                    <input
                                      value={totpCode}
                                      onChange={(e) =>
                                        setTotpCode(e.target.value)
                                      }
                                      inputMode="numeric"
                                    />
                                  </Field>
                                  <Button
                                    onClick={() =>
                                      perform("totp", async () => {
                                        await api("totp", {
                                          method: "POST",
                                          body: {
                                            secret: totpSecret.secret,
                                            code: totpCode,
                                          },
                                        });
                                        setTotpSecret(null);
                                        setTotpCode("");
                                        await loadMe();
                                      })
                                    }
                                  >
                                    {t("save")}
                                  </Button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                        <div className="form-card">
                          <h2>{t("account")}</h2>
                          {stat(t("usage"), usage?.analyses || 0)}
                          <p>
                            {t("cost")}: {fmt(usage?.reserved || 0)} USD
                          </p>
                          <Button
                            variant="outline"
                            disabled={!configuration.billing}
                            onClick={() =>
                              perform("billing", async () => {
                                const r = await api("billing/checkout", {
                                  method: "POST",
                                  body: {},
                                });
                                location.assign(r.url);
                              })
                            }
                          >
                            {t("upgrade")}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              perform("export", async () => {
                                const r = await api("account/export"),
                                  u = URL.createObjectURL(
                                    new Blob([JSON.stringify(r, null, 2)], {
                                      type: "application/json",
                                    }),
                                  ),
                                  a = document.createElement("a");
                                a.href = u;
                                a.download = "CryptoSight-account.json";
                                a.click();
                                URL.revokeObjectURL(u);
                              })
                            }
                          >
                            {t("exportAccount")}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setDeleteOpen(true)}
                          >
                            {t("deleteAccount")}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
          )}
          <footer className="workspace-footer">
            <span>{t("educational")}</span>
            <span className="desktop-only">{t("help")}</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label={t("close")}
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <Modal
        open={consentOpen}
        onOpenChange={() => {}}
        title={t("consentTitle")}
        closeLabel={t("close")}
      >
        <p>{t("educational")}</p>
        <p>{t("consentText")}</p>
        <Button
          onClick={() =>
            perform("consent", async () => {
              if (user) await api("consents", { method: "POST", body: {} });
              try {
                localStorage.setItem("risk-consent", "2026-10-v1");
              } catch {}
              setConsentOpen(false);
            })
          }
        >
          {t("accept")}
        </Button>
      </Modal>
      <Modal
        open={authOpen}
        onOpenChange={setAuthOpen}
        title={t(oauthMfa ? "oauthMfa" : register ? "register" : "login")}
        closeLabel={t("close")}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            authSubmit();
          }}
        >
          {!oauthMfa && (
            <>
              <Field label={t("email")}>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </Field>
              <Field label={t("password")}>
                <input
                  required
                  type="password"
                  minLength={register ? 12 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={register ? "new-password" : "current-password"}
                />
              </Field>
            </>
          )}
          {!register && (
            <Field label={t("totpCode")}>
              <input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </Field>
          )}
          {register && <p className="muted">{t("consentText")}</p>}
          <Button disabled={busy === "auth"} type="submit">
            {t(register ? "register" : "login")}
          </Button>
        </form>
        {!oauthMfa && (
          <>
            <div className="auth-links">
              <button
                className="text-button"
                onClick={() => setRegister(!register)}
              >
                {t(register ? "login" : "register")}
              </button>
              <button
                className="text-button"
                onClick={() =>
                  perform("reset", async () => {
                    await api("auth/reset-request", {
                      method: "POST",
                      body: { email },
                    });
                    setToast(t("resetSent"));
                  })
                }
              >
                {t("forgot")}
              </button>
            </div>
            <button
              className="text-button"
              onClick={() =>
                perform("verify", async () => {
                  await api("auth/resend-verification", {
                    method: "POST",
                    body: { email },
                  });
                  setToast(t("verificationSent"));
                })
              }
            >
              {t("resendVerification")}
            </button>
          </>
        )}
        {configuration.googleOAuth && !oauthMfa && (
          <a className="button button-outline" href="/api/v1/auth/oauth/start">
            {t("google")}
          </a>
        )}
        {!oauthMfa && (
          <WalletAccess
            chains={configuration.walletChains}
            locale={locale}
            onChanged={async () => {
              await loadMe();
              setAuthOpen(false);
            }}
          />
        )}
      </Modal>
      <CommandPalette
        open={commandsOpen}
        onOpenChange={setCommandsOpen}
        commands={commands}
      />
      <Modal
        open={riskOpen}
        onOpenChange={setRiskOpen}
        title={t("calculator")}
        closeLabel={t("close")}
      >
        <div className="form-grid">
          <Field label={t("account")}>
            <NumberInput value={account} set={setAccount} />
          </Field>
          <Field label={t("riskPct")}>
            <NumberInput value={riskPct} set={setRiskPct} />
          </Field>
          <Field label={t("entry")}>
            <NumberInput value={entry} set={setEntry} />
          </Field>
          <Field label={t("stop")}>
            <NumberInput value={stop} set={setStop} />
          </Field>
          <Field label={t("targetPrice")}>
            <NumberInput value={target} set={setTarget} />
          </Field>
          <Field label={t("feeBps")}>
            <NumberInput value={riskFees} set={setRiskFees} />
          </Field>
          <Field label={t("slippageBps")}>
            <NumberInput value={riskSlippage} set={setRiskSlippage} />
          </Field>
          <Field label={t("leverage")}>
            <NumberInput value={leverage} set={setLeverage} />
          </Field>
          <Field label={t("direction")}>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              <option>LONG</option>
              <option>SHORT</option>
            </select>
          </Field>
        </div>
        <Button
          onClick={() =>
            perform("risk", async () =>
              setSizeResult(
                await api("risk", {
                  method: "POST",
                  body: {
                    account,
                    riskPct,
                    entry,
                    stop,
                    leverage,
                    direction,
                    feeBps: riskFees,
                    slippageBps: riskSlippage,
                    ...(target !== "" ? { target } : {}),
                  },
                }),
              ),
            )
          }
        >
          {t("calculate")}
        </Button>
        {sizeResult && (
          <>
            <div className="stats-grid">
              {stat(t("quantity"), fmt(sizeResult.quantity, 6))}
              {stat(t("notional"), fmt(sizeResult.notional))}
              {stat(t("margin"), fmt(sizeResult.margin))}
              {stat(t("maxLoss"), fmt(sizeResult.maxLoss))}
              {stat(t("breakEvenPrice"), fmt(sizeResult.breakEvenPrice, 6))}
              {sizeResult.target != null && (
                <>
                  {stat(t("targetCosts"), fmt(sizeResult.targetCosts))}
                  {stat(t("netTargetProfit"), fmt(sizeResult.netProfit))}
                  {stat(t("netRewardRisk"), fmt(sizeResult.rewardRisk) + " R")}
                </>
              )}
            </div>
            {sizeResult.warnings.map((warning: string) => (
              <p className="risk-warning" key={warning}>
                {t("riskWarning_" + warning)}
              </p>
            ))}
            <p className="muted">{t("riskCostHint")}</p>
            <p className="muted">{t("liquidation")}</p>
          </>
        )}
      </Modal>
      <Modal
        open={indicatorOpen}
        onOpenChange={setIndicatorOpen}
        title={t("indicators")}
        closeLabel={t("close")}
      >
        <div className="checks">
          <label>
            <input
              type="checkbox"
              checked={allowFallback}
              onChange={(e) => setAllowFallback(e.target.checked)}
            />
            {t("autoFallback")}
          </label>
        </div>
        <div className="checks">
          {[
            "EMA",
            "MA",
            "BOLL",
            "SAR",
            "RSI",
            "MACD",
            "CCI",
            "OBV",
            ...extraIndicators,
          ].map((n) => (
            <label key={n}>
              <input
                type="checkbox"
                checked={indicatorNames.includes(n)}
                onChange={(e) =>
                  setIndicators(
                    e.target.checked
                      ? [...indicatorNames, n]
                      : indicatorNames.filter((x) => x !== n),
                  )
                }
              />
              {n.replace("CS_", "")}
            </label>
          ))}
        </div>
        <Field label={t("period")}>
          <NumberInput value={period} set={setPeriod} min={2} step={1} />
        </Field>
        <Field label={t("template")}>
          <input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
          />
        </Field>
        <Button
          onClick={() => {
            if (!protect()) return;
            perform("template", async () => {
              await api("templates", {
                method: "POST",
                body: {
                  name: templateName,
                  config: { indicatorNames, period, chartType },
                },
              });
              setToast(t("saved"));
            });
          }}
        >
          {t("save")}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (!protect()) return;
            perform("template", async () =>
              setTemplates(await api("templates")),
            );
          }}
        >
          {t("template")}
        </Button>
        {templates.map((r) => (
          <button
            className="template-item"
            key={r.id}
            onClick={() => {
              setIndicators(r.config.indicatorNames || []);
              setPeriod(r.config.period || 20);
              setChartType(r.config.chartType || "candles");
            }}
          >
            {r.name}
          </button>
        ))}
        {data?.indicators && (
          <div className="indicator-values">
            {Object.entries(data.indicators)
              .filter(([k, v]) => typeof v === "number")
              .map(([k, v]) => (
                <div key={k}>
                  <span>{k}</span>
                  <strong>{fmt(v, 3)}</strong>
                </div>
              ))}
          </div>
        )}
      </Modal>
      <Modal
        open={drawingModal}
        onOpenChange={setDrawingModal}
        title={t("drawings")}
        closeLabel={t("close")}
      >
        <p className="muted">{t("drawHint")}</p>
        <Field label={t("drawingNote")}>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {!user && <p>{t("drawingLocal")}</p>}
        <Button
          variant="outline"
          onClick={() => {
            chartRef.current?.clear();
            setDrawingModal(false);
          }}
        >
          {t("clear")}
        </Button>
        {savedDrawingRows.map((r) => (
          <div className="key-row" key={r.id}>
            <span>{r.kind}</span>
            <button
              onClick={() => {
                setAlertDrawingId(r.id);
                setAlertKind("drawing");
                setTab("alerts");
                setDrawingModal(false);
              }}
            >
              {t("alerts")}
            </button>
          </div>
        ))}
      </Modal>
      <Modal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("deleteAccount")}
        closeLabel={t("close")}
      >
        <p>{t("deleteWarning")}</p>
        <Field label={t("password")}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button
          className="danger"
          onClick={() =>
            perform("deleteAccount", async () => {
              await api("account", { method: "DELETE", body: { password } });
              setPassword("");
              setUser(null);
              setDeleteOpen(false);
              setCsrf("");
            })
          }
        >
          {t("deleteAccount")}
        </Button>
      </Modal>
    </div>
  );
}
