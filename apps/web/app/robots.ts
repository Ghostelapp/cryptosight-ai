import { headers } from "next/headers";
import type { MetadataRoute } from "next";
import { publicOrigin } from "../lib/public-site";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host=(await headers()).get("host");
  if(process.env.APP_ORIGIN && host===new URL(process.env.APP_ORIGIN).host) return {rules:{userAgent:"*",disallow:"/"}};
  const origin = publicOrigin();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/mobile/", "/terminal"] },
    sitemap: origin ? `${origin}/sitemap.xml` : undefined,
  };
}
