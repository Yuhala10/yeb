import crypto from "crypto";

import { nearestCity } from "../cities";
import {
    GO_COUNTRY,
    GO_CURRENCY,
    VEHICLE_CLASSES,
    classFits,
    classesFrom,
    cleanPoint,
    driveMinutes,
    fareFor,
    inCameroon,
    pickupMinutes,
    roadKmBetween,
    vehicleClass,
    vehicleClassOf,
} from "../fleet";
import { formatMoney } from "../money";
import { isValidPhone, normalizePhone } from "../phone";
import {
    cleanText,
    db,
    EngineError,
    isMissingSchema,
    LIVE_STATUSES,
    must,
    notify,
    notifyDriversOfLoad,
    routeLabel,
    usersById,
} from "./core";
import { roadRoute } from "./geo";
import { overLimit } from "./guard";
import { onShipmentCancelled, onShipmentMatched } from "./market";
import { publicUser } from "./session";
import { recordPosition, trackToken } from "./tracking";

/*
 * ============================================================
 * TAYEB GO: ON-DEMAND DELIVERY
 * ============================================================
 *
 * The customer sets a pickup and a drop-off on the map,
 * chooses a vehicle and gets a fixed price. Tayeb then offers
 * the job to the nearest online drivers with the right
 * vehicle, a few at a time, each with 20 seconds to accept.
 * The first to accept gets it. If nobody does, the search
 * widens: farther, then bigger vehicles, for up to 5 minutes.
 *
 * Nothing runs in the background: the search moves forward
 * each time the waiting customer's screen asks for news
 * (every few seconds), and right away when a driver skips.
 *
 * A trip is a load (shipments row) with mode = 'INSTANT', so
 * the delivery code, live tracking, notifications and ratings
 * work exactly like the loads board. Offers are rows in
 * dispatch_offers:
 *   PENDING → ACCEPTED | DECLINED | EXPIRED | TAKEN | CANCELLED
 *
 * Privacy: drivers' exact positions are only shown to the
 * customer of their trip. "Cars near you" are anonymous and
 * shifted by about 100 m. Phone numbers appear after a driver
 * accepts.
 */

const OFFER_SECONDS = 20;

// Phones and networks are slow sometimes: a late tap still counts.
const GRACE_MS = 3000;

// A driver whose phone hasn't said where it is for this long is away.
const FRESH_MS = 3 * 60000;

const SEARCH_MAX_MS = 5 * 60000;

const WAVE_SIZE = 2;

const NEARBY_KM = 8;

// Search radius (km) by seconds of searching.
const RADIUS = [
    [40, 4],
    [80, 8],
    [140, 15],
    [220, 30],
    [Infinity, 60],
];

// Vans and trucks are fewer and farther apart.
const RADIUS_FACTOR = { VAN: 2, TRUCK: 3 };

// After a minute, bigger vehicles can take the job too, at the same price.
const BIGGER_AFTER_MS = 60000;

const HEARTBEAT_GAP_MS = 4000;

const MAX_ACTIVE_TRIPS = 3;

const MAX_CODE_ATTEMPTS = 5;

/* =========================================================
   IS TAYEB GO SET UP? (supabase/upgrade.sql)
========================================================= */

let readyState = { ready: false, checkedAt: 0 };

export async function goReady() {
    if (readyState.ready) {
        return true;
    }

    if (Date.now() - readyState.checkedAt < 30000) {
        return false;
    }

    const [offers, users, shipments] = await Promise.all([
        db.from("dispatch_offers").select("id").limit(1),
        db.from("users").select("online, location_at, vehicle_class").limit(1),
        db.from("shipments").select("mode, pickup_lat, at_pickup_at, cancelled_at, country").limit(1),
    ]);

    const error = offers.error || users.error || shipments.error;

    if (error && !isMissingSchema(error)) {
        console.error("Tayeb Go check failed:", error);
    }

    readyState = { ready: !error, checkedAt: Date.now() };

    return readyState.ready;
}

async function mustBeReady() {
    if (!(await goReady())) {
        throw new EngineError("Tayeb Go opens very soon.", 503, "GO_NOT_READY");
    }
}

/* =========================================================
   SMALL HELPERS
========================================================= */

function newDeliveryCode() {
    return String(crypto.randomInt(1000, 10000));
}

function place(input, code) {
    const point = cleanPoint(input);

    if (!point || !inCameroon(point)) {
        throw new EngineError("Choose a place in Cameroon on the map.", 400, code);
    }

    return point;
}

function driverClass(user) {
    return user?.vehicle_class || vehicleClassOf(user?.vehicle_type) || "PICKUP";
}

function minutesAgo(iso, now = Date.now()) {
    return iso ? Math.max(0, Math.round((now - Date.parse(iso)) / 60000)) : null;
}

async function getTrip(id) {
    if (!id || !/^[0-9a-f-]{36}$/i.test(String(id))) {
        throw new EngineError("Trip not found.", 404);
    }

    const shipment = must(await db.from("shipments").select("*").eq("id", id).maybeSingle());

    if (!shipment) {
        throw new EngineError("Trip not found.", 404);
    }

    return shipment;
}

async function ownTrip(customer, id) {
    const shipment = await getTrip(id);

    if (shipment.shipper_id !== customer.id || shipment.mode !== "INSTANT") {
        throw new EngineError("Trip not found.", 404);
    }

    return shipment;
}

