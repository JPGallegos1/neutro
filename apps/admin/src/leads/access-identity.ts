export function accessEmailFromHeaders(headers: Headers): string | null {
  const raw = headers.get("Cf-Access-Authenticated-User-Email");
  if (!raw) return null;
  const email = raw.trim().toLowerCase();
  return email.length > 0 ? email : null;
}

export function accessEmailFromJwtPayload(token: string): string | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const payload = parts[1];
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
  const fromHeader = accessEmailFromHeaders(headers);
  if (fromHeader) return fromHeader;
  const jwt = headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt) return null;
  return accessEmailFromJwtPayload(jwt);
}
