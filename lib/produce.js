/*
 * ============================================================
 * TAYEB MARCHÉ — PRODUCE CATALOG
 * ============================================================
 *
 * Shared by the browser and the server. Keys are stored in
 * the database; names are shown in the reader's language.
 *
 * perishable: spoils within days, so orders and deliveries
 * are flagged "deliver quickly" for drivers.
 */

export const PRODUCTS = [
    { key: "TOMATOES", emoji: "🍅", en: "Tomatoes", fr: "Tomates", perishable: true, unit: "CRATE" },
    { key: "PLANTAINS", emoji: "🍌", en: "Plantains", fr: "Plantain", perishable: true, unit: "BUNCH" },
    { key: "BANANAS", emoji: "🍌", en: "Bananas", fr: "Bananes", perishable: true, unit: "BUNCH" },
    { key: "CASSAVA", emoji: "🥔", en: "Cassava", fr: "Manioc", perishable: false, unit: "BAG" },
    { key: "COCOYAMS", emoji: "🥔", en: "Cocoyams (macabo)", fr: "Macabo", perishable: false, unit: "BAG" },
    { key: "YAMS", emoji: "🍠", en: "Yams", fr: "Ignames", perishable: false, unit: "BAG" },
    { key: "POTATOES", emoji: "🥔", en: "Irish potatoes", fr: "Pommes de terre", perishable: false, unit: "BAG" },
    { key: "SWEET_POTATOES", emoji: "🍠", en: "Sweet potatoes", fr: "Patates douces", perishable: false, unit: "BAG" },
    { key: "MAIZE", emoji: "🌽", en: "Maize", fr: "Maïs", perishable: false, unit: "BAG" },
    { key: "RICE", emoji: "🌾", en: "Rice", fr: "Riz", perishable: false, unit: "BAG" },
    { key: "BEANS", emoji: "🫘", en: "Beans", fr: "Haricots", perishable: false, unit: "BAG" },
    { key: "GROUNDNUTS", emoji: "🥜", en: "Groundnuts", fr: "Arachides", perishable: false, unit: "BAG" },
    { key: "SOYBEANS", emoji: "🫘", en: "Soybeans", fr: "Soja", perishable: false, unit: "BAG" },
    { key: "EGUSI", emoji: "🌰", en: "Egusi", fr: "Pistache (egusi)", perishable: false, unit: "BASIN" },
    { key: "ONIONS", emoji: "🧅", en: "Onions", fr: "Oignons", perishable: false, unit: "BAG" },
    { key: "PEPPER", emoji: "🌶️", en: "Pepper", fr: "Piment", perishable: true, unit: "BASIN" },
    { key: "OKRA", emoji: "🫛", en: "Okra", fr: "Gombo", perishable: true, unit: "BASIN" },
    { key: "CABBAGE", emoji: "🥬", en: "Cabbage", fr: "Choux", perishable: true, unit: "BAG" },
    { key: "CARROTS", emoji: "🥕", en: "Carrots", fr: "Carottes", perishable: true, unit: "BAG" },
    { key: "LEAFY_GREENS", emoji: "🥬", en: "Leafy greens (ndolè, folon…)", fr: "Légumes feuilles (ndolè, folon…)", perishable: true, unit: "BASIN" },
    { key: "PINEAPPLES", emoji: "🍍", en: "Pineapples", fr: "Ananas", perishable: true, unit: "PIECE" },
    { key: "AVOCADOS", emoji: "🥑", en: "Avocados", fr: "Avocats", perishable: true, unit: "BASIN" },
    { key: "ORANGES", emoji: "🍊", en: "Oranges", fr: "Oranges", perishable: true, unit: "BAG" },
    { key: "WATERMELONS", emoji: "🍉", en: "Watermelons", fr: "Pastèques", perishable: true, unit: "PIECE" },
    { key: "PALM_OIL", emoji: "🫗", en: "Palm oil", fr: "Huile de palme", perishable: false, unit: "LITRE" },
    { key: "COCOA", emoji: "🍫", en: "Cocoa beans", fr: "Fèves de cacao", perishable: false, unit: "BAG" },
    { key: "COFFEE", emoji: "☕", en: "Coffee beans", fr: "Café", perishable: false, unit: "BAG" },
    { key: "HONEY", emoji: "🍯", en: "Honey", fr: "Miel", perishable: false, unit: "LITRE" },
    { key: "EGGS", emoji: "🥚", en: "Eggs", fr: "Œufs", perishable: true, unit: "TRAY" },
    { key: "CHICKENS", emoji: "🐔", en: "Chickens", fr: "Poulets", perishable: true, unit: "PIECE" },
    { key: "OTHER", emoji: "🧺", en: "Other produce", fr: "Autre produit", perishable: false, unit: "KG" },
];

