import type { InfoCopy } from "./info-types";

export const polishInfo: InfoCopy = {
  about: {
    title: "O projekcie",
    description:
      "Do czego służy CryptoSight AI, kto odpowiada za serwis i jak przygotowujemy poradniki.",
    sections: [
      {
        title: "Terminal i baza wiedzy",
        paragraphs: [
          "CryptoSight AI łączy wykresy z wybranych giełd, narzędzia do oceny ryzyka, analizy AI i symulację handlu. Publiczna baza wiedzy objaśnia te narzędzia na przykładach, które można odtworzyć bez zakładania konta.",
          "Terminal służy do obserwacji i symulacji. Zlecenia w symulatorze pozostają w systemie wirtualnym.",
        ],
      },
      {
        title: "Zasady publikacji",
        paragraphs: [
          "Każdy poradnik ma jawne założenia, przykład i źródła. Przykładowe liczby oddzielamy od danych na żywo. Jeśli widzisz błędne obliczenie lub nieaktualne źródło, wyślij adres artykułu i wskaż fragment wymagający sprawdzenia.",
          [
            ["contact", "Zgłoś poprawkę"],
            " · ",
            ["methodology", "Przeczytaj metodologię"],
            " · ",
            ["repo", "Zobacz kod projektu"],
          ],
        ],
      },
    ],
  },
  methodology: {
    title: "Metodologia",
    description:
      "Źródła danych, znaczniki czasu, ograniczenia modeli AI i założenia symulatora CryptoSight AI.",
    sections: [
      {
        title: "Źródła rynkowe i czas danych",
        paragraphs: [
          "Terminal pobiera notowania i świece z interfejsów obsługiwanych giełd. Wyniki odnosimy do konkretnej pary, typu rynku, interwału i czasu. Dane o arkuszu lub dodatkowy kontekst mogą być dostępne dla innego momentu niż cena. Przykładowy wykres na stronie głównej i liczby w poradnikach służą do ćwiczeń.",
          "Przy rozbieżności porównaj ten sam rynek u dostawcy i ustal, czy świeca jest zamknięta. Brak odczytu może ograniczyć zakres analizy.",
        ],
      },
      {
        title: "Raporty generowane przez AI",
        paragraphs: [
          "Raport interpretuje dane dostępne dla danego zadania. Czytając go, sprawdź przesłanki, czas ich pomiaru i informację o jakości źródeł. Gdy opis i wykres się różnią, wróć do danych giełdy i zapisz, którą część wniosku udało się odtworzyć.",
          [["analysisDocs", "Dokumentacja silnika analiz"]],
        ],
      },
      {
        title: "Założenia symulacji",
        paragraphs: [
          "Wyniki zależą od modelu realizacji, płynności i przyjętych kosztów. W dzienniku zapisuj także zlecenia bez wykonania oraz sytuacje, w których dane nie pozwalają ustalić kolejności cen. Historyczna próba opisuje zachowanie przy danych założeniach.",
          [["paperDocs", "Dokumentacja paper tradingu"]],
        ],
      },
    ],
  },
  contact: {
    title: "Kontakt",
    description:
      "Zgłoś błąd w poradniku, problem techniczny lub sprawę związaną z prywatnością.",
    sections: [
      {
        title: "Wydawca i kontakt",
        publisher: true,
      },
      {
        title: "Co dołączyć do zgłoszenia",
        paragraphs: [
          "Przy poprawce do artykułu podaj jego adres, cytowany fragment i ewentualne źródło. Przy błędzie technicznym podaj przeglądarkę, czas wystąpienia i kroki do odtworzenia. Hasła, klucze API i frazy odzyskiwania zachowaj dla siebie.",
          [
            "Błędy w publicznym kodzie można też zgłaszać w ",
            ["issues", "GitHub Issues"],
            ". Sprawy dotyczące konta lub danych osobowych kieruj na adres e-mail wydawcy.",
          ],
        ],
      },
    ],
  },
  privacy: {
    title: "Polityka prywatności i cookies",
    description:
      "Informacje o danych konta, plikach cookies, dostawcach usług, reklamach i prawach użytkownika.",
    sections: [
      {
        title: "Administrator danych",
        publisher: true,
      },
      {
        title: "Odwiedziny, konto i kontakt",
        paragraphs: [
          "Odczyt publicznych poradników nie wymaga konta. Serwer może przetwarzać adres IP, czas, ścieżkę żądania i dane techniczne w celu dostarczenia strony, zabezpieczenia serwisu i diagnozowania problemów. Przy kontakcie e-mail przetwarzamy adres nadawcy i treść korespondencji w celu odpowiedzi.",
          "Konto może obejmować adres e-mail lub powiązany adres portfela, dane uwierzytelniania, preferencje, zapisane analizy, alerty i wyniki symulacji. Własne klucze dostawców AI są przechowywane w postaci zaszyfrowanej. Przy uruchomieniu analizy wybrany dostawca otrzymuje dane potrzebne do przetworzenia zadania. Dostawcy hostingu, poczty, uwierzytelniania i płatności mogą przetwarzać dane związane z funkcjami, które obsługują.",
        ],
      },
      {
        title: "Podstawy i okres przechowywania",
        paragraphs: [
          "Obsługa konta i wybranych funkcji odbywa się w zakresie niezbędnym do świadczenia usługi. Zabezpieczenie serwisu, obsługa zgłoszeń i dochodzenie roszczeń mogą opierać się na uzasadnionym interesie administratora. Obowiązki rozliczeniowe i odpowiedzi na uprawnione żądania mogą wymagać przetwarzania z mocy prawa. Jeżeli wybrana funkcja wymaga zgody, możesz ją wycofać na przyszłość.",
          "Dane konta zachowujemy przez okres jego obsługi, a dane zgłoszeń przez czas potrzebny do odpowiedzi i rozliczenia sprawy. Dalsze przechowywanie może wynikać z obowiązków prawnych, ochrony roszczeń lub okresu utrzymania kopii zapasowych. Dostawcy mogą przetwarzać dane poza EOG w zależności od wdrożenia i warunków ich usług. Informacje o odbiorcach, okresach retencji i stosowanych zabezpieczeniach można uzyskać u administratora.",
        ],
      },
      {
        title: "Cookies, pamięć przeglądarki i Google AdSense",
        paragraphs: [
          "Terminal używa cookies sesyjnych do logowania oraz pamięci przeglądarki m.in. do zapisania języka, motywu i ustawień wykresu. Ustawienia przeglądarki pozwalają usunąć lokalne dane. Wyłączenie cookies sesyjnych może uniemożliwić zalogowanie.",
          "Gdy wydawca włączy Google AdSense, na wybranych artykułach Google i dostawcy reklam mogą odczytywać lub zapisywać cookies oraz korzystać z sygnałów takich jak adres IP, piksele śledzące i inne identyfikatory. Dane mogą służyć do dostarczania i pomiaru reklam, zapobiegania nadużyciom i, w zależności od ustawień oraz zgody, personalizacji. Gdy komunikat o zgodzie Google jest dostępny, wybór można później zmienić w ustawieniach prywatności i cookies widocznych na dole strony z reklamą.",
          "Wykres na stronie głównej łączy przeglądarkę z publicznym źródłem danych Binance. Binance otrzymuje dane techniczne połączenia, w tym adres IP. Wykres korzysta wyłącznie z publicznych notowań rynku spot.",
          [
            ["partnerPrivacy", "Jak Google używa danych w witrynach partnerów"],
            " · ",
            ["adCenter", "Moje centrum reklam Google"],
          ],
        ],
      },
      {
        title: "Twoje prawa",
        paragraphs: [
          "Zależnie od podstawy i okoliczności przetwarzania możesz wystąpić o dostęp, sprostowanie, usunięcie, ograniczenie lub przeniesienie danych oraz wnieść sprzeciw. Zgodę możesz wycofać bez wpływu na wcześniejsze przetwarzanie. Możesz złożyć skargę do właściwego organu nadzorczego, w Polsce do Prezesa UODO.",
          [
            ["contact", "Skontaktuj się z administratorem"],
            " · ",
            ["uodo", "Urząd Ochrony Danych Osobowych"],
          ],
        ],
      },
    ],
  },
  terms: {
    title: "Regulamin serwisu",
    description:
      "Zasady korzystania z bazy wiedzy, terminala i funkcji symulacyjnych CryptoSight AI.",
    sections: [
      {
        title: "Operator serwisu",
        publisher: true,
      },
      {
        title: "Zakres usługi i wymagania",
        paragraphs: [
          "Serwis obejmuje publiczne poradniki oraz terminal z funkcjami analitycznymi i symulacyjnymi. Do korzystania potrzebujesz aktualnej przeglądarki i dostępu do internetu. Konto, adres e-mail lub portfel mogą być wymagane dla wybranych funkcji. Dostępność danych zależy także od zewnętrznych dostawców.",
        ],
      },
      {
        title: "Konto i korzystanie z terminala",
        paragraphs: [
          "Chroń dostęp do konta i danych uwierzytelniania. Korzystaj z serwisu zgodnie z prawem, z poszanowaniem praw innych osób. Zabronione jest naruszanie zabezpieczeń, obchodzenie limitów i destabilizowanie usług. Ustawienia konta zawierają funkcje eksportu i usunięcia danych.",
        ],
      },
      {
        title: "Materiały edukacyjne i ryzyko",
        paragraphs: [
          "Poradniki, analizy i kalkulatory mają charakter edukacyjny i informacyjny. Raporty AI mogą zawierać błędy, a dane rynkowe mogą być opóźnione lub niepełne. W symulatorze używasz wirtualnych środków. Przykładowe wyniki opisują przyjęte założenia. Handel kryptoaktywami wiąże się z ryzykiem utraty środków.",
        ],
      },
      {
        title: "Zgłoszenia i prywatność",
        paragraphs: [
          [
            "Problemy z działaniem serwisu oraz reklamacje składaj przez ",
            ["contact", "kontakt z wydawcą"],
            ". Opisz problem, datę zdarzenia i sposób kontaktu zwrotnego. Zasady przetwarzania danych określa ",
            ["privacy", "polityka prywatności i cookies"],
            ".",
          ],
        ],
      },
    ],
  },
};
