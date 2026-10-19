import Link from "next/link";
import { useRef, useState } from "react";

import Avatar from "./Avatar";
import { useFeedback } from "../App/Feedback";
import { apiPost } from "../../lib/api";
import { compressImage } from "../../lib/image";
import { CAPTION_LANGUAGES } from "../../lib/languages";
import { useLanguage } from "../../lib/LanguageContext";
import { socialError, useSocialText } from "../../lib/socialText";

/*
 * ============================================================
 * MY FARM PAGE (farmer dashboard)
 * ============================================================
 *
 * Photo, cover, farm name, page address, about, languages,
 * then "See my page" and "Share on WhatsApp".
 * onSaved(user) with the updated account.
 */
export default function ProfileEditor({ user, onSaved }) {
    const { language } = useLanguage();

    const s = useSocialText();

    const { toast } = useFeedback();

    const [form, setForm] = useState({
        farmName: user.farm_name || "",
        handle: user.handle || "",
        bio: user.bio || "",
        languages: Array.isArray(user.languages) ? user.languages : [],
    });

    const [busy, setBusy] = useState(null);

    const avatarInput = useRef(null);

    const coverInput = useRef(null);

    const changed =
        form.farmName !== (user.farm_name || "") ||
        form.handle !== (user.handle || "") ||
        form.bio !== (user.bio || "") ||
        form.languages.join(",") !== (Array.isArray(user.languages) ? user.languages : []).join(",");

    function update(field, value) {
        setForm((current) => ({ ...current, [field]: value }));
    }

    function toggleLanguage(code) {
        setForm((current) => ({
            ...current,
            languages: current.languages.includes(code) ? current.languages.filter((item) => item !== code) : [...current.languages, code].slice(0, 8),
        }));
    }

    async function save(event) {
        event.preventDefault();

        setBusy("save");

        try {
            const result = await apiPost("/api/social", {
                action: "profile",
                farmName: form.farmName.trim(),
                handle: form.handle.trim().toLowerCase(),
                bio: form.bio.trim(),
                languages: form.languages,
            });

            onSaved(result.user);
            setForm((current) => ({ ...current, handle: result.user.handle || current.handle }));
            toast(s("profileSaved"), "success");
        } catch (error) {
            toast(socialError(language, error), "error");
        } finally {
            setBusy(null);
        }
    }

    async function upload(kind, file) {
        if (!file) {
            return;
        }

        setBusy(kind);

        try {
            const image = await compressImage(file, { maxSide: kind === "avatar" ? 720 : 1600, quality: 0.85 });

            const result = await apiPost("/api/social", { action: "photo", kind, image });

            onSaved(result.user);
            toast(s("photoSaved"), "success");
        } catch (error) {
            toast(socialError(language, error), "error");
        } finally {
            setBusy(null);
        }
    }

    function share() {
        if (typeof window === "undefined" || !user.handle) {
            return;
        }

        const link = `${window.location.origin}${language === "en" ? "/en" : ""}/farm/${user.handle}`;

        window.open(`https://wa.me/?text=${encodeURIComponent(s("sharePageText", { link }))}`, "_blank", "noopener,noreferrer");
    }

    return (
        <form className="ap-card sm-editor" onSubmit={save}>

            <div>
                <span className="ap-label">🌱 {s("myPage")}</span>
                <h2 className="ap-card-title" style={{ fontSize: 22, marginTop: 4 }}>{form.farmName || user.full_name}</h2>
            </div>

            {/* ---------------- cover and photo ---------------- */}

            <div className="sm-editor-cover">
                {user.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.cover_url} alt="" />
                )}
                <button type="button" className="ts-btn ts-btn-glass ts-btn-sm" onClick={() => coverInput.current?.click()} disabled={Boolean(busy)}>
                    📷 {busy === "cover" ? "…" : `${s("coverPhoto")} · ${user.cover_url ? s("change") : s("addPhoto")}`}
                </button>
                <input ref={coverInput} type="file" accept="image/*" hidden onChange={(event) => upload("cover", event.target.files?.[0])} />
            </div>

            <div className="sm-editor-avatar">
                <Avatar person={{ ...user, farm_name: form.farmName || user.farm_name }} size={92} ring />
                <button type="button" className="ts-btn ts-btn-light ts-btn-sm" onClick={() => avatarInput.current?.click()} disabled={Boolean(busy)}>
                    🙂 {busy === "avatar" ? "…" : `${s("profilePhoto")} · ${user.avatar_url ? s("change") : s("addPhoto")}`}
                </button>
                <input ref={avatarInput} type="file" accept="image/*" capture="user" hidden onChange={(event) => upload("avatar", event.target.files?.[0])} />
            </div>

            {/* ---------------- words ---------------- */}

            <div className="ap-field">
                <label htmlFor="pe-name">{s("farmName")}</label>
                <input id="pe-name" className="mk-input" maxLength={60} value={form.farmName} onChange={(event) => update("farmName", event.target.value)} placeholder={s("farmNamePlaceholder")} />
            </div>

            <div className="ap-field">
                <label htmlFor="pe-handle">{s("handle")}</label>
                <div className="sm-handle">
                    <span>tayeb…/farm/</span>
                    <input
                        id="pe-handle"
                        value={form.handle}
                        maxLength={30}
                        onChange={(event) => update("handle", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                    />
                </div>
                <small>{s("handleHint")}</small>
            </div>

            <div className="ap-field">
                <label htmlFor="pe-bio">{s("bio")}</label>
                <textarea id="pe-bio" className="mk-textarea" rows={3} maxLength={300} value={form.bio} onChange={(event) => update("bio", event.target.value)} placeholder={s("bioPlaceholder")} />
            </div>

            <div className="ap-field">
                <span className="ap-field-label">🗣️ {s("languagesSpoken")}</span>
                <div className="sm-lang-chips">
                    {CAPTION_LANGUAGES.filter((item) => item.code !== "mis").map((item) => (
                        <button
                            key={item.code}
                            type="button"
                            className={form.languages.includes(item.code) ? "active" : ""}
                            onClick={() => toggleLanguage(item.code)}
                            aria-pressed={form.languages.includes(item.code)}
                        >
                            {language === "en" ? item.en : item.fr}
                        </button>
                    ))}
                </div>
            </div>

            <div className="ap-actions">
                <button type="submit" className="ts-btn ts-btn-primary" disabled={busy === "save" || !changed}>
                    {busy === "save" ? "…" : `✓ ${s("saveProfile")}`}
                </button>
                {user.handle && (
                    <Link href={`/farm/${user.handle}`} className="ts-btn ts-btn-light">
                        👁️ {s("viewMyPage")}
                    </Link>
                )}
                {user.handle && (
                    <button type="button" className="ts-btn ts-btn-whatsapp" onClick={share}>
                        💬 {s("sharePage")}
                    </button>
                )}
            </div>
        </form>
    );
}
