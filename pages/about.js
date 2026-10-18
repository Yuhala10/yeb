import Link from "next/link";

import Reveal from "../components/Site/Reveal";
import Seo from "../components/Site/Seo";
import SiteFooter from "../components/Site/SiteFooter";
import SiteHeader from "../components/Site/SiteHeader";
import { COUNTRIES } from "../lib/countries";
import { FOUNDER, QUOTES } from "../lib/founder";
import { useLanguage } from "../lib/LanguageContext";
import { localizedUrl, siteCardUrl, siteOrigin } from "../lib/seo";
import { siteText, useSiteText } from "../lib/siteText";
import { useSession } from "../lib/useSession";

/*
 * ============================================================
 * OUR STORY (and the founder)
 * ============================================================
 *
 * Not in the main navigation (the footer links to it), but
 * fully indexable: Person + AboutPage structured data tell
 * search engines who founded Tayeb. Facts live in
 * lib/founder.js.
 */

export async function getServerSideProps({ req, res }) {
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");

    return {
        props: {
            origin: siteOrigin(req),
        },
    };
}

export default function AboutPage({ origin }) {
    const { language } = useLanguage();

    const s = useSiteText();

    const { user, loading } = useSession();

    const facts = {
        name: FOUNDER.name,
        nationality: FOUNDER.nationality[language],
        school: FOUNDER.school[language],
    };

    const url = localizedUrl(origin, "/about", language);

    const structuredData = [
        {
            "@context": "https://schema.org",
            "@type": "AboutPage",
            name: siteText(language, "aboutSeoTitle"),
            url,
            inLanguage: language,
            about: { "@type": "Organization", name: "Tayeb", url: localizedUrl(origin, "/", language) },
        },
        {
            "@context": "https://schema.org",
            "@type": "Person",
            name: FOUNDER.name,
            url,
            jobTitle: siteText(language, "founderRole"),
            nationality: { "@type": "Country", name: "Cameroon" },
            alumniOf: {
                "@type": "CollegeOrUniversity",
                name: FOUNDER.schoolOfficialName,
                alternateName: "Polytech Yaoundé",
                address: { "@type": "PostalAddress", addressLocality: "Yaoundé", addressCountry: "CM" },
            },
            worksFor: { "@type": "Organization", name: "Tayeb", url: origin },
            knowsAbout: ["Agriculture", "Logistics", "Marketplaces", "Software engineering", "Africa"],
            ...(FOUNDER.profiles.length ? { sameAs: FOUNDER.profiles } : {}),
        },
    ];

    const whatsapp = `https://wa.me/${FOUNDER.whatsapp}?text=${encodeURIComponent(
        language === "fr" ? `Bonjour ${FOUNDER.name}, je vous écris à propos de Tayeb.` : `Hello ${FOUNDER.name}, I'm writing about Tayeb.`
    )}`;

    return (
        <>
            <Seo
                origin={origin}
                path="/about"
                title={s("aboutSeoTitle")}
                description={s("aboutSeoDescription")}
                type="profile"
                image={siteCardUrl(origin, "about", language)}
                structuredData={structuredData}
            />

            <div className="ts-page">

                <SiteHeader user={user} loading={loading} variant="dark" />


                {/* =================================================
                    HERO
                ================================================= */}

                <section className="ts-hero">
                    <div className="ts-wrap" style={{ maxWidth: 980 }}>
                        <span className="ts-badge">🌍 {s("aboutEyebrow")}</span>
                        <h1 style={{ fontSize: "clamp(38px, 6.4vw, 76px)" }}>
                            <span className="ts-gradient-text">{s("aboutTitle")}</span>
                        </h1>
                        <p className="ts-hero-text" style={{ maxWidth: 760 }}>{s("aboutIntro")}</p>
                    </div>
                </section>


                {/* =================================================
                    WHAT IS BROKEN
                ================================================= */}

                <section className="ts-section">
                    <div className="ts-wrap">
                        <Reveal>
                            <span className="ts-eyebrow">01</span>
                            <h2 className="ts-title">{s("problemTitle")}</h2>
                        </Reveal>
                        <Reveal className="ts-steps" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                            {[1, 2, 3, 4].map((n) => (
                                <div key={n} className="ts-step">
                                    <span className="ts-step-num">{["🌾", "🥀", "🚚", "🤝"][n - 1]}</span>
                                    <p>{s(`problem${n}`)}</p>
                                </div>
                            ))}
                        </Reveal>
                    </div>
                </section>


                {/* =================================================
                    THE FOUNDER
                ================================================= */}

                <section className="ts-section ts-section-dark" id="founder">
                    <div className="ts-wrap" style={{ maxWidth: 980 }}>
                        <Reveal>
                            <span className="ts-eyebrow" style={{ color: "#fdba74" }}>02 · {s("founderEyebrow")}</span>

                            <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 22, flexWrap: "wrap" }}>
                                <div
                                    aria-hidden="true"
                                    style={{
                                        display: "grid",
                                        placeItems: "center",
                                        width: 92,
                                        height: 92,
                                        borderRadius: 28,
                                        background: "linear-gradient(135deg, #fb923c, #ea580c)",
                                        color: "white",
                                        fontSize: 34,
                                        fontWeight: 900,
                                        boxShadow: "0 20px 50px rgba(249,115,22,0.35)",
                                    }}
                                >
                                    YD
                                </div>
                                <div>
                                    <h2 className="ts-title" style={{ marginTop: 0 }}>{FOUNDER.name}</h2>
                                    <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.7)", fontSize: 16 }}>
                                        {s("founderRole")} · {FOUNDER.nationality[language]} 🇨🇲 · Polytech Yaoundé
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: "grid", gap: 18, marginTop: 30, fontSize: "clamp(17px, 1.8vw, 20px)", lineHeight: 1.7, color: "rgba(255,255,255,0.86)" }}>
                                <p style={{ margin: 0 }}>{s("founderStory1", facts)}</p>
                                <p style={{ margin: 0 }}>{s("founderStory2")}</p>
                                <p style={{ margin: 0 }}>{s("founderStory3")}</p>
                                <p style={{ margin: 0, color: "#fdba74", fontWeight: 800 }}>{s("founderSignature", facts)}</p>
                            </div>

                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 30 }}>
                                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="ts-btn ts-btn-primary">
                                    💬 {s("contactFounder")}
                                </a>
                                <Link href="/market" className="ts-btn ts-btn-glass">
                                    🌾 {s("navMarket")}
                                </Link>
                            </div>
                        </Reveal>
                    </div>
                </section>


                {/* =================================================
                    MISSION AND VALUES
                ================================================= */}

                <section className="ts-section">
                    <div className="ts-wrap">
                        <Reveal className="ts-cta" style={{ background: "linear-gradient(135deg, #0b1220, #1c2740)" }}>
                            <span className="ts-eyebrow" style={{ color: "#fdba74", position: "relative" }}>03 · {s("visionTitle")}</span>
                            <h2 style={{ marginTop: 12 }}>{s("visionText")}</h2>
                        </Reveal>

                        <Reveal style={{ marginTop: 50 }}>
                            <h2 className="ts-title" style={{ fontSize: "clamp(26px, 3.6vw, 40px)" }}>{s("valuesTitle")}</h2>
                        </Reveal>
                        <Reveal className="ts-steps" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                            {[1, 2, 3, 4].map((n) => (
                                <div key={n} className="ts-step">
                                    <span className="ts-step-num">{["⚖️", "🔍", "✨", "🛡️"][n - 1]}</span>
                                    <p>{s(`value${n}`)}</p>
                                </div>
                            ))}
                        </Reveal>
                    </div>
                </section>


                {/* =================================================
                    QUOTES
                ================================================= */}

                <section className="ts-section ts-section-cream">
                    <div className="ts-wrap">
                        <Reveal>
                            <span className="ts-eyebrow">04</span>
                            <h2 className="ts-title">{s("quoteTitle")}</h2>
                        </Reveal>
                        <Reveal className="ts-quotes" style={{ marginTop: 26 }}>
                            {QUOTES.map((quote) => (
                                <blockquote key={quote.text.en} className="ts-quote">
                                    <p>{quote.text[language]}</p>
                                    <footer>
                                        <strong>{typeof quote.author === "string" ? quote.author : quote.author[language]}</strong>
                                        {quote.detail[language]}
                                    </footer>
                                </blockquote>
                            ))}
                        </Reveal>
                    </div>
                </section>


                {/* =================================================
                    JOIN
                ================================================= */}

                <section className="ts-section-tight">
                    <div className="ts-wrap">
                        <Reveal className="ts-cta">
                            <h2>{s("joinTitle")}</h2>
                            <p>{s("joinText")}</p>
                            <p style={{ fontSize: 22, letterSpacing: 4 }} aria-hidden="true">
                                {COUNTRIES.map((country) => country.flag).join(" ")}
                            </p>
                            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="ts-btn ts-btn-ink ts-btn-lg">
                                💬 {s("contactFounder")}
                            </a>
                        </Reveal>
                    </div>
                </section>

                <div style={{ height: "clamp(40px, 6vw, 80px)" }} />

                <SiteFooter />

            </div>
        </>
    );
}
