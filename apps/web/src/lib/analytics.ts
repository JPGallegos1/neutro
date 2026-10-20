export function isAnalyticsEnabled(): boolean {
  return (
    import.meta.env.PUBLIC_ANALYTICS_ENABLED === "true" &&
    Boolean(import.meta.env.PUBLIC_POSTHOG_KEY)
  );
}

export async function initAnalytics(): Promise<void> {
  const key = import.meta.env.PUBLIC_POSTHOG_KEY;

  if (import.meta.env.PUBLIC_ANALYTICS_ENABLED !== "true" || !key) {
    return;
  }

  const { default: posthog } = await import("posthog-js");

  posthog.init(key, {
    api_host: "/ingest",
    ui_host: "https://eu.posthog.com",
    cookieless_mode: "always",
    person_profiles: "never",
    disable_session_recording: true,
    disable_surveys: true,
  });
}
