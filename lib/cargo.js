/*
 * Kinds of goods a shipper can pick. The English value is
 * what's saved (item_type); people see their own language.
 * Anything else is free text, shown as typed.
 */
export const CARGO_TYPES = [
    { value: "Bags/Sacks", emoji: "🛍️", en: "Bags / sacks", fr: "Sacs" },
    { value: "Food/Produce", emoji: "🥬", en: "Food / produce", fr: "Vivres / produits frais" },
    { value: "Crates/Boxes", emoji: "📦", en: "Crates / boxes", fr: "Caisses / cartons" },
    { value: "Drums/Oil", emoji: "🛢️", en: "Drums / oil", fr: "Fûts / huile" },
    { value: "Building materials", emoji: "🧱", en: "Building materials", fr: "Matériaux de construction" },
    { value: "Furniture/Bulky", emoji: "🛋️", en: "Furniture / bulky", fr: "Meubles / volumineux" },
    { value: "Livestock", emoji: "🐐", en: "Livestock", fr: "Bétail" },
];

export function cargoType(value) {
    return CARGO_TYPES.find((item) => item.value === value) || null;
}

export function cargoLabel(value, language) {
    const type = cargoType(value);

    if (!type) {
        return String(value || "");
    }

    return language === "fr" ? type.fr : type.en;
}

export function cargoEmoji(value, isProduce) {
    if (isProduce) {
        return "🌾";
    }

    return cargoType(value)?.emoji || "📦";
}
