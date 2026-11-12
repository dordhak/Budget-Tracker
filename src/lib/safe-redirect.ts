/**
 * Only allow same-origin relative paths as post-login redirects
 * (prevents open redirects such as ?next=//evil.example).
 */
export function safeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
