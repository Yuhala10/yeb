import {
    ADMIN_PHONE,
    findUserByPhone,
    isValidPhone,
    normalizePhone,
} from "../../../lib/server/session";

/*
 * First login step: tells the login page which fields to
 * show for this phone number (PIN only, create a PIN, or
 * full sign-up). Never returns names or other details.
 */
export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).json({ error: "Method not allowed." });
    }

    const phone = normalizePhone(req.body?.phone);

    if (!isValidPhone(phone)) {
        return res.status(400).json({
            error: "Enter a 9-digit Cameroon number, like 6XX XXX XXX.",
            code: "PHONE_INVALID",
        });
    }

    if (phone === ADMIN_PHONE) {
        return res.status(200).json({ admin: true });
    }

    try {
        const user = await findUserByPhone(req.body?.phone);

        return res.status(200).json({
            exists: Boolean(user),
            hasPin: Boolean(user?.pin_hash),
            role: user?.role || null,
            hasVehicle: Boolean(user?.vehicle_type && user?.plate_number),
            hasCity: Boolean(user?.base_city),
        });
    } catch (error) {
        console.error("Phone lookup error:", error);
        return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}
