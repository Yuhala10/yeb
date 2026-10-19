import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";

import { FeedIcon, GridIcon } from "../../components/Market/Icons";
import PostCard from "../../components/Market/PostCard";
import ProductCard from "../../components/Market/ProductCard";
import InstallPrompt from "../../components/Site/InstallPrompt";
import Reveal from "../../components/Site/Reveal";
import Seo from "../../components/Site/Seo";
import SiteFooter from "../../components/Site/SiteFooter";
import SiteHeader from "../../components/Site/SiteHeader";
import { apiGet, apiPost } from "../../lib/api";
import { cityNames, distanceKm, findCity } from "../../lib/cities";
import { LIVE_COUNTRIES, countryName, findCountry, sortedCountries } from "../../lib/countries";
import { useLanguage } from "../../lib/LanguageContext";
import { marketError, marketText, useMarketText } from "../../lib/marketText";
import { CATEGORIES, PRODUCTS, findCategory, findProduct, matchProducts, productName } from "../../lib/produce";
import { localizedUrl, siteCardUrl, siteOrigin } from "../../lib/seo";
import { useSocialText } from "../../lib/socialText";
import { listMarket, marketReady } from "../../lib/server/market";
import { countryFromRequest } from "../../lib/useCountry";
import { DASHBOARDS, loginThenReturn, useSession } from "../../lib/useSession";

/*
 * ============================================================
 * TAYEB MARCHÉ — PUBLIC MARKET
 * ============================================================
 *
 * Server-rendered so search engines and WhatsApp see the
 * produce. Filters are plain links and a GET form, so every
 * filtered view has its own address. Without a country in
 * the address, the visitor's country is used, and all of
 * Africa when it has nothing yet.
 *
 * Shown like a social feed: posts from farms (photos, caption,
 * voice note, likes), with tabs For you · Following · Near me
 * · Saved, or as a grid.
 */

export async function getServerSideProps({ query, req, res }) {
    const askedCountry = findCountry(String(query.country || ""))?.code || "";
    const product = findProduct(String(query.product || "")) ? String(query.product) : "";
    const category = findCategory(String(query.category || "")) ? String(query.category) : "";
    const q = String(query.q || "").slice(0, 60);

    // One country open (Cameroon first): show it; otherwise the visitor's.
    let country = askedCountry || (LIVE_COUNTRIES.length === 1 ? LIVE_COUNTRIES[0].code : countryFromRequest(req)) || "";

    const city = findCity(String(query.city || ""), country || undefined)?.name || "";

    const ready = await marketReady().catch(() => false);

    let result = { listings: [], total: 0, facets: {} };

    let widened = false;

    if (ready) {
        try {
            result = await listMarket({ country, product, category, city, q });

            if (!askedCountry && country && result.total === 0) {
                result = await listMarket({ product, category, q });
                country = "";
                widened = true;
            }
        } catch (error) {
            console.error("Market page error:", error);
        }
    }

    res.setHeader("Cache-Control", askedCountry ? "public, s-maxage=30, stale-while-revalidate=300" : "private, max-age=0");

    return {
        props: {
            ready,
            listings: result.listings,
            total: result.total,
            facets: result.facets || {},
            filters: { country, product, category, city, q },
            widened,
            origin: siteOrigin(req),
        },
    };
}

function filterHref(filters, changes) {
    const next = { ...filters, ...changes };

    const params = new URLSearchParams();

    ["country", "category", "product", "city", "q"].forEach((key) => {
        if (next[key]) {
            params.set(key, next[key]);
        }
    });

    const search = params.toString();

    return search ? `/market?${search}` : "/market";
}

