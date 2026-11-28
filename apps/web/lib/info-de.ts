import type { InfoCopy } from "./info-types";

export const germanInfo: InfoCopy = {
  about: {
    title: "Über CryptoSight AI",
    description:
      "Wofür CryptoSight AI gedacht ist, wer den Dienst betreibt und wie wir die Leitfäden erstellen.",
    sections: [
      {
        title: "Terminal und Wissensbasis",
        paragraphs: [
          "CryptoSight AI vereint Charts ausgewählter Börsen, Risikowerkzeuge, KI-Analysen und Handelssimulation. Die öffentliche Wissensbasis erklärt diese Werkzeuge anhand von Beispielen, die du ohne Konto nachvollziehen kannst.",
          "Das Terminal dient der Marktbeobachtung und Simulation. Orders im Simulator bleiben in der virtuellen Umgebung.",
        ],
      },
      {
        title: "Redaktionelle Grundsätze",
        paragraphs: [
          "Jeder Leitfaden erläutert seine Annahmen und enthält ein Beispiel und Quellen. Beispielwerte kennzeichnen wir getrennt von Live-Daten. Wenn du eine fehlerhafte Rechnung oder veraltete Quelle findest, sende uns den Link zum Beitrag und die betreffende Stelle.",
          [
            ["contact", "Korrektur melden"],
            " · ",
            ["methodology", "Methodik lesen"],
            " · ",
            ["repo", "Quellcode ansehen"],
          ],
        ],
      },
    ],
  },
  methodology: {
    title: "Methodik",
    description:
      "Datenquellen, Zeitstempel, Grenzen der KI und Annahmen des Simulators von CryptoSight AI.",
    sections: [
      {
        title: "Marktquellen und Zeitstempel",
        paragraphs: [
          "Das Terminal bezieht Kurse und Kerzen über die Schnittstellen unterstützter Börsen. Ergebnisse beziehen sich auf ein bestimmtes Handelspaar, die Marktart, das Intervall und den Zeitpunkt. Orderbuchdaten und ergänzende Informationen können einen anderen Zeitpunkt abbilden als der Kurs. Der Chart auf der Startseite und die Beispielzahlen in den Leitfäden dienen zum Üben.",
          "Bei Abweichungen prüfe denselben Markt an der Quelle und achte darauf, ob die Kerze abgeschlossen ist. Fehlende Daten können die Aussagekraft der Analyse einschränken.",
        ],
      },
      {
        title: "KI-generierte Berichte",
        paragraphs: [
          "Ein Bericht interpretiert die für die jeweilige Aufgabe verfügbaren Daten. Prüfe die Belege, den Zeitpunkt der Messung und die Angaben zur Datenqualität. Wenn Text und Chart voneinander abweichen, überprüfe die Börsendaten und dokumentiere, welche Schlüsse du nachvollziehen konntest.",
          [["analysisDocs", "Dokumentation der Analyse-Engine"]],
        ],
      },
      {
        title: "Annahmen der Simulation",
        paragraphs: [
          "Die Ergebnisse hängen vom Ausführungsmodell, der Liquidität und den angenommenen Kosten ab. Erfasse im Journal auch nicht ausgeführte Orders und Fälle, in denen die Daten keine Aussage über die Reihenfolge der Kurse erlauben. Ein historischer Test beschreibt das Ergebnis unter den gewählten Annahmen.",
          [["paperDocs", "Dokumentation zum Paper Trading"]],
        ],
      },
    ],
  },
  contact: {
    title: "Kontakt",
    description:
      "Melde einen Fehler im Leitfaden, ein technisches Problem oder ein Datenschutzanliegen.",
    sections: [
      { title: "Herausgeber und Kontakt", publisher: true },
      {
        title: "Was in die Meldung gehört",
        paragraphs: [
          "Nenne bei einer Korrektur die Adresse des Artikels, die betroffene Textstelle und gegebenenfalls eine Quelle. Bei technischen Fehlern helfen Browser, Zeitpunkt und Schritte zur Reproduktion. Passwörter, API-Schlüssel und Wiederherstellungsphrasen gehören nicht in die Meldung.",
          [
            "Fehler im öffentlichen Quellcode kannst du auch über ",
            ["issues", "GitHub Issues"],
            " melden. Anliegen zu deinem Konto oder personenbezogenen Daten richte direkt an die E-Mail-Adresse des Herausgebers.",
          ],
        ],
      },
    ],
  },
  privacy: {
    title: "Datenschutzerklärung und Cookies",
    description:
      "Informationen zu Kontodaten, Cookies, Dienstleistern, Werbung und deinen Rechten.",
    sections: [
      { title: "Datenschutzrechtlich Verantwortlicher", publisher: true },
      {
        title: "Besuche, Konto und Kontakt",
        paragraphs: [
          "Öffentliche Leitfäden sind ohne Konto verfügbar. Der Server kann IP-Adressen, Zeitpunkt und Pfad von Anfragen sowie technische Daten verarbeiten, um Seiten bereitzustellen, den Dienst abzusichern und Fehler zu untersuchen. Bei einer E-Mail-Anfrage verarbeiten wir deine Adresse und Nachricht, um zu antworten.",
          "Ein Konto kann E-Mail- oder verknüpfte Wallet-Adresse, Authentifizierungsdaten, Einstellungen, gespeicherte Analysen, Benachrichtigungen und Simulationsergebnisse umfassen. Eigene Schlüssel für KI-Anbieter werden verschlüsselt gespeichert. Bei einer Analyse erhält der ausgewählte Anbieter die zur Bearbeitung erforderlichen Daten. Hosting-, E-Mail-, Authentifizierungs- und Zahlungsdienstleister können Daten für die von ihnen unterstützten Funktionen verarbeiten.",
        ],
      },
      {
        title: "Rechtsgrundlagen und Speicherdauer",
        paragraphs: [
          "Kontodaten und Daten für ausgewählte Funktionen verarbeiten wir, soweit dies für die Bereitstellung des Dienstes erforderlich ist. Die Absicherung des Dienstes, die Bearbeitung von Anfragen und die Durchsetzung von Ansprüchen können auf berechtigten Interessen beruhen. Abrechnungspflichten oder rechtmäßige Anfragen können eine Verarbeitung aufgrund gesetzlicher Verpflichtungen erfordern. Wenn eine Funktion eine Einwilligung voraussetzt, kannst du diese für die Zukunft widerrufen.",
          "Kontodaten speichern wir für die Dauer der Kontoführung. Anfragen speichern wir, solange dies für die Beantwortung und den Abschluss des Vorgangs erforderlich ist. Gesetzliche Pflichten, Ansprüche oder Sicherungskopien können eine längere Speicherung erfordern. Je nach Bereitstellung und Vertragsbedingungen können Anbieter Daten außerhalb des EWR verarbeiten. Auskünfte zu Empfängern, Fristen und Schutzmaßnahmen erteilt der Verantwortliche.",
        ],
      },
      {
        title: "Cookies, Browserspeicher und Google AdSense",
        paragraphs: [
          "Das Terminal nutzt Sitzungs-Cookies zur Anmeldung und den Browserspeicher etwa für Sprache, Design und Chart-Einstellungen. Lokale Daten kannst du im Browser löschen. Ohne Sitzungs-Cookies kann die Anmeldung fehlschlagen.",
          "Wenn der Herausgeber Google AdSense aktiviert, können Google und Werbeanbieter auf ausgewählten Artikelseiten Cookies lesen oder setzen sowie IP-Adressen, Zählpixel und andere Kennungen nutzen. Diese Daten können der Anzeigenauslieferung, Messung, Missbrauchsverhinderung und je nach Einstellungen und Einwilligung der Personalisierung dienen. Wenn Googles Einwilligungsdialog verfügbar ist, kannst du deine Auswahl später über die Datenschutz- und Cookie-Einstellungen am Ende der Seite mit Werbung ändern.",
          "Der Chart auf der Startseite verbindet deinen Browser mit dem öffentlichen Marktdatendienst von Binance. Binance erhält technische Verbindungsdaten einschließlich der IP-Adresse. Der Chart verwendet öffentliche Kurse des Kassamarkts.",
          [
            [
              "partnerPrivacy",
              "Wie Google Daten auf Partner-Websites verwendet",
            ],
            " · ",
            ["adCenter", "Mein Anzeigen-Center von Google"],
          ],
        ],
      },
      {
        title: "Deine Rechte",
        paragraphs: [
          "Je nach Rechtsgrundlage und Umständen kannst du Auskunft, Berichtigung, Löschung, Einschränkung oder Datenübertragbarkeit verlangen und Widerspruch einlegen. Ein Widerruf der Einwilligung wirkt für die Zukunft. Du kannst dich bei der zuständigen Aufsichtsbehörde beschweren. In Polen ist dies der Präsident der Datenschutzbehörde UODO.",
          [
            ["contact", "Verantwortlichen kontaktieren"],
            " · ",
            ["uodo", "Polnische Datenschutzbehörde UODO"],
          ],
        ],
      },
    ],
  },
  terms: {
    title: "Nutzungsbedingungen",
    description:
      "Bedingungen für die Nutzung der Wissensbasis, des Terminals und des Handelssimulators.",
    sections: [
      { title: "Betreiber des Dienstes", publisher: true },
      {
        title: "Leistungsumfang und Voraussetzungen",
        paragraphs: [
          "Der Dienst umfasst öffentliche Leitfäden und ein Terminal mit Analyse- und Simulationsfunktionen. Du brauchst einen aktuellen Browser und einen Internetzugang. Für einzelne Funktionen können ein Konto, eine E-Mail-Adresse oder ein Wallet erforderlich sein. Die Datenverfügbarkeit hängt auch von externen Anbietern ab.",
        ],
      },
      {
        title: "Konto und Nutzung des Terminals",
        paragraphs: [
          "Schütze dein Konto und deine Zugangsdaten. Nutze den Dienst im Rahmen der Gesetze und respektiere die Rechte anderer. Das Umgehen von Sicherheitsmaßnahmen oder Limits sowie das Stören des Betriebs sind untersagt. In den Kontoeinstellungen kannst du Daten exportieren und löschen.",
        ],
      },
      {
        title: "Lernmaterialien und Risiko",
        paragraphs: [
          "Leitfäden, Analysen und Rechner dienen Bildungs- und Informationszwecken. KI-Berichte können Fehler enthalten. Marktdaten können verspätet oder unvollständig sein. Der Simulator verwendet virtuelle Mittel. Beispielergebnisse gelten unter den beschriebenen Annahmen. Beim Handel mit Kryptowerten besteht das Risiko von Verlusten.",
        ],
      },
      {
        title: "Meldungen und Datenschutz",
        paragraphs: [
          [
            "Melde Störungen und Beschwerden über die ",
            ["contact", "Kontaktseite des Herausgebers"],
            ". Beschreibe das Problem, den Zeitpunkt und eine Rückkontaktmöglichkeit. Die ",
            ["privacy", "Datenschutzerklärung und Cookie-Hinweise"],
            " erläutern die Datenverarbeitung.",
          ],
        ],
      },
    ],
  },
};
