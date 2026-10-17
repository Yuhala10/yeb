import { useEffect } from "react";

import { useAppText } from "../../lib/appText";

/*
 * Small pieces shared by every signed-in screen.
 */

export function AppLoading() {
    const a = useAppText();

    return (
        <main className="ap-loading" aria-busy="true">
            <div className="ap-loading-mark">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/branding/tayeb-logo.jpeg" alt="Tayeb" width={72} height={72} />
                <span>{a("loading")}…</span>
            </div>
        </main>
    );
}

/*
 * From ●━━━● To, with optional areas under the city names.
 */
export function Route({ from, fromArea, to, toArea }) {
    const a = useAppText();

    return (
        <div className="ap-route">
            <div className="ap-route-end">
                <small>{a("from")}</small>
                <strong>{from || "—"}</strong>
                {fromArea && <span>{fromArea}</span>}
            </div>
            <div className="ap-route-line" aria-hidden="true" />
            <div className="ap-route-end">
                <small>{a("to")}</small>
                <strong>{to || "—"}</strong>
                {toArea && <span>{toArea}</span>}
            </div>
        </div>
    );
}

/*
 * "Akwa, Douala" → { city: "Douala", area: "Akwa" }
 */
export function splitPlace(text, city) {
    const value = String(text || "");

    if (city && value.endsWith(`, ${city}`)) {
        return { city, area: value.slice(0, -(city.length + 2)) };
    }

    return { city: city || value, area: city && value !== city ? value : "" };
}

const STEPS = ["MATCHED", "DEPARTED", "ARRIVED", "COMPLETED"];

/*
 * Driver chosen → on the road → arrived → delivered.
 */
export function DeliverySteps({ status }) {
    const a = useAppText();

    const now = STEPS.indexOf(status);

    return (
        <div className="ap-steps" aria-label={a(`load_${status}`)}>
            {STEPS.map((step, index) => (
                <div key={step} className={index < now || status === "COMPLETED" ? "done" : index === now ? "now" : ""}>
                    <i />
                    <span>{a(`step_${step}`)}</span>
                </div>
            ))}
        </div>
    );
}

export function CodeDigits({ code }) {
    return (
        <div className="ap-code-digits" aria-label={String(code).split("").join(" ")}>
            {String(code).split("").map((digit, index) => (
                <span key={index}>{digit}</span>
            ))}
        </div>
    );
}

export function Empty({ icon, title, text, children }) {
    return (
        <div className="ap-empty">
            <div className="ap-empty-icon" aria-hidden="true">{icon}</div>
            <h3>{title}</h3>
            {text && <p>{text}</p>}
            {children}
        </div>
    );
}

export function Person({ name, detail, letter }) {
    return (
        <div className="ap-person">
            <div className="ap-person-avatar" aria-hidden="true">
                {(letter || name || "T").charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
                <strong>{name}</strong>
                {detail && <span>{detail}</span>}
            </div>
        </div>
    );
}

export function SectionHead({ title, count, sub, children }) {
    return (
        <div className="ap-section-head">
            <h2>
                {title}
                {count > 0 && <span className="ap-count">{count}</span>}
            </h2>
            {children}
            {sub && <p>{sub}</p>}
        </div>
    );
}

/*
 * A bottom sheet on phones, a centred dialog on larger
 * screens (mk-modal). Escape and a tap outside close it.
 */
export function Sheet({ title, onClose, children, busy = false }) {
    const a = useAppText();

    useEffect(() => {
        function onKey(event) {
            if (event.key === "Escape" && !busy) {
                onClose();
            }
        }

        document.addEventListener("keydown", onKey);

        return () => document.removeEventListener("keydown", onKey);
    }, [onClose, busy]);

    return (
        <div
            className="mk-modal-backdrop"
            onClick={(event) => event.target === event.currentTarget && !busy && onClose()}
        >
            <div className="mk-modal" role="dialog" aria-modal="true" aria-label={title}>
                <div className="mk-modal-head">
                    <h2>{title}</h2>
                    <button type="button" className="mk-close" onClick={onClose} disabled={busy} aria-label={a("close")}>
                        ✕
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export function Stars({ onRate, disabled }) {
    return (
        <div className="ap-stars">
            {[1, 2, 3, 4, 5].map((stars) => (
                <button key={stars} type="button" disabled={disabled} onClick={() => onRate(stars)} aria-label={`${stars} / 5`}>
                    ★
                </button>
            ))}
        </div>
    );
}

/*
 * Digits only: "25 000 FCFA" → "25000".
 */
export function digits(value) {
    return String(value ?? "").replace(/\D/g, "");
}

/*
 * "il y a 5 min", "il y a 3 h", then a short date.
 */
export function timeAgo(value, language, a) {
    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));

    if (minutes < 1) {
        return a("justNow");
    }

    if (minutes < 60) {
        return a("minAgo", { n: minutes });
    }

    if (minutes < 24 * 60) {
        return a("hourAgo", { n: Math.round(minutes / 60) });
    }

    return date.toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB", {
        day: "numeric",
        month: "short",
    });
}
