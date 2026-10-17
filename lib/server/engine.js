import crypto from "crypto";

import { cityRoadKm, findCity, isKnownCity, resolveCity, roadKm } from "../cities";
import { DEFAULT_COUNTRY, countryOrDefault } from "../countries";
import { formatMoney } from "../money";
import {
    cleanText,
    db,
    EngineError,
    LIVE_STATUSES,
    must,
    notify,
    notifyDriversOfLoad,
    parsePrice,
    routeLabel,
    sendError,
    upgraded,
    usersById,
} from "./core";
import {
    adminMarketData,
    onShipmentCancelled,
    onShipmentCompleted,
    onShipmentDeparted,
    onShipmentMatched,
} from "./market";
import { isValidPhone, normalizePhone, publicUser } from "./session";

export { EngineError, sendError };

/*
 * ============================================================
 * TAYEB ENGINE
 * ============================================================
 *
 * All delivery rules live here and run on the server:
 * posting loads, offers and counter-offers, matching, the
 * delivery code, ratings, tracking and notifications.
 *
 * Load lifecycle:
 * OPEN → MATCHED → DEPARTED → ARRIVED → COMPLETED
 * OPEN → CANCELLED
 *
 * Bid fields: proposed_price is the driver's first price,
 * counter_price is the latest price on the table and
 * last_offer_by says who made it. Only the other side can
 * accept it.
 *
 * Loads created from a farm market order (order_id set) tell
 * market.js when they are matched, completed or cancelled.
 */

const MAX_CODE_ATTEMPTS = 5;

/*
 * Columns of a load anyone signed in as a driver may see
 * before they are matched. No names or phone numbers.
 */
const OPEN_LOAD_FIELDS = [
    "id",
    "item_type",
    "origin",
    "destination",
    "origin_city",
    "destination_city",
    "quantity",
    "initial_offer",
    "status",
    "created_at",
];

/*
 * Added by supabase/marche.sql. Only asked for once the
 * market is set up, so drivers keep working before that.
 */
const PRODUCE_LOAD_FIELDS = [
    "order_id",
    "weight_kg",
    "perishable",
    "details",
];

/* =========================================================
   SMALL HELPERS
========================================================= */

export function newDeliveryCode() {
    return String(crypto.randomInt(1000, 10000));
}

async function getShipment(id) {
    if (!id) {
        throw new EngineError("Load not found.", 404);
    }

    const shipment = must(
        await db.from("shipments").select("*").eq("id", id).maybeSingle()
    );

    if (!shipment) {
        throw new EngineError("Load not found.", 404);
    }

    return shipment;
}

async function getBid(id) {
    if (!id) {
        throw new EngineError("Offer not found.", 404);
    }

    const bid = must(
        await db.from("bids").select("*").eq("id", id).maybeSingle()
    );

    if (!bid) {
        throw new EngineError("Offer not found.", 404);
    }

    return bid;
}

/*
 * What a shipper may see about a driver. The phone number
 * only after the driver is matched to their load.
 */
function driverProfile(user, withPhone) {
    if (!user) {
        return null;
    }

    return {
        id: user.id,
        full_name: user.full_name,
        vehicle_type: user.vehicle_type,
        vehicle_number: user.vehicle_number,
        plate_number: user.plate_number,
        profile_photo: user.profile_photo,
        rating: user.rating,
        rating_count: user.rating_count || 0,
        total_completed_shipments: user.total_completed_shipments || 0,
        ...(withPhone ? { phone_number: user.phone_number } : {}),
    };
}

/* =========================================================
   NOTIFICATIONS
========================================================= */

export async function listNotifications(user) {
    return must(
        await db
            .from("notifications")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50)
    );
}

export async function markNotificationsRead(user, { id } = {}) {
    let query = db.from("notifications").update({ read: true }).eq("user_id", user.id);

    query = id ? query.eq("id", id) : query.eq("read", false);

    must(await query);

    return {};
}

/* =========================================================
   PRICE HINTS
========================================================= */

