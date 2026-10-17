import Image from "next/image";
import { useRouter } from "next/router";
import { useState } from "react";

import Seo from "../components/Site/Seo";
import { apiPost } from "../lib/api";
import { useLanguage } from "../lib/LanguageContext";
import { siteOrigin } from "../lib/seo";

/*
 * Staff sign-in. Not linked anywhere except the footer's "©",
 * not indexed, and the page never says what it is for. The
 * server checks the number and the PIN together, slows down
 * wrong attempts and blocks an address after 5.
 */

export async function getServerSideProps({ req, res }) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");

    return { props: { origin: siteOrigin(req) } };
}

export default function Hq({ origin }) {
    const router = useRouter();

    const { language } = useLanguage();

    const fr = language === "fr";

    const [phone, setPhone] = useState("");

    const [pin, setPin] = useState("");

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
            const session = await apiPost("/api/session/login", {
                isAdmin: true,
                phone,
                country: "CM",
                adminPin: pin,
            });

            localStorage.setItem("tayebUser", JSON.stringify(session.user));
            localStorage.setItem("selectedRole", "ADMIN");

            router.replace("/admin");
        } catch (failure) {
            setError(failure?.status === 429 ? (fr ? "Trop d'essais. Réessayez plus tard." : "Too many attempts. Try again later.") : (fr ? "Accès refusé." : "Access denied."));
            setPin("");
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Seo origin={origin} path="/hq" title="Tayeb" description="Tayeb" noindex />

            <main
                style={{
                    minHeight: "100vh",
                    display: "grid",
                    placeItems: "center",
                    padding: 20,
                    background: "radial-gradient(60% 50% at 50% 0%, rgba(249,115,22,0.25), transparent 70%), #0b1220",
                }}
            >
                <form
                    onSubmit={submit}
                    style={{
                        width: "min(380px, 100%)",
                        display: "grid",
                        gap: 14,
                        padding: 28,
                        borderRadius: 26,
                        background: "rgba(255,255,255,0.96)",
                        boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
                    }}
                    autoComplete="off"
                >
                    <div style={{ display: "flex", justifyContent: "center" }}>
                        <Image src="/branding/tayeb-logo.jpeg" alt="Tayeb" width={56} height={56} style={{ borderRadius: 16 }} />
                    </div>

                    <input
                        className="mk-input"
                        type="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="•••"
                        aria-label={fr ? "Numéro" : "Number"}
                        required
                        disabled={busy}
                    />

                    <input
                        className="mk-input"
                        type="password"
                        value={pin}
                        onChange={(event) => setPin(event.target.value)}
                        placeholder="••••••"
                        aria-label="PIN"
                        autoComplete="current-password"
                        required
                        disabled={busy}
                    />

                    {error && <div className="mk-notice mk-notice-red" role="alert">{error}</div>}

                    <button type="submit" className="ts-btn ts-btn-ink" disabled={busy}>
                        {busy ? "…" : "→"}
                    </button>
                </form>
            </main>
        </>
    );
}
