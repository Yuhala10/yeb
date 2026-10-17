import { findCity } from "../cities";
import {
    DELIVERY_METHODS,
    PAYMENT_TERMS,
    cameroonToday,
    estimateWeightKg,
    findProduct,
    findUnit,
    formatAmount,
    orderReference,
} from "../produce";
import {
    cancelOpenLoad,
    cleanText,
    db,
    EngineError,
    formatPrice,
    isMissingSchema,
    must,
    notify,
    notifyDriversOfLoad,
    parsePrice,
    usersById,
} from "./core";
import { isValidPhone, normalizePhone, publicUser } from "./session";

/*
 * ============================================================
 * TAYEB MARCHÉ — FARM MARKET ENGINE
 * ============================================================
 *
 * Farmers list produce, buyers order it, and a confirmed
 * order with Tayeb delivery becomes a normal Tayeb load
 * (shipments row with order_id). Payment between buyer and
 * farmer happens outside the app; Tayeb records the terms
 * and the farmer confirms when the money arrives.
 *
 * Listing status: ACTIVE, PAUSED, SOLD_OUT, ARCHIVED
 * Order status:   PENDING → CONFIRMED → COMPLETED
 *                 PENDING → DECLINED | CANCELLED | EXPIRED
 *                 CONFIRMED → CANCELLED (only before a driver is chosen)
 *
 * Stock is taken when the farmer confirms, with a
 * compare-and-swap update so two confirmations can't sell
 * the same crate twice.
 */

const ORDER_EXPIRY_HOURS = 48;

const MAX_QUANTITY = 1000000;

const PHOTO_BUCKET = "produce";

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

const DECLINE_REASONS = ["SOLD_OUT", "PRICE", "QUANTITY", "DATE", "OTHER"];

const LISTING_STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"];

/* =========================================================
   IS THE MARKET SET UP?
========================================================= */

/*
 * The market needs its own tables (supabase/marche.sql).
 * Until they exist, every market screen says "opening soon"
 * and the rest of Tayeb keeps working.
 */
let readyState = { ready: false, checkedAt: 0 };

export async function marketReady() {
    if (readyState.ready) {
        return true;
    }

    if (Date.now() - readyState.checkedAt < 30000) {
        return false;
    }

    const { error } = await db.from("products").select("id").limit(1);

    if (error && !isMissingSchema(error)) {
        console.error("Market check failed:", error);
    }

    readyState = { ready: !error, checkedAt: Date.now() };

    return readyState.ready;
}

export async function requireMarket() {
    if (!(await marketReady())) {
        throw new EngineError("Tayeb Marché opens soon.", 503, "MARKET_NOT_READY");
    }
}

/* =========================================================
   HELPERS
========================================================= */

function bilingualProduct(item) {
    if (item.product === "OTHER" && item.custom_name) {
        return item.custom_name;
    }

    const product = findProduct(item.product);

    if (!product) {
        return item.custom_name || item.product;
    }

    return product.fr === product.en ? product.en : `${product.fr} · ${product.en}`;
}

function bilingualUnit(unitKey, quantity) {
    const unit = findUnit(unitKey);

    if (!unit) {
        return unitKey;
    }

    const plural = Number(quantity) !== 1;
    const fr = plural ? unit.frPlural : unit.fr;
    const en = plural ? unit.enPlural : unit.en;

    return fr === en ? en : `${fr}/${en}`;
}

function orderLine(order) {
    return `${findProduct(order.product)?.emoji || "🧺"} ${bilingualProduct(order)} · ${formatAmount(order.quantity)} ${bilingualUnit(order.unit, order.quantity)} · ${formatPrice(order.total_price)} FCFA`;
}

function parseQuantity(value, { allowZero = false } = {}) {
    const quantity = Math.round(Number(String(value ?? "").replace(",", ".")) * 100) / 100;

    if (!Number.isFinite(quantity) || quantity < 0 || (!allowZero && quantity === 0) || quantity > MAX_QUANTITY) {
        throw new EngineError("Enter a valid quantity.");
    }

    return quantity;
}

function parseDate(value, label) {
    if (!value) {
        return null;
    }

    const text = String(value).slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(new Date(`${text}T00:00:00Z`).getTime())) {
        throw new EngineError(`${label} isn't a valid date.`);
    }

    return text;
}

function isListingVisible(listing, today = cameroonToday()) {
    return (
        listing.status === "ACTIVE" &&
        Number(listing.quantity_available) > 0 &&
        (!listing.available_until || listing.available_until >= today)
    );
}

function publicFarmer(user) {
    if (!user) {
        return null;
    }

    return {
        id: user.id,
        full_name: user.full_name,
        base_city: user.base_city,
        rating: user.rating,
        rating_count: user.rating_count || 0,
        completed_sales: user.total_completed_shipments || 0,
        member_since: user.created_at,
    };
}

function publicListing(listing, farmer, stats, today = cameroonToday()) {
    const { photo_path, farmer_id, ...visible } = listing;

    return {
        ...visible,
        farmer_id,
        ready_now: !listing.available_from || listing.available_from <= today,
        visible: isListingVisible(listing, today),
        farmer: publicFarmer(farmer),
        price_stats: stats || null,
    };
}