/*
 * Typical agreed price per route from real past deals.
 * Shown only with at least 3 deals, so it is never a guess.
 */
async function routePriceHints(shipments) {
    const origins = [
        ...new Set(
            shipments
                .map((item) => resolveCity(item.origin_city, item.origin))
                .filter(Boolean)
        ),
    ];

    if (origins.length === 0) {
        return new Map();
    }

    const deals = must(
        await db
            .from("shipments")
            .select("origin_city, destination_city, agreed_price")
            .in("origin_city", origins)
            .gt("agreed_price", 0)
            .limit(2000)
    );

    const byRoute = new Map();

    for (const deal of deals || []) {
        const key = `${deal.origin_city}→${deal.destination_city}`;

        if (!byRoute.has(key)) {
            byRoute.set(key, []);
        }

        byRoute.get(key).push(Number(deal.agreed_price));
    }

    const hints = new Map();

    for (const [key, prices] of byRoute) {
        if (prices.length < 3) {
            continue;
        }

        prices.sort((a, b) => a - b);

        const at = (share) => prices[Math.min(prices.length - 1, Math.floor(prices.length * share))];

        hints.set(key, {
            count: prices.length,
            median: at(0.5),
            low: at(0.25),
            high: at(0.75),
        });
    }

    return hints;
}

function hintFor(hints, shipment) {
    const from = resolveCity(shipment.origin_city, shipment.origin);
    const to = resolveCity(shipment.destination_city, shipment.destination);

    return hints.get(`${from}→${to}`) || null;
}

export async function priceHintForRoute(originCity, destinationCity) {
    if (!isKnownCity(originCity) || !isKnownCity(destinationCity)) {
        return { hint: null, route_km: null };
    }

    const from = findCity(originCity).name;
    const to = findCity(destinationCity).name;

    const hints = await routePriceHints([{ origin_city: from, destination_city: to }]);

    return {
        hint: hints.get(`${from}→${to}`) || null,
        route_km: cityRoadKm(from, to),
    };
}

/* =========================================================
   MATCHING
========================================================= */

/*
 * Gives the load to the driver of the accepted bid. Only one
 * accept can win: the update only applies while the load is
 * still OPEN.
 */
async function matchShipment(shipment, bid, price, acceptedBy) {
    const driver = (await usersById([bid.driver_id])).get(bid.driver_id);

    if (!driver) {
        throw new EngineError("This driver no longer has an account.", 409);
    }

    const updated = must(
        await db
            .from("shipments")
            .update({
                driver_id: driver.id,
                driver_name: driver.full_name,
                driver_phone: driver.phone_number,
                agreed_price: price,
                status: "MATCHED",
                matched_at: new Date().toISOString(),
                delivery_code: newDeliveryCode(),
                delivery_code_attempts: 0,
            })
            .eq("id", shipment.id)
            .eq("status", "OPEN")
            .select("id")
    );

    if (!updated || updated.length === 0) {
        throw new EngineError("This load already has a driver.", 409, "ALREADY_MATCHED");
    }

    must(
        await db
            .from("bids")
            .update({
                proposed_price: price,
                counter_price: null,
                status: "ACCEPTED",
            })
            .eq("id", bid.id)
    );

    const others = must(
        await db
            .from("bids")
            .select("id, driver_id")
            .eq("shipment_id", shipment.id)
            .neq("id", bid.id)
    ) || [];

    if (others.length) {
        must(
            await db
                .from("bids")
                .update({ status: "REJECTED" })
                .eq("shipment_id", shipment.id)
                .neq("id", bid.id)
        );
    }

    const route = routeLabel(shipment);

    await notify([
        acceptedBy === "SHIPPER"
            ? {
                user_id: driver.id,
                shipment_id: shipment.id,
                type: "DRIVER_SELECTED",
                title: "Vous êtes choisi · You were selected 🎉",
                message: `${route} · ${formatMoney(price, shipment.currency)}`,
            }
            : {
                user_id: shipment.shipper_id,
                shipment_id: shipment.id,
                type: "MATCHED",
                title: "Chauffeur trouvé · Driver found 🚚",
                message: `${driver.full_name} · ${route} · ${formatMoney(price, shipment.currency)}`,
            },
        ...others.map((other) => ({
            user_id: other.driver_id,
            shipment_id: shipment.id,
            type: "DRIVER_NOT_SELECTED",
            title: "Marchandise attribuée · Load taken",
            message: route,
        })),
    ]);

    if (shipment.order_id) {
        await onShipmentMatched(shipment, driver);
    }

    return { shipmentId: shipment.id };
}

