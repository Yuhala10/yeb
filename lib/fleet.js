import { distanceKm } from "./cities";

/*
 * ============================================================
 * TAYEB GO: VEHICLES, DISTANCES AND FIXED PRICES
 * ============================================================
 *
 * Used by the server (the price that counts) and the screens
 * (the same price shown before ordering). Cameroon, FCFA.
 *
 * Price = base + per km for the first 30 km, then 25% less
 * per km beyond (long trips), never under the minimum.
 * Rounded up to 100 FCFA, or to 500 FCFA above 10,000.
 */

export const GO_CURRENCY = "XAF";

export const GO_COUNTRY = "CM";

export const VEHICLE_CLASSES = [
    { key: "MOTO", emoji: "🏍️", kg: 30, base: 500, perKm: 150, minimum: 1000, maxKm: 40 },
    { key: "TRICYCLE", emoji: "🛺", kg: 300, base: 1000, perKm: 250, minimum: 2000, maxKm: 40 },
    { key: "PICKUP", emoji: "🚙", kg: 1000, base: 3000, perKm: 500, minimum: 5000, maxKm: null },
    { key: "VAN", emoji: "🚐", kg: 3500, base: 5000, perKm: 700, minimum: 8000, maxKm: null },
    { key: "TRUCK", emoji: "🚚", kg: 10000, base: 15000, perKm: 1100, minimum: 25000, maxKm: null },
];

export function vehicleClass(key) {
    return VEHICLE_CLASSES.find((item) => item.key === key) || null;
}

// The classes that can also carry a job of `key` (same or bigger).
export function classesFrom(key) {
    const index = VEHICLE_CLASSES.findIndex((item) => item.key === key);

    return index < 0 ? [] : VEHICLE_CLASSES.slice(index).map((item) => item.key);
}

/*
 * The class of a driver from what they typed at sign-up
 * ("Camion 10 tonnes", "Moto", "Pick-up"…).
 */
export function vehicleClassOf(vehicleType) {
    const text = String(vehicleType || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();

    if (!text) {
        return null;
    }

    if (/tricy|keke|kavaki|triporteur/.test(text)) {
        return "TRICYCLE";
    }

    if (/moto|bike|benskin|okada|scooter/.test(text)) {
        return "MOTO";
    }

    if (/pick|hilux|voiture|car\b|4x4/.test(text)) {
        return "PICKUP";
    }

    if (/van|fourgon|camionnette|minibus|bus|sprinter|dyna/.test(text)) {
        return "VAN";
    }

    if (/camion|truck|lorry|tonne|\bton|semi|remorque|trailer|benne/.test(text)) {
        return "TRUCK";
    }

    return "PICKUP";
}

/* =========================================================
   DISTANCES AND TIMES (estimates without a routing service)
========================================================= */

/*
 * Streets wind more than highways: a short trip in town is
 * about 35% longer than the straight line, a long road 25%.
 */
export function roadKmBetween(from, to) {
    const straight = distanceKm(from, to);

    if (straight === null) {
        return null;
    }

    const factor = straight < 15 ? 1.35 : straight < 60 ? 1.3 : 1.25;

    return Math.round(straight * factor * 10) / 10;
}

/*
 * Driving minutes: town traffic (about 20 km/h) for the first
 * 15 km, then open road (about 55 km/h).
 */
export function driveMinutes(km) {
    if (km === null || km === undefined) {
        return null;
    }

    const town = Math.min(km, 15);
    const road = Math.max(0, km - 15);

    return Math.max(1, Math.round((town / 20) * 60 + (road / 55) * 60));
}

// A driver coming to a pickup: drive time plus a moment to set off.
export function pickupMinutes(km) {
    return driveMinutes(km) + 2;
}

/* =========================================================
   FIXED PRICES
========================================================= */

export function fareFor(key, km) {
    const item = vehicleClass(key);

    if (!item || km === null || km === undefined || !Number.isFinite(Number(km))) {
        return null;
    }

    const distance = Math.max(0, Number(km));

    const raw = item.base + item.perKm * Math.min(distance, 30) + item.perKm * 0.75 * Math.max(0, distance - 30);

    const step = raw < 10000 ? 100 : 500;

    return Math.max(item.minimum, Math.ceil(raw / step) * step);
}

export function classFits(key, km) {
    const item = vehicleClass(key);

    return Boolean(item) && (!item.maxKm || km <= item.maxKm);
}

/* =========================================================
   WHERE TAYEB GO WORKS
========================================================= */

// Cameroon, with a little margin.
export function inCameroon(point) {
    const lat = Number(point?.lat);
    const lng = Number(point?.lng);

    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 1.5 && lat <= 13.2 && lng >= 8.3 && lng <= 16.3;
}

export function cleanPoint(point) {
    const lat = Number(point?.lat);
    const lng = Number(point?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }

    return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}
