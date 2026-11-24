"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "../lib/client";

export function ModelPicker({
  provider,
  value,
  onChange,
  enabled = true,
  revision = "",
  apiKey,
  automatic = true,
  agentId,
}: {
  provider: string;
  value: string;
  onChange: (value: string) => void;
  enabled?: boolean;
  revision?: string;
  apiKey?: string;
  automatic?: boolean;
  agentId?: string;
}) {
  const t = useTranslations();
  const [catalog, setCatalog] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const epoch = useRef(0),
    latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  async function load(key?: string) {
    const ticket = ++epoch.current;
    setLoading(true);
    setError("");
    setCatalog([]);
    try {
      const data = await api(
        key
          ? "models"
          : "models?" +
              new URLSearchParams({
                provider,
                ...(agentId ? { agentId } : {}),
              }),
        key ? { method: "POST", body: { provider, key } } : {},
      );
      if (ticket !== epoch.current) return;
      setCatalog(data.models);
      if (!latest.current.value && data.models.length === 1)
        latest.current.onChange(data.models[0].id);
    } catch (e) {
      if (ticket === epoch.current) {
        const code =
          e instanceof Error ? e.message : "model_catalog_unavailable";
        setError(
          t.has("err_" + code)
            ? t("err_" + code)
            : t("err_model_catalog_unavailable"),
        );
      }
    } finally {
      if (ticket === epoch.current) setLoading(false);
    }
  }
  useEffect(() => {
    ++epoch.current;
    setCatalog([]);
    setError("");
    setLoading(false);
    if (enabled && automatic) void load();
    return () => {
      ++epoch.current;
    };
    // Raw keys are submitted only by the explicit button, never on each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, enabled, revision, automatic, agentId, apiKey]);
  return (
    <>
      <select
        aria-label={t("availableModels")}
        disabled={!enabled || loading || !catalog.length}
        value={catalog.some((m) => m.id === value) ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
          {loading ? t("loadingModels") : t("chooseModel")}
        </option>
        {catalog.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name === m.id ? m.id : `${m.name} (${m.id})`}
          </option>
        ))}
      </select>
      <input
        aria-label={t("model")}
        value={value}
        disabled={!enabled}
        maxLength={100}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      <button
        type="button"
        disabled={!enabled || loading}
        onClick={() => void load(apiKey?.trim() || undefined)}
      >
        {t("refreshModels")}
      </button>
      {error && <small role="status">{error}</small>}
      {!loading && !error && catalog.length === 0 && enabled && (
        <small>{t("modelsHint")}</small>
      )}
    </>
  );
}
