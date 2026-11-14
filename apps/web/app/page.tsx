"use client";
import { useEffect, useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import en from "../messages/en.json";
import pl from "../messages/pl.json";
import de from "../messages/de.json";
import { Terminal } from "../components/terminal";
const messages = { en, pl, de };
export default function Home() {
  const [locale, setLocale] = useState<"en" | "pl" | "de">("en"),
    [theme, setTheme] = useState("dark"),
    [preferencesReady, setPreferencesReady] = useState(false);
  useEffect(() => {
    try {
      const l = localStorage.getItem("locale");
      if (l === "en" || l === "pl" || l === "de") setLocale(l);
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