async function closeOffers(shipmentId, status) {
    must(
        await db
            .from("dispatch_offers")
            .update({ status, responded_at: new Date().toISOString() })
            .eq("shipment_id", shipmentId)
            .eq("status", "PENDING")
    );
}

/*
 * Pickup to drop-off by road: the routing service when there
 * is one, otherwise an estimate.
 */
async function tripRoute(from, to) {
    const road = await roadRoute(from, to);

    const km = road ? road.km : roadKmBetween(from, to);

    return {
        km,
        minutes: road ? road.minutes : driveMinutes(km),
        line: road?.line || null,
    };
}

function pointsOf(shipment) {
    const has = (lat, lng) => lat !== null && lat !== undefined && lng !== null && lng !== undefined;

    return {
        pickup: has(shipment.pickup_lat, shipment.pickup_lng) ? { lat: Number(shipment.pickup_lat), lng: Number(shipment.pickup_lng) } : null,
        dropoff: has(shipment.dropoff_lat, shipment.dropoff_lng) ? { lat: Number(shipment.dropoff_lat), lng: Number(shipment.dropoff_lng) } : null,
    };
}

/* =========================================================
   DRIVERS ONLINE NEAR A POINT
========================================================= */

/*
 * Online drivers whose phone sent a position in the last 3
 * minutes, within `maxKm` of `near` by road, not busy with a
 * delivery, nearest first. Each has { km, cls, lat, lng }.
 */
async function liveDrivers(near, maxKm) {
    const since = new Date(Date.now() - FRESH_MS).toISOString();

    const rows = must(
        await db
            .from("users")
            .select("id, vehicle_type, vehicle_class, location_lat, location_lng, location_heading, location_at")
            .eq("role", "DRIVER")
            .eq("online", true)
            .gte("location_at", since)
            .limit(3000)
    ) || [];

    const close = rows
        .filter((row) => row.location_lat !== null && row.location_lng !== null)
        .map((row) => {
            const at = { lat: Number(row.location_lat), lng: Number(row.location_lng) };

            return { ...row, ...at, cls: driverClass(row), km: roadKmBetween(at, near) };
        })
        .filter((row) => row.km !== null && row.km <= maxKm)
        .sort((x, y) => x.km - y.km)
        .slice(0, 60);

    if (close.length === 0) {
        return [];
    }

    const busy = must(
        await db
            .from("shipments")
            .select("driver_id")
            .in("status", LIVE_STATUSES)
            .in("driver_id", close.map((row) => row.id))
    ) || [];

    const busyIds = new Set(busy.map((row) => row.driver_id));

    return close.filter((row) => !busyIds.has(row.id));
}

/*
 * "Cars near you": no names, a stable ~100 m shift per driver
 * and day, heading rounded to 45°.
 */
function anonymous(driver) {
    const day = new Date().toISOString().slice(0, 10);

    const hash = crypto.createHash("sha256").update(`${driver.id}|${day}`).digest();

    const shift = (byte) => (byte / 255 - 0.5) * 0.0018;

    return {
        lat: Math.round((driver.lat + shift(hash[0])) * 1e4) / 1e4,
        lng: Math.round((driver.lng + shift(hash[1])) * 1e4) / 1e4,
        heading: driver.location_heading === null || driver.location_heading === undefined ? null : (Math.round(Number(driver.location_heading) / 45) * 45) % 360,
        cls: driver.cls,
    };
}

export async function goNearby(user, { lat, lng }) {
    if (!(await goReady())) {
        return { cars: [] };
    }

    const at = cleanPoint({ lat, lng });

    if (!at || !inCameroon(at)) {
        return { cars: [] };
    }

    const drivers = await liveDrivers(at, NEARBY_KM);

    const classes = {};

    for (const item of VEHICLE_CLASSES) {
        const nearest = drivers.find((driver) => driver.cls === item.key);

        classes[item.key] = nearest ? pickupMinutes(nearest.km) : null;
    }

    return {
        cars: drivers.filter((driver) => driver.id !== user?.id).slice(0, 15).map(anonymous),
        eta: classes,
    };
}

/* =========================================================
   CUSTOMER: PRICES BEFORE ORDERING
========================================================= */

export async function goQuote(customer, { pickup, dropoff }) {
    await mustBeReady();

    const from = place(pickup, "GO_PICKUP");
    const to = place(dropoff, "GO_DROPOFF");

    const route = await tripRoute(from, to);

    if (route.km < 0.2) {
        throw new EngineError("Pickup and drop-off are the same place.", 400, "GO_SAME_PLACE");
    }

    const drivers = await liveDrivers(from, 30);

    return {
        km: route.km,
        minutes: route.minutes,
        line: route.line,
        currency: GO_CURRENCY,
        classes: VEHICLE_CLASSES.map((item) => {
            const own = drivers.filter((driver) => driver.cls === item.key);

            return {
                key: item.key,
                price: fareFor(item.key, route.km),
                fits: classFits(item.key, route.km),
                drivers: own.filter((driver) => driver.km <= 10).length,
                eta_min: own[0] ? pickupMinutes(own[0].km) : null,
            };
        }),
    };
}

/* =========================================================
   CUSTOMER: ORDER
========================================================= */

