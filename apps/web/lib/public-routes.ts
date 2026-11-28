export const publicLocales = ["pl", "en", "de"] as const;
export type PublicLocale = (typeof publicLocales)[number];

export const infoPaths = {
  about: { pl: "/o-projekcie", en: "/en/about", de: "/de/ueber-uns" },
  methodology: {
    pl: "/metodologia",
    en: "/en/methodology",
    de: "/de/methodik",
  },
  contact: { pl: "/kontakt", en: "/en/contact", de: "/de/kontakt" },
  privacy: { pl: "/prywatnosc", en: "/en/privacy", de: "/de/datenschutz" },
  terms: { pl: "/regulamin", en: "/en/terms", de: "/de/nutzungsbedingungen" },
};

export const knowledgePaths = {
  pl: "/wiedza",
  en: "/en/knowledge",
  de: "/de/wissen",
};

const guideSlugs = {
  "swiece-ohlcv": { en: "ohlcv-candlesticks", de: "ohlcv-kerzen" },
  "spread-i-plynnosc": {
    en: "spread-and-liquidity",
    de: "spread-und-liquiditaet",
  },
  "wielkosc-pozycji": { en: "position-sizing", de: "positionsgroesse" },
  "paper-trading": { en: "paper-trading", de: "paper-trading" },
  "weryfikacja-analizy-ai": {
    en: "verify-ai-analysis",
    de: "ki-analysen-pruefen",
  },
  "test-historyczny": { en: "backtesting", de: "backtesting" },
};

export type InfoId = keyof typeof infoPaths;
export type GuideId = keyof typeof guideSlugs;
export type PublicPage =
  | { kind: "home" }
  | { kind: "knowledge" }
  | { kind: "sitemap" }
  | { kind: "info"; id: InfoId }
  | { kind: "guide"; id: GuideId };

export const infoIds = Object.keys(infoPaths) as InfoId[];
export const guideIds = Object.keys(guideSlugs) as GuideId[];
export const homePage = { kind: "home" } as const;
export const knowledgePage = { kind: "knowledge" } as const;
export const publicPages: PublicPage[] = [
  homePage,
  knowledgePage,
  { kind: "sitemap" },
  ...infoIds.map((id) => ({ kind: "info" as const, id })),
  ...guideIds.map((id) => ({ kind: "guide" as const, id })),
];

export function isPublicLocale(value?: string | null): value is PublicLocale {
  return publicLocales.some((locale) => locale === value);
}

export function publicHref(locale: PublicLocale, page: PublicPage) {
  switch (page.kind) {
    case "home":
      return locale === "pl" ? "/" : `/${locale}`;
    case "knowledge":
      return knowledgePaths[locale];
    case "sitemap":
      return {
        pl: "/mapa-strony",
        en: "/en/sitemap",
        de: "/de/seitenuebersicht",
      }[locale];
    case "info":
      return infoPaths[page.id][locale];
    case "guide":
      return `${knowledgePaths[locale]}/${locale === "pl" ? page.id : guideSlugs[page.id][locale]}`;
  }
}

const publicRoutes = new Map(
  publicLocales.flatMap((locale) =>
    publicPages.map(
      (page) => [publicHref(locale, page), { locale, page }] as const,
    ),
  ),
);

export function matchPublicPath(pathname: string) {
  return publicRoutes.get(pathname);
}
