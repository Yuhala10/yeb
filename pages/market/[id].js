import Head from "next/head";
import Link from "next/link";

import MarketHeader from "../../components/Market/MarketHeader";
import OrderPanel from "../../components/Market/OrderPanel";
import ProductMedia from "../../components/Market/ProductMedia";
import { useLanguage } from "../../lib/LanguageContext";
import { formatDay, marketText, useMarketText } from "../../lib/marketText";
import { formatAmount, productName, unitName } from "../../lib/produce";
import { getListing } from "../../lib/server/market";
import { shareListingOnWhatsApp } from "../../lib/shareLoad";
import { useSession } from "../../lib/useSession";

/*
 * ============================================================
 * TAYEB MARCHÉ — ONE LISTING
 * ============================================================
 *
 * Server-rendered for search engines and WhatsApp previews
 * (with the product photo). Never shows the farmer's phone:
 * it's shared with the buyer once the farmer confirms.
 */

export async function getServerSideProps({ params, req, res }) {
    let listing = null;

    try {
        listing = await getListing(params.id);
    } catch (error) {
        if (error?.status !== 404 && error?.code !== "MARKET_NOT_READY" && error?.code !== "22P02") {
            console.error("Listing page error:", error);
        }
    }

    if (!listing) {
        return { notFound: true };
    }

    const protocol = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
    const host = req.headers["x-forwarded-host"] || req.headers.host;

    res.setHeader("Cache-Control", "public, s-maxage=20, stale-while-revalidate=120");

    return {
        props: {
            listing,
            siteUrl: `${protocol}://${host}`,
        },
    };
}

