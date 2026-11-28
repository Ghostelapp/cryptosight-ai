import { test } from "node:test";
import assert from "node:assert/strict";
import { siteRoute } from "../apps/web/lib/site-routing.mjs";
const app = "https://app.cryptosight.tech",
  pub = "https://cryptosight.tech";
test("public homepage stays public while app root rewrites internally and keeps query", () => {
  assert.equal(siteRoute(pub + "/", app, pub), null);
  assert.deepEqual(siteRoute(app + "/?lang=pl", app, pub), {
    kind: "rewrite",
    url: app + "/terminal?lang=pl",
  });
  assert.equal(siteRoute(app + "/api/v1/auth/me", app, pub), null);
  assert.equal(siteRoute(app + "/market-chart.mjs", app, pub), null);
});
test("old account links and mobile pairing move to fixed app origin with tokens intact", () => {
  for (const query of [
    "reset=one-use-token",
    "verify=verification-token",
    "mobileRequest=pairing",
    "oauthMfa=1",
    "billing=success",
  ])
    assert.deepEqual(siteRoute(pub + "/?" + query, app, pub), {
      kind: "redirect",
      url: app + "/?" + query,
    });
  assert.deepEqual(siteRoute(pub + "/terminal?lang=de", app, pub), {
    kind: "redirect",
    url: app + "/?lang=de",
  });
  assert.deepEqual(siteRoute(pub + "/mobile/connect?request=pair", app, pub), {
    kind: "redirect",
    url: app + "/mobile/connect?request=pair",
  });
  assert.equal(siteRoute(app + "/mobile/connect?request=pair", app, pub), null);
});
test("marketing translations on the app domain use the public canonical origin", () => {
  assert.deepEqual(siteRoute(app + "/en?ref=nav", app, pub), {
    kind: "redirect",
    url: pub + "/en?ref=nav",
  });
  assert.equal(siteRoute(app + "/terminal", app, pub), null);
  assert.equal(
    siteRoute("http://127.0.0.1:3100/", "http://127.0.0.1:3100").kind,
    "rewrite",
  );
});
