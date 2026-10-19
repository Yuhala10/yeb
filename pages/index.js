import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

import ProductCard from "../components/Market/ProductCard";
import InstallPrompt from "../components/Site/InstallPrompt";
import Reveal from "../components/Site/Reveal";
import Seo from "../components/Site/Seo";
import SiteFooter from "../components/Site/SiteFooter";
import SiteHeader from "../components/Site/SiteHeader";
import { cityNames } from "../lib/cities";
import { LIVE_COUNTRIES, countryName } from "../lib/countries";
import { FOUNDER, QUOTES, TAYEB_PROFILES } from "../lib/founder";
import { useLanguage } from "../lib/LanguageContext";
import { formatMoney } from "../lib/money";
import { CATEGORIES, productEmoji, productName } from "../lib/produce";
import { localizedUrl, siteCardUrl, siteOrigin } from "../lib/seo";
import { featuredListings, marketReady } from "../lib/server/market";
import { siteText, useSiteText } from "../lib/siteText";
import { countryFromRequest } from "../lib/useCountry";
import { DASHBOARDS, useSession } from "../lib/useSession";

/*
 * ============================================================
 * TAYEB — HOME
 * ============================================================
 *
 * Server-rendered with real listings from the visitor's
 * country (falling back to all of Africa), so search engines
 * and first-time visitors see a living market.
 */

export async function getServerSideProps({ req, res }) {
    const country = countryFromRequest(req);

    let featured = [];

    try {
        featured = await featuredListings({ country, limit: 8 });

        if (featured.length < 4) {
            featured = await featuredListings({ limit: 8 });
        }
    } catch (error) {
        console.error("Home featured error:", error);
    }

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");

    return {
        props: {
            featured,
            ready: await marketReady().catch(() => false),
            origin: siteOrigin(req),
        },
    };
}

const ROLE_TABS = ["buyers", "farmers", "shippers", "drivers"];

const FEATURES = [
    ["🔑", "why1"],
    ["📡", "why2"],
    ["📊", "why3"],
    ["🔁", "why4"],
    ["💳", "why5"],
    ["🛡️", "why6"],
    ["⚡", "why7"],
    ["🌍", "why8"],
];

