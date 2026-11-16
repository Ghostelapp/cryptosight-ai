"use client";
import { useEffect, useState } from "react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { api, setCsrf } from "../../../lib/client";
import { Button } from "../../../components/ui/button";
import { mobileRequestPattern } from "../../../../../packages/mobile/protocol.mjs";
import en from "../../../messages/en.json";
import pl from "../../../messages/pl.json";
import de from "../../../messages/de.json";
const catalogs = { en, pl, de };

function Connect() {
  const t = useTranslations();
  const [requestId, setRequestId] = useState("");
  const [me, setMe] = useState<any>(null);
  const [expires, setExpires] = useState("");
  const [error, setError] = useState("");
  const [totp, setTotp] = useState("");
  const [busy, setBusy] = useState(false);
  const [redirect, setRedirect] = useState("");
  useEffect(() => {
    let active = true;
    const id = new URLSearchParams(location.search).get("request") || "";
    if (!mobileRequestPattern.test(id)) {
      setError(t("mobileConnectExpired"));
      return;
    }
    setRequestId(id);
    Promise.all([api("auth/mobile/request/" + id), api("auth/me")])
      .then(([info, account]) => {
        if (!active) return;
        if (!account.user || !account.consentAccepted) {
          location.replace("/?mobileRequest=" + id);
          return;
        }
        setCsrf(account.csrfToken);
        setMe(account.user);
        setExpires(info.expiresAt);
      })
      .catch(() => {
        if (active) setError(t("mobileConnectExpired"));
      });
    return () => {
      active = false;
    };
  }, [t]);
  const approve = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api("auth/mobile/authorize", {
        method: "POST",
        body: { requestId, ...(totp ? { totp } : {}) },
      });
      const target = new URL(result.redirectUrl);
      if (target.protocol !== "cryptosightai:" || target.host !== "auth")
        throw new Error("invalid_mobile_redirect");
      setRedirect(target.href);
      location.assign(target.href);
    } catch (e: any) {
      setError(
        e.message === "invalid_totp"
          ? t("err_invalid_totp")
          : t("mobileConnectExpired"),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="mobile-connect-page">
      <section className="form-card mobile-connect-card">
        <a className="brand" href="/">
          CryptoSight <b>AI</b>
        </a>
        <h1>{t("mobileConnectTitle")}</h1>
        <p>{t("mobileConnectHint")}</p>
        {error && (
          <p role="alert" className="negative">
            {error}
          </p>
        )}
        {!me && !error && <p role="status">{t("loading")}</p>}
        {me && !redirect && (
          <>
            <p>
              <strong>{me.email || me.wallet_address}</strong>
            </p>
            <p className="muted">
              {t("mobileConnectExpiry")}{" "}
              {new Date(expires).toLocaleTimeString()}
            </p>
            {me.two_factor && (
              <label className="field">
                <span>{t("totpCode")}</span>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={totp}
                  onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
                />
              </label>
            )}
            <Button
              disabled={busy || (me.two_factor && totp.length !== 6)}
              onClick={approve}
            >
              {t("mobileConnectAction")}
            </Button>
          </>
        )}
        {redirect && (
          <>
            <p role="status">{t("mobileConnectSuccess")}</p>
            <a className="button" href={redirect}>
              {t("mobileConnectOpen")}
            </a>
          </>
        )}
        <a className="text-button" href="/">
          {t("cancel")}
        </a>
      </section>
    </main>
  );
}
export default function MobileConnectPage() {
  const [locale, setLocale] = useState<"en" | "pl" | "de">("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("locale");
      if (saved === "pl" || saved === "de") setLocale(saved);
    } catch {}
  }, []);
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={catalogs[locale]}
      timeZone="UTC"
    >
      <Connect />
    </NextIntlClientProvider>
  );
}
