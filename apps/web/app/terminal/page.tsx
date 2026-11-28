import type { Metadata } from "next";
import TerminalClient from "./terminal-client";

export const metadata: Metadata = {
  title: "Terminal | CryptoSight AI",
  robots: { index: false, follow: true },
};

export default function TerminalPage() {
  return <TerminalClient />;
}
