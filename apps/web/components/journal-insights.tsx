"use client";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { journalStats, journalCsv } from "../../../packages/quant/journal.mjs";
import { Button } from "./ui/button";

export function JournalInsights({
  records,
  locale,
}: {
  records: any[];
  locale: string;
}) {
  const t = useTranslations();
  const stats = journalStats(records);
  const fmt = (value: number | null) =>
    value == null
      ? "—"
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
          value,
        );
  const values = stats.curve.map((point) => point.pnl);
  const low = Math.min(0, ...values),
    high = Math.max(0, ...values);
  const range = high - low || 1;
  const y = (value: number) => 150 - ((value - low) / range) * 130;
  const points = stats.curve
    .map(
      (point, index) =>
        `${20 + (index / Math.max(1, stats.curve.length - 1)) * 760},${y(point.pnl)}`,
    )
    .join(" ");
  const exportCsv = () => {
    const url = URL.createObjectURL(
      new Blob([journalCsv(records)], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `CryptoSight-journal-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const cards = [
    [t("trades"), stats.count],
    [t("pnl"), fmt(stats.total)],
    [t("winRate"), stats.winRate == null ? "—" : fmt(stats.winRate) + "%"],
    [t("profitFactor"), stats.noLosses ? "∞" : fmt(stats.profitFactor)],
    [t("averageTrade"), fmt(stats.average)],
    [t("journalDrawdown"), fmt(stats.maxDrawdown)],
  ];
  return (
    <section className="journal-insights" aria-label={t("journalPerformance")}>
      <div className="insights-heading">
        <h2>{t("journalPerformance")}</h2>
        <Button
          variant="outline"
          disabled={!records.length}
          onClick={exportCsv}
        >
          <Download size={16} />
          {t("exportCsv")}
        </Button>
      </div>
      <div className="stats-grid">
        {cards.slice(0, 3).map(([label, value]) => (
          <div className="stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <details className="feature-options">
        <summary>{t("pageMoreStats")}</summary>
        <div className="stats-grid">
          {cards.slice(3).map(([label, value]) => (
            <div className="stat" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </details>
      <p className="muted">{t("journalScope", { count: records.length })}</p>
      {records.length > 0 && (
        <figure className="journal-curve">
          <figcaption>{t("cumulativePnl")}</figcaption>
          <svg
            viewBox="0 0 800 170"
            role="img"
            aria-label={t("pnlCurveDescription", {
              count: stats.count,
              pnl: fmt(stats.total),
            })}
          >
            <line
              x1="20"
              x2="780"
              y1={y(0)}
              y2={y(0)}
              stroke="var(--line)"
              strokeDasharray="5 5"
            />
            <polyline
              points={points}
              fill="none"
              stroke={stats.total >= 0 ? "var(--green)" : "var(--red)"}
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="curve-labels">
            <span>0</span>
            <span>
              {t("trades")}: {stats.count} · {t("pnl")}: {fmt(stats.total)}
            </span>
          </div>
        </figure>
      )}
    </section>
  );
}
