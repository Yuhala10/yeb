import { COUNTRIES, DEFAULT_COUNTRY, countryOrDefault } from "./countries";

/*
 * ============================================================
 * PHONE NUMBERS ACROSS AFRICA
 * ============================================================
 *
 * Numbers are stored as international digits without "+":
 * "237681731512" (Cameroon), "2348031234567" (Nigeria).
 *
 * People type them many ways; all of these give the same
 * result when the country is Nigeria:
 *   "+234 803 123 4567", "00234 8031234567",
 *   "0803 123 4567", "803 123 4567".
 *
 * Accounts created before Tayeb went Africa-wide stored the
 * 9-digit Cameroon number ("681731512"); toInternational()
 * still understands them.
 */

const BY_DIAL = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

function fits(country, digits) {
    return digits.length >= country.nsn[0] && digits.length <= country.nsn[1];
}

/*
 * Returns { phone, country } or null when the number can't
 * be valid. `countryCode` is used for numbers typed without
 * the country code.
 */
export function parsePhone(value, countryCode = DEFAULT_COUNTRY) {
    const raw = String(value || "").trim();

    let digits = raw.replace(/\D/g, "");

    if (!digits) {
        return null;
    }

    const international = raw.startsWith("+") || digits.startsWith("00");

    if (digits.startsWith("00")) {
        digits = digits.slice(2);
    }

    // With a country code: "+234…", "00234…", or "234…" typed in full.
    const byDial = BY_DIAL.find(
        (country) =>
            digits.startsWith(country.dial) &&
            fits(country, stripTrunk(country, digits.slice(country.dial.length)))
    );

    if (international) {
        if (!byDial) {
            return null;
        }

        const national = stripTrunk(byDial, digits.slice(byDial.dial.length));

        return { phone: byDial.dial + national, country: byDial.code };
    }

    const country = countryOrDefault(countryCode);

    const national = stripTrunk(country, digits);

    if (fits(country, national)) {
        return { phone: country.dial + national, country: country.code };
    }

    // "2348031234567" typed without "+".
    if (byDial) {
        return {
            phone: byDial.dial + stripTrunk(byDial, digits.slice(byDial.dial.length)),
            country: byDial.code,
        };
    }

    return null;
}

/*
 * A single leading 0 is the national trunk prefix in most
 * countries ("0803…" in Nigeria). It's kept when the number
 * is already the right length with it (Côte d'Ivoire's
 * 10-digit numbers start with 0).
 */
function stripTrunk(country, digits) {
    if (digits.startsWith("0") && !fits(country, digits) && fits(country, digits.slice(1))) {
        return digits.slice(1);
    }

    return digits;
}

export function normalizePhone(value, countryCode) {
    return parsePhone(value, countryCode)?.phone || "";
}

export function isValidPhone(phone) {
    return Boolean(phone) && /^\d{8,15}$/.test(phone) && Boolean(countryOfPhone(phone));
}

export function countryOfPhone(phone) {
    const digits = String(phone || "");

    return (
        BY_DIAL.find(
            (country) => digits.startsWith(country.dial) && fits(country, digits.slice(country.dial.length))
        ) || null
    );
}

/*
 * Stored value → international digits, understanding the old
 * 9-digit Cameroon numbers.
 */
export function toInternational(stored) {
    const digits = String(stored || "").replace(/\D/g, "");

    if (!digits) {
        return "";
    }

    if (countryOfPhone(digits)) {
        return digits;
    }

    const cameroon = countryOrDefault(DEFAULT_COUNTRY);

    if (fits(cameroon, digits)) {
        return cameroon.dial + digits;
    }

    return digits;
}

/*
 * "+237 681 73 15 12" for showing a number.
 */
export function formatPhone(stored) {
    const digits = toInternational(stored);

    const country = countryOfPhone(digits);

    if (!country) {
        return stored ? String(stored) : "";
    }

    const national = digits.slice(country.dial.length);

    const groups = national.length === 9
        ? [national.slice(0, 3), national.slice(3, 5), national.slice(5, 7), national.slice(7)]
        : national.match(/.{1,3}/g) || [national];

    return `+${country.dial} ${groups.join(" ")}`;
}

export function telHref(stored) {
    const digits = toInternational(stored);

    return digits ? `tel:+${digits}` : undefined;
}

export function whatsappHref(stored, text) {
    const digits = toInternational(stored);

    const query = text ? `?text=${encodeURIComponent(text)}` : "";

    return `https://wa.me/${digits}${query}`;
}

/*
 * The phone numbers people might type for one account, to
 * find accounts saved before numbers were international.
 */
export function phoneCandidates(value, countryCode) {
    const parsed = parsePhone(value, countryCode);

    const list = [];

    if (parsed) {
        list.push(parsed.phone);

        const cameroon = countryOrDefault(DEFAULT_COUNTRY);

        if (parsed.country === DEFAULT_COUNTRY) {
            list.push(parsed.phone.slice(cameroon.dial.length));
        }
    }

    const raw = String(value || "").trim();

    if (raw) {
        list.push(raw);
    }

    return [...new Set(list)];
}
