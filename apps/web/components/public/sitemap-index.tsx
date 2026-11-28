import { getGuides } from "../../lib/knowledge";
import { publicCopy } from "../../lib/public-copy";
import {
  homePage,
  infoIds,
  infoPaths,
  knowledgePaths,
  publicHref,
  type PublicLocale,
} from "../../lib/public-routes";

export function SitemapIndex({ locale }: { locale: PublicLocale }) {
  const copy = publicCopy[locale];
  return (
    <div className="pub-wrap pub-section pub-index">
      <article className="pub-article">
        <header className="pub-page-intro">
          <h1>{copy.sitemap}</h1>
          <p className="pub-lead">{copy.sitemapIntro}</p>
        </header>
        <div className="pub-prose">
          <section>
            <h2>{copy.footer}</h2>
            <ul>
              <li>
                <a href={publicHref(locale, homePage)}>{copy.homeLabel}</a>
              </li>
              {infoIds.map((id) => (
                <li key={id}>
                  <a href={infoPaths[id][locale]}>{copy[id]}</a>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2>
              <a href={knowledgePaths[locale]}>{copy.knowledge}</a>
            </h2>
            <ul>
              {getGuides(locale).map((guide) => (
                <li key={guide.slug}>
                  <a
                    href={publicHref(locale, { kind: "guide", id: guide.slug })}
                  >
                    {guide.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </article>
    </div>
  );
}
