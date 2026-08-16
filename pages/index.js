import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect } from "react";

import BrandLogo from "../components/BrandLogo";
import { useLanguage } from "../lib/LanguageContext";

export default function Home() {
    const router = useRouter();
    const {
        language,
        setLanguage,
    } = useLanguage();

    const isFrench =
        language === "fr";

    /*
     * If somebody is already logged in,
     * send them directly to the right dashboard.
     */
    useEffect(() => {
        try {
            const savedUser =
                localStorage.getItem(
                    "tayebUser"
                );

            if (!savedUser) {
                return;
            }

            const user =
                JSON.parse(
                    savedUser
                );

            if (
                user?.role ===
                "DRIVER"
            ) {
                router.replace(
                    "/driver"
                );
            }

            if (
                user?.role ===
                "SHIPPER"
            ) {
                router.replace(
                    "/shipper"
                );
            }

            if (
                user?.role ===
                "ADMIN"
            ) {
                router.replace(
                    "/admin"
                );
            }
        } catch (error) {
            console.log(
                "Saved user check:",
                error
            );
        }
    }, [router]);


    const text = {
        eyebrow: isFrench
            ? "TAYEB"
            : "TAYEB",

        title: isFrench
            ? "Déplacez vos marchandises. Trouvez un chauffeur. Avancez."
            : "Move your goods. Find a driver. Get moving.",

        description: isFrench
            ? "Une façon simple de mettre en relation les personnes qui envoient des marchandises avec les chauffeurs qui veulent les transporter."
            : "A simple way to connect people who need to move goods with drivers ready to transport them.",

        sendCargo: isFrench
            ? "ENVOYER UN COLIS"
            : "SEND CARGO",

        driveEarn: isFrench
            ? "CONDUIRE ET GAGNER"
            : "DRIVE & EARN",

        howItWorks: isFrench
            ? "Comment ça marche"
            : "How it works",

        shipperTitle: isFrench
            ? "Vous avez une marchandise à envoyer ?"
            : "Have something to send?",

        shipperText: isFrench
            ? "Publiez votre marchandise, recevez des offres de chauffeurs et choisissez celle qui vous convient."
            : "Post your cargo, receive offers from drivers and choose the one that works for you.",

        driverTitle: isFrench
            ? "Vous êtes chauffeur ?"
            : "Are you a driver?",

        driverText: isFrench
            ? "Trouvez des marchandises disponibles, proposez votre prix et choisissez les trajets qui vous conviennent."
            : "Find available cargo, set your price and choose the trips that work for you.",

        simpleTitle: isFrench
            ? "Simple à utiliser"
            : "Simple to use",

        simpleText: isFrench
            ? "Tout est conçu pour que vous puissiez comprendre quoi faire sans perdre de temps."
            : "Everything is designed so you can understand what to do without wasting time.",

        offersTitle: isFrench
            ? "Comparez les offres"
            : "Compare offers",

        offersText: isFrench
            ? "Les chauffeurs peuvent proposer leur prix. Vous choisissez l'offre qui vous convient."
            : "Drivers can send their price. You choose the offer that works for you.",

        agreeTitle: isFrench
            ? "Mettez-vous d'accord"
            : "Agree together",

        agreeText: isFrench
            ? "Vous pouvez accepter un prix ou proposer un autre prix directement dans l'application."
            : "You can accept a price or suggest another price directly in the app.",

        deliverTitle: isFrench
            ? "Suivez la livraison"
            : "Follow the delivery",

        deliverText: isFrench
            ? "Voyez les étapes importantes jusqu'à la livraison."
            : "See the important steps until the delivery is completed.",

        freeTitle: isFrench
            ? "Tayeb est gratuit"
            : "Tayeb is free",

        freeText: isFrench
            ? "Pour le moment, toutes les fonctionnalités principales de Tayeb sont gratuites."
            : "For now, Tayeb's main features are completely free.",

        readyTitle: isFrench
            ? "Prêt à commencer ?"
            : "Ready to get started?",

        readyText: isFrench
            ? "Choisissez simplement ce que vous voulez faire."
            : "Just choose what you want to do.",

        footer: isFrench
            ? "Bougez. Gérez. Livrez."
            : "Move. Manage. Deliver.",

        login: isFrench
            ? "Se connecter"
            : "Log in",
    };


    function goToLogin(
        role
    ) {
        localStorage.setItem(
            "selectedRole",
            role
        );

        router.push(
            `/login?role=${role}`
        );
    }


    return (
        <>
            <Head>

                <title>
                    Tayeb —{" "}
                    {text.footer}
                </title>

                <meta
                    name="description"
                    content={
                        text.description
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

            </Head>


            <main className="tayeb-home">

                {/* =================================================
                    HEADER
                ================================================= */}

                <header className="tayeb-home-header">

                    <div className="tayeb-home-logo">

                        <BrandLogo
                            width={120}
                            height={48}
                        />

                    </div>


                    <div
                        style={{
                            display:
                                "flex",
                            alignItems:
                                "center",
                            gap:
                                "8px",
                        }}
                    >

                        {/* LANGUAGE */}

                        <div
                            className="tayeb-language-switch"
                        >

                            <button
                                type="button"
                                className={
                                    language ===
                                        "en"
                                        ? "active"
                                        : ""
                                }
                                onClick={() =>
                                    setLanguage(
                                        "en"
                                    )
                                }
                            >
                                EN
                            </button>

                            <button
                                type="button"
                                className={
                                    language ===
                                        "fr"
                                        ? "active"
                                        : ""
                                }
                                onClick={() =>
                                    setLanguage(
                                        "fr"
                                    )
                                }
                            >
                                FR
                            </button>

                        </div>


                        <button
                            type="button"
                            className="tayeb-home-login"
                            onClick={() =>
                                router.push(
                                    "/login"
                                )
                            }
                        >
                            {text.login}
                        </button>

                    </div>

                </header>


                {/* =================================================
                    HERO
                ================================================= */}

                <section
                    className="tayeb-home-hero"
                >

                    <div
                        className="tayeb-hero-glow"
                    />

                    <div
                        className="tayeb-hero-content"
                    >

                        <div
                            className="tayeb-home-eyebrow"
                        >
                            {text.eyebrow}
                        </div>


                        <h1>
                            {text.title}
                        </h1>


                        <p>
                            {text.description}
                        </p>


                        {/* MAIN ACTIONS */}

                        <div
                            className="tayeb-home-actions"
                        >

                            <button
                                type="button"
                                className="tayeb-home-action tayeb-home-action-primary"
                                onClick={() =>
                                    goToLogin(
                                        "SHIPPER"
                                    )
                                }
                            >

                                <span>
                                    📦
                                </span>

                                <strong>
                                    {
                                        text.sendCargo
                                    }
                                </strong>

                                <span>
                                    →
                                </span>

                            </button>


                            <button
                                type="button"
                                className="tayeb-home-action tayeb-home-action-secondary"
                                onClick={() =>
                                    goToLogin(
                                        "DRIVER"
                                    )
                                }
                            >

                                <span>
                                    🚚
                                </span>

                                <strong>
                                    {
                                        text.driveEarn
                                    }
                                </strong>

                                <span>
                                    →
                                </span>

                            </button>

                        </div>


                        {/* SMALL TRUST MESSAGE */}

                        <div
                            className="tayeb-home-free-note"
                        >
                            <span>
                                ✓
                            </span>

                            <span>
                                {
                                    text.freeText
                                }
                            </span>
                        </div>

                    </div>


                    {/* HERO VISUAL */}

                    <div
                        className="tayeb-hero-visual"
                    >

                        <div
                            className="tayeb-hero-card tayeb-hero-card-main"
                        >

                            <div
                                className="tayeb-mini-label"
                            >
                                TAYEB
                            </div>

                            <div
                                className="tayeb-mini-title"
                            >
                                📦
                                <span>
                                    Cargo
                                </span>
                            </div>


                            <div
                                className="tayeb-mini-route"
                            >

                                <div>
                                    <small>
                                        PICKUP
                                    </small>

                                    <strong>
                                        Douala
                                    </strong>
                                </div>

                                <div className="tayeb-mini-arrow">
                                    →
                                </div>

                                <div>
                                    <small>
                                        DELIVERY
                                    </small>

                                    <strong>
                                        Yaoundé
                                    </strong>
                                </div>

                            </div>


                            <div
                                className="tayeb-mini-offer"
                            >

                                <div>
                                    <small>
                                        DRIVER OFFER
                                    </small>

                                    <strong>
                                        25,000 FCFA
                                    </strong>
                                </div>

                                <span>
                                    ✓
                                </span>

                            </div>

                        </div>


                        <div
                            className="tayeb-floating-card tayeb-floating-card-one"
                        >
                            <span>
                                🚚
                            </span>

                            <div>
                                <small>
                                    DRIVER
                                </small>

                                <strong>
                                    Ready to move
                                </strong>
                            </div>
                        </div>


                        <div
                            className="tayeb-floating-card tayeb-floating-card-two"
                        >
                            <span>
                                ✓
                            </span>

                            <div>
                                <small>
                                    TAYEB
                                </small>

                                <strong>
                                    Delivery agreed
                                </strong>
                            </div>
                        </div>

                    </div>

                </section>


                {/* =================================================
                    HOW IT WORKS
                ================================================= */}

                <section
                    className="tayeb-home-section"
                >

                    <div
                        className="tayeb-home-section-heading"
                    >

                        <span>
                            TAYEB
                        </span>

                        <h2>
                            {
                                text.howItWorks
                            }
                        </h2>

                    </div>


                    <div
                        className="tayeb-home-role-grid"
                    >

                        {/* SHIPPER */}

                        <article
                            className="tayeb-home-role-card"
                        >

                            <div
                                className="tayeb-home-role-icon"
                            >
                                📦
                            </div>

                            <div>

                                <span className="tayeb-home-card-label">
                                    SEND CARGO
                                </span>

                                <h3>
                                    {
                                        text.shipperTitle
                                    }
                                </h3>

                                <p>
                                    {
                                        text.shipperText
                                    }
                                </p>

                            </div>

                        </article>


                        {/* DRIVER */}

                        <article
                            className="tayeb-home-role-card"
                        >

                            <div
                                className="tayeb-home-role-icon"
                            >
                                🚚
                            </div>

                            <div>

                                <span className="tayeb-home-card-label">
                                    DRIVE & EARN
                                </span>

                                <h3>
                                    {
                                        text.driverTitle
                                    }
                                </h3>

                                <p>
                                    {
                                        text.driverText
                                    }
                                </p>

                            </div>

                        </article>

                    </div>

                </section>


                {/* =================================================
                    SIMPLE STEPS
                ================================================= */}

                <section
                    className="tayeb-home-section tayeb-home-section-soft"
                >

                    <div
                        className="tayeb-home-section-heading"
                    >

                        <span>
                            TAYEB
                        </span>

                        <h2>
                            {
                                text.simpleTitle
                            }
                        </h2>

                        <p>
                            {
                                text.simpleText
                            }
                        </p>

                    </div>


                    <div
                        className="tayeb-home-steps"
                    >

                        <HomeStep
                            number="01"
                            icon="📦"
                            title={
                                text.shipperTitle
                            }
                            text={
                                text.shipperText
                            }
                        />

                        <HomeStep
                            number="02"
                            icon="💰"
                            title={
                                text.offersTitle
                            }
                            text={
                                text.offersText
                            }
                        />

                        <HomeStep
                            number="03"
                            icon="🤝"
                            title={
                                text.agreeTitle
                            }
                            text={
                                text.agreeText
                            }
                        />

                        <HomeStep
                            number="04"
                            icon="🚚"
                            title={
                                text.deliverTitle
                            }
                            text={
                                text.deliverText
                            }
                        />

                    </div>

                </section>


                {/* =================================================
                    FREE
                ================================================= */}

                <section
                    className="tayeb-home-free"
                >

                    <div
                        className="tayeb-home-free-inner"
                    >

                        <div
                            className="tayeb-home-free-icon"
                        >
                            ✓
                        </div>

                        <div>

                            <span>
                                TAYEB
                            </span>

                            <h2>
                                {
                                    text.freeTitle
                                }
                            </h2>

                            <p>
                                {
                                    text.freeText
                                }
                            </p>

                        </div>

                    </div>

                </section>


                {/* =================================================
                    FINAL CTA
                ================================================= */}

                <section
                    className="tayeb-home-final"
                >

                    <div>

                        <span>
                            TAYEB
                        </span>

                        <h2>
                            {
                                text.readyTitle
                            }
                        </h2>

                        <p>
                            {
                                text.readyText
                            }
                        </p>

                    </div>


                    <div
                        className="tayeb-home-actions tayeb-home-actions-final"
                    >

                        <button
                            type="button"
                            className="tayeb-home-action tayeb-home-action-primary"
                            onClick={() =>
                                goToLogin(
                                    "SHIPPER"
                                )
                            }
                        >
                            📦
                            <strong>
                                {
                                    text.sendCargo
                                }
                            </strong>
                            →
                        </button>


                        <button
                            type="button"
                            className="tayeb-home-action tayeb-home-action-secondary"
                            onClick={() =>
                                goToLogin(
                                    "DRIVER"
                                )
                            }
                        >
                            🚚
                            <strong>
                                {
                                    text.driveEarn
                                }
                            </strong>
                            →
                        </button>

                    </div>

                </section>


                {/* =================================================
                    FOOTER
                ================================================= */}

                <footer
                    className="tayeb-home-footer"
                >

                    <BrandLogo
                        width={105}
                        height={42}
                    />

                    <p>
                        {text.footer}
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                "/login"
                            )
                        }
                    >
                        {text.login}
                    </button>

                </footer>

            </main>


            <style jsx global>{`

                /* =================================================
                   HOME PAGE
                ================================================= */

                .tayeb-home {
                    min-height: 100vh;
                    background: #ffffff;
                    color: #111827;
                    overflow: hidden;
                }


                /* =================================================
                   HEADER
                ================================================= */

                .tayeb-home-header {
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    min-height: 72px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 15px;
                    padding: 12px clamp(18px, 5vw, 70px);
                    background: rgba(255,255,255,0.95);
                    border-bottom: 1px solid #f1f5f9;
                    backdrop-filter: blur(18px);
                    -webkit-backdrop-filter: blur(18px);
                }


                .tayeb-home-logo {
                    display: flex;
                    align-items: center;
                }


                /* =================================================
                   LANGUAGE
                ================================================= */

                .tayeb-language-switch {
                    display: flex;
                    align-items: center;
                    gap: 2px;
                    padding: 3px;
                    background: #f8fafc;
                    border: 1px solid #e5e7eb;
                    border-radius: 10px;
                }


                .tayeb-language-switch button {
                    border: 0;
                    background: transparent;
                    color: #9ca3af;
                    border-radius: 7px;
                    padding: 6px 8px;
                    font-size: 8px;
                    font-weight: 900;
                    cursor: pointer;
                }


                .tayeb-language-switch button.active {
                    background: #fff7ed;
                    color: #f97316;
                }


                .tayeb-home-login {
                    min-height: 38px;
                    padding: 0 14px;
                    border: 1px solid #e5e7eb;
                    border-radius: 11px;
                    background: #ffffff;
                    color: #374151;
                    font-size: 9px;
                    font-weight: 800;
                    cursor: pointer;
                    transition: 0.15s ease;
                }


                .tayeb-home-login:hover {
                    border-color: #fed7aa;
                    color: #ea580c;
                    background: #fff7ed;
                }


                /* =================================================
                   HERO
                ================================================= */

                .tayeb-home-hero {
                    position: relative;
                    width: min(1250px, 100%);
                    min-height: 680px;
                    margin: 0 auto;
                    padding: 80px clamp(18px, 5vw, 60px);
                    display: grid;
                    grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
                    align-items: center;
                    gap: 50px;
                }


                .tayeb-hero-glow {
                    position: absolute;
                    width: 500px;
                    height: 500px;
                    right: -180px;
                    top: 20px;
                    border-radius: 50%;
                    background: #fff7ed;
                    filter: blur(10px);
                    z-index: 0;
                }


                .tayeb-hero-content {
                    position: relative;
                    z-index: 2;
                }


                .tayeb-home-eyebrow {
                    display: inline-flex;
                    align-items: center;
                    min-height: 28px;
                    padding: 0 10px;
                    border-radius: 999px;
                    background: #fff7ed;
                    border: 1px solid #fed7aa;
                    color: #ea580c;
                    font-size: 8px;
                    font-weight: 900;
                    letter-spacing: 0.16em;
                }


                .tayeb-hero-content h1 {
                    max-width: 700px;
                    margin: 18px 0 0;
                    color: #111827;
                    font-size: clamp(40px, 6vw, 72px);
                    line-height: 0.98;
                    letter-spacing: -0.065em;
                    font-weight: 900;
                }


                .tayeb-hero-content h1::first-letter {
                    color: #111827;
                }


                .tayeb-hero-content p {
                    max-width: 590px;
                    margin: 23px 0 0;
                    color: #6b7280;
                    font-size: clamp(13px, 1.5vw, 16px);
                    line-height: 1.7;
                }


                /* =================================================
                   MAIN ACTIONS
                ================================================= */

                .tayeb-home-actions {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 10px;
                    max-width: 590px;
                    margin-top: 30px;
                }


                .tayeb-home-action {
                    min-height: 62px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 0 18px;
                    border-radius: 17px;
                    cursor: pointer;
                    font-size: 10px;
                    transition:
                        transform 0.2s ease,
                        box-shadow 0.2s ease,
                        background 0.2s ease;
                }


                .tayeb-home-action:hover {
                    transform: translateY(-3px);
                }


                .tayeb-home-action strong {
                    flex: 1;
                    text-align: left;
                    font-size: 10px;
                    letter-spacing: 0.02em;
                }


                .tayeb-home-action-primary {
                    background: #f97316;
                    color: white;
                    border: 1px solid #f97316;
                    box-shadow: 0 14px 30px rgba(249,115,22,0.22);
                }


                .tayeb-home-action-primary:hover {
                    background: #ea580c;
                    box-shadow: 0 18px 38px rgba(249,115,22,0.28);
                }


                .tayeb-home-action-secondary {
                    background: #ffffff;
                    color: #111827;
                    border: 1px solid #e5e7eb;
                    box-shadow: 0 10px 25px rgba(17,24,39,0.06);
                }


                .tayeb-home-action-secondary:hover {
                    border-color: #fed7aa;
                    color: #ea580c;
                    background: #fffaf5;
                }


                .tayeb-home-free-note {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 15px;
                    color: #6b7280;
                    font-size: 9px;
                    font-weight: 600;
                }


                .tayeb-home-free-note span:first-child {
                    width: 18px;
                    height: 18px;
                    display: grid;
                    place-items: center;
                    border-radius: 50%;
                    background: #f0fdf4;
                    color: #16a34a;
                    font-size: 9px;
                    font-weight: 900;
                }


                /* =================================================
                   HERO VISUAL
                ================================================= */

                .tayeb-hero-visual {
                    position: relative;
                    z-index: 2;
                    min-height: 480px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }


                .tayeb-hero-card {
                    background: white;
                    border: 1px solid #e5e7eb;
                    box-shadow: 0 30px 80px rgba(17,24,39,0.12);
                }


                .tayeb-hero-card-main {
                    position: relative;
                    width: min(420px, 90%);
                    padding: 25px;
                    border-radius: 30px;
                    transform: rotate(1.5deg);
                }


                .tayeb-mini-label {
                    color: #f97316;
                    font-size: 8px;
                    font-weight: 900;
                    letter-spacing: 0.16em;
                }


                .tayeb-mini-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-top: 18px;
                    color: #111827;
                    font-size: 20px;
                    font-weight: 900;
                }


                .tayeb-mini-route {
                    display: grid;
                    grid-template-columns: 1fr auto 1fr;
                    align-items: center;
                    gap: 12px;
                    margin-top: 25px;
                    padding: 17px;
                    border-radius: 18px;
                    background: #fafafa;
                    border: 1px solid #f1f5f9;
                }


                .tayeb-mini-route small,
                .tayeb-mini-offer small {
                    display: block;
                    color: #9ca3af;
                    font-size: 7px;
                    font-weight: 800;
                    letter-spacing: 0.08em;
                }


                .tayeb-mini-route strong {
                    display: block;
                    margin-top: 5px;
                    color: #111827;
                    font-size: 11px;
                }


                .tayeb-mini-arrow {
                    color: #f97316;
                    font-size: 20px;
                    font-weight: 900;
                }


                .tayeb-mini-offer {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    margin-top: 12px;
                    padding: 15px;
                    border-radius: 17px;
                    background: #fff7ed;
                    border: 1px solid #fed7aa;
                }


                .tayeb-mini-offer strong {
                    display: block;
                    margin-top: 4px;
                    color: #ea580c;
                    font-size: 17px;
                    font-weight: 900;
                }


                .tayeb-mini-offer > span {
                    width: 34px;
                    height: 34px;
                    display: grid;
                    place-items: center;
                    border-radius: 12px;
                    background: #f97316;
                    color: white;
                    font-weight: 900;
                }


                .tayeb-floating-card {
                    position: absolute;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 14px;
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 15px;
                    box-shadow: 0 15px 35px rgba(17,24,39,0.10);
                }


                .tayeb-floating-card > span {
                    width: 33px;
                    height: 33px;
                    display: grid;
                    place-items: center;
                    border-radius: 11px;
                    background: #fff7ed;
                    font-size: 15px;
                }


                .tayeb-floating-card small {
                    display: block;
                    color: #9ca3af;
                    font-size: 6px;
                    font-weight: 900;
                }


                .tayeb-floating-card strong {
                    display: block;
                    margin-top: 3px;
                    color: #374151;
                    font-size: 9px;
                }


                .tayeb-floating-card-one {
                    left: 0;
                    top: 95px;
                }


                .tayeb-floating-card-two {
                    right: 0;
                    bottom: 95px;
                }


                /* =================================================
                   SECTIONS
                ================================================= */

                .tayeb-home-section {
                    width: min(1150px, 100%);
                    margin: 0 auto;
                    padding: 90px clamp(18px, 5vw, 45px);
                }


                .tayeb-home-section-soft {
                    width: 100%;
                    max-width: none;
                    background: #f8fafc;
                }


                .tayeb-home-section-heading {
                    max-width: 650px;
                    margin: 0 auto 40px;
                    text-align: center;
                }


                .tayeb-home-section-heading > span,
                .tayeb-home-free-inner > div:last-child > span,
                .tayeb-home-final > div:first-child > span {
                    color: #f97316;
                    font-size: 8px;
                    font-weight: 900;
                    letter-spacing: 0.16em;
                }


                .tayeb-home-section-heading h2 {
                    margin: 9px 0 0;
                    color: #111827;
                    font-size: clamp(27px, 4vw, 42px);
                    line-height: 1;
                    letter-spacing: -0.045em;
                    font-weight: 900;
                }


                .tayeb-home-section-heading p {
                    margin: 13px auto 0;
                    max-width: 500px;
                    color: #6b7280;
                    font-size: 12px;
                    line-height: 1.7;
                }


                /* =================================================
                   ROLE CARDS
                ================================================= */

                .tayeb-home-role-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 15px;
                }


                .tayeb-home-role-card {
                    display: flex;
                    gap: 18px;
                    padding: 25px;
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 24px;
                    box-shadow: 0 10px 30px rgba(17,24,39,0.05);
                    transition: 0.2s ease;
                }


                .tayeb-home-role-card:hover {
                    transform: translateY(-3px);
                    border-color: #fed7aa;
                    box-shadow: 0 18px 40px rgba(17,24,39,0.08);
                }


                .tayeb-home-role-icon {
                    width: 52px;
                    height: 52px;
                    flex: 0 0 52px;
                    display: grid;
                    place-items: center;
                    border-radius: 16px;
                    background: #fff7ed;
                    font-size: 23px;
                }


                .tayeb-home-card-label {
                    color: #f97316;
                    font-size: 7px;
                    font-weight: 900;
                    letter-spacing: 0.12em;
                }


                .tayeb-home-role-card h3 {
                    margin: 7px 0 0;
                    color: #111827;
                    font-size: 17px;
                    line-height: 1.2;
                    font-weight: 900;
                }


                .tayeb-home-role-card p {
                    margin: 9px 0 0;
                    color: #6b7280;
                    font-size: 10px;
                    line-height: 1.65;
                }


                /* =================================================
                   STEPS
                ================================================= */

                .tayeb-home-steps {
                    width: min(1100px, 100%);
                    margin: 0 auto;
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 12px;
                }


                .tayeb-home-step {
                    position: relative;
                    padding: 22px;
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 20px;
                }


                .tayeb-home-step-number {
                    color: #f97316;
                    font-size: 9px;
                    font-weight: 900;
                }


                .tayeb-home-step-icon {
                    margin-top: 18px;
                    font-size: 22px;
                }


                .tayeb-home-step h3 {
                    margin: 12px 0 0;
                    color: #111827;
                    font-size: 13px;
                    font-weight: 900;
                }


                .tayeb-home-step p {
                    margin: 8px 0 0;
                    color: #6b7280;
                    font-size: 9px;
                    line-height: 1.65;
                }


                /* =================================================
                   FREE SECTION
                ================================================= */

                .tayeb-home-free {
                    padding: 75px 18px;
                    background: #fff7ed;
                    border-top: 1px solid #fed7aa;
                    border-bottom: 1px solid #fed7aa;
                }


                .tayeb-home-free-inner {
                    width: min(850px, 100%);
                    margin: 0 auto;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 20px;
                }


                .tayeb-home-free-icon {
                    width: 58px;
                    height: 58px;
                    flex: 0 0 58px;
                    display: grid;
                    place-items: center;
                    border-radius: 18px;
                    background: #f97316;
                    color: white;
                    font-size: 25px;
                    font-weight: 900;
                    box-shadow: 0 12px 25px rgba(249,115,22,0.22);
                }


                .tayeb-home-free-inner h2 {
                    margin: 7px 0 0;
                    color: #111827;
                    font-size: 28px;
                    font-weight: 900;
                    letter-spacing: -0.04em;
                }


                .tayeb-home-free-inner p {
                    margin: 7px 0 0;
                    color: #6b7280;
                    font-size: 10px;
                    line-height: 1.6;
                }


                /* =================================================
                   FINAL CTA
                ================================================= */

                .tayeb-home-final {
                    width: min(1000px, 100%);
                    margin: 0 auto;
                    padding: 90px 18px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 30px;
                }


                .tayeb-home-final h2 {
                    margin: 8px 0 0;
                    color: #111827;
                    font-size: clamp(28px, 4vw, 42px);
                    line-height: 1;
                    letter-spacing: -0.05em;
                    font-weight: 900;
                }


                .tayeb-home-final p {
                    margin: 11px 0 0;
                    color: #6b7280;
                    font-size: 10px;
                }


                .tayeb-home-actions-final {
                    width: min(470px, 100%);
                    margin-top: 0;
                }


                /* =================================================
                   FOOTER
                ================================================= */

                .tayeb-home-footer {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 35px 18px 45px;
                    border-top: 1px solid #e5e7eb;
                    background: white;
                    text-align: center;
                }


                .tayeb-home-footer p {
                    margin: 9px 0 12px;
                    color: #9ca3af;
                    font-size: 8px;
                    font-weight: 800;
                }


                .tayeb-home-footer button {
                    border: 0;
                    background: transparent;
                    color: #f97316;
                    font-size: 8px;
                    font-weight: 900;
                    cursor: pointer;
                }


                /* =================================================
                   MOBILE
                ================================================= */

                @media (max-width: 900px) {

                    .tayeb-home-hero {
                        grid-template-columns: 1fr;
                        min-height: auto;
                        padding-top: 65px;
                        padding-bottom: 65px;
                    }

                    .tayeb-hero-content {
                        text-align: center;
                    }

                    .tayeb-hero-content p {
                        margin-left: auto;
                        margin-right: auto;
                    }

                    .tayeb-home-actions {
                        margin-left: auto;
                        margin-right: auto;
                    }

                    .tayeb-home-free-note {
                        justify-content: center;
                    }

                    .tayeb-hero-visual {
                        min-height: 430px;
                    }

                    .tayeb-home-steps {
                        grid-template-columns:
                            repeat(2, minmax(0, 1fr));
                    }

                    .tayeb-home-final {
                        flex-direction: column;
                        text-align: center;
                    }

                    .tayeb-home-actions-final {
                        margin-top: 5px;
                    }
                }


                @media (max-width: 620px) {

                    .tayeb-home-header {
                        padding:
                            9px 13px;
                    }

                    .tayeb-home-logo img {
                        max-width:
                            95px;
                    }

                    .tayeb-home-login {
                        min-height:
                            35px;
                        padding:
                            0 11px;
                        font-size:
                            8px;
                    }

                    .tayeb-home-hero {
                        padding:
                            50px 15px;
                    }

                    .tayeb-hero-content h1 {
                        font-size:
                            clamp(38px, 12vw, 55px);
                    }

                    .tayeb-home-actions {
                        grid-template-columns:
                            1fr;
                    }

                    .tayeb-home-action {
                        min-height:
                            58px;
                    }

                    .tayeb-hero-visual {
                        min-height:
                            360px;
                    }

                    .tayeb-hero-card-main {
                        width:
                            min(360px, 87%);
                        padding:
                            19px;
                    }

                    .tayeb-floating-card {
                        padding:
                            9px;
                    }

                    .tayeb-floating-card-one {
                        left:
                            -2px;
                        top:
                            50px;
                    }

                    .tayeb-floating-card-two {
                        right:
                            -2px;
                        bottom:
                            45px;
                    }

                    .tayeb-home-section {
                        padding:
                            65px 14px;
                    }

                    .tayeb-home-role-grid {
                        grid-template-columns:
                            1fr;
                    }

                    .tayeb-home-role-card {
                        padding:
                            19px;
                    }

                    .tayeb-home-steps {
                        grid-template-columns:
                            1fr;
                    }

                    .tayeb-home-free-inner {
                        align-items:
                            flex-start;
                    }

                    .tayeb-home-free-inner h2 {
                        font-size:
                            24px;
                    }

                    .tayeb-home-final {
                        padding:
                            65px 14px;
                    }

                    .tayeb-home-actions-final {
                        grid-template-columns:
                            1fr;
                    }
                }


                @media (max-width: 390px) {

                    .tayeb-home-header {
                        gap:
                            6px;
                    }

                    .tayeb-language-switch button {
                        padding:
                            5px 6px;
                    }

                    .tayeb-home-login {
                        padding:
                            0 8px;
                    }

                    .tayeb-hero-visual {
                        min-height:
                            320px;
                    }

                    .tayeb-floating-card {
                        transform:
                            scale(0.88);
                    }

                }

            `}</style>
        </>
    );
}


/* =========================================================
   HOME STEP
========================================================= */

function HomeStep({
    number,
    icon,
    title,
    text,
}) {
    return (
        <article
            className="tayeb-home-step"
        >

            <div
                className="tayeb-home-step-number"
            >
                {number}
            </div>

            <div
                className="tayeb-home-step-icon"
            >
                {icon}
            </div>

            <h3>
                {title}
            </h3>

            <p>
                {text}
            </p>

        </article>
    );
}