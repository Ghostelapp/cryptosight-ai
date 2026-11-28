import { englishGuides, germanGuides } from "./knowledge-translations";
import type { GuideId, PublicLocale } from "./public-routes";

type Source = { label: string; href: string };

export type Guide = {
  slug: GuideId;
  category: "Wykresy" | "Rynek" | "Ryzyko" | "Symulacja" | "Analiza AI";
  title: string;
  summary: string;
  sections: { title: string; paragraphs: string[] }[];
  example: { title: string; text: string };
  takeaway: string;
  sources: Source[];
};

const docs = "https://github.com/Ghostelapp/cryptosight-ai/blob/main/docs/";
const esma = {
  label: "Europejskie urzędy nadzoru — ostrzeżenie o ryzyku kryptoaktywów",
  href: "https://www.esma.europa.eu/press-news/esma-news/eu-supervisory-authorities-warn-consumers-risks-and-limited-protection-certain",
};

const polishGuides: Guide[] = [
  {
    slug: "swiece-ohlcv",
    category: "Wykresy",
    title: "Jak czytać świece OHLCV?",
    summary:
      "Odczytaj cenę otwarcia, zamknięcia, skrajne wartości i wolumen. Zobacz, jak zmienia się obraz rynku wraz z interwałem.",
    sections: [
      {
        title: "Co zapisuje jedna świeca?",
        paragraphs: [
          "Arkusz transakcji może zawierać setki zdarzeń w ciągu godziny. Świeca pokazuje pierwszą cenę (Open), najwyższą (High), najniższą (Low) i ostatnią (Close) w oknie wyznaczonym przez interwał. Korpus łączy otwarcie z zamknięciem, a knoty wskazują skrajne ceny. Zielony kolor zwykle oznacza zamknięcie powyżej otwarcia, choć paletę często można zmienić.",
          "V oznacza wolumen. Sprawdź, jak oznacza go dostawca, bo może raportować liczbę jednostek bazowych lub wartość w walucie kwotowanej. Zestawiaj wolumeny dla tej samej pary, tego samego rynku i tej samej jednostki.",
        ],
      },
      {
        title: "Otwarte i zamknięte świece odpowiadają na różne pytania",
        paragraphs: [
          "Świeca 15-minutowa o 12:07 nadal się zmienia. Jej zamknięcie jest znane dopiero po zakończeniu interwału o 12:15. Jeżeli porównujesz dwa odczyty wskaźnika albo oceniasz warunek w teście historycznym, użycie zamkniętych świec daje powtarzalny punkt odniesienia.",
          "Na wykresie jednogodzinnym zobaczysz cztery kwadranse w postaci jednej świecy. Ich kolejność zniknie. Sam knot pokazuje, do jakiego poziomu dotarła cena. Informację o tym, czy maksimum wystąpiło przed minimum, odzyskasz dopiero z dokładniejszych danych.",
        ],
      },
      {
        title: "Sprawdź rynek i jakość danych",
        paragraphs: [
          "Przed porównaniem dwóch wykresów zapisz ich giełdę, parę, typ rynku, interwał i zakres czasu. BTC/USDT na rynku kasowym i kontrakt na tę samą parę mogą mieć odrębny przebieg cen. Luka w odczycie może też wynikać z przerwy dostawcy. W takiej sytuacji sprawdź historię transakcji lub ten sam rynek u źródła, zanim przypiszesz luce znaczenie.",
        ],
      },
    ],
    example: {
      title: "Jedna świeca w liczbach",
      text: "Otwarcie 100, maksimum 109, minimum 96, zamknięcie 104. Korpus ma 4 jednostki, górny knot 5, a dolny 4. Całkowity zakres świecy wynosi 13. Jeśli obok widzisz wolumen 320 BTC, jest to oddzielna informacja o aktywności na danym rynku.",
    },
    takeaway:
      "W terminalu przełącz tę samą parę z 15 minut na godzinę i porównaj zamknięty okres na obu wykresach.",
    sources: [
      {
        label: "Coinbase — elementy widoku wykresu",
        href: "https://help.coinbase.com/en/pro/trading-and-funding/orders/overview-of-the-trade-view",
      },
      {
        label: "Metodologia danych i analiz CryptoSight AI",
        href: docs + "ANALYSIS-ENGINE.md",
      },
    ],
  },
  {
    slug: "spread-i-plynnosc",
    category: "Rynek",
    title: "Spread, głębokość i poślizg cenowy",
    summary:
      "Dowiedz się, jak czytać arkusz zleceń i dlaczego cena ostatniej transakcji może różnić się od ceny wykonania.",
    sections: [
      {
        title: "Odczytaj obie strony arkusza",
        paragraphs: [
          "Najlepszy bid to najwyższa widoczna oferta kupna, a najlepszy ask to najniższa oferta sprzedaży. Spread jest różnicą między nimi. Przy porównywaniu instrumentów pomocny jest spread procentowy. Podziel różnicę przez średnią obu cen i pomnóż wynik przez 100.",
          "Pojedynczy poziom pokazuje tylko ilość dostępną przy określonej cenie. Głębokość odpowiada na pytanie, ile jednostek czeka także na kolejnych poziomach. Widoczne zlecenia można anulować, dlatego zrzut arkusza opisuje konkretną chwilę.",
        ],
      },
      {
        title: "Oszacuj średnią cenę wykonania",
        paragraphs: [
          "Zlecenie rynkowe może wykorzystać więcej niż jeden poziom, jeśli ilość na najlepszej ofercie jest zbyt mała. W prostym rachunku przemnażasz cenę każdego poziomu przez wypełnioną tam ilość, sumujesz wartości i dzielisz przez całkowitą ilość. Różnicę względem wybranej ceny odniesienia określasz jako poślizg. Przy porównywaniu symulacji zapisz, czy punktem odniesienia jest najlepsza oferta, środek spreadu czy wcześniejsza cena.",
          "Zlecenie kupna z limitem określa najwyższą akceptowaną cenę. Jeśli zabraknie dostępnej ilości, część zlecenia może pozostać otwarta. Limit, który od razu dopasuje się do przeciwnej strony arkusza, może naliczyć opłatę taker zgodnie z zasadami giełdy.",
        ],
      },
      {
        title: "Porównuj podobne warunki",
        paragraphs: [
          "Użyj tego samego rozmiaru zlecenia i tej samej waluty kwotowanej, gdy oceniasz głębokość na dwóch giełdach. Zapisz też czas odczytu. Płynność widoczna o jednej godzinie może zmienić się po publikacji informacji lub w okresie niższej aktywności. Opłatę giełdy dolicz osobno do ceny wykonania.",
        ],
      },
    ],
    example: {
      title: "Zakup czterech jednostek",
      text: "Najlepszy bid to 99,80, ask to 100,20. Spread to 0,40, czyli 0,40% środka arkusza. Jeśli możesz kupić 2 jednostki za 100,20 i kolejne 2 za 100,50, średnia cena wyniesie 100,35 przed prowizją. Poślizg względem najlepszego ask to 0,15 na jednostkę.",
    },
    takeaway:
      "W arkuszu zanotuj najlepsze oferty i ilości dwóch następnych poziomów. Oblicz, jak średnia cena zmienia się po podwojeniu testowej ilości.",
    sources: [
      {
        label: "Coinbase — widok arkusza zleceń",
        href: "https://help.coinbase.com/en/coinbase/trading-and-funding/advanced-trade/dashboard-overview",
      },
      {
        label: "Coinbase — zasady opłat maker i taker",
        href: "https://help.coinbase.com/en/coinbase/trading-and-funding/advanced-trade/advanced-trade-fees",
      },
    ],
  },
  {
    slug: "wielkosc-pozycji",
    category: "Ryzyko",
    title: "Jak obliczyć wielkość pozycji w symulacji?",
    summary:
      "Przelicz budżet ryzyka na liczbę jednostek i porównaj wynik z kosztami oraz dostępnym kapitałem.",
    sections: [
      {
        title: "Zacznij od budżetu straty",
        paragraphs: [
          "W ćwiczeniu dla długiej pozycji na rynku kasowym zamień procent kapitału na kwotę, którą symulacja może stracić w określonym scenariuszu. W modelu bez dźwigni odejmij planowaną cenę wyjścia od ceny wejścia, aby policzyć różnicę na jednostkę. Jeśli różnica wynosi zero albo wyjście znajduje się powyżej wejścia, ten wzór dla straty długiej pozycji nie ma zastosowania.",
          "Do różnicy dodaj szacunkową prowizję za obie strony oraz dodatkowy poślizg, którego jeszcze nie ujęto w cenach. Podziel budżet straty przez szacowany koszt straty na jednostkę. Wynik zaokrąglij w dół według minimalnego kroku ilości obowiązującego na danym rynku.",
        ],
      },
      {
        title: "Sprawdź również, czy masz środki na zakup",
        paragraphs: [
          "Jeżeli wynik wymaga więcej środków, niż masz do dyspozycji, ilość należy ograniczyć do tej, którą pokryje saldo wraz z opłatą wejścia. Odległość wyjścia od ceny wejścia opisuje scenariusz ryzyka, a saldo ogranicza kwotę, jaką można przeznaczyć na symulowany zakup. Wąski dystans zwiększa ilość wynikającą ze wzoru i łatwo przekracza limit salda.",
          "Osobno zapisz cenę docelową oraz koszt scenariusza zysku. Porównanie zysku i straty po kosztach opisuje relację tych dwóch scenariuszy. Do oszacowania wartości oczekiwanej potrzebujesz jeszcze wiarygodnej informacji o częstotliwości wyników.",
        ],
      },
      {
        title: "Przelicz scenariusz gorszego wyjścia",
        paragraphs: [
          "Jeżeli rynek przeskoczy poziom wyjścia lub w arkuszu brakuje płynności, rzeczywista cena może być gorsza od zakładanej. Wykonaj drugie obliczenie z większą różnicą ceny. Różnica względem pierwszego wyniku pokaże, która część budżetu zależy od założenia o wykonaniu.",
        ],
      },
    ],
    example: {
      title: "Budżet straty 20 jednostek waluty",
      text: "Kapitał 4 000, ćwiczebny budżet straty 0,5%, wejście po 100 i założone wyjście po 96. Po dodaniu 0,50 na jednostkę za koszty i poślizg, strata modelowa wynosi 4,50 na jednostkę. 20 ÷ 4,50 daje około 4,44 jednostki, czyli 4 przy kroku ilości równym 1.",
    },
    takeaway:
      "W kalkulatorze porównaj ten sam budżet przy dwóch założeniach poślizgu. Zapisz walutę, krok ilości oraz to, które koszty zostały już wliczone w ceny.",
    sources: [
      esma,
      {
        label: "CryptoSight AI — metodologia kosztów i ryzyka",
        href: docs + "ANALYSIS-ENGINE.md",
      },
    ],
  },
  {
    slug: "paper-trading",
    category: "Symulacja",
    title: "Paper trading. Jak ocenić wynik symulacji?",
    summary:
      "Zaplanuj próbę, zapisz warunki wykonania i policz wynik po kosztach, uwzględniając zlecenia bez realizacji.",
    sections: [
      {
        title: "Zapisz reguły, zanim uruchomisz próbę",
        paragraphs: [
          "Wybierz jedną parę, interwał i typ zlecenia. Zapisz, co ma uruchomić wejście, jak określisz ilość i jakie warunki kończą próbę. Oznacz czas decyzji i uwzględnij tylko dane, które były znane w tym momencie. Zmiany reguł zapisuj jako nową wersję, żeby wynik wcześniejszej serii pozostał porównywalny.",
          "W dzienniku odnotuj zlecenia anulowane, nadal otwarte i częściowo wykonane. Sam wykaz zamkniętych symulacji nie pokaże, ile sygnałów nie dało się zrealizować według przyjętych zasad.",
        ],
      },
      {
        title: "Oddziel wynik netto od jakości wykonania",
        paragraphs: [
          "Wynik netto pozycji to różnica między wartością wyjścia a wartością wejścia po odjęciu opłat. Jeśli symulator już uwzględnia poślizg w cenie wykonania, ponowne odjęcie tego samego poślizgu zaniży wynik. Oprócz sumy netto porównaj średni wynik, maksymalne obsunięcie kapitału i odsetek niedokończonych zleceń.",
          "W CryptoSight AI symulator prowadzi historię wykonania i rezerwację środków. Automatyczne uzupełnianie limitów oraz wyjścia ochronne zależą od działającego procesu roboczego i dostępności danych. Szczegóły przyjętego modelu opisuje dokumentacja modułu.",
        ],
      },
      {
        title: "Sprawdź drugi okres i trudniejsze warunki",
        paragraphs: [
          "Powtórz te same reguły dla kolejnego okresu, zanim je dostroisz. Osobno porównaj sesje o różnej płynności i scenariusz wyższych kosztów. Jeżeli reguła działała wyłącznie w jednym okresie lub po bardzo optymistycznym wykonaniu, kolejna próba pomaga ustalić, od których założeń zależał wynik.",
        ],
      },
    ],
    example: {
      title: "Wynik po kosztach i odsetek realizacji",
      text: "Z dziesięciu zleceń siedem zrealizowano. Suma wyników zamkniętych pozycji to +18 przed opłatami, a opłaty wynoszą 11. Wynik netto to +7. Dziennik powinien też pokazać realizację 7/10 i trzy zlecenia bez wykonania, by dało się ocenić powtarzalność próby.",
    },
    takeaway:
      "Utwórz w symulatorze po jednym zleceniu rynkowym i z limitem. Porównaj status, cenę oraz koszt w historii wykonania.",
    sources: [
      {
        label: "CryptoSight AI — model paper trading i ograniczenia",
        href: docs + "PAPER-TRADING.md",
      },
      esma,
    ],
  },
  {
    slug: "weryfikacja-analizy-ai",
    category: "Analiza AI",
    title: "Jak zweryfikować raport AI o rynku?",
    summary:
      "Sprawdź czas danych, przesłanki i warunki unieważnienia. Zamień opis modelu na listę obserwacji do potwierdzenia.",
    sections: [
      {
        title: "Ustal, jaki rynek i okres opisuje raport",
        paragraphs: [
          "Zapisz ticker, giełdę, typ rynku i interwały. Odczytaj czas ostatniej zamkniętej świecy oraz znacznik czasu pozostałych danych. Aktualny wykres może być zestawiony z wcześniejszym odczytem arkusza lub wolumenu. Taka różnica czasu zmienia sposób interpretacji raportu.",
          "W CryptoSight AI analiza może łączyć kilka interwałów i sygnały z różnych źródeł. Jeżeli część źródeł jest niedostępna, sprawdź informację o jakości i kompletności danych. Odnotuj luki podczas dalszej weryfikacji.",
        ],
      },
      {
        title: "Sprawdź każdą ważną przesłankę",
        paragraphs: [
          "Jeśli raport wymienia wybicie poziomu, znajdź poziom i wskazaną świecę. Odczytaj jej maksimum oraz zamknięcie. Jeśli wymienia przyspieszenie wolumenu, sprawdź, do jakiego okresu porównano bieżącą wartość. Jeśli raport nie podaje takiego okresu, sam opis nie wystarczy do odtworzenia wniosku.",
          "Model generatywny może podać błędną odpowiedź z dużą pewnością językową. Zapisz fakty, które możesz potwierdzić na wykresie, obok interpretacji raportu. Ważną obserwację oceń także w pierwotnym źródle danych.",
        ],
      },
      {
        title: "Zapisz warunek ponownej oceny",
        paragraphs: [
          "Dobra notatka podaje, po jakim zdarzeniu sprawdzisz przesłankę ponownie. Może to być zamknięcie kolejnej świecy, przywrócenie danych jednego dostawcy lub potwierdzenie ceny na tym samym rynku. W dzienniku zachowaj pierwotne uzasadnienie i dopisz późniejszy wynik według wcześniej określonych kryteriów.",
        ],
      },
    ],
    example: {
      title: "Knot ponad poziomem",
      text: "Raport mówi o zamknięciu powyżej 105. Zamknięta świeca osiągnęła maksimum 107, lecz jej zamknięcie wyniosło 103. Jeżeli kryterium dotyczyło zamknięcia, dostępne dane go nie potwierdzają. Następną świecę oceń według tej samej reguły.",
    },
    takeaway:
      "Z kolejnego raportu wybierz trzy konkretne twierdzenia. Przy każdym zapisz źródło, godzinę i wynik weryfikacji.",
    sources: [
      {
        label: "NIST — profil zarządzania ryzykiem generatywnej AI, sekcja 2.2",
        href: "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf",
      },
      {
        label: "CryptoSight AI — źródła danych i metodologia raportów",
        href: docs + "ANALYSIS-ENGINE.md",
      },
    ],
  },
  {
    slug: "test-historyczny",
    category: "Symulacja",
    title: "Jak przygotować powtarzalny test historyczny?",
    summary:
      "Ustal moment sygnału, model wykonania i okres sprawdzający, aby dało się odtworzyć wynik.",
    sections: [
      {
        title: "Zdefiniuj chwilę, w której reguła widzi dane",
        paragraphs: [
          "Przy sygnale na zamknięciu świecy jednogodzinnej cena zamknięcia jest znana po zakończeniu tej godziny. Test powinien opisać, w jakim momencie pojawia się możliwość wykonania. Użycie wcześniejszej ceny z tej samej świecy wprowadzi do symulacji informację z przyszłości.",
          "Opisz używane źródło danych, strefę czasową, sposób obsługi braków oraz okres rozgrzewki wskaźników. Jeśli dana świeca nie ma kompletu danych, zapisz regułę postępowania przed obejrzeniem wyniku.",
        ],
      },
      {
        title: "Ustal kolejność zdarzeń i koszty",
        paragraphs: [
          "Gdy w obrębie jednej świecy odnotowano zarówno poziom realizacji zysku, jak i poziom wyjścia ochronnego, samo OHLC nie ujawnia kolejności zdarzeń. Możesz sięgnąć po niższy interwał albo z góry przyjąć jawną regułę dla przypadków niejednoznacznych. Zlicz, ile razy taka reguła wpływa na wynik.",
          "Odejmij koszty i przeprowadź drugą próbę przy gorszym założeniu wykonania. W raporcie pokaż osobno liczbę transakcji, wynik po kosztach i maksymalne obsunięcie. Wzrost sumy końcowej może współistnieć z długim okresem strat.",
        ],
      },
      {
        title: "Zostaw okres sprawdzający na koniec",
        paragraphs: [
          "Wybierz ustawienia na jednym fragmencie historii, a potem sprawdź je na późniejszym, wcześniej pominiętym fragmencie. Zapisz wszystkie wykonane wersje. Wielokrotne dobieranie parametrów na okresie sprawdzającym zamienia go w kolejny okres strojenia i utrudnia ocenę, jak reguła zachowa się na nowych danych.",
        ],
      },
    ],
    example: {
      title: "Dwa poziomy w tej samej świecy",
      text: "Symulacja jest otwarta od 100, wyjście ochronne leży na 95, a cel na 108. Kolejna świeca ma minimum 94 i maksimum 109. Ustal kolejność na podstawie dokładniejszych danych albo zastosuj zapisaną regułę dla niejednoznacznych świec. Zaznacz ten przypadek w raporcie.",
    },
    takeaway:
      "Zachowaj daty zakresów, źródło świec, ustawienia kosztów i kolejność wykonania. Daj drugiej osobie ten sam zestaw do odtworzenia.",
    sources: [
      {
        label: "CryptoSight AI — metodologia i założenia silnika analiz",
        href: docs + "ANALYSIS-ENGINE.md",
      },
      {
        label: "CryptoSight AI — model wykonania w symulatorze",
        href: docs + "PAPER-TRADING.md",
      },
    ],
  },
];

export function getGuides(locale: PublicLocale): Guide[] {
  if (locale === "pl") return polishGuides;
  const translations = locale === "en" ? englishGuides : germanGuides;
  return polishGuides.map((guide) => {
    const { sourceLabels, ...translation } = translations[guide.slug];
    return {
      ...guide,
      ...translation,
      sources: guide.sources.map((source, index) => ({
        ...source,
        label: sourceLabels[index],
      })),
    };
  });
}
