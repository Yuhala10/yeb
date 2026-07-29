import { createContext, useContext, useEffect, useState } from "react";

import en from "./locales/en";
import fr from "./locales/fr";

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
    const [language, setLanguage] = useState("en");

    useEffect(() => {
        const saved = localStorage.getItem("tayeb-language");

        if (saved) {
            setLanguage(saved);
        }
    }, []);

    function changeLanguage(lang) {
        localStorage.setItem("tayeb-language", lang);
        setLanguage(lang);
    }

    const t = language === "fr" ? fr : en;

    return (
        <LanguageContext.Provider
            value={{
                language,
                changeLanguage,
                t,
            }}
        >
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    return useContext(LanguageContext);
}