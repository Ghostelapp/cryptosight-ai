import { turnstileConfig } from "./integrations.mjs";
export async function verifyTurnstile(req, token, action) {
  const config = await turnstileConfig();
  if (!config.enabled) return;
  if (!config.ready) throw new Error("captcha_unavailable");
  if (typeof token !== "string" || !token || token.length > 2048)
    throw new Error("captcha_required");
  let data;
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret: config.secret, response: token }),
        signal: AbortSignal.timeout(8000),
        redirect: "error",
      },
    );
    if (!response.ok) throw new Error("unavailable");
    data = await response.json();
  } catch {
    throw new Error("captcha_unavailable");
  }
  const host = new URL(process.env.APP_ORIGIN || req.url).hostname;
  if (data.success !== true || data.hostname !== host || data.action !== action)
    throw new Error("captcha_failed");
}
