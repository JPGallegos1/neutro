export const CONTACTO_TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

export type ContactoTurnstileEnv = {
  PUBLIC_TURNSTILE_SITE_KEY?: string;
  PROD?: boolean;
};

export function resolveContactoTurnstileSiteKey(
  env: ContactoTurnstileEnv,
): string {
  const key = env.PUBLIC_TURNSTILE_SITE_KEY;
  if (typeof key === "string" && key.trim().length > 0) {
    return key.trim();
  }
  if (env.PROD) {
    throw new Error(
      "Falta PUBLIC_TURNSTILE_SITE_KEY en el build de producción",
    );
  }
  return CONTACTO_TURNSTILE_TEST_SITE_KEY;
}
