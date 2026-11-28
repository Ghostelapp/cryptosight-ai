"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./ui/button";
export function AdminIntegrations({ api, totp, onSaved }: any) {
  const t = useTranslations(),
    [rows, setRows] = useState<any[]>([]),
    [secrets, setSecrets] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [testEmail, setTestEmail] = useState(""),
    [message, setMessage] = useState("");
  const load = () => api("admin/integrations").then(setRows);
  useEffect(() => {
    load().catch(() => setMessage(t("err_service_unavailable")));
  }, []);
  function change(name: string, patch: any) {
    setRows((current) =>
      current.map((row) => (row.name === name ? { ...row, ...patch } : row)),
    );
  }
  return (
    <section aria-label={t("serviceIntegrations")} aria-busy={busy}>
      <p className="muted">{t("integrationSecretsHint")}</p>
      {message && <p role="status">{message}</p>}
      <div className="settings-grid">
        {rows.map((row) => (
          <form
            key={row.name}
            className="form-card"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMessage("");
              try {
                await api("admin/integrations/" + row.name, {
                  method: "PUT",
                  body: {
                    enabled: row.enabled,
                    version: row.version,
                    config: row.config,
                    ...(secrets[row.name] ? { secret: secrets[row.name] } : {}),
                    ...(totp ? { totp } : {}),
                  },
                });
                setSecrets((v) => ({ ...v, [row.name]: "" }));
                await load();
                await onSaved();
                setMessage(t("saved"));
              } catch (e: any) {
                setMessage(
                  t.has("err_" + e.message)
                    ? t("err_" + e.message)
                    : t("errors"),
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2>{row.name === "resend" ? "Resend" : "Cloudflare Turnstile"}</h2>
            <p>
              {t(
                row.name === "resend"
                  ? "resendSetupHint"
                  : "turnstileSetupHint",
              )}
            </p>
            <p>
              {t(
                row.hasSecret
                  ? "integrationKeyStored"
                  : "integrationKeyMissing",
              )}
            </p>
            <label className="field">
              <span>
                {t(row.name === "resend" ? "emailSender" : "turnstileSiteKey")}
              </span>
              <input
                disabled={busy}
                required
                type={row.name === "resend" ? "email" : "text"}
                value={
                  row.config[row.name === "resend" ? "from" : "siteKey"] || ""
                }
                onChange={(e) =>
                  change(row.name, {
                    config: {
                      [row.name === "resend" ? "from" : "siteKey"]:
                        e.target.value,
                    },
                  })
                }
              />
            </label>
            <label className="field">
              <span>
                {t(
                  row.name === "resend" ? "resendApiKey" : "turnstileSecretKey",
                )}
              </span>
              <input
                disabled={busy}
                type="password"
                autoComplete="new-password"
                value={secrets[row.name] || ""}
                onChange={(e) =>
                  setSecrets((v) => ({ ...v, [row.name]: e.target.value }))
                }
                placeholder={row.hasSecret ? t("integrationKeepSecret") : ""}
              />
            </label>
            <label className="wallet-consent">
              <input
                disabled={busy}
                type="checkbox"
                checked={row.enabled}
                onChange={(e) =>
                  change(row.name, { enabled: e.target.checked })
                }
              />
              {t("enableIntegration")}
            </label>
            <Button type="submit" disabled={busy}>
              {t("save")}
            </Button>
          </form>
        ))}
      </div>
      <form
        className="form-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("admin/integrations/resend/test", {
              method: "POST",
              body: { email: testEmail, ...(totp ? { totp } : {}) },
            });
            await onSaved();
            setMessage(t("mailTestAccepted"));
          } catch (e: any) {
            setMessage(
              t.has("err_" + e.message) ? t("err_" + e.message) : t("errors"),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>{t("mailTest")}</h2>
        <p>{t("mailTestHint")}</p>
        <label className="field">
          <span>{t("email")}</span>
          <input
            disabled={busy}
            type="email"
            required
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
        </label>
        <Button disabled={busy} type="submit">
          {t("sendTestEmail")}
        </Button>
      </form>
    </section>
  );
}
