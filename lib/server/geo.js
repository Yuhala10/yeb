/*
 * ============================================================
 * PLACES AND ROADS
 * ============================================================
 *
 * Address search and "what is at this point" (reverse) for
 * Tayeb Go, and road routes between two points. Everything
 * goes through Tayeb's server, so phones never call other
 * services and answers can be cached.
 *
 * Places: OpenStreetMap's Nominatim by default. Its rules are
 * followed: at most one request per second, a clear app name,
 * no search on every keystroke (only when the person asks),
 * results cached. Set TAYEB_GEOCODER=off to switch it off, or
 * TAYEB_GEOCODER_URL to use another Nominatim server.
 *
 * Roads: only when TAYEB_ROUTING_URL is set, an OSRM-style
 * service ({coords} is replaced by "lng,lat;lng,lat"), e.g.
 *   https://router.project-osrm.org/route/v1/driving/{coords}?overview=full&geometries=geojson
 *   https://api.mapbox.com/directions/v5/mapbox/driving/{coords}?overview=full&geometries=geojson&access_token=…
 * Without it, distances are estimated (lib/fleet.js).
 */

const GEOCODER = (process.env.TAYEB_GEOCODER_URL || "https://nominatim.openstreetmap.org").replace(/\/+$/, "");

const GEOCODER_ON = process.env.TAYEB_GEOCODER !== "off";

const ROUTING = process.env.TAYEB_ROUTING_URL || "";

const USER_AGENT = "Tayeb/1.0 (farm marketplace and deliveries, Cameroon; support +237681731512)";

const TIMEOUT_MS = 4500;

const MAX_CACHE = 4000;

/* =========================================================
   SMALL CACHE
========================================================= */

function makeCache() {
    const map = new Map();

    return {
        get(key) {
            const hit = map.get(key);

            if (!hit || hit.until < Date.now()) {
                map.delete(key);
                return undefined;
            }

            return hit.value;
        },
        set(key, value, ms) {
            if (map.size >= MAX_CACHE) {
                map.delete(map.keys().next().value);
            }

            map.set(key, { value, until: Date.now() + ms });
        },
    };
}

const placeCache = makeCache();

const routeCache = makeCache();

/* =========================================================
   ONE REQUEST PER SECOND TO THE PLACES SERVICE
========================================================= */

let nextSlot = 0;

async function politeFetch(url) {
    const now = Date.now();

    const wait = Math.max(0, nextSlot - now);

    nextSlot = Math.max(now, nextSlot) + 1100;

    // Too long a queue: answer "nothing" rather than make people wait.
    if (wait > 4000) {
        return null;
    }

    if (wait) {
        await new Promise((resolve) => setTimeout(resolve, wait));
    }

    return timedFetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
}

async function timedFetch(url, options = {}) {
    const controller = new AbortController();

    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });

        if (!response.ok) {
            return null;
        }

        return await response.json();
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/* =========================================================
   LABELS PEOPLE RECOGNISE
========================================================= */

function pick(address, keys) {
    for (const key of keys) {
        if (address?.[key]) {
            return address[key];
        }
    }

    return null;
}

/*
 * "Rue Joss, Bonanjo" + "Douala": the street or landmark,
 * the neighbourhood, then the town.
 */
function describe(result) {
    const address = result?.address || {};

    const place = pick(address, ["amenity", "shop", "building", "tourism", "office", "leisure", "marketplace"]) || (result?.name && result.name !== address.road ? result.name : null);

    const road = pick(address, ["road", "pedestrian", "footway", "street"]);

    const area = pick(address, ["neighbourhood", "quarter", "suburb", "city_district", "hamlet", "village"]);

    const town = pick(address, ["city", "town", "municipality", "village", "county", "state"]);

    const main = [place, road].filter(Boolean)[0] || area || town || result?.display_name?.split(",")[0] || "";

    const sub = [area !== main ? area : null, town !== main ? town : null].filter(Boolean).join(", ");

    return {
        label: [main, sub].filter(Boolean).join(", ").slice(0, 120),
        main: String(main).slice(0, 80),
        sub: sub.slice(0, 80),
        town: town || null,
    };
}

/* =========================================================
   REVERSE: WHAT IS HERE?
========================================================= */

export async function placeAt(lat, lng, language = "fr") {
    if (!GEOCODER_ON) {
        return null;
    }

    const key = `r|${lat.toFixed(4)}|${lng.toFixed(4)}|${language}`;

    const cached = placeCache.get(key);

    if (cached !== undefined) {
        return cached;
    }

    const url = `${GEOCODER}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=${language === "en" ? "en" : "fr"}`;

    const result = await politeFetch(url);

    const value = result && !result.error ? describe(result) : null;

    placeCache.set(key, value, value ? 7 * 24 * 3600000 : 60000);

    return value;
}

/* =========================================================
   SEARCH (only when the person asks)
========================================================= */

export async function searchPlaces(query, language = "fr", near = null) {
    const text = String(query || "").trim().slice(0, 100);

    if (!GEOCODER_ON || text.length < 2) {
        return [];
    }

    const key = `s|${text.toLowerCase()}|${language}|${near ? `${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : ""}`;

    const cached = placeCache.get(key);

    if (cached !== undefined) {
        return cached;
    }

    // Prefer results around the person, without excluding the rest.
    const box = near
        ? `&viewbox=${near.lng - 0.35},${near.lat + 0.35},${near.lng + 0.35},${near.lat - 0.35}`
        : "";

    const url = `${GEOCODER}/search?format=jsonv2&q=${encodeURIComponent(text)}&countrycodes=cm&limit=7&addressdetails=1&accept-language=${language === "en" ? "en" : "fr"}${box}`;

    const results = await politeFetch(url);

    const list = Array.isArray(results)
        ? results
            .map((result) => {
                const lat = Number(result.lat);
                const lng = Number(result.lon);

                if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                    return null;
                }

                return { ...describe(result), lat, lng };
            })
            .filter(Boolean)
        : [];

    placeCache.set(key, list, list.length ? 24 * 3600000 : 60000);

    return list;
}

/* =========================================================
   ROADS
========================================================= */

export function routingOn() {
    return Boolean(ROUTING);
}

function thin(points, max) {
    if (points.length <= max) {
        return points;
    }

    const step = points.length / (max - 1);

    const kept = [];

    for (let index = 0; index < max - 1; index++) {
        kept.push(points[Math.floor(index * step)]);
    }

    kept.push(points[points.length - 1]);

    return kept;
}

/*
 * { km, minutes, line: [[lat, lng], …] } or null when there's
 * no routing service or it didn't answer.
 */
export async function roadRoute(from, to) {
    if (!ROUTING || !from || !to) {
        return null;
    }

    const key = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}|${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;

    const cached = routeCache.get(key);

    if (cached !== undefined) {
        return cached;
    }

    const url = ROUTING.replace("{coords}", `${from.lng},${from.lat};${to.lng},${to.lat}`);

    const result = await timedFetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });

    const route = result?.routes?.[0];

    const coordinates = route?.geometry?.coordinates;

    const value =
        route && Array.isArray(coordinates) && coordinates.length > 1
            ? {
                km: Math.round((Number(route.distance) / 1000) * 10) / 10,
                minutes: Math.max(1, Math.round(Number(route.duration) / 60)),
                line: thin(coordinates, 300).map(([lng, lat]) => [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5]),
            }
            : null;

    routeCache.set(key, value, value ? 6 * 3600000 : 60000);

    return value;
}