export async function goRequest(customer, input) {
    await mustBeReady();

    if (overLimit(`go-request|${customer.id}`, 15, 3600000)) {
        throw new EngineError("Too many requests. Please wait a little.", 429, "RATE_LIMITED");
    }

    const from = place(input.pickup, "GO_PICKUP");
    const to = place(input.dropoff, "GO_DROPOFF");

    const key = vehicleClass(input.vehicleClass)?.key;

    if (!key) {
        throw new EngineError("Choose a vehicle.", 400, "GO_CLASS");
    }

    const route = await tripRoute(from, to);

    if (route.km < 0.2) {
        throw new EngineError("Pickup and drop-off are the same place.", 400, "GO_SAME_PLACE");
    }

    if (!classFits(key, route.km)) {
        throw new EngineError("This vehicle is for trips in town. Choose a pick-up or bigger.", 400, "GO_TOO_FAR");
    }

    const receiverPhone = input.receiverPhone ? normalizePhone(input.receiverPhone, GO_COUNTRY) : "";

    if (input.receiverPhone && !isValidPhone(receiverPhone)) {
        throw new EngineError("The receiver's phone number doesn't look right.", 400, "GO_RECEIVER");
    }

    const active = must(
        await db
            .from("shipments")
            .select("id")
            .eq("shipper_id", customer.id)
            .eq("mode", "INSTANT")
            .in("status", ["OPEN", ...LIVE_STATUSES])
            .limit(MAX_ACTIVE_TRIPS + 1)
    ) || [];

    if (active.length >= MAX_ACTIVE_TRIPS) {
        throw new EngineError("You already have 3 deliveries in progress.", 409, "GO_TOO_MANY");
    }

    const price = fareFor(key, route.km);

    const quantity = Number(input.quantity);

    const pickupAddress = cleanText(input.pickupAddress, 120);
    const dropoffAddress = cleanText(input.dropoffAddress, 120);

    const fromCity = nearestCity(from, GO_COUNTRY);
    const toCity = nearestCity(to, GO_COUNTRY);

    const now = new Date().toISOString();

    const shipment = must(
        await db
            .from("shipments")
            .insert([
                {
                    shipper_id: customer.id,
                    shipper_name: customer.full_name,
                    shipper_phone: customer.phone_number,
                    item_type: cleanText(input.itemType, 60) || "Parcel",
                    quantity: Number.isFinite(quantity) && quantity > 0 && quantity <= 100000 ? quantity : 1,
                    origin: pickupAddress || fromCity?.name || "—",
                    destination: dropoffAddress || toCity?.name || "—",
                    origin_city: fromCity?.name || null,
                    destination_city: toCity?.name || null,
                    initial_offer: price,
                    receiver_phone: receiverPhone || null,
                    status: "OPEN",
                    country: GO_COUNTRY,
                    currency: GO_CURRENCY,
                    details: cleanText(input.note, 240) || null,
                    mode: "INSTANT",
                    vehicle_class: key,
                    pickup_lat: from.lat,
                    pickup_lng: from.lng,
                    dropoff_lat: to.lat,
                    dropoff_lng: to.lng,
                    pickup_address: pickupAddress || null,
                    dropoff_address: dropoffAddress || null,
                    distance_km: route.km,
                    quoted_price: price,
                    payment_method: input.paymentMethod === "MOMO" ? "MOMO" : "CASH",
                    dispatch_status: "SEARCHING",
                    searching_since: now,
                },
            ])
            .select("*")
            .single()
    );

    const search = await advanceDispatch(shipment);

    return { tripId: shipment.id, price, km: route.km, search };
}

/* =========================================================
   THE SEARCH
========================================================= */

function searchInfo(shipment, offers, elapsed, radius) {
    return {
        status: shipment.dispatch_status,
        contacted: new Set(offers.map((offer) => offer.driver_id)).size,
        waiting: offers.filter((offer) => offer.status === "PENDING").length,
        elapsed_s: Math.round((elapsed || 0) / 1000),
        max_s: SEARCH_MAX_MS / 1000,
        radius_km: radius ?? null,
    };
}

/*
 * Moves the search forward one step: closes offers nobody
 * answered, then (if no offer is waiting) offers the job to
 * the next nearest drivers, or gives up after 5 minutes.
 */
