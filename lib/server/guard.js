import { clientIp } from "./session";

/*
 * ============================================================
 * RATE LIMITS
 * ============================================================
 *
 * How often one address (or one account) may do something
 * sensitive: look up numbers, try PINs, place orders, send
 * feedback. Counted per server in memory, so it is a brake,
 * not a wall; PIN lockouts in the database are the wall.
 */

const buckets = new Map();

const MAX_KEYS = 20000;

function sweep(now) {
    if (buckets.size < MAX_KEYS) {
        return;
    }

    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) {
            buckets.delete(key);
        }
    }

    // Still full (an attack from many addresses): start over.
    if (buckets.size >= MAX_KEYS) {
        buckets.clear();
    }
}

/*
 * true when `key` has gone over `limit` actions in the last
 * `windowMs` milliseconds (this one included).
 */
export function overLimit(key, limit, windowMs) {
    const now = Date.now();

    sweep(now);

    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.set(key, bucket);
    }

    bucket.count += 1;

    return bucket.count > limit;
}

/*
 * Answers 429 and returns true when the caller's address is
 * over the limit for this action.
 */
export function limitByIp(req, res, action, limit, windowMs) {
    if (!overLimit(`${action}|${clientIp(req)}`, limit, windowMs)) {
        return false;
    }

    res.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
    res.status(429).json({
        error: "Too many attempts. Please wait a few minutes and try again.",
        code: "RATE_LIMITED",
    });

    return true;
}
