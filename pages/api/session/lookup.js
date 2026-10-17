import { DEFAULT_COUNTRY } from "../../../lib/countries";
import { parsePhone } from "../../../lib/phone";
import { limitByIp } from "../../../lib/server/guard";
import { ADMIN_PHONE, findUserByPhone } from "../../../lib/server/session";

/*
 * First login step: tells the login page which fields to
 * show for this phone number (PIN only, create a PIN, or
 * full sign-up). Never returns names or other details, and
 * treats the admin number like any unknown number.
 */
export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).json({ error: "Method not allowed." });
    }

    // Slows down anyone trying to list who uses Tayeb.
    if (limitByIp(req, res, "lookup", 120, 10 * 60 * 1000)) {
        return;
    }

    const country = req.body?.country || DEFAULT_COUNTRY;

    const parsed = parsePhone(req.body?.phone, country);

    if (!parsed) {
        return res.status(400).json({
            error: "This phone number doesn't look right. Check the country and the number.",
            code: "PHONE_INVALID",
        });
    }

    if (parsed.phone === ADMIN_PHONE) {
        return res.status(200).json({ exists: false, hasPin: false, role: null, hasVehicle: false, hasCity: false, country: parsed.country });
    }

    try {
        const user = await findUserByPhone(req.body?.phone, country);

        return res.status(200).json({
            exists: Boolean(user),
            hasPin: Boolean(user?.pin_hash),
            role: user?.role || null,
            hasVehicle: Boolean(user?.vehicle_type && user?.plate_number),
            hasCity: Boolean(user?.base_city),
            country: parsed.country,
        });
    } catch (error) {
        console.error("Phone lookup error:", error);
        return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}