export async function advanceDispatch(shipment) {
    if (shipment.mode !== "INSTANT" || shipment.status !== "OPEN") {
        return null;
    }

    const now = Date.now();

    const started = Date.parse(shipment.searching_since || shipment.created_at);

    const elapsed = now - started;

    if (shipment.dispatch_status !== "SEARCHING") {
        return searchInfo(shipment, [], elapsed);
    }

    const offers = must(
        await db
            .from("dispatch_offers")
            .select("*")
            .eq("shipment_id", shipment.id)
            .order("created_at", { ascending: true })
    ) || [];

    const stale = offers.filter((offer) => offer.status === "PENDING" && Date.parse(offer.expires_at) + GRACE_MS < now);

    if (stale.length) {
        must(
            await db
                .from("dispatch_offers")
                .update({ status: "EXPIRED" })
                .in("id", stale.map((offer) => offer.id))
                .eq("status", "PENDING")
        );

        stale.forEach((offer) => {
            offer.status = "EXPIRED";
        });
    }

    if (offers.some((offer) => offer.status === "PENDING")) {
        return searchInfo(shipment, offers, elapsed);
    }

    if (elapsed > SEARCH_MAX_MS) {
        const stopped = must(
            await db
                .from("shipments")
                .update({ dispatch_status: "NO_DRIVER" })
                .eq("id", shipment.id)
                .eq("status", "OPEN")
                .eq("dispatch_status", "SEARCHING")
                .select("id")
        );

        shipment.dispatch_status = "NO_DRIVER";

        if (stopped && stopped.length) {
            await notify([
                {
                    user_id: shipment.shipper_id,
                    shipment_id: shipment.id,
                    type: "GO_NO_DRIVER",
                    link: `/go?trip=${shipment.id}`,
                    title: "Aucun chauffeur pour l'instant · No driver yet",
                    message: routeLabel(shipment),
                },
            ]);
        }

        return searchInfo(shipment, offers, elapsed);
    }

    const step = RADIUS.find(([seconds]) => elapsed / 1000 < seconds);

    const radius = step[1] * (RADIUS_FACTOR[shipment.vehicle_class] || 1);

    const allowed = elapsed >= BIGGER_AFTER_MS ? classesFrom(shipment.vehicle_class) : [shipment.vehicle_class];

    // Asked during this search, or said no to this trip: not again.
    const excluded = new Set(
        offers
            .filter((offer) => ["DECLINED", "CANCELLED", "ACCEPTED"].includes(offer.status) || Date.parse(offer.created_at) >= started - 1000)
            .map((offer) => offer.driver_id)
    );

    excluded.add(shipment.shipper_id);

    const { pickup } = pointsOf(shipment);

    if (!pickup) {
        return searchInfo(shipment, offers, elapsed, radius);
    }

    let drivers = (await liveDrivers(pickup, radius)).filter((driver) => allowed.includes(driver.cls) && !excluded.has(driver.id));

    // A driver already looking at another request waits for the next round.
    if (drivers.length) {
        const looking = must(
            await db
                .from("dispatch_offers")
                .select("driver_id")
                .eq("status", "PENDING")
                .gte("expires_at", new Date(now - GRACE_MS).toISOString())
                .in("driver_id", drivers.slice(0, 30).map((driver) => driver.id))
        ) || [];

        const lookingIds = new Set(looking.map((offer) => offer.driver_id));

        drivers = drivers.filter((driver) => !lookingIds.has(driver.id));
    }

    const chosen = drivers.slice(0, WAVE_SIZE);

    if (chosen.length) {
        const wave = offers.reduce((max, offer) => Math.max(max, offer.wave || 0), 0) + 1;

        const expires = new Date(now + OFFER_SECONDS * 1000).toISOString();

        const inserted = must(
            await db
                .from("dispatch_offers")
                .insert(
                    chosen.map((driver) => ({
                        shipment_id: shipment.id,
                        driver_id: driver.id,
                        wave,
                        distance_km: driver.km,
                        pickup_eta_min: pickupMinutes(driver.km),
                        status: "PENDING",
                        expires_at: expires,
                    }))
                )
                .select("*")
        ) || [];

        offers.push(...inserted);
    }

    return searchInfo(shipment, offers, elapsed, radius);
}

/* =========================================================
   WHAT THE CUSTOMER SEES
========================================================= */

async function driverPosition(shipment, driver) {
    if (shipment.last_lat !== null && shipment.last_lat !== undefined && shipment.last_location_at && Date.parse(shipment.last_location_at) >= Date.parse(shipment.matched_at || 0) - 60000) {
        return {
            lat: Number(shipment.last_lat),
            lng: Number(shipment.last_lng),
            heading: shipment.last_heading ?? null,
            at: shipment.last_location_at,
        };
    }

    if (driver?.location_at && Date.now() - Date.parse(driver.location_at) < 10 * 60000 && driver.location_lat !== null) {
        return {
            lat: Number(driver.location_lat),
            lng: Number(driver.location_lng),
            heading: driver.location_heading ?? null,
            at: driver.location_at,
        };
    }

    return null;
}

function placeOf(shipment, side) {
    const { pickup, dropoff } = pointsOf(shipment);

    const point = side === "pickup" ? pickup : dropoff;

    return {
        ...(point || {}),
        address: side === "pickup" ? shipment.pickup_address || shipment.origin : shipment.dropoff_address || shipment.destination,
        city: side === "pickup" ? shipment.origin_city : shipment.destination_city,
    };
}

async function tripView(shipment, search) {
    const live = LIVE_STATUSES.includes(shipment.status);

    const driver = shipment.driver_id ? (await usersById([shipment.driver_id])).get(shipment.driver_id) : null;

    const position = driver && live ? await driverPosition(shipment, driver) : null;

    const { pickup, dropoff } = pointsOf(shipment);

    const target = shipment.status === "MATCHED" ? pickup : dropoff;

    const kmAway = position && target ? roadKmBetween(position, target) : null;

    const route = pickup && dropoff ? await roadRoute(pickup, dropoff) : null;

    return {
        trip: {
            id: shipment.id,
            status: shipment.status,
            dispatch_status: shipment.dispatch_status,
            mode: shipment.mode,
            vehicle_class: shipment.vehicle_class,
            price: shipment.agreed_price ?? shipment.quoted_price ?? shipment.initial_offer,
            currency: shipment.currency || GO_CURRENCY,
            km: shipment.distance_km !== null && shipment.distance_km !== undefined ? Number(shipment.distance_km) : null,
            minutes: driveMinutes(Number(shipment.distance_km) || 0),
            item_type: shipment.item_type,
            quantity: shipment.quantity,
            note: shipment.details,
            payment_method: shipment.payment_method,
            receiver_phone: shipment.receiver_phone,
            pickup: placeOf(shipment, "pickup"),
            dropoff: placeOf(shipment, "dropoff"),
            created_at: shipment.created_at,
            searching_since: shipment.searching_since,
            matched_at: shipment.matched_at,
            at_pickup_at: shipment.at_pickup_at,
            departed_at: shipment.departed_at,
            arrived_at: shipment.arrived_at,
            completed_at: shipment.completed_at,
            cancelled_at: shipment.cancelled_at,
            cancelled_by: shipment.cancelled_by,
            driver_rating: shipment.driver_rating,
            delivery_code: live ? shipment.delivery_code : null,
            track_token: live ? trackToken(shipment.id) : null,
        },
        search,
        driver: driver
            ? {
                name: driver.full_name,
                phone: live ? driver.phone_number : null,
                rating: driver.rating,
                rating_count: driver.rating_count || 0,
                trips: driver.total_completed_shipments || 0,
                vehicle_type: driver.vehicle_type,
                vehicle_class: driverClass(driver),
                plate: driver.plate_number,
                position,
                km_away: kmAway,
                eta_min: kmAway === null ? null : shipment.status === "MATCHED" ? (shipment.at_pickup_at ? 0 : pickupMinutes(kmAway)) : driveMinutes(kmAway),
                minutes_ago: position ? minutesAgo(position.at) : null,
            }
            : null,
        route: route?.line || null,
    };
}

