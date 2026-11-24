"use client";
import { useTranslations } from "next-intl";
import {
  buildAIChartPlan,
  buildAIChartContext,
} from "../../../packages/market/ai-chart.mjs";

export function AIChartGuide({
  analysis,
  instrument,
  context,
  index,
  onSelect,
  visible,
  onVisible,
  fit,
  onFit,
  showContext,
  onContext,
  demo,
  locale,
  reference,
}: any) {
  const t = useTranslations();
  const plan = buildAIChartPlan(analysis, instrument, index, context, demo);
  if (!plan) return null;
  const setup = plan.setup,
    notes = setup.chart_notes;
  const contextLevels = plan.noTrade
    ? buildAIChartContext(analysis, reference, [], 2)
    : [];
  const number = (value: number) =>
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: value < 1 ? 8 : 4,
    }).format(value);
  const date = new Date(analysis.timestamp).toLocaleString(locale);
  return (
    <section className="ai-chart-guide" aria-label={t("aiChartGuide")}>
      <div className="ai-chart-heading">
        <h3>
          {t("aiChartGuide")} · {plan.noTrade ? t("noTrade") : plan.direction}
        </h3>
        <small>
          {date} · {instrument.timeframe}
        </small>
      </div>
      <div className="ai-chart-controls">
        {analysis.setups.length > 1 && (
          <label className="field">
            <span>{t("aiChartScenario")}</span>
            <select
              aria-label={t("aiChartScenario")}
              value={plan.index}
              onChange={(e) => onSelect(Number(e.target.value))}
            >
              {analysis.setups.map((s: any, n: number) => (
                <option key={n} value={n}>
                  {n + 1} ·{" "}
                  {s.direction === "NO_TRADE" ? t("noTrade") : s.direction}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => onVisible(e.target.checked)}
          />{" "}
          {t("aiShowPlan")}
        </label>
        {(!plan.noTrade || contextLevels.length > 0) && (
          <label>
            <input
              type="checkbox"
              checked={fit}
              onChange={(e) => onFit(e.target.checked)}
            />{" "}
            {t(plan.noTrade ? "aiFitContext" : "aiFitPlan")}
          </label>
        )}
        {!plan.noTrade && (
          <label>
            <input
              type="checkbox"
              checked={showContext}
              onChange={(e) => onContext(e.target.checked)}
            />{" "}
            {t("aiShowContext")}
          </label>
        )}
      </div>
      <p className="ai-chart-summary">{analysis.summary_short}</p>
      {plan.noTrade ? (
        <>
          <p>{t("aiNoTradeDrawing")}</p>
          {contextLevels.length ? (
            <div className="ai-chart-legend">
              {contextLevels.map((level) => (
                <article
                  key={level.id}
                  className={
                    "ai-note " +
                    (level.kind === "support" ? "ai-target" : "ai-stop")
                  }
                >
                  <strong>
                    {t(
                      level.kind === "support"
                        ? "aiSupportLong"
                        : "aiResistanceLong",
                    )}{" "}
                    {level.number}: {number(level.price)}
                  </strong>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">{t("aiNoContextLevels")}</p>
          )}
        </>
      ) : (
        <>
          <p className="muted">{t("aiPlanConditional")}</p>
          <div className="ai-chart-legend">
            <article className="ai-note ai-entry">
              <strong>
                1 · {t("entry")}: {number(setup.entry.zone[0])}–
                {number(setup.entry.zone[1])}
              </strong>
              <p>{notes?.entry || t("aiNotesMissing")}</p>
            </article>
            <article className="ai-note ai-trigger">
              <strong>
                2 · {t("aiTrigger")}: {number(setup.trigger.price)}
              </strong>
              <p>
                {t("aiTrigger_" + setup.trigger.type)} ·{" "}
                {setup.trigger.timeframe}
              </p>
              <p>{notes?.trigger || setup.timing}</p>
            </article>
            <article className="ai-note ai-stop">
              <strong>3 · SL: {number(setup.stop_loss)}</strong>
              <p>{notes?.stop || setup.invalidation}</p>
            </article>
            {setup.take_profits.map((tp: any, n: number) => (
              <article className="ai-note ai-target" key={n}>
                <strong>
                  {4 + n} · TP{n + 1}: {number(tp.price)} · {tp.size_pct}%
                </strong>
                <p>{notes?.targets?.[n] || t("aiNotesMissing")}</p>
              </article>
            ))}
          </div>
        </>
      )}
      <details open>
        <summary>{t("aiOriginalReasoning")}</summary>
        <p>{setup.reasoning}</p>
        <strong>{t("timing")}</strong>
        <p>{setup.timing}</p>
        <strong>{t("invalidation")}</strong>
        <p>{setup.invalidation}</p>
      </details>
      <small>{t("aiChartNotesHint")}</small>
    </section>
  );
}
