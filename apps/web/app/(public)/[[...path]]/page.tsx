import { notFound } from "next/navigation";
import { GuideArticle } from "../../../components/public/guide";
import { PublicHome } from "../../../components/public/home";
import { getInfo, PublicInfo } from "../../../components/public/info";
import { SitemapIndex } from "../../../components/public/sitemap-index";
import { KnowledgeIndex } from "../../../components/public/knowledge-index";
import { PublicFooter, PublicHeader } from "../../../components/public-site";
import { getGuides } from "../../../lib/knowledge";
import { publicCopy } from "../../../lib/public-copy";
import { matchPublicPath } from "../../../lib/public-routes";
import {
  adSensePublisher,
  publisherDetails,
  publisherPages,
  publicMetadata,
} from "../../../lib/public-site";
import "../public.css";

type Props = { params: Promise<{ path?: string[] }> };

async function getRoute(params: Props["params"]) {
  const { path } = await params;
  const route = matchPublicPath(`/${(path ?? []).join("/")}`);
  if (!route) notFound();
  return route;
}

export async function generateMetadata({ params }: Props) {
  const { locale, page } = await getRoute(params);
  const copy = publicCopy[locale];

  switch (page.kind) {
    case "home": {
      const publisher = adSensePublisher();
      return {
        ...publicMetadata(locale, page, copy.homeTitle, copy.homeDescription),
        other: publisher ? { "google-adsense-account": publisher } : undefined,
      };
    }
    case "sitemap":
      return publicMetadata(locale, page, copy.sitemap, copy.sitemapIntro);
    case "knowledge":
      return publicMetadata(
        locale,
        page,
        copy.knowledge,
        copy.knowledgeDescription,
      );
    case "info": {
      const { title, description } = getInfo(locale, page.id);
      return {
        ...publicMetadata(locale, page, title, description),
        robots:
          !publisherDetails() && publisherPages.has(page.id)
            ? { index: false, follow: true }
            : undefined,
      };
    }
    case "guide": {
      const guide = getGuides(locale).find((item) => item.slug === page.id);
      if (!guide) notFound();
      return publicMetadata(locale, page, guide.title, guide.summary);
    }
  }
}

export default async function PublicSitePage({ params }: Props) {
  const { locale, page } = await getRoute(params);
  let content;

  switch (page.kind) {
    case "home":
      content = <PublicHome locale={locale} />;
      break;
    case "sitemap":
      content = <SitemapIndex locale={locale} />;
      break;
    case "knowledge":
      content = <KnowledgeIndex locale={locale} />;
      break;
    case "info":
      content = <PublicInfo locale={locale} id={page.id} />;
      break;
    case "guide": {
      const guide = getGuides(locale).find((item) => item.slug === page.id);
      if (!guide) notFound();
      content = <GuideArticle locale={locale} guide={guide} />;
      break;
    }
  }

  return (
    <div className="pub-site">
      <a className="pub-skip" href="#tresc">
        {publicCopy[locale].skip}
      </a>
      <PublicHeader locale={locale} page={page} />
      <main id="tresc" tabIndex={-1}>
        {content}
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