export default function Home({ featured, ready, origin }) {
    const router = useRouter();

    const { language } = useLanguage();

    const s = useSiteText();

    const { user, loading } = useSession();

    const [tab, setTab] = useState("buyers");

    const [query, setQuery] = useState("");

    const hero = featured.find((item) => item.photos?.length) || featured[0] || null;

    function roleHref(role, fallback) {
        if (user) {
            return DASHBOARDS[user.role] || "/";
        }

        return fallback || `/login?role=${role}`;
    }

    function search(event) {
        event.preventDefault();

        const q = query.trim();

        router.push(q ? `/market?q=${encodeURIComponent(q)}` : "/market");
    }

    const faq = [1, 2, 3, 4, 5, 6].map((n) => ({ q: s(`faq${n}q`), a: s(`faq${n}a`) }));

    const structuredData = [
        {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Tayeb",
            url: origin,
            logo: `${origin}/branding/tayeb-logo.jpeg`,
            slogan: siteText(language, "tagline"),
            description: siteText(language, "visionText"),
            areaServed: LIVE_COUNTRIES.map((country) => ({ "@type": "Country", name: country.en })),
            ...(TAYEB_PROFILES.length ? { sameAs: TAYEB_PROFILES } : {}),
            founder: {
                "@type": "Person",
                name: FOUNDER.name,
                url: localizedUrl(origin, "/about", language),
                ...(FOUNDER.profiles.length ? { sameAs: FOUNDER.profiles } : {}),
            },
        },
        {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Tayeb",
            url: localizedUrl(origin, "/", language),
            inLanguage: language,
            potentialAction: {
                "@type": "SearchAction",
                target: {
                    "@type": "EntryPoint",
                    urlTemplate: `${localizedUrl(origin, "/market", language)}?q={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
            },
        },
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
        },
    ];

    const tickerItems = featured.length
        ? featured.map((item) => ({
            key: item.id,
            href: `/market/${item.id}`,
            emoji: productEmoji(item.product),
            text: `${productName(item, language)} · ${item.city}`,
            price: formatMoney(item.price_per_unit, item.currency),
        }))
        : FEATURES.map(([emoji, key]) => ({ key, emoji, text: s(`${key}Title`), price: "✓" }));

    return (
        <>
            <Seo
                origin={origin}
                path="/"
                title={s("seoTitle")}
                description={s("seoDescription")}
                image={siteCardUrl(origin, "home", language)}
                structuredData={structuredData}
            />

            <div className="ts-page">

                <SiteHeader user={user} loading={loading} variant="dark" />


                {/* =================================================
                    HERO
                ================================================= */}

                <section className="ts-hero">
                    <div className="ts-wrap">

                        <div className="ts-hero-grid">

                            <div>
                                <span className="ts-badge">
                                    <span className="ts-pulse" aria-hidden="true" />
                                    {s("heroBadge", { count: cityNames("CM").length })}
                                </span>

                                <h1>
                                    <span>{s("heroTitle1")}</span>
                                    <span className="ts-gradient-text">{s("heroTitle2")}</span>
                                    <span>{s("heroTitle3")}</span>
                                </h1>

                                <p className="ts-hero-text">{s("heroText")}</p>

                                <form className="ts-search" role="search" onSubmit={search} action="/market" method="get">
                                    <span className="ts-search-icon" aria-hidden="true">🔍</span>
                                    <label className="ts-sr" htmlFor="home-search">{s("searchPlaceholder")}</label>
                                    <input
                                        id="home-search"
                                        name="q"
                                        type="search"
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder={s("searchPlaceholder")}
                                        maxLength={60}
                                        autoComplete="off"
                                    />
                                    <button type="submit" className="ts-btn ts-btn-primary">
                                        {s("searchButton")}
                                    </button>
                                </form>

                                <div className="ts-actions">
                                    <Link href="/market" className="ts-tile">
                                        <span className="ts-tile-icon" aria-hidden="true">🛒</span>
                                        <strong>{s("actionBuy")}</strong>
                                        <span>{s("actionBuyText")}</span>
                                    </Link>
                                    <Link href={roleHref("FARMER")} className="ts-tile">
                                        <span className="ts-tile-icon" aria-hidden="true">👨🏾‍🌾</span>
                                        <strong>{s("actionSell")}</strong>
                                        <span>{s("actionSellText")}</span>
                                    </Link>
                                    <Link href="/go" className="ts-tile">
                                        <span className="ts-tile-icon" aria-hidden="true">⚡</span>
                                        <strong>{s("actionSend")}</strong>
                                        <span>{s("actionSendText")}</span>
                                    </Link>
                                    <Link href={user?.role === "DRIVER" ? "/drive" : roleHref("DRIVER")} className="ts-tile">
                                        <span className="ts-tile-icon" aria-hidden="true">🚚</span>
                                        <strong>{s("actionDrive")}</strong>
                                        <span>{s("actionDriveText")}</span>
                                    </Link>
                                </div>
                            </div>


                            {/* Floating cards: the real newest listing when there is one. */}

                            <div className="ts-visual" aria-hidden="true">

                                <div className="ts-glass-card ts-card-main">
                                    <div className="ts-card-media">
                                        {hero?.photos?.[0]?.url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={hero.photos[0].url} alt="" />
                                        ) : (
                                            <span>{hero ? productEmoji(hero.product) : "🍅"}</span>
                                        )}
                                    </div>
                                    <div className="ts-card-body">
                                        <span className="ts-mini-label">{s("liveNow")}</span>
                                        <strong>{hero ? productName(hero, language) : s("actionSell")}</strong>
                                        <small>📍 {hero ? hero.city : countryName("CM", language)}</small>
                                        {hero && (
                                            <div className="ts-card-price">
                                                {formatMoney(hero.price_per_unit, hero.currency)}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="ts-glass-card ts-card-code">
                                    <div className="ts-code">🔑</div>
                                    <div>
                                        <span className="ts-mini-label">{s("why1Title")}</span>
                                        <span className="ts-mini-value">• • • •</span>
                                    </div>
                                </div>

                                <div className="ts-glass-card ts-card-route">
                                    <span className="ts-mini-label">📡 {s("why2Title")}</span>
                                    <div className="ts-route-line">
                                        <span>{hero?.city || "Bafoussam"}</span>
                                        <i />
                                        <span>{hero?.city === "Douala" ? "Yaoundé" : "Douala"}</span>
                                    </div>
                                    <div className="ts-progress"><span /></div>
                                </div>

                            </div>

                        </div>

                        <div className="ts-ticker" aria-label={s("liveNow")}>
                            <div className="ts-ticker-track">
                                {[0, 1].map((copy) =>
                                    tickerItems.map((item) =>
                                        item.href ? (
                                            <Link key={`${copy}-${item.key}`} href={item.href} tabIndex={copy ? -1 : 0} aria-hidden={copy ? "true" : undefined}>
                                                <span aria-hidden="true">{item.emoji}</span> {item.text} <b>{item.price}</b>
                                            </Link>
                                        ) : (
                                            <span key={`${copy}-${item.key}`} aria-hidden={copy ? "true" : undefined}>
                                                <span aria-hidden="true">{item.emoji}</span> {item.text} <b>{item.price}</b>
                                            </span>
                                        )
                                    )
                                )}
                            </div>
                        </div>

                    </div>
                </section>


                {/* =================================================
                    FRESH ON THE MARKET
                ================================================= */}

                <section className="ts-section ts-section-cream">
                    <div className="ts-wrap">

                        <Reveal className="ts-head">
                            <div>
                                <span className="ts-eyebrow">🌾 Tayeb Marché</span>
                                <h2 className="ts-title">{s("featuredTitle")}</h2>
                                <p className="ts-lead">{s("featuredText")}</p>
                            </div>
                            <Link href="/market" className="ts-btn ts-btn-ink">
                                {s("seeAll")} →
                            </Link>
                        </Reveal>

                        {featured.length ? (
                            <Reveal className="mk-grid">
                                {featured.map((listing) => (
                                    <ProductCard key={listing.id} listing={listing} showCountry />
                                ))}
                            </Reveal>
                        ) : (
                            <Reveal className="mk-empty">
                                <div className="mk-empty-icon">🌱</div>
                                <p>{s("emptyFeatured")}</p>
                                <Link href={roleHref("FARMER")} className="ts-btn ts-btn-primary">
                                    👨🏾‍🌾 {s("actionSell")}
                                </Link>
                            </Reveal>
                        )}

                        <Reveal style={{ marginTop: 44 }}>
                            <h3 className="ts-title" style={{ fontSize: "clamp(22px, 3vw, 30px)" }}>{s("categoriesTitle")}</h3>
                            <div className="ts-cats" style={{ marginTop: 18 }}>
                                {CATEGORIES.map((category) => (
                                    <Link key={category.key} href={`/market?category=${category.key}`} className="ts-cat">
                                        <span className="ts-cat-emoji" aria-hidden="true">{category.emoji}</span>
                                        <strong>{language === "fr" ? category.fr : category.en}</strong>
                                    </Link>
                                ))}
                            </div>
                        </Reveal>

                    </div>
                </section>


                {/* =================================================
                    HOW IT WORKS
                ================================================= */}

                <section className="ts-section">
                    <div className="ts-wrap">

                        <Reveal className="ts-head">
                            <div>
                                <span className="ts-eyebrow">Tayeb</span>
                                <h2 className="ts-title">{s("howTitle")}</h2>
                            </div>
                            <div className="ts-tabs" role="tablist">
                                {ROLE_TABS.map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        role="tab"
                                        aria-selected={tab === key}
                                        className={tab === key ? "active" : ""}
                                        onClick={() => setTab(key)}
                                    >
                                        {s(`how${key.charAt(0).toUpperCase()}${key.slice(1)}`)}
                                    </button>
                                ))}
                            </div>
                        </Reveal>

                        <div className="ts-steps" key={tab} role="tabpanel">
                            {[1, 2, 3].map((n) => (
                                <div key={n} className="ts-step">
                                    <span className="ts-step-num">{n}</span>
                                    <p>{s(`${tab}${n}`)}</p>
                                </div>
                            ))}
                        </div>

                    </div>
                </section>


                {/* =================================================
                    WHY TAYEB
                ================================================= */}

                <section className="ts-section ts-section-dark">
                    <div className="ts-wrap">

                        <Reveal className="ts-head">
                            <div>
                                <span className="ts-eyebrow" style={{ color: "#fdba74" }}>{s("visionTitle")}</span>
                                <h2 className="ts-title">{s("whyTitle")}</h2>
                                <p className="ts-lead">{s("whyText")}</p>
                            </div>
                        </Reveal>

                        <Reveal className="ts-features">
                            {FEATURES.map(([icon, key]) => (
                                <div key={key} className="ts-feature">
                                    <span className="ts-feature-icon" aria-hidden="true">{icon}</span>
                                    <h3>{s(`${key}Title`)}</h3>
                                    <p>{s(`${key}Text`)}</p>
                                </div>
                            ))}
                        </Reveal>

                    </div>
                </section>


                {/* =================================================
                    COUNTRIES AND QUOTES
                ================================================= */}

                <section className="ts-section">
                    <div className="ts-wrap">

                        <Reveal className="ts-head">
                            <div>
                                <span className="ts-eyebrow">🇨🇲 {cityNames("CM").length}</span>
                                <h2 className="ts-title">{s("countriesTitle")}</h2>
                                <p className="ts-lead">{s("countriesText")}</p>
                            </div>
                        </Reveal>

                        <Reveal className="ts-countries">
                            {cityNames("CM").map((city) => (
                                <Link key={city} href={`/market?country=CM&city=${encodeURIComponent(city)}`} className="ts-country">
                                    <span aria-hidden="true">📍</span>
                                    {city}
                                </Link>
                            ))}
                        </Reveal>

                        <Reveal style={{ marginTop: 60 }}>
                            <span className="ts-eyebrow">{s("quoteTitle")}</span>
                            <div className="ts-quotes" style={{ marginTop: 18 }}>
                                {QUOTES.slice(0, 2).map((quote) => (
                                    <blockquote key={quote.author.en || quote.author} className="ts-quote">
                                        <p>{quote.text[language]}</p>
                                        <footer>
                                            <strong>{typeof quote.author === "string" ? quote.author : quote.author[language]}</strong>
                                            {quote.detail[language]}
                                        </footer>
                                    </blockquote>
                                ))}
                            </div>
                            <p style={{ marginTop: 18 }}>
                                <Link href="/about" className="ts-link">{s("footerStory")} →</Link>
                            </p>
                        </Reveal>

                    </div>
                </section>


                {/* =================================================
                    FAQ
                ================================================= */}

                <section className="ts-section ts-section-cream">
                    <div className="ts-wrap">

                        <Reveal className="ts-head">
                            <div>
                                <span className="ts-eyebrow">FAQ</span>
                                <h2 className="ts-title">{s("faqTitle")}</h2>
                            </div>
                        </Reveal>

                        <Reveal className="ts-faq">
                            {faq.map((item, index) => (
                                <details key={item.q} open={index === 0}>
                                    <summary>{item.q}</summary>
                                    <p>{item.a}</p>
                                </details>
                            ))}
                        </Reveal>

                    </div>
                </section>


                {/* =================================================
                    CTA
                ================================================= */}

                <section className="ts-section-tight">
                    <div className="ts-wrap">
                        <Reveal className="ts-cta">
                            <h2>{s("ctaTitle")}</h2>
                            <p>{s("ctaText")}</p>
                            <Link href={user ? DASHBOARDS[user.role] || "/" : "/login"} className="ts-btn ts-btn-ink ts-btn-lg">
                                {user ? s("dashboard") : s("ctaStart")} →
                            </Link>
                        </Reveal>
                    </div>
                </section>

                <div style={{ height: "clamp(40px, 6vw, 80px)" }} />

                <SiteFooter />

                {ready && <InstallPrompt />}

            </div>
        </>
    );
}
