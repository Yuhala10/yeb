import supabaseAdmin from "../../../lib/supabaseAdmin";
import { findCity } from "../../../lib/cities";
import {
    ADMIN_PHONE,
    ADMIN_USER,
    checkUserPin,
    findUserByPhone,
    hashPin,
    isValidPhone,
    isValidPin,
    normalizePhone,
    publicUser,
    safeCompare,
    setSessionCookie,
} from "../../../lib/server/session";

/*
 * ============================================================
 * LOGIN AND SIGN-UP
 * ============================================================
 *
 * Users log in with their phone number and a 4–6 digit PIN.
 *
 * - Existing account with a PIN: the PIN must match.
 * - Existing account from before PINs: this login sets it.
 * - New number: creates the account (name, role, and for
 *   drivers vehicle type, plate and city).
 *
 * The administrator logs in with the admin phone and the
 * TAYEB_ADMIN_PIN server secret.
 */

const ROLES = ["SHIPPER", "DRIVER"];

function fail(res, status, error, code) {
    return res.status(status).json({ error, code });
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return fail(res, 405, "Method not allowed.");
    }

    const body = req.body || {};

    const phone = normalizePhone(body.phone);

    try {
        /* ====================================================
           ADMIN
        ==================================================== */

        if (body.isAdmin === true) {
            const correctPin = process.env.TAYEB_ADMIN_PIN;

            if (phone !== ADMIN_PHONE) {
                return fail(res, 401, "Unauthorized.");
            }

            if (!correctPin) {
                console.error("TAYEB_ADMIN_PIN is not configured.");
                return fail(res, 500, "Administrator authentication is not configured.");
            }

            if (!safeCompare(String(body.adminPin || ""), String(correctPin))) {
                return fail(res, 401, "Incorrect admin PIN.");
            }

            setSessionCookie(res, "admin");

            return res.status(200).json({ success: true, user: ADMIN_USER });
        }

        /* ====================================================
           USERS
        ==================================================== */

        if (!isValidPhone(phone) || phone === ADMIN_PHONE) {
            return fail(res, 400, "Enter a 9-digit Cameroon number, like 6XX XXX XXX.", "PHONE_INVALID");
        }

        if (!isValidPin(body.pin)) {
            return fail(res, 400, "Your PIN must be 4 to 6 digits.", "PIN_INVALID");
        }

        const role = ROLES.includes(body.role) ? body.role : null;

        const vehicleType = String(body.vehicleType || "").trim().slice(0, 60);
        const plateNumber = String(body.plateNumber || "").trim().toUpperCase().slice(0, 20);
        const city = findCity(body.city);

        let user = await findUserByPhone(body.phone);

        if (user) {
            if (user.pin_hash) {
                const check = await checkUserPin(user, body.pin);

                if (!check.ok) {
                    return fail(res, check.status, check.error, check.code);
                }
            }

            const updates = {};

            if (!user.pin_hash) {
                updates.pin_hash = hashPin(body.pin);
            }

            // Older accounts were saved with spaces or +237.
            if (user.phone_number !== phone) {
                updates.phone_number = phone;
            }

            if (role && role !== user.role) {
                updates.role = role;
            }

            const becomesDriver = (updates.role || user.role) === "DRIVER";

            if (becomesDriver) {
                if (vehicleType) {
                    updates.vehicle_type = vehicleType;
                }

                if (plateNumber) {
                    updates.plate_number = plateNumber;
                }

                if (city) {
                    updates.base_city = city.name;
                }

                if (!(updates.vehicle_type || user.vehicle_type) || !(updates.plate_number || user.plate_number)) {
                    return fail(res, 400, "Add your vehicle type and plate number.", "DRIVER_DETAILS_REQUIRED");
                }
            }

            if (Object.keys(updates).length) {
                const { data, error } = await supabaseAdmin
                    .from("users")
                    .update(updates)
                    .eq("id", user.id)
                    .select("*")
                    .single();

                if (error) {
                    throw error;
                }

                user = data;
            }
        } else {
            const fullName = String(body.name || "").trim().slice(0, 80);

            if (fullName.length < 2) {
                return fail(res, 400, "Please enter your full name.", "NAME_REQUIRED");
            }

            if (!role) {
                return fail(res, 400, "Choose if you send goods or drive.", "ROLE_REQUIRED");
            }

            if (role === "DRIVER" && (!vehicleType || !plateNumber)) {
                return fail(res, 400, "Add your vehicle type and plate number.", "DRIVER_DETAILS_REQUIRED");
            }

            const { data, error } = await supabaseAdmin
                .from("users")
                .insert([
                    {
                        full_name: fullName,
                        phone_number: phone,
                        role,
                        pin_hash: hashPin(body.pin),
                        ...(role === "DRIVER"
                            ? {
                                vehicle_type: vehicleType,
                                plate_number: plateNumber,
                                base_city: city ? city.name : null,
                                is_available: true,
                            }
                            : {}),
                    },
                ])
                .select("*")
                .single();

            if (error) {
                throw error;
            }

            user = data;
        }

        setSessionCookie(res, user.id);

        return res.status(200).json({
            success: true,
            user: publicUser(user),
        });
    } catch (error) {
        console.error("Login error:", error);
        return fail(res, 500, "Unable to log in. Please try again.");
    }
}
