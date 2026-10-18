import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

import PhoneInput from "../components/Site/PhoneInput";
import ThemeToggle from "../components/Site/ThemeToggle";
import { apiPost } from "../lib/api";
import { useLanguage } from "../lib/LanguageContext";

/*
 * ============================================================
 * TEAM SPACE (staff sign-in)
 * ============================================================
 *
 * Same look as the login page. Not linked anywhere except the
 * footer's "©", not indexed, and it never says "admin". The
 * server checks the number and the PIN together, slows down
 * wrong attempts and blocks an address after 5.
 */

export function getServerSideProps({ res }) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");

    return { props: {} };
}

const TEXT = {
    fr: {
        title: "Espace équipe",
        sub: "Réservé à l'équipe Tayeb.",
        heading: "Connexion de l'équipe",
        phone: "Numéro de téléphone",
        pin: "Code d'accès",
        enter: "Entrer",
        wait: "Vérification…",
        denied: "Ces informations ne sont pas correctes.",
        tooMany: "Trop d'essais. Réessayez plus tard.",
        note: "Accès surveillé : après 5 essais incorrects, il est bloqué un moment.",
        show: "Afficher le code",
        hide: "Masquer le code",
        back: "Retour",
    },
    en: {
        title: "Team space",
        sub: "For the Tayeb team only.",
        heading: "Team sign-in",
        phone: "Phone number",
        pin: "Access code",
        enter: "Enter",
        wait: "Checking…",
        denied: "These details are not correct.",
        tooMany: "Too many attempts. Try again later.",
        note: "Monitored access: after 5 wrong attempts it is blocked for a while.",
        show: "Show the code",
        hide: "Hide the code",
        back: "Back",
    },
};

export default function TeamSpace() {
    const router = useRouter();

    const { language } = useLanguage();

    const t = TEXT[language === "en" ? "en" : "fr"];

    const [country, setCountry] = useState("CM");

    const [phone, setPhone] = useState("");

    const [pin, setPin] = useState("");

    const [show, setShow] = useState(false);

    const [busy, setBusy] = useState(false);

    const [error, setError] = useState("");

    async function submit(event) {
        event.preventDefault();

        if (busy) {
            return;
        }

        setBusy(true);
        setError("");

        try {
            const session = await apiPost("/api/session/login", { isAdmin: true, phone, country, adminPin: pin });

            try {
                localStorage.setItem("tayebUser", JSON.stringify(session.user));
                localStorage.setItem("selectedRole", "ADMIN");
            } catch {
                // Storage blocked: the session cookie is what counts.
            }

            router.replace("/admin");
        } catch (failure) {
            setError(failure?.status === 429 ? t.tooMany : t.denied);
            setPin("");
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Head>
                <title>Tayeb</title>
                <meta name="robots" content="noindex, nofollow" />
            </Head>

            <main className="lg-page">

                <section className="lg-story">
                    <div className="lg-top">
                        <Link href="/" className="ts-brand" aria-label="Tayeb">
                            <span className="ts-brand-logo">
                                <Image src="/branding/tayeb-logo.jpeg" alt="" width={40} height={40} priority />
                            </span>
                            <span className="ts-brand-name">Tayeb</span>
                        </Link>
                        <div style={{ display: "flex", gap: 8 }}>
                            <ThemeToggle onDark />
                            <Link href="/" className="lg-back">← {t.back}</Link>
                        </div>
                    </div>

                    <div>
                        <h1>
                            {t.title.split(" ")[0]} <em>{t.title.split(" ").slice(1).join(" ")}</em>
                        </h1>
                        <p>{t.sub}</p>
                    </div>

                    <span />
                </section>

                <section className="lg-panel">
                    <form className="lg-card" onSubmit={submit} autoComplete="off" noValidate>

                        <h2>{t.heading}</h2>

                        <div className="ap-field">
                            <label htmlFor="team-phone">{t.phone}</label>
                            <PhoneInput id="team-phone" country={country} onCountry={setCountry} value={phone} onChange={setPhone} disabled={busy} />
                        </div>

                        <div className="ap-field">
                            <label htmlFor="team-pin">{t.pin}</label>
                            <div className="lg-pin">
                                <input
                                    id="team-pin"
                                    className="mk-input ap-pin"
                                    type={show ? "text" : "password"}
                                    value={pin}
                                    onChange={(event) => setPin(event.target.value)}
                                    placeholder="••••••"
                                    autoComplete="current-password"
                                    disabled={busy}
                                />
                                <button type="button" onClick={() => setShow((current) => !current)} aria-label={show ? t.hide : t.show} tabIndex={-1}>
                                    {show ? "🙈" : "👁️"}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="ap-note ap-note-red" role="alert">
                                <span aria-hidden="true">⚠️</span>
                                <span>{error}</span>
                            </div>
                        )}

                        <button type="submit" className="ts-btn ts-btn-primary ts-btn-lg" disabled={busy || !phone.trim() || !pin}>
                            {busy ? t.wait : `${t.enter} →`}
                        </button>

                        <div className="lg-secure">
                            <span aria-hidden="true">🔒</span>
                            <span>{t.note}</span>
                        </div>

                    </form>
                </section>

            </main>
        </>
    );
}
