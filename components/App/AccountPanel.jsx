import { useRouter } from "next/router";
import { useState } from "react";

import { useFeedback } from "./Feedback";
import { useAppText } from "../../lib/appText";
import { countryName, findCountry } from "../../lib/countries";
import { useLanguage } from "../../lib/LanguageContext";
import { formatPhone } from "../../lib/phone";
import { logout } from "../../lib/useSession";

/*
 * The profile tab's account card: who you are on Tayeb, log
 * out, and deleting the account (with a clear confirmation).
 * `children` adds role-specific rows (vehicle, city…).
 */
export default function AccountPanel({ user, children }) {
    const router = useRouter();

    const { language } = useLanguage();

    const a = useAppText();

    const { toast, confirm } = useFeedback();

    const [deleting, setDeleting] = useState(false);

    const country = findCountry(user.country);

    async function deleteAccount() {
        const yes = await confirm({
            title: a("deleteTitle"),
            text: a("deleteText"),
            confirmLabel: a("deleteConfirm"),
            tone: "danger",
            icon: "🗑️",
        });

        if (!yes) {
            return;
        }

        setDeleting(true);

        try {
            const response = await fetch("/api/account/delete", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
            });

            if (!response.ok) {
                throw new Error("delete failed");
            }

            try {
                localStorage.removeItem("tayebUser");
                localStorage.removeItem("selectedRole");
            } catch {
                // Storage blocked: nothing to clear.
            }

            toast(a("deleted"), "success");
            router.replace("/");
        } catch {
            toast(a("deleteError"), "error");
            setDeleting(false);
        }
    }

    return (
        <div className="ap-stack">

            <section className="ap-card">
                <div className="ap-card-head">
                    <div>
                        <span className="ap-label">{a("accountTitle")}</span>
                        <h3 className="ap-card-title" style={{ marginTop: 4 }}>{user.full_name}</h3>
                    </div>
                    <span className="ap-chip ap-chip-orange">{a(`role_${user.role}`)}</span>
                </div>

                <div className="ap-kv">
                    <div>
                        <small>{a("accountPhone")}</small>
                        <strong>{formatPhone(user.phone_number)}</strong>
                    </div>
                    <div>
                        <small>{a("accountCountry")}</small>
                        <strong>{country ? `${country.flag} ${countryName(country.code, language)}` : "—"}</strong>
                    </div>
                    {user.base_city && (
                        <div>
                            <small>{a("accountCity")}</small>
                            <strong>{user.base_city}</strong>
                        </div>
                    )}
                    {user.created_at && (
                        <div>
                            <small>{a("accountSince")}</small>
                            <strong>
                                {new Date(user.created_at).toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB", { month: "long", year: "numeric" })}
                            </strong>
                        </div>
                    )}
                </div>

                {children}

                <div className="ap-actions">
                    <button type="button" className="ts-btn ts-btn-light" onClick={() => logout(router)}>
                        ↪ {a("menuLogout")}
                    </button>
                </div>
            </section>

            <section className="ap-card is-muted">
                <div className="ap-row">
                    <div>
                        <strong style={{ color: "var(--ts-ink)" }}>{a("deleteTitle")}</strong>
                        <p style={{ margin: "4px 0 0", color: "var(--ts-muted)", fontSize: 14 }}>{a("deleteText")}</p>
                    </div>
                </div>
                <div>
                    <button type="button" className="ts-btn ts-btn-sm ts-btn-danger" onClick={deleteAccount} disabled={deleting}>
                        {deleting ? "…" : a("deleteTitle")}
                    </button>
                </div>
            </section>

        </div>
    );
}