async function getListingRow(id) {
    if (!id) {
        throw new EngineError("Product not found.", 404);
    }

    const listing = must(await db.from("products").select("*").eq("id", id).maybeSingle());

    if (!listing) {
        throw new EngineError("Product not found.", 404);
    }

    return listing;
}

async function getOrderRow(id) {
    if (!id) {
        throw new EngineError("Order not found.", 404);
    }

    const order = must(await db.from("orders").select("*").eq("id", id).maybeSingle());

    if (!order) {
        throw new EngineError("Order not found.", 404);
    }

    return order;
}

/*
 * Moves an order from one status to the next only if it is
 * still in the expected status. Returns the updated row or
 * null when someone else changed it first.
 */
async function moveOrder(order, fromStatuses, updates) {
    const rows = must(
        await db
            .from("orders")
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq("id", order.id)
            .in("status", fromStatuses)
            .select("*")
    );

    return rows && rows[0] ? rows[0] : null;
}

/*
 * Adds (positive) or takes (negative) stock. Compare-and-swap
 * on the current quantity, retried if another order moved it.
 */
async function changeStock(productId, delta) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const listing = must(
            await db
                .from("products")
                .select("id, quantity_available, status")
                .eq("id", productId)
                .maybeSingle()
        );

        if (!listing) {
            return { ok: delta > 0, listing: null };
        }

        const current = Number(listing.quantity_available);

        const next = Math.round((current + delta) * 100) / 100;

        if (next < 0) {
            return { ok: false, listing };
        }

        let status = listing.status;

        if (next === 0 && status === "ACTIVE") {
            status = "SOLD_OUT";
        } else if (next > 0 && status === "SOLD_OUT") {
            status = "ACTIVE";
        }

        const updated = must(
            await db
                .from("products")
                .update({
                    quantity_available: next,
                    status,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", productId)
                .eq("quantity_available", listing.quantity_available)
                .select("id")
        );

        if (updated && updated.length) {
            return { ok: true, listing: { ...listing, quantity_available: next, status } };
        }
    }

    throw new EngineError("Many people are ordering right now. Please try again.", 409);
}

/*
 * Pending orders expire after 48 hours: produce doesn't
 * wait. Runs at most once a minute per server.
 */
let lastExpiryRun = 0;

async function expireOldOrders() {
    if (Date.now() - lastExpiryRun < 60000) {
        return;
    }

    lastExpiryRun = Date.now();

    const cutoff = new Date(Date.now() - ORDER_EXPIRY_HOURS * 3600000).toISOString();

    const expired = must(
        await db
            .from("orders")
            .update({ status: "EXPIRED", updated_at: new Date().toISOString() })
            .eq("status", "PENDING")
            .lt("created_at", cutoff)
            .select("*")
    ) || [];

    await notify(
        expired.flatMap((order) => [
            {
                user_id: order.buyer_id,
                type: "ORDER_EXPIRED",
                title: "Commande expirée · Order expired",
                message: `${orderReference(order.id)} · ${orderLine(order)}`,
            },
            {
                user_id: order.farmer_id,
                type: "ORDER_EXPIRED",
                title: "Commande expirée · Order expired",
                message: `${orderReference(order.id)} · ${orderLine(order)}`,
            },
        ])
    );
}

/* =========================================================
   REAL PRICES FROM ORDERS
========================================================= */

/*
 * Price per unit paid in confirmed and completed orders, per
 * product and unit. Shown only with at least 3 orders.
 */
async function priceStats(productKeys) {
    const keys = [...new Set(productKeys.filter(Boolean))];

    if (keys.length === 0) {
        return new Map();
    }

    const rows = must(
        await db
            .from("orders")
            .select("product, unit, price_per_unit")
            .in("product", keys)
            .in("status", ["CONFIRMED", "COMPLETED"])
            .order("created_at", { ascending: false })
            .limit(3000)
    ) || [];

    const groups = new Map();

    for (const row of rows) {
        const key = `${row.product}|${row.unit}`;

        if (!groups.has(key)) {
            groups.set(key, []);
        }

        groups.get(key).push(Number(row.price_per_unit));
    }

    const stats = new Map();

    for (const [key, prices] of groups) {
        if (prices.length < 3) {
            continue;
        }

        prices.sort((a, b) => a - b);

        const at = (share) => prices[Math.min(prices.length - 1, Math.floor(prices.length * share))];

        stats.set(key, {
            count: prices.length,
            low: at(0.25),
            median: at(0.5),
            high: at(0.75),
        });
    }

    return stats;
}

function statsFor(stats, item) {
    return stats.get(`${item.product}|${item.unit}`) || null;
}

/*
 * For a farmer pricing a product: what buyers paid (3+
 * orders) and the range of prices on sale right now (2+
 * other listings), per unit. Real data only.
 */
export async function productPrices(productKey) {
    await requireMarket();

    if (!findProduct(productKey)) {
        throw new EngineError("Unknown product.");
    }

    const paid = await priceStats([productKey]);

    const live = must(
        await db
            .from("products")
            .select("unit, price_per_unit, quantity_available, available_until, status")
            .eq("product", productKey)
            .eq("status", "ACTIVE")
            .gt("quantity_available", 0)
            .limit(500)
    ) || [];

    const today = cameroonToday();

    const byUnit = {};

    for (const row of live.filter((item) => !item.available_until || item.available_until >= today)) {
        const entry = (byUnit[row.unit] = byUnit[row.unit] || { prices: [] });
        entry.prices.push(Number(row.price_per_unit));
    }

    const units = {};

    for (const [unit, { prices }] of Object.entries(byUnit)) {
        if (prices.length >= 2) {
            units[unit] = {
                ...(units[unit] || {}),
                on_sale: { count: prices.length, low: Math.min(...prices), high: Math.max(...prices) },
            };
        }
    }

    for (const [key, stats] of paid) {
        const unit = key.split("|")[1];
        units[unit] = { ...(units[unit] || {}), paid: stats };
    }

    return { product: productKey, units };
}

