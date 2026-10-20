import { findCity } from "../cities";
import { DEFAULT_COUNTRY, countryOrDefault, findCountry, todayIn } from "../countries";
import { formatMoney } from "../money";
import { formatPhone, isValidPhone, normalizePhone } from "../phone";
import {
    CATEGORIES,
    DELIVERY_METHODS,
    PAYMENT_TERMS,
    PRODUCTS,
    estimateWeightKg,
    findProduct,
    findUnit,
    formatAmount,
    listingMatches,
    orderReference,
} from "../produce";
import { findLanguage } from "../languages";
import {
    cancelOpenLoad,
    cleanText,
    db,
    EngineError,
    formatPrice,
    must,
    notify,
    notifyDriversOfLoad,
    parsePrice,
    socialReady,
    upgraded,
    usersById,
} from "./core";
import { readPhoto } from "./media";
import { publicUser } from "./session";

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
 * Every listing belongs to the farmer's country and is
 * priced in its currency. Delivery can cross a border.
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

const MAX_PHOTOS = 8;

const DECLINE_REASONS = ["SOLD_OUT", "PRICE", "QUANTITY", "DATE", "OTHER"];

const LISTING_STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"];

/* =========================================================
   IS THE MARKET SET UP?
========================================================= */

/*
 * The market needs supabase/upgrade.sql. Until it runs,
 * every market screen says "opening soon" and the rest of
 * Tayeb keeps working.
 */
export async function marketReady() {
    return upgraded();
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
    return `${bilingualProduct(order)} · ${formatAmount(order.quantity)} ${bilingualUnit(order.unit, order.quantity)} · ${formatMoney(order.total_price, order.currency)}`;
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

function listingToday(listing) {
    return todayIn(listing.country || DEFAULT_COUNTRY);
}

export function isListingVisible(listing) {
    return (
        listing.status === "ACTIVE" &&
        Number(listing.quantity_available) > 0 &&
        (!listing.available_until || listing.available_until >= listingToday(listing))
    );
}

export function publicFarmer(user) {
    if (!user) {
        return null;
    }

    return {
        id: user.id,
        full_name: user.full_name,
        base_city: user.base_city,
        country: user.country || DEFAULT_COUNTRY,
        rating: user.rating,
        rating_count: user.rating_count || 0,
        completed_sales: user.total_completed_shipments || 0,
        member_since: user.created_at,
        // Farm profile (social market).
        handle: user.handle || null,
        farm_name: user.farm_name || null,
        avatar_url: user.avatar_url || null,
        followers_count: user.followers_count || 0,
        verified: Boolean(user.verified_id),
        visited: Boolean(user.farm_visited),
    };
}

/*
 * Photos are { url, path } on the server; the browser only
 * gets the URLs.
 */
function photoList(listing) {
    const photos = Array.isArray(listing.photos) ? listing.photos.filter((item) => item && item.url) : [];

    if (photos.length === 0 && listing.photo_url) {
        return [{ url: listing.photo_url, path: listing.photo_path || null }];
    }

    return photos;
}

export function publicListing(listing, farmer, stats) {
    const { photo_path, photos, farmer_id, voice_path, ...visible } = listing;

    return {
        ...visible,
        farmer_id,
        country: listing.country || DEFAULT_COUNTRY,
        currency: listing.currency || countryOrDefault(listing.country).currency,
        photos: photoList(listing).map((item) => ({ url: item.url })),
        ready_now: !listing.available_from || listing.available_from <= listingToday(listing),
        visible: isListingVisible(listing),
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
                link: "/shipper#orders",
                title: "Commande expirée · Order expired",
                message: `${orderReference(order.id)} · ${orderLine(order)}`,
            },
            {
                user_id: order.farmer_id,
                type: "ORDER_EXPIRED",
                link: "/farmer",
                title: "Commande expirée · Order expired",
                message: `${orderReference(order.id)} · ${orderLine(order)}`,
            },
        ])
    );
}

/* =========================================================
   REAL PRICES FROM ORDERS
========================================================= */

function statsKey(item) {
    return `${item.product}|${item.unit}|${item.currency || "XAF"}`;
}

/*
 * Price per unit paid in confirmed and completed orders, per
 * product, unit and currency. Shown only with at least 3
 * orders.
 */
