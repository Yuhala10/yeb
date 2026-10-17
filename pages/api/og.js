import { cargoLabel } from "../../lib/cargo";
import { cityRoadKm, resolveCity } from "../../lib/cities";
import { COUNTRIES, countryName, countryOrDefault, todayIn } from "../../lib/countries";
import { FOUNDER } from "../../lib/founder";
import { formatDay } from "../../lib/marketText";
import { formatMoney } from "../../lib/money";
import { formatAmount, productName, unitName } from "../../lib/produce";
import {
    SITE_CARD_VERSION,
    cardImageUrl,
    listingCardVersion,
    loadCardVersion,
    siteOrigin,
} from "../../lib/seo";
import { db, upgraded } from "../../lib/server/core";
import { clip, photoForCard, renderCard } from "../../lib/server/og";

/*
 * ============================================================
 * GET /api/og?type=listing|load|site&id=…&page=…&lang=fr|en&v=…
 * ============================================================
 *
 * The image WhatsApp, Facebook and others show under a shared
 * link. Public and read-only: it shows what the public page
 * already shows (never phone numbers).
 *
 * v is the card version (lib/seo.js). A wrong one is sent to
 * the current one, so no one can make the server draw the
 * same card over and over with made-up versions.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SITE_PAGES = ["home", "market", "about"];

const LONG_CACHE = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800";

const SHORT_CACHE = "public, max-age=300, s-maxage=300";

// Recently drawn cards, per server: a viral link costs one drawing.
const drawn = new Map();

const MAX_DRAWN = 60;

function remember(key, image) {
    drawn.set(key, image);

    if (drawn.size > MAX_DRAWN) {
        drawn.delete(drawn.keys().next().value);
    }
}

function words(language) {
    const fr = language === "fr";

    return {
        fr,
        perUnit: (unit) => (fr ? `PRIX PAR ${unit}` : `PRICE PER ${unit}`).toUpperCase(),
        available: (count) => (fr ? (Number(count) === 1 ? "disponible" : "disponibles") : "available"),
        ready: fr ? "Prêt maintenant" : "Ready now",
        readyOn: (date) => (fr ? `Prêt le ${date}` : `Ready ${date}`),
        soldOut: fr ? "Épuisé" : "Sold out",
        fresh: fr ? "Produit frais" : "Fresh produce",
        delivery: fr ? "Livraison Tayeb" : "Tayeb delivery",
        newFarmer: fr ? "Nouveau producteur" : "New farmer",
        rating: (rating, count) =>
            fr
                ? `${String(rating).replace(".", ",")}/5 · ${count} avis`
                : `${rating}/5 · ${count} review${count === 1 ? "" : "s"}`,
        order: fr ? "Commander maintenant" : "Order now",
        browse: fr ? "Voir le marché" : "See the market",
        loadOpen: fr ? "Ouvert aux offres" : "Open for offers",
        loadClosed: fr ? "Plus disponible" : "No longer available",
        offer: fr ? "OFFRE DE L'EXPÉDITEUR" : "SHIPPER'S OFFER",
        sendPrice: fr ? "Envoyer mon prix" : "Send my price",
        otherLoads: fr ? "Voir d'autres chargements" : "See other loads",
    };
}

/* =========================================================
   CARDS
========================================================= */