/* =========================================================
   PUBLIC MARKET
========================================================= */

export async function listMarket({ product, city, q, limit = 60 } = {}) {
    await requireMarket();

    let query = db
        .from("products")
        .select("*")
        .eq("status", "ACTIVE")
        .gt("quantity_available", 0)
        .order("created_at", { ascending: false })
        .limit(300);

    if (product && findProduct(product)) {
        query = query.eq("product", product);
    }

    if (city && findCity(city)) {
        query = query.eq("city", findCity(city).name);
    }

    const today = cameroonToday();

    let listings = (must(await query) || []).filter((item) => isListingVisible(item, today));

    if (q) {
        const needle = String(q).trim().toLowerCase().slice(0, 60);

        listings = listings.filter((item) => {
            const product = findProduct(item.product);

            return [product?.en, product?.fr, item.custom_name, item.details, item.area, item.city]
                .filter(Boolean)
                .some((text) => text.toLowerCase().includes(needle));
        });
    }

    // Ready to collect now first, then the newest.
    listings.sort(
        (a, b) =>
            Number((b.available_from || "") <= today) - Number((a.available_from || "") <= today) ||
            new Date(b.created_at) - new Date(a.created_at)
    );

    const total = listings.length;

    listings = listings.slice(0, Math.min(Number(limit) || 60, 120));

    const farmers = await usersById(listings.map((item) => item.farmer_id));

    const stats = await priceStats(listings.map((item) => item.product));

    return {
        total,
        listings: listings.map((item) =>
            publicListing(item, farmers.get(item.farmer_id), statsFor(stats, item), today)
        ),
    };
}

export async function getListing(id) {
    await requireMarket();

    const listing = await getListingRow(id);

    if (listing.status === "ARCHIVED") {
        throw new EngineError("Product not found.", 404);
    }

    const farmers = await usersById([listing.farmer_id]);

    const stats = await priceStats([listing.product]);

    return publicListing(listing, farmers.get(listing.farmer_id), statsFor(stats, listing));
}

/* =========================================================
   FARMER: PRODUCTS
========================================================= */

export async function farmerSaveProduct(farmer, input) {
    await requireMarket();

    const product = findProduct(input.product);

    if (!product) {
        throw new EngineError("Choose what you are selling.");
    }

    const customName = cleanText(input.customName, 60);

    if (product.key === "OTHER" && customName.length < 2) {
        throw new EngineError("Give your product a name.");
    }

    const unit = findUnit(input.unit);

    if (!unit) {
        throw new EngineError("Choose how you sell it (bag, crate, kg…).");
    }

    let unitWeightKg = null;

    if (unit.kg === null && input.unitWeightKg !== undefined && input.unitWeightKg !== null && input.unitWeightKg !== "") {
        unitWeightKg = Number(String(input.unitWeightKg).replace(",", "."));

        if (!Number.isFinite(unitWeightKg) || unitWeightKg <= 0 || unitWeightKg > 5000) {
            throw new EngineError("The weight per unit doesn't look right.");
        }
    }

    const city = findCity(input.city);

    if (!city) {
        throw new EngineError("Choose where the produce is, from the list of cities.");
    }

    const pricePerUnit = parsePrice(input.pricePerUnit);

    const quantity = parseQuantity(input.quantity, { allowZero: Boolean(input.id) });

    const minOrder = input.minOrder === undefined || input.minOrder === "" || input.minOrder === null
        ? 1
        : parseQuantity(input.minOrder);

    if (minOrder > Math.max(quantity, 1)) {
        throw new EngineError("The minimum order can't be more than what you have.");
    }

    const today = cameroonToday();

    const availableFrom = parseDate(input.availableFrom, "Ready date") || today;

    const availableUntil = parseDate(input.availableUntil, "Last day");

    if (availableUntil && availableUntil < availableFrom) {
        throw new EngineError("The last day must be after the ready date.");
    }

    if (availableUntil && availableUntil < today) {
        throw new EngineError("The last day is already past.");
    }

    const fields = {
        product: product.key,
        custom_name: product.key === "OTHER" ? customName : null,
        details: cleanText(input.details, 300) || null,
        unit: unit.key,
        unit_weight_kg: unitWeightKg,
        price_per_unit: pricePerUnit,
        quantity_available: quantity,
        min_order: minOrder,
        city: city.name,
        area: cleanText(input.area, 80) || null,
        available_from: availableFrom,
        available_until: availableUntil,
        perishable: typeof input.perishable === "boolean" ? input.perishable : product.perishable,
        updated_at: new Date().toISOString(),
    };

    if (input.id) {
        const existing = await getListingRow(input.id);

        if (existing.farmer_id !== farmer.id || existing.status === "ARCHIVED") {
            throw new EngineError("Product not found.", 404);
        }

        let status = existing.status;

        if (quantity === 0 && status === "ACTIVE") {
            status = "SOLD_OUT";
        } else if (quantity > 0 && status === "SOLD_OUT") {
            status = "ACTIVE";
        }

        const rows = must(
            await db
                .from("products")
                .update({ ...fields, status })
                .eq("id", existing.id)
                .eq("farmer_id", farmer.id)
                .select("*")
        );

        return { product: rows[0] };
    }

    const created = must(
        await db
            .from("products")
            .insert([
                {
                    ...fields,
                    farmer_id: farmer.id,
                    status: "ACTIVE",
                },
            ])
            .select("*")
            .single()
    );

    // The farmer's city helps buyers and drivers near them.
    if (!farmer.base_city) {
        await db.from("users").update({ base_city: city.name }).eq("id", farmer.id);
    }

    return { product: created };
}

