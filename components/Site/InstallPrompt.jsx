import { useEffect, useState } from "react";

import Icon from "./Icon";

import { useSiteText } from "../../lib/siteText";

const DISMISS_KEY = "tayebInstallDismissed";

/*
 * "Add Tayeb to your home screen", shown only when the
 * browser offers it (Android Chrome and similar) and the
 * person hasn't said "later" in the last 30 days.
 */
export default function InstallPrompt() {
    const s = useSiteText();

    const [event, setEvent] = useState(null);

    useEffect(() => {
        function offer(installEvent) {
            installEvent.preventDefault();

            let dismissedAt = 0;

            try {
                dismissedAt = Number(localStorage.getItem(DISMISS_KEY)) || 0;
            } catch {
                dismissedAt = 0;
            }

            if (Date.now() - dismissedAt > 30 * 86400000) {
                setEvent(installEvent);
            }
        }

        window.addEventListener("beforeinstallprompt", offer);

        return () => window.removeEventListener("beforeinstallprompt", offer);
    }, []);

    if (!event) {
        return null;
    }

    async function install() {
        event.prompt();

        try {
            await event.userChoice;
        } finally {
            setEvent(null);
        }
    }

    function later() {
        try {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {
            // Will ask again next visit.
        }

        setEvent(null);
    }

    return (
        <div className="ts-install" role="dialog" aria-label={s("installTitle")}>
            <span className="ts-install-icon" aria-hidden="true"><Icon name="phoneMoney" size={22} /></span>
            <div>
                <strong>{s("installTitle")}</strong>
                <span>{s("installText")}</span>
            </div>
            <button type="button" className="ts-btn ts-btn-glass ts-btn-sm" onClick={later}>
                {s("installLater")}
            </button>
            <button type="button" className="ts-btn ts-btn-primary ts-btn-sm" onClick={install}>
                {s("installButton")}
            </button>
        </div>
    );
}
