import { adSensePublisher } from "../../lib/public-site";

export const dynamic = "force-dynamic";

export function GET() {
  const publisher = adSensePublisher();
  if (!publisher) return new Response("Not found\n", { status: 404 });

  return new Response(
    `google.com, ${publisher.slice(3)}, DIRECT, f08c47fec0942fa0\n`,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