export async function farmerSetProductStatus(farmer, { productId, status }) {
    await requireMarket();

    if (!LISTING_STATUSES.includes(status)) {
        throw new EngineError("Unknown status.");
    }

    const listing = await getListingRow(productId);

    if (listing.farmer_id !== farmer.id || listing.status === "ARCHIVED") {
        throw new EngineError("Product not found.", 404);
    }

    if (status === "ACTIVE" && !(Number(listing.quantity_available) > 0)) {
        throw new EngineError("Add the quantity you have before putting it back on sale.");
    }

    must(
        await db
            .from("products")
            .update({ status, updated_at: new Date().toISOString() })
            .eq("id", listing.id)
            .eq("farmer_id", farmer.id)
    );

    if (status === "ARCHIVED" && listing.photo_path) {
        await db.storage.from(PHOTO_BUCKET).remove([listing.photo_path]);
    }

    return {};
}

/*
 * image: a data URL (the browser shrinks photos to about
 * 1280 px before sending, so they load fast on mobile data).
 */
export async function farmerUploadPhoto(farmer, { productId, image }) {
    await requireMarket();

    const listing = await getListingRow(productId);

    if (listing.farmer_id !== farmer.id || listing.status === "ARCHIVED") {
        throw new EngineError("Product not found.", 404);
    }

    const match = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(image || ""));

    if (!match) {
        throw new EngineError("Send a JPG, PNG or WebP photo.");
    }

    const buffer = Buffer.from(match[3], "base64");

    if (buffer.length === 0 || buffer.length > MAX_PHOTO_BYTES) {
        throw new EngineError("This photo is too large. Try another one.");
    }

    const extension = match[2] === "jpeg" ? "jpg" : match[2];

    const path = `${farmer.id}/${listing.id}-${Date.now()}.${extension}`;

    const { error: uploadError } = await db.storage
        .from(PHOTO_BUCKET)
        .upload(path, buffer, {
            contentType: match[1],
            cacheControl: "31536000",
            upsert: false,
        });

    if (uploadError) {
        console.error("Photo upload error:", uploadError);
        throw new EngineError("The photo couldn't be saved. Please try again.", 502);
    }

    const { data: urlData } = db.storage.from(PHOTO_BUCKET).getPublicUrl(path);

    must(
        await db
            .from("products")
            .update({
                photo_url: urlData.publicUrl,
                photo_path: path,
                updated_at: new Date().toISOString(),
            })
            .eq("id", listing.id)
            .eq("farmer_id", farmer.id)
    );

    if (listing.photo_path && listing.photo_path !== path) {
        await db.storage.from(PHOTO_BUCKET).remove([listing.photo_path]);
    }

    return { photo_url: urlData.publicUrl };
}

/* =========================================================
   ORDER VIEWS
========================================================= */

async function shipmentsById(ids) {
    const unique = [...new Set(ids.filter(Boolean))];

    if (unique.length === 0) {
        return new Map();
    }

    const rows = must(
        await db
            .from("shipments")
            .select("id, status, driver_id, driver_name, driver_phone, agreed_price, initial_offer, departed_at, arrived_at, completed_at")
            .in("id", unique)
    ) || [];

    return new Map(rows.map((row) => [row.id, row]));
}

/*
 * Delivery progress for an order. The driver's phone only
 * once a driver is chosen.
 */
function deliveryView(shipment) {
    if (!shipment) {
        return null;
    }

    const hasDriver = Boolean(shipment.driver_id);

    return {
        shipment_id: shipment.id,
        status: shipment.status,
        budget: shipment.initial_offer,
        agreed_price: shipment.agreed_price,
        driver_name: hasDriver ? shipment.driver_name : null,
        driver_phone: hasDriver ? shipment.driver_phone : null,
    };
}

const CONTACT_STATUSES = ["CONFIRMED", "COMPLETED"];

function orderView(order, { other, otherRole, shipment }) {
    const showContact = CONTACT_STATUSES.includes(order.status);

    return {
        ...order,
        ref: orderReference(order.id),
        hours_left:
            order.status === "PENDING"
                ? Math.max(0, Math.ceil(ORDER_EXPIRY_HOURS - (Date.now() - new Date(order.created_at).getTime()) / 3600000))
                : null,
        [otherRole]: other
            ? {
                id: other.id,
                full_name: other.full_name,
                base_city: other.base_city,
                rating: other.rating,
                rating_count: other.rating_count || 0,
                ...(showContact ? { phone_number: other.phone_number } : {}),
            }
            : null,
        delivery: deliveryView(shipment),
    };
}

