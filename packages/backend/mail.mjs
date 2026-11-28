import nodemailer from "nodemailer";
import { mailConfig } from "./integrations.mjs";
export async function email(to, subject, text) {
  const config = await mailConfig();
  if (!config.ready) throw new Error("email_not_configured");
  try {
    if (config.smtp) {
      await nodemailer
        .createTransport(config.smtp, {
          connectionTimeout: 8000,
          greetingTimeout: 8000,
          socketTimeout: 15000,
        })
        .sendMail({ from: config.from, to, subject, text });
      return;
    }
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: "Bearer " + config.secret,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: config.from, to: [to], subject, text }),
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    if (!r.ok) throw new Error("delivery_failed");
  } catch {
    throw new Error("email_delivery_failed");
  }
}