async function completeShipment(shipment) {
    const updated = must(
        await db
            .from("shipments")
            .update({
                status: "COMPLETED",
                completed_at: new Date().toISOString(),
            })
            .eq("id", shipment.id)
            .in("status", LIVE_STATUSES)
            .select("id")
    );

    if (!updated || updated.length === 0) {
        throw new EngineError("This delivery is already finished.", 409);
    }

    const driver = (await usersById([shipment.driver_id])).get(shipment.driver_id);

    if (driver) {
        must(
            await db
                .from("users")
                .update({
                    total_completed_shipments: (driver.total_completed_shipments || 0) + 1,
                    is_available: true,
                    last_seen: new Date().toISOString(),
                })
                .eq("id", driver.id)
        );
    }

    await notify([
        {
            user_id: shipment.shipper_id,
            shipment_id: shipment.id,
            type: "COMPLETED",
            title: "Livré · Delivered ✅",
            message: `${routeLabel(shipment)} · Notez votre chauffeur · Rate your driver`,
        },
        {
            user_id: shipment.driver_id,
            shipment_id: shipment.id,
            type: "COMPLETED",
            title: "Livraison terminée · Delivery completed ✅",
            message: routeLabel(shipment),
        },
    ]);

    if (shipment.order_id) {
        await onShipmentCompleted(shipment);
    }

    return {};
}

/* =========================================================
   DRIVER
========================================================= */

