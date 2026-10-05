import { jsonFetch } from "./providers.mjs";
export async function calendar() {
  if (!process.env.CALENDAR_API_URL)
    return {
      events: [],
      unavailableReason: "calendar_provider_not_configured",
    };
  const url = new URL(process.env.CALENDAR_API_URL);
  if (url.protocol !== "https:") throw new Error("invalid_calendar_url");
  try {
    const rows = await jsonFetch(url.href, {
      headers: process.env.CALENDAR_API_KEY
        ? { authorization: `Bearer ${process.env.CALENDAR_API_KEY}` }
        : {},
      redirect: "error",
    });
    if (!Array.isArray(rows)) throw new Error("invalid_calendar");
    const events = rows
      .slice(0, 100)
      .filter(
        (e) =>
          typeof e.title === "string" &&
          ["low", "medium", "high"].includes(e.impact) &&
          Number.isFinite(Date.parse(e.timestamp)),
      )
      .map((e) => ({
        title: e.title.slice(0, 200),
        timestamp: e.timestamp,
        impact: e.impact,
        country: String(e.country || "").slice(0, 20),
      }));
    return {
      events,
      source: url.hostname,
      fetchedAt: new Date().toISOString(),
      highImpactWindow: events.some(
        (e) =>
          e.impact === "high" &&
          Math.abs(Date.parse(e.timestamp) - Date.now()) < 3600000,
      ),
    };
  } catch {
    return { events: [], unavailableReason: "calendar_unavailable" };
  }
}
