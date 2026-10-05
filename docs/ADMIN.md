# Administration and managed AI agents

Release 1.2.0-rc.1. The administration view is available from the terminal navigation after signing in as an administrator. It is translated into English, Polish and German.

## First administrator

There is no public administrator registration endpoint or default production password.

1. Apply the new migration to an existing deployment: `npm run migrate` (Docker: `docker compose run --rm migrate`). Migration `005_admin.sql` adds roles, suspension, managed agents and versioned application settings. Existing users remain ordinary users.
2. Register the account through the normal email or wallet flow. Get **your own** UUID from the `user.id` field of `/api/v1/auth/me` while signed in (browser developer tools, Network), or query the account using the operator's database access.
3. On the server, using the same database as the application, run:

   ```sh
   npm run admin:bootstrap -- YOUR_EXISTING_USER_UUID
   # Docker, after migration:
   docker compose run --rm web node scripts/admin-bootstrap.mjs YOUR_EXISTING_USER_UUID
   ```

4. Sign in again. Bootstrap revokes this account's old sessions and records an audit event. Open **Administration / Administracja / Administration**.
5. Enable account 2FA in Settings. When 2FA is enabled, every admin mutation requires a current TOTP code in the admin panel. Reading admin pages does not require another code.

Bootstrap only works when no active administrator exists and only promotes an existing active account. Other administrators are granted through the Users tab. Self-demotion, self-suspension and deletion of one's own admin account are refused. To delete an admin account, another administrator must first demote it. The last active administrator cannot be removed through user-access changes.

## Agents and API keys

- Add a name, provider, exact provider model ID, optional description/research preferences and access tier.
- Providers: OpenAI, Google Gemini, Anthropic, OpenRouter and an operator-configured local OpenAI-compatible endpoint.
- Paste a provider API key and save. A blank key on edit retains the existing key. Removing a key is explicit; an enabled hosted agent must have a key. Changing provider clears the old provider's key and needs a new one before enabling.
- Keys are encrypted with AES-256-GCM using `BYOK_ENCRYPTION_KEY`. Authenticated data binds the envelope to the agent UUID, provider and `BYOK_KEY_ID`. Key values/envelopes are never returned by admin reads or the public-to-users agent catalog. Saved keys cannot be revealed in the UI.
- Test the saved connection before enabling the agent. Disabled drafts can be tested by administrators without publishing them. The test sends a small acknowledgement request, does not fetch market data, and consumes the administrator's daily AI allowance. Provider responses are not shown by this test endpoint.
- Enable the agent to expose it in signed-in users' **AI agent** selectors. Free/Pro access is checked again on the server. Administrators can inspect/test Pro agents even on a Free account, with their own normal account quota.
- Users may continue using their personal BYOK keys. Choosing a managed agent uses its server-side provider/model/key for quick/deep/explain analyses, chat, journal review, watchlist scans, daily briefs and schedules. The server overrides client-supplied provider/model when an agent ID is selected.
- Research preferences supplement the existing evidence-based analyst prompt. Schema/semantic validation, uncertainty instructions, language selection and risk controls remain in place. This is a research configuration system, not arbitrary executable plugins or a trade execution module.
- Local endpoint URL, host allowlist and optional key stay operator-configured through `LOCAL_LLM_URL`, `LOCAL_LLM_ALLOWED_HOSTS` and `LOCAL_LLM_KEY`. The panel does not accept arbitrary provider URLs.
- Agent edits use optimistic versions. If an agent changes after a job is queued, the worker fails the old job with `agent_changed`; it does not silently run a different configuration. Disabling/deleting an agent blocks subsequent calls and pending analyses. Already-running provider calls may finish. Historical results are retained.
- `scripts/rotate-keys.mjs` now rotates user credentials, TOTP and managed-agent envelopes in one database transaction. Stop application/worker writes and follow the existing key-rotation procedure; keep encrypted backups and keys together under operator control.

## Application settings

The Settings tab controls AI availability, per-user Free/Pro daily request counts and USD budget accounting, plus an application announcement in all three languages. Changes use a version check and an audit event. Configured database values take precedence over the initial environment defaults.

Pausing AI blocks new requests and jobs that have not started their provider call. Queued jobs become failed with no provider-call charge when handled by the worker; already-running calls may complete. Charts/account access remain available. Admin connection tests also respect AI pause and limits.

Budgets use existing conservative reservations and recorded token-price estimates. They are not an external provider billing cap. Configure `MODEL_PRICING_JSON` on the server for known model prices; unknown costs remain conservatively accounted. Daily counters use UTC. Subscription tiers remain owned by the Stripe subscription system; role changes do not grant a paid subscription.

## Users, jobs and audit

- Search users by email, wallet address or exact UUID, with pages of 25 accounts.
- Grant/revoke admin access or suspend/restore an account. Saving access changes revokes HTTP sessions and unused drawing tickets; suspension disables schedules. Restoring access does not silently reactivate schedules. New sign-ins and worker AI calls check suspension.
- Show the most recent 100 analysis jobs with provider/model/status, safe error codes and recorded costs. Cancel only queued jobs. The cancellation transition and reservation release are atomic and happen once; running jobs cannot be cancelled through this endpoint.
- Browse audit records in pages of 50. Agent/config/user/job changes and connection tests are recorded without secret key values. The panel does not expose user journal notes, attachments or portfolio contents.

API routes are documented in `packages/contracts/openapi.json`: `/agents` and `/admin/{overview,agents,users,settings,jobs,audit,agent-tests,job-cancellations}` with UUID-specific agent/user routes. Admin routes require a current admin session; mutations also require exact Origin and session CSRF, plus TOTP if enabled. Unknown methods are rejected before dispatch.

## Verification and remaining checks

49 unit/integration tests passed, including 9 administration/bootstrap tests. Strict TypeScript, production build, schema/locale contracts and production-mode HTTP smoke passed. The smoke covers wallet registration, ordinary-user admin denial, admin sign-in, encrypted agent storage and user-visible catalog metadata. Provider integration is verified using recorded/stub responses; no real LLM credential was supplied.

Nine Playwright scenarios are discoverable, including two administration flows. The browser test server now seeds an isolated local test administrator before launching Next; it refuses production mode and an external database. These test credentials are only for that isolated loopback test server. Browser execution/visual QA remains unverified because Chromium is unavailable in this environment. Docker/PostgreSQL/Redis and real provider credentials still require staging checks.
