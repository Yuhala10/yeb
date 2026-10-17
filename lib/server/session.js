import crypto from "crypto";

import supabaseAdmin from "../supabaseAdmin";

/*
 * ============================================================
 * SESSIONS, PINS AND ACCESS CHECKS
 * ============================================================
 *
 * Every API route asks this module who is calling. The
 * browser never talks to the database directly.
 *
 * Session token format: userId.expiresAt.signature
 */

export const SESSION_COOKIE = "tayeb_session";

export const SESSION_DURATION = 7 * 24 * 60 * 60;

export const ADMIN_PHONE = "681731512";

const PIN_MAX_ATTEMPTS = 5;

const PIN_LOCK_MINUTES = 15;

/*
 * Columns that must never leave the server.
 */
const PRIVATE_USER_FIELDS = [
    "pin_hash",
    "pin_failed_attempts",
    "pin_locked_until",
];

function getSecret() {
    const secret =
        process.env.TAYEB_SESSION_SECRET;

    if (!secret) {
        throw new Error(
            "TAYEB_SESSION_SECRET is not configured."
        );
    }

    return secret;
}

export function safeCompare(a, b) {
    if (
        typeof a !== "string" ||
        typeof b !== "string"
    ) {
        return false;
    }

    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);

    if (aBuffer.length !== bBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(
        aBuffer,
        bBuffer
    );
}

/* =========================================================
   PHONE NUMBERS
========================================================= */

/*
 * "+237 681 73 15 12", "237681731512" and "681731512" all
 * become "681731512".
 */
export function normalizePhone(value) {
    let digits =
        String(value || "").replace(/\D/g, "");

    if (
        digits.length === 12 &&
        digits.startsWith("237")
    ) {
        digits = digits.slice(3);
    }

    return digits;
}

export function isValidPhone(phone) {
    return /^[26]\d{8}$/.test(phone);
}

/* =========================================================
   TOKENS AND COOKIES
========================================================= */

export function createToken(userId) {
    const expiresAt =
        Math.floor(Date.now() / 1000) +
        SESSION_DURATION;

    const payload =
        `${userId}.${expiresAt}`;

    const signature =
        crypto
            .createHmac("sha256", getSecret())
            .update(payload)
            .digest("hex");

    return `${payload}.${signature}`;
}

export function verifyToken(token) {
    if (!token) {
        return null;
    }

    const parts = token.split(".");

    if (parts.length !== 3) {
        return null;
    }

    const [userId, expiresAtString, signature] = parts;

    const expiresAt = Number(expiresAtString);

    if (
        !userId ||
        !signature ||
        !Number.isFinite(expiresAt) ||
        expiresAt <= Math.floor(Date.now() / 1000)
    ) {
        return null;
    }

    const expectedSignature =
        crypto
            .createHmac("sha256", getSecret())
            .update(`${userId}.${expiresAt}`)
            .digest("hex");

    if (!safeCompare(signature, expectedSignature)) {
        return null;
    }

    return {
        userId,
        expiresAt,
    };
}

export function getCookie(req, name) {
    const cookieHeader = req.headers.cookie;

    if (!cookieHeader) {
        return null;
    }

    for (const cookie of cookieHeader.split(";")) {
        const separator = cookie.indexOf("=");

        if (separator === -1) {
            continue;
        }

        if (cookie.slice(0, separator).trim() !== name) {
            continue;
        }

        const value = cookie.slice(separator + 1).trim();

        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    }

    return null;
}

export function setSessionCookie(res, userId) {
    const parts = [
        `${SESSION_COOKIE}=${encodeURIComponent(createToken(userId))}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${SESSION_DURATION}`,
    ];

    if (process.env.NODE_ENV === "production") {
        parts.push("Secure");
    }

    res.setHeader("Set-Cookie", parts.join("; "));
}

/* =========================================================
   PINS
========================================================= */

export function isValidPin(pin) {
    return /^\d{4,6}$/.test(String(pin || ""));
}

export function hashPin(pin) {
    const salt = crypto.randomBytes(16).toString("hex");

    const hash =
        crypto
            .scryptSync(String(pin), salt, 32)
            .toString("hex");

    return `scrypt$${salt}$${hash}`;
}

