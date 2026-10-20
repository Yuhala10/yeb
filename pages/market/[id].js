import Link from "next/link";

import OrderPanel from "../../components/Market/OrderPanel";
import ProductCard from "../../components/Market/ProductCard";
import Avatar from "../../components/Market/Avatar";
import FollowButton from "../../components/Market/FollowButton";
import ListingSocial from "../../components/Market/ListingSocial";
import PhotoCarousel from "../../components/Site/PhotoCarousel";
import Seo from "../../components/Site/Seo";
import ShareSheet from "../../components/Site/ShareSheet";
import SiteFooter from "../../components/Site/SiteFooter";
import SiteHeader from "../../components/Site/SiteHeader";
import Icon from "../../components/Site/Icon";
import { countryName, findCountry } from "../../lib/countries";
import { useLanguage } from "../../lib/LanguageContext";
import { formatDay, marketText, useMarketText } from "../../lib/marketText";
import { formatMoney } from "../../lib/money";
import { findCategory, findProduct, formatAmount, productName, unitName } from "../../lib/produce";
import { listingCardUrl, localizedUrl, siteOrigin } from "../../lib/seo";
import { listingShareText } from "../../lib/shareLoad";
import { getListing } from "../../lib/server/market";
import { useSession } from "../../lib/useSession";

