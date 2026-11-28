import { terminalHref } from "../../lib/public-site";
import {
  ArrowRight,
  BookOpen,
  ChartCandlestick,
  ScanLine,
  FlaskConical,
} from "lucide-react";
import { GuideCard } from "../public-site";
import { PublicStructuredData } from "./structured-data";
import { MarketChart } from "./market-chart";
import { getGuides } from "../../lib/knowledge";
import { publicCopy } from "../../lib/public-copy";
import {
  infoPaths,
  knowledgePaths,
  type PublicLocale,
} from "../../lib/public-routes";

export function PublicHome({ locale }: { locale: PublicLocale }) {
  const copy = publicCopy[locale];
  const guides = getGuides(locale);
  const features = [
    { icon: ChartCandlestick, title: copy.chartsTitle, body: copy.chartsBody },
    { icon: ScanLine, title: copy.reportsTitle, body: copy.reportsBody },
    {
      icon: FlaskConical,
      title: copy.simulatorTitle,
      body: copy.simulatorBody,
    },
  ];
  return (
    <>
      <PublicStructuredData locale={locale} />
      <section className="pub-wrap pub-hero">
        <div className="pub-hero-content">
          <p className="pub-kicker">
            <span /> {copy.heroKicker}
          </p>
          <h1>
            {copy.heroTitle} <em>{copy.heroAccent}</em>
          </h1>
          <p className="pub-lead">{copy.heroIntro}</p>
          <div className="pub-actions">
            <a
              className="pub-button pub-button-primary"
              href={terminalHref(locale)}
            >
              {copy.openTerminal} <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a
              className="pub-button pub-button-outline"
              href={knowledgePaths[locale]}
            >
              <BookOpen size={17} aria-hidden="true" /> {copy.readGuides}
            </a>
          </div>
        </div>
        <MarketChart locale={locale} />
      </section>
      <section className="pub-feature-band" aria-label={copy.features}>
        <div className="pub-wrap pub-features">
          {features.map(({ icon: Icon, title, body }) => (
            <div className="pub-feature" key={title}>
              <span className="pub-topic-icon">
                <Icon size={20} aria-hidden="true" />
              </span>
              <div>
                <h2>{title}</h2>
                <p>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="pub-wrap pub-section">
        <div className="pub-section-head">
          <div>
            <h2>{copy.firstGuides}</h2>
            <p>{copy.firstGuidesIntro}</p>
          </div>
          <a className="pub-text-link" href={knowledgePaths[locale]}>
            {copy.allGuides} <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
        <div className="pub-grid">
          {guides.slice(0, 3).map((guide) => (
            <GuideCard key={guide.slug} guide={guide} locale={locale} />
          ))}
        </div>
      </section>
      <section className="pub-wrap pub-section pub-home-note">
        <div>
          <h2>{copy.dataTitle}</h2>
          <p>{copy.dataBody}</p>
        </div>
        <a className="pub-text-link" href={infoPaths.methodology[locale]}>
          {copy.readMethodology} <ArrowRight size={17} aria-hidden="true" />
        </a>
      </section>
    </>
  );
}
