// Browser error tracking with Sentry. Off unless VITE_SENTRY_DSN is set at build time, and only then loaded.
// Reports exclude identities, typed text, console output and conversation IDs.

const hideConversation = (url: string) => url.split("?")[0].replace(/\/c\/[^/#]+/, "/c");

export function startMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  void import("@sentry/react")
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, genAI: { inputs: false, outputs: false } },
        tracesSampleRate: 0,
        beforeBreadcrumb: (crumb) => (crumb.category === "console" || crumb.category?.startsWith("ui.") ? null : crumb),
        beforeSend: (event) => {
          delete event.user;
          if (event.request) {
            delete event.request.data;
            delete event.request.cookies;
            delete event.request.query_string;
            if (event.request.url) event.request.url = hideConversation(event.request.url);
          }
          for (const crumb of event.breadcrumbs ?? []) {
            if (crumb.data) {
              for (const key of ["url", "from", "to"]) {
                if (typeof crumb.data[key] === "string") crumb.data[key] = hideConversation(crumb.data[key] as string);
              }
            }
          }
          return event;
        },
      });
    })
    .catch(() => { /* Error tracking must never affect the app. */ });
}
