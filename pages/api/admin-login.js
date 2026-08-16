const ADMIN_PHONE = "681731512";

export default function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);

        return res.status(405).json({
            error: "Method not allowed.",
        });
    }

    const { phone, pin } =
        req.body || {};

    const cleanPhone =
        String(phone || "").trim();

    if (
        cleanPhone !== ADMIN_PHONE
    ) {
        return res.status(401).json({
            error: "Unauthorized.",
        });
    }

    const serverAdminPin =
        process.env.TAYEB_ADMIN_PIN;

    if (!serverAdminPin) {
        console.error(
            "TAYEB_ADMIN_PIN is not configured."
        );

        return res.status(500).json({
            error:
                "Admin authentication is not configured.",
        });
    }

    if (String(pin) !== serverAdminPin) {
        return res.status(401).json({
            error:
                "Incorrect admin PIN.",
        });
    }

    return res.status(200).json({
        success: true,
    });
}