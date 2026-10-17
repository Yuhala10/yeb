/*
 * ============================================================
 * WHATSAPP SHARING
 * ============================================================
 *
 * Shippers share their loads in WhatsApp groups and drivers
 * invite shippers they know. Every shared link brings new
 * people to Tayeb.
 */

function formatPrice(value) {
    const number =
        Number(value);

    if (
        !Number.isFinite(number)
    ) {
        return "0";
    }

    return number.toLocaleString(
        "en-US"
    );
}

function openWhatsApp(message) {
    window.open(
        `https://wa.me/?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer"
    );
}

/*
 * Public page for one load. It never shows phone numbers.
 */
export function getLoadUrl(shipmentId) {
    return `${window.location.origin}/load/${shipmentId}`;
}

export function shareLoadOnWhatsApp(
    shipment,
    language
) {
    const isFrench =
        language === "fr";

    const lines = isFrench
        ? [
            "📦 Marchandise à transporter sur Tayeb",
            `🚚 ${shipment.origin} → ${shipment.destination}`,
            `Marchandise : ${shipment.item_type} · Quantité : ${shipment.quantity}`,
            `Offre : ${formatPrice(shipment.initial_offer)} FCFA`,
            "",
            "Chauffeurs, proposez votre prix ici :",
            getLoadUrl(shipment.id),
        ]
        : [
            "📦 Load available on Tayeb",
            `🚚 ${shipment.origin} → ${shipment.destination}`,
            `Cargo: ${shipment.item_type} · Quantity: ${shipment.quantity}`,
            `Offer: ${formatPrice(shipment.initial_offer)} FCFA`,
            "",
            "Drivers, send your price here:",
            getLoadUrl(shipment.id),
        ];

    openWhatsApp(
        lines.join("\n")
    );
}

export function inviteShippersOnWhatsApp(
    language
) {
    const isFrench =
        language === "fr";

    const message = isFrench
        ? `Vous avez des marchandises à envoyer ? Publiez-les gratuitement sur Tayeb et recevez les prix des chauffeurs :\n${window.location.origin}`
        : `Have goods to send? Post them for free on Tayeb and get prices from drivers:\n${window.location.origin}`;

    openWhatsApp(message);
}