export async function goTrip(customer, tripId) {
    const shipment = await ownTrip(customer, tripId);

    const search = shipment.status === "OPEN" ? await advanceDispatch(shipment) : null;

    return tripView(shipment, search);
}

/*
 * The trip to show when the customer opens Tayeb Go: one in
 * progress, or one delivered in the last hour and not rated.
 */
export async function goActive(customer) {
    if (!(await goReady())) {
        return { ready: false, tripId: null };
    }

    const rows = must(
        await db
            .from("shipments")
            .select("id, status, completed_at, driver_rating, dispatch_status")
            .eq("shipper_id", customer.id)
            .eq("mode", "INSTANT")
            .order("created_at", { ascending: false })
            .limit(10)
    ) || [];

    const now = Date.now();

    const current =
        rows.find((row) => row.status === "OPEN" || LIVE_STATUSES.includes(row.status)) ||
        rows.find((row) => row.status === "COMPLETED" && !row.driver_rating && row.completed_at && now - Date.parse(row.completed_at) < 3600000);

    return { ready: true, tripId: current?.id || null };
}

/* =========================================================
   CUSTOMER: CANCEL, SEARCH AGAIN, ASK FOR PRICES INSTEAD
========================================================= */

export async function goCancel(customer, { tripId, reason }) {
    const shipment = await ownTrip(customer, tripId);

    const now = new Date().toISOString();

    const why = cleanText(reason, 120) || null;

    if (shipment.status === "OPEN") {
        const done = must(
            await db
                .from("shipments")
                .update({ status: "CANCELLED", dispatch_status: null, cancelled_at: now, cancelled_by: "CUSTOMER", cancel_reason: why })
                .eq("id", shipment.id)
                .eq("status", "OPEN")
                .select("id")
        );

        if (!done || done.length === 0) {
            throw new EngineError("A driver just accepted. Open the trip to see them.", 409, "ALREADY_MATCHED");
        }

        await closeOffers(shipment.id, "CANCELLED");

        if (shipment.order_id) {
            await onShipmentCancelled(shipment);
        }

        return {};
    }

    if (shipment.status === "MATCHED") {
        const done = must(
            await db
                .from("shipments")
                .update({ status: "CANCELLED", cancelled_at: now, cancelled_by: "CUSTOMER", cancel_reason: why })
                .eq("id", shipment.id)
                .eq("status", "MATCHED")
                .select("id")
        );

        if (!done || done.length === 0) {
            throw new EngineError("The goods are already on the way: call your driver.", 409, "GO_TOO_LATE");
        }

        await notify([
            {
                user_id: shipment.driver_id,
                shipment_id: shipment.id,
                type: "GO_CANCELLED",
                link: "/drive",
                title: "Livraison annulée par le client · Delivery cancelled",
                message: routeLabel(shipment),
            },
        ]);

        if (shipment.order_id) {
            await onShipmentCancelled(shipment);
        }

        return {};
    }

    throw new EngineError("The goods are already on the way: call your driver.", 409, "GO_TOO_LATE");
}

export async function goRetry(customer, { tripId, vehicleClass: wanted }) {
    const shipment = await ownTrip(customer, tripId);

    if (shipment.status !== "OPEN") {
        throw new EngineError("This trip already has a driver.", 409, "ALREADY_MATCHED");
    }

    const updates = { dispatch_status: "SEARCHING", searching_since: new Date().toISOString() };

    if (wanted && wanted !== shipment.vehicle_class) {
        const km = Number(shipment.distance_km);

        if (!vehicleClass(wanted) || !classFits(wanted, km)) {
            throw new EngineError("Choose a vehicle.", 400, "GO_CLASS");
        }

        const price = fareFor(wanted, km);

        Object.assign(updates, { vehicle_class: wanted, quoted_price: price, initial_offer: price });

        // Offers at the old price are withdrawn.
        await closeOffers(shipment.id, "CANCELLED");
    }

    const updated = must(
        await db
            .from("shipments")
            .update(updates)
            .eq("id", shipment.id)
            .eq("status", "OPEN")
            .select("*")
    );

    if (!updated || updated.length === 0) {
        throw new EngineError("This trip already has a driver.", 409, "ALREADY_MATCHED");
    }

    return { search: await advanceDispatch(updated[0]) };
}

/*
 * Nobody accepted: put the trip on the loads board, where
 * drivers send their own prices.
 */
