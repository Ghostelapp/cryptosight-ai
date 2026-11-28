import type { Guide } from "./knowledge";
import type { PublicLocale } from "./public-routes";

const pl = {
  homeLabel: "Strona główna",
  navigation: "Menu główne",
  footer: "Informacje o serwisie",
  language: "Język",
  skip: "Przejdź do treści",
  terminal: "Terminal",
  openTerminal: "Otwórz terminal",
  about: "O projekcie",
  methodology: "Metodologia",
  contact: "Kontakt",
  privacy: "Prywatność i cookies",
  terms: "Regulamin",
  knowledge: "Baza wiedzy",
  knowledgeIntro:
    "Praktyczne przewodniki po analizie rynku krypto. Każdy temat zawiera przykład i zadanie do samodzielnego sprawdzenia.",
  knowledgeDescription:
    "Poradniki o świecach OHLCV, płynności, wielkości pozycji, handlu symulowanym, testach historycznych i weryfikacji analiz AI.",
  homeTitle: "Analiza rynku krypto i baza wiedzy",
  homeDescription:
    "Poradniki o wykresach krypto, płynności i ryzyku. Poznaj terminal do obserwacji rynku, weryfikacji raportów AI i symulacji handlu.",
  heroKicker: "Terminal analityczny i baza wiedzy",
  heroTitle: "Analiza rynku krypto",
  heroAccent: "od wykresu do wniosku.",
  heroIntro:
    "Czytaj wykresy, weryfikuj raporty AI i testuj scenariusze w symulatorze. Poradniki pokazują obliczenia krok po kroku.",
  readGuides: "Czytaj poradniki",
  features: "Narzędzia terminala",
  chartsTitle: "Wykresy rynkowe",
  chartsBody:
    "Porównuj interwały, zaznaczaj poziomy i sprawdzaj wolumen na danych z obsługiwanych giełd.",
  reportsTitle: "Raporty AI",
  reportsBody:
    "Sprawdzaj, jakie dane i obserwacje stoją za wnioskami raportu oraz których danych brakuje.",
  simulatorTitle: "Symulacja handlu",
  simulatorBody:
    "Ćwicz zlecenia, sprawdzaj koszty i oceniaj wyniki w dzienniku papierowych transakcji.",
  firstGuides: "Poradniki na dobry start",
  firstGuidesIntro:
    "Przykłady i obliczenia, które możesz odtworzyć samodzielnie.",
  allGuides: "Wszystkie poradniki",
  dataTitle: "Skąd biorą się dane i wnioski?",
  dataBody:
    "Dane rynkowe zależą od wybranej giełdy, pary i interwału. W metodologii pokazujemy, jak odczytywać znaczniki czasu, oceniać luki i sprawdzać przesłanki raportów AI.",
  readMethodology: "Przeczytaj metodologię",
  chartLoading: "Ładowanie notowań",
  chartLive: "Na żywo",
  chartSnapshot: "Ostatnie notowania",
  chartUnavailable: "Dane niedostępne",
  sitemap: "Mapa strony",
  sitemapIntro: "Przeglądaj wszystkie poradniki i podstrony CryptoSight AI.",
  candles: "Świece OHLC",
  readChart: "Jak czytać wykres",
  readGuide: "Przeczytaj poradnik",
  byline: "Redakcja CryptoSight AI",
  practice: "Sprawdź samodzielnie",
  sources: "Źródła i dokumentacja",
  riskNote:
    "Przykłady mają charakter edukacyjny. Obrót kryptoaktywami wiąże się z ryzykiem utraty środków.",
  related: "Kolejne poradniki",
  ad: "Reklama",
  categories: {
    Wykresy: "Wykresy",
    Rynek: "Rynek",
    Ryzyko: "Ryzyko",
    Symulacja: "Symulacja",
    "Analiza AI": "Analiza AI",
  },
};

type PublicCopy = Record<Exclude<keyof typeof pl, "categories">, string> & {
  categories: Record<Guide["category"], string>;
};

