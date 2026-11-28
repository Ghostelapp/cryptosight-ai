import type { Metadata } from "next";
import {
  publicHref,
  publicLocales,
  type PublicLocale,
  type PublicPage,
} from "./public-routes";

export function publicOrigin() {
  try {
    const url = new URL(process.env.PUBLIC_ORIGIN ?? "");
    if (url.protocol === "https:" && url.hostname !== "localhost")
      return url.origin;
  } catch {
    // Local development does not expose public canonical URLs.
  }
}

export function publisherDetails() {
  const name = process.env.PUBLIC_OPERATOR_NAME?.trim();
  const address = process.env.PUBLIC_OPERATOR_ADDRESS?.trim();
  const email = process.env.PUBLIC_CONTACT_EMAIL?.trim();
  if (name && address && email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { name, address, email };
  }
}

export function adSensePublisher() {
  const value = process.env.ADSENSE_PUBLISHER_ID?.trim();
  return value && /^ca-pub-\d{16}$/.test(value) ? value : undefined;
}

export function adSenseConfig() {
  const publisher = adSensePublisher();
  const slot = process.env.ADSENSE_ARTICLE_SLOT?.trim();
  if (
    process.env.ADSENSE_ENABLED === "true" &&
    publicOrigin() &&
    publisherDetails() &&
    publisher &&
    slot &&
    /^\d+$/.test(slot)
  )
    return { publisher, slot };
}

export function publicAlternates(origin: string, page: PublicPage) {
  return Object.fromEntries([
    ...publicLocales.map((locale) => [
      locale,
      new URL(publicHref(locale, page), origin).href,
    ]),
    ["x-default", new URL(publicHref("pl", page), origin).href],
  ]);
}

export const publisherPages = new Set(["contact", "privacy", "terms"]);

export function publicMetadata(
  locale: PublicLocale,
  page: PublicPage,
  title: string,
  description: string,
): Metadata {
  const origin = publicOrigin();
  const canonical = origin
    ? new URL(publicHref(locale, page), origin).href
    : undefined;
  const openGraphLocales = { pl: "pl_PL", en: "en_US", de: "de_DE" };
  return {
    title: `${title} | CryptoSight AI`,
    description,
    alternates: origin
      ? { canonical, languages: publicAlternates(origin, page) }
      : undefined,
    twitter: { card: "summary", title, description },
    openGraph: {
      type: page.kind === "guide" ? "article" : "website",
      siteName: "CryptoSight AI",
      locale: openGraphLocales[locale],
      alternateLocale: publicLocales
        .filter((item) => item !== locale)
        .map((item) => openGraphLocales[item]),
      title,
      description,
      url: canonical,
    },
  };
}

export function terminalHref(locale: PublicLocale) {
  const origin = process.env.APP_ORIGIN || "http://localhost:3000";
  const url = new URL("/", origin);
  url.searchParams.set("lang", locale);
  return url.href;
}
