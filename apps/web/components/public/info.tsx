import { Fragment } from "react";
import { polishInfo } from "../../lib/info-pl";
import { englishInfo } from "../../lib/info-en";
import { germanInfo } from "../../lib/info-de";
import type { InfoLink } from "../../lib/info-types";
import {
  infoPaths,
  type InfoId,
  type PublicLocale,
} from "../../lib/public-routes";
import { publisherDetails } from "../../lib/public-site";

const info = { pl: polishInfo, en: englishInfo, de: germanInfo };
export function getInfo(locale: PublicLocale, id: InfoId) {
  return info[locale][id];
}

const repo = "https://github.com/Ghostelapp/cryptosight-ai";
const externalLinks = {
  repo,
  issues: `${repo}/issues`,
  analysisDocs: `${repo}/blob/main/docs/ANALYSIS-ENGINE.md`,
  paperDocs: `${repo}/blob/main/docs/PAPER-TRADING.md`,
  adCenter: "https://myadcenter.google.com/",
  uodo: "https://uodo.gov.pl/",
};

function infoHref(locale: PublicLocale, link: InfoLink) {
  if (link in infoPaths) return infoPaths[link as InfoId][locale];
  if (link === "partnerPrivacy")
    return `https://policies.google.com/technologies/partner-sites?hl=${locale}`;
  return externalLinks[link as keyof typeof externalLinks];
}

const missingPublisher = {
  pl: "Dane wydawcy i adres kontaktowy wymagają uzupełnienia przed zgłoszeniem serwisu do programu reklamowego.",
  en: "The publisher’s details and contact address need to be added before the site is submitted to the advertising program.",
  de: "Vor der Anmeldung zum Werbeprogramm müssen die Angaben und die Kontaktadresse des Herausgebers ergänzt werden.",
};

function Publisher({ locale }: { locale: PublicLocale }) {
  const details = publisherDetails();
  if (!details) return <p>{missingPublisher[locale]}</p>;
  return (
    <p>
      {details.name}
      <br />
      {details.address}
      <br />
      <a href={`mailto:${details.email}`}>{details.email}</a>
    </p>
  );
}

export function PublicInfo({
  locale,
  id,
}: {
  locale: PublicLocale;
  id: InfoId;
}) {
  const page = getInfo(locale, id);
  return (
    <div className="pub-wrap pub-section">
      <article className="pub-article">
        <header className="pub-page-intro">
          <h1>{page.title}</h1>
          <p className="pub-lead">{page.description}</p>
        </header>
        <div className="pub-prose">
          {page.sections.map(({ title, publisher, paragraphs }) => (
            <section key={title}>
              <h2>{title}</h2>
              {publisher && <Publisher locale={locale} />}
              {paragraphs?.map((paragraph, index) => (
                <p key={index}>
                  {typeof paragraph === "string"
                    ? paragraph
                    : paragraph.map((part, partIndex) =>
                        typeof part === "string" ? (
                          <Fragment key={partIndex}>{part}</Fragment>
                        ) : (
                          <a key={partIndex} href={infoHref(locale, part[0])}>
                            {part[1]}
                          </a>
                        ),
                      )}
                </p>
              ))}
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
