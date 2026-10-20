/*
 * Kinds of goods a shipper can pick. The English value is
 * what's saved (item_type); people see their own language.
 * Anything else is free text, shown as typed.
 */
export const CARGO_TYPES = [
    { value: "Parcel", icon: "package", en: "Parcel", fr: "Colis" },
    { value: "Bags/Sacks", icon: "bag", en: "Bags / sacks", fr: "Sacs" },
    { value: "Food/Produce", icon: "basket", en: "Food / produce", fr: "Vivres / produits frais" },
    { value: "Crates/Boxes", icon: "crate", en: "Crates / boxes", fr: "Caisses / cartons" },
    { value: "Drums/Oil", icon: "drum", en: "Drums / oil", fr: "Fûts / huile" },
    { value: "Building materials", icon: "bricks", en: "Building materials", fr: "Matériaux de construction" },
    { value: "Furniture/Bulky", icon: "sofa", en: "Furniture / bulky", fr: "Meubles / volumineux" },
    { value: "Livestock", icon: "paw", en: "Livestock", fr: "Bétail" },
];

export function cargoType(value) {
    return CARGO_TYPES.find((item) => item.value === value) || null;
}

export function cargoLabel(value, language) {
    const type = cargoType(value);

    if (!type) {
        return String(value || "").replace(/^[^\p{L}\p{N}]+/u, "");
    }

    return language === "fr" ? type.fr : type.en;
}

// The line icon (components/Site/Icon) for a kind of goods.
export function cargoIcon(value, isProduce) {
    if (isProduce) {
        return "sprout";
    }

    return cargoType(value)?.icon || "package";
}