export async function driverDashboard(driver) {
    const isUpgraded = await upgraded();

    const fields = isUpgraded
        ? [...OPEN_LOAD_FIELDS, ...PRODUCE_LOAD_FIELDS, "country", "currency"]
        : OPEN_LOAD_FIELDS;

    const openLoads = must(
        await db
            .from("shipments")
            .select(fields.join(", "))
            .eq("status", "OPEN")
            .order("created_at", { ascending: false })
            .limit(200)
    ) || [];

    // Drivers see loads leaving their own country, plus return trips.
    const driverCountry = isUpgraded ? driver.country || DEFAULT_COUNTRY : null;

    const myJobs = must(
        await db
            .from("shipments")
            .select("*")
            .eq("driver_id", driver.id)
            .order("created_at", { ascending: false })
            .limit(100)
    ) || [];

    const bids = must(
        await db
            .from("bids")
            .select("id, shipment_id, driver_id, proposed_price, counter_price, last_offer_by, status, created_at, eta, note")
            .eq("driver_id", driver.id)
            .order("created_at", { ascending: false })
    ) || [];

    const shippers = await usersById(myJobs.map((job) => job.shipper_id));

    /*
     * Where the driver will be: the city they're delivering to,
     * otherwise the city they said they're in.
     */
    const liveJob =
        myJobs.find((job) => job.status === "DEPARTED" || job.status === "ARRIVED") ||
        myJobs.find((job) => job.status === "MATCHED");

    const returnCity = liveJob
        ? resolveCity(liveJob.destination_city, liveJob.destination)
        : null;

    const homeCity = resolveCity(driver.base_city);

    const referenceCity = returnCity || homeCity;

    const hints = await routePriceHints(openLoads);

    const ranked = openLoads.map((load) => {
        const from = resolveCity(load.origin_city, load.origin);
        const to = resolveCity(load.destination_city, load.destination);

        let match = null;

        if (returnCity && from === returnCity) {
            match = { type: "RETURN", city: returnCity };
        } else if (homeCity && from === homeCity) {
            match = { type: "NEAR", city: homeCity };
        }

        const { order_id, ...visible } = load;

        return {
            ...visible,
            is_produce: Boolean(order_id),
            origin_city: from,
            destination_city: to,
            match,
            from_km: referenceCity && from ? cityRoadKm(referenceCity, from) : null,
            route_km: from && to ? cityRoadKm(from, to) : null,
            price_hint: hintFor(hints, { origin_city: from, destination_city: to }),
        };
    });

    const rank = (load) => (load.match?.type === "RETURN" ? 0 : load.match?.type === "NEAR" ? 1 : 2);

    const visibleLoads = ranked.filter(
        (load) => !driverCountry || load.match || (load.country || DEFAULT_COUNTRY) === driverCountry
    );

    visibleLoads.sort(
        (a, b) =>
            rank(a) - rank(b) ||
            (a.from_km ?? Infinity) - (b.from_km ?? Infinity) ||
            new Date(b.created_at) - new Date(a.created_at)
    );

    const jobs = myJobs.map((job) => {
        const shipper = shippers.get(job.shipper_id);

        const { delivery_code, delivery_code_attempts, ...visible } = job;

        return {
            ...visible,
            origin_city: resolveCity(job.origin_city, job.origin),
            destination_city: resolveCity(job.destination_city, job.destination),
            route_km: cityRoadKm(
                resolveCity(job.origin_city, job.origin),
                resolveCity(job.destination_city, job.destination)
            ),
            is_produce: Boolean(job.order_id),
            needs_code: Boolean(delivery_code),
            code_locked: (delivery_code_attempts || 0) >= MAX_CODE_ATTEMPTS,
            shipper: shipper
                ? {
                    id: shipper.id,
                    full_name: shipper.full_name,
                    phone_number: shipper.phone_number,
                }
                : null,
        };
    });

    const jobIds = new Set(jobs.map((job) => job.id));

    const lastSeen = driver.last_seen ? new Date(driver.last_seen).getTime() : 0;

    if (Date.now() - lastSeen > 5 * 60000) {
        await db.from("users").update({ last_seen: new Date().toISOString() }).eq("id", driver.id);
    }

    return {
        user: publicUser(driver),
        shipments: [...jobs, ...visibleLoads.slice(0, 100).filter((load) => !jobIds.has(load.id))],
        bids,
        context: {
            return_city: returnCity,
            home_city: homeCity,
        },
    };
}

export async function driverOffer(driver, { shipmentId, price, eta, note }) {
    const amount = parsePrice(price);

    const shipment = await getShipment(shipmentId);

    if (shipment.status !== "OPEN") {
        throw new EngineError("This load is no longer available.", 409);
    }

    if (shipment.shipper_id === driver.id) {
        throw new EngineError("You can't send a price for your own load.");
    }

    const fields = {
        proposed_price: amount,
        counter_price: null,
        last_offer_by: "DRIVER",
        status: "PENDING",
        eta: cleanText(eta, 60) || null,
        note: cleanText(note, 300) || null,
    };

    const existing = must(
        await db
            .from("bids")
            .select("id, status")
            .eq("shipment_id", shipment.id)
            .eq("driver_id", driver.id)
            .limit(1)
    );

    if (existing && existing[0]) {
        must(await db.from("bids").update(fields).eq("id", existing[0].id));
    } else {
        must(
            await db.from("bids").insert([
                {
                    ...fields,
                    shipment_id: shipment.id,
                    driver_id: driver.id,
                },
            ])
        );
    }

    await notify([
        {
            user_id: shipment.shipper_id,
            shipment_id: shipment.id,
            type: "BID_RECEIVED",
            title: "Nouveau prix · New driver price 🚚",
            message: `${routeLabel(shipment)} · ${formatMoney(amount, shipment.currency)}`,
        },
    ]);

    return {};
}

