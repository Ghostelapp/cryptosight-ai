import * as Sentry from "@sentry/node";
let initialized = false;
export function initializeMonitoring() {
  if (initialized) return;
  initialized = true;
  if (process.env.SENTRY_DSN)
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      sendDefaultPii: false,
      defaultIntegrations: false,
      autoSessionTracking: false,
      beforeSend: (event) => ({
        event_id: event.event_id,
        timestamp: event.timestamp,
        level: event.level,
        message: event.message,
        tags: event.tags,
      }),
    });
}
// Only bounded operator-defined codes enter logs or the external error sink.
export function recordFailure(component, requestId) {
  initializeMonitoring();
  const message = "cryptosight_service_failure";
  console.error(
    JSON.stringify({
      level: "error",
      event: message,
      component,
      request_id: requestId,
      timestamp: new Date().toISOString(),
    }),
  );
  if (process.env.SENTRY_DSN)
    Sentry.captureMessage(message, {
      level: "error",
      tags: { component, request_id: requestId },
    });
}
