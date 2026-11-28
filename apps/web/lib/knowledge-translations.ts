import type { Guide } from "./knowledge";
import type { GuideId } from "./public-routes";

export type GuideCopy = Pick<
  Guide,
  "title" | "summary" | "sections" | "example" | "takeaway"
> & { sourceLabels: string[] };

export const englishGuides: Record<GuideId, GuideCopy> = {
  "swiece-ohlcv": {
    title: "How to read OHLCV candlesticks",
    summary:
      "Read the opening and closing prices, extremes and volume. See how the picture changes with the timeframe.",
    sections: [
      {
        title: "What does one candle record?",
        paragraphs: [
          "An exchange may record hundreds of trades in an hour. A candle shows the first price (Open), highest price (High), lowest price (Low) and last price (Close) over its interval. The body joins the open and close, and the wicks show the extremes. Green usually means the candle closed above its opening price, although platforms often let you change the palette.",
          "V stands for volume. Check whether the provider reports units of the base asset or value in the quote currency. Compare volume for the same pair and market in the same unit.",
        ],
      },
      {
        title: "Open and closed candles answer different questions",
        paragraphs: [
          "A 15-minute candle viewed at 12:07 is still forming. Its close is known when the interval ends at 12:15. If you compare indicator readings or evaluate a backtest rule, closed candles provide a reproducible point of reference.",
          "An hourly candle combines four quarters of an hour and loses their sequence. A wick shows the price reached. Finer-grained data is needed to tell whether the high occurred before the low.",
        ],
      },
      {
        title: "Check the market and data quality",
        paragraphs: [
          "Before comparing charts, note the exchange, pair, market type, timeframe and date range. Spot BTC/USDT and a contract on the same pair can move differently. A gap may also reflect a provider outage. Verify trade history or check the same market at the source before interpreting the gap.",
        ],
      },
    ],
    example: {
      title: "One candle in numbers",
      text: "Open 100, high 109, low 96 and close 104. The body is 4 units, the upper wick 5 and the lower wick 4. The full range is 13. A volume reading of 320 BTC separately describes activity on that market.",
    },
    takeaway:
      "In the terminal, switch the same pair from 15 minutes to one hour and compare the same closed period on both charts.",
    sourceLabels: [
      "Coinbase — chart view components",
      "CryptoSight AI — data and analysis methodology",
    ],
  },
  "spread-i-plynnosc": {
    title: "Spread, market depth and slippage",
    summary:
      "Read an order book and see why the last trade price can differ from your execution price.",
    sections: [
      {
        title: "Read both sides of the order book",
        paragraphs: [
          "The best bid is the highest visible buy price and the best ask is the lowest visible sell price. The spread is their difference. To compare instruments, divide that difference by the midpoint and multiply by 100 to get the percentage spread.",
          "A single price level shows the quantity available at that price. Market depth shows how much is available at additional levels too. Visible orders can be cancelled, so any snapshot describes a specific moment.",
        ],
      },
      {
        title: "Estimate the average execution price",
        paragraphs: [
          "A market order can consume more than one level when the best offer has insufficient quantity. Multiply each fill price by the quantity filled at that level, add the amounts and divide by total quantity. Slippage is the difference relative to a reference price. Record whether your reference was the best offer, the midpoint or an earlier price.",
          "A buy-limit order sets the highest acceptable price. If insufficient quantity is available, part of the order can remain open. A limit order that matches immediately may incur a taker fee under the exchange's rules.",
        ],
      },
      {
        title: "Compare like with like",
        paragraphs: [
          "Use the same order size and quote currency when comparing depth across exchanges, and record the time of each snapshot. Liquidity can shift after news or during less active periods. Add exchange fees separately to the execution price.",
        ],
      },
    ],
    example: {
      title: "Buying four units",
      text: "The best bid is 99.80 and the ask is 100.20. The spread is 0.40, or 0.40% of the midpoint. Buying two units at 100.20 and two more at 100.50 gives an average of 100.35 before fees. Slippage relative to the best ask is 0.15 per unit.",
    },
    takeaway:
      "Write down the best offers and the quantities at the next two levels. Calculate how doubling the test order size affects the average price.",
    sourceLabels: [
      "Coinbase — the order book view",
      "Coinbase — maker and taker fees",
    ],
  },
  "wielkosc-pozycji": {
    title: "How to calculate position size in a simulation",
    summary:
      "Convert a risk budget into a number of units and check how costs and available capital affect the result.",
    sections: [
      {
        title: "Start with a loss budget",
        paragraphs: [
          "For a simulated long spot position, convert a percentage of capital into the amount the scenario can lose. In a model without leverage, subtract the assumed exit price from the entry price to obtain the difference per unit. A zero difference or an exit above the entry falls outside this loss formula.",
          "Add the estimated fees on both sides and any slippage not already included in the prices. Divide the loss budget by the estimated loss per unit. Round down to the market's quantity increment.",
        ],
      },
      {
        title: "Check whether you can fund the purchase",
        paragraphs: [
          "Limit the quantity to what the available balance can cover, including the entry fee. The distance to the exit describes the loss scenario, while the balance limits the amount available for the simulated purchase. A narrow distance increases the calculated quantity and can exceed the balance limit.",
          "Record the target price and the costs in the profitable scenario separately. A net reward-to-risk ratio compares two scenarios. To estimate expected value, you also need a credible estimate of how often each outcome occurs.",
        ],
      },
      {
        title: "Recalculate with a worse exit",
        paragraphs: [
          "A price gap or thin order book can yield a worse exit than assumed. Run another calculation with a wider price difference. Comparing the two results shows how much depends on the execution assumption.",
        ],
      },
    ],
    example: {
      title: "A loss budget of 20 currency units",
      text: "Capital is 4,000, the example loss budget is 0.5%, entry is 100 and exit is assumed at 96. Add 0.50 per unit for fees and slippage. The modeled loss is 4.50 per unit, and 20 ÷ 4.50 gives about 4.44 units, or 4 with an increment of one.",
    },
    takeaway:
      "Use the calculator to compare two slippage assumptions with the same budget. Record the currency, quantity increment and any costs already included in the prices.",
    sourceLabels: [
      "European supervisory authorities — crypto-asset risk warning",
      "CryptoSight AI — cost and risk methodology",
    ],
  },
  "paper-trading": {
    title: "How to evaluate a paper trading result",
    summary:
      "Plan a trial, record execution assumptions and calculate net results while accounting for unfilled orders.",
    sections: [
      {
        title: "Write down the rules before the trial",
        paragraphs: [
          "Choose one pair, timeframe and order type. Document your entry trigger, position sizing rule and exit conditions. Record when the decision was made and use only data available at that time. Save rule changes as a new version so earlier runs remain comparable.",
          "Log cancelled, open and partially filled orders. A list of closed positions alone hides how many signals failed to execute under the chosen rules.",
        ],
      },
      {
        title: "Measure net performance and execution quality",
        paragraphs: [
          "Net profit or loss is exit value minus entry value and fees. If a simulator already applies slippage to the fill price, subtracting it again understates the result. Compare total net performance, average outcome, maximum drawdown and the share of unfinished orders.",
          "CryptoSight AI records simulated fills and reserves funds. Automatic limit fills and protective exits depend on an active worker and available market data. The module documentation explains the execution model in detail.",
        ],
      },
      {
        title: "Test a second period and tougher conditions",
        paragraphs: [
          "Repeat the same rules on a later period before adjusting them. Compare sessions with different liquidity and try higher costs separately. If a rule only worked in one period or under optimistic execution, the second trial helps uncover which assumptions drove the result.",
        ],
      },
    ],
    example: {
      title: "Net result and fill rate",
      text: "Seven out of ten orders filled. Closed positions earned 18 before fees, and fees totaled 11, leaving a net result of +7. The journal should also show the 7/10 fill rate and the three unfilled orders.",
    },
    takeaway:
      "Create one market order and one limit order in the simulator. Compare their status, fill price and costs in the execution history.",
    sourceLabels: [
      "CryptoSight AI — paper trading model and limitations",
      "European supervisory authorities — crypto-asset risk warning",
    ],
  },
  "weryfikacja-analizy-ai": {
    title: "How to verify an AI market report",
    summary:
      "Check timestamps, evidence and invalidation criteria. Turn the report into a checklist of claims you can verify.",
    sections: [
      {
        title: "Identify the market and period",
        paragraphs: [
          "Record the ticker, exchange, market type and timeframes. Check the last closed candle's timestamp and the timestamps of the other inputs. A current chart may be paired with an earlier order-book or volume reading. That time difference affects how you interpret the report.",
          "CryptoSight AI can combine several timeframes and inputs from multiple sources. If a source is unavailable, check the data-quality and coverage information and note the gaps in your review.",
        ],
      },
      {
        title: "Verify each important claim",
        paragraphs: [
          "If a report claims a breakout, locate the level and candle and compare its high and closing price. If it mentions rising volume, find the reference period. Without that period the claim alone is insufficient to reproduce the conclusion.",
          "A generative model can present an inaccurate claim with convincing confidence. Write down the facts visible on the chart separately from the model's interpretation. Check important observations against the original market data.",
        ],
      },
      {
        title: "Decide what would prompt a second review",
        paragraphs: [
          "A useful note specifies when to recheck the premise. Examples are the next candle close, restored data from one provider or confirmation of the price on the same market. Keep the original reasoning in your journal and add the outcome under the conditions set in advance.",
        ],
      },
    ],
    example: {
      title: "A wick above the level",
      text: "The report says the candle closed above 105. The closed candle recorded a high of 107 and a close of 103. If the criterion was a close above 105, the available data does not confirm it. Evaluate the next candle using the same rule.",
    },
    takeaway:
      "Pick three specific claims from your next report. Record the source, time and verification result beside each one.",
    sourceLabels: [
      "NIST — Generative Artificial Intelligence Profile, section 2.2",
      "CryptoSight AI — data sources and report methodology",
    ],
  },
  "test-historyczny": {
    title: "How to run a reproducible backtest",
    summary:
      "Set the signal time, execution model and validation period so someone else can reproduce the result.",
    sections: [
      {
        title: "Specify when the rule can see the data",
        paragraphs: [
          "For a signal evaluated at the close of an hourly candle, the closing price is available after the hour ends. Document when the backtest is allowed to execute. Using an earlier price from the same candle for the fill introduces information from the future.",
          "Document the data source, time zone, treatment of missing data and indicator warm-up period. Decide how to handle incomplete candles before you look at performance.",
        ],
      },
      {
        title: "Set execution order and costs",
        paragraphs: [
          "If one candle touches both the profit target and the protective exit, OHLC alone cannot establish which came first. Use smaller timeframes or define a rule for ambiguous candles before testing. Count the cases in which that rule affects the result.",
          "Include costs and run a second scenario with less favorable fills. Report the number of trades, net outcome and maximum drawdown separately. A higher final balance can coexist with a long period of losses.",
        ],
      },
      {
        title: "Save the validation period for the end",
        paragraphs: [
          "Choose settings on one segment of history, then test them on a later, previously unused segment. Record each version you try. Tuning repeatedly on the validation segment makes it another training period and makes performance on new data harder to assess.",
        ],
      },
    ],
    example: {
      title: "Two levels inside one candle",
      text: "The simulation enters at 100, the protective exit is 95 and the target is 108. The next candle has a low of 94 and a high of 109. Establish the sequence from more detailed data or apply your documented ambiguity rule. Mark the case in the report.",
    },
    takeaway:
      "Keep the date ranges, candle source, cost settings and execution logic. Give another person the same inputs to see whether they can reproduce the test.",
    sourceLabels: [
      "CryptoSight AI — analysis engine methodology and assumptions",
      "CryptoSight AI — simulated execution model",
    ],
  },
};