/*
 * ============================================================
 * TAYEB MARCHÉ — ONE LISTING
 * ============================================================
 *
 * Server-rendered for search engines and link previews (with
 * every photo). Never shows the farmer's phone: it's shared
 * with the buyer once the farmer confirms.
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

    res.setHeader("Cache-Control", "public, s-maxage=20, stale-while-revalidate=120");

    return {
        props: {
            listing,
            origin: siteOrigin(req),
        },
    };
}

function FarmAvatarLink({ farmer }) {
    const avatar = <Avatar person={farmer} size={46} ring />;

    return farmer.handle ? <Link href={`/farm/${farmer.handle}`} aria-label={farmer.farm_name || farmer.full_name}>{avatar}</Link> : avatar;
}

export default function ListingPage({ listing, origin }) {
    const { language } = useLanguage();

    const m = useMarketText();

    const { user, loading } = useSession();

    const name = productName(listing, language);

    const unitOne = unitName(listing.unit, language);

    const farmer = listing.farmer;

    const country = findCountry(listing.country);

    const category = findCategory(findProduct(listing.product)?.category);

    const price = formatMoney(listing.price_per_unit, listing.currency);

    const path = `/market/${listing.id}`;

    const url = localizedUrl(origin, path, language);

    const place = `${listing.area ? `${listing.area}, ` : ""}${listing.city}${country ? `, ${countryName(country.code, language)}` : ""}`;

    const seoTitle = `${name} — ${listing.city} · ${price} / ${unitOne} | Tayeb Marché`;

    const seoDescription = [
        marketText(language, "listingSeo", { product: name, city: place, price, unit: unitOne }),
        listing.details ? listing.details.slice(0, 140) : "",
    ].filter(Boolean).join(" ");

    const images = (listing.photos || []).map((photo) => photo.url);

    const structuredData = [
        {
            "@context": "https://schema.org",
            "@type": "Product",
            name,
            description: listing.details || seoDescription,
            image: images.length ? images : [`${origin}/branding/tayeb-logo.jpeg`],
            category: category ? category.en : "Agriculture",
            sku: listing.id,
            brand: { "@type": "Brand", name: "Tayeb Marché" },
            offers: {
                "@type": "Offer",
                url,
                price: listing.price_per_unit,
                priceCurrency: listing.currency,
                availability: listing.visible ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                itemCondition: "https://schema.org/NewCondition",
                areaServed: listing.country,
                eligibleQuantity: {
                    "@type": "QuantitativeValue",
                    minValue: Number(listing.min_order) || 1,
                    maxValue: Number(listing.quantity_available) || 0,
                    unitText: unitName(listing.unit, "en"),
                },
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
                        bestRating: 5,
                    },
                }
                : {}),
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                { "@type": "ListItem", position: 1, name: "Tayeb", item: localizedUrl(origin, "/", language) },
                { "@type": "ListItem", position: 2, name: "Marché", item: localizedUrl(origin, "/market", language) },
                ...(category
                    ? [{ "@type": "ListItem", position: 3, name: language === "fr" ? category.fr : category.en, item: localizedUrl(origin, `/market?category=${category.key}`, language) }]
                    : []),
                { "@type": "ListItem", position: category ? 4 : 3, name, item: url },
            ],
        },
    ];

    const priceStats = listing.price_stats;

    const shareText = listingShareText(listing, language);

    return (
        <>
            <Seo
                origin={origin}
                path={path}
                title={seoTitle}
                description={seoDescription}
                image={listingCardUrl(origin, listing, language)}
                imageAlt={`${name} · ${place} · ${price} / ${unitOne}`}
                type="product"
                noindex={!listing.visible}
                structuredData={structuredData}
                extra={
                    <>
                        <meta property="product:price:amount" content={String(listing.price_per_unit)} />
                        <meta property="product:price:currency" content={listing.currency} />
                    </>
                }
            />

            <div className="ts-page mk-page mk-has-mobile-cta">

                <SiteHeader user={user} loading={loading} active="market" />

                <div className="ts-wrap">

                    <ol className="mk-crumbs">
                        <li><Link href="/">Tayeb</Link></li>
                        <li><Link href="/market">{m("market")}</Link></li>
                        {category && (
                            <li>
                                <Link href={`/market?category=${category.key}`}>
                                    {language === "fr" ? category.fr : category.en}
                                </Link>
                            </li>
                        )}
                        <li aria-current="page">{name}</li>
                    </ol>

                    <div className="mk-detail">

                        {/* =========================================
                            PRODUCT
                        ========================================= */}

                        <article>

                            <PhotoCarousel photos={listing.photos || []} alt={name}>
                                <div className="mk-media-badges" style={{ zIndex: 3 }}>
                                    {listing.ready_now ? (
                                        <span className="mk-tag mk-tag-green"><Icon name="check" /> {m("readyNow")}</span>
                                    ) : (
                                        <span className="mk-tag">
                                            <Icon name="calendar" /> {m("readyOn", { date: formatDay(listing.available_from, language) })}
                                        </span>
                                    )}
                                    {listing.perishable && (
                                        <span className="mk-tag mk-tag-amber"><Icon name="snowflake" /> {m("fresh")}</span>
                                    )}
                                </div>
                            </PhotoCarousel>

                            <h1>{name}</h1>

                            <div className="mk-card-meta" style={{ marginTop: 8, fontSize: 15 }}>
                                <Icon name="pin" /> {place} {country?.flag}
                            </div>

                            <div className="mk-facts">

                                <div className="mk-fact">
                                    <small>{m("perUnit", { unit: unitOne })}</small>
                                    <strong>{price}</strong>
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
                                    <Icon name="chart" /> {m("marketPrice", {
                                        low: formatMoney(priceStats.low, listing.currency),
                                        high: formatMoney(priceStats.high, listing.currency),
                                        unit: unitOne,
                                        count: priceStats.count,
                                    })}
                                </div>
                            )}

                            <ListingSocial listing={listing} user={user} />

                            {farmer && (
                                <div className="mk-farmer">

                                    <FarmAvatarLink farmer={farmer} />

                                    <div style={{ minWidth: 0, flex: "1 1 180px" }}>
                                        <strong style={{ display: "block", color: "var(--mk-ink)", fontSize: 15 }}>
                                            {farmer.handle ? (
                                                <Link href={`/farm/${farmer.handle}`} style={{ color: "inherit", textDecoration: "none" }}>
                                                    {farmer.farm_name || farmer.full_name}
                                                </Link>
                                            ) : (
                                                farmer.farm_name || farmer.full_name
                                            )}
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

                                    <FollowButton farmer={farmer} user={user} />

                                </div>
                            )}

                            <div style={{ marginTop: 16 }}>
                                <ShareSheet url={url} title={name} text={shareText} className="ts-btn ts-btn-light" />
                            </div>

                        </article>


                        {/* =========================================
                            ORDER
                        ========================================= */}

                        <OrderPanel listing={listing} user={user} loading={loading} />

                    </div>


                    {/* =============================================
                        MORE LIKE THIS
                    ============================================= */}

                    {listing.related?.length > 0 && (
                        <section style={{ paddingBottom: 60 }}>
                            <div className="mk-section-head">
                                <h2>
                                    {language === "fr" ? "Autres offres de " : "More "}
                                    {productName(listing, language).toLowerCase()}
                                </h2>
                                <Link href={`/market?product=${listing.product}&country=${listing.country}`} className="ts-link">
                                    {language === "fr" ? "Tout voir" : "See all"} →
                                </Link>
                            </div>
                            <div className="mk-grid">
                                {listing.related.map((item) => (
                                    <ProductCard key={item.id} listing={item} />
                                ))}
                            </div>
                        </section>
                    )}

                </div>


                {/* Phones: price and a shortcut to the order form. */}

                {listing.visible && (
                    <div className="mk-mobile-cta">
                        <div className="mk-price" style={{ fontSize: 18 }}>
                            {price} <small>/ {unitOne}</small>
                        </div>
                        <a href="#order" className="ts-btn ts-btn-primary ts-btn-sm">
                            <Icon name="cart" /> {m("orderTitle")}
                        </a>
                    </div>
                )}

                <SiteFooter />

            </div>
        </>
    );
}
