"use client";
import { useLocale, useTranslations } from "next-intl";

export function ResearchEvidence({
  research,
  metrics = [],
}: {
  research: any;
  metrics?: any[];
}) {
  const t = useTranslations(),
    locale = useLocale();
  const number = (v: any) =>
    v == null || !Number.isFinite(Number(v))
      ? "—"
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
          Number(v),
        );
  if (!research) return null;
  return (
    <section className="research-evidence" aria-label={t("researchEvidence")}>
      <h3>
        {t("researchEvidence")} ·{" "}
        {t(
          research.status === "complete" ? "qualityComplete" : "qualityPartial",
        )}
      </h3>
      <p className="muted">{t("evidenceHint")}</p>
      <div className="evidence-grid">
        {research.frames?.map((frame: any) => (
          <div className="evidence-block" key={frame.timeframe}>
            <strong>
              {frame.timeframe} · {t("research_" + frame.trend)}
            </strong>
            <dl>
              <dt>{t("closedBars")}</dt>
              <dd>{frame.closedBars}</dd>
              <dt>RSI</dt>
              <dd>{number(frame.rsi)}</dd>
              <dt>ATR %</dt>
              <dd>{number(frame.atrPct)}</dd>
              <dt>{t("relativeVolume")}</dt>
              <dd>{number(frame.volumeRatio20)}×</dd>
              <dt>{t("candleGaps")}</dt>
              <dd>{frame.gaps}</dd>
            </dl>
          </div>
        ))}
        <div className="evidence-block">
          <strong>{t("executionSnapshot")}</strong>
          <p>
            {t("spread")}: {number(research.execution?.spreadBps)} bps
          </p>
          <p>
            {t("btcCorrelation")}: {number(research.benchmark?.value)}
          </p>
          <small>{t("orderbookHint")}</small>
        </div>
      </div>
      {!!research.missingFrames?.length && (
        <p>
          {t("missingTimeframes")}: {research.missingFrames.join(", ")}
        </p>
      )}
      {!!research.missingSources?.length && (
        <p className="muted">
          {t("missingSources")}: {research.missingSources.join(", ")}
        </p>
      )}
      {metrics.length > 0 && (
        <>
          <h4>{t("afterCosts")}</h4>
          <div className="evidence-grid">
            {metrics.map((m: any, index: number) => (
              <div className="evidence-block" key={index}>
                <strong>
                  {m.direction} · {t("riskReward")}: {number(m.grossRR)}
                </strong>
                <p>
                  {t("netRiskReward")}: {number(m.netRR)}
                </p>
                <p>
                  {t("breakEvenRate")}: {number(m.breakEvenWinRatePct)}%
                </p>
                <p>
                  {t("stopDistance")}: {number(m.stopDistancePct)}%
                </p>
                <small>
                  {t("assumedCosts")}: {number(m.assumedRoundTripCostBps)} bps
                </small>
                {!m.positiveAfterCosts && (
                  <p role="status">{t("costsExceedReward")}</p>
                )}
              </div>
            ))}
          </div>
          <small>{t("costAssumptionsHint")}</small>
        </>
      )}
    </section>
  );
}
