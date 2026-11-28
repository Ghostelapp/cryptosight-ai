import { terminalHref } from "../lib/public-site";
import {
  ArrowRight,
  ChartCandlestick,
  FlaskConical,
  Layers3,
  ScanLine,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import type { Guide } from "../lib/knowledge";
import { publicCopy } from "../lib/public-copy";
import {
  homePage,
  infoIds,
  infoPaths,
  knowledgePaths,
  publicHref,
  publicLocales,
  type PublicLocale,
  type PublicPage,
} from "../lib/public-routes";

const topicIcons = {
  Wykresy: ChartCandlestick,
  Rynek: Layers3,
  Ryzyko: ShieldCheck,
  Symulacja: FlaskConical,
  "Analiza AI": ScanLine,
};

const languageNames = { pl: "Polski", en: "English", de: "Deutsch" };

function SiteBrand({ locale }: { locale: PublicLocale }) {
  return (
    <a
      href={publicHref(locale, homePage)}
      className="pub-brand"
      aria-label={`CryptoSight AI — ${publicCopy[locale].homeLabel}`}
    >
      <span className="pub-brand-mark">
        <Waypoints size={19} aria-hidden="true" />
      </span>
      CryptoSight<span className="pub-brand-ai">AI</span>
    </a>
  );
}

export function PublicHeader({
  locale,
  page,
}: {
  locale: PublicLocale;
  page: PublicPage;
}) {
  const copy = publicCopy[locale];
  return (
    <header className="pub-header">
      <div className="pub-wrap pub-header-inner">
        <SiteBrand locale={locale} />
        <nav className="pub-main-nav" aria-label={copy.navigation}>
          <a href={knowledgePaths[locale]}>{copy.knowledge}</a>
          <a className="pub-about-nav" href={infoPaths.about[locale]}>
            {copy.about}
          </a>
        </nav>
        <div className="pub-header-actions">
          <nav className="pub-languages" aria-label={copy.language}>
            {publicLocales.map((item) => (
              <a
                key={item}
                href={publicHref(item, page)}
                hrefLang={item}
                lang={item}
                aria-label={languageNames[item]}
                aria-current={item === locale ? "page" : undefined}
              >
                {item.toUpperCase()}
              </a>
            ))}
          </nav>
          <a
            className="pub-button pub-button-outline pub-header-terminal"
            href={terminalHref(locale)}
          >
            {copy.terminal} <ArrowRight size={15} aria-hidden="true" />
          </a>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter({ locale }: { locale: PublicLocale }) {
  const copy = publicCopy[locale];
  return (
    <footer className="pub-footer">
      <div className="pub-wrap pub-footer-inner">
        <SiteBrand locale={locale} />
        <nav aria-label={copy.footer}>
          <a href={publicHref(locale, { kind: "sitemap" })}>{copy.sitemap}</a>
          {infoIds.map((id) => (
            <a key={id} href={infoPaths[id][locale]}>
              {copy[id]}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export function GuideCard({
  guide,
  locale,
}: {
  guide: Guide;
  locale: PublicLocale;
}) {
  const copy = publicCopy[locale];
  const Icon = topicIcons[guide.category];
  return (
    <a
      className="pub-guide-card"
      href={publicHref(locale, { kind: "guide", id: guide.slug })}
    >
      <span className="pub-guide-top">
        <span className="pub-topic-icon">
          <Icon size={19} aria-hidden="true" />
        </span>
        <span>{copy.categories[guide.category]}</span>
      </span>
      <h3>{guide.title}</h3>
      <p>{guide.summary}</p>
      <span className="pub-card-link">
        {copy.readGuide} <ArrowRight size={15} aria-hidden="true" />
      </span>
    </a>
  );
}
