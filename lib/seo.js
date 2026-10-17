/*
 * ============================================================
 * SEO HELPERS
 * ============================================================
 *
 * Every public page has a French address ("/…") and an
 * English one ("/en/…"). These build the absolute URLs for
 * canonical links, hreflang alternates and sitemaps.
 */

export function siteOrigin(req) {
    const protocol = String(req?.headers?.["x-forwarded-proto"] || "http").split(",")[0];

    const host = req?.headers?.["x-forwarded-host"] || req?.headers?.host || "localhost";

    return `${protocol}://${host}`;
}

/*
 * localizedUrl("https://tayeb.app", "/market?x=1", "en")
 *   → "https://tayeb.app/en/market?x=1"
 */
export function localizedUrl(origin, path, locale) {
    const clean = path.startsWith("/") ? path : `/${path}`;

    if (locale === "en") {
        return `${origin}/en${clean === "/" ? "" : clean}`;
    }

    return `${origin}${clean}`;
}

/*
 * <link rel="alternate"> entries for a page in both
 * languages, plus x-default (French).
 */
export function alternates(origin, path) {
    return [
        { hrefLang: "fr", href: localizedUrl(origin, path, "fr") },
        { hrefLang: "en", href: localizedUrl(origin, path, "en") },
        { hrefLang: "x-default", href: localizedUrl(origin, path, "fr") },
    ];
}

/*
 * Link preview cards (pages/api/og.js). The version changes
 * when what the card shows changes, so WhatsApp and Facebook
 * fetch a fresh image instead of an old cached one; any other
 * version is redirected to the current one.
 */
export const SITE_CARD_VERSION = "3";

export function listingCardVersion(listing) {
    const time = Date.parse(listing?.updated_at || listing?.created_at || "") || 0;

    return time.toString(36);
}

export function loadCardVersion(shipment) {
    return `${String(shipment?.status || "").toLowerCase()}${Math.round(Number(shipment?.initial_offer) || 0)}`;
}

export function cardImageUrl(origin, { type, id, page, language }) {
    const params = new URLSearchParams({ type });

    if (id) {
        params.set("id", id);
    }

    if (page) {
        params.set("page", page);
    }

    params.set("lang", language === "en" ? "en" : "fr");

    return `${origin}/api/og?${params.toString()}`;
}

export function listingCardUrl(origin, listing, language) {
    return `${cardImageUrl(origin, { type: "listing", id: listing.id, language })}&v=${listingCardVersion(listing)}`;
}

export function loadCardUrl(origin, shipment, language) {
    return `${cardImageUrl(origin, { type: "load", id: shipment.id, language })}&v=${loadCardVersion(shipment)}`;
}

export function siteCardUrl(origin, page, language) {
    return `${cardImageUrl(origin, { type: "site", page, language })}&v=${SITE_CARD_VERSION}`;
}

/*
 * Safe JSON-LD for a <script type="application/ld+json">.
 */
export function jsonLd(data) {
    return {
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
    };
}
