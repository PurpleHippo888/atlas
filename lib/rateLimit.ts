/**
 * Simple in-memory sliding-window rate limiter.
 * Per-IP, resets every windowMs milliseconds.
 * Not persistent across restarts -- suitable for single-container deploys.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

// Prune expired windows every 5 minutes to prevent unbounded growth
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, w] of windows) {
      if (w.resetAt < now) windows.delete(key);
    }
  }, 5 * 60 * 1000);
}

/**
 * Returns true if the request is allowed, false if rate-limited.
 * Default: 60 requests per minute per IP.
 */
export function checkRateLimit(
  ip: string,
  limit = 60,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  const existing = windows.get(ip);

  if (!existing || existing.resetAt < now) {
    windows.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (existing.count >= limit) return false;
  existing.count++;
  return true;
}

/** Extract the real client IP from Next.js request headers. */
export function getClientIp(req: { headers: { get: (h: string) => string | null } }): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