async function priceStats(productKeys) {
    const keys = [...new Set(productKeys.filter(Boolean))];

    if (keys.length === 0) {
        return new Map();
    }

    const rows = must(
        await db
            .from("orders")
            .select("product, unit, currency, price_per_unit")
            .in("product", keys)
            .in("status", ["CONFIRMED", "COMPLETED"])
            .order("created_at", { ascending: false })
            .limit(3000)
    ) || [];

    const groups = new Map();

    for (const row of rows) {
        const key = statsKey(row);

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
    return stats.get(statsKey({ ...item, currency: item.currency || countryOrDefault(item.country).currency })) || null;
}

/*
 * For a farmer pricing a product: what buyers paid (3+
 * orders) and the range of prices on sale right now (2+
 * listings), per unit, in their country's currency.
 */
export async function productPrices(productKey, countryCode) {
    await requireMarket();

    if (!findProduct(productKey)) {
        throw new EngineError("Unknown product.");
    }

    const country = countryOrDefault(countryCode);

    const paid = await priceStats([productKey]);

    const live = must(
        await db
            .from("products")
            .select("unit, price_per_unit, quantity_available, available_until, status, country")
            .eq("product", productKey)
            .eq("country", country.code)
            .eq("status", "ACTIVE")
            .gt("quantity_available", 0)
            .limit(500)
    ) || [];

    const today = todayIn(country.code);

    const byUnit = {};

    for (const row of live.filter((item) => !item.available_until || item.available_until >= today)) {
        (byUnit[row.unit] = byUnit[row.unit] || []).push(Number(row.price_per_unit));
    }

    const units = {};

    for (const [unit, prices] of Object.entries(byUnit)) {
        if (prices.length >= 2) {
            units[unit] = {
                on_sale: { count: prices.length, low: Math.min(...prices), high: Math.max(...prices) },
            };
        }
    }

    for (const [key, stats] of paid) {
        const [, unit, currency] = key.split("|");

        if (currency === country.currency) {
            units[unit] = { ...(units[unit] || {}), paid: stats };
        }
    }

    return { product: productKey, country: country.code, currency: country.currency, units };
}

/* =========================================================
   PUBLIC MARKET
========================================================= */

/*
 * Listings for sale. country/city/product/category narrow
 * it; q searches every name a product has (bobolo, garden
 * egg, ndolè…), the farmer's description and the village.
 *
 * facets: how many listings each product has in this
 * country, for the browsing chips.
 */
export async function listMarket({ product, city, q, country, category, limit = 60 } = {}) {
    await requireMarket();

    const countryCode = findCountry(country)?.code || null;

    let query = db
        .from("products")
        .select("*")
        .eq("status", "ACTIVE")
        .gt("quantity_available", 0)
        .order("created_at", { ascending: false })
        .limit(400);

    if (countryCode) {
        query = query.eq("country", countryCode);
    }

    if (product && findProduct(product)) {
        query = query.eq("product", product);
    } else if (category && CATEGORIES.some((item) => item.key === category)) {
        query = query.in(
            "product",
            PRODUCTS.filter((item) => item.category === category).map((item) => item.key)
        );
    }

    const cityMatch = city ? findCity(city, countryCode || undefined) : null;

    if (cityMatch) {
        query = query.eq("city", cityMatch.name);
    }

    let listings = (must(await query) || []).filter(isListingVisible);

    if (q) {
        listings = listings.filter((item) => listingMatches(item, String(q).slice(0, 60)));
    }

    // "For you": fresh posts that are ready now, with photos, a
    // caption or voice note and likes come first. Nobody can pay
    // to be on top.
    const now = Date.now();

    const score = (item) => {
        const hours = Math.max(0, (now - Date.parse(item.created_at)) / 3600000);

        return (
            (24 / (hours + 24)) * 10 +
            ((item.available_from || "") <= listingToday(item) ? 6 : 0) +
            (photoList(item).length ? 4 : 0) +
            (item.details ? 1 : 0) +
            (item.voice_url ? 1 : 0) +
            Math.log1p(Number(item.likes_count) || 0) * 3
        );
    };

    listings.sort((a, b) => score(b) - score(a) || new Date(b.created_at) - new Date(a.created_at));

    const total = listings.length;

    listings = listings.slice(0, Math.min(Number(limit) || 60, 120));

    const farmers = await usersById(listings.map((item) => item.farmer_id));

    const stats = await priceStats(listings.map((item) => item.product));

    // Chips: products on sale in this country (or everywhere).
    let facetQuery = db
        .from("products")
        .select("product, available_until, country")
        .eq("status", "ACTIVE")
        .gt("quantity_available", 0)
        .limit(2000);

    if (countryCode) {
        facetQuery = facetQuery.eq("country", countryCode);
    }

    const facets = {};

    for (const row of must(await facetQuery) || []) {
        if (!row.available_until || row.available_until >= listingToday(row)) {
            facets[row.product] = (facets[row.product] || 0) + 1;
        }
    }

    return {
        total,
        facets,
        listings: listings.map((item) => publicListing(item, farmers.get(item.farmer_id), statsFor(stats, item))),
    };
}

/*
 * One listing, plus up to 6 others of the same product in the
 * same country ("more like this").
 */
export async function getListing(id) {
    await requireMarket();

    const listing = await getListingRow(id);

    if (listing.status === "ARCHIVED") {
        throw new EngineError("Product not found.", 404);
    }

    const relatedRows = (must(
        await db
            .from("products")
            .select("*")
            .eq("product", listing.product)
            .eq("country", listing.country || DEFAULT_COUNTRY)
            .eq("status", "ACTIVE")
            .gt("quantity_available", 0)
            .neq("id", listing.id)
            .order("created_at", { ascending: false })
            .limit(12)
    ) || []).filter(isListingVisible).slice(0, 6);

    const farmers = await usersById([listing.farmer_id, ...relatedRows.map((item) => item.farmer_id)]);

    const stats = await priceStats([listing.product]);

    return {
        ...publicListing(listing, farmers.get(listing.farmer_id), statsFor(stats, listing)),
        related: relatedRows.map((item) => publicListing(item, farmers.get(item.farmer_id), statsFor(stats, item))),
    };
}

/* =========================================================
   ALERTS ("tell me when it's available")
========================================================= */

/*
 * Buyers ask to hear about a product in a country (and
 * optionally a city). When a farmer lists it, they get a
 * notification that opens the listing.
 */
export async function buyerSaveAlert(buyer, { product, country, city }) {
    await requireMarket();

    if (!findProduct(product) || product === "OTHER") {
        throw new EngineError("Choose a product to follow.");
    }

    const countryCode = countryOrDefault(country || buyer.country).code;

    const cityMatch = city ? findCity(city, countryCode) : null;

    if (city && !cityMatch) {
        throw new EngineError("Choose a city from the list.");
    }

    let existing = db
        .from("market_alerts")
        .select("id")
        .eq("user_id", buyer.id)
        .eq("product", product)
        .eq("country", countryCode);

    existing = cityMatch ? existing.eq("city", cityMatch.name) : existing.is("city", null);

    const found = must(await existing.limit(1));

    if (found && found.length) {
        return { alertId: found[0].id };
    }

    const count = must(
        await db.from("market_alerts").select("id").eq("user_id", buyer.id).limit(51)
    ) || [];

    if (count.length >= 50) {
        throw new EngineError("You follow 50 products already. Remove one first.", 409);
    }

    const created = must(
        await db
            .from("market_alerts")
            .insert([
                {
                    user_id: buyer.id,
                    product,
                    country: countryCode,
                    city: cityMatch ? cityMatch.name : null,
                },
            ])
            .select("id")
            .single()
    );

    return { alertId: created.id };
}

export async function buyerDeleteAlert(buyer, { alertId }) {
    await requireMarket();

    must(await db.from("market_alerts").delete().eq("id", alertId).eq("user_id", buyer.id));

    return {};
}

async function notifyAlertsForListing(listing) {
    const alerts = must(
        await db
            .from("market_alerts")
            .select("id, user_id, city")
            .eq("product", listing.product)
            .eq("country", listing.country)
            .limit(500)
    ) || [];

    const matching = alerts.filter(
        (alert) => alert.user_id !== listing.farmer_id && (!alert.city || alert.city === listing.city)
    );

    if (matching.length === 0) {
        return 0;
    }

    await notify(
        matching.map((alert) => ({
            user_id: alert.user_id,
            type: "MARKET_ALERT",
            link: `/market/${listing.id}`,
            title: "Disponible maintenant · Now available",
            message: `${bilingualProduct(listing)} · ${listing.area ? `${listing.area}, ` : ""}${listing.city} · ${formatMoney(listing.price_per_unit, listing.currency)} / ${bilingualUnit(listing.unit, 1)}`,
        }))
    );

    await db
        .from("market_alerts")
        .update({ last_notified_at: new Date().toISOString() })
        .in("id", matching.map((alert) => alert.id));

    return matching.length;
}

/* =========================================================
   FARMER: PRODUCTS
========================================================= */

export async function farmerSaveProduct(farmer, input) {
    await requireMarket();

    const country = countryOrDefault(farmer.country);

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

    const city = findCity(input.city, country.code);

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

    const today = todayIn(country.code);

    const availableFrom = parseDate(input.availableFrom, "Ready date") || today;

    const availableUntil = parseDate(input.availableUntil, "Last day");

    if (availableUntil && availableUntil < availableFrom) {
        throw new EngineError("The last day must be after the ready date.");
    }

    if (availableUntil && availableUntil < today) {
        throw new EngineError("The last day is already past.");
    }

    const captionLang = input.captionLang ? findLanguage(String(input.captionLang))?.code || null : null;

    const fields = {
        product: product.key,
        custom_name: product.key === "OTHER" ? customName : null,
        details: cleanText(input.details, 600) || null,
        ...(input.captionLang !== undefined && (await socialReady()) ? { caption_lang: captionLang } : {}),
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

        return { product: publicListing(rows[0], farmer, null) };
    }

    const created = must(
        await db
            .from("products")
            .insert([
                {
                    ...fields,
                    farmer_id: farmer.id,
                    country: country.code,
                    currency: country.currency,
                    photos: [],
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

    const alerted = await notifyAlertsForListing(created);

    return { product: publicListing(created, farmer, null), alerted };
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

    if (status === "ARCHIVED") {
        const paths = photoList(listing).map((item) => item.path).filter(Boolean);

        if (paths.length) {
            await db.storage.from(PHOTO_BUCKET).remove(paths);
        }
    }

    return {};
}

/*
 * Saves the photo list: photos[0] is the cover shown in the
 * market and in WhatsApp previews. Retries if another change
 * to the product landed at the same moment.
 */
async function writePhotos(listing, farmer, update) {
    for (let attempt = 0; attempt < 4; attempt++) {
        const current = attempt === 0 ? listing : await getListingRow(listing.id);

        const photos = update(photoList(current));

        const rows = must(
            await db
                .from("products")
                .update({
                    photos,
                    photo_url: photos[0]?.url || null,
                    photo_path: photos[0]?.path || null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", current.id)
                .eq("farmer_id", farmer.id)
                .eq("updated_at", current.updated_at)
                .select("id")
        );

        if (rows && rows.length) {
            return photos;
        }
    }

    throw new EngineError("The photos changed on another phone. Please try again.", 409);
}

async function farmerListing(farmer, productId) {
    const listing = await getListingRow(productId);

    if (listing.farmer_id !== farmer.id || listing.status === "ARCHIVED") {
        throw new EngineError("Product not found.", 404);
    }

    return listing;
}

/*
 * Adds one photo (a data URL; the browser shrinks photos to
 * about 1280 px first, so they load fast on mobile data).
 * Up to 8 per product.
 */
export async function farmerAddPhoto(farmer, { productId, image }) {
    await requireMarket();

    const listing = await farmerListing(farmer, productId);

    if (photoList(listing).length >= MAX_PHOTOS) {
        throw new EngineError(`${MAX_PHOTOS} photos at most. Remove one to add another.`, 409, "TOO_MANY_PHOTOS");
    }

    // Checked by its real bytes and re-encoded without hidden
    // data (like where the photo was taken): see media.js.
    const photo = await readPhoto(image, { maxSide: 1600 });

    const buffer = photo.buffer;

    const extension = photo.extension;

    const path = `${farmer.id}/${listing.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

    const { error: uploadError } = await db.storage
        .from(PHOTO_BUCKET)
        .upload(path, buffer, {
            contentType: photo.contentType,
            cacheControl: "31536000",
            upsert: false,
        });

    if (uploadError) {
        console.error("Photo upload error:", uploadError);
        throw new EngineError("The photo couldn't be saved. Please try again.", 502);
    }

    const { data: urlData } = db.storage.from(PHOTO_BUCKET).getPublicUrl(path);

    let photos;

    try {
        photos = await writePhotos(listing, farmer, (current) => {
            if (current.length >= MAX_PHOTOS) {
                throw new EngineError(`${MAX_PHOTOS} photos at most. Remove one to add another.`, 409, "TOO_MANY_PHOTOS");
            }

            return [...current, { url: urlData.publicUrl, path }];
        });
    } catch (error) {
        await db.storage.from(PHOTO_BUCKET).remove([path]);
        throw error;
    }

    return {
        photo_url: urlData.publicUrl,
        photos: photos.map((item) => ({ url: item.url })),
    };
}

/*
 * Reorders and removes photos. `urls` is the new order;
 * photos left out are deleted. The first one is the cover.
 */
export async function farmerArrangePhotos(farmer, { productId, urls }) {
    await requireMarket();

    const listing = await farmerListing(farmer, productId);

    if (!Array.isArray(urls)) {
        throw new EngineError("Send the photos in order.");
    }

    let removed = [];

    const photos = await writePhotos(listing, farmer, (current) => {
        const byUrl = new Map(current.map((item) => [item.url, item]));

        // Only this product's own photos. An address we don't
        // know means the page is out of date (or someone is
        // tampering): change nothing rather than lose photos.
        if (urls.some((url) => !byUrl.has(url))) {
            throw new EngineError("These photos have changed. Reload the page and try again.", 409, "PHOTOS_CHANGED");
        }

        const ordered = [...new Set(urls)].map((url) => byUrl.get(url));

        removed = current.filter((item) => !ordered.includes(item));

        return ordered;
    });

    const paths = removed.map((item) => item.path).filter(Boolean);

    if (paths.length) {
        await db.storage.from(PHOTO_BUCKET).remove(paths);
    }

    return { photos: photos.map((item) => ({ url: item.url })) };
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

function orderView(order, { other, otherRole, shipment, product }) {
    const showContact = CONTACT_STATUSES.includes(order.status);

    return {
        ...order,
        ref: orderReference(order.id),
        photo_url: product?.photo_url || null,
        product_available: Boolean(product && isListingVisible(product)),
        hours_left:
            order.status === "PENDING"
                ? Math.max(0, Math.ceil(ORDER_EXPIRY_HOURS - (Date.now() - new Date(order.created_at).getTime()) / 3600000))
                : null,
        [otherRole]: other
            ? {
                id: other.id,
                full_name: other.full_name,
                base_city: other.base_city,
                country: other.country || DEFAULT_COUNTRY,
                rating: other.rating,
                rating_count: other.rating_count || 0,
                ...(showContact ? { phone_number: other.phone_number } : {}),
            }
            : null,
        delivery: deliveryView(shipment),
    };
}

async function productsById(ids) {
    const unique = [...new Set(ids.filter(Boolean))];

    if (unique.length === 0) {
        return new Map();
    }

    const rows = must(
        await db
            .from("products")
            .select("id, photo_url, status, quantity_available, available_until, country")
            .in("id", unique)
    ) || [];

    return new Map(rows.map((row) => [row.id, row]));
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

    const byId = new Map(products.map((item) => [item.id, item]));

    return {
        ready: true,
        user: publicUser(farmer),
        products: products.map((item) => publicListing(item, farmer, statsFor(stats, item))),
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
                    product: byId.get(order.product_id),
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
        return { ready: false, orders: [], alerts: [] };
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

    const products = await productsById(orders.map((order) => order.product_id));

    const alerts = must(
        await db
            .from("market_alerts")
            .select("id, product, country, city, created_at, last_notified_at")
            .eq("user_id", buyer.id)
            .order("created_at", { ascending: false })
            .limit(50)
    ) || [];

    return {
        ready: true,
        alerts,
        orders: orders.map((order) =>
            orderView(order, {
                other: farmers.get(order.farmer_id),
                otherRole: "farmer",
                shipment: shipments.get(order.shipment_id),
                product: products.get(order.product_id),
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

    const listingCountry = countryOrDefault(listing.country);

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

    let deliveryCountry = null;
    let deliveryCity = null;
    let deliveryBudget = null;
    let receiverPhone = null;

    if (deliveryMethod === "TAYEB") {
        deliveryCountry = countryOrDefault(input.deliveryCountry || listingCountry.code);

        deliveryCity = findCity(input.deliveryCity, deliveryCountry.code);

        if (!deliveryCity) {
            throw new EngineError("Choose the delivery city from the list.");
        }

        deliveryBudget = parsePrice(input.deliveryBudget);

        receiverPhone = normalizePhone(input.receiverPhone || buyer.phone_number, deliveryCountry.code);

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

    if (neededBy && neededBy < todayIn(listingCountry.code)) {
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

    const currency = listing.currency || listingCountry.currency;

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
                    currency,
                    country: listingCountry.code,
                    weight_kg: estimateWeightKg(listing.unit, quantity, listing.unit_weight_kg),
                    perishable: Boolean(listing.perishable),
                    product_city: listing.city,
                    product_area: listing.area,
                    delivery_method: deliveryMethod,
                    delivery_country: deliveryCountry ? deliveryCountry.code : null,
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
            link: "/farmer",
            title: "Nouvelle commande · New order",
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
 * budget, in the farm country's currency. Drivers see the
 * produce, weight and freshness; the farmer's contact only
 * after they're chosen.
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

    const country = countryOrDefault(order.country);

    return must(
        await db
            .from("shipments")
            .insert([
                {
                    shipper_id: buyer.id,
                    shipper_name: buyer.full_name,
                    shipper_phone: buyer.phone_number,
                    item_type: bilingualProduct(order),
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
                    country: country.code,
                    currency: order.currency || country.currency,
                },
            ])
            .select("*")
            .single()
    );
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
            link: "/shipper#orders",
            title: "Commande confirmée · Order confirmed",
            message: `${orderReference(order.id)} · ${orderLine(order)} · ${farmer.full_name}${shipment ? " · Choisissez un chauffeur · Choose a driver" : ""}`,
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
            link: "/shipper#orders",
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
            link: "/shipper#orders",
            title: "Paiement reçu · Payment received",
            message: `${orderReference(order.id)} · ${formatMoney(order.total_price, order.currency)} · ${farmer.full_name}`,
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
            link: "/farmer",
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
            link: "/farmer",
            title: "Livré à l'acheteur · Delivered to the buyer",
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
            link: "/farmer",
            title: "Un chauffeur arrive · A driver is coming",
            message: `${orderReference(order.id)} · ${driver.full_name} · ${formatPhone(driver.phone_number)}${driver.plate_number ? ` · ${driver.plate_number}` : ""}`,
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
            link: "/farmer",
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
            link: "/farmer",
            title: "Commande annulée · Order cancelled",
            message: `${orderReference(order.id)} · ${orderLine(order)}`,
        },
    ]);
}

/* =========================================================
   ADMIN, HOME PAGE AND SITEMAP
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
        products: (must(products) || []).map(({ photo_path, photos, ...item }) => ({
            ...item,
            photo_count: photoList({ photos, photo_url: item.photo_url, photo_path }).length,
        })),
        orders: must(orders) || [],
    };
}

/*
 * Fresh listings for the home page, newest first, with a
 * photo when possible (they make the page come alive).
 */
export async function featuredListings({ country, limit = 8 } = {}) {
    if (!(await marketReady())) {
        return [];
    }

    const result = await listMarket({ country, limit: 40 });

    const withPhotos = result.listings.filter((item) => item.photos.length);
    const without = result.listings.filter((item) => !item.photos.length);

    return [...withPhotos, ...without].slice(0, limit);
}

export async function sitemapListings() {
    if (!(await marketReady())) {
        return [];
    }

    const rows = must(
        await db
            .from("products")
            .select("id, farmer_id, product, custom_name, city, country, status, quantity_available, available_until, updated_at, photos, photo_url")
            .eq("status", "ACTIVE")
            .gt("quantity_available", 0)
            .order("updated_at", { ascending: false })
            .limit(1000)
    ) || [];

    return rows
        .filter((row) => !row.available_until || row.available_until >= listingToday(row))
        .map((row) => ({
            id: row.id,
            farmer_id: row.farmer_id,
            product: row.product,
            custom_name: row.custom_name,
            city: row.city,
            country: row.country || DEFAULT_COUNTRY,
            updated_at: row.updated_at,
            photos: photoList(row).map((item) => item.url),
        }));
}