async function listingCard(id, language, host) {
    const { data: listing } = await db.from("products").select("*").eq("id", id).maybeSingle();

    if (!listing || listing.status === "ARCHIVED") {
        return null;
    }

    const { data: farmer } = await db
        .from("users")
        .select("rating, rating_count")
        .eq("id", listing.farmer_id)
        .maybeSingle();

    const w = words(language);

    const country = countryOrDefault(listing.country);

    const currency = listing.currency || country.currency;

    const today = todayIn(country.code);

    const quantity = Number(listing.quantity_available) || 0;

    const onSale =
        listing.status === "ACTIVE" &&
        quantity > 0 &&
        (!listing.available_until || listing.available_until >= today);

    const readyNow = !listing.available_from || listing.available_from <= today;

    const photos = Array.isArray(listing.photos) ? listing.photos.filter((item) => item && item.url) : [];

    const cover = photos[0]?.url || listing.photo_url || null;

    const name = clip(productName(listing, language), 34);

    const stock = `${formatAmount(quantity)} ${unitName(listing.unit, language, quantity)} ${w.available(quantity)}`;

    const rating = farmer?.rating_count > 0 ? w.rating(Number(farmer.rating).toFixed(1).replace(/\.0$/, ""), farmer.rating_count) : w.newFarmer;

    return {
        version: listingCardVersion(listing),
        card: {
            name,
            letter: name.charAt(0).toUpperCase() || "T",
            place: clip(`${listing.city}, ${countryName(country.code, language)}`, 40),
            price: formatMoney(listing.price_per_unit, currency),
            priceLabel: clip(w.perUnit(unitName(listing.unit, language)), 34),
            meta: clip(onSale ? `${stock} · ${rating}` : rating, 46),
            ready: onSale ? (readyNow ? w.ready : w.readyOn(formatDay(listing.available_from, language))) : w.soldOut,
            readyTone: onSale ? "green" : "glass",
            fresh: listing.perishable ? w.fresh : null,
            delivery: w.delivery,
            cta: onSale ? w.order : w.browse,
            host,
            photo: await photoForCard(cover),
            photoCount: photos.length,
            photoCountLabel: `${photos.length} photos`,
        },
    };
}

async function loadCard(id, language, host) {
    const fields = ["id", "item_type", "origin", "destination", "origin_city", "destination_city", "quantity", "initial_offer", "status"];

    const extended = await upgraded();

    if (extended) {
        fields.push("currency", "weight_kg", "perishable");
    }

    const { data: shipment } = await db.from("shipments").select(fields.join(", ")).eq("id", id).maybeSingle();

    if (!shipment) {
        return null;
    }

    const w = words(language);

    const open = shipment.status === "OPEN";

    const from = resolveCity(shipment.origin_city, shipment.origin);
    const to = resolveCity(shipment.destination_city, shipment.destination);

    const km = from && to ? cityRoadKm(from, to) : null;

    return {
        version: loadCardVersion(shipment),
        card: {
            from: clip(shipment.origin_city || shipment.origin, 16),
            to: clip(shipment.destination_city || shipment.destination, 16),
            open,
            status: open ? w.loadOpen : w.loadClosed,
            cargo: clip(`${shipment.quantity} × ${cargoLabel(shipment.item_type, language)}`, 34),
            distance: km > 0 ? `~${formatAmount(km)} km` : null,
            weight: shipment.weight_kg > 0 ? `~${formatAmount(shipment.weight_kg)} kg` : null,
            fresh: shipment.perishable ? w.fresh : null,
            label: w.offer,
            price: formatMoney(shipment.initial_offer, shipment.currency),
            cta: open ? w.sendPrice : w.otherLoads,
            host,
        },
    };
}

