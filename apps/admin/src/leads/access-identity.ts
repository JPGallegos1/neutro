export function accessEmailFromHeaders(headers: Headers): string | null {
  const email = headers.get("Cf-Access-Authenticated-User-Email")?.trim().toLowerCase();
  return email && email.length > 0 ? email : null;
}

export function accessEmailFromJwtPayload(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { email?: unknown };
    if (typeof json.email !== "string") return null;
    const email = json.email.trim().toLowerCase();
    return email.length > 0 ? email : null;
  } catch {
    return null;
  }
}

export function resolveAccessEmail(headers: Headers): string | null {
  return (
    accessEmailFromHeaders(headers) ??
    (headers.get("Cf-Access-Jwt-Assertion")
      ? accessEmailFromJwtPayload(headers.get("Cf-Access-Jwt-Assertion")!)
      : null)
  );
}
