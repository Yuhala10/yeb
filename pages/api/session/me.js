import crypto from "crypto";
import supabase from "../../../lib/supabaseClient";

const SESSION_COOKIE = "tayeb_session";

const ADMIN_PHONE = "681731512";

// Keep this synchronized with the login session duration.
const SESSION_DURATION =
    7 * 24 * 60 * 60;

/*
 * ============================================================
 * GET SESSION SECRET
 * ============================================================
 */

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

/*
 * ============================================================
 * SAFE STRING COMPARISON
 * ============================================================
 */

function safeCompare(a, b) {
    if (
        typeof a !== "string" ||
        typeof b !== "string"
    ) {
        return false;
    }

    const aBuffer =
        Buffer.from(a);

    const bBuffer =
        Buffer.from(b);

    if (
        aBuffer.length !==
        bBuffer.length
    ) {
        return false;
    }

    return crypto.timingSafeEqual(
        aBuffer,
        bBuffer
    );
}

/*
 * ============================================================
 * READ COOKIE
 * ============================================================
 */

function getCookie(
    req,
    name
) {
    const cookieHeader =
        req.headers.cookie;

    if (!cookieHeader) {
        return null;
    }

    const cookies =
        cookieHeader
            .split(";")
            .map(
                (cookie) =>
                    cookie.trim()
            );

    for (const cookie of cookies) {
        const separator =
            cookie.indexOf("=");

        if (separator === -1) {
            continue;
        }

        const key =
            cookie
                .slice(
                    0,
                    separator
                )
                .trim();

        if (key !== name) {
            continue;
        }

        const value =
            cookie
                .slice(
                    separator + 1
                )
                .trim();

        try {
            return decodeURIComponent(
                value
            );
        } catch {
            return value;
        }
    }

    return null;
}

/*
 * ============================================================
 * VERIFY SESSION TOKEN
 * ============================================================
 *
 * Token format:
 *
 * userId.expiresAt.signature
 *
 * Example:
 *
 * 12345.1234567890.abcd1234...
 */

function verifyToken(token) {
    if (!token) {
        return null;
    }

    const parts =
        token.split(".");

    if (parts.length !== 3) {
        return null;
    }

    const [
        userId,
        expiresAtString,
        signature,
    ] = parts;

    if (
        !userId ||
        !expiresAtString ||
        !signature
    ) {
        return null;
    }

    const expiresAt =
        Number(expiresAtString);

    if (
        !Number.isFinite(
            expiresAt
        )
    ) {
        return null;
    }

    /*
     * Session has expired.
     */

    const now =
        Math.floor(
            Date.now() / 1000
        );

    if (expiresAt <= now) {
        return null;
    }

    /*
     * Recreate the original payload.
     */

    const payload =
        `${userId}.${expiresAt}`;

    const expectedSignature =
        crypto
            .createHmac(
                "sha256",
                getSecret()
            )
            .update(payload)
            .digest("hex");

    /*
     * Make sure the signature is valid.
     */

    if (
        !safeCompare(
            signature,
            expectedSignature
        )
    ) {
        return null;
    }

    return {
        userId,
        expiresAt,
    };
}

/*
 * ============================================================
 * SET RENEWED SESSION COOKIE
 * ============================================================
 */

function setSessionCookie(
    res,
    token
) {
    const parts = [
        `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${SESSION_DURATION}`,
    ];

    if (
        process.env.NODE_ENV ===
        "production"
    ) {
        parts.push("Secure");
    }

    res.setHeader(
        "Set-Cookie",
        parts.join("; ")
    );
}

/*
 * ============================================================
 * API HANDLER
 * ============================================================
 */

export default async function handler(
    req,
    res
) {
    /*
     * --------------------------------------------------------
     * ONLY GET
     * --------------------------------------------------------
     */

    if (req.method !== "GET") {
        res.setHeader(
            "Allow",
            ["GET"]
        );

        return res
            .status(405)
            .json({
                error:
                    "Method not allowed.",
            });
    }

    try {
        /*
         * ----------------------------------------------------
         * GET SESSION COOKIE
         * ----------------------------------------------------
         */

        const token =
            getCookie(
                req,
                SESSION_COOKIE
            );

        if (!token) {
            return res
                .status(401)
                .json({
                    authenticated:
                        false,
                });
        }

        /*
         * ----------------------------------------------------
         * VERIFY TOKEN
         * ----------------------------------------------------
         */

        const session =
            verifyToken(token);

        if (!session) {
            return res
                .status(401)
                .json({
                    authenticated:
                        false,
                    error:
                        "Session is invalid or expired.",
                });
        }

        /*
         * ====================================================
         * ADMIN SESSION
         * ====================================================
         */

        if (
            session.userId ===
            "admin"
        ) {
            /*
             * Renew the admin session.
             */

            const renewedToken =
                createRenewedToken(
                    "admin"
                );

            setSessionCookie(
                res,
                renewedToken
            );

            return res
                .status(200)
                .json({
                    authenticated:
                        true,

                    user: {
                        id: "admin",
                        full_name:
                            "Platform Administrator",
                        phone_number:
                            ADMIN_PHONE,
                        role: "ADMIN",
                    },
                });
        }

        /*
         * ====================================================
         * NORMAL USER
         * ====================================================
         */

        const {
            data: user,
            error,
        } = await supabase
            .from("users")
            .select("*")
            .eq(
                "id",
                session.userId
            )
            .maybeSingle();

        if (error) {
            console.error(
                "Session user lookup error:",
                error
            );

            return res
                .status(500)
                .json({
                    error:
                        "Unable to verify session.",
                });
        }

        /*
         * The account may have been deleted.
         */

        if (!user) {
            return res
                .status(401)
                .json({
                    authenticated:
                        false,
                    error:
                        "Account no longer exists.",
                });
        }

        /*
         * ----------------------------------------------------
         * RENEW SESSION
         * ----------------------------------------------------
         *
         * This gives us a rolling session:
         *
         * User opens Tayeb
         *       ↓
         * Session verified
         *       ↓
         * New expiration generated
         *       ↓
         * User remains logged in
         */

        const renewedToken =
            createRenewedToken(
                user.id
            );

        setSessionCookie(
            res,
            renewedToken
        );

        return res
            .status(200)
            .json({
                authenticated:
                    true,

                user,
            });

    } catch (error) {
        console.error(
            "Session verification error:",
            error
        );

        return res
            .status(500)
            .json({
                authenticated:
                    false,

                error:
                    "Unable to verify session.",
            });
    }
}

/*
 * ============================================================
 * CREATE RENEWED TOKEN
 * ============================================================
 *
 * We intentionally keep token creation here instead of
 * importing the login handler.
 */

function createRenewedToken(
    userId
) {
    const expiresAt =
        Math.floor(
            Date.now() / 1000
        ) +
        SESSION_DURATION;

    const payload =
        `${userId}.${expiresAt}`;

    const signature =
        crypto
            .createHmac(
                "sha256",
                getSecret()
            )
            .update(payload)
            .digest("hex");

    return `${payload}.${signature}`;
}