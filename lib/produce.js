/*
 * ============================================================
 * TAYEB MARCHÉ — PRODUCE CATALOG
 * ============================================================
 *
 * Shared by the browser and the server. Keys are stored in
 * the database; names are shown in the reader's language.
 *
 * perishable: spoils within days, so orders and deliveries
 *             are flagged "deliver quickly" for drivers.
 * category:   groups for browsing (see CATEGORIES).
 * aliases:    other names people search with, across Africa
 *             (local, French, English and trade names).
 */

export const CATEGORIES = [
    { key: "VEGETABLES", emoji: "🥬", en: "Vegetables", fr: "Légumes" },
    { key: "FRUITS", emoji: "🍍", en: "Fruits", fr: "Fruits" },
    { key: "TUBERS", emoji: "🥔", en: "Tubers & plantain", fr: "Tubercules & plantain" },
    { key: "GRAINS", emoji: "🌾", en: "Grains & cereals", fr: "Céréales" },
    { key: "LEGUMES", emoji: "🥜", en: "Beans, nuts & seeds", fr: "Légumineuses & graines" },
    { key: "SPICES", emoji: "🌶️", en: "Spices & herbs", fr: "Épices & condiments" },
    { key: "OILS", emoji: "🫗", en: "Oils & processed", fr: "Huiles & transformés" },
    { key: "CASH_CROPS", emoji: "☕", en: "Cocoa, coffee & cash crops", fr: "Cacao, café & rente" },
    { key: "LIVESTOCK", emoji: "🐐", en: "Livestock, eggs & fish", fr: "Élevage, œufs & poisson" },
];