async function driverBidOnOpenLoad(driver, bidId) {
    const bid = await getBid(bidId);

    if (bid.driver_id !== driver.id) {
        throw new EngineError("Offer not found.", 404);
    }

    const shipment = await getShipment(bid.shipment_id);

    if (shipment.status !== "OPEN") {
        throw new EngineError("This load is no longer available.", 409);
    }

    return { bid, shipment };
}

export async function driverCounter(driver, { bidId, price }) {
    const amount = parsePrice(price);

    const { bid, shipment } = await driverBidOnOpenLoad(driver, bidId);

    must(
        await db
            .from("bids")
            .update({
                counter_price: amount,
                last_offer_by: "DRIVER",
                status: "COUNTERED",
            })
            .eq("id", bid.id)
    );

    await notify([
        {
            user_id: shipment.shipper_id,
            shipment_id: shipment.id,
            type: "COUNTER_OFFER",
            title: "Nouveau prix proposé · New price offer 💰",
            message: `${routeLabel(shipment)} · ${formatMoney(amount, shipment.currency)}`,
        },
    ]);

    return {};
}

export async function driverAcceptCounter(driver, { bidId }) {
    const { bid, shipment } = await driverBidOnOpenLoad(driver, bidId);

    if (bid.last_offer_by !== "SHIPPER" || !bid.counter_price) {
        throw new EngineError("There is no price from the shipper to accept.");
    }

    return matchShipment(shipment, bid, Number(bid.counter_price), "DRIVER");
}

export async function driverUpdateProfile(driver, { available, baseCity }) {
    const updates = {
        last_seen: new Date().toISOString(),
    };

    if (typeof available === "boolean") {
        updates.is_available = available;
    }

    if (baseCity !== undefined) {
        const city = baseCity ? findCity(baseCity, driver.country || DEFAULT_COUNTRY) : null;

        if (baseCity && !city) {
            throw new EngineError("Choose a city from the list.");
        }

        updates.base_city = city ? city.name : null;
    }

    const user = must(
        await db.from("users").update(updates).eq("id", driver.id).select("*").maybeSingle()
    );

    return { user: publicUser(user) };
}

const DRIVER_STEPS = {
    DEPARTED: ["MATCHED"],
    ARRIVED: ["DEPARTED"],
    COMPLETED: ["DEPARTED", "ARRIVED"],
};

export async function driverUpdateStatus(driver, { shipmentId, status, deliveryCode }) {
    const shipment = await getShipment(shipmentId);

    if (shipment.driver_id !== driver.id) {
        throw new EngineError("Load not found.", 404);
    }

    if (!DRIVER_STEPS[status] || !DRIVER_STEPS[status].includes(shipment.status)) {
        throw new EngineError("This step isn't possible right now.", 409);
    }

    if (status === "COMPLETED") {
        if (shipment.delivery_code) {
            const attempts = shipment.delivery_code_attempts || 0;

            if (attempts >= MAX_CODE_ATTEMPTS) {
                throw new EngineError(
                    "Too many wrong codes. Ask the shipper to confirm the delivery in Tayeb.",
                    429,
                    "CODE_LOCKED"
                );
            }

            if (String(deliveryCode || "").trim() !== shipment.delivery_code) {
                must(
                    await db
                        .from("shipments")
                        .update({ delivery_code_attempts: attempts + 1 })
                        .eq("id", shipment.id)
                );

                throw new EngineError(
                    `Wrong code. Ask the receiver for the 4-digit Tayeb code. ${MAX_CODE_ATTEMPTS - attempts - 1} tries left.`,
                    400,
                    "CODE_WRONG"
                );
            }
        }

        return completeShipment(shipment);
    }

    const now = new Date().toISOString();

    must(
        await db
            .from("shipments")
            .update({
                status,
                ...(status === "DEPARTED" ? { departed_at: now } : { arrived_at: now }),
            })
            .eq("id", shipment.id)
            .eq("status", shipment.status)
    );

    await notify([
        {
            user_id: shipment.shipper_id,
            shipment_id: shipment.id,
            type: status,
            title:
                status === "DEPARTED"
                    ? "En route · On the way 🚛"
                    : "Arrivé · Driver arrived 📍",
            message: routeLabel(shipment),
        },
    ]);

    if (status === "DEPARTED" && shipment.order_id) {
        await onShipmentDeparted(shipment);
    }

    return {};
}

