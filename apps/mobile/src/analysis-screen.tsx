import { useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import { positionSize } from "../../../packages/quant/research.mjs";
import { mutationIntents } from "./api.mjs";
import {
  AuthGate,
  Button,
  Card,
  Choices,
  Field,
  Heading,
  Label,
  Loading,
  Metrics,
  Notice,
  useMobile,
  useRemote,
} from "./ui";
import { errorText, number } from "./i18n";
import type { Agent } from "./types";

function Research() {
  const { api, user, t, locale, instrument, busy, run } = useMobile();
  const agents = useRemote<Agent[]>("agents", !!user);
  const history = useRemote<any[]>("analyses", !!user, 10000);
  const [agentId, setAgent] = useState(""),
    [provider, setProvider] = useState("openai"),
    [model, setModel] = useState(""),
    [mode, setMode] = useState("deep"),
    [jobId, setJob] = useState("");
  const job = useRemote<any>(
    "analyses/" + jobId,
    !!jobId,
    4000,
    (data) => !["completed", "failed"].includes(data.status),
  );
  const catalog = useRemote<{
    provider: string;
    models: { id: string; name: string }[];
  }>("models?provider=" + provider, !!user && !agentId);
  const [modelSearch, setModelSearch] = useState("");
  const models = catalog.data?.provider === provider ? catalog.data.models : [];
  const resolvedModel = model || (models.length === 1 ? models[0].id : "");
  const intents = useRef(mutationIntents(Crypto.randomUUID));
  const selected = agents.data?.find((a) => a.id === agentId),
    result = job.data?.result;
  const submit = () =>
    void run(async () => {
      const body = {
        ...instrument,
        locale,
        mode,
        provider: selected?.provider || provider,
        model: selected?.model || resolvedModel.trim(),
        ...(selected ? { agentId: selected.id } : {}),
      };
      const response = await api.request("analyses", {
        method: "POST",
        body,
        key: intents.current.key("analysis", body),
      });
      intents.current.done("analysis");
      setJob(response.id);
      await history.refetch();
    });
  return (
    <>
      <Card>
        <Heading>
          {t("analysis")} · {instrument.symbol}
        </Heading>
        <Label muted>
          {instrument.venue} · {instrument.market} · {instrument.timeframe}
        </Label>
        <Notice>{t("mobileAiHint")}</Notice>
        {!!agents.data?.length && (
          <Choices
            label={t("adminAgent")}
            value={agentId}
            onChange={setAgent}
            options={[
              { value: "", label: t("mobileNoAgent") },
              ...agents.data.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
        )}
        {!selected && (
          <>
            <Choices
              label={t("provider")}
              value={provider}
              onChange={(value) => {
                setProvider(value);
                setModel("");
                setModelSearch("");
              }}
              options={[
                "openai",
                "gemini",
                "anthropic",
                "openrouter",
                "local",
              ].map((value) => ({ value, label: value }))}
            />
            <Loading loading={catalog.loading} />
            {!!models.length && (
              <>
                <Field
                  label={t("searchModels")}
                  value={modelSearch}
                  onChangeText={setModelSearch}
                  autoCapitalize="none"
                />
                <Choices
                  label={t("availableModels")}
                  value={resolvedModel}
                  onChange={setModel}
                  options={models
                    .filter((m) =>
                      (m.id + " " + m.name)
                        .toLowerCase()
                        .includes(modelSearch.toLowerCase()),
                    )
                    .slice(0, 20)
                    .map((m) => ({ value: m.id, label: m.name }))}
                />
              </>
            )}
            <Button
              title={t("refreshModels")}
              disabled={catalog.loading}
              onPress={() => void catalog.refetch()}
            />
            {!!catalog.error && <Notice error>{catalog.error}</Notice>}
            <Field
              label={t("model")}
              value={resolvedModel}
              onChangeText={setModel}
              placeholder={t("mobileModelHint")}
              autoCapitalize="none"
              maxLength={100}
            />
          </>
        )}
        <Choices
          label={t("analysis")}
          value={mode}
          onChange={setMode}
          options={["quick", "deep", "explain"].map((value) => ({
            value,
            label: t(value),
          }))}
        />
        <Button
          title={t("analyze")}
          disabled={busy || (!selected && !resolvedModel.trim())}
          onPress={submit}
        />
        {!!agents.error && <Notice error>{agents.error}</Notice>}
      </Card>
      <Loading loading={job.loading && !job.data} />
      {!!job.error && <Notice error>{job.error}</Notice>}
      {!!job.data && (
        <Card>
          <Heading>{t(job.data.status)}</Heading>
          <Label muted>
            {job.data.request_config?.symbol} ·{" "}
            {job.data.request_config?.timeframe} ·{" "}
            {new Date(job.data.created_at).toLocaleString(locale)}
          </Label>
          {job.data.error_code && (
            <Notice error>
              {errorText(t, new Error(job.data.error_code))}
            </Notice>
          )}
          {result && (
            <>
              {!!job.data.research && (
                <Card>
                  <Heading>
                    {t("researchEvidence")} ·{" "}
                    {t(
                      job.data.research.status === "complete"
                        ? "qualityComplete"
                        : "qualityPartial",
                    )}
                  </Heading>
                  <Label muted>{t("evidenceHint")}</Label>
                  {job.data.research.frames?.map((frame: any) => (
                    <Card key={frame.timeframe}>
                      <Label>
                        {frame.timeframe} · {t("research_" + frame.trend)}
                      </Label>
                      <Label muted>
                        {t("closedBars")}: {frame.closedBars} ·{" "}
                        {t("candleGaps")}: {frame.gaps}
                      </Label>
                      <Label>
                        RSI: {number(locale, frame.rsi)} · ATR %:{" "}
                        {number(locale, frame.atrPct)} · {t("relativeVolume")}:{" "}
                        {number(locale, frame.volumeRatio20)}×
                      </Label>
                    </Card>
                  ))}
                  <Label>
                    {t("spread")}:{" "}
                    {number(locale, job.data.research.execution?.spreadBps)} bps
                  </Label>
                  <Label>
                    {t("btcCorrelation")}:{" "}
                    {number(locale, job.data.research.benchmark?.value)}
                  </Label>
                  {!!job.data.research.missingSources?.length && (
                    <Notice>
                      {t("missingSources")}:{" "}
                      {job.data.research.missingSources.join(", ")}
                    </Notice>
                  )}
                  {job.data.trade_metrics?.map((metric: any, index: number) => (
                    <Card key={index}>
                      <Label>
                        {metric.direction} · {t("netRiskReward")}:{" "}
                        {number(locale, metric.netRR)}
                      </Label>
                      <Label>
                        {t("breakEvenRate")}:{" "}
                        {number(locale, metric.breakEvenWinRatePct)}%
                      </Label>
                      <Label muted>
                        {t("assumedCosts")}:{" "}
                        {number(locale, metric.assumedRoundTripCostBps)} bps
                      </Label>
                    </Card>
                  ))}
                  <Label muted>{t("costAssumptionsHint")}</Label>
                </Card>
              )}
              <Label>{result.summary_short}</Label>
              <Label muted>{result.summary_detailed}</Label>
              <Label>
                {t("confidence")}: {number(locale, result.confidence, 0)} / 100
              </Label>
              <Notice>{t("confidenceHint")}</Notice>
              {result.setups?.map((setup: any, i: number) => (
                <Card key={i}>
                  <Heading>{setup.direction}</Heading>
                  <Label>{setup.reasoning}</Label>
                  {setup.entry && (
                    <>
                      <Label>
                        {t("entry")}: {number(locale, setup.entry.price, 6)}
                      </Label>
                      <Label>
                        {t("stopLoss")}: {number(locale, setup.stop_loss, 6)}
                      </Label>
                      <Label>
                        {t("targets")}:{" "}
                        {setup.take_profits
                          ?.map(
                            (target: any) =>
                              number(locale, target.price, 6) +
                              " (" +
                              target.size_pct +
                              "%)",
                          )
                          .join(" · ")}
                      </Label>
                      <Label>
                        {t("riskReward")}: {number(locale, setup.risk_reward)}
                      </Label>
                    </>
                  )}
                  <Label muted>
                    {t("invalidation")}: {setup.invalidation}
                  </Label>
                  <Label muted>
                    {t("timing")}: {setup.timing}
                  </Label>
                </Card>
              ))}
              <Label>
                {t("risk")}: {t(result.risk?.level)} ·{" "}
                {result.risk?.factors?.join(" · ")}
              </Label>
              <Label muted>{result.risk?.event_risk}</Label>
            </>
          )}
        </Card>
      )}
      <Card>
        <Heading>{t("analysis")}</Heading>
        {history.data?.slice(0, 12).map((row) => (
          <Button
            key={row.id}
            secondary
            title={`${row.request_config?.symbol || ""} · ${t(row.status)} · ${new Date(row.created_at).toLocaleDateString(locale)}`}
            onPress={() => setJob(row.id)}
          />
        ))}
        {!history.data?.length && <Label muted>{t("empty")}</Label>}
        {!!history.error && <Notice error>{history.error}</Notice>}
      </Card>
    </>
  );
}
function RiskCalculator() {
  const { t, locale } = useMobile();
  const [form, setForm] = useState({
      account: "10000",
      riskPct: "1",
      entry: "",
      stop: "",
      target: "",
      leverage: "1",
      feeBps: "10",
      slippageBps: "5",
    }),
    [direction, setDirection] = useState("LONG");
  let result: any = null;
  try {
    result = positionSize({
      ...Object.fromEntries(
        Object.entries(form).map(([key, value]) => [key, Number(value)]),
      ),
      direction,
      ...(form.target
        ? { target: Number(form.target) }
        : { target: undefined }),
    } as any);
  } catch {}
  return (
    <Card>
      <Heading>{t("calculator")}</Heading>
      <Choices
        label={t("direction")}
        value={direction}
        onChange={setDirection}
        options={["LONG", "SHORT"].map((value) => ({ value, label: value }))}
      />
      {Object.entries(form).map(([key, value]) => (
        <Field
          key={key}
          label={t(key === "target" ? "targetPrice" : key)}
          value={value}
          keyboardType="decimal-pad"
          onChangeText={(text) =>
            setForm({ ...form, [key]: text.replace(",", ".") })
          }
        />
      ))}
      {result ? (
        <>
          <Metrics
            values={[
              "quantity",
              "notional",
              "margin",
              "maxLoss",
              "breakEvenPrice",
              "targetCosts",
              "netProfit",
              "rewardRisk",
            ].map((key) => ({
              label: t(
                key === "netProfit"
                  ? "netTargetProfit"
                  : key === "rewardRisk"
                    ? "netRewardRisk"
                    : key,
              ),
              value: number(locale, result[key], key === "quantity" ? 6 : 2),
            }))}
          />
          {result.warnings.map((warning: string) => (
            <Notice key={warning}>{t("riskWarning_" + warning)}</Notice>
          ))}
        </>
      ) : (
        <Label muted>{t("mobileRequired")}</Label>
      )}
      <Notice>{t("riskCostHint")}</Notice>
    </Card>
  );
}
export function AnalysisScreen() {
  const { t } = useMobile();
  return (
    <>
      <AuthGate>
        <Research />
      </AuthGate>
      <RiskCalculator />
      <Notice>{t("disclaimer")}</Notice>
    </>
  );
}