export async function goToBoard(customer, { tripId }) {
    const shipment = await ownTrip(customer, tripId);

    if (shipment.status !== "OPEN") {
        throw new EngineError("This trip already has a driver.", 409, "ALREADY_MATCHED");
    }

    const updated = must(
        await db
            .from("shipments")
            .update({ mode: "BOARD", dispatch_status: null, initial_offer: shipment.quoted_price || shipment.initial_offer })
            .eq("id", shipment.id)
            .eq("status", "OPEN")
            .select("*")
    );

    if (!updated || updated.length === 0) {
        throw new EngineError("This trip already has a driver.", 409, "ALREADY_MATCHED");
    }

    await closeOffers(shipment.id, "CANCELLED");

    const notified = await notifyDriversOfLoad(updated[0]);

    return { shipmentId: shipment.id, notified };
}

/* =========================================================
   DRIVER: ONLINE, POSITION, NEWS
========================================================= */

export async function goOnline(driver, { online, lat, lng, accuracy, heading }) {
    await mustBeReady();

    const now = new Date().toISOString();

    let updates;

    if (online) {
        const at = cleanPoint({ lat, lng });

        if (!at) {
            throw new EngineError("Allow location to go online.", 400, "GO_NEED_LOCATION");
        }

        if (!inCameroon(at)) {
            throw new EngineError("Tayeb Go works in Cameroon for now.", 400, "GO_OUTSIDE");
        }

        updates = {
            online: true,
            is_available: true,
            location_lat: at.lat,
            location_lng: at.lng,
            location_accuracy: Number.isFinite(Number(accuracy)) ? Math.round(Number(accuracy)) : null,
            location_heading: Number.isFinite(Number(heading)) && heading !== null ? Number(heading) : null,
            location_at: now,
            vehicle_class: driverClass(driver),
            last_seen: now,
        };
    } else {
        updates = { online: false, last_seen: now };

        // Offers on the screen go to the next driver.
        must(
            await db
                .from("dispatch_offers")
                .update({ status: "EXPIRED", responded_at: now })
                .eq("driver_id", driver.id)
                .eq("status", "PENDING")
        );
    }

    const user = must(await db.from("users").update(updates).eq("id", driver.id).select("*").maybeSingle());

    return { user: publicUser(user) };
}

const lastBeat = new Map();

export async function goHeartbeat(driver, input) {
    const point = cleanPoint(input);

    if (!point || Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) {
        throw new EngineError("Invalid location.");
    }

    const now = Date.now();

    if (now - (lastBeat.get(driver.id) || 0) < HEARTBEAT_GAP_MS) {
        return { skipped: "too_soon" };
    }

    lastBeat.set(driver.id, now);

    if (lastBeat.size > 20000) {
        lastBeat.clear();
    }

    const accuracy = Number(input.accuracy);
    const heading = Number(input.heading);
    const speed = Number(input.speed);

    const at = new Date(now).toISOString();

    must(
        await db
            .from("users")
            .update({
                location_lat: point.lat,
                location_lng: point.lng,
                location_accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
                location_heading: input.heading !== null && input.heading !== undefined && Number.isFinite(heading) && heading >= 0 && heading <= 360 ? heading : null,
                location_at: at,
                ...(now - Date.parse(driver.last_seen || 0) > 5 * 60000 ? { last_seen: at } : {}),
            })
            .eq("id", driver.id)
    );

    // On a delivery: the customer's map moves too.
    const job = must(
        await db
            .from("shipments")
            .select("*")
            .eq("driver_id", driver.id)
            .in("status", ["MATCHED", "DEPARTED"])
            .order("matched_at", { ascending: false })
            .limit(1)
    )?.[0];

    if (job) {
        await recordPosition(job, {
            lat: point.lat,
            lng: point.lng,
            accuracy: Number.isFinite(accuracy) ? accuracy : null,
            speed: input.speed !== null && input.speed !== undefined && Number.isFinite(speed) ? speed : null,
            heading: input.heading !== null && input.heading !== undefined && Number.isFinite(heading) ? heading : null,
        });
    }

    return { ok: true };
}

function offerView(offer, shipment, now) {
    return {
        id: offer.id,
        expires_at: offer.expires_at,
        seconds: OFFER_SECONDS,
        remaining_ms: Math.max(0, Date.parse(offer.expires_at) - now),
        pickup_km: offer.distance_km !== null ? Number(offer.distance_km) : null,
        pickup_min: offer.pickup_eta_min,
        trip: {
            id: shipment.id,
            vehicle_class: shipment.vehicle_class,
            price: shipment.quoted_price ?? shipment.initial_offer,
            currency: shipment.currency || GO_CURRENCY,
            km: shipment.distance_km !== null ? Number(shipment.distance_km) : null,
            minutes: driveMinutes(Number(shipment.distance_km) || 0),
            item_type: shipment.item_type,
            quantity: shipment.quantity,
            note: shipment.details,
            payment_method: shipment.payment_method,
            pickup: placeOf(shipment, "pickup"),
            dropoff: placeOf(shipment, "dropoff"),
        },
    };
}