export const germanGuides: Record<GuideId, GuideCopy> = {
  "swiece-ohlcv": {
    title: "Wie liest man OHLCV-Kerzen?",
    summary:
      "Lerne Eröffnung, Schlusskurs, Höchst- und Tiefstkurs sowie Volumen zu lesen und Zeitintervalle zu vergleichen.",
    sections: [
      {
        title: "Was zeigt eine Kerze?",
        paragraphs: [
          "In einer Stunde können an einer Börse Hunderte Geschäfte stattfinden. Eine Kerze zeigt den ersten Kurs (Open), den Höchstkurs (High), den Tiefstkurs (Low) und den letzten Kurs (Close) im gewählten Intervall. Der Körper verbindet Eröffnung und Schluss. Die Dochte markieren die Extremwerte. Grün steht in der Regel für einen höheren Schlusskurs, die Farben sind aber oft einstellbar.",
          "V steht für Volumen. Prüfe, ob der Anbieter Einheiten des Basiswerts oder einen Betrag in der Kurswährung ausweist. Vergleiche Volumen für dasselbe Paar, denselben Markt und dieselbe Einheit.",
        ],
      },
      {
        title:
          "Laufende und abgeschlossene Kerzen beantworten unterschiedliche Fragen",
        paragraphs: [
          "Um 12:07 Uhr verändert sich die laufende 15-Minuten-Kerze noch. Ihr Schlusskurs steht erst um 12:15 Uhr fest. Für den Vergleich von Indikatoren und für historische Tests liefern abgeschlossene Kerzen einen reproduzierbaren Bezugspunkt.",
          "Die Stundenkerze fasst vier Viertelstunden zusammen. Ihre zeitliche Abfolge geht dabei verloren. Der Docht zeigt, welchen Kurs der Markt erreicht hat. Für die Reihenfolge von Hoch und Tief brauchst du detailliertere Daten.",
        ],
      },
      {
        title: "Markt und Datenqualität prüfen",
        paragraphs: [
          "Notiere vor einem Vergleich die Börse, das Paar, die Marktart, das Intervall und den Zeitraum. Der BTC/USDT-Kassakurs und ein Kontrakt auf dasselbe Paar können unterschiedlich verlaufen. Eine Lücke kann auch durch einen Ausfall des Datenanbieters entstehen. Prüfe die Transaktionshistorie oder die Börsendaten, bevor du die Lücke interpretierst.",
        ],
      },
    ],
    example: {
      title: "Eine Kerze in Zahlen",
      text: "Eröffnung 100, Hoch 109, Tief 96 und Schluss 104. Der Körper misst 4 Einheiten, der obere Docht 5 und der untere 4. Die gesamte Spanne beträgt 13. Ein Volumen von 320 BTC beschreibt separat die Aktivität auf diesem Markt.",
    },
    takeaway:
      "Wechsle im Terminal für dasselbe Paar von 15 Minuten auf eine Stunde und vergleiche einen bereits abgeschlossenen Zeitraum in beiden Ansichten.",
    sourceLabels: [
      "Coinbase — Bestandteile der Chartansicht",
      "CryptoSight AI — Daten und Analysemethodik",
    ],
  },
  "spread-i-plynnosc": {
    title: "Spread, Markttiefe und Slippage",
    summary:
      "Lerne, das Orderbuch zu lesen und den letzten Handelskurs vom möglichen Ausführungskurs zu unterscheiden.",
    sections: [
      {
        title: "Beide Seiten des Orderbuchs lesen",
        paragraphs: [
          "Der beste Geldkurs ist das höchste sichtbare Kaufangebot. Der beste Briefkurs ist das niedrigste sichtbare Verkaufsangebot. Ihr Abstand ist der Spread. Für den Vergleich in Prozent teilst du den Abstand durch den Mittelwert beider Kurse und multiplizierst mit 100.",
          "Ein Kursniveau zeigt die dort verfügbare Menge. Die Markttiefe erfasst auch die Mengen auf weiteren Niveaus. Sichtbare Orders können storniert werden. Eine Momentaufnahme gilt deshalb für den erfassten Zeitpunkt.",
        ],
      },
      {
        title: "Durchschnittlichen Ausführungskurs schätzen",
        paragraphs: [
          "Eine Market-Order kann mehrere Preisstufen beanspruchen, wenn das beste Angebot für die gewünschte Menge nicht ausreicht. Multipliziere den Kurs jeder Ausführung mit der jeweiligen Menge. Teile die Summe durch die Gesamtmenge. Die Abweichung vom gewählten Vergleichskurs heißt Slippage. Halte fest, ob du das beste Angebot, die Mitte des Spreads oder einen früheren Kurs verwendest.",
          "Eine Kauforder mit Limit definiert den höchsten akzeptierten Kurs. Bei unzureichender Menge kann ein Teil offenbleiben. Eine sofort ausgeführte Limitorder kann nach den Regeln der Börse eine Taker-Gebühr auslösen.",
        ],
      },
      {
        title: "Vergleichbare Bedingungen wählen",
        paragraphs: [
          "Vergleiche Börsen mit derselben Ordergröße und Kurswährung. Notiere die Uhrzeit der Momentaufnahme. Nach Nachrichten oder in ruhigeren Phasen kann sich die Liquidität ändern. Die Börsengebühr rechnest du separat zum Ausführungskurs hinzu.",
        ],
      },
    ],
    example: {
      title: "Kauf von vier Einheiten",
      text: "Der beste Geldkurs liegt bei 99,80, der beste Briefkurs bei 100,20. Der Spread beträgt 0,40, also 0,40 % des Mittelkurses. Zwei Einheiten zu 100,20 und zwei zu 100,50 ergeben vor Gebühren einen Durchschnittskurs von 100,35. Gegenüber dem besten Briefkurs beträgt die Slippage 0,15 pro Einheit.",
    },
    takeaway:
      "Notiere das beste Angebot und die Mengen auf den nächsten beiden Preisstufen. Berechne, wie sich der durchschnittliche Kurs bei doppelter Testmenge verändert.",
    sourceLabels: [
      "Coinbase — Orderbuchansicht",
      "Coinbase — Maker- und Taker-Gebühren",
    ],
  },
  "wielkosc-pozycji": {
    title: "Wie berechnet man die Positionsgröße in einer Simulation?",
    summary:
      "Rechne ein Risikobudget in Einheiten um und prüfe, wie sich Kosten und verfügbares Kapital auswirken.",
    sections: [
      {
        title: "Ein Verlustbudget festlegen",
        paragraphs: [
          "Für eine simulierte Long-Position am Kassamarkt rechnest du einen Kapitalanteil in den möglichen Verlustbetrag des Szenarios um. Ohne Hebel ziehst du den angenommenen Ausstiegskurs vom Einstiegskurs ab. Ist die Differenz null oder liegt der Ausstieg über dem Einstieg, passt diese Verlustformel nicht.",
          "Addiere die geschätzten Gebühren für Ein- und Ausstieg sowie die noch nicht im Kurs enthaltene Slippage. Teile das Budget durch den geschätzten Verlust pro Einheit. Runde auf den zulässigen Mengenschritt ab.",
        ],
      },
      {
        title: "Verfügbares Guthaben berücksichtigen",
        paragraphs: [
          "Begrenze die Menge auf das, was dein Guthaben einschließlich Einstiegsgebühr deckt. Der Abstand zum Ausstieg beschreibt das Verlustszenario. Das Guthaben begrenzt die mögliche Kaufmenge. Ein enger Abstand erhöht die berechnete Menge und kann deshalb die Guthabengrenze überschreiten.",
          "Notiere den Zielkurs und die Kosten des Gewinnszenarios separat. Das Netto-Chance-Risiko-Verhältnis vergleicht zwei Szenarien. Für einen Erwartungswert brauchst du zusätzlich belastbare Eintrittshäufigkeiten.",
        ],
      },
      {
        title: "Mit einem schlechteren Ausstieg rechnen",
        paragraphs: [
          "Kurssprünge oder ein dünnes Orderbuch können zu einem schlechteren Ausstieg führen. Wiederhole die Rechnung mit einem größeren Kursabstand. Der Vergleich zeigt, welcher Teil des Ergebnisses von der Ausführungsannahme abhängt.",
        ],
      },
    ],
    example: {
      title: "Verlustbudget von 20 Währungseinheiten",
      text: "Das Kapital beträgt 4.000. Für die Übung setzen wir 0,5 % als Verlustbudget, 100 als Einstieg und 96 als Ausstieg an. Mit zusätzlichen Kosten von 0,50 pro Einheit beträgt der modellierte Verlust 4,50 pro Einheit. 20 ÷ 4,50 ergibt rund 4,44 Einheiten. Bei einem Mengenschritt von eins bleiben vier.",
    },
    takeaway:
      "Vergleiche im Rechner zwei Slippage-Annahmen bei gleichem Budget. Notiere Währung, Mengenschritt und die im Kurs bereits enthaltenen Kosten.",
    sourceLabels: [
      "Europäische Aufsichtsbehörden — Risikowarnung zu Kryptowerten",
      "CryptoSight AI — Kosten- und Risikomethodik",
    ],
  },
  "paper-trading": {
    title: "Wie bewertet man das Ergebnis beim Paper Trading?",
    summary:
      "Plane einen Test, dokumentiere die Ausführung und berücksichtige Gebühren sowie nicht ausgeführte Orders.",
    sections: [
      {
        title: "Regeln vor dem Test festhalten",
        paragraphs: [
          "Wähle ein Paar, ein Intervall und einen Ordertyp. Halte Einstiegssignal, Positionsgröße und Ausstiegsbedingungen fest. Notiere den Entscheidungszeitpunkt und verwende nur Daten, die zu diesem Zeitpunkt vorlagen. Speichere Änderungen als neue Version, damit frühere Reihen vergleichbar bleiben.",
          "Erfasse auch stornierte, offene und teilweise ausgeführte Orders. Eine Liste abgeschlossener Positionen verrät nicht, wie viele Signale nach den gewählten Regeln unausgeführt blieben.",
        ],
      },
      {
        title: "Nettoergebnis und Ausführungsqualität messen",
        paragraphs: [
          "Für das Nettoergebnis ziehst du vom Ausstiegswert den Einstiegswert und die Gebühren ab. Wenn der Simulator Slippage bereits im Ausführungskurs berücksichtigt, würde ein zweiter Abzug das Ergebnis zu niedrig ansetzen. Vergleiche das Gesamtergebnis, das durchschnittliche Ergebnis, den maximalen Drawdown und den Anteil der nicht abgeschlossenen Orders.",
          "CryptoSight AI führt eine Ausführungshistorie und reserviert virtuelle Mittel. Für automatische Limitausführungen und Schutzausstiege werden ein laufender Hintergrunddienst und verfügbare Marktdaten benötigt. Die Dokumentation erläutert das Modell.",
        ],
      },
      {
        title: "Weitere Zeiträume und schwierigere Bedingungen testen",
        paragraphs: [
          "Wiederhole dieselben Regeln für einen späteren Zeitraum, bevor du sie anpasst. Vergleiche unterschiedliche Liquiditätsphasen und teste höhere Kosten separat. So lässt sich besser beurteilen, ob das erste Ergebnis an bestimmten Bedingungen oder optimistischen Ausführungen lag.",
        ],
      },
    ],
    example: {
      title: "Nettoergebnis und Ausführungsquote",
      text: "Sieben von zehn Orders wurden ausgeführt. Die abgeschlossenen Positionen ergeben vor Gebühren +18, die Gebühren betragen 11. Damit bleibt netto +7. Im Journal sollten auch die Quote von 7/10 und die drei nicht ausgeführten Orders stehen.",
    },
    takeaway:
      "Lege im Simulator je eine Market- und Limitorder an. Vergleiche Status, Ausführungskurs und Kosten in der Historie.",
    sourceLabels: [
      "CryptoSight AI — Modell und Grenzen des Paper Tradings",
      "Europäische Aufsichtsbehörden — Risikowarnung zu Kryptowerten",
    ],
  },
  "weryfikacja-analizy-ai": {
    title: "Wie überprüft man einen KI-Marktbericht?",
    summary:
      "Prüfe Datenzeitpunkt, Belege und Bedingungen für eine Neubewertung. Formuliere Aussagen, die sich am Markt nachvollziehen lassen.",
    sections: [
      {
        title: "Markt und Zeitraum bestimmen",
        paragraphs: [
          "Halte Kürzel, Börse, Marktart und Intervalle fest. Prüfe den Zeitpunkt der letzten abgeschlossenen Kerze und die Zeitstempel der übrigen Daten. Ein aktueller Chart kann neben einem älteren Orderbuch- oder Volumenstand stehen. Der zeitliche Abstand beeinflusst die Beurteilung.",
          "CryptoSight AI kann mehrere Intervalle und Quellen kombinieren. Wenn ein Anbieter keine Daten liefert, sieh dir die Angaben zu Datenqualität und Abdeckung an und vermerke Lücken bei der Prüfung.",
        ],
      },
      {
        title: "Wichtige Aussagen einzeln prüfen",
        paragraphs: [
          "Behauptet der Bericht einen Ausbruch, suche das Niveau und die genannte Kerze. Vergleiche Hoch und Schlusskurs. Bei angeblich steigendem Volumen prüfe den Vergleichszeitraum. Ohne einen solchen Bezug lässt sich die Aussage allein aus dem Bericht nicht nachvollziehen.",
          "Ein generatives Modell kann falsche Aussagen überzeugend darstellen. Halte die im Chart nachvollziehbaren Fakten getrennt von der Deutung des Modells fest. Prüfe wichtige Beobachtungen zusätzlich in den ursprünglichen Marktdaten.",
        ],
      },
      {
        title: "Einen Anlass zur Neubewertung festlegen",
        paragraphs: [
          "Notiere, nach welchem Ereignis du erneut prüfst. Das kann der Abschluss der nächsten Kerze, die Rückkehr einer Datenquelle oder die Bestätigung des Kurses auf demselben Markt sein. Bewahre die ursprüngliche Begründung im Journal auf und ergänze das Ergebnis nach den vorher festgelegten Kriterien.",
        ],
      },
    ],
    example: {
      title: "Ein Docht oberhalb des Niveaus",
      text: "Der Bericht nennt einen Schluss über 105. Die Kerze hat ein Hoch von 107 und schließt bei 103. Wenn das Kriterium ein Schlusskurs über 105 war, bestätigen die Daten die Aussage nicht. Beurteile die nächste Kerze nach derselben Regel.",
    },
    takeaway:
      "Wähle aus dem nächsten Bericht drei konkrete Aussagen und notiere dazu jeweils Quelle, Uhrzeit und Prüfergebnis.",
    sourceLabels: [
      "NIST — Risikoprofil für generative KI, Abschnitt 2.2",
      "CryptoSight AI — Datenquellen und Berichtsmethodik",
    ],
  },
  "test-historyczny": {
    title: "Wie erstellt man einen reproduzierbaren Backtest?",
    summary:
      "Lege Signalzeitpunkt, Ausführungsmodell und Prüfzeitraum fest, damit sich das Ergebnis nachvollziehen lässt.",
    sections: [
      {
        title: "Verfügbarkeit der Daten festlegen",
        paragraphs: [
          "Bei einem Signal zum Schluss einer Stundenkerze ist der Schlusskurs erst nach Ablauf dieser Stunde bekannt. Lege fest, wann die simulierte Ausführung stattfinden darf. Wer einen früheren Kurs aus derselben Kerze für die Ausführung nutzt, verwendet Informationen aus der Zukunft.",
          "Dokumentiere Datenquelle, Zeitzone, Behandlung von Lücken und Anlaufzeit der Indikatoren. Lege vor der Auswertung fest, wie unvollständige Kerzen behandelt werden.",
        ],
      },
      {
        title: "Reihenfolge und Kosten modellieren",
        paragraphs: [
          "Berührt dieselbe Kerze sowohl Gewinnziel als auch Schutzausstieg, lässt sich aus OHLC allein die Reihenfolge nicht lesen. Verwende feinere Intervalle oder definiere vorab eine Regel für mehrdeutige Fälle. Zähle, wie oft diese Regel das Ergebnis beeinflusst.",
          "Berücksichtige Kosten und rechne eine zweite Variante mit ungünstigeren Ausführungen. Führe Anzahl der Trades, Nettoergebnis und maximalen Drawdown separat auf. Ein höheres Endkapital kann mit langen Verlustphasen einhergehen.",
        ],
      },
      {
        title: "Einen ungenutzten Prüfzeitraum zurückhalten",
        paragraphs: [
          "Wähle Einstellungen in einem historischen Abschnitt aus und prüfe sie anschließend an einem späteren, bisher ungenutzten Abschnitt. Halte alle Varianten fest. Wiederholtes Optimieren im Prüfzeitraum macht ihn zu einem weiteren Trainingsabschnitt und erschwert die Beurteilung an neuen Daten.",
        ],
      },
    ],
    example: {
      title: "Zwei Niveaus innerhalb einer Kerze",
      text: "Der simulierte Einstieg liegt bei 100, der Schutzausstieg bei 95 und das Ziel bei 108. Die nächste Kerze erreicht ein Tief von 94 und ein Hoch von 109. Kläre die Reihenfolge mit detaillierteren Daten oder nutze deine dokumentierte Regel für mehrdeutige Kerzen. Vermerke den Fall im Bericht.",
    },
    takeaway:
      "Halte Zeiträume, Kerzenquelle, Kosten und Ausführungsregeln fest. Bitte eine zweite Person, den Test mit denselben Angaben nachzustellen.",
    sourceLabels: [
      "CryptoSight AI — Methodik und Annahmen der Analyse-Engine",
      "CryptoSight AI — Ausführungsmodell des Simulators",
    ],
  },
};
