import { messages } from "./localization.mjs";
import {email} from './mail.mjs';
export {email} from './mail.mjs';
import Parser from "rss-parser";
import { query, transaction } from "./store.mjs";
import { history } from "../market/providers.mjs";
import { indicators } from "../quant/indicators.mjs";
import { queueAnalysis } from "./jobs.mjs";
export async function news() {
  if (!process.env.NEWS_RSS_URL)
    return { items: [], unavailableReason: "news_not_configured" };
  const url = new URL(process.env.NEWS_RSS_URL);
  if (url.protocol !== "https:") throw new Error("invalid_news_url");
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("news_unavailable");
  const xml = await response.text();
  if (xml.length > 1000000) throw new Error("news_too_large");
  const parser = new Parser();
  const feed = await parser.parseString(xml);
  return {
    items: feed.items.slice(0, 12).map((i) => ({
      title: i.title,
      link: i.link?.startsWith("https://") ? i.link : null,
      date: i.isoDate,
      summary: i.contentSnippet?.slice(0, 400),
    })),
    source: url.hostname,
  };
}
export async function alertsTick() {
  const rows = (
    await query(
      "SELECT a.*,u.email,u.settings FROM alerts a JOIN users u ON u.id=a.user_id WHERE enabled=true AND (last_triggered_at IS NULL OR last_triggered_at<now()-interval '5 minutes') ORDER BY a.created_at LIMIT 100",
    )
  ).rows;
  for (const a of rows) {
    try {
      const condition = a.condition;
      const data = await history(condition, { limit: 220 });
      if (data.provenance.stale) continue;
      const candles = data.candles.filter((c) => c.closed),
        i = indicators(candles),
        price = data.candles.at(-1)?.close;
      let hit = false;
      if (a.kind === "price")
        hit =
          condition.comparison === "above"
            ? price >= condition.price
            : price <= condition.price;
      if (a.kind === "indicator") {
        const value = condition.indicator === "RSI" ? i.RSI : i.EMA[20];
        hit =
          condition.comparison === "above"
            ? value >= condition.value
            : value <= condition.value;
      }
      if (a.kind === "drawing") {
        const d = (
          await query(
            "SELECT payload FROM drawings WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL",
            [condition.drawingId, a.user_id],
          )
        ).rows[0];
        const p = d?.payload.points;
        if (p?.length) {
          let level = p[0].value;
          if (p.length >= 2 && p[1].timestamp !== p[0].timestamp)
            level =
              p[0].value +
              ((p[1].value - p[0].value) *
                (candles.at(-1).timestamp - p[0].timestamp)) /
                (p[1].timestamp - p[0].timestamp);
          hit = candles.at(-1).low <= level && candles.at(-1).high >= level;
        }
      }
      if (a.kind === "ai_signal") {
        hit =
          (
            await query(
              "SELECT 1 FROM analyses WHERE user_id=$1 AND status='completed' AND created_at>COALESCE($2::timestamptz,now()-interval '5 minutes') AND request_config->>'symbol'=$3 AND EXISTS(SELECT 1 FROM jsonb_array_elements(result->'setups') s WHERE s->>'direction' IN ('LONG','SHORT')) LIMIT 1",
              [a.user_id, a.last_triggered_at, condition.symbol],
            )
          ).rows.length > 0;
      }
      if (!hit) continue;
      const eventKey = `${a.id}:${candles.at(-1).timestamp}`,
        claimed = await query(
          "INSERT INTO notification_deliveries(alert_id,channel,event_key,status) VALUES($1,'in_app',$2,'sent') ON CONFLICT DO NOTHING RETURNING id",
          [a.id, eventKey],
        );
      if (!claimed.rows.length) continue;
      await query(
        "INSERT INTO notifications(user_id,title_key,data) VALUES($1,'alert_triggered',$2)",
        [
          a.user_id,
          JSON.stringify({ symbol: condition.symbol, kind: a.kind, price }),
        ],
      );
      await query("UPDATE alerts SET last_triggered_at=now() WHERE id=$1", [
        a.id,
      ]);
      for (const channel of a.channels.filter((c) => c !== "in_app")) {
        await query(
          "INSERT INTO notification_deliveries(alert_id,channel,event_key,status) VALUES($1,$2,$3,'pending') ON CONFLICT DO NOTHING",
          [a.id, channel, eventKey],
        );
      }
    } catch {}
  }
}
export async function deliveriesTick() {
  const list = (
    await query(
      "SELECT d.*,a.user_id,a.condition,u.email,u.locale,u.settings,u.push_subscription FROM notification_deliveries d JOIN alerts a ON a.id=d.alert_id JOIN users u ON u.id=a.user_id WHERE d.status='pending' AND d.attempts<3 ORDER BY d.created_at LIMIT 20",
    )
  ).rows;
  for (const d of list) {
    try {
      const copy = messages(d.locale);
      const text =
        copy.alertEmailBody + " " + d.condition.symbol + ". " + copy.disclaimer;
      if (d.channel === "email") {
        if (!d.email) throw new Error("email_required");
        await email(d.email, copy.alertEmailSubject, text);
      } else if (d.channel === "telegram") {
        if (!process.env.TELEGRAM_BOT_TOKEN || !d.settings.telegramChatId)
          throw new Error("telegram_not_configured");
        const r = await fetch(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ chat_id: d.settings.telegramChatId, text }),
            signal: AbortSignal.timeout(10000),
          },
        );
        if (!r.ok) throw new Error("delivery_failed");
      } else if (d.channel === "push") {
        if (
          !d.push_subscription ||
          !process.env.VAPID_PUBLIC_KEY ||
          !process.env.VAPID_PRIVATE_KEY
        )
          throw new Error("push_not_configured");
        const { default: webpush } = await import("web-push");
        webpush.setVapidDetails(
          process.env.VAPID_SUBJECT,
          process.env.VAPID_PUBLIC_KEY,
          process.env.VAPID_PRIVATE_KEY,
        );
        await webpush.sendNotification(
          d.push_subscription,
          JSON.stringify({ title: "CryptoSight AI", body: text }),
        );
      }
      await query(
        "UPDATE notification_deliveries SET status='sent',attempts=attempts+1 WHERE id=$1",
        [d.id],
      );
    } catch {
      await query(
        "UPDATE notification_deliveries SET attempts=attempts+1,status=CASE WHEN attempts>=2 THEN 'failed' ELSE 'pending' END WHERE id=$1",
        [d.id],
      );
    }
  }
}
export async function schedulesTick() {
  const rows = await transaction(async (tx) => {
    const r = await tx.query(
      "SELECT s.*,u.tier FROM schedules s JOIN users u ON u.id=s.user_id WHERE enabled AND next_run<=now() ORDER BY next_run FOR UPDATE OF s SKIP LOCKED LIMIT 10",
    );
    for (const s of r.rows)
      await tx.query(
        "UPDATE schedules SET next_run=now()+(interval_minutes||' minutes')::interval WHERE id=$1",
        [s.id],
      );
    return r.rows;
  });
  for (const s of rows) {
    try {
      await queueAnalysis(
        { id: s.user_id, tier: s.tier },
        s.config,
        `${s.id}:${new Date(s.next_run).toISOString()}`,
      );
    } catch {}
  }
}
