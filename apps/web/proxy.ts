import { NextRequest, NextResponse } from "next/server";
import { matchPublicPath } from "./lib/public-routes";
import { adSenseConfig } from "./lib/public-site";

import { siteRoute } from "./lib/site-routing.mjs";

export function proxy(request: NextRequest) {
  const externalUrl = new URL(request.nextUrl.href);
  externalUrl.host = request.headers.get("host") || externalUrl.host;
  const route = siteRoute(
    externalUrl.href,
    process.env.APP_ORIGIN,
    process.env.PUBLIC_ORIGIN,
  );
  if (route?.kind === "redirect") {
    const response = NextResponse.redirect(route.url);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
  const pathname = request.nextUrl.pathname;
  const publicRoute =
    route?.kind === "rewrite" || pathname === "/terminal"
      ? undefined
      : matchPublicPath(pathname);
  const market =
    publicRoute?.page.kind === "home"
      ? " https://data-api.binance.vision wss://data-stream.binance.vision"
      : "";
  const ads = publicRoute?.page.kind === "guide" && adSenseConfig();
  const nonce = Buffer.from(
    crypto.getRandomValues(new Uint8Array(18)),
  ).toString("base64");
  const dev = process.env.NODE_ENV !== "production";
  const gateway = process.env.NEXT_PUBLIC_GATEWAY_URL || "";
  let gatewayOrigin = "";
  try {
    const u = new URL(gateway);
    if (["ws:", "wss:"].includes(u.protocol)) gatewayOrigin = u.origin;
  } catch {}
  const google = ads
    ? " https://*.googlesyndication.com https://*.doubleclick.net https://*.googleadservices.com https://*.googletagservices.com https://*.google.com https://*.gstatic.com"
    : "";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${google}${dev || ads ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'${google}`,
    `img-src 'self' data: blob:${google}`,
    `font-src 'self'${google}`,
    `connect-src 'self' https://challenges.cloudflare.com wss://stream.binance.com:9443 wss://fstream.binance.com wss://stream.bybit.com wss://ws.okx.com ${gatewayOrigin}${google}${market}${dev ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
    `frame-src https://challenges.cloudflare.com${google}`,
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("x-doc-lang", publicRoute?.locale ?? "en");
  headers.set("Content-Security-Policy", csp);
  const response =
    route?.kind === "rewrite"
      ? NextResponse.rewrite(
          new URL("/terminal" + request.nextUrl.search, externalUrl),
          { request: { headers } },
        )
      : NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.svg|fonts|licenses|workers|sw.js|market-chart.mjs).*)",
  ],
};
