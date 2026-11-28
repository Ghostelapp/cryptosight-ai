import "./globals.css";
import { headers } from "next/headers";
import { isPublicLocale } from "../lib/public-routes";
export const metadata = {
  title: "CryptoSight AI",
  description: "Crypto market charts, structured AI research and risk tools.",
  icons: { icon: "/favicon.svg" },
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = (await headers()).get("x-doc-lang");
  const lang = isPublicLocale(locale) ? locale : "en";
  return (
    <html lang={lang} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
