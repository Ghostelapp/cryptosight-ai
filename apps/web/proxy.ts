import { NextRequest, NextResponse } from "next/server";
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(
    crypto.getRandomValues(new Uint8Array(18)),
  ).toString("base64");
  const dev = process.env.NODE_ENV !== "production";
  const gateway = process.env.NEXT_PUBLIC_GATEWAY_URL || "";
  let gatewayOrigin = "";
  try {
    const u = new URL(gateway);
    if (["ws:", "wss:"].includes(u.protocol)) gatewayOrigin = u.origin;
  } catch {}
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' wss://stream.binance.com:9443 wss://fstream.binance.com wss://stream.bybit.com wss://ws.okx.com ${gatewayOrigin}${dev ? " ws://localhost:* ws://127.0.0.1:*" : ""}; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.svg|fonts|licenses|workers|sw.js).*)",
  ],
};
