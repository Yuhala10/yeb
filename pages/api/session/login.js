import crypto from "crypto";
import supabase from "../../../lib/supabaseClient";

const SESSION_COOKIE = "tayeb_session";

// 7 days
const SESSION_DURATION = 7 * 24 * 60 * 60;

const ADMIN_PHONE = "681731512";

/*
 * ============================================================
 * SESSION SECRET
 * ============================================================
 */

function getSecret() {
    const secret = process.env.TAYEB_SESSION_SECRET;

    if (!secret) {
        throw new Error(
            "TAYEB_SESSION_SECRET is not configured."
        );
    }

    return secret;
}

/*
 * ============================================================
 * NORMALIZE PHONE
 * ============================================================
 *
 * We keep the stored database value intact, but remove
 * accidental spaces around the number before verification.
 */

function normalizePhone(value) {
    return String(value || "").trim();
}

/*
 * ============================================================
 * CREATE SESSION TOKEN
 * ============================================================
 *
 * Format:
 *
 * userId.expiresAt.signature
 *
 * The signature prevents somebody from modifying the
 * user ID or expiration timestamp.
 */

function createToken(userId) {
    const expiresAt =
        Math.floor(Date.now() / 1000) +
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

/*
 * ============================================================
 * CONSTANT-TIME SECRET COMPARISON
 * ============================================================
 *
 * Prevents simple timing attacks when comparing secrets.
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
 * SET SESSION COOKIE
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

    /*
     * HTTPS-only cookie in production.
     */
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
     * METHOD CHECK
     * --------------------------------------------------------
     */

    if (req.method !== "POST") {
        res.setHeader(
            "Allow",
            ["POST"]
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
         * REQUEST BODY
         * ----------------------------------------------------
         */

        const {
            userId,
            phone,
            adminPin,
            isAdmin,
        } = req.body || {};

        /*
         * ====================================================
         * ADMIN LOGIN
         * ====================================================
         */

        if (isAdmin === true) {
            const cleanPhone =
                normalizePhone(phone);

            /*
             * Admin phone must match the server-side value.
             */

            if (
                cleanPhone !==
                ADMIN_PHONE
            ) {
                return res
                    .status(401)
                    .json({
                        error:
                            "Unauthorized.",
                    });
            }

            /*
             * The PIN is NEVER stored in this source file.
             *
             * It must exist in:
             *
             * TAYEB_ADMIN_PIN
             *
             * inside the server environment.
             */

            const correctPin =
                process.env.TAYEB_ADMIN_PIN;

            if (!correctPin) {
                console.error(
                    "TAYEB_ADMIN_PIN is not configured."
                );

                return res
                    .status(500)
                    .json({
                        error:
                            "Administrator authentication is not configured.",
                    });
            }

            /*
             * Compare the PIN safely.
             */

            if (
                !safeCompare(
                    String(adminPin || ""),
                    String(correctPin)
                )
            ) {
                return res
                    .status(401)
                    .json({
                        error:
                            "Incorrect admin PIN.",
                    });
            }

            /*
             * Create admin session.
             */

            const adminToken =
                createToken("admin");

            setSessionCookie(
                res,
                adminToken
            );

            return res
                .status(200)
                .json({
                    success: true,

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
         * NORMAL USER LOGIN
         * ====================================================
         */

        if (!userId || !phone) {
            return res
                .status(400)
                .json({
                    error:
                        "User information is required.",
                });
        }

        const cleanPhone =
            normalizePhone(phone);

        /*
         * Basic validation.
         *
         * We do not need to impose a strict Cameroon
         * phone-number format here because the existing
         * Tayeb database may already contain different
         * valid formats.
         */

        if (!cleanPhone) {
            return res
                .status(400)
                .json({
                    error:
                        "Phone number is required.",
                });
        }

        /*
         * ----------------------------------------------------
         * VERIFY USER AGAINST SUPABASE
         * ----------------------------------------------------
         */

        const {
            data: user,
            error,
        } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .eq(
                "phone_number",
                cleanPhone
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
                        "Unable to create session.",
                });
        }

        /*
         * User ID + phone number must both match.
         */

        if (!user) {
            return res
                .status(401)
                .json({
                    error:
                        "User could not be verified.",
                });
        }

        /*
         * ----------------------------------------------------
         * CREATE VERIFIED USER SESSION
         * ----------------------------------------------------
         */

        const token =
            createToken(user.id);

        setSessionCookie(
            res,
            token
        );

        /*
         * ----------------------------------------------------
         * RETURN VERIFIED USER
         * ----------------------------------------------------
         *
         * Your current LoginPage expects:
         *
         * session.user
         *
         * so we keep that exact structure.
         */

        return res
            .status(200)
            .json({
                success: true,
                user,
            });

    } catch (error) {
        console.error(
            "Session login error:",
            error
        );

        return res
            .status(500)
            .json({
                error:
                    "Unable to create session.",
            });
    }
}