export const publicCopy: Record<PublicLocale, PublicCopy> = {
  pl,
  en: {
    homeLabel: "Home",
    navigation: "Main navigation",
    footer: "Site information",
    language: "Language",
    skip: "Skip to content",
    terminal: "Terminal",
    openTerminal: "Open the terminal",
    about: "About",
    methodology: "Methodology",
    contact: "Contact",
    privacy: "Privacy and cookies",
    terms: "Terms",
    knowledge: "Knowledge base",
    knowledgeIntro:
      "Practical guides to crypto market analysis. Each guide includes a worked example and an exercise you can try yourself.",
    knowledgeDescription:
      "Guides to OHLCV candles, liquidity, position sizing, paper trading, backtesting and verifying AI analyses.",
    homeTitle: "Crypto market analysis and knowledge base",
    homeDescription:
      "Guides to crypto charts, liquidity and risk. Explore the terminal for tracking markets, verifying AI reports and simulating trades.",
    heroKicker: "Market analysis terminal and knowledge base",
    heroTitle: "Crypto market analysis",
    heroAccent: "from chart to conclusion.",
    heroIntro:
      "Read charts, verify AI reports and test scenarios in the simulator. The guides walk you through the calculations.",
    readGuides: "Read the guides",
    features: "Terminal tools",
    chartsTitle: "Market charts",
    chartsBody:
      "Compare timeframes, mark price levels and inspect volume from supported exchanges.",
    reportsTitle: "AI reports",
    reportsBody:
      "See which observations support a report’s conclusions and which data is missing.",
    simulatorTitle: "Paper trading",
    simulatorBody:
      "Practice placing orders, measure costs and evaluate results in a paper trading journal.",
    firstGuides: "Guides to get started",
    firstGuidesIntro: "Examples and calculations you can reproduce.",
    allGuides: "All guides",
    dataTitle: "Where do the data and conclusions come from?",
    dataBody:
      "Market data depends on the exchange, pair and timeframe. Our methodology explains how to read timestamps, evaluate gaps and check the evidence behind AI reports.",
    readMethodology: "Read the methodology",
    chartLoading: "Loading market data",
    chartLive: "Live",
    chartSnapshot: "Last available quotes",
    chartUnavailable: "Data unavailable",
    sitemap: "Sitemap",
    sitemapIntro: "Browse all CryptoSight AI guides and pages.",
    candles: "OHLC candles",
    readChart: "How to read the chart",
    readGuide: "Read the guide",
    byline: "CryptoSight AI editorial team",
    practice: "Try it yourself",
    sources: "Sources and documentation",
    riskNote:
      "Examples are for educational purposes. Trading crypto-assets involves the risk of losing funds.",
    related: "More guides",
    ad: "Advertisement",
    categories: {
      Wykresy: "Charts",
      Rynek: "Markets",
      Ryzyko: "Risk",
      Symulacja: "Simulation",
      "Analiza AI": "AI analysis",
    },
  },
  de: {
    homeLabel: "Startseite",
    navigation: "Hauptnavigation",
    footer: "Informationen zur Website",
    language: "Sprache",
    skip: "Zum Inhalt springen",
    terminal: "Terminal",
    openTerminal: "Terminal öffnen",
    about: "Über uns",
    methodology: "Methodik",
    contact: "Kontakt",
    privacy: "Datenschutz und Cookies",
    terms: "Nutzungsbedingungen",
    knowledge: "Wissensbasis",
    knowledgeIntro:
      "Praxisleitfäden zur Analyse von Kryptomärkten. Jeder Beitrag enthält ein Rechenbeispiel und eine Übung zum Ausprobieren.",
    knowledgeDescription:
      "Leitfäden zu OHLCV-Kerzen, Liquidität, Positionsgröße, Paper Trading, Backtesting und der Prüfung von KI-Analysen.",
    homeTitle: "Kryptomarktanalyse und Wissensbasis",
    homeDescription:
      "Leitfäden zu Kryptocharts, Liquidität und Risiko. Entdecke das Terminal zur Marktbeobachtung, Prüfung von KI-Berichten und Handelssimulation.",
    heroKicker: "Analyseterminal und Wissensbasis",
    heroTitle: "Kryptomärkte analysieren",
    heroAccent: "vom Chart zur Einschätzung.",
    heroIntro:
      "Lies Charts, prüfe KI-Berichte und teste Szenarien im Simulator. Die Leitfäden zeigen dir die Berechnungen Schritt für Schritt.",
    readGuides: "Leitfäden lesen",
    features: "Werkzeuge im Terminal",
    chartsTitle: "Marktcharts",
    chartsBody:
      "Vergleiche Zeitintervalle, markiere Kursniveaus und prüfe das Volumen unterstützter Börsen.",
    reportsTitle: "KI-Berichte",
    reportsBody:
      "Prüfe, welche Beobachtungen die Schlussfolgerungen stützen und welche Daten fehlen.",
    simulatorTitle: "Paper Trading",
    simulatorBody:
      "Übe mit verschiedenen Ordertypen, prüfe Kosten und bewerte die Ergebnisse im Handelsjournal.",
    firstGuides: "Leitfäden für den Einstieg",
    firstGuidesIntro: "Beispiele und Berechnungen zum Nachvollziehen.",
    allGuides: "Alle Leitfäden",
    dataTitle: "Woher stammen Daten und Schlussfolgerungen?",
    dataBody:
      "Marktdaten hängen von Börse, Handelspaar und Intervall ab. In der Methodik erfährst du, wie du Zeitstempel liest, Datenlücken bewertest und KI-Berichte überprüfst.",
    readMethodology: "Methodik lesen",
    chartLoading: "Marktdaten werden geladen",
    chartLive: "Live",
    chartSnapshot: "Letzte verfügbare Kurse",
    chartUnavailable: "Daten nicht verfügbar",
    sitemap: "Seitenübersicht",
    sitemapIntro:
      "Hier findest du alle Leitfäden und Seiten von CryptoSight AI.",
    candles: "OHLC-Kerzen",
    readChart: "So liest du den Chart",
    readGuide: "Leitfaden lesen",
    byline: "Redaktion von CryptoSight AI",
    practice: "Selbst ausprobieren",
    sources: "Quellen und Dokumentation",
    riskNote:
      "Die Beispiele dienen der Weiterbildung. Beim Handel mit Kryptowerten kannst du Geld verlieren.",
    related: "Weitere Leitfäden",
    ad: "Anzeige",
    categories: {
      Wykresy: "Charts",
      Rynek: "Märkte",
      Ryzyko: "Risiko",
      Symulacja: "Simulation",
      "Analiza AI": "KI-Analyse",
    },
  },
};
