import Link from "next/link";
import { useRouter } from "next/router";

import Seo from "../../components/Site/Seo";
import ShareSheet from "../../components/Site/ShareSheet";
import SiteFooter from "../../components/Site/SiteFooter";
import SiteHeader from "../../components/Site/SiteHeader";
import { cargoEmoji, cargoLabel } from "../../lib/cargo";
import { cityRoadKm, resolveCity } from "../../lib/cities";
import { useLanguage } from "../../lib/LanguageContext";
import { formatMoney } from "../../lib/money";
import { loadCardUrl, localizedUrl, siteOrigin } from "../../lib/seo";
import { loadShareText } from "../../lib/shareLoad";
import { db, upgraded } from "../../lib/server/core";
import { useSession } from "../../lib/useSession";

/*
 * ============================================================
 * PUBLIC LOAD PAGE
 * ============================================================
 *
 * Opened from links that shippers share on WhatsApp. Anyone
 * can view it without an account, so it only shows route,
 * cargo and price. Never phone numbers or names.
 */

export async function getServerSideProps({ params, req, res }) {
    const fields = ["id", "item_type", "origin", "destination", "origin_city", "destination_city", "quantity", "initial_offer", "status", "created_at"];

    if (await upgraded()) {
        fields.push("currency", "weight_kg", "perishable");
    }

    const { data: shipment, error } = await db
        .from("shipments")
        .select(fields.join(", "))
        .eq("id", params.id)
        .maybeSingle();

    if (error || !shipment) {
        return { notFound: true };
    }

    const { count: bidCount } = await db
        .from("bids")
        .select("id", { count: "exact", head: true })
        .eq("shipment_id", shipment.id);

    const minutesAgo = shipment.created_at
        ? Math.max(0, Math.floor((Date.now() - new Date(shipment.created_at).getTime()) / 60000))
        : null;

    const from = resolveCity(shipment.origin_city, shipment.origin);
    const to = resolveCity(shipment.destination_city, shipment.destination);

    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");

    return {
        props: {
            shipment: { ...shipment, route_km: from && to ? cityRoadKm(from, to) : null },
            bidCount: bidCount || 0,
            minutesAgo,
            origin: siteOrigin(req),
        },
    };
}

