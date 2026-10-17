import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

import BrandLogo from "../../components/BrandLogo";
import { useLanguage } from "../../lib/LanguageContext";
import supabaseAdmin from "../../lib/supabaseAdmin";

/*
 * ============================================================
 * PUBLIC LOAD PAGE
 * ============================================================
 *
 * Opened from links that shippers share on WhatsApp.
 * Anyone can view it without an account, so it only shows
 * route, cargo and price. Never phone numbers or names.
 */

export async function getServerSideProps({
    params,
    req,
}) {
    const {
        data: shipment,
        error,
    } = await supabaseAdmin
        .from("shipments")
        .select(
            "id, item_type, origin, destination, quantity, initial_offer, status, created_at"
        )
        .eq("id", params.id)
        .maybeSingle();

    if (error || !shipment) {
        return {
            notFound: true,
        };
    }

    const {
        count: bidCount,
    } = await supabaseAdmin
        .from("bids")
        .select("id", {
            count: "exact",
            head: true,
        })
        .eq(
            "shipment_id",
            shipment.id
        );

    const protocol =
        String(
            req.headers["x-forwarded-proto"] ||
            "http"
        ).split(",")[0];

    const host =
        req.headers["x-forwarded-host"] ||
        req.headers.host;

    const minutesAgo =
        shipment.created_at
            ? Math.max(
                0,
                Math.floor(
                    (Date.now() -
                        new Date(
                            shipment.created_at
                        ).getTime()) /
                    60000
                )
            )
            : null;

    return {
        props: {
            shipment,
            bidCount:
                bidCount || 0,
            minutesAgo,
            siteUrl:
                `${protocol}://${host}`,
        },
    };
}

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

function formatPosted(
    minutes,
    isFrench
) {
    if (minutes === null) {
        return "";
    }

    if (minutes < 60) {
        return isFrench
            ? `Publié il y a ${minutes} min`
            : `Posted ${minutes} min ago`;
    }

    const hours =
        Math.floor(minutes / 60);

    if (hours < 24) {
        return isFrench
            ? `Publié il y a ${hours} h`
            : `Posted ${hours} h ago`;
    }

    const days =
        Math.floor(hours / 24);

    return isFrench
        ? `Publié il y a ${days} j`
        : `Posted ${days} d ago`;
}

