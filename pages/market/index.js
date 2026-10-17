import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

import MarketHeader from "../../components/Market/MarketHeader";
import ProductCard from "../../components/Market/ProductCard";
import { CITY_NAMES, findCity } from "../../lib/cities";
import { useLanguage } from "../../lib/LanguageContext";
import { marketText, useMarketText } from "../../lib/marketText";
import { PRODUCTS, findProduct, productName } from "../../lib/produce";
import { listMarket, marketReady } from "../../lib/server/market";
import { DASHBOARDS, loginThenReturn, useSession } from "../../lib/useSession";

/*
 * ============================================================
 * TAYEB MARCHÉ — PUBLIC MARKET
 * ============================================================
 *
 * Server-rendered so search engines and WhatsApp see the
 * produce. Filters are plain links and a GET form
 * (/market?product=TOMATOES&city=Bafoussam), so every
 * filtered page has its own address.
 */

export async function getServerSideProps({ query, req, res }) {
    const product = findProduct(String(query.product || "")) ? String(query.product) : "";
    const city = findCity(String(query.city || ""))?.name || "";
    const q = String(query.q || "").slice(0, 60);

    const ready = await marketReady();

    let listings = [];
    let total = 0;

    if (ready) {
        try {
            const result = await listMarket({ product, city, q });
            listings = result.listings;
            total = result.total;
        } catch (error) {
            console.error("Market page error:", error);
        }
    }

    const protocol = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
    const host = req.headers["x-forwarded-host"] || req.headers.host;

    // Fresh enough for a market, light on the database.
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=300");

    return {
        props: {
            ready,
            listings,
            total,
            filters: { product, city, q },
            siteUrl: `${protocol}://${host}`,
        },
    };
}

function filterHref(filters, changes) {
    const next = { ...filters, ...changes };

    const params = new URLSearchParams();

    Object.entries(next).forEach(([key, value]) => {
        if (value) {
            params.set(key, value);
        }
    });

    const search = params.toString();

    return search ? `/market?${search}` : "/market";
}