function siteCard(page, language, host) {
    const fr = language === "fr";

    const countries = COUNTRIES.length;

    const school = "Polytech Yaoundé";

    const cards = {
        home: fr
            ? {
                eyebrow: "AFRIQUE",
                title: "Des fermes africaines",
                highlight: "à tous les marchés.",
                text: "Achetez aux producteurs, faites livrer par des chauffeurs notés. Publiez un chargement et recevez des prix en quelques minutes.",
                chips: [`${countries} pays`, "Gratuit", "FR · EN"],
                cta: "Ouvrir Tayeb",
            }
            : {
                eyebrow: "AFRICA",
                title: "From African farms",
                highlight: "to every market.",
                text: "Buy from farmers, get it delivered by rated drivers. Post a load and get prices in minutes.",
                chips: [`${countries} countries`, "Free", "EN · FR"],
                cta: "Open Tayeb",
            },
        market: fr
            ? {
                eyebrow: "MARCHÉ",
                title: "Frais de la ferme,",
                highlight: "livré chez vous.",
                text: "Tomates, plantain, manioc, cacao et bien plus, au prix des producteurs et dans votre monnaie.",
                chips: ["Direct producteurs", "Livraison Tayeb"],
                cta: "Voir le marché",
            }
            : {
                eyebrow: "MARCHÉ",
                title: "Fresh from the farm,",
                highlight: "delivered to you.",
                text: "Tomatoes, plantain, cassava, cocoa and more, priced by farmers in your own currency.",
                chips: ["Direct from farmers", "Tayeb delivery"],
                cta: "Shop the market",
            },
        about: fr
            ? {
                eyebrow: "NOTRE HISTOIRE",
                title: "Bâtir l'infrastructure",
                highlight: "agricole de l'Afrique.",
                text: `Fondé par ${FOUNDER.name}, ingénieur de ${school}, pour relier fermes, acheteurs et chauffeurs sur tout le continent.`,
                chips: ["Né au Cameroun", "Pour l'Afrique"],
                cta: "Lire l'histoire",
            }
            : {
                eyebrow: "OUR STORY",
                title: "Building the rails of",
                highlight: "African agriculture.",
                text: `Founded by ${FOUNDER.name}, an engineer from ${school}, to connect farms, buyers and drivers across the continent.`,
                chips: ["Born in Cameroon", "Built for Africa"],
                cta: "Read the story",
            },
    };

    return { version: SITE_CARD_VERSION, card: { ...cards[page], host } };
}

/* =========================================================
   HANDLER
========================================================= */

function sendImage(res, image, cache) {
    res.setHeader("Content-Type", image.type);
    res.setHeader("Content-Length", image.body.length);
    res.setHeader("Cache-Control", cache);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.status(200).end(image.body);
}

export default async function handler(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        res.status(405).end();
        return;
    }

    const origin = siteOrigin(req);

    const host = new URL(origin).host.replace(/^www\./, "");

    const language = req.query.lang === "en" ? "en" : "fr";

    const type = String(req.query.type || "site");

    const id = String(req.query.id || "");

    const page = SITE_PAGES.includes(req.query.page) ? req.query.page : "home";

    let kind = "site";

    let result = null;

    try {
        if (type === "listing" && UUID.test(id)) {
            result = await listingCard(id.toLowerCase(), language, host);
            kind = "listing";
        } else if (type === "load" && UUID.test(id)) {
            result = await loadCard(id.toLowerCase(), language, host);
            kind = "load";
        }
    } catch (error) {
        console.error("Preview card data error:", error?.message);
        result = null;
    }

    // Unknown or removed: the brand card, cached briefly.
    let cache = LONG_CACHE;

    if (!result) {
        const fallbackPage = type === "listing" ? "market" : page;

        result = siteCard(type === "site" ? page : fallbackPage, language, host);

        if (type !== "site") {
            kind = "site";
            cache = SHORT_CACHE;
        }
    }

    if (kind !== "site" || type === "site") {
        if (req.query.v !== result.version) {
            const current = cardImageUrl("", { type: kind, id: kind === "site" ? null : id.toLowerCase(), page: kind === "site" ? page : null, language });

            res.setHeader("Cache-Control", SHORT_CACHE);
            res.redirect(307, `${current}&v=${result.version}`);
            return;
        }
    }

    const key = `${kind}|${id}|${page}|${language}|${result.version}|${host}`;

    try {
        let image = drawn.get(key);

        if (!image) {
            image = await renderCard(kind, result.card);
            remember(key, image);
        }

        sendImage(res, image, cache);
    } catch (error) {
        console.error("Preview card error:", error);

        res.setHeader("Cache-Control", "no-store");
        res.redirect(307, "/branding/tayeb-logo.jpeg");
    }
}