function jobView(shipment) {
    return {
        id: shipment.id,
        status: shipment.status,
        mode: shipment.mode,
        vehicle_class: shipment.vehicle_class,
        price: shipment.agreed_price,
        currency: shipment.currency || GO_CURRENCY,
        km: shipment.distance_km !== null && shipment.distance_km !== undefined ? Number(shipment.distance_km) : null,
        item_type: shipment.item_type,
        quantity: shipment.quantity,
        note: shipment.details,
        payment_method: shipment.payment_method,
        pickup: placeOf(shipment, "pickup"),
        dropoff: placeOf(shipment, "dropoff"),
        customer: { name: shipment.shipper_name, phone: shipment.shipper_phone },
        receiver_phone: shipment.receiver_phone,
        pickup_name: shipment.pickup_name,
        pickup_phone: shipment.pickup_phone,
        needs_code: Boolean(shipment.delivery_code),
        code_locked: (shipment.delivery_code_attempts || 0) >= MAX_CODE_ATTEMPTS,
        matched_at: shipment.matched_at,
        at_pickup_at: shipment.at_pickup_at,
        departed_at: shipment.departed_at,
        arrived_at: shipment.arrived_at,
    };
}

// Midnight in Cameroon (UTC+1, no summer time).
function startOfToday() {
    const now = new Date(Date.now() + 3600000);

    now.setUTCHours(0, 0, 0, 0);

    return new Date(now.getTime() - 3600000).toISOString();
}

async function driverToday(driver) {
    const [done, recent] = await Promise.all([
        db
            .from("shipments")
            .select("agreed_price")
            .eq("driver_id", driver.id)
            .eq("status", "COMPLETED")
            .gte("completed_at", startOfToday())
            .limit(500),
        db
            .from("dispatch_offers")
            .select("status")
            .eq("driver_id", driver.id)
            .in("status", ["ACCEPTED", "DECLINED", "EXPIRED"])
            .order("created_at", { ascending: false })
            .limit(50),
    ]);

    const trips = must(done) || [];
    const answers = must(recent) || [];

    return {
        earned: trips.reduce((sum, trip) => sum + Number(trip.agreed_price || 0), 0),
        trips: trips.length,
        acceptance: answers.length >= 3 ? Math.round((100 * answers.filter((offer) => offer.status === "ACCEPTED").length) / answers.length) : null,
        currency: GO_CURRENCY,
    };
}

/*
 * What the driver's screen needs every few seconds: the
 * request to answer (if any) and the delivery in progress.
 */
export async function goDriver(driver, { full } = {}) {
    if (!(await goReady())) {
        return { ready: false };
    }

    const now = Date.now();

    const rows = must(
        await db
            .from("dispatch_offers")
            .select("*")
            .eq("driver_id", driver.id)
            .eq("status", "PENDING")
            .gte("expires_at", new Date(now - GRACE_MS).toISOString())
            .order("created_at", { ascending: false })
            .limit(3)
    ) || [];

    let offer = null;

    for (const row of rows) {
        const shipment = must(await db.from("shipments").select("*").eq("id", row.shipment_id).maybeSingle());

        if (!shipment || shipment.status !== "OPEN" || shipment.mode !== "INSTANT") {
            must(await db.from("dispatch_offers").update({ status: "TAKEN" }).eq("id", row.id).eq("status", "PENDING"));
            continue;
        }

        if (Date.parse(row.expires_at) > now) {
            offer = offerView(row, shipment, now);
            break;
        }
    }

    const job = must(
        await db
            .from("shipments")
            .select("*")
            .eq("driver_id", driver.id)
            .in("status", LIVE_STATUSES)
            .order("matched_at", { ascending: false })
            .limit(1)
    )?.[0];

    return {
        ready: true,
        online: Boolean(driver.online),
        located: Boolean(driver.location_at && now - Date.parse(driver.location_at) < FRESH_MS),
        vehicle_class: driverClass(driver),
        offer,
        job: job ? jobView(job) : null,
        ...(full ? { today: await driverToday(driver), rating: driver.rating, rating_count: driver.rating_count || 0 } : {}),
    };
}

/* =========================================================
   DRIVER: ANSWER A REQUEST
========================================================= */

async function ownOffer(driver, offerId) {
    if (!offerId || !/^[0-9a-f-]{36}$/i.test(String(offerId))) {
        throw new EngineError("Request not found.", 404);
    }

    const offer = must(await db.from("dispatch_offers").select("*").eq("id", offerId).maybeSingle());

    if (!offer || offer.driver_id !== driver.id) {
        throw new EngineError("Request not found.", 404);
    }

    return offer;
}