/* =========================================================
   FARMER: DASHBOARD
========================================================= */

export async function farmerDashboard(farmer) {
    if (!(await marketReady())) {
        return {
            ready: false,
            user: publicUser(farmer),
            products: [],
            orders: [],
        };
    }

    await expireOldOrders();

    const products = must(
        await db
            .from("products")
            .select("*")
            .eq("farmer_id", farmer.id)
            .neq("status", "ARCHIVED")
            .order("created_at", { ascending: false })
            .limit(200)
    ) || [];

    const orders = must(
        await db
            .from("orders")
            .select("*")
            .eq("farmer_id", farmer.id)
            .order("created_at", { ascending: false })
            .limit(200)
    ) || [];

    const buyers = await usersById(orders.map((order) => order.buyer_id));

    const shipments = await shipmentsById(orders.map((order) => order.shipment_id));

    const stats = await priceStats(products.map((item) => item.product));

    const today = cameroonToday();

    return {
        ready: true,
        user: publicUser(farmer),
        products: products.map((item) => publicListing(item, farmer, statsFor(stats, item), today)),
        orders: orders.map((order) =>
            orderView(
                {
                    ...order,
                    // The receiver's number only once the farmer said yes.
                    receiver_phone: CONTACT_STATUSES.includes(order.status) ? order.receiver_phone : null,
                },
                {
                    other: buyers.get(order.buyer_id),
                    otherRole: "buyer",
                    shipment: shipments.get(order.shipment_id),
                }
            )
        ),
    };
}

/* =========================================================
   BUYER: ORDERS
========================================================= */

export async function buyerOrders(buyer) {
    if (!(await marketReady())) {
        return { ready: false, orders: [] };
    }

    await expireOldOrders();

    const orders = must(
        await db
            .from("orders")
            .select("*")
            .eq("buyer_id", buyer.id)
            .order("created_at", { ascending: false })
            .limit(200)
    ) || [];

    const farmers = await usersById(orders.map((order) => order.farmer_id));

    const shipments = await shipmentsById(orders.map((order) => order.shipment_id));

    return {
        ready: true,
        orders: orders.map((order) =>
            orderView(order, {
                other: farmers.get(order.farmer_id),
                otherRole: "farmer",
                shipment: shipments.get(order.shipment_id),
            })
        ),
    };
}

export async function buyerPlaceOrder(buyer, input) {
    await requireMarket();

    const listing = await getListingRow(input.productId);

    if (listing.farmer_id === buyer.id) {
        throw new EngineError("You can't order your own produce.");
    }

    if (!isListingVisible(listing)) {
        throw new EngineError("This produce is no longer for sale.", 409, "NOT_AVAILABLE");
    }

    const quantity = parseQuantity(input.quantity);

    const minOrder = Number(listing.min_order) || 0;

    if (minOrder && quantity < minOrder) {
        throw new EngineError(`The farmer sells at least ${formatAmount(minOrder)} per order.`, 400, "BELOW_MINIMUM");
    }

    if (quantity > Number(listing.quantity_available)) {
        throw new EngineError(
            `Only ${formatAmount(listing.quantity_available)} left. Lower the quantity.`,
            409,
            "NOT_ENOUGH_STOCK"
        );
    }

    const deliveryMethod = DELIVERY_METHODS.includes(input.deliveryMethod) ? input.deliveryMethod : "TAYEB";

    let deliveryCity = null;
    let deliveryBudget = null;
    let receiverPhone = null;

    if (deliveryMethod === "TAYEB") {
        deliveryCity = findCity(input.deliveryCity);

        if (!deliveryCity) {
            throw new EngineError("Choose the delivery city from the list.");
        }

        deliveryBudget = parsePrice(input.deliveryBudget);

        receiverPhone = normalizePhone(input.receiverPhone || buyer.phone_number);

        if (!isValidPhone(receiverPhone)) {
            throw new EngineError("The receiver's phone number doesn't look right.");
        }
    }

    const paymentTerms = PAYMENT_TERMS.includes(input.paymentTerms)
        ? input.paymentTerms
        : deliveryMethod === "PICKUP"
            ? "CASH_ON_PICKUP"
            : "MOMO_ON_DELIVERY";

    if (paymentTerms === "CASH_ON_PICKUP" && deliveryMethod !== "PICKUP") {
        throw new EngineError("Cash at pickup is only for orders you collect yourself.");
    }

    const neededBy = parseDate(input.neededBy, "Needed by");

    if (neededBy && neededBy < cameroonToday()) {
        throw new EngineError("The date you need it by is already past.");
    }

    // One waiting order per product per buyer stops double taps.
    const waiting = must(
        await db
            .from("orders")
            .select("id")
            .eq("buyer_id", buyer.id)
            .eq("product_id", listing.id)
            .eq("status", "PENDING")
            .limit(1)
    );

    if (waiting && waiting.length) {
        throw new EngineError("You already have an order waiting for this farmer's answer.", 409, "ALREADY_ORDERED");
    }

    const farmer = (await usersById([listing.farmer_id])).get(listing.farmer_id);

    if (!farmer) {
        throw new EngineError("This farmer no longer has an account.", 409);
    }

    const totalPrice = Math.round(quantity * Number(listing.price_per_unit));

    const order = must(
        await db
            .from("orders")
            .insert([
                {
                    product_id: listing.id,
                    farmer_id: listing.farmer_id,
                    buyer_id: buyer.id,
                    farmer_name: farmer.full_name,
                    buyer_name: buyer.full_name,
                    product: listing.product,
                    custom_name: listing.custom_name,
                    unit: listing.unit,
                    unit_weight_kg: listing.unit_weight_kg,
                    price_per_unit: listing.price_per_unit,
                    quantity,
                    total_price: totalPrice,
                    weight_kg: estimateWeightKg(listing.unit, quantity, listing.unit_weight_kg),
                    perishable: Boolean(listing.perishable),
                    product_city: listing.city,
                    product_area: listing.area,
                    delivery_method: deliveryMethod,
                    delivery_city: deliveryCity ? deliveryCity.name : null,
                    delivery_area: deliveryMethod === "TAYEB" ? cleanText(input.deliveryArea, 80) || null : null,
                    receiver_phone: receiverPhone,
                    delivery_budget: deliveryBudget,
                    payment_terms: paymentTerms,
                    needed_by: neededBy,
                    note: cleanText(input.note, 300) || null,
                    status: "PENDING",
                },
            ])
            .select("*")
            .single()
    );

    await notify([
        {
            user_id: listing.farmer_id,
            type: "NEW_ORDER",
            title: "Nouvelle commande · New order 🛒",
            message: `${orderReference(order.id)} · ${orderLine(order)} · ${buyer.full_name}${deliveryCity ? ` → ${deliveryCity.name}` : ""}`,
        },
    ]);

    return {
        orderId: order.id,
        ref: orderReference(order.id),
    };
}