export default function MarketPage({ ready, listings, total, facets, filters, widened, origin }) {
    const router = useRouter();

    const { language } = useLanguage();

    const m = useMarketText();

    const { user, loading } = useSession();

    const [near, setNear] = useState(null);

    const [locating, setLocating] = useState(false);

    const [alertState, setAlertState] = useState("");

    const [formCountry, setFormCountry] = useState(filters.country);

    const s = useSocialText();

    // foryou | following | near | saved
    const [tab, setTab] = useState("foryou");

    const [view, setView] = useState("feed");

    // Posts for the Following and Saved tabs: { [tab]: { loading, listings } }.
    const [extra, setExtra] = useState({});

    function chooseView(next) {
        setView(next);
    }

    async function openTab(next) {
        setTab(next);

        if (next === "near" && !near) {
            locate();
        }

        if ((next === "following" || next === "saved") && user && !extra[next]?.listings) {
            setExtra((current) => ({ ...current, [next]: { loading: true, listings: null } }));

            try {
                const result = await apiGet(`/api/social?feed=${next}`);

                setExtra((current) => ({ ...current, [next]: { loading: false, listings: result.listings || [] } }));
            } catch {
                setExtra((current) => ({ ...current, [next]: { loading: false, listings: [] } }));
            }
        }
    }

    const country = findCountry(filters.country);

    // Only Cameroon is open: no country to choose.
    const oneCountry = LIVE_COUNTRIES.length === 1;

    const hasFilters = Boolean(filters.product || filters.category || filters.city || filters.q);

    // The product a search is about, for "alert me".
    const alertProduct = filters.product || (filters.q && matchProducts(filters.q).length === 1 ? matchProducts(filters.q)[0] : "");

    // "Near me": sort by distance from where the phone is.
    const shown = useMemo(() => {
        if (!near || tab !== "near") {
            return listings.map((listing) => ({ listing, km: null }));
        }

        return listings
            .map((listing) => {
                const city = findCity(listing.city, listing.country);
                const km = city ? Math.round(distanceKm(near, city) * 1.25) : null;
                return { listing, km };
            })
            .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
    }, [listings, near, tab]);

    const productChips = Object.entries(facets)
        .filter(([key]) => findProduct(key) && key !== "OTHER")
        .sort((a, b) => b[1] - a[1])
        .slice(0, 24);

    /* ---------------- SEO ---------------- */

    const subject = filters.product
        ? `${findProduct(filters.product).fr} · ${findProduct(filters.product).en}`
        : filters.category
            ? `${findCategory(filters.category).fr} · ${findCategory(filters.category).en}`
            : null;

    const place = [filters.city, country ? countryName(country.code, language) : null].filter(Boolean).join(", ");

    const seoTitle = subject
        ? `${subject}${place ? ` — ${place}` : ""} | Tayeb Marché`
        : `${marketText(language, "seoTitle")}${place ? ` — ${place}` : ""}`;

    const seoDescription = `${marketText(language, "seoDescription")}`;

    const path = filterHref(filters, {}).replace(/^\/market/, "/market");

    const structuredData = [
        {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: seoTitle,
            numberOfItems: total,
            itemListElement: listings.slice(0, 30).map((listing, index) => ({
                "@type": "ListItem",
                position: index + 1,
                url: localizedUrl(origin, `/market/${listing.id}`, language),
                name: productName(listing, language),
            })),
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                { "@type": "ListItem", position: 1, name: "Tayeb", item: localizedUrl(origin, "/", language) },
                { "@type": "ListItem", position: 2, name: "Marché", item: localizedUrl(origin, "/market", language) },
                ...(subject ? [{ "@type": "ListItem", position: 3, name: subject, item: localizedUrl(origin, path, language) }] : []),
            ],
        },
    ];

    /* ---------------- actions ---------------- */

    function locate() {
        if (!navigator.geolocation) {
            return;
        }

        setLocating(true);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setNear({ lat: position.coords.latitude, lng: position.coords.longitude });
                setLocating(false);
            },
            () => setLocating(false),
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }
        );
    }

    async function saveAlert() {
        if (!user) {
            loginThenReturn(router, "SHIPPER", router.asPath);
            return;
        }

        if (user.role !== "SHIPPER") {
            setAlertState(m("buyerOnly"));
            return;
        }

        try {
            await apiPost("/api/market", {
                action: "saveAlert",
                product: alertProduct,
                country: filters.country || user.country,
                city: filters.city || null,
            });

            setAlertState(language === "fr" ? "🔔 C'est noté : vous serez prévenu dès qu'une offre arrive." : "🔔 Done: you'll be told as soon as one is listed.");
        } catch (error) {
            setAlertState(marketError(language, error));
        }
    }

    function sell() {
        if (user?.role === "FARMER") {
            router.push("/farmer");
        } else if (user) {
            router.push(DASHBOARDS[user.role] || "/");
        } else {
            loginThenReturn(router, "FARMER", "/farmer");
        }
    }

    const alertLabel = alertProduct
        ? language === "fr"
            ? `🔔 Me prévenir pour ${findProduct(alertProduct).fr.toLowerCase()}${filters.city ? ` à ${filters.city}` : ""}`
            : `🔔 Alert me for ${findProduct(alertProduct).en.toLowerCase()}${filters.city ? ` in ${filters.city}` : ""}`
        : null;

    return (
        <>
            <Seo
                origin={origin}
                path={path}
                title={seoTitle}
                description={seoDescription}
                image={siteCardUrl(origin, "market", language)}
                structuredData={structuredData}
                noindex={Boolean(filters.q) || (total === 0 && Boolean(filters.country || filters.category || filters.product || filters.city))}
            />

            <div className="ts-page sm-market">

                <SiteHeader user={user} loading={loading} variant="dark" active="market" />


                {/* =================================================
                    HERO
                ================================================= */}

                <section className="ts-hero sm-market-hero">
                    <div className="ts-wrap">
                        <span className="ts-badge">
                            <span className="ts-pulse" aria-hidden="true" />
                            {m("results", { count: total })}
                            {country ? ` · ${country.flag} ${countryName(country.code, language)}` : " · 🌍"}
                        </span>
                        <h1 style={{ fontSize: "clamp(36px, 6vw, 68px)" }}>
                            <span>{m("heroTitle")}</span>
                            <span className="ts-gradient-text">{m("heroHighlight")}</span>
                        </h1>
                        <p className="ts-hero-text">{m("heroText")}</p>
                        <div className="ts-hero-actions" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 24 }}>
                            <button type="button" className="ts-btn ts-btn-primary ts-btn-lg" onClick={sell}>
                                👨🏾‍🌾 {m("sellCta")}
                            </button>
                            <a href="#produce" className="ts-btn ts-btn-glass ts-btn-lg">
                                🛒 {m("browseCta")}
                            </a>
                        </div>
                    </div>
                </section>


                <div className="ts-wrap" id="produce">

                    {/* =============================================
                        FILTERS
                    ============================================= */}

                    <div className="mk-filters">

                        <form className={`mk-filter-row ${oneCountry ? "is-one-country" : ""}`} method="get" action="/market" role="search">
                            {filters.product && <input type="hidden" name="product" value={filters.product} />}
                            {filters.category && <input type="hidden" name="category" value={filters.category} />}

                            <input
                                className="mk-input"
                                type="search"
                                name="q"
                                defaultValue={filters.q}
                                placeholder={m("searchPlaceholder")}
                                aria-label={m("searchPlaceholder")}
                                maxLength={60}
                            />

                            {oneCountry ? (
                                <input type="hidden" name="country" value={LIVE_COUNTRIES[0].code} />
                            ) : (
                                <select
                                    className="mk-select"
                                    name="country"
                                    value={formCountry}
                                    onChange={(event) => setFormCountry(event.target.value)}
                                    aria-label={language === "fr" ? "Pays" : "Country"}
                                >
                                    <option value="">🌍 {language === "fr" ? "Toute l'Afrique" : "All of Africa"}</option>
                                    {sortedCountries(language).map((item) => (
                                        <option key={item.code} value={item.code}>
                                            {item.flag} {language === "fr" ? item.fr : item.en}
                                        </option>
                                    ))}
                                </select>
                            )}

                            <select
                                className="mk-select"
                                name="city"
                                defaultValue={formCountry === filters.country ? filters.city : ""}
                                key={formCountry}
                                aria-label={m("allCities")}
                                disabled={!formCountry}
                            >
                                <option value="">{m("allCities")}</option>
                                {(formCountry ? cityNames(formCountry) : []).map((city) => (
                                    <option key={city} value={city}>{city}</option>
                                ))}
                            </select>

                            <button type="submit" className="ts-btn ts-btn-ink">
                                🔍 {language === "fr" ? "Chercher" : "Search"}
                            </button>
                        </form>

                        <nav className="mk-chips" aria-label={m("allProducts")} style={{ marginTop: 12 }}>
                            <Link
                                href={filterHref(filters, { product: "", category: "" })}
                                className={`mk-chip ${filters.product || filters.category ? "" : "active"}`}
                            >
                                {m("allProducts")}
                            </Link>

                            {CATEGORIES.map((category) => (
                                <Link
                                    key={category.key}
                                    href={filterHref(filters, { category: category.key, product: "" })}
                                    className={`mk-chip ${filters.category === category.key && !filters.product ? "active" : ""}`}
                                >
                                    <span aria-hidden="true">{category.emoji}</span>
                                    {language === "fr" ? category.fr : category.en}
                                </Link>
                            ))}
                        </nav>

                    </div>


                    {/* Products on sale right now, with how many offers. */}

                    {productChips.length > 0 && (
                        <nav className="mk-chips" aria-label={m("allProducts")} style={{ marginTop: 16 }}>
                            {productChips.map(([key, count]) => {
                                const item = findProduct(key);

                                return (
                                    <Link
                                        key={key}
                                        href={filterHref(filters, { product: key, category: "" })}
                                        className={`mk-chip ${filters.product === key ? "active" : ""}`}
                                    >
                                        <span aria-hidden="true">{item.emoji}</span>
                                        {language === "fr" ? item.fr : item.en}
                                        <small style={{ opacity: 0.6 }}>{count}</small>
                                    </Link>
                                );
                            })}
                        </nav>
                    )}


                    {/* =============================================
                        RESULTS
                    ============================================= */}

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
                                    {place ? ` · ${place}` : ""}
                                </h2>

                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {hasFilters && (
                                        <Link href={filterHref({ country: filters.country }, {})} className="ts-btn ts-btn-light ts-btn-sm">
                                            ✕ {m("clearFilters")}
                                        </Link>
                                    )}
                                </div>
                            </div>

                            {widened && (
                                <div className="mk-notice" style={{ marginBottom: 16 }}>
                                    🌍 {language === "fr"
                                        ? "Rien encore dans votre pays : voici les offres de toute l'Afrique."
                                        : "Nothing in your country yet: here are offers from across Africa."}
                                </div>
                            )}

                            {listings.length === 0 ? (
                                <div className="mk-empty">
                                    <div className="mk-empty-icon">🧺</div>
                                    <h3>{m("noResultsTitle")}</h3>
                                    <p>{m("noResultsText")}</p>
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                                        {alertLabel && (
                                            <button type="button" className="ts-btn ts-btn-primary" onClick={saveAlert}>
                                                {alertLabel}
                                            </button>
                                        )}
                                        {hasFilters && (
                                            <Link href="/market" className="ts-btn ts-btn-light">
                                                {m("clearFilters")}
                                            </Link>
                                        )}
                                    </div>
                                    {alertState && <p style={{ fontWeight: 700 }}>{alertState}</p>}
                                </div>
                            ) : (
                                <>
                                    <div className="sm-feed-bar">
                                        <div className="sm-feed-tabs" role="tablist">
                                            {[
                                                ["foryou", `✨ ${s("forYou")}`],
                                                ["following", `👥 ${s("following")}`],
                                                ["near", `📍 ${s("nearMe")}`],
                                                ["saved", `🔖 ${s("saved")}`],
                                            ].map(([key, label]) => (
                                                <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => openTab(key)}>
                                                    {key === "near" && locating ? "…" : label}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="sm-view">
                                            <button type="button" className={view === "feed" ? "active" : ""} onClick={() => chooseView("feed")} aria-label={s("feedView")} aria-pressed={view === "feed"}>
                                                <FeedIcon />
                                            </button>
                                            <button type="button" className={view === "grid" ? "active" : ""} onClick={() => chooseView("grid")} aria-label={s("gridView")} aria-pressed={view === "grid"}>
                                                <GridIcon />
                                            </button>
                                        </div>
                                    </div>

                                    {(() => {
                                        const social = tab === "following" || tab === "saved";

                                        if (social && !user) {
                                            return (
                                                <div className="sm-login-note">
                                                    <span>{s("loginToFollow")}</span>
                                                    <button type="button" className="ts-btn ts-btn-primary ts-btn-sm" onClick={() => loginThenReturn(router, "SHIPPER", router.asPath)}>
                                                        {s("login")}
                                                    </button>
                                                </div>
                                            );
                                        }

                                        if (social && (!extra[tab] || extra[tab].loading)) {
                                            return <div className="sm-login-note">{s("loading")}</div>;
                                        }

                                        const items = social
                                            ? extra[tab].listings.map((listing) => ({ listing, km: null }))
                                            : shown;

                                        if (social && items.length === 0) {
                                            return (
                                                <div className="mk-empty">
                                                    <div className="mk-empty-icon">{tab === "saved" ? "🔖" : "👥"}</div>
                                                    <h3>{s(tab === "saved" ? "savedEmptyTitle" : "followingEmptyTitle")}</h3>
                                                    <p>{s(tab === "saved" ? "savedEmpty" : "followingEmpty")}</p>
                                                    <button type="button" className="ts-btn ts-btn-light" onClick={() => setTab("foryou")}>✨ {s("forYou")}</button>
                                                </div>
                                            );
                                        }

                                        return view === "feed" ? (
                                            <div className="sm-feed">
                                                {items.map(({ listing, km }, index) => (
                                                    <PostCard key={listing.id} listing={listing} user={user} distanceKm={km} eager={index === 0} />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="mk-grid">
                                                {items.map(({ listing, km }) => (
                                                    <ProductCard
                                                        key={listing.id}
                                                        listing={listing}
                                                        showCountry={!filters.country}
                                                        distanceKm={km}
                                                    />
                                                ))}
                                            </div>
                                        );
                                    })()}

                                    {alertLabel && (
                                        <div className="mk-alert-cta">
                                            <span>
                                                {language === "fr"
                                                    ? "Soyez prévenu à chaque nouvelle offre, même quand vous n'êtes pas sur Tayeb."
                                                    : "Hear about every new offer, even when you're not on Tayeb."}
                                            </span>
                                            <button type="button" className="ts-btn ts-btn-primary ts-btn-sm" onClick={saveAlert}>
                                                {alertLabel}
                                            </button>
                                            {alertState && <span style={{ flexBasis: "100%", color: "white", fontWeight: 700 }}>{alertState}</span>}
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}

                </div>


                {/* =================================================
                    HOW IT WORKS
                ================================================= */}

                <section className="ts-section">
                    <div className="ts-wrap">

                        <Reveal>
                            <span className="ts-eyebrow">Tayeb Marché</span>
                            <h2 className="ts-title">{m("howTitle")}</h2>
                        </Reveal>

                        <Reveal className="ts-steps" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                            {["howFarmer", "howBuyer", "howDeliver", "howPay"].map((key, index) => (
                                <div key={key} className="ts-step">
                                    <span className="ts-step-num">{index + 1}</span>
                                    <p>{m(key)}</p>
                                </div>
                            ))}
                        </Reveal>

                        <Reveal className="mk-duo" style={{ marginTop: 18 }}>
                            <div className="mk-promo">
                                <h3>👨🏾‍🌾 {m("forFarmersTitle")}</h3>
                                <p>{m("forFarmersText")}</p>
                                <div>
                                    <button type="button" className="ts-btn ts-btn-primary" onClick={sell}>
                                        {m("sellCta")} →
                                    </button>
                                </div>
                            </div>
                            <div className="mk-promo mk-promo-light">
                                <h3>🍽️ {m("forBuyersTitle")}</h3>
                                <p>{m("forBuyersText")}</p>
                                <div>
                                    <a href="#produce" className="ts-btn ts-btn-ink">
                                        {m("browseCta")} →
                                    </a>
                                </div>
                            </div>
                        </Reveal>

                        {/* Links search engines follow to every product page. */}
                        <nav aria-label={m("allProducts")} style={{ marginTop: 40, display: "flex", flexWrap: "wrap", gap: "8px 16px", fontSize: 14 }}>
                            {PRODUCTS.filter((item) => item.key !== "OTHER").map((item) => (
                                <Link key={item.key} href={filterHref({ country: filters.country }, { product: item.key })} className="ts-link" style={{ fontWeight: 600 }}>
                                    {language === "fr" ? item.fr : item.en}
                                </Link>
                            ))}
                        </nav>

                    </div>
                </section>

                <SiteFooter />

                {ready && <InstallPrompt />}

            </div>
        </>
    );
}