export async function driverLocation(driver, { shipmentId, lat, lng, accuracy }) {
    const latitude = Number(lat);
    const longitude = Number(lng);

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 ||
        Math.abs(longitude) > 180
    ) {
        throw new EngineError("Invalid location.");
    }

    const shipment = await getShipment(shipmentId);

    if (shipment.driver_id !== driver.id) {
        throw new EngineError("Load not found.", 404);
    }

    // Location is only shared while the goods are on the road.
    if (shipment.status !== "DEPARTED") {
        return { tracking: false };
    }

    must(
        await db
            .from("shipments")
            .update({
                last_lat: latitude,
                last_lng: longitude,
                last_location_at: new Date().toISOString(),
                last_location_accuracy: Number.isFinite(Number(accuracy)) ? Math.round(Number(accuracy)) : null,
            })
            .eq("id", shipment.id)
    );

    return { tracking: true };
}

/* =========================================================
   SHIPPER
========================================================= */

export async function shipperDashboard(shipper) {
    const shipments = must(
        await db
            .from("shipments")
            .select("*")
            .eq("shipper_id", shipper.id)
            .order("created_at", { ascending: false })
            .limit(100)
    ) || [];

    const ids = shipments.map((item) => item.id);

    const bids = ids.length
        ? must(
            await db
                .from("bids")
                .select("*")
                .in("shipment_id", ids)
                .order("created_at", { ascending: true })
        ) || []
        : [];

    const drivers = await usersById([
        ...bids.map((bid) => bid.driver_id),
        ...shipments.map((item) => item.driver_id),
    ]);

    const hints = await routePriceHints(shipments.filter((item) => item.status === "OPEN"));

    return {
        user: publicUser(shipper),
        shipments: shipments.map((item) => {
            const { delivery_code_attempts, ...visible } = item;

            const from = resolveCity(item.origin_city, item.origin);
            const to = resolveCity(item.destination_city, item.destination);

            const hasLocation =
                item.last_lat !== null &&
                item.last_lat !== undefined &&
                item.last_lng !== null &&
                item.last_lng !== undefined;

            return {
                ...visible,
                is_produce: Boolean(item.order_id),
                origin_city: from,
                destination_city: to,
                route_km: from && to ? cityRoadKm(from, to) : null,
                price_hint: item.status === "OPEN" ? hintFor(hints, { origin_city: from, destination_city: to }) : null,
                driver: item.driver_id ? driverProfile(drivers.get(item.driver_id), true) : null,
                tracking:
                    hasLocation && LIVE_STATUSES.includes(item.status)
                        ? {
                            lat: item.last_lat,
                            lng: item.last_lng,
                            at: item.last_location_at,
                            minutes_ago: item.last_location_at
                                ? Math.max(0, Math.round((Date.now() - new Date(item.last_location_at).getTime()) / 60000))
                                : null,
                            km_left: to
                                ? roadKm({ lat: item.last_lat, lng: item.last_lng }, findCity(to))
                                : null,
                        }
                        : null,
            };
        }),
        bids: bids.map((bid) => ({
            ...bid,
            driver: driverProfile(drivers.get(bid.driver_id), false),
        })),
    };
}

/*
 * Pickup in the shipper's country by default; the delivery
 * can be in another country (cross-border trade). The load is
 * priced in the pickup country's currency.
 */