function formatPosted(minutes, fr) {
    if (minutes === null) {
        return "";
    }

    if (minutes < 60) {
        return fr ? `Publié il y a ${minutes} min` : `Posted ${minutes} min ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return fr ? `Publié il y a ${hours} h` : `Posted ${hours} h ago`;
    }

    const days = Math.floor(hours / 24);

    return fr ? `Publié il y a ${days} j` : `Posted ${days} d ago`;
}

export default function LoadPage({ shipment, bidCount, minutesAgo, origin }) {
    const router = useRouter();

    const { language } = useLanguage();

    const fr = language === "fr";

    const { user, loading } = useSession();

    const isOpen = shipment.status === "OPEN";

    const route = `${shipment.origin} → ${shipment.destination}`;

    const price = formatMoney(shipment.initial_offer, shipment.currency);

    const path = `/load/${shipment.id}`;

    const title = `📦 ${route} · ${price} | Tayeb`;

    const description = fr
        ? `${shipment.quantity} × ${cargoLabel(shipment.item_type, "fr")}. Offre : ${price}. Chauffeurs, proposez votre prix sur Tayeb.`
        : `${shipment.quantity} × ${cargoLabel(shipment.item_type, "en")}. Offer: ${price}. Drivers, send your price on Tayeb.`;

    function go(role, loadId) {
        try {
            localStorage.setItem("selectedRole", role);

            if (loadId) {
                localStorage.setItem("tayebPendingLoad", String(loadId));
            }
        } catch {
            // Storage blocked: the driver still reaches login.
        }

        // Signed-in drivers go straight to the offer form.
        if (role === "DRIVER" && user?.role === "DRIVER") {
            router.push("/driver");
            return;
        }

        router.push(`/login?role=${role}`);
    }

    const steps = fr
        ? ["Créez votre compte gratuit avec votre numéro.", "Envoyez votre prix pour ce chargement.", "Si l'expéditeur vous choisit, vous recevez son contact."]
        : ["Create your free account with your number.", "Send your price for this load.", "If the shipper picks you, you get their contact."];

    return (
        <>
            <Seo
                origin={origin}
                path={path}
                title={title}
                description={description}
                image={loadCardUrl(origin, shipment, language)}
                imageAlt={`${route} · ${price}`}
                noindex={!isOpen}
                structuredData={[
                    {
                        "@context": "https://schema.org",
                        "@type": "Service",
                        name: route,
                        serviceType: "Freight transport",
                        description,
                        provider: { "@type": "Organization", name: "Tayeb" },
                        offers: {
                            "@type": "Offer",
                            price: shipment.initial_offer,
                            priceCurrency: shipment.currency || "XAF",
                            availability: isOpen ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
                            url: localizedUrl(origin, path, language),
                        },
                    },
                ]}
            />

            <div className="ts-page">

                <SiteHeader user={user} loading={loading} variant="dark" />

                <section className="ts-hero" style={{ paddingBottom: 50 }}>
                    <div className="ts-wrap" style={{ maxWidth: 760 }}>
                        <span className="ts-badge">
                            <span className="ts-pulse" aria-hidden="true" style={{ background: isOpen ? "#4ade80" : "#94a3b8" }} />
                            {isOpen ? (fr ? "Chargement disponible" : "Load available") : (fr ? "Plus disponible" : "No longer available")}
                            {minutesAgo !== null && ` · ${formatPosted(minutesAgo, fr)}`}
                        </span>

                        <h1 style={{ fontSize: "clamp(34px, 6vw, 60px)" }}>
                            <span>{shipment.origin}</span>
                            <span className="ts-gradient-text">→ {shipment.destination}</span>
                        </h1>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
                            <span className="ts-badge">{cargoEmoji(shipment.item_type)} {shipment.quantity} × {cargoLabel(shipment.item_type, language)}</span>
                            {shipment.route_km > 0 && <span className="ts-badge">🛣️ ~{shipment.route_km} km</span>}
                            {shipment.weight_kg > 0 && <span className="ts-badge">⚖️ ~{shipment.weight_kg} kg</span>}
                            {shipment.perishable && <span className="ts-badge">❄️ {fr ? "Produit frais" : "Fresh produce"}</span>}
                        </div>
                    </div>
                </section>

                <div className="ts-wrap" style={{ maxWidth: 760, padding: "30px clamp(16px, 4vw, 40px) 70px" }}>

                    <div className="mk-panel" style={{ position: "static" }}>

                        <div className="mk-panel-price">
                            <div>
                                <small className="ts-mini-label">{fr ? "Offre de l'expéditeur" : "Shipper's offer"}</small>
                                <div className="mk-price" style={{ fontSize: 30 }}>{price}</div>
                            </div>
                            {bidCount > 0 && (
                                <span className="mk-pill mk-pill-orange">
                                    🔥 {fr ? `${bidCount} prix déjà proposés` : `${bidCount} prices sent`}
                                </span>
                            )}
                        </div>

                        {isOpen ? (
                            <>
                                <p style={{ margin: 0, color: "var(--ts-muted)" }}>
                                    {fr ? "Vous pouvez proposer votre propre prix." : "You can propose your own price."}
                                </p>
                                <button type="button" className="ts-btn ts-btn-primary ts-btn-lg" onClick={() => go("DRIVER", shipment.id)}>
                                    🚚 {fr ? "Envoyer mon prix" : "Send my price"} →
                                </button>
                                <small style={{ textAlign: "center", color: "var(--ts-muted)" }}>
                                    {fr ? "Gratuit · Inscription avec votre numéro en 1 minute" : "Free · Sign up with your phone number in 1 minute"}
                                </small>
                            </>
                        ) : (
                            <>
                                <div className="mk-notice">{fr ? "Ce chargement n'est plus disponible." : "This load is no longer available."}</div>
                                <button type="button" className="ts-btn ts-btn-ink ts-btn-lg" onClick={() => go("DRIVER")}>
                                    🚚 {fr ? "Voir d'autres chargements" : "See other loads"} →
                                </button>
                            </>
                        )}

                        <ShareSheet
                            url={localizedUrl(origin, path, language)}
                            title={route}
                            text={loadShareText(shipment, language)}
                            className="ts-btn ts-btn-light"
                        />

                    </div>

                    <div className="ts-steps" style={{ gridTemplateColumns: "1fr", marginTop: 20 }}>
                        {steps.map((step, index) => (
                            <div key={step} className="ts-step" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                <span className="ts-step-num">{index + 1}</span>
                                <p style={{ margin: 0 }}>{step}</p>
                            </div>
                        ))}
                    </div>

                    <div className="mk-alert-cta" style={{ marginTop: 20 }}>
                        <span>{fr ? "Vous avez des marchandises à envoyer ? Publiez gratuitement." : "Have goods to send? Post for free."}</span>
                        <button type="button" className="ts-btn ts-btn-primary ts-btn-sm" onClick={() => go("SHIPPER")}>
                            📦 {fr ? "Publier" : "Post a load"}
                        </button>
                    </div>

                    <p style={{ marginTop: 24, textAlign: "center" }}>
                        <Link href="/market" className="ts-link">🌾 Tayeb Marché →</Link>
                    </p>

                </div>

                <SiteFooter />

            </div>
        </>
    );
}
