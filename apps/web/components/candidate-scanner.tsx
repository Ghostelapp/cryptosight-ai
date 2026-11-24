"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "../lib/client";
import { Button } from "./ui/button";

export function CandidateScanner({
  instrument,
  locale,
  onSelect,
  protect,
}: {
  instrument: any;
  locale: string;
  onSelect: (row: any) => void;
  protect: () => boolean;
}) {
  const t = useTranslations();
  const [timeframe, setTimeframe] = useState("1h"),
    [direction, setDirection] = useState("all"),
    [limit, setLimit] = useState(24),
    [minVolume, setMinVolume] = useState(10000000);
  const [report, setReport] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [clock, setClock] = useState(0);
  const epoch = useRef(0);
  const scope = JSON.stringify([
    instrument.venue,
    instrument.market,
    timeframe,
    direction,
    limit,
    minVolume,
  ]);
  const current = useRef(scope);
  useEffect(() => {
    current.current = scope;
    epoch.current++;
    return () => {
      epoch.current++;
    };
  }, [scope]);
  useEffect(() => {
    if (!report) return;
    const timer = setInterval(() => setClock(Date.now()), 15000);
    return () => clearInterval(timer);
  }, [report]);
  const visible = report?.scope === scope ? report.data : null;
  const stale =
    visible && (clock || Date.now()) > Date.parse(visible.refreshAfter);
  const number = (v: any) =>
    v == null || !Number.isFinite(Number(v))
      ? "—"
      : new Intl.NumberFormat(locale, {
          maximumFractionDigits: Math.abs(v) < 1 ? 8 : 4,
        }).format(v);
  async function scan() {
    if (!protect()) return;
    const ticket = ++epoch.current,
      requested = scope;
    setBusy(true);
    setError("");
    try {
      const data = await api(
        "scanner/candidates?" +
          new URLSearchParams({
            venue: instrument.venue,
            market: instrument.market,
            timeframe,
            direction,
            limit: String(limit),
            minVolume: String(minVolume),
          }),
      );
      if (ticket === epoch.current && current.current === requested) {
        setReport({ scope: requested, data });
        setClock(Date.now());
      }
    } catch (e) {
      if (ticket === epoch.current)
        setError(
          e instanceof Error && t.has("err_" + e.message)
            ? t("err_" + e.message)
            : t("candidateScanFailed"),
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="form-card candidate-scanner"
      aria-label={t("candidateScanner")}
    >
      <h2>{t("candidateScanner")}</h2>
      <p className="muted">{t("candidateScanHint")}</p>
      <div className="form-grid">
        <label className="field">
          <span>{t("timeframe")}</span>
          <select
            aria-label={t("candidateTimeframe")}
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
          >
            {["5m", "15m", "1h", "4h", "1d"].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t("direction")}</span>
          <select
            aria-label={t("candidateDirection")}
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
          >
            <option value="all">LONG / SHORT</option>
            <option value="LONG">LONG</option>
            <option value="SHORT">SHORT</option>
          </select>
        </label>
        <label className="field">
          <span>{t("minimumVolume")}</span>
          <select
            aria-label={t("candidateMinVolume")}
            value={minVolume}
            onChange={(e) => setMinVolume(Number(e.target.value))}
          >
            {[1000000, 10000000, 50000000].map((v) => (
              <option key={v} value={v}>
                {new Intl.NumberFormat(locale, { notation: "compact" }).format(
                  v,
                )}{" "}
                USDT
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t("candidateUniverse")}</span>
          <select
            aria-label={t("candidateUniverse")}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[12, 24, 30].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      <Button disabled={busy} onClick={() => void scan()}>
        {busy ? t("candidateScanning") : t("findSetups")}
      </Button>
      {error && <p role="alert">{error}</p>}
      {visible && (
        <>
          <p role="status">
            {t("candidateCoverage")}: {visible.scanned}/{visible.universeSize} ·{" "}
            {t("candidateFailed")}: {visible.failed} · {t("candidateSkipped")}:{" "}
            {visible.skipped ?? 0} · {t("candidateNotScanned")}:{" "}
            {visible.notScanned} ·{" "}
            {new Date(visible.generatedAt).toLocaleTimeString(locale)}
          </p>
          {stale && <p role="status">{t("candidateStale")}</p>}
          {visible.partial && <p>{t("candidatePartial")}</p>}
          <h3>{t("candidateReady")}</h3>
          {!visible.candidates.length && <p>{t("candidateNone")}</p>}
          <div className="evidence-grid">
            {visible.candidates.map((row: any) => (
              <article className="evidence-block" key={row.symbol}>
                <h3>
                  {row.symbol.replace("USDT", " / USDT")} · {row.direction}
                </h3>
                <strong>
                  {t("candidateScore")}: {row.score}/100
                </strong>
                <p>
                  {t("candidatePattern_" + row.pattern)} · {row.timeframe} +{" "}
                  {row.confirmationTimeframe}
                </p>
                <p>
                  {t("candidateTrigger_" + row.trigger.type)}{" "}
                  <strong>{number(row.trigger.price)}</strong> USDT
                </p>
                <dl>
                  <dt>{t("closedPrice")}</dt>
                  <dd>{number(row.price)}</dd>
                  <dt>{t("stopLoss")}</dt>
                  <dd>{number(row.stop)}</dd>
                  <dt>TP1 / TP2</dt>
                  <dd>
                    {row.targets.map((x: any) => number(x.price)).join(" / ")}
                  </dd>
                  <dt>{t("netRiskReward")}</dt>
                  <dd>{number(row.netRR)}</dd>
                  <dt>RSI / ADX</dt>
                  <dd>
                    {number(row.rsi)} / {number(row.adx)}
                  </dd>
                  <dt>{t("relativeVolume")}</dt>
                  <dd>{number(row.volumeRatio20)}×</dd>
                </dl>
                <small>
                  {t("candidateValidUntil")}:{" "}
                  {new Date(row.expiresAt).toLocaleString(locale)}
                </small>
                <Button onClick={() => onSelect(row)}>
                  {t("openCandidateChart")}
                </Button>
                {row.market === "spot" && row.direction === "SHORT" && (
                  <small>{t("candidateSpotShort")}</small>
                )}
              </article>
            ))}
          </div>
          {!!visible.watch.length && (
            <>
              <h3>{t("candidateWatch")}</h3>
              <div className="evidence-grid">
                {visible.watch.map((row: any) => (
                  <article className="evidence-block" key={row.symbol}>
                    <strong>
                      {row.symbol} · {row.direction} · {row.score}/100
                    </strong>
                    <p>
                      {t("candidateMissing")}:{" "}
                      {row.unmet
                        .map((r: string) => t("candidateRule_" + r))
                        .join(", ")}
                    </p>
                    <Button onClick={() => onSelect(row)}>
                      {t("openCandidateChart")}
                    </Button>
                  </article>
                ))}
              </div>
            </>
          )}
          <p className="muted">{t("candidateScoreHint")}</p>
          <small>{t("candidateLevelsHint")}</small>
        </>
      )}
    </section>
  );
}
