import supabaseAdmin from "../supabaseAdmin";
import { resolveCity } from "../cities";

/*
 * ============================================================
 * SHARED SERVER PIECES
 * ============================================================
 *
 * Used by the delivery engine (engine.js) and the farm
 * market (market.js): errors, notifications, and telling
 * drivers about a new load.
 */

export const db = supabaseAdmin;

export const LIVE_STATUSES = ["MATCHED", "DEPARTED", "ARRIVED"];

export const MAX_PRICE = 100000000;

/*
 * With few drivers, everyone hears about every load. Above
 * this number, only drivers it fits are notified.
 */
const MIN_RECIPIENTS = 5;

export class EngineError extends Error {
    constructor(message, status = 400, code) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

export function sendError(res, error) {
    if (error instanceof EngineError) {
        return res.status(error.status).json({
            error: error.message,
            code: error.code,
        });
    }

    console.error("Tayeb engine error:", error);

    return res.status(500).json({
        error: "Something went wrong. Please try again.",
    });
}

/* =========================================================
   SMALL HELPERS
========================================================= */

export function must(result) {
    if (result.error) {
        throw result.error;
    }

    return result.data;
}

export function formatPrice(value) {
    return Number(value || 0).toLocaleString("en-US");
}

export function cleanText(value, maxLength) {
    return String(value ?? "").trim().slice(0, maxLength);
}

export function parsePrice(value) {
    const price = Number(String(value ?? "").replace(/[^\d]/g, ""));

    if (!Number.isInteger(price) || price <= 0 || price > MAX_PRICE) {
        throw new EngineError("Enter a valid price.");
    }

    return price;
}

export function routeLabel(shipment) {
    const from = resolveCity(shipment.origin_city, shipment.origin) || shipment.origin;
    const to = resolveCity(shipment.destination_city, shipment.destination) || shipment.destination;

    return `${from} → ${to}`;
}

export async function usersById(ids) {
    const unique = [...new Set(ids.filter(Boolean))];

    if (unique.length === 0) {
        return new Map();
    }

    const users = must(
        await db.from("users").select("*").in("id", unique)
    );

    return new Map((users || []).map((user) => [user.id, user]));
}

/*
 * A missing table or column means the database setup for a
 * feature hasn't been run yet (PostgREST and Postgres codes).
 */
export function isMissingSchema(error) {
    return ["PGRST205", "PGRST204", "42P01", "42703"].includes(error?.code);
}

/* =========================================================
   NOTIFICATIONS
========================================================= */

/*
 * Titles are bilingual; messages are mostly route and price,
 * which read the same in French and English. A failed
 * notification never undoes a deal.
 */
export async function notify(rows) {
    const clean = rows.filter((row) => row && row.user_id);

    if (clean.length === 0) {
        return;
    }

    const { error } = await db.from("notifications").insert(
        clean.map((row) => ({
            user_id: row.user_id,
            shipment_id: row.shipment_id || null,
            title: row.title,
            message: row.message,
            type: row.type,
            read: false,
        }))
    );

    if (error) {
        console.error("Notification error:", error);
    }
}

/* =========================================================
   NEW LOAD → DRIVERS
========================================================= */

/*
 * Tells drivers about a new load. Drivers in the pickup city,
 * drivers delivering to the pickup city (a return trip for
 * them) and drivers with no city saved are notified. When
 * that is fewer than MIN_RECIPIENTS, every available driver
 * is notified.
 */
export async function notifyDriversOfLoad(shipment) {
    const drivers = must(
        await db
            .from("users")
            .select("id, base_city")
            .eq("role", "DRIVER")
            .or("is_available.is.null,is_available.eq.true")
    ) || [];

    if (drivers.length === 0) {
        return 0;
    }

    const returning = new Set();

    if (shipment.origin_city) {
        const heading = must(
            await db
                .from("shipments")
                .select("driver_id")
                .in("status", LIVE_STATUSES)
                .eq("destination_city", shipment.origin_city)
        ) || [];

        heading.forEach((item) => returning.add(item.driver_id));
    }

    const fits = drivers.filter(
        (driver) =>
            returning.has(driver.id) ||
            !driver.base_city ||
            driver.base_city === shipment.origin_city
    );

    const recipients = fits.length >= MIN_RECIPIENTS ? fits : drivers;

    const details = [
        routeLabel(shipment),
        shipment.item_type,
        shipment.weight_kg ? `~${formatPrice(shipment.weight_kg)} kg` : null,
        `${formatPrice(shipment.initial_offer)} FCFA`,
    ]
        .filter(Boolean)
        .join(" · ");

    await notify(
        recipients
            .filter((driver) => driver.id !== shipment.shipper_id)
            .map((driver) => ({
                user_id: driver.id,
                shipment_id: shipment.id,
                type: "NEW_SHIPMENT",
                title: returning.has(driver.id)
                    ? "Chargement retour · Return load 🔁"
                    : shipment.order_id
                        ? "Produits de la ferme · Farm produce 🌾"
                        : "Nouvelle marchandise · New load 📦",
                message: details,
            }))
    );

    return recipients.length;
}

/* =========================================================
   CANCEL AN OPEN LOAD
========================================================= */

/*
 * Cancels a load that has no driver yet, closes its offers
 * and tells the drivers who sent a price. Returns false when
 * a driver was already chosen.
 */
export async function cancelOpenLoad(shipment) {
    const cancelled = must(
        await db
            .from("shipments")
            .update({ status: "CANCELLED" })
            .eq("id", shipment.id)
            .eq("status", "OPEN")
            .select("id")
    );

    if (!cancelled || cancelled.length === 0) {
        return false;
    }

    const bidders = must(
        await db.from("bids").select("driver_id").eq("shipment_id", shipment.id)
    ) || [];

    if (bidders.length) {
        must(
            await db.from("bids").update({ status: "REJECTED" }).eq("shipment_id", shipment.id)
        );
    }

    await notify(
        bidders.map((bidder) => ({
            user_id: bidder.driver_id,
            shipment_id: shipment.id,
            type: "CANCELLED",
            title: "Marchandise annulée · Load cancelled",
            message: routeLabel(shipment),
        }))
    );

    return true;
}
