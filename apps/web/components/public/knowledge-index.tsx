import { GuideCard } from "../public-site";
import { getGuides } from "../../lib/knowledge";
import { publicCopy } from "../../lib/public-copy";
import type { PublicLocale } from "../../lib/public-routes";

export function KnowledgeIndex({ locale }: { locale: PublicLocale }) {
  const copy = publicCopy[locale];
  return (
    <section className="pub-wrap pub-section pub-index">
      <header className="pub-page-intro">
        <h1>{copy.knowledge}</h1>
        <p className="pub-lead">{copy.knowledgeIntro}</p>
      </header>
      <div className="pub-grid">
        {getGuides(locale).map((guide) => (
          <GuideCard key={guide.slug} guide={guide} locale={locale} />
        ))}
      </div>
    </section>
  );
}
