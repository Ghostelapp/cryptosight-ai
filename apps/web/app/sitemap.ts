import type { MetadataRoute } from "next";
import { publicHref, publicLocales, publicPages } from "../lib/public-routes";
import {
  publicAlternates,
  publicOrigin,
  publisherDetails,
  publisherPages,
} from "../lib/public-site";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicOrigin();
  if (!origin) return [];
  const configured = Boolean(publisherDetails());
  return publicPages.flatMap((page) => {
    if (!configured && page.kind === "info" && publisherPages.has(page.id))
      return [];
    const languages = publicAlternates(origin, page);
    return publicLocales.map((locale) => ({
      url: new URL(publicHref(locale, page), origin).href,
      alternates: { languages },
    }));
  });
}
