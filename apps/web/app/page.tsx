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
    [preferencesLoaded, setPreferencesLoaded] = useState(false);
  useEffect(() => {
    const l = localStorage.getItem("locale");
    if (l && l in messages) setLocale(l as any);
    const th = localStorage.getItem("theme");
    if (th === "light") setTheme(th);
    setPreferencesLoaded(true);
  }, []);
  useEffect(() => {
    if (!preferencesLoaded) return;
    document.documentElement.lang = locale;
    localStorage.setItem("locale", locale);
  }, [locale, preferencesLoaded]);
  useEffect(() => {
    if (!preferencesLoaded) return;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme, preferencesLoaded]);
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
