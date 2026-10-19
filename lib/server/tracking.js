import crypto from "crypto";

import { distanceKm, findCity, nearestCity, roadKm } from "../cities";
import { db, EngineError, isMissingSchema, LIVE_STATUSES, must, usersById } from "./core";

/*
 * ============================================================
 * LIVE TRACKING
 * ============================================================
 *
 * The driver's phone sends its position while a delivery is
 * live: on the way to the pickup (MATCHED) and on the road
 * (DEPARTED). Every point is kept, so the map can draw the
 * real trail and work out real speed and arrival time.
 *
 * Who can see a trip:
 *   - the shipper and the driver of that load, and staff;
 *   - anyone with the trip's private link (the receiver), but
 *     only while the goods are on the road, without phones.
 */

const TRACKED = ["MATCHED", "DEPARTED"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One point every few seconds per trip is plenty; more is noise.
const MIN_GAP_MS = 4000;

// A phone that only knows it's "somewhere in this town".
const WORST_ACCURACY_M = 1500;

const MAX_TRAIL_POINTS = 400;

/* =========================================================
   PRIVATE TRACKING LINK
========================================================= */

function secret() {
    const value = process.env.TAYEB_SESSION_SECRET;

    if (!value) {
        throw new Error("TAYEB_SESSION_SECRET is not set.");
    }

    return value;
}

/*
 * A token only the server can make: knowing a trip's id is
 * not enough to follow it.
 */
export function trackToken(shipmentId) {
    return crypto
        .createHmac("sha256", secret())
        .update(`track:${shipmentId}`)
        .digest("base64url")
        .slice(0, 24);
}

function tokenMatches(shipmentId, token) {
    if (!token || typeof token !== "string" || token.length !== 24) {
        return false;
    }

    const expected = Buffer.from(trackToken(shipmentId));
    const given = Buffer.from(token);

    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/* =========================================================
   IS THE TRACKING TABLE THERE? (supabase/upgrade.sql)
========================================================= */

let tableState = { ready: false, checkedAt: 0 };

export async function trackingReady() {
    if (tableState.ready) {
        return true;
    }

    if (Date.now() - tableState.checkedAt < 30000) {
        return false;
    }

    const [positions, columns] = await Promise.all([
        db.from("shipment_positions").select("id").limit(1),
        db.from("shipments").select("last_speed, last_heading").limit(1),
    ]);

    const error = positions.error || columns.error;

    if (error && !isMissingSchema(error)) {
        console.error("Tracking check failed:", error);
    }

    tableState = { ready: !error, checkedAt: Date.now() };

    return tableState.ready;
}

/* =========================================================
   RECORD A POSITION
========================================================= */

const lastWrite = new Map();

function finite(value) {
    const number = Number(value);

    return value !== null && value !== undefined && value !== "" && Number.isFinite(number) ? number : null;
}

/*
 * Called by the driver API with a point from the phone.
 * Returns { tracking: boolean }.
 */
export async function recordPosition(shipment, input) {
    if (!TRACKED.includes(shipment.status)) {
        return { tracking: false };
    }

    const lat = finite(input.lat);
    const lng = finite(input.lng);

    if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw new EngineError("Invalid location.");
    }

    const accuracy = finite(input.accuracy);

    if (accuracy !== null && accuracy > WORST_ACCURACY_M) {
        return { tracking: true, skipped: "accuracy" };
    }

    const now = Date.now();

    if (now - (lastWrite.get(shipment.id) || 0) < MIN_GAP_MS) {
        return { tracking: true, skipped: "too_soon" };
    }

    lastWrite.set(shipment.id, now);

    if (lastWrite.size > 5000) {
        lastWrite.clear();
    }

    // Phones give m/s and degrees; nonsense values are dropped.
    const speed = finite(input.speed);
    const heading = finite(input.heading);

    const point = {
        lat,
        lng,
        accuracy: accuracy === null ? null : Math.round(accuracy),
        speed: speed !== null && speed >= 0 && speed < 70 ? speed : null,
        heading: heading !== null && heading >= 0 && heading <= 360 ? heading : null,
    };

    const ready = await trackingReady();

    const at = new Date(now).toISOString();

    must(
        await db
            .from("shipments")
            .update({
                last_lat: point.lat,
                last_lng: point.lng,
                last_location_at: at,
                last_location_accuracy: point.accuracy,
                ...(ready ? { last_speed: point.speed, last_heading: point.heading } : {}),
            })
            .eq("id", shipment.id)
    );

    if (ready) {
        must(await db.from("shipment_positions").insert([{ shipment_id: shipment.id, ...point, recorded_at: at }]));
    }

    return { tracking: true };
}

/* =========================================================
   WHERE THE TRIP STARTS AND ENDS
========================================================= */

/*
 * Tayeb Go trips have exact points on the map; loads from the
 * board only have towns.
 */
export function tripEnds(shipment) {
    const exact = (lat, lng, name) =>
        lat !== null && lat !== undefined && lng !== null && lng !== undefined
            ? { name: name || "", lat: Number(lat), lng: Number(lng) }
            : null;

    const fromCity = findCity(shipment.origin_city);
    const toCity = findCity(shipment.destination_city);

    return {
        from: exact(shipment.pickup_lat, shipment.pickup_lng, shipment.pickup_address || shipment.origin_city) || (fromCity ? { name: fromCity.name, lat: fromCity.lat, lng: fromCity.lng } : null),
        to: exact(shipment.dropoff_lat, shipment.dropoff_lng, shipment.dropoff_address || shipment.destination_city) || (toCity ? { name: toCity.name, lat: toCity.lat, lng: toCity.lng } : null),
    };
}

/* =========================================================
   READING THE TRIP
========================================================= */

function bearing(from, to) {
    const rad = (value) => (value * Math.PI) / 180;

    const y = Math.sin(rad(to.lng - from.lng)) * Math.cos(rad(to.lat));
    const x =
        Math.cos(rad(from.lat)) * Math.sin(rad(to.lat)) -
        Math.sin(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.cos(rad(to.lng - from.lng));

    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Faster than any truck: a GPS glitch, not a real move.
const MAX_ROAD_KMH = 180;

function kmh(from, to) {
    const hours = Math.abs(to.time - from.time) / 3600000;

    return hours > 0 ? distanceKm(from, to) / hours : Infinity;
}

/*
 * Drops points that jump impossibly far from both their
 * neighbours (phones sometimes report a wrong position for a
 * few seconds, e.g. from a cell tower).
 */
export function dropGlitches(points) {
    if (points.length < 3) {
        return points;
    }

    const kept = [points[0]];

    for (let index = 1; index < points.length - 1; index++) {
        const before = kept[kept.length - 1];
        const point = points[index];
        const after = points[index + 1];

        const jump = distanceKm(before, point) > 0.5 && kmh(before, point) > MAX_ROAD_KMH && kmh(point, after) > MAX_ROAD_KMH;

        if (!jump) {
            kept.push(point);
        }
    }

    kept.push(points[points.length - 1]);

    return kept;
}

/*
 * Average speed (km/h) over the last `minutes`, from the
 * distance actually driven between points. Impossible
 * stretches are left out.
 */
function speedOver(points, minutes, now) {
    const since = now - minutes * 60000;

    const window = points.filter((point) => point.time >= since);

    if (window.length < 2) {
        return null;
    }

    let km = 0;
    let hours = 0;

    for (let index = 1; index < window.length; index++) {
        const stretch = distanceKm(window[index - 1], window[index]);
        const time = (window[index].time - window[index - 1].time) / 3600000;

        if (time > 0 && stretch / time <= MAX_ROAD_KMH) {
            km += stretch;
            hours += time;
        }
    }

    return hours > 0.01 ? km / hours : null;
}

/*
 * The trip as the map and the panel show it: phase, distance
 * left, progress, speed, stop, arrival time, nearest town,
 * signal health, and whether the truck is heading away.
 */
export function readTrip(shipment, points, now = Date.now()) {
    const { from, to } = tripEnds(shipment);

    const last = points[points.length - 1] || null;

    const phase = {
        OPEN: "WAITING",
        MATCHED: "TO_PICKUP",
        DEPARTED: "TO_DESTINATION",
        ARRIVED: "ARRIVED",
        COMPLETED: "DONE",
        CANCELLED: "CANCELLED",
    }[shipment.status] || "WAITING";

    const target = phase === "TO_PICKUP" ? from : to;

    const secondsAgo = last ? Math.max(0, Math.round((now - last.time) / 1000)) : null;

    const signal =
        secondsAgo === null ? "none" : secondsAgo <= 120 ? "live" : secondsAgo <= 15 * 60 ? "recent" : "stale";

    const kmTotal = from && to ? roadKm(from, to) : null;

    const kmLeft = last && target ? Math.max(0, roadKm(last, target)) : phase === "TO_DESTINATION" ? kmTotal : null;

    const progress =
        phase === "ARRIVED" || phase === "DONE"
            ? 1
            : phase === "TO_DESTINATION" && kmTotal && kmLeft !== null
                ? Math.min(1, Math.max(0, 1 - kmLeft / kmTotal))
                : 0;

    // Speed: the last 5 minutes for "now", the last 30 for arrival time.
    const phoneSpeed = last?.speed !== null && last?.speed !== undefined ? last.speed * 3.6 : null;

    const recent = speedOver(points, 5, now);

    const cruising = speedOver(points, 30, now);

    const speedNow = recent ?? phoneSpeed;

    const moving = speedNow !== null ? speedNow >= 4 : null;

    // Stopped since the last time the truck was 300 m from here.
    let stoppedMinutes = null;

    if (last && moving === false) {
        let since = last.time;

        for (let index = points.length - 2; index >= 0; index--) {
            if (distanceKm(points[index], last) > 0.3) {
                break;
            }

            since = points[index].time;
        }

        stoppedMinutes = Math.round((now - since) / 60000);
    }

    let eta = null;
    let etaMinutes = null;

    if ((phase === "TO_DESTINATION" || phase === "TO_PICKUP") && kmLeft !== null) {
        const pace = Math.min(85, Math.max(25, cruising && cruising >= 20 ? cruising : speedNow && speedNow >= 20 ? speedNow : 45));

        etaMinutes = kmLeft < 1 ? 0 : Math.round((kmLeft / pace) * 60);

        // From the last position, not from "now", if the signal is old.
        eta = new Date((last ? Math.max(last.time, now - 15 * 60000) : now) + etaMinutes * 60000).toISOString();
    }

    // Heading away: farther from the target than 15 minutes ago.
    let away = false;

    if (last && target && phase === "TO_DESTINATION") {
        const before = [...points].reverse().find((point) => now - point.time >= 15 * 60000 && now - point.time <= 40 * 60000);

        if (before) {
            away = distanceKm(last, target) - distanceKm(before, target) > 3 && (speedNow ?? 0) > 10;
        }
    }

    const near = last ? nearestCity(last) : null;

    const previous = points.length > 1 ? points[points.length - 2] : null;

    const heading =
        last?.heading !== null && last?.heading !== undefined
            ? last.heading
            : previous && distanceKm(previous, last) > 0.02
                ? bearing(previous, last)
                : target && last
                    ? bearing(last, target)
                    : null;

    return {
        phase,
        target: target ? { name: target.name, lat: target.lat, lng: target.lng } : null,
        km_total: kmTotal,
        km_left: kmLeft,
        progress: Math.round(progress * 100) / 100,
        speed_kmh: speedNow !== null ? Math.round(speedNow) : null,
        moving,
        stopped_minutes: stoppedMinutes,
        eta,
        eta_minutes: etaMinutes,
        near: near ? { name: near.name, km: Math.round(near.km) } : null,
        signal,
        seconds_ago: secondsAgo,
        heading: heading === null ? null : Math.round(heading),
        away,
    };
}

function downsample(points) {
    if (points.length <= MAX_TRAIL_POINTS) {
        return points;
    }

    const step = points.length / (MAX_TRAIL_POINTS - 1);

    const kept = [];

    for (let index = 0; index < MAX_TRAIL_POINTS - 1; index++) {
        kept.push(points[Math.floor(index * step)]);
    }

    kept.push(points[points.length - 1]);

    return kept;
}

/* =========================================================
   WHAT ONE VIEWER MAY SEE
========================================================= */

/*
 * session: the signed-in session or null; token: the private
 * link's token, if any. Unknown trips and trips this viewer
 * may not see both answer "not found".
 */
export async function trackView(session, id, token) {
    if (!UUID.test(String(id || ""))) {
        throw new EngineError("Trip not found.", 404);
    }

    const shipment = must(await db.from("shipments").select("*").eq("id", id).maybeSingle());

    if (!shipment) {
        throw new EngineError("Trip not found.", 404);
    }

    let viewer = null;

    if (session?.admin) {
        viewer = "admin";
    } else if (session?.user?.id && session.user.id === shipment.shipper_id) {
        viewer = "shipper";
    } else if (session?.user?.id && session.user.id === shipment.driver_id) {
        viewer = "driver";
    } else if (tokenMatches(shipment.id, token)) {
        viewer = "public";
    }

    if (!viewer) {
        throw new EngineError("Trip not found.", 404);
    }

    const isPublic = viewer === "public";

    // The receiver sees the truck only once the goods are on the road.
    const showPosition = isPublic ? ["DEPARTED", "ARRIVED"].includes(shipment.status) : Boolean(shipment.driver_id);

    let points = [];

    if (showPosition && (await trackingReady())) {
        const rows = must(
            await db
                .from("shipment_positions")
                .select("lat, lng, accuracy, speed, heading, recorded_at")
                .eq("shipment_id", shipment.id)
                .order("recorded_at", { ascending: false })
                .limit(3000)
        ) || [];

        points = rows.reverse().map((row) => ({
            lat: Number(row.lat),
            lng: Number(row.lng),
            accuracy: row.accuracy,
            speed: row.speed === null ? null : Number(row.speed),
            heading: row.heading === null ? null : Number(row.heading),
            time: new Date(row.recorded_at).getTime(),
        }));

        // Each phase draws its own part: the drive to the pickup,
        // then the goods' trip from departure (2 minutes of slack
        // for phone clocks).
        const startedAt = Date.parse(["MATCHED"].includes(shipment.status) ? shipment.matched_at : shipment.departed_at || shipment.matched_at);

        if (Number.isFinite(startedAt)) {
            const sincePhase = points.filter((point) => point.time >= startedAt - 120000);

            points = sincePhase.length ? sincePhase : points.slice(-1);
        }

        points = dropGlitches(points);
    }

    // Before the tracking table exists: the last position only.
    if (showPosition && points.length === 0 && shipment.last_lat !== null && shipment.last_lat !== undefined && shipment.last_location_at) {
        points = [{
            lat: Number(shipment.last_lat),
            lng: Number(shipment.last_lng),
            accuracy: shipment.last_location_accuracy,
            speed: shipment.last_speed ?? null,
            heading: shipment.last_heading ?? null,
            time: new Date(shipment.last_location_at).getTime(),
        }];
    }

    // A finished trip keeps its trail for the shipper; the
    // driver's position isn't "live" anymore.
    const live = LIVE_STATUSES.includes(shipment.status);

    const trip = readTrip(shipment, points);

    const driver = shipment.driver_id ? (await usersById([shipment.driver_id])).get(shipment.driver_id) : null;

    const { from, to } = tripEnds(shipment);

    const last = points[points.length - 1] || null;

    return {
        viewer,
        shipment: {
            id: shipment.id,
            status: shipment.status,
            item_type: shipment.item_type,
            quantity: shipment.quantity,
            origin: shipment.origin,
            destination: shipment.destination,
            origin_city: shipment.origin_city,
            destination_city: shipment.destination_city,
            currency: shipment.currency || null,
            is_produce: Boolean(shipment.order_id),
            created_at: shipment.created_at,
            matched_at: shipment.matched_at,
            departed_at: shipment.departed_at,
            arrived_at: shipment.arrived_at,
            completed_at: shipment.completed_at,
            ...(isPublic
                ? {}
                : {
                    agreed_price: shipment.agreed_price,
                    initial_offer: shipment.initial_offer,
                    receiver_phone: shipment.receiver_phone,
                    shipper_name: shipment.shipper_name,
                    shipper_phone: viewer === "driver" || viewer === "admin" ? shipment.shipper_phone : undefined,
                    delivery_code: viewer === "shipper" && live ? shipment.delivery_code : undefined,
                    pickup_name: shipment.pickup_name || undefined,
                    pickup_phone: viewer === "driver" || viewer === "admin" ? shipment.pickup_phone : undefined,
                }),
        },
        from: from ? { name: from.name, lat: from.lat, lng: from.lng } : null,
        to: to ? { name: to.name, lat: to.lat, lng: to.lng } : null,
        driver: driver
            ? {
                name: isPublic ? String(driver.full_name || "").split(/\s+/)[0] : driver.full_name,
                vehicle_type: driver.vehicle_type,
                plate_number: driver.plate_number,
                rating: driver.rating,
                rating_count: driver.rating_count || 0,
                phone: isPublic ? undefined : driver.phone_number,
            }
            : null,
        trail: downsample(points).map((point) => [Math.round(point.lat * 1e6) / 1e6, Math.round(point.lng * 1e6) / 1e6]),
        last: last
            ? {
                lat: last.lat,
                lng: last.lng,
                accuracy: last.accuracy,
                at: new Date(last.time).toISOString(),
            }
            : null,
        trip,
        live,
        token: viewer === "shipper" || viewer === "admin" ? trackToken(shipment.id) : undefined,
    };
}
