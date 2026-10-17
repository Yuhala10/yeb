import Head from "next/head";
import Image from "next/image";
import Link from "next/link";

import { useLanguage } from "../lib/LanguageContext";

/*
 * Page not found: same ink and orange, and a way back to what
 * people usually want.
 */
export default function NotFound() {
    const { language } = useLanguage();

    const fr = language === "fr";

    return (
        <>
            <Head>
                <title>{fr ? "Page introuvable · Tayeb" : "Page not found · Tayeb"}</title>
                <meta name="robots" content="noindex" />
            </Head>

            <main className="ap-loading" style={{ padding: 24 }}>
                <div style={{ display: "grid", justifyItems: "center", gap: 18, textAlign: "center", maxWidth: 520 }}>
                    <Link href="/" aria-label="Tayeb">
                        <Image src="/branding/tayeb-logo.jpeg" alt="Tayeb" width={64} height={64} style={{ borderRadius: 20, boxShadow: "0 16px 40px rgba(249,115,22,0.45)" }} />
                    </Link>
                    <span className="ap-eyebrow">404</span>
                    <h1 style={{ margin: 0, color: "white", fontSize: "clamp(30px, 6vw, 46px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.05 }}>
                        {fr ? "Cette route ne mène nulle part." : "This road leads nowhere."}
                    </h1>
                    <p style={{ margin: 0, color: "rgba(255,255,255,0.7)", fontSize: 17 }}>
                        {fr
                            ? "La page a peut-être été déplacée, ou le produit n'est plus en vente."
                            : "The page may have moved, or the product is no longer on sale."}
                    </p>
                    <div className="ap-actions" style={{ justifyContent: "center" }}>
                        <Link href="/" className="ts-btn ts-btn-primary">🏠 {fr ? "Accueil" : "Home"}</Link>
                        <Link href="/market" className="ts-btn ts-btn-glass">🌾 Tayeb Marché</Link>
                    </div>
                </div>
            </main>
        </>
    );
}
