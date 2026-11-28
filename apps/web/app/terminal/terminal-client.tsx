"use client";
import { useEffect, useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import pl from "../../messages/pl.json";
import de from "../../messages/de.json";
import { Terminal } from "../../components/terminal";
import { isPublicLocale, type PublicLocale } from "../../lib/public-routes";
const messages = { en, pl, de };
export default function TerminalClient() {
  const [locale, setLocale] = useState<PublicLocale>("en"),
    [theme, setTheme] = useState("dark"),
    [preferencesReady, setPreferencesReady] = useState(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    const requestedLocale = url.searchParams.get("lang");
    if (isPublicLocale(requestedLocale)) {
      setLocale(requestedLocale);
      url.searchParams.delete("lang");
      window.history.replaceState(window.history.state, "", url);
    }
    try {
      const savedLocale = localStorage.getItem("locale");
      if (!isPublicLocale(requestedLocale) && isPublicLocale(savedLocale))
        setLocale(savedLocale);
      const th = localStorage.getItem("theme");
      if (th === "light") setTheme(th);
    } catch {
      /* Browser preferences are optional. */
    }
    setPreferencesReady(true);
  }, []);
  useEffect(() => {
    if (!preferencesReady) return;
    document.documentElement.lang = locale;
    try {
      localStorage.setItem("locale", locale);
    } catch {}
  }, [locale, preferencesReady]);
  useEffect(() => {
    if (!preferencesReady) return;
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }, [theme, preferencesReady]);
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages[locale]}
      timeZone="UTC"
    >
      <Terminal
        locale={locale}
        setLocale={setLocale}
        theme={theme}
        setTheme={setTheme}
      />
    </NextIntlClientProvider>
  );
}
