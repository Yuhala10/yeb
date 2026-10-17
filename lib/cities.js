/*
 * ============================================================
 * CAMEROON CITIES
 * ============================================================
 *
 * Pickup and delivery cities come from this list, so loads
 * can be matched to drivers, return trips can be found and
 * distances can be estimated. Coordinates are approximate
 * city centres; distances are shown as "about".
 */

export const CITIES = [
    { name: "Douala", lat: 4.0511, lng: 9.7679 },
    { name: "Yaoundé", lat: 3.848, lng: 11.5021 },
    { name: "Bafoussam", lat: 5.4778, lng: 10.4176 },
    { name: "Bamenda", lat: 5.9631, lng: 10.1591 },
    { name: "Garoua", lat: 9.3017, lng: 13.3921 },
    { name: "Maroua", lat: 10.5956, lng: 14.3247 },
    { name: "Ngaoundéré", lat: 7.3167, lng: 13.5833 },
    { name: "Bertoua", lat: 4.5772, lng: 13.6846 },
    { name: "Ebolowa", lat: 2.9, lng: 11.15 },
    { name: "Kribi", lat: 2.95, lng: 9.91 },
    { name: "Limbe", lat: 4.0167, lng: 9.2 },
    { name: "Buea", lat: 4.1527, lng: 9.241 },
    { name: "Kumba", lat: 4.6363, lng: 9.4469 },
    { name: "Tiko", lat: 4.075, lng: 9.36 },
    { name: "Edéa", lat: 3.8, lng: 10.1333 },
    { name: "Nkongsamba", lat: 4.9547, lng: 9.9404 },
    { name: "Loum", lat: 4.7167, lng: 9.7333 },
    { name: "Mbanga", lat: 4.5, lng: 9.5667 },
    { name: "Dschang", lat: 5.45, lng: 10.0667 },
    { name: "Mbouda", lat: 5.6333, lng: 10.25 },
    { name: "Bafang", lat: 5.15, lng: 10.1833 },
    { name: "Bangangté", lat: 5.15, lng: 10.5167 },
    { name: "Foumban", lat: 5.7167, lng: 10.9 },
    { name: "Kumbo", lat: 6.2, lng: 10.6667 },
    { name: "Mamfe", lat: 5.7667, lng: 9.2833 },
    { name: "Mbalmayo", lat: 3.5167, lng: 11.5 },
    { name: "Obala", lat: 4.1667, lng: 11.5333 },
    { name: "Bafia", lat: 4.75, lng: 11.2333 },
    { name: "Eséka", lat: 3.65, lng: 10.7667 },
    { name: "Sangmélima", lat: 2.9333, lng: 11.9833 },
    { name: "Abong-Mbang", lat: 3.9833, lng: 13.1833 },
    { name: "Batouri", lat: 4.4333, lng: 14.3667 },
    { name: "Yokadouma", lat: 3.5167, lng: 15.05 },
    { name: "Meiganga", lat: 6.5167, lng: 14.3 },
    { name: "Tibati", lat: 6.4667, lng: 12.6333 },
    { name: "Guider", lat: 9.9333, lng: 13.95 },
    { name: "Mokolo", lat: 10.7333, lng: 13.8 },
    { name: "Yagoua", lat: 10.3333, lng: 15.2333 },
    { name: "Kousséri", lat: 12.0769, lng: 15.0306 },
];

export const CITY_NAMES =
    CITIES.map(
        (city) => city.name
    );

export function findCity(name) {
    if (!name) {
        return null;
    }

    const wanted =
        normalize(name);

    return (
        CITIES.find(
            (city) =>
                normalize(city.name) ===
                wanted
        ) || null
    );
}

export function isKnownCity(name) {
    return Boolean(
        findCity(name)
    );
}

/*
 * Older loads only have free text like "Akwa, Douala".
 * Uses the saved city when there is one, otherwise looks for
 * a city name inside the text.
 */
export function resolveCity(
    cityName,
    text
) {
    const saved =
        findCity(cityName);

    if (saved) {
        return saved.name;
    }

    if (!text) {
        return null;
    }

    const parts =
        String(text)
            .split(/[,\-–/]/)
            .map((part) => part.trim())
            .reverse();

    for (const part of parts) {
        const city =
            findCity(part);

        if (city) {
            return city.name;
        }
    }

    const haystack =
        ` ${normalize(text)} `;

    const contained =
        CITIES.find(
            (city) =>
                haystack.includes(
                    ` ${normalize(city.name)} `
                )
        );

    return contained
        ? contained.name
        : null;
}

/*
 * Straight-line distance in km between two points.
 */
export function distanceKm(
    from,
    to
) {
    if (
        !from ||
        !to
    ) {
        return null;
    }

    const toRadians =
        (value) =>
            (value * Math.PI) / 180;

    const earthRadius =
        6371;

    const dLat =
        toRadians(to.lat - from.lat);

    const dLng =
        toRadians(to.lng - from.lng);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(from.lat)) *
        Math.cos(toRadians(to.lat)) *
        Math.sin(dLng / 2) ** 2;

    return (
        2 *
        earthRadius *
        Math.asin(Math.sqrt(a))
    );
}

/*
 * Roads are longer than straight lines. 1.25 matches the
 * Douala–Yaoundé road (about 240 km) closely.
 */
const ROAD_FACTOR = 1.25;

export function roadKm(
    from,
    to
) {
    const straight =
        distanceKm(from, to);

    if (straight === null) {
        return null;
    }

    return Math.round(
        straight * ROAD_FACTOR
    );
}

export function cityRoadKm(
    fromName,
    toName
) {
    return roadKm(
        findCity(fromName),
        findCity(toName)
    );
}

function normalize(value) {
    return String(value)
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .trim()
        .toLowerCase();
}