function pinMatches(pin, stored) {
    const [scheme, salt, hash] = String(stored || "").split("$");

    if (scheme !== "scrypt" || !salt || !hash) {
        return false;
    }

    const candidate =
        crypto
            .scryptSync(String(pin), salt, 32)
            .toString("hex");

    return safeCompare(candidate, hash);
}

/*
 * Checks a PIN and counts failures. After 5 wrong PINs the
 * account is locked for 15 minutes, so a 4-digit PIN can't
 * be guessed by trying every number.
 *
 * Returns { ok: true } or { ok: false, error, status }.
 */
export async function checkUserPin(user, pin) {
    if (
        user.pin_locked_until &&
        new Date(user.pin_locked_until) > new Date()
    ) {
        return {
            ok: false,
            status: 429,
            code: "PIN_LOCKED",
            error: "Too many wrong PINs. Try again in 15 minutes.",
        };
    }

    if (pinMatches(pin, user.pin_hash)) {
        if (user.pin_failed_attempts) {
            await supabaseAdmin
                .from("users")
                .update({
                    pin_failed_attempts: 0,
                    pin_locked_until: null,
                })
                .eq("id", user.id);
        }

        return { ok: true };
    }

    const attempts = (user.pin_failed_attempts || 0) + 1;

    const locked = attempts >= PIN_MAX_ATTEMPTS;

    await supabaseAdmin
        .from("users")
        .update({
            pin_failed_attempts: locked ? 0 : attempts,
            pin_locked_until: locked
                ? new Date(Date.now() + PIN_LOCK_MINUTES * 60000).toISOString()
                : null,
        })
        .eq("id", user.id);

    return {
        ok: false,
        status: locked ? 429 : 401,
        code: locked ? "PIN_LOCKED" : "PIN_WRONG",
        error: locked
            ? "Too many wrong PINs. Try again in 15 minutes."
            : `Wrong PIN. ${PIN_MAX_ATTEMPTS - attempts} tries left.`,
    };
}

/* =========================================================
   USERS
========================================================= */

export function publicUser(user) {
    if (!user) {
        return null;
    }

    const copy = { ...user };

    for (const field of PRIVATE_USER_FIELDS) {
        delete copy[field];
    }

    return copy;
}

export const ADMIN_USER = {
    id: "admin",
    full_name: "Platform Administrator",
    phone_number: ADMIN_PHONE,
    role: "ADMIN",
};

/*
 * Finds a user by phone. Older accounts were saved exactly
 * as typed, so the raw value is tried too.
 */
export async function findUserByPhone(rawPhone) {
    const phone = normalizePhone(rawPhone);

    const candidates = [
        ...new Set(
            [phone, String(rawPhone || "").trim()].filter(Boolean)
        ),
    ];

    for (const candidate of candidates) {
        const { data, error } = await supabaseAdmin
            .from("users")
            .select("*")
            .eq("phone_number", candidate)
            .limit(1);

        if (error) {
            throw error;
        }

        if (data && data[0]) {
            return data[0];
        }
    }

    return null;
}

/*
 * Returns { user } for a signed-in user, { admin: true } for
 * the administrator, or null.
 */
export async function getSession(req) {
    let session;

    try {
        session = verifyToken(getCookie(req, SESSION_COOKIE));
    } catch (error) {
        console.error("Session check failed:", error);
        return null;
    }

    if (!session) {
        return null;
    }

    if (session.userId === "admin") {
        return {
            admin: true,
            user: ADMIN_USER,
        };
    }

    const { data: user, error } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("id", session.userId)
        .maybeSingle();

    if (error || !user) {
        return null;
    }

    return {
        admin: false,
        user,
    };
}

/*
 * Sends 401/403 and returns null when the caller is not a
 * signed-in user with the given role.
 */
export async function requireRole(req, res, role) {
    const session = await getSession(req);

    if (!session) {
        res.status(401).json({
            error: "Please log in again.",
        });

        return null;
    }

    if (role === "ADMIN" ? !session.admin : session.user.role !== role) {
        res.status(403).json({
            error: "This account can't do that.",
        });

        return null;
    }

    return session.user;
}