export const PRODUCTS = [
    // Vegetables
    { key: "TOMATOES", emoji: "🍅", en: "Tomatoes", fr: "Tomates", perishable: true, unit: "CRATE", category: "VEGETABLES", aliases: ["tomato", "tomate", "roma"] },
    { key: "ONIONS", emoji: "🧅", en: "Onions", fr: "Oignons", perishable: false, unit: "BAG", category: "VEGETABLES", aliases: ["onion", "oignon", "albasa"] },
    { key: "PEPPER", emoji: "🌶️", en: "Pepper", fr: "Piment", perishable: true, unit: "BASIN", category: "SPICES", aliases: ["chili", "chilli", "pili pili", "pilipili", "piment", "scotch bonnet", "atarodo", "shito"] },
    { key: "OKRA", emoji: "🫛", en: "Okra", fr: "Gombo", perishable: true, unit: "BASIN", category: "VEGETABLES", aliases: ["okro", "gombo", "lady finger", "bamia"] },
    { key: "CABBAGE", emoji: "🥬", en: "Cabbage", fr: "Choux", perishable: true, unit: "BAG", category: "VEGETABLES", aliases: ["chou", "choux", "cabbages"] },
    { key: "CARROTS", emoji: "🥕", en: "Carrots", fr: "Carottes", perishable: true, unit: "BAG", category: "VEGETABLES", aliases: ["carrot", "carotte"] },
    { key: "EGGPLANT", emoji: "🍆", en: "Garden eggs & eggplant", fr: "Aubergines & djakatou", perishable: true, unit: "BASIN", category: "VEGETABLES", aliases: ["aubergine", "garden egg", "garden eggs", "djakatou", "diakhatou", "ntrowa", "eggplants"] },
    { key: "CUCUMBERS", emoji: "🥒", en: "Cucumbers", fr: "Concombres", perishable: true, unit: "BAG", category: "VEGETABLES", aliases: ["cucumber", "concombre"] },
    { key: "LEAFY_GREENS", emoji: "🥬", en: "Leafy greens (ndolè, folong…)", fr: "Légumes feuilles (ndolè, folong…)", perishable: true, unit: "BASIN", category: "VEGETABLES", aliases: ["ndole", "ndolè", "folong", "folon", "eru", "okok", "spinach", "epinard", "épinard", "bitterleaf", "bitter leaf", "ugu", "pumpkin leaves", "sukuma", "sukuma wiki", "kale", "amaranth", "zom", "morelle", "huckleberry", "njama njama", "cassava leaves", "feuilles de manioc", "pondu", "saka saka", "kontomire", "cocoyam leaves", "moringa"] },
    { key: "GARLIC", emoji: "🧄", en: "Garlic", fr: "Ail", perishable: false, unit: "KG", category: "SPICES", aliases: ["ail", "garlic"] },
    { key: "GINGER", emoji: "🫚", en: "Ginger", fr: "Gingembre", perishable: false, unit: "BAG", category: "SPICES", aliases: ["gingembre", "ginger root"] },

    // Fruits
    { key: "PINEAPPLES", emoji: "🍍", en: "Pineapples", fr: "Ananas", perishable: true, unit: "PIECE", category: "FRUITS", aliases: ["pineapple", "ananas"] },
    { key: "AVOCADOS", emoji: "🥑", en: "Avocados", fr: "Avocats", perishable: true, unit: "BASIN", category: "FRUITS", aliases: ["avocado", "avocat", "pear", "butter pear"] },
    { key: "BANANAS", emoji: "🍌", en: "Bananas", fr: "Bananes", perishable: true, unit: "BUNCH", category: "FRUITS", aliases: ["banana", "banane", "banane douce", "matoke"] },
    { key: "MANGOES", emoji: "🥭", en: "Mangoes", fr: "Mangues", perishable: true, unit: "BASIN", category: "FRUITS", aliases: ["mango", "mangue"] },
    { key: "ORANGES", emoji: "🍊", en: "Oranges", fr: "Oranges", perishable: true, unit: "BAG", category: "FRUITS", aliases: ["orange", "citrus", "agrumes"] },
    { key: "PAPAYAS", emoji: "🍈", en: "Papayas", fr: "Papayes", perishable: true, unit: "BASIN", category: "FRUITS", aliases: ["papaya", "papaye", "pawpaw"] },
    { key: "WATERMELONS", emoji: "🍉", en: "Watermelons", fr: "Pastèques", perishable: true, unit: "PIECE", category: "FRUITS", aliases: ["watermelon", "pasteque", "pastèque"] },
    { key: "COCONUTS", emoji: "🥥", en: "Coconuts", fr: "Noix de coco", perishable: false, unit: "PIECE", category: "FRUITS", aliases: ["coconut", "coco", "noix de coco"] },
    { key: "SAFOU", emoji: "🫐", en: "African plums (safou)", fr: "Safou (prune)", perishable: true, unit: "BASIN", category: "FRUITS", aliases: ["safou", "prune", "plum", "african pear", "ube", "atanga"] },

    // Tubers and plantain
    { key: "PLANTAINS", emoji: "🍌", en: "Plantains", fr: "Plantain", perishable: true, unit: "BUNCH", category: "TUBERS", aliases: ["plantain", "banane plantain", "plantains", "dodo", "alloco", "kokondo"] },
    { key: "CASSAVA", emoji: "🥔", en: "Cassava", fr: "Manioc", perishable: false, unit: "BAG", category: "TUBERS", aliases: ["manioc", "cassava", "yuca", "mogo", "muhogo", "bobolo", "miondo", "batons de manioc"] },
    { key: "COCOYAMS", emoji: "🥔", en: "Cocoyams (macabo)", fr: "Macabo", perishable: false, unit: "BAG", category: "TUBERS", aliases: ["macabo", "cocoyam", "taro", "malanga", "ede", "nkontomire"] },
    { key: "YAMS", emoji: "🍠", en: "Yams", fr: "Ignames", perishable: false, unit: "BAG", category: "TUBERS", aliases: ["yam", "igname", "ignames", "puna"] },
    { key: "POTATOES", emoji: "🥔", en: "Irish potatoes", fr: "Pommes de terre", perishable: false, unit: "BAG", category: "TUBERS", aliases: ["potato", "pomme de terre", "patate", "irish"] },
    { key: "SWEET_POTATOES", emoji: "🍠", en: "Sweet potatoes", fr: "Patates douces", perishable: false, unit: "BAG", category: "TUBERS", aliases: ["sweet potato", "patate douce", "viazi"] },

    // Grains
    { key: "MAIZE", emoji: "🌽", en: "Maize", fr: "Maïs", perishable: false, unit: "BAG", category: "GRAINS", aliases: ["corn", "mais", "maïs", "mahindi"] },
    { key: "RICE", emoji: "🌾", en: "Rice", fr: "Riz", perishable: false, unit: "BAG", category: "GRAINS", aliases: ["riz", "paddy", "ofada", "local rice"] },
    { key: "SORGHUM", emoji: "🌾", en: "Sorghum", fr: "Sorgho", perishable: false, unit: "BAG", category: "GRAINS", aliases: ["sorgho", "guinea corn", "mtama", "mil rouge"] },
    { key: "MILLET", emoji: "🌾", en: "Millet", fr: "Mil", perishable: false, unit: "BAG", category: "GRAINS", aliases: ["mil", "petit mil", "mawele", "souna"] },
    { key: "FONIO", emoji: "🌾", en: "Fonio", fr: "Fonio", perishable: false, unit: "BAG", category: "GRAINS", aliases: ["acha", "fonio"] },
    { key: "WHEAT", emoji: "🌾", en: "Wheat", fr: "Blé", perishable: false, unit: "BAG", category: "GRAINS", aliases: ["ble", "blé", "atta"] },

    // Beans, nuts and seeds
    { key: "BEANS", emoji: "🫘", en: "Beans", fr: "Haricots", perishable: false, unit: "BAG", category: "LEGUMES", aliases: ["haricot", "niebe", "niébé", "cowpea", "black-eyed", "beans", "maharagwe"] },
    { key: "GROUNDNUTS", emoji: "🥜", en: "Groundnuts", fr: "Arachides", perishable: false, unit: "BAG", category: "LEGUMES", aliases: ["peanut", "peanuts", "arachide", "groundnut", "karanga"] },
    { key: "SOYBEANS", emoji: "🫘", en: "Soybeans", fr: "Soja", perishable: false, unit: "BAG", category: "LEGUMES", aliases: ["soya", "soy", "soja"] },
    { key: "EGUSI", emoji: "🌰", en: "Egusi", fr: "Pistache (egusi)", perishable: false, unit: "BASIN", category: "LEGUMES", aliases: ["pistache", "melon seeds", "agushi", "egusi"] },
    { key: "SESAME", emoji: "🌰", en: "Sesame", fr: "Sésame", perishable: false, unit: "BAG", category: "LEGUMES", aliases: ["sesame", "sésame", "benniseed", "simsim"] },
    { key: "CASHEW", emoji: "🌰", en: "Cashew nuts", fr: "Noix de cajou", perishable: false, unit: "BAG", category: "CASH_CROPS", aliases: ["cashew", "cajou", "anacarde"] },
    { key: "KOLA", emoji: "🌰", en: "Kola nuts", fr: "Noix de kola", perishable: false, unit: "BAG", category: "CASH_CROPS", aliases: ["kola", "cola", "goro", "bitter kola"] },

    // Oils and processed
    { key: "PALM_OIL", emoji: "🫗", en: "Palm oil", fr: "Huile de palme", perishable: false, unit: "LITRE", category: "OILS", aliases: ["huile rouge", "red oil", "palm oil", "zomi"] },
    { key: "SHEA_BUTTER", emoji: "🧈", en: "Shea butter", fr: "Beurre de karité", perishable: false, unit: "KG", category: "OILS", aliases: ["karite", "karité", "shea", "nkuto"] },
    { key: "GARI", emoji: "🥣", en: "Gari", fr: "Gari", perishable: false, unit: "BAG", category: "OILS", aliases: ["gari", "garri", "tapioca", "attieke", "attiéké", "couscous de manioc"] },
    { key: "CASSAVA_FLOUR", emoji: "🥣", en: "Cassava flour (fufu)", fr: "Farine de manioc (couscous)", perishable: false, unit: "BAG", category: "OILS", aliases: ["fufu", "foufou", "couscous", "lafun", "ugali", "farine de manioc", "kpokpo"] },
    { key: "HONEY", emoji: "🍯", en: "Honey", fr: "Miel", perishable: false, unit: "LITRE", category: "OILS", aliases: ["miel", "honey"] },

    // Cash crops
    { key: "COCOA", emoji: "🍫", en: "Cocoa beans", fr: "Fèves de cacao", perishable: false, unit: "BAG", category: "CASH_CROPS", aliases: ["cacao", "cocoa", "cocoa beans"] },
    { key: "COFFEE", emoji: "☕", en: "Coffee beans", fr: "Café", perishable: false, unit: "BAG", category: "CASH_CROPS", aliases: ["cafe", "café", "arabica", "robusta"] },

    // Livestock, eggs and fish
    { key: "EGGS", emoji: "🥚", en: "Eggs", fr: "Œufs", perishable: true, unit: "TRAY", category: "LIVESTOCK", aliases: ["egg", "oeufs", "œufs", "oeuf", "crates of eggs"] },
    { key: "CHICKENS", emoji: "🐔", en: "Chickens", fr: "Poulets", perishable: true, unit: "PIECE", category: "LIVESTOCK", aliases: ["chicken", "poulet", "poule", "broilers", "layers", "kuku"] },
    { key: "GOATS", emoji: "🐐", en: "Goats & sheep", fr: "Chèvres & moutons", perishable: true, unit: "PIECE", category: "LIVESTOCK", aliases: ["goat", "chevre", "chèvre", "sheep", "mouton", "ram", "belier", "bélier", "tabaski"] },
    { key: "PIGS", emoji: "🐖", en: "Pigs", fr: "Porcs", perishable: true, unit: "PIECE", category: "LIVESTOCK", aliases: ["pig", "porc", "cochon"] },
    { key: "FISH", emoji: "🐟", en: "Fish (fresh, smoked, dried)", fr: "Poisson (frais, fumé, séché)", perishable: true, unit: "KG", category: "LIVESTOCK", aliases: ["poisson", "fish", "tilapia", "catfish", "silure", "maquereau", "kpanla", "bonga", "smoked fish", "poisson fumé"] },

    { key: "OTHER", emoji: "🧺", en: "Other produce", fr: "Autre produit", perishable: false, unit: "KG", category: null, aliases: [] },
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

export function findCategory(key) {
    return CATEGORIES.find((category) => category.key === key) || null;
}

function plain(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

/*
 * Product keys a search matches, using English and French
 * names and local names: "bobolo" → CASSAVA,
 * "garden egg" → EGGPLANT, "pili pili" → PEPPER.
 */
export function matchProducts(query) {
    const needle = plain(query);

    if (needle.length < 2) {
        return [];
    }

    return PRODUCTS.filter((product) => {
        const names = [product.en, product.fr, ...(product.aliases || [])].map(plain);

        return names.some(
            (name) =>
                name.includes(needle) ||
                (needle.length >= 4 && name.length >= 4 && needle.includes(name))
        );
    }).map((product) => product.key);
}

/*
 * True when a listing matches a free-text search: its product
 * (by any name), the farmer's own name for it, its details,
 * village or city.
 */
export function listingMatches(listing, query) {
    const needle = plain(query);

    if (!needle) {
        return true;
    }

    if (matchProducts(needle).includes(listing.product)) {
        return true;
    }

    return [listing.custom_name, listing.details, listing.area, listing.city]
        .map(plain)
        .some((text) => text && text.includes(needle));
}
