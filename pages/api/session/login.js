import { isLiveCountry } from "../../../lib/countries";
import supabaseAdmin from "../../../lib/supabaseAdmin";
import { findCity } from "../../../lib/cities";
import { DEFAULT_COUNTRY } from "../../../lib/countries";
import { parsePhone } from "../../../lib/phone";
import { upgraded } from "../../../lib/server/core";
import { limitByIp } from "../../../lib/server/guard";
import { marketReady } from "../../../lib/server/market";
import {
    ADMIN_PHONE,
    ADMIN_USER,
    adminLoginBlocked,
    checkUserPin,
    clientIp,
    findUserByPhone,
    hashPin,
    isValidPin,
    publicUser,
    recordAdminFailure,
    safeCompare,
    setSessionCookie,
} from "../../../lib/server/session";

/*
 * ============================================================
 * LOGIN AND SIGN-UP
 * ============================================================
 *
 * Users log in with their phone number and a 4–6 digit PIN.
 * `country` says how to read a number typed without its
 * country code; numbers are saved in international form.
 *
 * - Existing account with a PIN: the PIN must match.
 * - Existing account from before PINs: this login sets it.
 * - New number: creates the account (name, role, and for
 *   drivers vehicle type, plate and city; for farmers the
 *   city of the farm).
 *
 * The administrator signs in from a separate, unlisted page
 * with the admin number and the TAYEB_ADMIN_PIN secret.
 */

const ROLES = ["SHIPPER", "DRIVER", "FARMER"];

function fail(res, status, error, code) {
    return res.status(status).json({ error, code });
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return fail(res, 405, "Method not allowed.");
    }

    // Many people can share one mobile network address, so
    // this is generous; each account also locks after 5
    // wrong PINs.
    if (limitByIp(req, res, "login", 60, 10 * 60 * 1000)) {
        return;
    }

    const body = req.body || {};

    const parsed = parsePhone(body.phone, body.country || DEFAULT_COUNTRY);

    const phone = parsed?.phone || "";

    try {
        /* ====================================================
           ADMIN
        ==================================================== */

        if (body.isAdmin === true) {
            const ip = clientIp(req);

            if (adminLoginBlocked(ip)) {
                return fail(res, 429, "Too many attempts. Try again later.");
            }

            const correctPin = process.env.TAYEB_ADMIN_PIN;

            if (!correctPin) {
                console.error("TAYEB_ADMIN_PIN is not configured.");
                return fail(res, 500, "Not available.");
            }

            if (phone !== ADMIN_PHONE || !safeCompare(String(body.adminPin || ""), String(correctPin))) {
                recordAdminFailure(ip);

                // Slow down guessing; same answer whatever was wrong.
                await wait(800);

                return fail(res, 401, "These details are not correct.");
            }

            setSessionCookie(res, "admin");

            return res.status(200).json({ success: true, user: ADMIN_USER });
        }

        /* ====================================================
           USERS
        ==================================================== */

        if (!parsed) {
            return fail(res, 400, "This phone number doesn't look right. Check the country and the number.", "PHONE_INVALID");
        }

        if (phone === ADMIN_PHONE) {
            return fail(res, 400, "This number can't be used here.", "PHONE_UNAVAILABLE");
        }

        if (!isValidPin(body.pin)) {
            return fail(res, 400, "Your PIN must be 4 to 6 digits.", "PIN_INVALID");
        }

        const isUpgraded = await upgraded();

        const phoneCountry = parsed.country;

        const role = ROLES.includes(body.role) ? body.role : null;

        const vehicleType = String(body.vehicleType || "").trim().slice(0, 60);
        const plateNumber = String(body.plateNumber || "").trim().toUpperCase().slice(0, 20);
        const city = findCity(body.city, phoneCountry);

        if (role === "FARMER" && !(await marketReady())) {
            return fail(res, 503, "Farmer accounts open very soon.", "MARKET_NOT_READY");
        }

        let user = await findUserByPhone(body.phone, body.country || DEFAULT_COUNTRY);

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

            // Older accounts were saved as typed or as 9 Cameroon digits.
            if (user.phone_number !== phone) {
                updates.phone_number = phone;
            }

            if (isUpgraded && !user.country) {
                updates.country = phoneCountry;
            }

            if (role && role !== user.role) {
                updates.role = role;
            }

            const nextRole = updates.role || user.role;

            if (nextRole === "DRIVER") {
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

            if (nextRole === "FARMER") {
                if (city) {
                    updates.base_city = city.name;
                }

                if (!(updates.base_city || user.base_city)) {
                    return fail(res, 400, "Choose the city where your farm is.", "CITY_REQUIRED");
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

            // Tayeb opens country by country: Cameroon first.
            if (!isLiveCountry(phoneCountry)) {
                return fail(res, 400, "Tayeb is open in Cameroon for now. Use a Cameroonian number.", "COUNTRY_CLOSED");
            }

            if (!role) {
                return fail(res, 400, "Choose if you send goods, drive or sell.", "ROLE_REQUIRED");
            }

            if (role === "DRIVER" && (!vehicleType || !plateNumber)) {
                return fail(res, 400, "Add your vehicle type and plate number.", "DRIVER_DETAILS_REQUIRED");
            }

            if (role === "FARMER" && !city) {
                return fail(res, 400, "Choose the city where your farm is.", "CITY_REQUIRED");
            }

            const { data, error } = await supabaseAdmin
                .from("users")
                .insert([
                    {
                        full_name: fullName,
                        phone_number: phone,
                        role,
                        pin_hash: hashPin(body.pin),
                        ...(isUpgraded ? { country: phoneCountry } : {}),
                        ...(role === "DRIVER"
                            ? {
                                vehicle_type: vehicleType,
                                plate_number: plateNumber,
                                base_city: city ? city.name : null,
                                is_available: true,
                            }
                            : {}),
                        ...(role === "FARMER"
                            ? {
                                base_city: city.name,
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
