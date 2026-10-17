import { createContext, useContext, useMemo } from "react";
import { useRouter } from "next/router";

/*
 * ============================================================
 * LANGUAGE
 * ============================================================
 *
 * The language comes from the page address: "/…" is French,
 * "/en/…" is English (next.config.mjs i18n). Switching moves
 * to the same page in the other language and remembers the
 * choice in the NEXT_LOCALE cookie.
 *
 * Texts live next to the screens that use them: siteText.js,
 * marketText.js and appText.js.
 */

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
    const router = useRouter();

    const language = router.locale === "en" ? "en" : "fr";

    const value = useMemo(() => {
        function setLanguage(next) {
            if ((next !== "en" && next !== "fr") || next === language) {
                return;
            }

            try {
                document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
                localStorage.setItem("tayebLanguage", next);
            } catch {
                // Cookies blocked: the address still carries the language.
            }

            router.push({ pathname: router.pathname, query: router.query }, router.asPath, { locale: next, scroll: false });
        }

        return {
            language,
            setLanguage,
            isEnglish: language === "en",
            isFrench: language === "fr",
        };
    }, [language, router]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
    const context = useContext(LanguageContext);

    if (!context) {
        throw new Error("useLanguage must be used inside LanguageProvider.");
    }

    return context;
}

export default LanguageContext;
