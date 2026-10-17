import Link from "next/link";

import BrandLogo from "../BrandLogo";
import { useLanguage } from "../../lib/LanguageContext";
import { useMarketText } from "../../lib/marketText";
import { DASHBOARDS } from "../../lib/useSession";

/*
 * Header for the public market pages: logo, market tag,
 * language and a login or dashboard button.
 */
export default function MarketHeader({ user, loading }) {
    const { language, setLanguage } = useLanguage();

    const m = useMarketText();

    return (
        <header className="mk-header">

            <div className="mk-header-left">

                <Link href="/" aria-label="Tayeb">
                    <BrandLogo width={104} height={40} />
                </Link>

                <Link href="/market" className="mk-brand-tag" style={{ textDecoration: "none" }}>
                    🌾 MARCHÉ
                </Link>

            </div>

            <div className="mk-header-right">

                <div className="mk-lang" role="group" aria-label="Language">
                    <button
                        type="button"
                        className={language === "en" ? "active" : ""}
                        onClick={() => setLanguage("en")}
                    >
                        EN
                    </button>
                    <button
                        type="button"
                        className={language === "fr" ? "active" : ""}
                        onClick={() => setLanguage("fr")}
                    >
                        FR
                    </button>
                </div>

                {!loading && (
                    user ? (
                        <Link href={DASHBOARDS[user.role] || "/"} className="mk-btn mk-btn-light mk-btn-sm">
                            {m("myDashboard")}
                        </Link>
                    ) : (
                        <Link href="/login" className="mk-btn mk-btn-dark mk-btn-sm">
                            {m("login")}
                        </Link>
                    )
                )}

            </div>

        </header>
    );
}