/* =========================================================
   FARMER: ANSWER ORDERS
========================================================= */

async function farmerOrder(farmer, orderId) {
    const order = await getOrderRow(orderId);

    if (order.farmer_id !== farmer.id) {
        throw new EngineError("Order not found.", 404);
    }

    return order;
}

/*
 * The Tayeb load for a confirmed order: from the farm to the
 * buyer, posted in the buyer's name with their delivery
 * budget. Drivers see the produce, weight and freshness;
 * the farmer's contact only after they're chosen.
 */
async function createLoadForOrder(order, farmer, buyer) {
    const unitText = bilingualUnit(order.unit, order.quantity);

    const details = [
        `${formatAmount(order.quantity)} ${unitText}`,
        order.weight_kg ? `~${formatPrice(order.weight_kg)} kg` : null,
        order.perishable ? "Produit frais : livrer vite · Fresh produce: deliver fast" : null,
        order.needed_by ? `Avant le · Needed by ${order.needed_by}` : null,
        `Commande · Order ${orderReference(order.id)}`,
    ]
        .filter(Boolean)
        .join(" · ");

    const shipment = must(
        await db
            .from("shipments")
            .insert([
                {
                    shipper_id: buyer.id,
                    shipper_name: buyer.full_name,
                    shipper_phone: buyer.phone_number,
                    item_type: `${findProduct(order.product)?.emoji || "🧺"} ${bilingualProduct(order)}`,
                    origin: order.product_area ? `${order.product_area}, ${order.product_city}` : order.product_city,
                    destination: order.delivery_area ? `${order.delivery_area}, ${order.delivery_city}` : order.delivery_city,
                    origin_city: order.product_city,
                    destination_city: order.delivery_city,
                    quantity: order.quantity,
                    initial_offer: order.delivery_budget,
                    receiver_phone: order.receiver_phone,
                    status: "OPEN",
                    order_id: order.id,
                    pickup_name: farmer.full_name,
                    pickup_phone: farmer.phone_number,
                    weight_kg: order.weight_kg,
                    perishable: Boolean(order.perishable),
                    details,
                },
            ])
            .select("*")
            .single()
    );

    return shipment;
}

export async function farmerConfirmOrder(farmer, { orderId }) {
    await requireMarket();

    const order = await farmerOrder(farmer, orderId);

    if (order.status !== "PENDING") {
        throw new EngineError("This order was already answered or cancelled.", 409);
    }

    if (Date.now() - new Date(order.created_at).getTime() > ORDER_EXPIRY_HOURS * 3600000) {
        await moveOrder(order, ["PENDING"], { status: "EXPIRED" });
        throw new EngineError("This order expired after 48 hours.", 409, "EXPIRED");
    }

    const buyer = (await usersById([order.buyer_id])).get(order.buyer_id);

    if (!buyer) {
        await moveOrder(order, ["PENDING"], { status: "CANCELLED", cancelled_at: new Date().toISOString(), cancelled_by: "SYSTEM" });
        throw new EngineError("The buyer no longer has an account.", 409);
    }

    // Take the stock first, so it can't be promised twice.
    const stock = await changeStock(order.product_id, -Number(order.quantity));

    if (!stock.ok) {
        throw new EngineError(
            `You only have ${formatAmount(stock.listing?.quantity_available ?? 0)} left. Decline this order or add stock.`,
            409,
            "NOT_ENOUGH_STOCK"
        );
    }

    const confirmed = await moveOrder(order, ["PENDING"], {
        status: "CONFIRMED",
        confirmed_at: new Date().toISOString(),
    });

    if (!confirmed) {
        await changeStock(order.product_id, Number(order.quantity));
        throw new EngineError("The buyer cancelled this order a moment ago.", 409);
    }

    let shipment = null;

    if (order.delivery_method === "TAYEB") {
        try {
            shipment = await createLoadForOrder(confirmed, farmer, buyer);

            must(
                await db
                    .from("orders")
                    .update({ shipment_id: shipment.id })
                    .eq("id", order.id)
            );
        } catch (error) {
            // Undo the confirmation so nothing is half done.
            if (shipment) {
                await db.from("shipments").delete().eq("id", shipment.id);
            }

            await db
                .from("orders")
                .update({ status: "PENDING", confirmed_at: null, shipment_id: null })
                .eq("id", order.id);

            await changeStock(order.product_id, Number(order.quantity));

            throw error;
        }

        await notifyDriversOfLoad(shipment);
    }

    await notify([
        {
            user_id: order.buyer_id,
            shipment_id: shipment?.id,
            type: "ORDER_CONFIRMED",
            title: "Commande confirmée · Order confirmed ✅",
            message: `${orderReference(order.id)} · ${orderLine(order)} · ${farmer.full_name} · ${farmer.phone_number}${shipment ? " · Choisissez un chauffeur · Choose a driver" : ""}`,
        },
    ]);

    return {
        orderId: order.id,
        shipmentId: shipment?.id || null,
    };
}

