import { handle } from "../../../../../packages/backend/api.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const url = new URL(req.url);
  url.pathname = "/api/v1/health";
  return handle(new Request(url, req));
}
