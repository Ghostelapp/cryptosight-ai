import { messages } from "./localization.mjs";
import PDFDocument from "pdfkit";
import { resolve } from "node:path";
export async function report(result, locale = "en") {
  const doc = new PDFDocument({ margin: 45, bufferPages: true }),
    chunks = [];
  const ready = new Promise((resolve, reject) => {
    doc.on("data", (x) => chunks.push(x));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const root =
    process.env.PROJECT_ROOT ||
    (process.cwd().endsWith("/apps/web")
      ? resolve(process.cwd(), "../..")
      : process.cwd());
  doc.font(resolve(root, "apps/web/public/fonts/DejaVuSans.ttf"));
  const copy = messages(locale);
  const labels = {
    title: copy.reportTitle,
    summary: copy.reportSummary,
    levels: copy.reportSetups,
    risk: copy.risk,
    disclaimer: copy.disclaimer,
  };
  const fmt = (n) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(n);
  doc.fontSize(22).fillColor("#102030").text("CryptoSight AI");
  doc
    .fontSize(14)
    .text(`${labels.title} · ${result.symbol} · ${result.timeframe}`)
    .moveDown();
  doc.fontSize(10).text(result.timestamp).moveDown();
  doc
    .fontSize(14)
    .text(labels.summary)
    .fontSize(11)
    .text(result.summary_detailed)
    .moveDown();
  doc.fontSize(14).text(labels.levels);
  for (const s of result.setups) {
    doc
      .moveDown()
      .fontSize(12)
      .text(s.direction)
      .fontSize(10)
      .text(s.reasoning);
    if (s.direction !== "NO_TRADE") {
      doc.text(
        `${copy.entry}: ${fmt(s.entry.price)} | ${copy.stop}: ${fmt(s.stop_loss)} | RR: ${fmt(s.risk_reward)}`,
      );
      for (const tp of s.take_profits)
        doc.text(`TP: ${fmt(tp.price)} (${fmt(tp.size_pct)}%)`);
    }
    doc.text(s.invalidation).text(s.timing);
  }
  doc
    .moveDown()
    .fontSize(14)
    .text(labels.risk)
    .fontSize(10)
    .text(result.risk.factors.join("\n"))
    .text(result.risk.event_risk);
  doc.moveDown().fillColor("#555555").text(labels.disclaimer);
  doc.end();
  return ready;
}
