export const routes = {
  "/health": [
    "get"
  ],
  "/markets": [
    "get"
  ],
  "/candles": [
    "get"
  ],
  "/depth": [
    "get"
  ],
  "/derivatives": [
    "get"
  ],
  "/context": [
    "get"
  ],
  "/news": [
    "get"
  ],
  "/risk": [
    "post"
  ],
  "/auth/wallet/challenge": [
    "post"
  ],
  "/auth/wallet/verify": [
    "post"
  ],
  "/wallets": [
    "get"
  ],
  "/auth/oauth/verify-totp": [
    "post"
  ],
  "/auth/resend-verification": [
    "post"
  ],
  "/auth/register": [
    "post"
  ],
  "/auth/login": [
    "post"
  ],
  "/auth/verify": [
    "post"
  ],
  "/auth/reset-request": [
    "post"
  ],
  "/auth/reset": [
    "post"
  ],
  "/auth/me": [
    "get"
  ],
  "/auth/logout": [
    "post"
  ],
  "/auth/oauth/start": [
    "get"
  ],
  "/auth/oauth/callback": [
    "get"
  ],
  "/ws-ticket": [
    "post"
  ],
  "/consents": [
    "post"
  ],
  "/settings": [
    "get",
    "patch"
  ],
  "/totp": [
    "get",
    "post",
    "delete"
  ],
  "/credentials": [
    "get",
    "post"
  ],
  "/credentials/{id}": [
    "delete"
  ],
  "/templates": [
    "get",
    "post"
  ],
  "/templates/{id}": [
    "delete"
  ],
  "/alerts": [
    "get",
    "post"
  ],
  "/alerts/{id}": [
    "delete"
  ],
  "/schedules": [
    "get",
    "post"
  ],
  "/schedules/{id}": [
    "delete"
  ],
  "/journal": [
    "get",
    "post"
  ],
  "/journal/{id}": [
    "delete"
  ],
  "/backtests": [
    "get",
    "post"
  ],
  "/analyses": [
    "get",
    "post"
  ],
  "/analyses/{id}": [
    "get"
  ],
  "/chat": [
    "post"
  ],
  "/drawings": [
    "get"
  ],
  "/drawings/{id}": [
    "put",
    "delete"
  ],
  "/watchlist": [
    "get",
    "post",
    "delete"
  ],
  "/notifications": [
    "get",
    "put"
  ],
  "/push": [
    "post"
  ],
  "/journal-review": [
    "post"
  ],
  "/attachments": [
    "post"
  ],
  "/attachments/{id}": [
    "get",
    "delete"
  ],
  "/paper/account": [
    "get"
  ],
  "/paper/orders": [
    "post"
  ],
  "/paper-close/{id}": [
    "post"
  ],
  "/paper-cancel/{id}": [
    "post"
  ],
  "/paper-protection/{id}": [
    "patch"
  ],
  "/backtests/{id}": [
    "get"
  ],
  "/daily-brief": [
    "get",
    "post"
  ],
  "/signals": [
    "get"
  ],
  "/correlation": [
    "get"
  ],
  "/scanner": [
    "get",
    "post"
  ],
  "/exchange/connect": [
    "post"
  ],
  "/exchange/portfolio": [
    "get"
  ],
  "/exchange/trades": [
    "get"
  ],
  "/reports": [
    "post"
  ],
  "/billing/checkout": [
    "post"
  ],
  "/billing/webhook": [
    "post"
  ],
  "/account/export": [
    "get"
  ],
  "/account": [
    "delete"
  ],
  "/agents": [
    "get"
  ],
  "/admin/overview": [
    "get"
  ],
  "/admin/users": [
    "get"
  ],
  "/admin/agents": [
    "get",
    "post"
  ],
  "/admin/jobs": [
    "get"
  ],
  "/admin/audit": [
    "get"
  ],
  "/admin/settings": [
    "get",
    "put"
  ],
  "/admin/agents/{id}": [
    "put",
    "delete"
  ],
  "/admin/agent-tests": [
    "post"
  ],
  "/admin/users/{id}": [
    "patch"
  ],
  "/admin/job-cancellations": [
    "post"
  ]
};