export async function farmerDeclineOrder(farmer, { orderId, reason, message }) {
    await requireMarket();

    const order = await farmerOrder(farmer, orderId);

    const code = DECLINE_REASONS.includes(reason) ? reason : "OTHER";

    const declined = await moveOrder(order, ["PENDING"], {
        status: "DECLINED",
        declined_at: new Date().toISOString(),
        decline_reason: code,
        decline_message: cleanText(message, 200) || null,
    });

    if (!declined) {
        throw new EngineError("This order was already answered or cancelled.", 409);
    }

    if (code === "SOLD_OUT") {
        await db
            .from("products")
            .update({ status: "SOLD_OUT", updated_at: new Date().toISOString() })
            .eq("id", order.product_id)
            .eq("status", "ACTIVE");
    }

    await notify([
        {
            user_id: order.buyer_id,
            type: "ORDER_DECLINED",
            title: "Commande refusée · Order declined",
            message: `${orderReference(order.id)} · ${orderLine(order)}${declined.decline_message ? ` · “${declined.decline_message}”` : ""}`,
        },
    ]);

    return {};
}

export async function farmerMarkPaid(farmer, { orderId }) {
    await requireMarket();

    const order = await farmerOrder(farmer, orderId);

    if (!CONTACT_STATUSES.includes(order.status) || order.paid_at) {
        throw new EngineError("This order can't be marked as paid.", 409);
    }

    const rows = must(
        await db
            .from("orders")
            .update({ paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", order.id)
            .is("paid_at", null)
            .select("id")
    );

    if (!rows || rows.length === 0) {
        throw new EngineError("This order is already marked as paid.", 409);
    }

    await notify([
        {
            user_id: order.buyer_id,
            type: "ORDER_PAID",
            title: "Paiement reçu · Payment received 💵",
            message: `${orderReference(order.id)} · ${formatPrice(order.total_price)} FCFA · ${farmer.full_name}`,
        },
    ]);

    return {};
}

/* =========================================================
   BUYER: CANCEL, RECEIVE, RATE
========================================================= */

async function buyerOrder(buyer, orderId) {
    const order = await getOrderRow(orderId);

    if (order.buyer_id !== buyer.id) {
        throw new EngineError("Order not found.", 404);
    }

    return order;
}

export async function buyerCancelOrder(buyer, { orderId }) {
    await requireMarket();

    const order = await buyerOrder(buyer, orderId);

    if (order.status === "CONFIRMED" && order.shipment_id) {
        const shipment = must(
            await db.from("shipments").select("*").eq("id", order.shipment_id).maybeSingle()
        );

        if (shipment && shipment.status !== "OPEN" && shipment.status !== "CANCELLED") {
            throw new EngineError(
                "A driver is already on this order. Call the farmer and the driver to change the plan.",
                409,
                "DRIVER_ASSIGNED"
            );
        }

        if (shipment && shipment.status === "OPEN" && !(await cancelOpenLoad(shipment))) {
            throw new EngineError("A driver was just chosen for this order. Call them to change the plan.", 409, "DRIVER_ASSIGNED");
        }
    }

    const cancelled = await moveOrder(order, ["PENDING", "CONFIRMED"], {
        status: "CANCELLED",
        cancelled_at: new Date().toISOString(),
        cancelled_by: "BUYER",
    });

    if (!cancelled) {
        throw new EngineError("This order can't be cancelled anymore.", 409);
    }

    if (order.status === "CONFIRMED") {
        await changeStock(order.product_id, Number(order.quantity));
    }

    await notify([
        {
            user_id: order.farmer_id,
            type: "ORDER_CANCELLED",
            title: "Commande annulée · Order cancelled",
            message: `${orderReference(order.id)} · ${orderLine(order)} · ${buyer.full_name}`,
        },
    ]);

    return {};
}

async function completeOrder(order) {
    const done = await moveOrder(order, ["CONFIRMED"], {
        status: "COMPLETED",
        completed_at: new Date().toISOString(),
    });

    if (!done) {
        return false;
    }

    const farmer = (await usersById([order.farmer_id])).get(order.farmer_id);

    if (farmer) {
        await db
            .from("users")
            .update({ total_completed_shipments: (farmer.total_completed_shipments || 0) + 1 })
            .eq("id", farmer.id);
    }

    await notify([
        {
            user_id: order.farmer_id,
            type: "ORDER_COMPLETED",
            title: "Livré à l'acheteur · Delivered to the buyer ✅",
            message: `${orderReference(order.id)} · ${orderLine(order)}${order.paid_at ? "" : " · Confirmez le paiement · Confirm the payment"}`,
        },
    ]);

    return true;
}

/*
 * For orders the buyer collects themselves.
 */
export async function buyerConfirmReceived(buyer, { orderId }) {
    await requireMarket();

    const order = await buyerOrder(buyer, orderId);

    if (order.delivery_method !== "PICKUP" || order.status !== "CONFIRMED") {
        throw new EngineError("This order can't be marked as received.", 409);
    }

    if (!(await completeOrder(order))) {
        throw new EngineError("This order was already finished.", 409);
    }

    return {};
}

export async function buyerRateFarmer(buyer, { orderId, rating }) {
    await requireMarket();

    const stars = Number(rating);

    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
        throw new EngineError("Choose 1 to 5 stars.");
    }

    const order = await buyerOrder(buyer, orderId);

    if (order.status !== "COMPLETED") {
        throw new EngineError("You can rate the farmer once you have the produce.", 409);
    }

    const rated = must(
        await db
            .from("orders")
            .update({ farmer_rating: stars, updated_at: new Date().toISOString() })
            .eq("id", order.id)
            .is("farmer_rating", null)
            .select("id")
    );

    if (!rated || rated.length === 0) {
        throw new EngineError("You already rated this order.", 409);
    }

    const farmer = (await usersById([order.farmer_id])).get(order.farmer_id);

    if (farmer) {
        const count = farmer.rating_count || 0;

        const average = ((Number(farmer.rating) || 0) * count + stars) / (count + 1);

        await db
            .from("users")
            .update({
                rating: Math.round(average * 10) / 10,
                rating_count: count + 1,
            })
            .eq("id", farmer.id);
    }

    return {};
}

/* =========================================================
   DELIVERY EVENTS (called by engine.js)
========================================================= */

async function orderForShipment(shipment) {
    if (!shipment?.order_id) {
        return null;
    }

    try {
        return must(
            await db.from("orders").select("*").eq("id", shipment.order_id).maybeSingle()
        );
    } catch (error) {
        console.error("Order lookup for load failed:", error);
        return null;
    }
}

export async function onShipmentMatched(shipment, driver) {
    const order = await orderForShipment(shipment);

    if (!order) {
        return;
    }

    await notify([
        {
            user_id: order.farmer_id,
            shipment_id: shipment.id,
            type: "PICKUP_DRIVER",
            title: "Un chauffeur arrive · A driver is coming 🚚",
            message: `${orderReference(order.id)} · ${driver.full_name} · ${driver.phone_number}${driver.plate_number ? ` · ${driver.plate_number}` : ""}`,
        },
    ]);
}

export async function onShipmentDeparted(shipment) {
    const order = await orderForShipment(shipment);

    if (!order) {
        return;
    }

    await notify([
        {
            user_id: order.farmer_id,
            shipment_id: shipment.id,
            type: "PICKED_UP",
            title: "Marchandise enlevée · Produce picked up",
            message: `${orderReference(order.id)} · ${orderLine(order)}`,
        },
    ]);
}

export async function onShipmentCompleted(shipment) {
    const order = await orderForShipment(shipment);

    if (order && order.status === "CONFIRMED") {
        await completeOrder(order);
    }
}

/*
 * The buyer cancelled the load itself from their shipments
 * list: the order is cancelled too and the stock goes back.
 */
export async function onShipmentCancelled(shipment) {
    const order = await orderForShipment(shipment);

    if (!order || order.status !== "CONFIRMED") {
        return;
    }

    const cancelled = await moveOrder(order, ["CONFIRMED"], {
        status: "CANCELLED",
        cancelled_at: new Date().toISOString(),
        cancelled_by: "BUYER",
    });

    if (!cancelled) {
        return;
    }

    await changeStock(order.product_id, Number(order.quantity));

    await notify([
        {
            user_id: order.farmer_id,
            type: "ORDER_CANCELLED",
            title: "Commande annulée · Order cancelled",
            message: `${orderReference(order.id)} · ${orderLine(order)}`,
        },
    ]);
}

/* =========================================================
   ADMIN AND SITEMAP
========================================================= */

export async function adminMarketData() {
    if (!(await marketReady())) {
        return { products: [], orders: [] };
    }

    const [products, orders] = await Promise.all([
        db.from("products").select("*").order("created_at", { ascending: false }).limit(1000),
        db.from("orders").select("*").order("created_at", { ascending: false }).limit(1000),
    ]);

    return {
        products: must(products) || [],
        orders: must(orders) || [],
    };
}

export async function sitemapListings() {
    if (!(await marketReady())) {
        return [];
    }

    const rows = must(
        await db
            .from("products")
            .select("id, status, quantity_available, available_until, updated_at")
            .eq("status", "ACTIVE")
            .gt("quantity_available", 0)
            .order("updated_at", { ascending: false })
            .limit(1000)
    ) || [];

    const today = cameroonToday();

    return rows.filter((row) => !row.available_until || row.available_until >= today);
}
