import { COUNTRIES, DEFAULT_COUNTRY } from "./countries";

/*
 * ============================================================
 * CITIES (all Tayeb countries)
 * ============================================================
 *
 * Pickup and delivery cities come from these lists, so loads
 * can be matched to drivers, return trips can be found and
 * distances can be estimated. Coordinates are approximate
 * city centres; distances are shown as "about".
 */

export const CITIES = COUNTRIES.flatMap((country) =>
    country.cities.map(([name, lat, lng]) => ({
        name,
        lat,
        lng,
        country: country.code,
    }))
);

/*
 * City names for one country, alphabetical with the biggest
 * hubs kept in list order first (the lists start with them).
 */
export function cityNames(countryCode = DEFAULT_COUNTRY) {
    return CITIES.filter((city) => city.country === countryCode).map((city) => city.name);
}

// Cameroon, for screens that don't know the country yet.
export const CITY_NAMES = cityNames(DEFAULT_COUNTRY);

export function findCity(name, countryCode) {
    if (!name) {
        return null;
    }

    const wanted = normalize(name);

    return (
        CITIES.find(
            (city) =>
                (!countryCode || city.country === countryCode) &&
                normalize(city.name) === wanted
        ) || null
    );
}

export function isKnownCity(name, countryCode) {
    return Boolean(findCity(name, countryCode));
}

/*
 * Older loads only have free text like "Akwa, Douala" (all
 * from Cameroon). Uses the saved city when there is one,
 * otherwise looks for a Cameroon city name inside the text.
 */
export function resolveCity(cityName, text) {
    const saved = findCity(cityName);

    if (saved) {
        return saved.name;
    }

    if (!text) {
        return null;
    }

    const parts = String(text)
        .split(/[,\-–/]/)
        .map((part) => part.trim())
        .reverse();

    for (const part of parts) {
        const city = findCity(part, DEFAULT_COUNTRY);

        if (city) {
            return city.name;
        }
    }

    const haystack = ` ${normalize(text)} `;

    const contained = CITIES.find(
        (city) =>
            city.country === DEFAULT_COUNTRY &&
            haystack.includes(` ${normalize(city.name)} `)
    );

    return contained ? contained.name : null;
}

/*
 * Straight-line distance in km between two points.
 */
export function distanceKm(from, to) {
    if (!from || !to) {
        return null;
    }

    const toRadians = (value) => (value * Math.PI) / 180;

    const earthRadius = 6371;

    const dLat = toRadians(to.lat - from.lat);
    const dLng = toRadians(to.lng - from.lng);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;

    return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

/*
 * Roads are longer than straight lines. 1.25 matches the
 * Douala–Yaoundé road (about 240 km) closely.
 */
const ROAD_FACTOR = 1.25;

export function roadKm(from, to) {
    const straight = distanceKm(from, to);

    if (straight === null) {
        return null;
    }

    return Math.round(straight * ROAD_FACTOR);
}

export function cityRoadKm(fromName, toName) {
    return roadKm(findCity(fromName), findCity(toName));
}

/*
 * The closest Tayeb city to a point (for "near me").
 */
export function nearestCity(point, countryCode) {
    let best = null;

    for (const city of CITIES) {
        if (countryCode && city.country !== countryCode) {
            continue;
        }

        const km = distanceKm(point, city);

        if (!best || km < best.km) {
            best = { ...city, km };
        }
    }

    return best;
}

function normalize(value) {
    return String(value)
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/['’]/g, "")
        .trim()
        .toLowerCase();
}
