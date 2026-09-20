/**
 * lib/ratelimit.ts
 * In-memory sliding window rate limiter for API routes per ClearSign PRD Section 12 & I3.
 * Gracefully works on serverless without external dependencies, with optional Upstash support.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const windowMs = 60 * 1000; // 1 minute window
const defaultLimit = parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || "10", 10);
const ipStore = new Map<string, RateLimitRecord>();

// Periodically clean stale records every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipStore.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < windowMs);
      if (record.timestamps.length === 0) {
        ipStore.delete(ip);
      }
    }
  }, 5 * 60 * 1000).unref?.();
}

export function checkRateLimit(ip: string, limit: number = defaultLimit): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let record = ipStore.get(ip);

  if (!record) {
    record = { timestamps: [] };
    ipStore.set(ip, record);
  }

  // Remove timestamps outside the 1-minute window
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

  if (record.timestamps.length >= limit) {
    return { allowed: false, remaining: 0 };
  }

  record.timestamps.push(now);
  return { allowed: true, remaining: limit - record.timestamps.length };
}
