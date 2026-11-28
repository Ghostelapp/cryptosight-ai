export function ArticleAd({
  publisher,
  slot,
  nonce,
  label,
}: {
  publisher: string;
  slot: string;
  nonce: string;
  label: string;
}) {
  return (
    <aside className="pub-ad" aria-label={label}>
      <p>{label}</p>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={publisher}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
      <script
        async
        nonce={nonce}
        crossOrigin="anonymous"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}`}
      />
      <script
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: "(window.adsbygoogle = window.adsbygoogle || []).push({});",
        }}
      />
    </aside>
  );
}