export default function LoadPage({
    shipment,
    bidCount,
    minutesAgo,
    siteUrl,
}) {
    const router = useRouter();

    const {
        language,
        setLanguage,
    } = useLanguage();

    const isFrench =
        language === "fr";

    const isOpen =
        shipment.status === "OPEN";

    const route =
        `${shipment.origin} → ${shipment.destination}`;

    const price =
        formatPrice(
            shipment.initial_offer
        );

    const text = {
        eyebrow: isOpen
            ? isFrench
                ? "MARCHANDISE DISPONIBLE"
                : "LOAD AVAILABLE"
            : isFrench
                ? "PLUS DISPONIBLE"
                : "NO LONGER AVAILABLE",

        pickup: isFrench
            ? "Ramassage"
            : "Pickup",

        delivery: isFrench
            ? "Livraison"
            : "Delivery",

        quantity: isFrench
            ? "Quantité"
            : "Quantity",

        offer: isFrench
            ? "Offre de l'expéditeur"
            : "Shipper's offer",

        ownPrice: isFrench
            ? "Vous pouvez proposer votre propre prix."
            : "You can propose your own price.",

        bids: isFrench
            ? bidCount === 1
                ? "1 chauffeur a déjà proposé un prix"
                : `${bidCount} chauffeurs ont déjà proposé un prix`
            : bidCount === 1
                ? "1 driver has already sent a price"
                : `${bidCount} drivers have already sent a price`,

        sendPrice: isFrench
            ? "ENVOYER MON PRIX"
            : "SEND MY PRICE",

        freeNote: isFrench
            ? "Gratuit · Inscription avec votre numéro en 1 minute"
            : "Free · Sign up with your phone number in 1 minute",

        taken: isFrench
            ? "Cette marchandise n'est plus disponible."
            : "This load is no longer available.",

        otherLoads: isFrench
            ? "VOIR D'AUTRES MARCHANDISES"
            : "SEE OTHER LOADS",

        stepsTitle: isFrench
            ? "Comment ça marche pour les chauffeurs"
            : "How it works for drivers",

        steps: isFrench
            ? [
                "Créez votre compte gratuit.",
                "Envoyez votre prix pour cette marchandise.",
                "Si l'expéditeur vous choisit, vous recevez son contact.",
            ]
            : [
                "Create your free account.",
                "Send your price for this load.",
                "If the shipper picks you, you get their contact.",
            ],

        shipperTitle: isFrench
            ? "Vous avez des marchandises à envoyer ?"
            : "Have goods to send?",

        shipperText: isFrench
            ? "Publiez gratuitement et recevez les prix des chauffeurs."
            : "Post for free and get prices from drivers.",

        postLoad: isFrench
            ? "PUBLIER"
            : "POST A LOAD",

        footer: isFrench
            ? "Bougez. Gérez. Livrez."
            : "Move. Manage. Deliver.",
    };

    const pageTitle =
        `${route} · ${shipment.item_type} · Tayeb`;

    /*
     * Language-neutral preview: the server cannot know the
     * reader's language, and Cameroon reads both.
     */
    const previewDescription =
        `${price} FCFA · ${shipment.quantity} × ${shipment.item_type}. ` +
        "Chauffeurs, proposez votre prix · Drivers, send your price.";

    function goToLogin(
        role,
        loadId
    ) {
        try {
            localStorage.setItem(
                "selectedRole",
                role
            );

            if (loadId) {
                localStorage.setItem(
                    "tayebPendingLoad",
                    String(loadId)
                );
            }
        } catch {
            // Storage blocked: the driver still reaches login.
        }

        /*
         * A driver who is already signed in goes straight to
         * the dashboard, which opens the offer form for the
         * pending load. The dashboard sends them to login if
         * their session has expired.
         */
        let savedUser = null;

        try {
            savedUser =
                JSON.parse(
                    localStorage.getItem(
                        "tayebUser"
                    ) || "null"
                );
        } catch {
            savedUser = null;
        }

        if (
            role === "DRIVER" &&
            savedUser?.role === "DRIVER"
        ) {
            router.push("/driver");
            return;
        }

        router.push("/login");
    }

    return (
        <>
            <Head>

                <title>
                    {pageTitle}
                </title>

                <meta
                    name="description"
                    content={
                        previewDescription
                    }
                />

                <meta
                    name="theme-color"
                    content="#f97316"
                />

                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />

                <meta
                    property="og:type"
                    content="website"
                />

                <meta
                    property="og:site_name"
                    content="Tayeb"
                />

                <meta
                    property="og:title"
                    content={`📦 ${route}`}
                />

                <meta
                    property="og:description"
                    content={
                        previewDescription
                    }
                />

                <meta
                    property="og:url"
                    content={`${siteUrl}/load/${shipment.id}`}
                />

                <meta
                    property="og:image"
                    content={`${siteUrl}/branding/tayeb-logo.jpeg`}
                />

                <meta
                    name="twitter:card"
                    content="summary"
                />

            </Head>

            <main className="load-page">

                {/* =================================================
                    HEADER
                ================================================= */}

                <header className="load-header">

                    <Link
                        href="/"
                        aria-label="Tayeb"
                    >
                        <BrandLogo
                            width={110}
                            height={44}
                        />
                    </Link>

                    <div className="load-language">

                        <button
                            type="button"
                            className={
                                language === "en"
                                    ? "active"
                                    : ""
                            }
                            onClick={() =>
                                setLanguage("en")
                            }
                        >
                            EN
                        </button>

                        <button
                            type="button"
                            className={
                                language === "fr"
                                    ? "active"
                                    : ""
                            }
                            onClick={() =>
                                setLanguage("fr")
                            }
                        >
                            FR
                        </button>

                    </div>

                </header>


                <div className="load-wrap">

                    {/* =============================================
                        LOAD CARD
                    ============================================= */}

                    <article className="load-card">

                        <div className="load-card-top">

                            <span
                                className={
                                    isOpen
                                        ? "load-eyebrow"
                                        : "load-eyebrow load-eyebrow-closed"
                                }
                            >
                                {text.eyebrow}
                            </span>

                            <span className="load-posted">
                                {formatPosted(
                                    minutesAgo,
                                    isFrench
                                )}
                            </span>

                        </div>

                        <h1>
                            📦{" "}
                            {
                                shipment.item_type
                            }
                        </h1>

                        <div
                            className="tayeb-route"
                            style={{
                                marginTop:
                                    "20px",
                            }}
                        >

                            <div className="tayeb-route-point">

                                <span className="tayeb-route-label">
                                    {text.pickup}
                                </span>

                                <div className="tayeb-route-city">
                                    {
                                        shipment.origin
                                    }
                                </div>

                            </div>

                            <div className="tayeb-route-arrow">
                                →
                            </div>

                            <div className="tayeb-route-point">

                                <span className="tayeb-route-label">
                                    {text.delivery}
                                </span>

                                <div className="tayeb-route-city">
                                    {
                                        shipment.destination
                                    }
                                </div>

                            </div>

                        </div>

                        <div className="load-facts">

                            <div className="load-fact">
                                <small>
                                    {text.quantity}
                                </small>

                                <strong>
                                    {
                                        shipment.quantity
                                    }
                                </strong>
                            </div>

                            <div className="load-fact load-fact-price">
                                <small>
                                    {text.offer}
                                </small>

                                <strong>
                                    {price} FCFA
                                </strong>
                            </div>

                        </div>

                        {isOpen ? (
                            <>
                                <p className="load-own-price">
                                    {text.ownPrice}
                                </p>

                                {bidCount > 0 && (
                                    <p className="load-proof">
                                        🔥 {text.bids}
                                    </p>
                                )}

                                <button
                                    type="button"
                                    className="tayeb-button tayeb-button-primary tayeb-button-full load-cta"
                                    onClick={() =>
                                        goToLogin(
                                            "DRIVER",
                                            shipment.id
                                        )
                                    }
                                >
                                    🚚 {text.sendPrice} →
                                </button>

                                <p className="load-free-note">
                                    {text.freeNote}
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="load-taken">
                                    {text.taken}
                                </div>

                                <button
                                    type="button"
                                    className="tayeb-button tayeb-button-primary tayeb-button-full load-cta"
                                    onClick={() =>
                                        goToLogin(
                                            "DRIVER"
                                        )
                                    }
                                >
                                    🚚 {text.otherLoads} →
                                </button>
                            </>
                        )}

                    </article>


                    {/* =============================================
                        HOW IT WORKS
                    ============================================= */}

                    <section className="load-steps">

                        <h2>
                            {text.stepsTitle}
                        </h2>

                        <ol>
                            {text.steps.map(
                                (
                                    step,
                                    index
                                ) => (
                                    <li key={step}>
                                        <span>
                                            {index + 1}
                                        </span>

                                        {step}
                                    </li>
                                )
                            )}
                        </ol>

                    </section>


                    {/* =============================================
                        SHIPPER INVITE
                    ============================================= */}

                    <section className="load-shipper">

                        <div>
                            <strong>
                                {text.shipperTitle}
                            </strong>

                            <span>
                                {text.shipperText}
                            </span>
                        </div>

                        <button
                            type="button"
                            className="tayeb-button tayeb-button-secondary"
                            onClick={() =>
                                goToLogin(
                                    "SHIPPER"
                                )
                            }
                        >
                            📦 {text.postLoad}
                        </button>

                    </section>

                </div>


                <footer className="load-footer">
                    Tayeb · {text.footer}
                </footer>

            </main>


            <style jsx>{`

                .load-page {
                    min-height: 100vh;
                    background: var(--tayeb-background);
                    color: var(--tayeb-text);
                }


                /* =================================================
                   HEADER
                ================================================= */

                .load-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 10px 16px;
                    background: rgba(255,255,255,0.95);
                    border-bottom: 1px solid #f1f5f9;
                }

                .load-language {
                    display: flex;
                    gap: 2px;
                    padding: 3px;
                    background: #f8fafc;
                    border: 1px solid var(--tayeb-border);
                    border-radius: 10px;
                }

                .load-language button {
                    border: 0;
                    background: transparent;
                    color: var(--tayeb-light-text);
                    border-radius: 7px;
                    padding: 7px 10px;
                    font-size: 11px;
                    font-weight: 900;
                    cursor: pointer;
                }

                .load-language button.active {
                    background: var(--tayeb-orange-light);
                    color: var(--tayeb-orange);
                }


                /* =================================================
                   LAYOUT
                ================================================= */

                .load-wrap {
                    width: min(520px, 100%);
                    margin: 0 auto;
                    padding: 24px 16px 40px;
                    display: grid;
                    gap: 14px;
                }


                /* =================================================
                   LOAD CARD
                ================================================= */

                .load-card {
                    padding: 22px;
                    background: white;
                    border: 1px solid var(--tayeb-border);
                    border-radius: var(--tayeb-radius);
                    box-shadow: var(--tayeb-shadow-large);
                }

                .load-card-top {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    flex-wrap: wrap;
                }

                .load-eyebrow {
                    display: inline-flex;
                    align-items: center;
                    min-height: 26px;
                    padding: 0 10px;
                    border-radius: 999px;
                    background: var(--tayeb-green-light);
                    border: 1px solid #bbf7d0;
                    color: #15803d;
                    font-size: 10px;
                    font-weight: 900;
                    letter-spacing: 0.1em;
                }

                .load-eyebrow-closed {
                    background: #f3f4f6;
                    border-color: var(--tayeb-border);
                    color: var(--tayeb-muted);
                }

                .load-posted {
                    color: var(--tayeb-light-text);
                    font-size: 11px;
                    font-weight: 700;
                }

                .load-card h1 {
                    margin: 16px 0 0;
                    color: var(--tayeb-black);
                    font-size: 24px;
                    line-height: 1.15;
                    letter-spacing: -0.03em;
                    font-weight: 900;
                }

                .load-facts {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
                    gap: 10px;
                    margin-top: 12px;
                }

                .load-fact {
                    padding: 14px;
                    border-radius: var(--tayeb-radius-small);
                    background: #fafafa;
                    border: 1px solid #f1f5f9;
                }

                .load-fact small {
                    display: block;
                    color: var(--tayeb-light-text);
                    font-size: 10px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                }

                .load-fact strong {
                    display: block;
                    margin-top: 5px;
                    color: var(--tayeb-black);
                    font-size: 18px;
                    font-weight: 900;
                }

                .load-fact-price {
                    background: var(--tayeb-orange-light);
                    border-color: #fed7aa;
                }

                .load-fact-price strong {
                    color: var(--tayeb-orange-dark);
                }

                .load-own-price {
                    margin: 10px 0 0;
                    color: var(--tayeb-muted);
                    font-size: 12px;
                }

                .load-proof {
                    margin: 14px 0 0;
                    padding: 10px 12px;
                    border-radius: 12px;
                    background: #fffbeb;
                    color: #92400e;
                    font-size: 12px;
                    font-weight: 800;
                }

                .load-card :global(.load-cta) {
                    min-height: 54px;
                    margin-top: 18px;
                    font-size: 13px;
                    letter-spacing: 0.02em;
                }

                .load-free-note {
                    margin: 10px 0 0;
                    color: var(--tayeb-muted);
                    font-size: 11px;
                    text-align: center;
                }

                .load-taken {
                    margin-top: 18px;
                    padding: 14px;
                    border-radius: var(--tayeb-radius-small);
                    background: #f3f4f6;
                    color: var(--tayeb-muted);
                    font-size: 13px;
                    font-weight: 800;
                    text-align: center;
                }


                /* =================================================
                   STEPS
                ================================================= */

                .load-steps {
                    padding: 20px 22px;
                    background: white;
                    border: 1px solid var(--tayeb-border);
                    border-radius: var(--tayeb-radius);
                }

                .load-steps h2 {
                    margin: 0;
                    color: var(--tayeb-black);
                    font-size: 15px;
                    font-weight: 900;
                }

                .load-steps ol {
                    list-style: none;
                    margin: 14px 0 0;
                    padding: 0;
                    display: grid;
                    gap: 10px;
                }

                .load-steps li {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: var(--tayeb-text);
                    font-size: 13px;
                    line-height: 1.4;
                }

                .load-steps li span {
                    width: 26px;
                    height: 26px;
                    flex: 0 0 26px;
                    display: grid;
                    place-items: center;
                    border-radius: 9px;
                    background: var(--tayeb-orange-light);
                    color: var(--tayeb-orange-dark);
                    font-size: 12px;
                    font-weight: 900;
                }


                /* =================================================
                   SHIPPER INVITE
                ================================================= */

                .load-shipper {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 14px;
                    padding: 18px 22px;
                    background: white;
                    border: 1px dashed #fed7aa;
                    border-radius: var(--tayeb-radius);
                }

                .load-shipper strong {
                    display: block;
                    color: var(--tayeb-black);
                    font-size: 14px;
                    font-weight: 900;
                }

                .load-shipper span {
                    display: block;
                    margin-top: 4px;
                    color: var(--tayeb-muted);
                    font-size: 12px;
                    line-height: 1.45;
                }


                /* =================================================
                   FOOTER
                ================================================= */

                .load-footer {
                    padding: 0 16px 34px;
                    color: var(--tayeb-light-text);
                    font-size: 11px;
                    font-weight: 800;
                    text-align: center;
                }


                @media (max-width: 420px) {

                    .load-card {
                        padding: 18px;
                    }

                    .load-shipper {
                        flex-direction: column;
                        align-items: stretch;
                        text-align: center;
                    }
                }

            `}</style>
        </>
    );
}
