# Mobile usability and regression stage

Updated 2026-10-05 (Europe/Warsaw), release 1.1.0-rc.2.

This is the historical mobile-change record. Browser execution and screenshot inspection became available in the 2026-11-14 update; see [VALIDATION.md](VALIDATION.md) and [PRODUCTIVITY-REVIEW.md](PRODUCTIVITY-REVIEW.md) for current results.

## Changes

- Replaced the mobile sidebar with a Radix modal navigation drawer: backdrop dismissal, Escape, focus containment, return focus, localized title and close control, and current-page announcement.
- Added mobile links between the chart and AI analysis without hiding either panel.
- Increased primary touch targets, made timeframe controls scroll locally and allowed market selectors/header actions to wrap.
- Added 16px mobile form fonts, narrow-screen form columns, long-text wrapping and locally scrolling tables.
- Added a meaningful accessible label to the wallet/email account control and fixed the wallet row border variable.
- Updated the earlier mobile test to use the new localized navigation trigger.

## Verification

40 unit/integration tests passed; 3 optional live-provider tests skipped. Strict TypeScript and production build passed. Contract/schema and EN/PL/DE key parity passed. Production standalone HTTP smoke passed, including signed wallet registration and private paper-account access.

Playwright discovers 7 scenarios, including 3 new viewport cases (320/390/768px). New cases check drawer dismissal, focus return, Settings navigation, analysis anchor navigation and document overflow, and save screenshots when run.

**Browser execution and visual QA remain blocked.** The local attempt stops before page interaction because the Chromium headless-shell executable is absent. Prior installer downloads were truncated; this stage does not repeat those downloads. Run `npx playwright install --with-deps chromium` followed by `npm run test:e2e` in CI or an environment with access to Playwright downloads. Do not interpret scenario discovery or compilation as a browser pass.

Real extension signing, touch behavior, device screenshots and live venue connectivity remain to be verified. No new external deployment was made.
