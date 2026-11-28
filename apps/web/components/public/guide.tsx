import { ArrowRight } from "lucide-react";
import { headers } from "next/headers";
import { PublicStructuredData } from "./structured-data";
import { ArticleAd } from "../article-ad";
import { GuideCard } from "../public-site";
import { getGuides, type Guide } from "../../lib/knowledge";
import { publicCopy } from "../../lib/public-copy";
import {
  homePage,
  knowledgePaths,
  publicHref,
  type PublicLocale,
} from "../../lib/public-routes";
import { adSenseConfig } from "../../lib/public-site";

export async function GuideArticle({
  locale,
  guide,
}: {
  locale: PublicLocale;
  guide: Guide;
}) {
  const copy = publicCopy[locale];
  const guides = getGuides(locale);
  const ads = adSenseConfig();
  const nonce = ads ? (await headers()).get("x-nonce") : undefined;
  const related = [
    ...guides.filter(
      (item) => item.slug !== guide.slug && item.category === guide.category,
    ),
    ...guides.filter((item) => item.category !== guide.category),
  ].slice(0, 3);

  return (
    <div className="pub-wrap pub-section">
      <article className="pub-article">
        <PublicStructuredData locale={locale} guide={guide} />
        <nav className="pub-breadcrumb" aria-label={copy.navigation}>
          <a href={publicHref(locale, homePage)}>{copy.homeLabel}</a>
          <span aria-hidden="true">/</span>
          <a href={knowledgePaths[locale]}>{copy.knowledge}</a>
        </nav>
        <header className="pub-page-intro">
          <p className="pub-kicker">{copy.categories[guide.category]}</p>
          <h1>{guide.title}</h1>
          <p className="pub-lead">{guide.summary}</p>
          <p className="pub-byline">{copy.byline}</p>
        </header>
        <div className="pub-prose">
          {guide.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
          <section className="pub-example">
            <h2>{guide.example.title}</h2>
            <p>{guide.example.text}</p>
          </section>
          <section>
            <h2>{copy.practice}</h2>
            <p>{guide.takeaway}</p>
          </section>
          <section>
            <h2>{copy.sources}</h2>
            <ul>
              {guide.sources.map((source) => (
                <li key={source.href}>
                  <a href={source.href}>{source.label}</a>
                </li>
              ))}
            </ul>
          </section>
          <p className="pub-disclaimer">{copy.riskNote}</p>
        </div>
        {ads && nonce && <ArticleAd {...ads} nonce={nonce} label={copy.ad} />}
      </article>
      <section className="pub-related">
        <div className="pub-section-head">
          <h2>{copy.related}</h2>
          <a className="pub-text-link" href={knowledgePaths[locale]}>
            {copy.knowledge} <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
        <div className="pub-grid">
          {related.map((item) => (
            <GuideCard key={item.slug} guide={item} locale={locale} />
          ))}
        </div>
      </section>
    </div>
  );
}