export async function shipperPostLoad(shipper, cargo) {
    const isUpgraded = await upgraded();

    const homeCountry = countryOrDefault(isUpgraded ? shipper.country : DEFAULT_COUNTRY);

    const originCountry = isUpgraded ? countryOrDefault(cargo.originCountry || homeCountry.code) : homeCountry;

    const destinationCountry = isUpgraded ? countryOrDefault(cargo.destinationCountry || originCountry.code) : homeCountry;

    const itemType = cleanText(cargo.itemType, 60);
    const originCity = findCity(cargo.originCity, originCountry.code);
    const destinationCity = findCity(cargo.destinationCity, destinationCountry.code);
    const originArea = cleanText(cargo.originArea, 80);
    const destinationArea = cleanText(cargo.destinationArea, 80);
    const quantity = Number(cargo.quantity);
    const price = parsePrice(cargo.price);
    const receiverPhone = cargo.receiverPhone ? normalizePhone(cargo.receiverPhone, destinationCountry.code) : "";

    if (!itemType) {
        throw new EngineError("Say what you are sending.");
    }

    if (!originCity || !destinationCity) {
        throw new EngineError("Choose the pickup and delivery cities from the list.");
    }

    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) {
        throw new EngineError("Enter a valid quantity.");
    }

    if (cargo.receiverPhone && !isValidPhone(receiverPhone)) {
        throw new EngineError("The receiver's phone number doesn't look right.");
    }

    const shipment = must(
        await db
            .from("shipments")
            .insert([
                {
                    shipper_id: shipper.id,
                    shipper_name: shipper.full_name,
                    shipper_phone: shipper.phone_number,
                    item_type: itemType,
                    origin: originArea ? `${originArea}, ${originCity.name}` : originCity.name,
                    destination: destinationArea ? `${destinationArea}, ${destinationCity.name}` : destinationCity.name,
                    origin_city: originCity.name,
                    destination_city: destinationCity.name,
                    quantity,
                    initial_offer: price,
                    receiver_phone: receiverPhone || null,
                    status: "OPEN",
                    ...(isUpgraded
                        ? { country: originCountry.code, currency: originCountry.currency }
                        : {}),
                },
            ])
            .select("*")
            .single()
    );

    const notified = await notifyDriversOfLoad(shipment);

    return {
        shipmentId: shipment.id,
        notified,
    };
}

async function shipperBidOnOpenLoad(shipper, bidId) {
    const bid = await getBid(bidId);

    const shipment = await getShipment(bid.shipment_id);

    if (shipment.shipper_id !== shipper.id) {
        throw new EngineError("Offer not found.", 404);
    }

    if (shipment.status !== "OPEN") {
        throw new EngineError("This load already has a driver.", 409);
    }

    if (bid.status === "REJECTED" || bid.status === "ACCEPTED") {
        throw new EngineError("This offer is closed.", 409);
    }

    return { bid, shipment };
}

export async function shipperCounter(shipper, { bidId, price }) {
    const amount = parsePrice(price);

    const { bid, shipment } = await shipperBidOnOpenLoad(shipper, bidId);

    must(
        await db
            .from("bids")
            .update({
                counter_price: amount,
                last_offer_by: "SHIPPER",
                status: "COUNTERED",
            })
            .eq("id", bid.id)
    );

    await notify([
        {
            user_id: bid.driver_id,
            shipment_id: shipment.id,
            type: "COUNTER_OFFER",
            title: "Nouveau prix proposé · New price offer 💰",
            message: `${routeLabel(shipment)} · ${formatMoney(amount, shipment.currency)}`,
        },
    ]);

    return {};
}

export async function shipperAccept(shipper, { bidId }) {
    const { bid, shipment } = await shipperBidOnOpenLoad(shipper, bidId);

    if (bid.last_offer_by === "SHIPPER") {
        throw new EngineError("Wait for the driver to answer your price.", 409);
    }

    const price = Number(bid.counter_price ?? bid.proposed_price);

    if (!price || price <= 0) {
        throw new EngineError("Enter a valid price.");
    }

    return matchShipment(shipment, bid, price, "SHIPPER");
}

