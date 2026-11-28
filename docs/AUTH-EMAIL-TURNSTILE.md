# Email authentication and Turnstile

On cryptosight.tech, use the wallet administrator account and open **Administration → Integrations**. Keys entered here are encrypted with the application BYOK master key. Reads return configuration and presence flags, never secret values. Changes require administrator privileges, CSRF and the current TOTP code when 2FA is enabled. Blank secret fields retain the stored key. Backups must preserve both the database and its existing master key.

## Resend

1. Verify `cryptosight.tech` in the Resend Domains dashboard using the DNS records supplied by Resend.
2. Create a sending API key. In the application's Resend card enter the verified sender, for example `noreply@cryptosight.tech`, and the key. Enable and save the integration.
3. In **Email delivery test**, enter your own recipient address and explicitly send a test. The application reports provider acceptance, not guaranteed inbox delivery; check spam and the Resend delivery log as well.
4. Check registration and the emailed verification link. Password recovery now opens a dedicated email-only request form. A reset link opens a new-password/confirmation form without requiring the old password or an email field. Successful recovery consumes remaining reset tokens, verifies the email proof and revokes existing web/native sessions.

With no mail transport, production registration and reset requests return an explicit unavailable result. The UI does not announce a sent reset email when sending is unconfigured. Failed provider delivery is reported without exposing the upstream response or key. A pending account can request another verification message after mail configuration is repaired.

Environment configuration remains supported: `SMTP_URL` plus `EMAIL_FROM`, or `RESEND_API_KEY` plus `EMAIL_FROM`. These take precedence over the database Resend integration. Leave them empty when managing this integration from the application.

## Cloudflare Turnstile

Create a Turnstile widget in Cloudflare for `cryptosight.tech`. Enter its public site key and secret key in the application, enable and save it. No Cloudflare DNS proxy change is required for the widget. Production rejects the built-in dummy widget keys in the admin configuration.

When enabled, email registration, password login, reset request, password reset and verification resend each require a fresh Turnstile token. The server checks Siteverify success, the configured application's hostname and the specific form action. Missing tokens, expired/reused tokens, wrong hosts/actions and upstream failures cannot bypass verification. The widget refreshes after submissions and on expiry. Wallet signature login and OAuth remain separate authentication flows. Browser CSP permits the Cloudflare script/frame and retains nonce-based script policy.

The widget remains disabled until the owner supplies and enables valid keys; no dummy protection is installed in production. Optional environment overrides are `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`; partial environment configuration fails closed.

## Required upgrade

Apply migration `009_service_integrations.sql` and deploy the matching web/worker. Runtime roles need table privileges (the supplied PostgreSQL bootstrap's default grants cover new migrations). Resend/Turnstile activation and actual email delivery still require the owner's external account configuration. Automated checks use provider fixtures and do not send real emails or solve real challenges.
