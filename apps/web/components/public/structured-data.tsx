import { headers } from "next/headers";
import type { Guide } from "../../lib/knowledge";
import { publicCopy } from "../../lib/public-copy";
import {
  homePage,
  knowledgePage,
  publicHref,
  type PublicLocale,
} from "../../lib/public-routes";
import { publicOrigin } from "../../lib/public-site";

export async function PublicStructuredData({
  locale,
  guide,
}: {
  locale: PublicLocale;
  guide?: Guide;
}) {
  const origin = publicOrigin();
  if (!origin) return null;
  const nonce = (await headers()).get("x-nonce");
  if (!nonce) return null;
  const copy = publicCopy[locale];
  const home = new URL(publicHref(locale, homePage), origin).href;
  let graph: unknown[] = [
    {
      "@type": "WebSite",
      name: "CryptoSight AI",
      url: home,
      inLanguage: locale,
    },
  ];

  if (guide) {
    const url = new URL(
      publicHref(locale, { kind: "guide", id: guide.slug }),
      origin,
    ).href;
    graph = [
      {
        "@type": "Article",
        headline: guide.title,
        description: guide.summary,
        url,
        mainEntityOfPage: url,
        inLanguage: locale,
        author: { "@type": "Organization", name: copy.byline, url: home },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: copy.homeLabel,
            item: home,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: copy.knowledge,
            item: new URL(publicHref(locale, knowledgePage), origin).href,
          },
          { "@type": "ListItem", position: 3, name: guide.title, item: url },
        ],
      },
    ];
  }
  const json = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": graph,
  }).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
