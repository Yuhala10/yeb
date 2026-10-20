import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import Icon, { ICON_NAMES } from "../Site/Icon";

import { useLanguage } from "../../lib/LanguageContext";

/*
 * ============================================================
 * TOASTS AND CONFIRMATIONS
 * ============================================================
 *
 * Replaces the browser's alert() and confirm() boxes, which
 * look broken on phones and can't be styled:
 *
 *   const { toast, confirm } = useFeedback();
 *   toast("Price sent", "success");
 *   if (await confirm({ title, text, confirmLabel, tone: "danger" })) …
 */

const FeedbackContext = createContext(null);

const ICONS = { success: "check", error: "alert", info: "info" };

export function FeedbackProvider({ children }) {
    const { language } = useLanguage();

    const [toasts, setToasts] = useState([]);

    const [dialog, setDialog] = useState(null);

    const nextId = useRef(1);

    const confirmButton = useRef(null);

    const dismiss = useCallback((id) => {
        setToasts((list) => list.filter((item) => item.id !== id));
    }, []);

    const toast = useCallback((message, tone = "info") => {
        if (!message) {
            return;
        }

        const id = nextId.current++;

        setToasts((list) => [...list.slice(-2), { id, message: String(message), tone }]);

        setTimeout(() => dismiss(id), tone === "error" ? 6500 : 4200);
    }, [dismiss]);

    const confirm = useCallback(
        (options) => new Promise((resolve) => setDialog({ ...options, resolve })),
        []
    );

    const close = useCallback((answer) => {
        setDialog((current) => {
            current?.resolve(answer);
            return null;
        });
    }, []);

    useEffect(() => {
        if (!dialog) {
            return;
        }

        confirmButton.current?.focus();

        function onKey(event) {
            if (event.key === "Escape") {
                close(false);
            }
        }

        document.addEventListener("keydown", onKey);

        return () => document.removeEventListener("keydown", onKey);
    }, [dialog, close]);

    const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

    const fr = language === "fr";

    return (
        <FeedbackContext.Provider value={value}>
            {children}

            <div className="ap-toasts" role="status" aria-live="polite">
                {toasts.map((item) => (
                    <div key={item.id} className={`ap-toast is-${item.tone}`}>
                        <span className="ap-toast-icon" aria-hidden="true"><Icon name={ICONS[item.tone] || ICONS.info} size={18} /></span>
                        <span>{item.message}</span>
                        <button type="button" onClick={() => dismiss(item.id)} aria-label={fr ? "Fermer" : "Close"}>
                            <Icon name="x" size={16} />
                        </button>
                    </div>
                ))}
            </div>

            {dialog && (
                <div
                    className="mk-modal-backdrop"
                    onClick={(event) => event.target === event.currentTarget && close(false)}
                >
                    <div className="mk-modal" role="alertdialog" aria-modal="true" aria-labelledby="ap-dialog-title" style={{ maxWidth: 460 }}>
                        <div className={`ap-dialog ${dialog.tone === "danger" ? "is-danger" : ""}`}>
                            <div className="ap-dialog-icon" aria-hidden="true">
                                <Icon name={ICON_NAMES.includes(dialog.icon) ? dialog.icon : dialog.tone === "danger" ? "alert" : "check"} size={24} />
                            </div>
                            <h2 id="ap-dialog-title">{dialog.title}</h2>
                            {dialog.text && <p>{dialog.text}</p>}
                            <div className="ap-actions">
                                <button type="button" className="ts-btn ts-btn-light" onClick={() => close(false)}>
                                    {dialog.cancelLabel || (fr ? "Annuler" : "Cancel")}
                                </button>
                                <button
                                    ref={confirmButton}
                                    type="button"
                                    className={`ts-btn ${dialog.tone === "danger" ? "ts-btn-danger" : "ts-btn-primary"}`}
                                    onClick={() => close(true)}
                                >
                                    {dialog.confirmLabel || (fr ? "Confirmer" : "Confirm")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </FeedbackContext.Provider>
    );
}

/*
 * Outside the provider (shouldn't happen) it falls back to the
 * browser's own boxes, so nothing is ever silently lost.
 */
const FALLBACK = {
    toast: (message) => typeof window !== "undefined" && window.alert(message),
    confirm: async (options) => typeof window !== "undefined" && window.confirm(options.text || options.title),
};

export function useFeedback() {
    return useContext(FeedbackContext) || FALLBACK;
}