/*
 * kg: weight of one unit, used to estimate the load for
 * drivers. null means the farmer gives it (a crate of
 * tomatoes and a crate of avocados don't weigh the same).
 */
export const UNITS = [
    { key: "KG", en: "kg", fr: "kg", enPlural: "kg", frPlural: "kg", kg: 1 },
    { key: "TONNE", en: "tonne", fr: "tonne", enPlural: "tonnes", frPlural: "tonnes", kg: 1000 },
    { key: "BAG", en: "bag", fr: "sac", enPlural: "bags", frPlural: "sacs", kg: null },
    { key: "CRATE", en: "crate", fr: "cageot", enPlural: "crates", frPlural: "cageots", kg: null },
    { key: "BUNCH", en: "bunch", fr: "régime", enPlural: "bunches", frPlural: "régimes", kg: null },
    { key: "BASIN", en: "basin", fr: "cuvette", enPlural: "basins", frPlural: "cuvettes", kg: null },
    { key: "BUCKET", en: "bucket", fr: "seau", enPlural: "buckets", frPlural: "seaux", kg: null },
    { key: "TRAY", en: "tray", fr: "plateau", enPlural: "trays", frPlural: "plateaux", kg: null },
    { key: "LITRE", en: "litre", fr: "litre", enPlural: "litres", frPlural: "litres", kg: 0.92 },
    { key: "PIECE", en: "piece", fr: "pièce", enPlural: "pieces", frPlural: "pièces", kg: null },
];

export const PAYMENT_TERMS = ["MOMO_ON_DELIVERY", "MOMO_BEFORE_PICKUP", "CASH_ON_PICKUP"];

export const DELIVERY_METHODS = ["TAYEB", "PICKUP"];

export function findProduct(key) {
    return PRODUCTS.find((product) => product.key === key) || null;
}

export function findUnit(key) {
    return UNITS.find((unit) => unit.key === key) || null;
}

/*
 * "Tomatoes" / "Tomates", or the farmer's own name for OTHER.
 */
export function productName(listing, language) {
    if (!listing) {
        return "";
    }

    if (listing.product === "OTHER" && listing.custom_name) {
        return listing.custom_name;
    }

    const product = findProduct(listing.product);

    if (!product) {
        return listing.custom_name || listing.product || "";
    }

    return language === "fr" ? product.fr : product.en;
}

export function productEmoji(key) {
    return findProduct(key)?.emoji || "🧺";
}

export function unitName(key, language, count = 1) {
    const unit = findUnit(key);

    if (!unit) {
        return String(key || "").toLowerCase();
    }

    const plural = Number(count) !== 1;

    if (language === "fr") {
        return plural ? unit.frPlural : unit.fr;
    }

    return plural ? unit.enPlural : unit.en;
}

export function formatAmount(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "0";
    }

    return number.toLocaleString("en-US", {
        maximumFractionDigits: 2,
    });
}

/*
 * Estimated weight in kg for a quantity, or null when unknown.
 */
export function estimateWeightKg(unitKey, quantity, unitWeightKg) {
    const unit = findUnit(unitKey);

    const perUnit =
        Number(unitWeightKg) > 0
            ? Number(unitWeightKg)
            : unit?.kg ?? null;

    if (!perUnit || !(Number(quantity) > 0)) {
        return null;
    }

    return Math.round(perUnit * Number(quantity));
}

/*
 * Today's date in Cameroon (UTC+1), as YYYY-MM-DD.
 */
export function cameroonToday() {
    return new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

/*
 * Short reference people can read out on the phone: #A1B2C3.
 */
export function orderReference(id) {
    return `#${String(id || "").replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