export async function shipperUpdateStatus(shipper, { shipmentId, status }) {
    const shipment = await getShipment(shipmentId);

    if (shipment.shipper_id !== shipper.id) {
        throw new EngineError("Load not found.", 404);
    }

    // The receiver has the goods: no code needed.
    if (status === "COMPLETED" && LIVE_STATUSES.includes(shipment.status)) {
        return completeShipment(shipment);
    }

    // Goods handed over to the driver.
    if (status === "DEPARTED" && shipment.status === "MATCHED") {
        must(
            await db
                .from("shipments")
                .update({ status: "DEPARTED", departed_at: new Date().toISOString() })
                .eq("id", shipment.id)
                .eq("status", "MATCHED")
        );

        await notify([
            {
                user_id: shipment.driver_id,
                shipment_id: shipment.id,
                type: "DEPARTED",
                title: "En route · On the way 🚛",
                message: routeLabel(shipment),
            },
        ]);

        if (shipment.order_id) {
            await onShipmentDeparted(shipment);
        }

        return {};
    }

    if (status === "CANCELLED" && shipment.status === "OPEN") {
        const cancelled = must(
            await db
                .from("shipments")
                .update({ status: "CANCELLED" })
                .eq("id", shipment.id)
                .eq("status", "OPEN")
                .select("id")
        );

        if (!cancelled || cancelled.length === 0) {
            throw new EngineError("This load already has a driver.", 409);
        }

        const bidders = must(
            await db.from("bids").select("driver_id").eq("shipment_id", shipment.id)
        ) || [];

        must(
            await db.from("bids").update({ status: "REJECTED" }).eq("shipment_id", shipment.id)
        );

        await notify(
            bidders.map((bidder) => ({
                user_id: bidder.driver_id,
                shipment_id: shipment.id,
                type: "CANCELLED",
                title: "Marchandise annulée · Load cancelled",
                message: routeLabel(shipment),
            }))
        );

        if (shipment.order_id) {
            await onShipmentCancelled(shipment);
        }

        return {};
    }

    throw new EngineError("This step isn't possible right now.", 409);
}

export async function shipperRate(shipper, { shipmentId, rating }) {
    const stars = Number(rating);

    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
        throw new EngineError("Choose 1 to 5 stars.");
    }

    const shipment = await getShipment(shipmentId);

    if (shipment.shipper_id !== shipper.id || shipment.status !== "COMPLETED") {
        throw new EngineError("You can rate a driver after the delivery.", 409);
    }

    const rated = must(
        await db
            .from("shipments")
            .update({ driver_rating: stars })
            .eq("id", shipment.id)
            .is("driver_rating", null)
            .select("id")
    );

    if (!rated || rated.length === 0) {
        throw new EngineError("You already rated this delivery.", 409);
    }

    const driver = (await usersById([shipment.driver_id])).get(shipment.driver_id);

    if (driver) {
        const count = driver.rating_count || 0;

        const average = ((Number(driver.rating) || 0) * count + stars) / (count + 1);

        must(
            await db
                .from("users")
                .update({
                    rating: Math.round(average * 10) / 10,
                    rating_count: count + 1,
                })
                .eq("id", driver.id)
        );
    }

    return {};
}

/* =========================================================
   ADMIN
========================================================= */

export async function adminDashboard() {
    const [users, shipments, bids, notifications] = await Promise.all([
        db.from("users").select("*").order("created_at", { ascending: false }).limit(1000),
        db.from("shipments").select("*").order("created_at", { ascending: false }).limit(1000),
        db.from("bids").select("*").order("created_at", { ascending: false }).limit(2000),
        db.from("notifications").select("*").order("created_at", { ascending: false }).limit(500),
    ]);

    const market = await adminMarketData();

    return {
        users: (must(users) || []).map(publicUser),
        shipments: (must(shipments) || []).map(({ delivery_code, delivery_code_attempts, ...item }) => item),
        bids: must(bids) || [],
        notifications: must(notifications) || [],
        products: market.products,
        orders: market.orders,
    };
}
