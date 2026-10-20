import { useLanguage } from "../../lib/LanguageContext";

import Icon from "./Icon";

/*
 * Light or dark, for good. Until someone taps it, Tayeb
 * follows the phone's own setting (see styles/theme.css).
 * The icon is chosen by CSS, so it is right before scripts run.
 */

const KEY = "tayebTheme";

function currentTheme() {
    const chosen = document.documentElement.getAttribute("data-theme");

    if (chosen === "light" || chosen === "dark") {
        return chosen;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function setTheme(theme) {
    const root = document.documentElement;

    try {
        if (theme === "light" || theme === "dark") {
            root.setAttribute("data-theme", theme);
            localStorage.setItem(KEY, theme);
        } else {
            root.removeAttribute("data-theme");
            localStorage.removeItem(KEY);
        }
    } catch {
        // Storage blocked: the change still applies to this visit.
    }
}

export default function ThemeToggle({ onDark = false }) {
    const { language } = useLanguage();

    const label = language === "fr" ? "Mode clair ou sombre" : "Light or dark mode";

    return (
        <button
            type="button"
            className={`ts-theme ${onDark ? "is-on-dark" : ""}`}
            onClick={() => setTheme(currentTheme() === "dark" ? "light" : "dark")}
            aria-label={label}
            title={label}
        >
            <span className="when-light" aria-hidden="true"><Icon name="moon" size={18} /></span>
            <span className="when-dark" aria-hidden="true"><Icon name="sun" size={18} /></span>
        </button>
    );
}
