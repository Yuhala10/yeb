import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { useLanguage } from "../../lib/LanguageContext";
import { useSiteText } from "../../lib/siteText";
import { DASHBOARDS } from "../../lib/useSession";

function rememberLanguage(language) {
    try {
        document.cookie = `NEXT_LOCALE=${language}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
        // The address still carries the language.
    }
}

/*
 * The public site header. variant="dark" sits on the dark
 * hero and turns light once the page scrolls.
 */
export default function SiteHeader({ user, loading, variant = "light", active }) {
    const router = useRouter();

    const { language } = useLanguage();

    const s = useSiteText();

    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        function onScroll() {
            setScrolled(window.scrollY > 24);
        }

        const first = setTimeout(onScroll, 0);

        window.addEventListener("scroll", onScroll, { passive: true });

        return () => {
            clearTimeout(first);
            window.removeEventListener("scroll", onScroll);
        };
    }, []);

    const links = [
        ["market", "/market", s("navMarket")],
        ["sell", "/login?role=FARMER", s("navSell")],
        ["send", "/login?role=SHIPPER", s("navSend")],
        ["drive", "/login?role=DRIVER", s("navDrive")],
    ];

    return (
        <header className={`ts-header is-${variant} ${scrolled ? "is-scrolled" : ""}`}>
            <div className="ts-wrap ts-header-inner">

                <Link href="/" className="ts-brand" aria-label="Tayeb">
                    <span className="ts-brand-logo">
                        <Image src="/branding/tayeb-logo.jpeg" alt="" width={40} height={40} priority />
                    </span>
                    <span className="ts-brand-name">Tayeb</span>
                </Link>

                <nav className="ts-nav" aria-label="Tayeb">
                    {links.map(([key, href, label]) => (
                        <Link key={key} href={href} className={active === key ? "active" : ""}>
                            {label}
                        </Link>
                    ))}
                </nav>

                <div className="ts-header-actions">

                    <div className="ts-lang" role="group" aria-label="Language / Langue">
                        <Link
                            href={router.asPath}
                            locale="fr"
                            scroll={false}
                            className={language === "fr" ? "active" : ""}
                            hrefLang="fr"
                            onClick={() => rememberLanguage("fr")}
                        >
                            FR
                        </Link>
                        <Link
                            href={router.asPath}
                            locale="en"
                            scroll={false}
                            className={language === "en" ? "active" : ""}
                            hrefLang="en"
                            onClick={() => rememberLanguage("en")}
                        >
                            EN
                        </Link>
                    </div>

                    {!loading && (
                        user ? (
                            <Link href={DASHBOARDS[user.role] || "/"} className="ts-btn ts-btn-primary ts-btn-sm">
                                {s("dashboard")}
                            </Link>
                        ) : (
                            <Link href="/login" className="ts-btn ts-btn-primary ts-btn-sm">
                                {s("login")}
                            </Link>
                        )
                    )}

                </div>

            </div>
        </header>
    );
}