export default function MarketPage({ ready, listings, total, filters, siteUrl }) {
    const router = useRouter();

    const { language } = useLanguage();

    const m = useMarketText();

    const { user, loading } = useSession();

    const hasFilters = Boolean(filters.product || filters.city || filters.q);

    const canonical = `${siteUrl}${filterHref(filters, {})}`;

    // Bilingual so search engines match both French and English searches.
    const seoTitle = filters.product
        ? `${findProduct(filters.product).fr} · ${findProduct(filters.product).en}${filters.city ? ` — ${filters.city}` : ""} | Tayeb Marché`
        : `${marketText("fr", "seoTitle")} | ${marketText("en", "brand")}`;

    const seoDescription = `${marketText("fr", "seoDescription")} ${marketText("en", "seoDescription")}`;

    const structuredData = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Tayeb Marché",
        itemListElement: listings.slice(0, 30).map((listing, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: `${siteUrl}/market/${listing.id}`,
            name: productName(listing, "fr"),
        })),
    };

    function sell() {
        if (user?.role === "FARMER") {
            router.push("/farmer");
            return;
        }

        if (user) {
            router.push(DASHBOARDS[user.role] || "/");
            return;
        }

        loginThenReturn(router, "FARMER", "/farmer");
    }

    function buy() {
        if (user) {
            document.getElementById("produce")?.scrollIntoView({ behavior: "smooth" });
            return;
        }

        loginThenReturn(router, "SHIPPER", "/market");
    }

    return (
        <>
            <Head>
                <title>{seoTitle}</title>
                <meta name="description" content={seoDescription} />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="theme-color" content="#f97316" />
                <link rel="canonical" href={canonical} />
                <link rel="alternate" hrefLang="fr-CM" href={canonical} />
                <link rel="alternate" hrefLang="en-CM" href={canonical} />
                <meta property="og:type" content="website" />
                <meta property="og:site_name" content="Tayeb" />
                <meta property="og:title" content={seoTitle} />
                <meta property="og:description" content={seoDescription} />
                <meta property="og:url" content={canonical} />
                <meta property="og:image" content={listings.find((item) => item.photo_url)?.photo_url || `${siteUrl}/branding/tayeb-logo.jpeg`} />
                <meta property="og:locale" content="fr_CM" />
                <meta property="og:locale:alternate" content="en_CM" />
                <meta name="twitter:card" content="summary_large_image" />
                <script
                    type="application/ld+json"
                    // JSON.stringify escapes everything that matters inside a script tag except "<".
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
                />
            </Head>

            <main className="mk-page">

                <MarketHeader user={user} loading={loading} />


                {/* =================================================
                    HERO AND SEARCH
                ================================================= */}

                <section className="mk-hero">
                    <div className="mk-wrap">

                        <span className="mk-eyebrow">🌾 {m("heroEyebrow")}</span>

                        <h1>
                            {m("heroTitle")} <em>{m("heroHighlight")}</em>
                        </h1>

                        <p>{m("heroText")}</p>

                        <div className="mk-hero-actions">
                            <button type="button" className="mk-btn mk-btn-primary mk-btn-lg" onClick={buy}>
                                🛒 {m("browseCta")}
                            </button>
                            <button type="button" className="mk-btn mk-btn-light mk-btn-lg" onClick={sell}>
                                👨🏾‍🌾 {m("sellCta")}
                            </button>
                        </div>

                        <form className="mk-search" method="get" action="/market" role="search">
                            {filters.product && <input type="hidden" name="product" value={filters.product} />}

                            <input
                                type="search"
                                name="q"
                                defaultValue={filters.q}
                                placeholder={m("searchPlaceholder")}
                                aria-label={m("searchPlaceholder")}
                                maxLength={60}
                            />

                            <select name="city" defaultValue={filters.city} aria-label={m("allCities")}>
                                <option value="">{m("allCities")}</option>
                                {CITY_NAMES.map((city) => (
                                    <option key={city} value={city}>{city}</option>
                                ))}
                            </select>

                            <button type="submit" className="mk-btn mk-btn-dark">
                                🔍
                            </button>
                        </form>

                        <nav className="mk-chips" aria-label={m("allProducts")}>
                            <Link
                                href={filterHref(filters, { product: "" })}
                                className={`mk-chip ${filters.product ? "" : "active"}`}
                            >
                                {m("allProducts")}
                            </Link>

                            {PRODUCTS.filter((item) => item.key !== "OTHER").map((item) => (
                                <Link
                                    key={item.key}
                                    href={filterHref(filters, { product: item.key })}
                                    className={`mk-chip ${filters.product === item.key ? "active" : ""}`}
                                >
                                    <span aria-hidden="true">{item.emoji}</span>
                                    {language === "fr" ? item.fr : item.en}
                                </Link>
                            ))}
                        </nav>

                    </div>
                </section>


                {/* =================================================
                    PRODUCE
                ================================================= */}

                <section className="mk-wrap" id="produce" style={{ paddingBottom: 30 }}>

                    {!ready ? (
                        <div className="mk-empty" style={{ marginTop: 26 }}>
                            <div className="mk-empty-icon">🌱</div>
                            <h3>{m("notReadyTitle")}</h3>
                            <p>{m("notReadyText")}</p>
                        </div>
                    ) : (
                        <>
                            <div className="mk-results-bar">
                                <h2>
                                    {total === 1 ? m("oneResult") : m("results", { count: total })}
                                    {filters.city ? ` · ${filters.city}` : ""}
                                </h2>

                                {hasFilters && (
                                    <Link href="/market" className="mk-btn mk-btn-ghost mk-btn-sm">
                                        ✕ {m("clearFilters")}
                                    </Link>
                                )}
                            </div>

                            {listings.length === 0 ? (
                                <div className="mk-empty">
                                    <div className="mk-empty-icon">🧺</div>
                                    <h3>{m("noResultsTitle")}</h3>
                                    <p>{m("noResultsText")}</p>
                                    {hasFilters && (
                                        <Link href="/market" className="mk-btn mk-btn-light">
                                            {m("clearFilters")}
                                        </Link>
                                    )}
                                </div>
                            ) : (
                                <div className="mk-grid">
                                    {listings.map((listing) => (
                                        <ProductCard key={listing.id} listing={listing} />
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                </section>


                {/* =================================================
                    HOW IT WORKS
                ================================================= */}

                <section className="mk-section">
                    <div className="mk-wrap">

                        <h2 className="mk-section-title">{m("howTitle")}</h2>

                        <div className="mk-steps-grid">
                            {["howFarmer", "howBuyer", "howDeliver", "howPay"].map((key, index) => (
                                <div key={key} className="mk-step">
                                    <span className="mk-step-num">{index + 1}</span>
                                    <p>{m(key)}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mk-duo" style={{ marginTop: 18 }}>

                            <div className="mk-promo">
                                <h3>👨🏾‍🌾 {m("forFarmersTitle")}</h3>
                                <p>{m("forFarmersText")}</p>
                                <div>
                                    <button type="button" className="mk-btn mk-btn-primary" onClick={sell}>
                                        {m("sellCta")} →
                                    </button>
                                </div>
                            </div>

                            <div className="mk-promo mk-promo-light">
                                <h3>🍽️ {m("forBuyersTitle")}</h3>
                                <p>{m("forBuyersText")}</p>
                                <div>
                                    <button type="button" className="mk-btn mk-btn-dark" onClick={buy}>
                                        {m("browseCta")} →
                                    </button>
                                </div>
                            </div>

                        </div>

                    </div>
                </section>


                <footer className="mk-footer">
                    <strong>Tayeb Marché</strong> · {m("tagline")} ·{" "}
                    <Link href="/">Tayeb</Link>
                </footer>

            </main>
        </>
    );
}
