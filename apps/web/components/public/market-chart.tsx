import { ArrowRight } from "lucide-react";
import { headers } from "next/headers";
import Script from "next/script";
import { publicCopy } from "../../lib/public-copy";
import { publicHref, type PublicLocale } from "../../lib/public-routes";

export async function MarketChart({ locale }: { locale: PublicLocale }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const copy = publicCopy[locale];
  return (
    <figure
      className="pub-chart"
      lang={locale}
      data-market-chart
      data-state="loading"
      data-loading={copy.chartLoading}
      data-live={copy.chartLive}
      data-snapshot={copy.chartSnapshot}
      data-unavailable={copy.chartUnavailable}
    >
      <div className="pub-chart-header">
        <div className="pub-chart-symbol">
          <span aria-hidden="true">₿</span>
          <div>
            <strong>BTC / USDT</strong>
            <small>Binance Spot · 1 min</small>
          </div>
        </div>
        <span className="pub-chart-tag" data-market-status role="status">
          {copy.chartLoading}
        </span>
      </div>
      <div className="pub-chart-quote">
        <span data-market-price>—</span>
        <time data-market-time />
      </div>
      <div className="pub-chart-body" aria-hidden="true">
        <div className="pub-candles" data-market-candles />
      </div>
      <figcaption className="pub-chart-footer">
        <span>{copy.candles}</span>
        <a
          className="pub-text-link"
          href={publicHref(locale, { kind: "guide", id: "swiece-ohlcv" })}
        >
          {copy.readChart} <ArrowRight size={15} aria-hidden="true" />
        </a>
      </figcaption>
      <Script
        type="module"
        src="/market-chart.mjs"
        nonce={nonce}
        strategy="afterInteractive"
      />
    </figure>
  );
}
