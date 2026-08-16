import crypto from "crypto";
import supabase from "../../../lib/supabaseClient";

const SESSION_COOKIE = "tayeb_session";
const SESSION_DURATION = 7 * 24 * 60 * 60;

const ADMIN_PHONE = "681731512";

function getSecret() {
    const secret = process.env.TAYEB_SESSION_SECRET;

    if (!secret) {
        throw new Error(
            "TAYEB_SESSION_SECRET is not configured."
        );
    }

    return secret;
}

function createToken(userId) {
    const expiresAt =
        Math.floor(Date.now() / 1000) +
        SESSION_DURATION;

    const payload = `${userId}.${expiresAt}`;

    const signature = crypto
        .createHmac("sha256", getSecret())
        .update(payload)
        .digest("hex");

    return `${payload}.${signature}`;
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res
            .status(405)
            .json({ error: "Method not allowed." });
    }

    try {
        const {
            userId,
            phone,
            adminPin,
            isAdmin,
        } = req.body || {};

        if (isAdmin) {
            if (
                !phone ||
                phone.trim() !== ADMIN_PHONE
            ) {
                return res
                    .status(401)
                    .json({ error: "Unauthorized." });
            }

            const correctPin =
                process.env.TAYEB_ADMIN_PIN;

            if (
                !correctPin ||
                adminPin !== correctPin
            ) {
                return res
                    .status(401)
                    .json({
                        error:
                            "Incorrect admin PIN.",
                    });
            }

            const adminToken =
                createToken("admin");

            res.setHeader(
                "Set-Cookie",
                `${SESSION_COOKIE}=${adminToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION}${process.env.NODE_ENV === "production"
                    ? "; Secure"
                    : ""
                }`
            );

            return res.status(200).json({
                success: true,
                user: {
                    id: "admin",
                    full_name:
                        "Platform Administrator",
                    phone_number: ADMIN_PHONE,
                    role: "ADMIN",
                },
            });
        }

        if (!userId || !phone) {
            return res
                .status(400)
                .json({
                    error:
                        "User information is required.",
                });
        }

        const cleanPhone =
            String(phone).trim();

        const { data: user, error } =
            await supabase
                .from("users")
                .select("*")
                .eq("id", userId)
                .eq("phone_number", cleanPhone)
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

        if (!user) {
            return res
                .status(401)
                .json({
                    error:
                        "User could not be verified.",
                });
        }

        const token =
            createToken(user.id);

        res.setHeader(
            "Set-Cookie",
            `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION}${process.env.NODE_ENV === "production"
                ? "; Secure"
                : ""
            }`
        );

        return res.status(200).json({
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