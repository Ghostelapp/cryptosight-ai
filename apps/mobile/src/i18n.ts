import en from "../../web/messages/en.json";
import pl from "../../web/messages/pl.json";
import de from "../../web/messages/de.json";
import type { Locale } from "./types";

const extra: Record<Locale, Record<string, string>> = {
  pl: {
    mobileWelcome: "Twój rynek. W Twojej kieszeni.",
    mobileSubtitle:
      "Wykresy, badania AI i symulacja transakcji na wspólnym koncie CryptoSight AI.",
    mobileServer: "Adres Twojego serwera",
    mobileConnect: "Połącz z serwerem",
    mobileDemo: "Obejrzyj przykładowy wykres",
    mobileDemoHint: "Dane syntetyczne. Analizy AI i transakcje są wyłączone.",
    mobileLocalHint: "Lokalny tryb testowy — połączenie HTTP.",
    mobileLogin: "Połącz konto",
    mobileLoginHint:
      "Zaloguj się w bezpiecznej przeglądarce, a następnie zatwierdź połączenie telefonu. Obsługiwane są istniejące metody logowania i TOTP.",
    mobileSigningIn: "Oczekiwanie na potwierdzenie w przeglądarce…",
    mobileSessionExpired: "Sesja wygasła. Połącz konto ponownie.",
    mobileLocked: "Twoja sesja jest zablokowana",
    mobileUnlock: "Odblokuj aplikację",
    mobileBiometric: "Blokada biometryczna",
    mobileBiometricHint:
      "Lokalna blokada Face ID / odciskiem palca po opuszczeniu aplikacji.",
    mobileBiometricUnavailable:
      "Skonfiguruj Face ID lub odcisk palca w ustawieniach telefonu.",
    mobileSetup: "Zmień serwer",
    mobileShare: "Udostępnij rynek",
    mobileLatest: "Ostatnie odświeżenie",
    mobileRefreshHint:
      "Notowania odświeżają się co 15 s, gdy ekran jest aktywny.",
    mobileNoQuotes:
      "Brak świeżych notowań. Odśwież dane lub wybierz innego dostawcę.",
    mobile_network_error: "Brak połączenia z serwerem. Sprawdź adres i sieć.",
    mobile_invalid_response:
      "Serwer zwrócił nieprawidłową odpowiedź. Sprawdź wdrożenie API.",
    mobile_invalid_server:
      "Podaj sam adres HTTPS serwera. Lokalny HTTP jest dostępny tylko w wersji testowej.",
    mobile_login_failed:
      "Nie udało się potwierdzić logowania. Spróbuj ponownie.",
    mobile_request_expired: "Żądanie logowania wygasło. Rozpocznij ponownie.",
    mobile_request_used:
      "To połączenie zostało już zatwierdzone. Rozpocznij nowe logowanie.",
    mobile_server_origin:
      "Adres aplikacji nie zgadza się z APP_ORIGIN na serwerze.",
    mobilePaperConfirm: "Potwierdź zlecenie w symulacji",
    mobileCloseConfirm: "Potwierdź zamknięcie pozycji w symulacji",
    mobileNoRealOrders: "Środki są wirtualne. Zlecenie nie trafi na giełdę.",
    mobileExport: "Udostępnij CSV",
    mobileAlerts: "Alerty cenowe",
    mobileAlertCreate: "Dodaj alert",
    mobileDataStale:
      "Dane są nieaktualne. Odśwież je przed wysłaniem zlecenia.",
    mobileAiHint:
      "Dodaj swój klucz na koncie i wybierz agenta udostępnionego przez administratora. Analizy wykonuje serwer.",
    mobileProviderKey: "Zapisz klucz dostawcy",
    mobileModelHint: "Wpisz rzeczywisty identyfikator modelu",
    mobileNoAgent: "Własny klucz i model",
    mobileConfirmLogout: "Wylogować tę aplikację?",
    mobileDeleteTitle: "Usunięcie konta",
    mobileDeleteHint:
      "To trwale usuwa konto i jego dane. Wpisz DELETE, aby potwierdzić.",
    mobileDeleteAdmin:
      "Administrator musi najpierw przekazać rolę w panelu webowym.",
    mobileOpenWeb: "Otwórz pełny terminal",
    mobileConnected: "Serwer połączony",
    mobileSample: "DANE PRZYKŁADOWE",
    mobileCancelled: "Logowanie anulowano.",
    mobileSaved: "Zapisano.",
    mobileSelectedCandle: "Wybrana świeca",
    mobilePrivate: "Dostępne po połączeniu konta",
    mobileAllMarkets: "Rynek",
    mobileAnalysis: "Analiza",
    mobileAccount: "Konto",
    mobileExchangeHint: "Wybierz parę",
    mobileRequired: "Sprawdź wymagane pola.",
  },
  en: {
    mobileWelcome: "Your market. In your pocket.",
    mobileSubtitle:
      "Charts, AI research and paper trading on your shared CryptoSight AI account.",
    mobileServer: "Your server address",
    mobileConnect: "Connect to server",
    mobileDemo: "Explore a sample chart",
    mobileDemoHint: "Synthetic data. AI analysis and trading are disabled.",
    mobileLocalHint: "Local test mode — HTTP connection.",
    mobileLogin: "Connect account",
    mobileLoginHint:
      "Sign in using the secure browser, then approve connecting this phone. Existing sign-in methods and TOTP are supported.",
    mobileSigningIn: "Waiting for approval in the browser…",
    mobileSessionExpired: "Your session expired. Connect your account again.",
    mobileLocked: "Your session is locked",
    mobileUnlock: "Unlock app",
    mobileBiometric: "Biometric lock",
    mobileBiometricHint:
      "Local Face ID / fingerprint lock when you leave the app.",
    mobileBiometricUnavailable:
      "Set up Face ID or a fingerprint in your phone settings.",
    mobileSetup: "Change server",
    mobileShare: "Share market",
    mobileLatest: "Last refreshed",
    mobileRefreshHint:
      "Quotes refresh every 15 seconds while this screen is active.",
    mobileNoQuotes:
      "Fresh quotes are unavailable. Refresh or choose another provider.",
    mobile_network_error:
      "Cannot reach the server. Check the address and network.",
    mobile_invalid_response:
      "The server returned an invalid response. Check the API deployment.",
    mobile_invalid_server:
      "Enter only the server HTTPS origin. Local HTTP is available in test builds only.",
    mobile_login_failed: "Sign-in verification failed. Please try again.",
    mobile_request_expired: "The sign-in request expired. Start again.",
    mobile_request_used:
      "This connection was already approved. Start a new sign-in.",
    mobile_server_origin:
      "The app address does not match APP_ORIGIN on the server.",
    mobilePaperConfirm: "Confirm paper order",
    mobileCloseConfirm: "Confirm paper position close",
    mobileNoRealOrders: "Funds are virtual. No order is sent to an exchange.",
    mobileExport: "Share CSV",
    mobileAlerts: "Price alerts",
    mobileAlertCreate: "Create alert",
    mobileDataStale: "The data is stale. Refresh before placing an order.",
    mobileAiHint:
      "Save your key on your account and choose an administrator-published agent. Analysis runs on the server.",
    mobileProviderKey: "Save provider key",
    mobileModelHint: "Enter a real model identifier",
    mobileNoAgent: "Personal key and model",
    mobileConfirmLogout: "Sign out of this app?",
    mobileDeleteTitle: "Delete account",
    mobileDeleteHint:
      "This permanently deletes the account and its data. Enter DELETE to confirm.",
    mobileDeleteAdmin:
      "An administrator must first transfer the role in the web panel.",
    mobileOpenWeb: "Open full terminal",
    mobileConnected: "Server connected",
    mobileSample: "SAMPLE DATA",
    mobileCancelled: "Sign-in cancelled.",
    mobileSaved: "Saved.",
    mobileSelectedCandle: "Selected candle",
    mobilePrivate: "Connect your account to use this feature",
    mobileAllMarkets: "Markets",
    mobileAnalysis: "Analysis",
    mobileAccount: "Account",
    mobileExchangeHint: "Choose a pair",
    mobileRequired: "Check the required fields.",
  },
  de: {
    mobileWelcome: "Dein Markt. In deiner Tasche.",
    mobileSubtitle:
      "Charts, KI-Recherche und Paper Trading mit deinem gemeinsamen CryptoSight AI Konto.",
    mobileServer: "Adresse deines Servers",
    mobileConnect: "Mit Server verbinden",
    mobileDemo: "Beispielchart ansehen",
    mobileDemoHint:
      "Synthetische Daten. KI-Analyse und Handel sind deaktiviert.",
    mobileLocalHint: "Lokaler Testmodus — HTTP-Verbindung.",
    mobileLogin: "Konto verbinden",
    mobileLoginHint:
      "Melde dich im sicheren Browser an und bestätige die Verbindung dieses Telefons. Bestehende Anmeldemethoden und TOTP werden unterstützt.",
    mobileSigningIn: "Warten auf die Bestätigung im Browser…",
    mobileSessionExpired:
      "Deine Sitzung ist abgelaufen. Verbinde dein Konto erneut.",
    mobileLocked: "Deine Sitzung ist gesperrt",
    mobileUnlock: "App entsperren",
    mobileBiometric: "Biometrische Sperre",
    mobileBiometricHint:
      "Lokale Face-ID-/Fingerabdrucksperre beim Verlassen der App.",
    mobileBiometricUnavailable:
      "Richte Face ID oder einen Fingerabdruck in den Telefoneinstellungen ein.",
    mobileSetup: "Server wechseln",
    mobileShare: "Markt teilen",
    mobileLatest: "Zuletzt aktualisiert",
    mobileRefreshHint:
      "Kurse werden bei aktivem Bildschirm alle 15 Sekunden aktualisiert.",
    mobileNoQuotes:
      "Keine aktuellen Kurse. Aktualisiere die Daten oder wähle einen anderen Anbieter.",
    mobile_network_error:
      "Server nicht erreichbar. Prüfe Adresse und Netzwerk.",
    mobile_invalid_response:
      "Der Server hat eine ungültige Antwort geliefert. Prüfe die API-Bereitstellung.",
    mobile_invalid_server:
      "Gib nur die HTTPS-Adresse des Servers ein. Lokales HTTP ist nur in Testversionen verfügbar.",
    mobile_login_failed:
      "Die Anmeldeprüfung ist fehlgeschlagen. Versuche es erneut.",
    mobile_request_expired: "Die Anmeldeanfrage ist abgelaufen. Starte erneut.",
    mobile_request_used:
      "Diese Verbindung wurde bereits bestätigt. Starte eine neue Anmeldung.",
    mobile_server_origin:
      "Die App-Adresse stimmt nicht mit APP_ORIGIN auf dem Server überein.",
    mobilePaperConfirm: "Paper-Order bestätigen",
    mobileCloseConfirm: "Schließen der Paper-Position bestätigen",
    mobileNoRealOrders:
      "Das Guthaben ist virtuell. Es wird keine Order an eine Börse gesendet.",
    mobileExport: "CSV teilen",
    mobileAlerts: "Preisalarme",
    mobileAlertCreate: "Alarm erstellen",
    mobileDataStale: "Die Daten sind veraltet. Vor einer Order aktualisieren.",
    mobileAiHint:
      "Schlüssel und Modelle werden im Konto konfiguriert. Der Server führt Analysen aus; die App zeigt Ergebnisse.",
    mobileProviderKey: "Anbieterschlüssel speichern",
    mobileModelHint: "Gültige Modellkennung eingeben",
    mobileNoAgent: "Eigener Schlüssel und Modell",
    mobileConfirmLogout: "Von dieser App abmelden?",
    mobileDeleteTitle: "Konto löschen",
    mobileDeleteHint:
      "Das Konto und seine Daten werden dauerhaft gelöscht. Gib zur Bestätigung DELETE ein.",
    mobileDeleteAdmin:
      "Ein Administrator muss die Rolle zuerst im Webpanel übertragen.",
    mobileOpenWeb: "Vollständiges Terminal öffnen",
    mobileConnected: "Server verbunden",
    mobileSample: "BEISPIELDATEN",
    mobileCancelled: "Anmeldung abgebrochen.",
    mobileSaved: "Gespeichert.",
    mobileSelectedCandle: "Ausgewählte Kerze",
    mobilePrivate: "Verbinde dein Konto für diese Funktion",
    mobileAllMarkets: "Märkte",
    mobileAnalysis: "Analyse",
    mobileAccount: "Konto",
    mobileExchangeHint: "Paar auswählen",
    mobileRequired: "Prüfe die Pflichtfelder.",
  },
};
export type Translate = (key: string) => string;
export function translator(locale: Locale): Translate {
  const base = { pl, en, de }[locale] as Record<string, string>;
  return (key) =>
    extra[locale][key] ||
    base[key] ||
    (en as Record<string, string>)[key] ||
    key;
}
export function errorText(t: Translate, error: unknown) {
  const code = error instanceof Error ? error.message : "mobile_network_error";
  const prefixed = t("err_" + code);
  if (prefixed !== "err_" + code) return prefixed;
  const plain = t(code);
  return plain !== code ? plain : t("errors");
}
export function number(locale: Locale, value: unknown, digits = 2) {
  return value == null || !Number.isFinite(Number(value))
    ? "—"
    : new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(
        Number(value),
      );
}
