const legacyParameters = [
  "verify",
  "reset",
  "mobileRequest",
  "oauthMfa",
  "billing",
];
export function siteRoute(requestUrl, appOrigin, publicOrigin) {
  const url = new URL(requestUrl),
    app = new URL(appOrigin || "http://localhost:3000");
  const onApp = url.host === app.host;
  const terminalPath = url.pathname === "/terminal";
  const accountLink =
    url.pathname === "/" &&
    legacyParameters.some((k) => url.searchParams.has(k));
  const mobile =
    url.pathname === "/mobile" || url.pathname.startsWith("/mobile/");
  if (!onApp && (terminalPath || accountLink || mobile)) {
    const target = new URL(mobile ? url.pathname : "/", app);
    target.search = url.search;
    return { kind: "redirect", url: target.href };
  }
  if (onApp && url.pathname === "/") {
    url.pathname = "/terminal";
    return { kind: "rewrite", url: url.href };
  }
  // Keep indexable marketing pages canonical on the public domain.
  if (
    onApp &&
    publicOrigin &&
    url.pathname !== "/terminal" &&
    !mobile &&
    !/^\/(api|_next)(\/|$)/.test(url.pathname) &&
    !url.pathname.includes(".")
  ) {
    const target = new URL(url.pathname, publicOrigin);
    target.search = url.search;
    return { kind: "redirect", url: target.href };
  }
  return null;
}