export async function goAccept(driver, { offerId }) {
    await mustBeReady();

    const offer = await ownOffer(driver, offerId);

    const now = Date.now();

    if (offer.status !== "PENDING") {
        throw new EngineError("This request is no longer available.", 409, "GO_OFFER_GONE");
    }

    if (Date.parse(offer.expires_at) + GRACE_MS < now) {
        must(await db.from("dispatch_offers").update({ status: "EXPIRED" }).eq("id", offer.id).eq("status", "PENDING"));
        throw new EngineError("Too late: this request went to another driver.", 409, "GO_OFFER_GONE");
    }

    const busy = must(
        await db.from("shipments").select("id").eq("driver_id", driver.id).in("status", LIVE_STATUSES).limit(1)
    ) || [];

    if (busy.length) {
        throw new EngineError("Finish your delivery in progress first.", 409, "GO_BUSY");
    }

    const shipment = await getTrip(offer.shipment_id);

    const iso = new Date(now).toISOString();

    const matched = shipment.status === "OPEN" && shipment.mode === "INSTANT"
        ? must(
            await db
                .from("shipments")
                .update({
                    driver_id: driver.id,
                    driver_name: driver.full_name,
                    driver_phone: driver.phone_number,
                    agreed_price: shipment.quoted_price || shipment.initial_offer,
                    status: "MATCHED",
                    matched_at: iso,
                    at_pickup_at: null,
                    delivery_code: newDeliveryCode(),
                    delivery_code_attempts: 0,
                    dispatch_status: "ASSIGNED",
                })
                .eq("id", shipment.id)
                .eq("status", "OPEN")
                .eq("mode", "INSTANT")
                .select("*")
        )
        : [];

    if (!matched || matched.length === 0) {
        must(await db.from("dispatch_offers").update({ status: "TAKEN", responded_at: iso }).eq("id", offer.id).eq("status", "PENDING"));
        throw new EngineError("Another driver took this request.", 409, "ALREADY_MATCHED");
    }

    must(await db.from("dispatch_offers").update({ status: "ACCEPTED", responded_at: iso }).eq("id", offer.id));

    must(
        await db
            .from("dispatch_offers")
            .update({ status: "TAKEN", responded_at: iso })
            .eq("shipment_id", shipment.id)
            .eq("status", "PENDING")
    );

    const trip = matched[0];

    await notify([
        {
            user_id: trip.shipper_id,
            shipment_id: trip.id,
            type: "MATCHED",
            link: `/go?trip=${trip.id}`,
            title: "Chauffeur trouvé · Driver found 🚚",
            message: `${driver.full_name}${driver.plate_number ? ` · ${driver.plate_number}` : ""} · ${formatMoney(trip.agreed_price, trip.currency)}`,
        },
    ]);

    if (trip.order_id) {
        await onShipmentMatched(trip, driver);
    }

    return { job: jobView(trip) };
}

export async function goDecline(driver, { offerId }) {
    const offer = await ownOffer(driver, offerId);

    if (offer.status === "PENDING") {
        must(
            await db
                .from("dispatch_offers")
                .update({ status: "DECLINED", responded_at: new Date().toISOString() })
                .eq("id", offer.id)
                .eq("status", "PENDING")
        );

        // The next driver hears about it now, not in 20 seconds.
        const shipment = must(await db.from("shipments").select("*").eq("id", offer.shipment_id).maybeSingle());

        if (shipment) {
            await advanceDispatch(shipment);
        }
    }

    return {};
}

/* =========================================================
   DRIVER: ON THE JOB
========================================================= */

async function ownJob(driver, tripId) {
    const shipment = await getTrip(tripId);

    if (shipment.driver_id !== driver.id) {
        throw new EngineError("Trip not found.", 404);
    }

    return shipment;
}

export async function goAtPickup(driver, { tripId }) {
    const shipment = await ownJob(driver, tripId);

    if (shipment.status !== "MATCHED") {
        throw new EngineError("This step isn't possible right now.", 409);
    }

    if (!shipment.at_pickup_at) {
        must(await db.from("shipments").update({ at_pickup_at: new Date().toISOString() }).eq("id", shipment.id).eq("status", "MATCHED"));

        await notify([
            {
                user_id: shipment.shipper_id,
                shipment_id: shipment.id,
                type: "GO_AT_PICKUP",
                link: shipment.mode === "INSTANT" ? `/go?trip=${shipment.id}` : "/shipper",
                title: "Votre chauffeur est arrivé · Your driver is here 📍",
                message: `${driver.full_name}${driver.plate_number ? ` · ${driver.plate_number}` : ""}`,
            },
        ]);
    }

    return {};
}

/*
 * The driver can't do it after all (before loading): the trip
 * goes back to searching, without them.
 */
export async function goDropJob(driver, { tripId }) {
    const shipment = await ownJob(driver, tripId);

    if (shipment.status !== "MATCHED" || shipment.mode !== "INSTANT") {
        throw new EngineError("The goods are loaded: finish the delivery or call the customer.", 409, "GO_TOO_LATE");
    }

    const reopened = must(
        await db
            .from("shipments")
            .update({
                status: "OPEN",
                driver_id: null,
                driver_name: null,
                driver_phone: null,
                agreed_price: null,
                matched_at: null,
                at_pickup_at: null,
                delivery_code: null,
                delivery_code_attempts: 0,
                dispatch_status: "SEARCHING",
                searching_since: new Date().toISOString(),
            })
            .eq("id", shipment.id)
            .eq("status", "MATCHED")
            .eq("driver_id", driver.id)
            .select("*")
    );

    if (!reopened || reopened.length === 0) {
        throw new EngineError("This step isn't possible right now.", 409);
    }

    must(
        await db
            .from("dispatch_offers")
            .update({ status: "CANCELLED" })
            .eq("shipment_id", shipment.id)
            .eq("driver_id", driver.id)
            .eq("status", "ACCEPTED")
    );

    must(
        await db
            .from("users")
            .update({ jobs_cancelled: (driver.jobs_cancelled || 0) + 1 })
            .eq("id", driver.id)
    );

    await notify([
        {
            user_id: shipment.shipper_id,
            shipment_id: shipment.id,
            type: "GO_DRIVER_LEFT",
            link: `/go?trip=${shipment.id}`,
            title: "Nouveau chauffeur en recherche · Finding you another driver",
            message: routeLabel(shipment),
        },
    ]);

    await advanceDispatch(reopened[0]);

    return {};
}

export async function goVehicleClass(driver, { vehicleClass: wanted }) {
    const key = vehicleClass(wanted)?.key;

    if (!key) {
        throw new EngineError("Choose a vehicle.", 400, "GO_CLASS");
    }

    const user = must(await db.from("users").update({ vehicle_class: key }).eq("id", driver.id).select("*").maybeSingle());

    return { user: publicUser(user) };
}