export default function ListingPage({ listing, siteUrl }) {
    const { language } = useLanguage();

    const m = useMarketText();

    const { user, loading } = useSession();

    const name = productName(listing, language);

    const unitOne = unitName(listing.unit, language);

    const farmer = listing.farmer;

    const url = `${siteUrl}/market/${listing.id}`;

    const place = `${listing.area ? `${listing.area}, ` : ""}${listing.city}`;

    const seoName = `${productName(listing, "fr")} · ${productName(listing, "en")}`;

    const seoTitle = `${seoName} — ${listing.city} · ${formatAmount(listing.price_per_unit)} FCFA | Tayeb Marché`;

    const seoDescription = [
        marketText("fr", "listingSeo", {
            product: productName(listing, "fr"),
            city: place,
            price: formatAmount(listing.price_per_unit),
            unit: unitName(listing.unit, "fr"),
        }),
        marketText("en", "listingSeo", {
            product: productName(listing, "en"),
            city: place,
            price: formatAmount(listing.price_per_unit),
            unit: unitName(listing.unit, "en"),
        }),
    ].join(" ");

    const image = listing.photo_url || `${siteUrl}/branding/tayeb-logo.jpeg`;

    const structuredData = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: seoName,
        description: listing.details || seoDescription,
        image: [image],
        category: "Agriculture",
        offers: {
            "@type": "Offer",
            url,
            price: listing.price_per_unit,
            priceCurrency: "XAF",
            availability: listing.visible ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
            areaServed: "CM",
            seller: {
                "@type": "Person",
                name: farmer?.full_name || "Tayeb farmer",
            },
        },
        ...(farmer?.rating_count
            ? {
                aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: farmer.rating,
                    reviewCount: farmer.rating_count,
                },
            }
            : {}),
    };

    const priceStats = listing.price_stats;

    return (
        <>
            <Head>
                <title>{seoTitle}</title>
                <meta name="description" content={seoDescription} />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="theme-color" content="#f97316" />
                <link rel="canonical" href={url} />
                <meta property="og:type" content="product" />
                <meta property="og:site_name" content="Tayeb Marché" />
                <meta property="og:title" content={`${productName(listing, "fr")} · ${formatAmount(listing.price_per_unit)} FCFA / ${unitName(listing.unit, "fr")} — ${listing.city}`} />
                <meta property="og:description" content={seoDescription} />
                <meta property="og:url" content={url} />
                <meta property="og:image" content={image} />
                <meta property="og:locale" content="fr_CM" />
                <meta property="og:locale:alternate" content="en_CM" />
                <meta property="product:price:amount" content={String(listing.price_per_unit)} />
                <meta property="product:price:currency" content="XAF" />
                <meta name="twitter:card" content={listing.photo_url ? "summary_large_image" : "summary"} />
                {!listing.visible && <meta name="robots" content="noindex" />}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
                />
            </Head>

            <main className="mk-page mk-has-mobile-cta">

                <MarketHeader user={user} loading={loading} />

                <div className="mk-wrap">

                    <Link href="/market" className="mk-crumb">
                        ← {m("backToMarket")}
                    </Link>

                    <div className="mk-detail">

                        {/* =========================================
                            PRODUCT
                        ========================================= */}

                        <article>

                            <div className="mk-gallery">
                                <ProductMedia listing={listing} eager>
                                    <div className="mk-media-badges">
                                        {listing.ready_now ? (
                                            <span className="mk-tag mk-tag-green">✓ {m("readyNow")}</span>
                                        ) : (
                                            <span className="mk-tag">
                                                🗓️ {m("readyOn", { date: formatDay(listing.available_from, language) })}
                                            </span>
                                        )}
                                        {listing.perishable && (
                                            <span className="mk-tag mk-tag-amber">❄️ {m("fresh")}</span>
                                        )}
                                    </div>
                                </ProductMedia>
                            </div>

                            <h1>{name}</h1>

                            <div className="mk-card-meta" style={{ marginTop: 8, fontSize: 15 }}>
                                📍 {place}
                            </div>

                            <div className="mk-facts">

                                <div className="mk-fact">
                                    <small>{m("perUnit", { unit: unitOne })}</small>
                                    <strong>{formatAmount(listing.price_per_unit)} FCFA</strong>
                                </div>

                                <div className="mk-fact">
                                    <small>{m("quantity")}</small>
                                    <strong>
                                        {formatAmount(listing.quantity_available)}{" "}
                                        {unitName(listing.unit, language, listing.quantity_available)}
                                    </strong>
                                </div>

                                {Number(listing.min_order) > 1 && (
                                    <div className="mk-fact">
                                        <small>Min.</small>
                                        <strong>
                                            {formatAmount(listing.min_order)}{" "}
                                            {unitName(listing.unit, language, listing.min_order)}
                                        </strong>
                                    </div>
                                )}

                                {listing.unit_weight_kg > 0 && (
                                    <div className="mk-fact">
                                        <small>{m("weightLabel")}</small>
                                        <strong>{m("weightEach", { kg: formatAmount(listing.unit_weight_kg) })}</strong>
                                    </div>
                                )}

                                <div className="mk-fact">
                                    <small>{m("availableFrom")}</small>
                                    <strong>
                                        {listing.ready_now ? m("readyNow") : formatDay(listing.available_from, language)}
                                    </strong>
                                </div>

                                {listing.available_until && (
                                    <div className="mk-fact">
                                        <small>{m("availableUntil").replace(/\s*\(.*\)/, "")}</small>
                                        <strong>{formatDay(listing.available_until, language)}</strong>
                                    </div>
                                )}

                            </div>

                            {priceStats && (
                                <div className="mk-notice mk-notice-green" style={{ marginTop: 14 }}>
                                    📊 {m("marketPrice", {
                                        low: formatAmount(priceStats.low),
                                        high: formatAmount(priceStats.high),
                                        unit: unitOne,
                                        count: priceStats.count,
                                    })}
                                </div>
                            )}

                            {listing.details && (
                                <p className="mk-description">{listing.details}</p>
                            )}

                            {farmer && (
                                <div className="mk-farmer">

                                    <div className="mk-avatar" aria-hidden="true">
                                        {String(farmer.full_name || "F").charAt(0).toUpperCase()}
                                    </div>

                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <strong style={{ display: "block", color: "var(--mk-ink)", fontSize: 15 }}>
                                            {farmer.full_name}
                                        </strong>
                                        <span className="mk-card-meta">
                                            {m("farmIn", { city: farmer.base_city || listing.city })}
                                            {" · "}
                                            {farmer.completed_sales === 1
                                                ? m("oneSale")
                                                : m("sales", { count: farmer.completed_sales || 0 })}
                                            {farmer.member_since && ` · ${m("memberSince", { date: formatDay(farmer.member_since, language) })}`}
                                        </span>
                                    </div>

                                    <span className="mk-rating">
                                        {farmer.rating_count
                                            ? m("farmerRating", { rating: farmer.rating, count: farmer.rating_count })
                                            : m("newFarmer")}
                                    </span>

                                </div>
                            )}

                            <button
                                type="button"
                                className="mk-btn mk-btn-whatsapp"
                                style={{ marginTop: 16 }}
                                onClick={() => shareListingOnWhatsApp(listing, language)}
                            >
                                💬 {m("share")}
                            </button>

                        </article>


                        {/* =========================================
                            ORDER
                        ========================================= */}

                        <OrderPanel listing={listing} user={user} loading={loading} />

                    </div>

                </div>


                {/* Phones: price and a shortcut to the order form. */}

                {listing.visible && (
                    <div className="mk-mobile-cta">
                        <div className="mk-price" style={{ fontSize: 18 }}>
                            {formatAmount(listing.price_per_unit)} FCFA <small>/ {unitOne}</small>
                        </div>
                        <a href="#order" className="mk-btn mk-btn-primary">
                            🛒 {m("orderTitle")}
                        </a>
                    </div>
                )}

                <footer className="mk-footer">
                    <strong>Tayeb Marché</strong> · {m("tagline")} · <Link href="/market">{m("market")}</Link>
                </footer>

            </main>
        </>
    );
}
