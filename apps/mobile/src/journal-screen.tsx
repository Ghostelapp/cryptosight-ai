import { useState } from "react";
import { Alert } from "react-native";
import { journalExportFile } from "./export-cache";
import * as Sharing from "expo-sharing";
import {
  journalStats,
  journalCsv,
  tradePnl,
} from "../../../packages/quant/journal.mjs";
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
import { PnlChart } from "./charts";
import { number } from "./i18n";
import type { JournalEntry } from "./types";
function Journal() {
  const { api, instrument, t, locale, busy, run } = useMobile();
  const entries = useRemote<JournalEntry[]>("journal");
  const [form, setForm] = useState({
    side: "LONG",
    entry: "",
    exit: "",
    quantity: "",
    fees: "0",
    notes: "",
  });
  const stats = journalStats(entries.data || []);
  const save = () =>
    void run(async () => {
      await api.request("journal", {
        method: "POST",
        body: {
          symbol: instrument.symbol,
          side: form.side,
          entry: Number(form.entry),
          exit: Number(form.exit),
          quantity: Number(form.quantity),
          fees: Number(form.fees),
          notes: form.notes,
        },
      });
      setForm({ ...form, entry: "", exit: "", quantity: "", notes: "" });
      await entries.refetch();
    });
  const share = () =>
    void run(async () => {
      if (!(await Sharing.isAvailableAsync()))
        throw new Error("service_unavailable");
      const file = journalExportFile();
      file.create({ overwrite: true });
      await file.write(journalCsv(entries.data || []));
      // Android receivers may open the URI after the chooser returns. Keep the
      // private cache file until logout/OS cleanup instead of deleting it early.
      await Sharing.shareAsync(file.uri, {
        mimeType: "text/csv",
        UTI: "public.comma-separated-values-text",
        dialogTitle: t("exportCsv"),
      });
    });
  return (
    <>
      <Heading>{t("journal")}</Heading>
      <Loading loading={entries.loading} />
      {!!entries.error && <Notice error>{entries.error}</Notice>}
      <Metrics
        values={[
          { label: t("pnl"), value: number(locale, stats.total) + " USDT" },
          {
            label: t("winRate"),
            value:
              number(locale, stats.winRate) +
              (stats.winRate == null ? "" : "%"),
          },
          { label: t("averageTrade"), value: number(locale, stats.average) },
          {
            label: t("profitFactor"),
            value: stats.noLosses ? "∞" : number(locale, stats.profitFactor),
          },
        ]}
      />
      <Card>
        <Heading>{t("cumulativePnl")}</Heading>
        <PnlChart points={stats.curve} />
        <Notice>{t("journalScope")}</Notice>
        <Button
          title={t("mobileExport")}
          secondary
          disabled={!entries.data?.length || busy}
          onPress={share}
        />
        <Button
          title={t("refresh")}
          secondary
          disabled={entries.loading}
          onPress={() => void entries.refetch()}
        />
      </Card>
      <Card>
        <Heading>
          {t("create")} · {instrument.symbol}
        </Heading>
        <Choices
          label={t("direction")}
          value={form.side}
          onChange={(side) => setForm({ ...form, side })}
          options={["LONG", "SHORT"].map((value) => ({ value, label: value }))}
        />
        {(["entry", "exit", "quantity", "fees"] as const).map((key) => (
          <Field
            key={key}
            label={t(key)}
            value={form[key]}
            keyboardType="decimal-pad"
            onChangeText={(v) =>
              setForm({ ...form, [key]: v.replace(",", ".") })
            }
          />
        ))}
        <Field
          label={t("notes")}
          value={form.notes}
          onChangeText={(notes) => setForm({ ...form, notes })}
          multiline
          maxLength={4000}
        />
        <Button
          title={t("save")}
          disabled={
            busy ||
            ![form.entry, form.exit, form.quantity].every(
              (v) => Number(v) > 0,
            ) ||
            !(Number(form.fees) >= 0)
          }
          onPress={save}
        />
      </Card>
      {entries.data?.map((entry) => (
        <Card key={entry.id}>
          <Heading>
            {entry.symbol} · {entry.side}
          </Heading>
          <Label muted>
            {new Date(entry.created_at).toLocaleString(locale)}
          </Label>
          <Label>
            {number(locale, entry.entry, 6)} → {number(locale, entry.exit, 6)} ·{" "}
            {number(locale, entry.quantity, 8)}
          </Label>
          <Label>
            {t("pnl")}: {number(locale, tradePnl(entry))} USDT
          </Label>
          {!!entry.notes && <Label muted>{entry.notes}</Label>}
          <Button
            title={t("delete")}
            secondary
            disabled={busy}
            onPress={() =>
              Alert.alert(t("delete"), entry.symbol, [
                { text: t("cancel"), style: "cancel" },
                {
                  text: t("delete"),
                  style: "destructive",
                  onPress: () =>
                    void run(async () => {
                      await api.request("journal/" + entry.id, {
                        method: "DELETE",
                        body: {},
                      });
                      await entries.refetch();
                    }),
                },
              ])
            }
          />
        </Card>
      ))}
    </>
  );
}
export function JournalScreen() {
  return (
    <AuthGate>
      <Journal />
    </AuthGate>
  );
}
