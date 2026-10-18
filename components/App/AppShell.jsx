import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

import Notifications from "../Notifications";
import ThemeToggle, { setTheme } from "../Site/ThemeToggle";
import { useAppText } from "../../lib/appText";
import { FOUNDER } from "../../lib/founder";
import { useLanguage } from "../../lib/LanguageContext";
import { formatPhone } from "../../lib/phone";
import { logout } from "../../lib/useSession";

/*
 * ============================================================
 * APP SHELL
 * ============================================================
 *
 * Every signed-in screen: dark top bar (brand, role, language,
 * notifications, account menu), a hero with the numbers that
 * matter, tabs (a bottom bar on phones), then the content.
 *
 * tabs: [{ key, label, icon, count }]
 * stats: [{ value, label, small, hot }]
 */
export default function AppShell({
    user,
    pageTitle,
    eyebrow,
    title,
    subtitle,
    actions,
    stats = [],
    tabs = [],
    tab,
    onTab,
    children,
}) {
    const router = useRouter();

    const { language, setLanguage } = useLanguage();

    const a = useAppText();

    const [menu, setMenu] = useState(false);

    const menuBox = useRef(null);

    const mainTop = useRef(null);

    useEffect(() => {
        if (!menu) {
            return;
        }

        function close(event) {
            if (menuBox.current && !menuBox.current.contains(event.target)) {
                setMenu(false);
            }
        }

        function escape(event) {
            if (event.key === "Escape") {
                setMenu(false);
            }
        }

        document.addEventListener("pointerdown", close);
        document.addEventListener("keydown", escape);

        return () => {
            document.removeEventListener("pointerdown", close);
            document.removeEventListener("keydown", escape);
        };
    }, [menu]);

    function pick(key) {
        onTab?.(key);

        // On phones the content starts under the hero: bring it into view.
        if (mainTop.current && window.scrollY > mainTop.current.offsetTop) {
            window.scrollTo({ top: mainTop.current.offsetTop - 70, behavior: "smooth" });
        }
    }

    const hasProfile = tabs.some((item) => item.key === "profile");

    const support = `https://wa.me/${FOUNDER.whatsapp}?text=${encodeURIComponent(
        language === "fr" ? "Bonjour Tayeb, j'ai besoin d'aide." : "Hello Tayeb, I need help."
    )}`;

    return (
        <>
            <Head>
                <title>{`${pageTitle || a(`role_${user.role}`)} · Tayeb`}</title>
                <meta name="robots" content="noindex, nofollow" />
            </Head>

            <div className={`ap-page ${tabs.length ? "has-nav" : ""}`}>

                {/* =============================================
                    TOP BAR
                ============================================= */}

                <header className="ap-top">
                    <div className="ap-wrap ap-top-inner">

                        <div className="ap-top-left">
                            <Link href="/" className="ts-brand" aria-label="Tayeb">
                                <span className="ts-brand-logo">
                                    <Image src="/branding/tayeb-logo.jpeg" alt="" width={40} height={40} priority />
                                </span>
                                <span className="ts-brand-name">Tayeb</span>
                            </Link>
                            <span className="ap-role">{a(`role_${user.role}`)}</span>
                        </div>

                        <div className="ap-top-actions">

                            <div className="ap-lang" role="group" aria-label="Language">
                                <button type="button" className={language === "fr" ? "active" : ""} onClick={() => setLanguage("fr")} aria-pressed={language === "fr"}>
                                    FR
                                </button>
                                <button type="button" className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")} aria-pressed={language === "en"}>
                                    EN
                                </button>
                            </div>

                            <ThemeToggle onDark />

                            {user.role !== "ADMIN" && <Notifications userId={user.id} />}

                            <div className="ap-popover" ref={menuBox}>
                                <button
                                    type="button"
                                    className="ap-avatar"
                                    onClick={() => setMenu((current) => !current)}
                                    aria-expanded={menu}
                                    aria-label={a("menuOpen")}
                                >
                                    {(user.full_name || "T").charAt(0).toUpperCase()}
                                </button>

                                {menu && (
                                    <div className="ap-menu" role="menu">
                                        <div className="ap-menu-head">
                                            <strong>{user.full_name}</strong>
                                            <span>{user.phone_number ? formatPhone(user.phone_number) : a(`role_${user.role}`)}</span>
                                        </div>
                                        {hasProfile && (
                                            <button type="button" role="menuitem" onClick={() => { setMenu(false); pick("profile"); }}>
                                                👤 {a("menuAccount")}
                                            </button>
                                        )}
                                        <Link href="/market" role="menuitem">🌾 {a("menuMarket")}</Link>
                                        <Link href="/" role="menuitem">🏠 {a("menuHome")}</Link>
                                        <Link href="/feedback" role="menuitem">💬 {a("menuHelp")}</Link>
                                        <a href={support} target="_blank" rel="noopener noreferrer" role="menuitem">🟢 {a("menuSupport")}</a>
                                        <button type="button" role="menuitem" onClick={() => { setTheme(null); setMenu(false); }}>
                                            🌗 {a("menuThemeAuto")}
                                        </button>
                                        <button type="button" role="menuitem" className="is-danger" onClick={() => logout(router)}>
                                            ↪ {a("menuLogout")}
                                        </button>
                                    </div>
                                )}
                            </div>

                        </div>

                    </div>
                </header>


                {/* =============================================
                    HERO
                ============================================= */}

                <section className="ap-hero">
                    <div className="ap-wrap">

                        <div className="ap-hero-row">
                            <div style={{ minWidth: 0 }}>
                                {eyebrow && <span className="ap-eyebrow">{eyebrow}</span>}
                                <h1>{title}</h1>
                                {subtitle && <p className="ap-hero-sub">{subtitle}</p>}
                            </div>
                            {actions && <div className="ap-hero-actions">{actions}</div>}
                        </div>

                        {stats.length > 0 && (
                            <div className="ap-stats">
                                {stats.map((stat) => (
                                    <div key={stat.label} className={`ap-stat ${stat.hot ? "is-hot" : ""}`}>
                                        <div className="ap-stat-value">
                                            {stat.value}
                                            {stat.small && <small>{stat.small}</small>}
                                        </div>
                                        <div className="ap-stat-label">{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                    </div>
                </section>


                {/* =============================================
                    TABS
                ============================================= */}

                {tabs.length > 0 && (
                    <>
                        <div className="ap-tabs-bar">
                            <div className="ap-wrap">
                                <nav className="ap-tabs" aria-label="Tayeb">
                                    {tabs.map((item) => (
                                        <button
                                            key={item.key}
                                            type="button"
                                            className={`ap-tab ${tab === item.key ? "active" : ""}`}
                                            onClick={() => pick(item.key)}
                                            aria-current={tab === item.key ? "page" : undefined}
                                        >
                                            <span aria-hidden="true">{item.icon}</span>
                                            {item.label}
                                            {item.count > 0 && <span className="ap-tab-count">{item.count}</span>}
                                        </button>
                                    ))}
                                </nav>
                            </div>
                        </div>

                        <nav className="ap-bottom-nav" aria-label="Tayeb">
                            {tabs.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    className={tab === item.key ? "active" : ""}
                                    onClick={() => pick(item.key)}
                                    aria-current={tab === item.key ? "page" : undefined}
                                >
                                    <span aria-hidden="true">{item.icon}</span>
                                    <span>{item.label}</span>
                                    {item.count > 0 && <span className="ap-tab-count">{item.count}</span>}
                                </button>
                            ))}
                        </nav>
                    </>
                )}


                {/* =============================================
                    CONTENT
                ============================================= */}

                <main className="ap-main" ref={mainTop}>
                    <div className="ap-wrap">
                        {children}
                    </div>
                </main>

                <footer className="ap-footer">
                    <div className="ap-wrap">
                        <span>© {new Date().getFullYear()} Tayeb · {a("footer")}</span>
                        <span style={{ display: "flex", gap: 16 }}>
                            <Link href="/market">{a("menuMarket")}</Link>
                            <Link href="/about">{language === "fr" ? "Notre histoire" : "Our story"}</Link>
                            <Link href="/feedback">{a("menuHelp")}</Link>
                        </span>
                    </div>
                </footer>

            </div>
        </>
    );
}
