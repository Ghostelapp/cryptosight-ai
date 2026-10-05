import "./globals.css";
import { headers } from "next/headers";
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
  await headers();
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
