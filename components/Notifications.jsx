import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { apiGet, apiPost, pollWhileVisible } from "../lib/api";
import { useAppText } from "../lib/appText";
import { useLanguage } from "../lib/LanguageContext";
import { timeAgo } from "./App/Bits";

/*
 * ============================================================
 * NOTIFICATIONS (bell + panel)
 * ============================================================
 *
 * Checked now and every 20 seconds while the page is open.
 * A short sound plays when something new arrives (never on
 * the first load, and only once the browser allows sound).
 */

const SOUND = "/sounds/notification.mp3";

/*
 * Only links inside Tayeb: "/driver", "/market/abc"… never
 * "//evil.com" or "https://…".
 */
function safeLink(link) {
    const value = String(link || "");

    return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : null;
}

export default function Notifications({ userId }) {
    const { language } = useLanguage();

    const a = useAppText();

    const [items, setItems] = useState([]);

    const [open, setOpen] = useState(false);

    const box = useRef(null);

    const audio = useRef(null);

    const known = useRef(null);

    /* ---------------- sound ---------------- */

    useEffect(() => {
        const sound = new Audio(SOUND);

        sound.preload = "auto";
        audio.current = sound;

        // Browsers allow sound only after a first tap or key.
        function unlock() {
            sound.muted = true;
            sound.play().then(() => {
                sound.pause();
                sound.currentTime = 0;
                sound.muted = false;
            }).catch(() => {
                sound.muted = false;
            });
        }

        window.addEventListener("pointerdown", unlock, { once: true });
        window.addEventListener("keydown", unlock, { once: true });

        return () => {
            window.removeEventListener("pointerdown", unlock);
            window.removeEventListener("keydown", unlock);
            sound.pause();
            audio.current = null;
        };
    }, []);

    /* ---------------- polling ---------------- */

    useEffect(() => {
        if (!userId) {
            return;
        }

        async function check() {
            try {
                const { notifications } = await apiGet("/api/notifications");

                const list = notifications || [];

                const isNew = known.current && list.some((item) => !known.current.has(item.id));

                known.current = new Set(list.map((item) => item.id));

                setItems(list);

                if (isNew && audio.current) {
                    audio.current.currentTime = 0;
                    audio.current.volume = 0.85;
                    audio.current.play().catch(() => {});
                }
            } catch {
                // A missed check is fine: the next one catches up.
            }
        }

        return pollWhileVisible(check, 20000);
    }, [userId]);

    /* ---------------- open / close ---------------- */

    useEffect(() => {
        if (!open) {
            return;
        }

        function close(event) {
            if (box.current && !box.current.contains(event.target)) {
                setOpen(false);
            }
        }

        function escape(event) {
            if (event.key === "Escape") {
                setOpen(false);
            }
        }

        document.addEventListener("pointerdown", close);
        document.addEventListener("keydown", escape);

        return () => {
            document.removeEventListener("pointerdown", close);
            document.removeEventListener("keydown", escape);
        };
    }, [open]);

    /* ---------------- read ---------------- */

    function markRead(item) {
        if (item.read) {
            return;
        }

        setItems((list) => list.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)));

        apiPost("/api/notifications", { id: item.id }).catch(() => {});
    }

    function markAllRead() {
        setItems((list) => list.map((entry) => ({ ...entry, read: true })));

        apiPost("/api/notifications", {}).catch(() => {});
    }

    const unread = items.filter((item) => !item.read).length;

    return (
        <div className="ap-popover" ref={box}>

            <button
                type="button"
                className="ap-icon-btn"
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
                aria-label={`${a("notifications")}${unread ? ` (${unread})` : ""}`}
            >
                <span aria-hidden="true">🔔</span>
                {unread > 0 && <span className="ap-dot">{unread > 9 ? "9+" : unread}</span>}
            </button>

            {open && (
                <div className="ap-notifs" role="dialog" aria-label={a("notifications")}>

                    <div className="ap-notifs-head">
                        <strong>{a("notifications")}</strong>
                        {unread > 0 && (
                            <button type="button" onClick={markAllRead}>
                                {a("markAllRead")}
                            </button>
                        )}
                    </div>

                    <div className="ap-notifs-list">
                        {items.length === 0 ? (
                            <div className="ap-empty" style={{ border: 0, background: "transparent" }}>
                                <div className="ap-empty-icon" aria-hidden="true">🔔</div>
                                <p>{a("noNotifications")}</p>
                            </div>
                        ) : (
                            items.map((item) => {
                                const link = safeLink(item.link);

                                return (
                                    <div
                                        key={item.id}
                                        className={`ap-notif ${item.read ? "" : "unread"}`}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => markRead(item)}
                                        onKeyDown={(event) => event.key === "Enter" && markRead(item)}
                                    >
                                        <i aria-hidden="true" />
                                        <div>
                                            <strong>{item.title}</strong>
                                            {item.message && <p>{item.message}</p>}
                                            <small>
                                                {timeAgo(item.created_at, language, a)}
                                                {link && (
                                                    <>
                                                        {" · "}
                                                        <Link href={link} onClick={() => setOpen(false)}>
                                                            {a("open")} →
                                                        </Link>
                                                    </>
                                                )}
                                            </small>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                </div>
            )}

        </div>
    );
}
