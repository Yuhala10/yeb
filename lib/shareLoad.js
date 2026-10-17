/*
 * ============================================================
 * WHATSAPP SHARING
 * ============================================================
 *
 * Farmers share their products, shippers share their loads,
 * drivers invite shippers. Every shared link brings new
 * people to Tayeb, so each message reads like a small,
 * clean post: *bold* where WhatsApp shows it bold, one fact
 * per line, the link last (WhatsApp draws its preview card
 * from it, see pages/api/og.js).
 */

import { cityRoadKm, resolveCity } from "./cities";
import { countryName, todayIn } from "./countries";
import { formatDay } from "./marketText";
import { formatMoney } from "./money";
import { formatAmount, productName, unitName } from "./produce";

function openWhatsApp(message) {
    window.open(
        `https://wa.me/?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer"
    );
}

function siteUrl(path, language) {
    if (language === "en") {
        return `${window.location.origin}/en${path === "/" ? "" : path}`;
    }

    return `${window.location.origin}${path}`;
}

/*
 * Public page for one load. It never shows phone numbers.
 */
export function getLoadUrl(shipmentId, language) {
    return siteUrl(`/load/${shipmentId}`, language);
}

export function getListingUrl(listingId, language) {
    return siteUrl(`/market/${listingId}`, language);
}

/* =========================================================
   MESSAGES (without the link; it goes on the last line)
========================================================= */

export function loadShareText(shipment, language) {
    const fr = language === "fr";

    const from = resolveCity(shipment.origin_city, shipment.origin);
    const to = resolveCity(shipment.destination_city, shipment.destination);

    const km = shipment.route_km || (from && to ? cityRoadKm(from, to) : null);

    const cargo = [
        `${shipment.quantity} × ${shipment.item_type}`,
        Number(shipment.weight_kg) > 0 ? `~${formatAmount(shipment.weight_kg)} kg` : null,
        km > 0 ? `~${formatAmount(km)} km` : null,
    ].filter(Boolean).join(" · ");

    const price = formatMoney(shipment.initial_offer, shipment.currency);

    return [
        `🚚 *${shipment.origin} → ${shipment.destination}*`,
        `📦 ${cargo}`,
        fr ? `💰 Offre : *${price}*` : `💰 Offer: *${price}*`,
        shipment.perishable ? (fr ? "❄️ Produit frais, à livrer vite" : "❄️ Fresh produce, deliver fast") : null,
        "",
        fr ? "👉 Chauffeurs, envoyez votre prix sur *Tayeb* :" : "👉 Drivers, send your price on *Tayeb*:",
    ].filter((line) => line !== null).join("\n");
}

export function listingShareText(listing, language) {
    const fr = language === "fr";

    const quantity = Number(listing.quantity_available) || 0;

    const place = [
        listing.area,
        listing.city,
    ].filter(Boolean).join(", ");

    const country = listing.country ? ` · ${countryName(listing.country, language)}` : "";

    // Farmer dashboard rows don't carry ready_now: work it out.
    const readyNow = listing.ready_now ?? (!listing.available_from || listing.available_from <= todayIn(listing.country || "CM"));

    const ready = readyNow
        ? `✅ ${fr ? "Prêt maintenant" : "Ready now"}`
        : `🗓️ ${fr ? "Prêt le" : "Ready"} ${formatDay(listing.available_from, language)}`;

    const farmer = listing.farmer;

    const rating = farmer?.rating_count > 0
        ? fr
            ? `⭐ Producteur noté ${String(Number(farmer.rating).toFixed(1)).replace(".", ",")}/5 (${farmer.rating_count} avis)`
            : `⭐ Farmer rated ${Number(farmer.rating).toFixed(1)}/5 (${farmer.rating_count} review${farmer.rating_count === 1 ? "" : "s"})`
        : null;

    return [
        `🌾 *${productName(listing, language)}* · Tayeb Marché`,
        `📍 ${place}${country}`,
        `💰 *${formatMoney(listing.price_per_unit, listing.currency)}* / ${unitName(listing.unit, language)}`,
        `📦 ${formatAmount(quantity)} ${unitName(listing.unit, language, quantity)} ${fr ? (quantity === 1 ? "disponible" : "disponibles") : "available"} · ${ready}`,
        listing.perishable ? (fr ? "🌿 Récolte fraîche" : "🌿 Fresh harvest") : null,
        rating,
        fr ? "🚚 Livraison Tayeb jusqu'à vous" : "🚚 Tayeb delivers to your door",
        "",
        fr ? "👉 Commandez ici :" : "👉 Order here:",
    ].filter((line) => line !== null).join("\n");
}

/* =========================================================
   SHARE BUTTONS
========================================================= */

export function shareLoadOnWhatsApp(shipment, language) {
    openWhatsApp(`${loadShareText(shipment, language)}\n${getLoadUrl(shipment.id, language)}`);
}

export function shareListingOnWhatsApp(listing, language) {
    openWhatsApp(`${listingShareText(listing, language)}\n${getListingUrl(listing.id, language)}`);
}

export function inviteShippersOnWhatsApp(language) {
    const message = language === "fr"
        ? [
            "📦 *Des marchandises à envoyer ?*",
            "Publiez-les gratuitement sur *Tayeb* et recevez les prix des chauffeurs en quelques minutes.",
            "",
            `👉 ${siteUrl("/", "fr")}`,
        ]
        : [
            "📦 *Have goods to send?*",
            "Post them for free on *Tayeb* and get prices from drivers within minutes.",
            "",
            `👉 ${siteUrl("/", "en")}`,
        ];

    openWhatsApp(message.join("\n"));
}
