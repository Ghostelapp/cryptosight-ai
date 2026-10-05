import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: [
    "@electric-sql/pglite",
    "pg",
    "pdfkit",
    "technicalindicators",
    "ioredis",
    "bullmq",
    "nodemailer",
    "rss-parser",
    "web-push",
    "@sentry/node",
  ],
  outputFileTracingIncludes: {
    "/api/v1/*": [
      "../../db/*.sql",
      "../../packages/contracts/*.json",
      "./public/fonts/*",
      "./messages/*.json",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
