import crypto from "crypto";
import supabaseAdmin from "../../../lib/supabaseAdmin";

const SESSION_COOKIE = "tayeb_session";

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

function verifyToken(token) {
    if (!token) {
        return null;
    }

    const parts = token.split(".");

    if (parts.length !== 3) {
        return null;
    }

    const [
        userId,
        expiresAt,
        signature,
    ] = parts;

    if (
        !userId ||
        !expiresAt ||
        !signature
    ) {
        return null;
    }

    const expires =
        Number(expiresAt);

    if (
        !Number.isFinite(expires) ||
        expires <=
        Math.floor(
            Date.now() / 1000
        )
    ) {
        return null;
    }

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

    const suppliedBuffer =
        Buffer.from(
            signature,
            "hex"
        );

    const expectedBuffer =
        Buffer.from(
            expectedSignature,
            "hex"
        );

    if (
        suppliedBuffer.length !==
        expectedBuffer.length
    ) {
        return null;
    }

    if (
        !crypto.timingSafeEqual(
            suppliedBuffer,
            expectedBuffer
        )
    ) {
        return null;
    }

    return userId;
}

function getCookie(req, name) {
    const cookies =
        req.headers.cookie || "";

    const parts =
        cookies.split(";");

    for (const part of parts) {
        const [key, ...valueParts] =
            part.trim().split("=");

        if (key === name) {
            return decodeURIComponent(
                valueParts.join("=")
            );
        }
    }

    return null;
}

export default async function handler(
    req,
    res
) {
    if (req.method !== "POST") {
        res.setHeader(
            "Allow",
            ["POST"]
        );

        return res.status(405).json({
            error:
                "Method not allowed.",
        });
    }

    try {
        /*
         * Get the authenticated
         * Tayeb session.
         */

        const token = getCookie(
            req,
            SESSION_COOKIE
        );

        const userId =
            verifyToken(token);

        if (!userId) {
            return res.status(401).json({
                error:
                    "Your session is invalid or expired.",
            });
        }

        /*
         * Never allow the special
         * administrator session to
         * delete the admin account.
         */

        if (userId === "admin") {
            return res.status(403).json({
                error:
                    "The administrator account cannot be deleted this way.",
            });
        }

        /*
         * Verify that the account
         * still exists.
         */

        const {
            data: user,
            error: userLookupError,
        } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("id", userId)
            .maybeSingle();

        if (userLookupError) {
            console.error(
                "User lookup error:",
                userLookupError
            );

            return res.status(500).json({
                error:
                    "Unable to verify your account.",
            });
        }

        if (!user) {
            return res.status(404).json({
                error:
                    "Account not found.",
            });
        }

        /*
         * Delete notifications
         * belonging to the user.
         */

        const {
            error: notificationsError,
        } = await supabaseAdmin
            .from("notifications")
            .delete()
            .eq("user_id", userId);

        if (notificationsError) {
            console.error(
                "Notifications deletion error:",
                notificationsError
            );

            return res.status(500).json({
                error:
                    "Unable to delete account data.",
            });
        }

        /*
         * Delete bids made by
         * this driver.
         */

        const {
            error: bidsError,
        } = await supabaseAdmin
            .from("bids")
            .delete()
            .eq("driver_id", userId);

        if (bidsError) {
            console.error(
                "Bids deletion error:",
                bidsError
            );

            return res.status(500).json({
                error:
                    "Unable to delete account data.",
            });
        }

        /*
         * Delete shipments created
         * by this shipper.
         */

        const {
            error: shipmentsError,
        } = await supabaseAdmin
            .from("shipments")
            .delete()
            .eq("shipper_id", userId);

        if (shipmentsError) {
            console.error(
                "Shipments deletion error:",
                shipmentsError
            );

            return res.status(500).json({
                error:
                    "Unable to delete account data.",
            });
        }

        /*
         * Delete subscriptions
         * belonging to the user.
         */

        const {
            error: subscriptionsError,
        } = await supabaseAdmin
            .from("subscriptions")
            .delete()
            .eq("user_id", userId);

        if (subscriptionsError) {
            console.error(
                "Subscriptions deletion error:",
                subscriptionsError
            );

            return res.status(500).json({
                error:
                    "Unable to delete account data.",
            });
        }

        /*
         * Finally delete the
         * user's Tayeb profile.
         */

        const {
            error: deleteUserError,
        } = await supabaseAdmin
            .from("users")
            .delete()
            .eq("id", userId);

        if (deleteUserError) {
            console.error(
                "User deletion error:",
                deleteUserError
            );

            return res.status(500).json({
                error:
                    "Unable to delete your account.",
            });
        }

        /*
         * Destroy the Tayeb
         * session cookie.
         */

        const isProduction =
            process.env.NODE_ENV ===
            "production";

        const cookieParts = [
            `${SESSION_COOKIE}=`,
            "Path=/",
            "HttpOnly",
            "SameSite=Lax",
            "Max-Age=0",
            "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
        ];

        if (isProduction) {
            cookieParts.push(
                "Secure"
            );
        }

        res.setHeader(
            "Set-Cookie",
            cookieParts.join("; ")
        );

        return res.status(200).json({
            success: true,
        });

    } catch (error) {
        console.error(
            "Account deletion error:",
            error
        );

        return res.status(500).json({
            error:
                "Unable to delete your account.",
        });
    }
}