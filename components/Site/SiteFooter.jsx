import Image from "next/image";
import Link from "next/link";

import { cityNames } from "../../lib/cities";
import { LIVE_COUNTRIES } from "../../lib/countries";
import { useLanguage } from "../../lib/LanguageContext";
import { CATEGORIES } from "../../lib/produce";
import { useSiteText } from "../../lib/siteText";

const YEAR = new Date().getFullYear();

const SUPPORT_WHATSAPP = "https://wa.me/237681731512";

/*
 * Site footer. The "©" is the staff entrance: it looks like
 * plain text and leads to the unlisted sign-in page.
 */
export default function SiteFooter() {
    const { language } = useLanguage();

    const s = useSiteText();

    return (
        <footer className="ts-footer">
            <div className="ts-wrap">

                <div className="ts-footer-grid">

                    <div>
                        <span className="ts-brand">
                            <span className="ts-brand-logo">
                                <Image src="/branding/tayeb-logo.jpeg" alt="" width={40} height={40} />
                            </span>
                            <span className="ts-brand-name">Tayeb</span>
                        </span>
                        <p style={{ marginTop: 16, maxWidth: 320 }}>{s("footerAbout")}</p>
                    </div>

                    <div>
                        <h4>{s("footerMarket")}</h4>
                        <ul>
                            {CATEGORIES.slice(0, 6).map((category) => (
                                <li key={category.key}>
                                    <Link href={`/market?category=${category.key}`}>
                                        {language === "fr" ? category.fr : category.en}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4>{s("footerCompany")}</h4>
                        <ul>
                            <li><Link href="/market">{s("navMarket")}</Link></li>
                            <li><Link href="/about">{s("footerStory")}</Link></li>
                            <li><Link href="/feedback">{s("footerFeedback")}</Link></li>
                            <li>
                                <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer">
                                    {s("footerSupport")}
                                </a>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h4>{s("footerCountries")}</h4>
                        <ul>
                            {cityNames("CM").slice(0, 8).map((city) => (
                                <li key={city}>
                                    <Link href={`/market?country=CM&city=${encodeURIComponent(city)}`}>
                                        {city}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                </div>

                <div className="ts-footer-bottom">
                    <span>
                        <Link href="/hq" className="ts-quiet" prefetch={false} rel="nofollow">©</Link>{" "}
                        {YEAR} {s("footerRights")}
                    </span>
                    <span>{LIVE_COUNTRIES.map((country) => country.flag).join(" ")}</span>
                </div>

            </div>
        </footer>
    );
}
